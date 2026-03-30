use crate::types::WorkflowDefinition;
use serde_yaml;
use thiserror::Error;

// ============================================================
// ParseError
// ============================================================

#[derive(Debug, Error)]
pub enum ParseError {
    #[error("yaml parse error: {0}")]
    Yaml(#[from] serde_yaml::Error),

    #[error("invalid workflow: {0}")]
    Invalid(String),
}

// ============================================================
// 两阶段解析
//
// 阶段1: 预处理原始文本
//   .zouwu 文件中存在裸 {{...}} 表达式，不是合法 YAML。
//   例如: `paths: {{input.paths}}`
//   策略: 用正则把所有裸 {{...}} 替换为 '"{{...}}"'（加引号），
//         使其成为合法 YAML 字符串。
//   已经被引号包裹的 {{...}} 不重复处理。
//
// 阶段2: serde_yaml 反序列化
//   处理后的文本是标准 YAML，直接反序列化为 WorkflowDefinition。
//   所有 {{...}} 此时均以字符串形式存在于 Value 树中，
//   运行时由表达式求值器（expression/evaluator.rs）解析求值。
// ============================================================

/// 解析 .zouwu 文件内容为 WorkflowDefinition
pub fn parse_workflow(content: &str) -> Result<WorkflowDefinition, ParseError> {
    let preprocessed = preprocess_expressions(content);
    let workflow: WorkflowDefinition = serde_yaml::from_str(&preprocessed)?;
    validate_workflow(&workflow)?;
    Ok(workflow)
}

/// 阶段1: 预处理 — 将裸 {{...}} 表达式加引号使其成为合法 YAML
///
/// 匹配规则:
/// - 裸表达式: 值字段直接跟 {{...}}，例如 `key: {{expr}}`
/// - 跳过已经有引号的: `key: "{{expr}}"` 或 `key: '{{expr}}'`
/// - 跳过注释行: `# {{...}}`
fn preprocess_expressions(content: &str) -> String {
    let mut result = String::with_capacity(content.len() + 64);

    for line in content.lines() {
        let processed = process_line(line);
        result.push_str(&processed);
        result.push('\n');
    }

    result
}

/// 处理单行：将该行中所有裸 {{...}} 加上引号
/// 使用字节级处理检测 ASCII 引号和 `{{`，非 ASCII 字节直接按字节传递
fn process_line(line: &str) -> String {
    // 注释行直接跳过
    let trimmed = line.trim_start();
    if trimmed.starts_with('#') {
        return line.to_string();
    }

    let mut output = String::with_capacity(line.len() + 16);
    let bytes = line.as_bytes();
    let mut in_quotes = false;
    let mut quote_char = b'"';
    let mut i = 0;

    while i < bytes.len() {
        let b = bytes[i];

        // 非 ASCII 字节 — UTF-8 多字节字符，找到完整字符边界后原样传递
        if b > 0x7F {
            // 找到当前 UTF-8 字符的边界（从 i 开始往后找下一个字符边界）
            let char_start = i;
            i += 1;
            while i < bytes.len() && (bytes[i] & 0xC0) == 0x80 {
                i += 1;
            }
            // SAFETY: 原始字符串是合法 UTF-8，切片边界对齐字符边界
            output.push_str(&line[char_start..i]);
            continue;
        }

        let ch = b as char;

        // 引号状态跟踪（仅 ASCII 引号）
        if !in_quotes && (b == b'"' || b == b'\'') {
            in_quotes = true;
            quote_char = b;
            output.push(ch);
            i += 1;
            continue;
        }

        if in_quotes && b == quote_char {
            in_quotes = false;
            output.push(ch);
            i += 1;
            continue;
        }

        // 检测裸 {{ 开始（不在引号内）
        if !in_quotes && b == b'{' && i + 1 < bytes.len() && bytes[i + 1] == b'{' {
            if let Some(end) = find_closing(bytes, i + 2) {
                // end 指向第一个 '}'，expr 切片包含 {{ ... }}
                let expr = &line[i..end + 2];
                output.push('"');
                output.push_str(expr);
                output.push('"');
                i = end + 2;
                continue;
            }
        }

        output.push(ch);
        i += 1;
    }

    output
}

/// 从 pos 开始在 bytes 中找到 `}}` 的位置。
/// 返回第一个 `}` 的字节索引，caller 使用 `end + 2` 可以跳过整个 `}}`。
fn find_closing(bytes: &[u8], start: usize) -> Option<usize> {
    let mut i = start;
    while i + 1 < bytes.len() {
        if bytes[i] == b'}' && bytes[i + 1] == b'}' {
            return Some(i);
        }
        i += 1;
    }
    None
}

/// 基础校验：确保 id 和 steps 不为空
fn validate_workflow(wf: &WorkflowDefinition) -> Result<(), ParseError> {
    if wf.id.is_empty() {
        return Err(ParseError::Invalid("workflow id is required".to_string()));
    }
    if wf.name.is_empty() {
        return Err(ParseError::Invalid(
            "workflow name is required".to_string(),
        ));
    }
    // steps 可以为空（某些工作流只有触发器），不强制要求
    Ok(())
}

// ============================================================
// 单元测试
// ============================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_preprocess_bare_expression() {
        let input = "  paths: {{input.paths}}";
        let output = process_line(input);
        assert_eq!(output, r#"  paths: "{{input.paths}}""#);
    }

    #[test]
    fn test_preprocess_already_quoted() {
        // 已经有引号的不应该再加
        let input = r#"  key: "{{ inputs.key }}""#;
        let output = process_line(input);
        assert_eq!(output, input);
    }

    #[test]
    fn test_preprocess_comment_line() {
        let input = "# {{this is a comment}}";
        let output = process_line(input);
        assert_eq!(output, input);
    }

    #[test]
    fn test_preprocess_multiple_expressions() {
        let input = "  value: {{steps.foo.result}} and {{inputs.bar}}";
        let output = process_line(input);
        assert_eq!(
            output,
            r#"  value: "{{steps.foo.result}}" and "{{inputs.bar}}""#
        );
    }

    #[test]
    fn test_parse_simple_workflow() {
        let yaml = r#"
id: "test_workflow"
name: "测试工作流"
version: "1.0.0"
steps:
  - id: "step1"
    type: "builtin"
    action: "return"
    input:
      success: true
"#;
        let result = parse_workflow(yaml);
        assert!(result.is_ok(), "解析失败: {:?}", result.err());
        let wf = result.unwrap();
        assert_eq!(wf.id, "test_workflow");
        assert_eq!(wf.steps.len(), 1);
    }

    #[test]
    fn test_parse_workflow_with_bare_expressions() {
        let yaml = r#"
id: "expr_workflow"
name: "表达式测试"
version: "1.0.0"
steps:
  - id: "step1"
    type: "action"
    service: "qianliyan"
    action: "scan"
    input:
      paths: {{input.paths}}
      recursive: {{input.recursive}}
"#;
        let result = parse_workflow(yaml);
        assert!(result.is_ok(), "带裸表达式的工作流解析失败: {:?}", result.err());
    }
}

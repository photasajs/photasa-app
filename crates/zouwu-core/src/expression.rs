use serde_json::Value;
use thiserror::Error;

use crate::types::ExecutionContext;

// ============================================================
// ExprError
// ============================================================

#[derive(Debug, Error)]
pub enum ExprError {
    #[error("path not found: {0}")]
    PathNotFound(String),

    #[error("invalid expression: {0}")]
    Invalid(String),

    #[error("type error: expected {expected}, got {got}")]
    TypeError { expected: String, got: String },
}

// ============================================================
// 模板求值入口
//
// 支持的模式:
//   {{inputs.field}}          — 工作流输入
//   {{input.field}}           — 同上（兼容旧写法）
//   {{variables.name}}        — 工作流变量
//   {{steps.id.field}}        — 步骤输出
//   {{steps.id.output.field}} — 步骤输出（带 output 前缀）
//   {{loop.item}}             — 循环当前项
//   {{loop.index}}            — 循环当前索引
//   {{error.message}}         — 错误上下文
//   {{$timestamp}}            — 当前时间戳（毫秒）
// ============================================================

/// 对一个 Value 树中的所有 {{...}} 字符串进行求值
/// 非字符串类型的 Value 保持原样
pub fn resolve_value(val: &Value, ctx: &ExecutionContext) -> Value {
    match val {
        Value::String(s) => resolve_string(s, ctx),
        Value::Object(map) => {
            let resolved: serde_json::Map<String, Value> = map
                .iter()
                .map(|(k, v)| (k.clone(), resolve_value(v, ctx)))
                .collect();
            Value::Object(resolved)
        }
        Value::Array(arr) => {
            Value::Array(arr.iter().map(|v| resolve_value(v, ctx)).collect())
        }
        // 数字、布尔、null 直接返回
        other => other.clone(),
    }
}

/// 对字符串求值：可能是纯模板 `{{expr}}` 或混合字符串 `"hello {{name}}"`
fn resolve_string(s: &str, ctx: &ExecutionContext) -> Value {
    let trimmed = s.trim();

    // 纯模板：整个字符串就是 {{expr}}，返回求值后的原始类型
    if trimmed.starts_with("{{") && trimmed.ends_with("}}") {
        let expr = trimmed[2..trimmed.len() - 2].trim();
        return eval_expr(expr, ctx).unwrap_or(Value::Null);
    }

    // 混合字符串：含有 {{...}} 的字符串模板，结果始终是字符串
    if s.contains("{{") {
        let result = replace_templates(s, ctx);
        return Value::String(result);
    }

    // 普通字符串，无模板
    Value::String(s.to_string())
}

/// 替换字符串中所有 {{...}} 占位符，结果为字符串
fn replace_templates(s: &str, ctx: &ExecutionContext) -> String {
    let mut result = String::new();
    let mut rest = s;

    while let Some(start) = rest.find("{{") {
        result.push_str(&rest[..start]);
        let after_open = &rest[start + 2..];
        if let Some(end) = after_open.find("}}") {
            let expr = after_open[..end].trim();
            let val = eval_expr(expr, ctx).unwrap_or(Value::Null);
            result.push_str(&value_to_string(&val));
            rest = &after_open[end + 2..];
        } else {
            // 未闭合的 {{，原样输出剩余内容
            result.push_str("{{");
            rest = after_open;
        }
    }
    result.push_str(rest);
    result
}

/// 将 Value 转成字符串（用于模板插值）
fn value_to_string(val: &Value) -> String {
    match val {
        Value::String(s) => s.clone(),
        Value::Null => String::new(),
        other => other.to_string(),
    }
}

/// 求值单个表达式（已去掉 {{ }}）
fn eval_expr(expr: &str, ctx: &ExecutionContext) -> Result<Value, ExprError> {
    // 特殊变量
    if expr == "$timestamp" {
        let ts = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_millis() as u64)
            .unwrap_or(0);
        return Ok(Value::Number(ts.into()));
    }

    // 路径访问：按 `.` 分割后在 ctx 中查找
    let parts: Vec<&str> = expr.splitn(2, '.').collect();
    match parts[0] {
        "inputs" | "input" => {
            let path = parts.get(1).copied().unwrap_or("");
            get_path(&ctx.inputs, path)
        }
        "variables" => {
            let key = parts.get(1).copied().unwrap_or("");
            ctx.variables
                .get(key)
                .cloned()
                .ok_or_else(|| ExprError::PathNotFound(format!("variables.{key}")))
        }
        "steps" => {
            // steps.step_id.field 或 steps.step_id.output.field
            let rest = parts.get(1).copied().unwrap_or("");
            eval_steps_path(rest, ctx)
        }
        "loop" => {
            let field = parts.get(1).copied().unwrap_or("");
            eval_loop_path(field, ctx)
        }
        "error" => {
            // error.message 等，目前返回 null
            Ok(Value::Null)
        }
        _ => {
            // 尝试作为顶层 inputs 的字段（兼容旧写法）
            get_path(&ctx.inputs, expr)
                .map_err(|_| ExprError::Invalid(format!("unknown expression root: {expr}")))
        }
    }
}

/// 在 steps 输出中查找路径：steps.step_id[.output].field...
fn eval_steps_path(rest: &str, ctx: &ExecutionContext) -> Result<Value, ExprError> {
    let parts: Vec<&str> = rest.splitn(2, '.').collect();
    let step_id = parts[0];
    let field_path = parts.get(1).copied().unwrap_or("");

    let step_output = ctx
        .step_outputs
        .get(step_id)
        .ok_or_else(|| ExprError::PathNotFound(format!("steps.{step_id}")))?;

    if field_path.is_empty() {
        return Ok(step_output.clone());
    }

    // 跳过可选的 "output." 前缀（兼容两种写法）
    let effective_path = if let Some(stripped) = field_path.strip_prefix("output.") {
        stripped
    } else {
        field_path
    };

    get_path(step_output, effective_path)
}

/// 在 loop 上下文中查找
fn eval_loop_path(field: &str, ctx: &ExecutionContext) -> Result<Value, ExprError> {
    let lc = ctx
        .loop_context
        .as_ref()
        .ok_or_else(|| ExprError::PathNotFound("loop context not available".to_string()))?;

    match field {
        "item" => Ok(lc.item.clone()),
        "index" => Ok(Value::Number(lc.index.into())),
        other => get_path(&lc.item, other),
    }
}

/// 按点路径在 Value 中深度查找（支持 "a.b.c" 格式）
pub fn get_path(root: &Value, path: &str) -> Result<Value, ExprError> {
    if path.is_empty() {
        return Ok(root.clone());
    }

    let mut current = root;
    let mut owned: Value;

    for segment in path.split('.') {
        match current {
            Value::Object(map) => {
                if let Some(v) = map.get(segment) {
                    // 借用技巧：需要 owned 来延长生命周期
                    owned = v.clone();
                    current = &owned;
                } else {
                    return Err(ExprError::PathNotFound(format!("{path} (missing: {segment})")));
                }
            }
            Value::Array(arr) => {
                // 支持数字索引
                if let Ok(idx) = segment.parse::<usize>() {
                    if let Some(v) = arr.get(idx) {
                        owned = v.clone();
                        current = &owned;
                    } else {
                        return Err(ExprError::PathNotFound(format!(
                            "{path} (index {idx} out of bounds)"
                        )));
                    }
                } else {
                    return Err(ExprError::PathNotFound(format!(
                        "{path} (cannot index array with '{segment}')"
                    )));
                }
            }
            _ => {
                return Err(ExprError::PathNotFound(format!(
                    "{path} (cannot traverse into scalar at '{segment}')"
                )));
            }
        }
    }

    Ok(current.clone())
}

/// 对条件字段求值（field 可能是路径或字面量）
pub fn resolve_condition_field(field: &str, ctx: &ExecutionContext) -> Value {
    // 如果字段本身是 {{...}} 模板
    if field.starts_with("{{") && field.ends_with("}}") {
        return resolve_string(field, ctx);
    }
    // 否则当作路径访问
    eval_expr(field, ctx).unwrap_or(Value::Null)
}

// ============================================================
// 条件求值
// ============================================================

/// 对条件进行布尔求值
pub fn eval_condition(
    field: &str,
    operator: &str,
    value: Option<&Value>,
    ctx: &ExecutionContext,
) -> bool {
    let field_val = resolve_condition_field(field, ctx);

    match operator {
        "eq" | "equals" => value == Some(&field_val),
        "ne" | "notEquals" => value != Some(&field_val),
        "exists" => !field_val.is_null(),
        "not_exists" | "notExists" => field_val.is_null(),
        "isEmpty" => is_empty_value(&field_val),
        "isNotEmpty" => !is_empty_value(&field_val),
        "gt" => compare_numbers(&field_val, value, |a, b| a > b),
        "gte" => compare_numbers(&field_val, value, |a, b| a >= b),
        "lt" => compare_numbers(&field_val, value, |a, b| a < b),
        "lte" => compare_numbers(&field_val, value, |a, b| a <= b),
        "contains" => check_contains(&field_val, value),
        "startsWith" => check_starts_with(&field_val, value),
        "endsWith" => check_ends_with(&field_val, value),
        "in" => check_in(&field_val, value),
        "optional_string_maxlen" => {
            // 字段不存在（null）时视为通过
            if field_val.is_null() {
                return true;
            }
            let max = value.and_then(|v| v.as_u64()).unwrap_or(u64::MAX);
            field_val.as_str().is_some_and(|s| s.len() as u64 <= max)
        }
        "string_maxlen" => {
            let max = value.and_then(|v| v.as_u64()).unwrap_or(u64::MAX);
            field_val.as_str().is_some_and(|s| s.len() as u64 <= max)
        }
        "string_minlen" => {
            let min = value.and_then(|v| v.as_u64()).unwrap_or(0);
            field_val.as_str().is_some_and(|s| s.len() as u64 >= min)
        }
        "matches" => {
            // 简单字符串包含检查（不引入 regex 依赖）
            if let (Some(s), Some(Value::String(pat))) = (field_val.as_str(), value) {
                s.contains(pat.as_str())
            } else {
                false
            }
        }
        _ => false,
    }
}

fn is_empty_value(val: &Value) -> bool {
    match val {
        Value::Null => true,
        Value::String(s) => s.is_empty(),
        Value::Array(a) => a.is_empty(),
        Value::Object(o) => o.is_empty(),
        _ => false,
    }
}

fn compare_numbers(field: &Value, value: Option<&Value>, cmp: impl Fn(f64, f64) -> bool) -> bool {
    let a = field.as_f64();
    let b = value.and_then(|v| v.as_f64());
    match (a, b) {
        (Some(a), Some(b)) => cmp(a, b),
        _ => false,
    }
}

fn check_contains(field: &Value, value: Option<&Value>) -> bool {
    match (field, value) {
        (Value::String(s), Some(Value::String(pat))) => s.contains(pat.as_str()),
        (Value::Array(arr), Some(v)) => arr.contains(v),
        _ => false,
    }
}

fn check_starts_with(field: &Value, value: Option<&Value>) -> bool {
    match (field, value) {
        (Value::String(s), Some(Value::String(pat))) => s.starts_with(pat.as_str()),
        _ => false,
    }
}

fn check_ends_with(field: &Value, value: Option<&Value>) -> bool {
    match (field, value) {
        (Value::String(s), Some(Value::String(pat))) => s.ends_with(pat.as_str()),
        _ => false,
    }
}

fn check_in(field: &Value, value: Option<&Value>) -> bool {
    if let Some(Value::Array(arr)) = value {
        arr.contains(field)
    } else {
        false
    }
}

// ============================================================
// 单元测试
// ============================================================

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn make_ctx() -> ExecutionContext {
        let mut ctx = ExecutionContext::new(json!({
            "paths": ["/photos", "/videos"],
            "recursive": true,
            "key": "ui.theme"
        }));
        ctx.set_step_output("step1", json!({ "result": "ok", "count": 42 }));
        ctx.set_variable("theme", json!("dark"));
        ctx
    }

    #[test]
    fn test_resolve_inputs() {
        let ctx = make_ctx();
        let val = resolve_value(&json!("{{inputs.recursive}}"), &ctx);
        assert_eq!(val, json!(true));
    }

    #[test]
    fn test_resolve_input_compat() {
        // 兼容旧写法 {{input.paths}}
        let ctx = make_ctx();
        let val = resolve_value(&json!("{{input.paths}}"), &ctx);
        assert_eq!(val, json!(["/photos", "/videos"]));
    }

    #[test]
    fn test_resolve_step_output() {
        let ctx = make_ctx();
        let val = resolve_value(&json!("{{steps.step1.count}}"), &ctx);
        assert_eq!(val, json!(42));
    }

    #[test]
    fn test_resolve_variable() {
        let ctx = make_ctx();
        let val = resolve_value(&json!("{{variables.theme}}"), &ctx);
        assert_eq!(val, json!("dark"));
    }

    #[test]
    fn test_mixed_string_template() {
        let ctx = make_ctx();
        let val = resolve_value(&json!("count is {{steps.step1.count}}"), &ctx);
        assert_eq!(val, json!("count is 42"));
    }

    #[test]
    fn test_resolve_object() {
        let ctx = make_ctx();
        let input = json!({
            "paths": "{{inputs.paths}}",
            "recursive": "{{inputs.recursive}}"
        });
        let result = resolve_value(&input, &ctx);
        assert_eq!(result["paths"], json!(["/photos", "/videos"]));
        assert_eq!(result["recursive"], json!(true));
    }

    #[test]
    fn test_condition_exists() {
        let ctx = make_ctx();
        assert!(eval_condition("inputs.key", "exists", None, &ctx));
        assert!(!eval_condition("inputs.missing", "exists", None, &ctx));
    }

    #[test]
    fn test_condition_eq() {
        let ctx = make_ctx();
        assert!(eval_condition("inputs.recursive", "eq", Some(&json!(true)), &ctx));
        assert!(!eval_condition("inputs.recursive", "eq", Some(&json!(false)), &ctx));
    }

    #[test]
    fn test_condition_optional_string_maxlen() {
        let ctx = make_ctx();
        // key = "ui.theme" (8 chars) <= 100 → true
        assert!(eval_condition("inputs.key", "optional_string_maxlen", Some(&json!(100)), &ctx));
        // missing field → null → 视为通过
        assert!(eval_condition("inputs.missing", "optional_string_maxlen", Some(&json!(100)), &ctx));
        // key 长度 > 5 → false
        assert!(!eval_condition("inputs.key", "optional_string_maxlen", Some(&json!(5)), &ctx));
    }

    #[test]
    fn test_timestamp() {
        let ctx = make_ctx();
        let val = resolve_value(&json!("{{$timestamp}}"), &ctx);
        assert!(val.is_number());
        assert!(val.as_u64().unwrap() > 0);
    }
}

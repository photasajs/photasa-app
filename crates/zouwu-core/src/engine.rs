use async_trait::async_trait;
use futures::future::BoxFuture;
use serde_json::{json, Value};
use std::sync::Arc;
use thiserror::Error;

use crate::adapter::{AdapterRegistry, AdapterError};
use crate::expression::{eval_condition, resolve_value};
use crate::types::{
    ActionStep, BuiltinStep, ConditionStep, ExecutionContext, ExecutionResult,
    LoopContext, LoopStep, ParallelStep, WorkflowCallStep, WorkflowDefinition, WorkflowStep,
};

// ============================================================
// EngineError
// ============================================================

#[derive(Debug, Error)]
pub enum EngineError {
    #[error("adapter error: {0}")]
    Adapter(#[from] AdapterError),

    #[error("step failed: {step_id} — {message}")]
    StepFailed { step_id: String, message: String },

    #[error("workflow not found: {0}")]
    WorkflowNotFound(String),

    #[error("internal error: {0}")]
    Internal(String),
}

// ============================================================
// WorkflowResolver — 用于子工作流调用的回调
// ============================================================

/// 子工作流解析器 trait：引擎在遇到 workflow 步骤时调用
#[async_trait]
pub trait WorkflowResolver: Send + Sync {
    async fn resolve(&self, workflow_id: &str) -> Option<WorkflowDefinition>;
}

// ============================================================
// ZouwuEngine
// ============================================================

pub struct ZouwuEngine {
    registry: Arc<AdapterRegistry>,
    resolver: Option<Arc<dyn WorkflowResolver>>,
}

impl ZouwuEngine {
    pub fn new(registry: AdapterRegistry) -> Self {
        Self {
            registry: Arc::new(registry),
            resolver: None,
        }
    }

    pub fn with_resolver(mut self, resolver: Arc<dyn WorkflowResolver>) -> Self {
        self.resolver = Some(resolver);
        self
    }

    /// 执行工作流，返回最终输出
    pub async fn execute(
        &self,
        workflow: &WorkflowDefinition,
        inputs: Value,
    ) -> Result<ExecutionResult, EngineError> {
        let mut ctx = ExecutionContext::new(inputs);

        // 初始化工作流级变量
        if let Some(vars) = &workflow.variables {
            for (k, v) in vars {
                ctx.set_variable(k, v.clone());
            }
        }

        // 执行主步骤列表
        let step_result = self.run_steps(&workflow.steps, &mut ctx).await?;
        let output = match step_result {
            StepResult::Return(v) | StepResult::Output(v) => v,
        };

        Ok(ExecutionResult {
            success: true,
            output,
            step_outputs: ctx.step_outputs.clone(),
        })
    }

    /// 顺序执行步骤列表，返回 StepResult（可能是 Return 或最后一个 Output）
    /// 使用 BoxFuture 以支持通过 run_condition 的间接递归
    fn run_steps<'a>(
        &'a self,
        steps: &'a [WorkflowStep],
        ctx: &'a mut ExecutionContext,
    ) -> BoxFuture<'a, Result<StepResult, EngineError>> {
        Box::pin(async move {
            let mut last_output = Value::Null;

            for step in steps {
                // 检查步骤级条件（step.condition 字段，非 ConditionStep）
                if let Some(cond) = get_step_condition(step) {
                    let pass = eval_condition(
                        &cond.field,
                        &cond.operator,
                        cond.value.as_ref(),
                        ctx,
                    );
                    if !pass {
                        // 条件不满足，跳过此步骤
                        continue;
                    }
                }

                let result = self.run_step(step, ctx).await;

                match result {
                    Ok(StepResult::Return(val)) => {
                        // builtin.return 立即终止并向上传播
                        return Ok(StepResult::Return(val));
                    }
                    Ok(StepResult::Output(val)) => {
                        last_output = val;
                    }
                    Err(e) => {
                        // 检查 ignoreError
                        if get_ignore_error(step) {
                            continue;
                        }
                        return Err(e);
                    }
                }
            }

            Ok(StepResult::Output(last_output))
        })
    }

    /// 执行单个步骤
    async fn run_step(
        &self,
        step: &WorkflowStep,
        ctx: &mut ExecutionContext,
    ) -> Result<StepResult, EngineError> {
        match step {
            WorkflowStep::Action(s) => self.run_action(s, ctx).await,
            WorkflowStep::Builtin(s) => self.run_builtin(s, ctx).await,
            WorkflowStep::Condition(s) => self.run_condition(s, ctx).await,
            WorkflowStep::Loop(s) => self.run_loop(s, ctx).await,
            WorkflowStep::Parallel(s) => self.run_parallel(s, ctx).await,
            WorkflowStep::Workflow(s) => self.run_sub_workflow(s, ctx).await,
        }
    }

    // ----------------------------------------------------------
    // Action 步骤 — 调用外部 Adapter
    // ----------------------------------------------------------

    async fn run_action(
        &self,
        step: &ActionStep,
        ctx: &mut ExecutionContext,
    ) -> Result<StepResult, EngineError> {
        let adapter = self
            .registry
            .get(&step.service)
            .ok_or_else(|| AdapterError::NotFound(step.service.clone()))?;

        // 解析输入参数中的模板表达式
        let resolved_input = if let Some(input) = &step.input {
            resolve_value(input, ctx)
        } else {
            Value::Object(Default::default())
        };

        let raw_output = adapter
            .execute(&step.action, resolved_input, ctx)
            .await
            .map_err(|e| EngineError::StepFailed {
                step_id: step.base.id.clone(),
                message: e.to_string(),
            })?;

        // 将输出映射到 step_outputs
        // output 字段格式: { 本地key: "adapter_output.path" }
        let mut step_out = raw_output.clone();
        if let Some(output_map) = &step.output {
            let mut mapped = serde_json::Map::new();
            for (local_key, path) in output_map {
                let val = crate::expression::get_path(&raw_output, path)
                    .unwrap_or(Value::Null);
                mapped.insert(local_key.clone(), val);
            }
            step_out = Value::Object(mapped);
        }

        ctx.set_step_output(&step.base.id, step_out);

        Ok(StepResult::Output(raw_output))
    }

    // ----------------------------------------------------------
    // Builtin 步骤 — 内置操作
    // ----------------------------------------------------------

    async fn run_builtin(
        &self,
        step: &BuiltinStep,
        ctx: &mut ExecutionContext,
    ) -> Result<StepResult, EngineError> {
        let input = step
            .input
            .as_ref()
            .map(|v| resolve_value(v, ctx))
            .unwrap_or(Value::Null);

        match step.action.as_str() {
            "return" => {
                // 立即终止工作流，返回 input 作为最终输出
                ctx.set_step_output(&step.base.id, input.clone());
                Ok(StepResult::Return(input))
            }

            "log" => {
                let msg = input
                    .get("message")
                    .and_then(|v| v.as_str())
                    .unwrap_or("(no message)");
                let level = input
                    .get("level")
                    .and_then(|v| v.as_str())
                    .unwrap_or("info");
                match level {
                    "warn" => eprintln!("[WARN] {msg}"),
                    "error" => eprintln!("[ERROR] {msg}"),
                    _ => println!("[INFO] {msg}"),
                }
                ctx.set_step_output(&step.base.id, Value::Null);
                Ok(StepResult::Output(Value::Null))
            }

            "delay" => {
                let ms = input.get("ms").and_then(|v| v.as_u64()).unwrap_or(0);
                if ms > 0 {
                    tokio::time::sleep(std::time::Duration::from_millis(ms)).await;
                }
                ctx.set_step_output(&step.base.id, Value::Null);
                Ok(StepResult::Output(Value::Null))
            }

            "setVariable" => {
                let var_name = input
                    .get("variable")
                    .and_then(|v| v.as_str())
                    .ok_or_else(|| {
                        EngineError::Internal("setVariable: missing 'variable' field".to_string())
                    })?
                    .to_string();

                let value = if let Some(v) = input.get("value") {
                    v.clone()
                } else if let Some(source) = input.get("source").and_then(|v| v.as_str()) {
                    let source_val =
                        resolve_value(&Value::String(format!("{{{{{source}}}}}")), ctx);
                    if let Some(path) = input.get("path").and_then(|v| v.as_str()) {
                        let resolved_path =
                            resolve_value(&Value::String(path.to_string()), ctx);
                        let path_str = resolved_path.as_str().unwrap_or(path);
                        crate::expression::get_path(&source_val, path_str)
                            .unwrap_or(Value::Null)
                    } else {
                        source_val
                    }
                } else {
                    Value::Null
                };

                ctx.set_variable(&var_name, value.clone());
                ctx.set_step_output(&step.base.id, value.clone());
                Ok(StepResult::Output(value))
            }

            "transform" | "compile" | "calculate" => {
                // 透传 input 作为输出（高级变换由外部适配器实现）
                ctx.set_step_output(&step.base.id, input.clone());
                Ok(StepResult::Output(input))
            }

            "arrayCount" => {
                let count = input
                    .get("array")
                    .and_then(|v| v.as_array())
                    .map(|items| items.len())
                    .unwrap_or(0);
                let output = serde_json::json!(count);
                ctx.set_step_output(&step.base.id, output.clone());
                Ok(StepResult::Output(output))
            }

            "error" => {
                let msg = input
                    .get("message")
                    .and_then(|v| v.as_str())
                    .unwrap_or("workflow error");
                Err(EngineError::StepFailed {
                    step_id: step.base.id.clone(),
                    message: msg.to_string(),
                })
            }

            other => {
                if let Some(output) = crate::builtin_ops::run_builtin_action(other, &input, ctx) {
                    ctx.set_step_output(&step.base.id, output.clone());
                    Ok(StepResult::Output(output))
                } else {
                    eprintln!("[WARN] builtin action '{other}' not implemented, skipping");
                    ctx.set_step_output(&step.base.id, Value::Null);
                    Ok(StepResult::Output(Value::Null))
                }
            }
        }
    }

    // ----------------------------------------------------------
    // Condition 步骤 — 条件分支
    // ----------------------------------------------------------

    async fn run_condition(
        &self,
        step: &ConditionStep,
        ctx: &mut ExecutionContext,
    ) -> Result<StepResult, EngineError> {
        let pass = eval_condition(
            &step.condition.field,
            &step.condition.operator,
            step.condition.value.as_ref(),
            ctx,
        );

        let branch = if pass {
            step.on_true.as_deref()
        } else {
            step.on_false.as_deref()
        };

        if let Some(steps) = branch {
            if steps.is_empty() {
                ctx.set_step_output(&step.base.id, json!({ "branch": pass }));
                return Ok(StepResult::Output(Value::Null));
            }
            match self.run_steps(steps, ctx).await? {
                StepResult::Return(val) => Ok(StepResult::Return(val)),
                StepResult::Output(val) => {
                    ctx.set_step_output(&step.base.id, json!({ "branch": pass, "result": val }));
                    Ok(StepResult::Output(Value::Null))
                }
            }
        } else {
            ctx.set_step_output(&step.base.id, json!({ "branch": pass }));
            Ok(StepResult::Output(Value::Null))
        }
    }

    // ----------------------------------------------------------
    // Loop 步骤 — 迭代
    // ----------------------------------------------------------

    async fn run_loop(
        &self,
        step: &LoopStep,
        ctx: &mut ExecutionContext,
    ) -> Result<StepResult, EngineError> {
        let items = if let Some(iter) = &step.iterator {
            let source_val = resolve_value(&Value::String(iter.source.clone()), ctx);
            match source_val {
                Value::Array(arr) => arr,
                _ => vec![],
            }
        } else {
            vec![]
        };

        let limit = step
            .iterator
            .as_ref()
            .and_then(|i| i.limit)
            .unwrap_or(usize::MAX);

        let mut results = Vec::new();

        for (idx, item) in items.iter().take(limit).enumerate() {
            ctx.loop_context = Some(LoopContext {
                item: item.clone(),
                index: idx,
            });

            // 检查 breakCondition
            if let Some(bc) = &step.break_condition {
                if eval_condition(&bc.field, &bc.operator, bc.value.as_ref(), ctx) {
                    break;
                }
            }

            // Loop 内的 Return 视为该次迭代的输出，继续下一次迭代
            let iter_val = match self.run_steps(&step.steps, ctx).await? {
                StepResult::Return(val) | StepResult::Output(val) => val,
            };
            results.push(iter_val);
        }

        ctx.loop_context = None;
        let out = Value::Array(results);
        ctx.set_step_output(&step.base.id, out.clone());
        Ok(StepResult::Output(out))
    }

    // ----------------------------------------------------------
    // Parallel 步骤 — 并行执行（当前简化为顺序执行）
    // ----------------------------------------------------------

    async fn run_parallel(
        &self,
        step: &ParallelStep,
        ctx: &mut ExecutionContext,
    ) -> Result<StepResult, EngineError> {
        // 简化实现：顺序执行各分支
        // 真正的并行需要 Arc<Mutex<ExecutionContext>> 或分离上下文
        let mut branch_outputs = serde_json::Map::new();

        if let Some(branches) = &step.branches {
            for branch in branches {
                match self.run_steps(&branch.steps, ctx).await? {
                    StepResult::Return(val) => {
                        return Ok(StepResult::Return(val));
                    }
                    StepResult::Output(val) => {
                        branch_outputs.insert(branch.name.clone(), val);
                    }
                }
            }
        }

        let out = Value::Object(branch_outputs);
        ctx.set_step_output(&step.base.id, out.clone());
        Ok(StepResult::Output(out))
    }

    // ----------------------------------------------------------
    // Workflow 步骤 — 调用子工作流
    // ----------------------------------------------------------

    async fn run_sub_workflow(
        &self,
        step: &WorkflowCallStep,
        ctx: &mut ExecutionContext,
    ) -> Result<StepResult, EngineError> {
        let resolver = self.resolver.as_ref().ok_or_else(|| {
            EngineError::Internal("no workflow resolver registered".to_string())
        })?;

        let sub_workflow = resolver
            .resolve(&step.workflow_id)
            .await
            .ok_or_else(|| EngineError::WorkflowNotFound(step.workflow_id.clone()))?;

        let sub_inputs = if let Some(input) = &step.input {
            resolve_value(input, ctx)
        } else {
            Value::Object(Default::default())
        };

        let result = self.execute(&sub_workflow, sub_inputs).await?;
        ctx.set_step_output(&step.base.id, result.output.clone());
        Ok(StepResult::Output(result.output))
    }
}

// ============================================================
// StepResult — 步骤执行结果的内部表示
// ============================================================

enum StepResult {
    /// 普通输出，继续执行后续步骤
    Output(Value),
    /// builtin.return 触发，立即终止当前步骤列表
    Return(Value),
}

// ============================================================
// 辅助函数
// ============================================================

fn get_step_condition(step: &WorkflowStep) -> Option<&crate::types::Condition> {
    match step {
        WorkflowStep::Action(s) => s.base.condition.as_ref(),
        WorkflowStep::Builtin(s) => s.base.condition.as_ref(),
        WorkflowStep::Condition(_) => None, // ConditionStep 自身的 condition 由 run_condition 处理
        WorkflowStep::Loop(s) => s.base.condition.as_ref(),
        WorkflowStep::Parallel(s) => s.base.condition.as_ref(),
        WorkflowStep::Workflow(s) => s.base.condition.as_ref(),
    }
}

fn get_ignore_error(step: &WorkflowStep) -> bool {
    match step {
        WorkflowStep::Action(s) => s.base.ignore_error.unwrap_or(false),
        WorkflowStep::Builtin(s) => s.base.ignore_error.unwrap_or(false),
        WorkflowStep::Condition(s) => s.base.ignore_error.unwrap_or(false),
        WorkflowStep::Loop(s) => s.base.ignore_error.unwrap_or(false),
        WorkflowStep::Parallel(s) => s.base.ignore_error.unwrap_or(false),
        WorkflowStep::Workflow(s) => s.base.ignore_error.unwrap_or(false),
    }
}

// ============================================================
// 单元测试（从 TS 测试移植）
// ============================================================

#[cfg(test)]
mod tests {
    use super::*;
    use crate::adapter::{Adapter, AdapterError, AdapterRegistry};
    use crate::parser::parse_workflow;
    use async_trait::async_trait;

    // Mock Adapter：记录调用并返回预设值
    struct MockAdapter {
        name: String,
        return_value: Value,
    }

    #[async_trait]
    impl Adapter for MockAdapter {
        fn name(&self) -> &str {
            &self.name
        }

        async fn execute(
            &self,
            _action: &str,
            _input: Value,
            _ctx: &ExecutionContext,
        ) -> Result<Value, AdapterError> {
            Ok(self.return_value.clone())
        }
    }

    fn make_engine_with_mock(service: &str, return_val: Value) -> ZouwuEngine {
        let mut registry = AdapterRegistry::new();
        registry.register(Arc::new(MockAdapter {
            name: service.to_string(),
            return_value: return_val,
        }));
        ZouwuEngine::new(registry)
    }

    // ----------------------------------------------------------
    // builtin.return 测试（移植自 TS evaluator.test.ts）
    // ----------------------------------------------------------

    #[tokio::test]
    async fn test_builtin_return_simple() {
        let yaml = r#"
id: "test"
name: "test"
version: "1.0.0"
steps:
  - id: "r"
    type: "builtin"
    action: "return"
    input:
      success: true
      message: "Hello World"
"#;
        let wf = parse_workflow(yaml).unwrap();
        let engine = ZouwuEngine::new(AdapterRegistry::new());
        let result = engine.execute(&wf, json!({})).await.unwrap();
        assert_eq!(result.output["success"], json!(true));
        assert_eq!(result.output["message"], json!("Hello World"));
    }

    // ----------------------------------------------------------
    // 表达式解析测试（移植自 TS parser.test.ts）
    // ----------------------------------------------------------

    #[tokio::test]
    async fn test_inputs_expression() {
        let yaml = r#"
id: "test"
name: "test"
version: "1.0.0"
steps:
  - id: "r"
    type: "builtin"
    action: "return"
    input:
      name: "{{ inputs.userName }}"
      paths: "{{inputs.files}}"
"#;
        let wf = parse_workflow(yaml).unwrap();
        let engine = ZouwuEngine::new(AdapterRegistry::new());
        let result = engine
            .execute(&wf, json!({ "userName": "Alice", "files": ["/a", "/b"] }))
            .await
            .unwrap();
        assert_eq!(result.output["name"], json!("Alice"));
        assert_eq!(result.output["paths"], json!(["/a", "/b"]));
    }

    // ----------------------------------------------------------
    // 步骤输出引用测试（移植自 TS steps.output 测试）
    // ----------------------------------------------------------

    #[tokio::test]
    async fn test_step_output_reference() {
        let yaml = r#"
id: "test"
name: "test"
version: "1.0.0"
steps:
  - id: "step1"
    type: "action"
    service: "mock"
    action: "doSomething"
    input: {}
  - id: "step2"
    type: "builtin"
    action: "return"
    input:
      fromStep1: "{{steps.step1.result}}"
"#;
        let wf = parse_workflow(yaml).unwrap();
        let engine = make_engine_with_mock("mock", json!({ "result": "step1_output" }));
        let result = engine.execute(&wf, json!({})).await.unwrap();
        assert_eq!(result.output["fromStep1"], json!("step1_output"));
    }

    // ----------------------------------------------------------
    // condition 步骤测试
    // ----------------------------------------------------------

    #[tokio::test]
    async fn test_condition_on_true_branch() {
        let yaml = r#"
id: "test"
name: "test"
version: "1.0.0"
steps:
  - id: "check"
    type: "condition"
    condition:
      field: "inputs.value"
      operator: "gt"
      value: 5
    onTrue:
      - id: "true_result"
        type: "builtin"
        action: "return"
        input:
          branch: "true"
    onFalse:
      - id: "false_result"
        type: "builtin"
        action: "return"
        input:
          branch: "false"
"#;
        let wf = parse_workflow(yaml).unwrap();
        let engine = ZouwuEngine::new(AdapterRegistry::new());

        let r = engine.execute(&wf, json!({ "value": 10 })).await.unwrap();
        assert_eq!(r.output["branch"], json!("true"));

        let r = engine.execute(&wf, json!({ "value": 3 })).await.unwrap();
        assert_eq!(r.output["branch"], json!("false"));
    }

    // ----------------------------------------------------------
    // setVariable 测试
    // ----------------------------------------------------------

    #[tokio::test]
    async fn test_set_variable() {
        let yaml = r#"
id: "test"
name: "test"
version: "1.0.0"
steps:
  - id: "set"
    type: "builtin"
    action: "setVariable"
    input:
      variable: "myVar"
      value: "hello"
  - id: "r"
    type: "builtin"
    action: "return"
    input:
      result: "{{variables.myVar}}"
"#;
        let wf = parse_workflow(yaml).unwrap();
        let engine = ZouwuEngine::new(AdapterRegistry::new());
        let result = engine.execute(&wf, json!({})).await.unwrap();
        assert_eq!(result.output["result"], json!("hello"));
    }

    // ----------------------------------------------------------
    // loop 步骤测试
    // ----------------------------------------------------------

    #[tokio::test]
    async fn test_loop_over_array() {
        let yaml = r#"
id: "test"
name: "test"
version: "1.0.0"
steps:
  - id: "loop1"
    type: "loop"
    iterator:
      source: "{{inputs.items}}"
      variable: "item"
    steps:
      - id: "inner"
        type: "builtin"
        action: "return"
        input:
          item: "{{loop.item}}"
          index: "{{loop.index}}"
  - id: "r"
    type: "builtin"
    action: "return"
    input:
      loopDone: true
"#;
        let wf = parse_workflow(yaml).unwrap();
        let engine = ZouwuEngine::new(AdapterRegistry::new());
        let result = engine
            .execute(&wf, json!({ "items": ["a", "b", "c"] }))
            .await
            .unwrap();
        // loop 完成后执行最后的 return
        assert_eq!(result.output["loopDone"], json!(true));
    }

    // ----------------------------------------------------------
    // ignoreError 测试（移植自 TS ignoreError 场景）
    // ----------------------------------------------------------

    #[tokio::test]
    async fn test_ignore_error_continues() {
        let yaml = r#"
id: "test"
name: "test"
version: "1.0.0"
steps:
  - id: "fail_step"
    type: "builtin"
    action: "error"
    ignoreError: true
    input:
      message: "expected failure"
  - id: "r"
    type: "builtin"
    action: "return"
    input:
      recovered: true
"#;
        let wf = parse_workflow(yaml).unwrap();
        let engine = ZouwuEngine::new(AdapterRegistry::new());
        let result = engine.execute(&wf, json!({})).await.unwrap();
        assert_eq!(result.output["recovered"], json!(true));
    }

    // ----------------------------------------------------------
    // 混合字符串模板测试（移植自 TS 混合模板测试）
    // ----------------------------------------------------------

    #[tokio::test]
    async fn test_mixed_string_template() {
        let yaml = r#"
id: "test"
name: "test"
version: "1.0.0"
steps:
  - id: "r"
    type: "builtin"
    action: "return"
    input:
      greeting: "Hello {{inputs.name}}, you are {{inputs.age}} years old"
"#;
        let wf = parse_workflow(yaml).unwrap();
        let engine = ZouwuEngine::new(AdapterRegistry::new());
        let result = engine
            .execute(&wf, json!({ "name": "Alice", "age": 30 }))
            .await
            .unwrap();
        assert_eq!(
            result.output["greeting"],
            json!("Hello Alice, you are 30 years old")
        );
    }

    // ----------------------------------------------------------
    // 默认值测试（移植自 TS parser.test.ts 带默认值测试）
    // ----------------------------------------------------------

    #[tokio::test]
    async fn test_optional_string_maxlen_null_passes() {
        // inputs.key 不存在时，optional_string_maxlen 应该通过
        let yaml = r#"
id: "test"
name: "test"
version: "1.0.0"
steps:
  - id: "check"
    type: "condition"
    condition:
      field: "inputs.key"
      operator: "optional_string_maxlen"
      value: 100
    onTrue:
      - id: "pass"
        type: "builtin"
        action: "return"
        input:
          result: "passed"
    onFalse:
      - id: "fail"
        type: "builtin"
        action: "return"
        input:
          result: "failed"
"#;
        let wf = parse_workflow(yaml).unwrap();
        let engine = ZouwuEngine::new(AdapterRegistry::new());
        // 不传 key，应该通过（null 视为有效）
        let result = engine.execute(&wf, json!({})).await.unwrap();
        assert_eq!(result.output["result"], json!("passed"));
        // 传超长 key，应该失败
        let long_key = "a".repeat(101);
        let result = engine
            .execute(&wf, json!({ "key": long_key }))
            .await
            .unwrap();
        assert_eq!(result.output["result"], json!("failed"));
    }
}

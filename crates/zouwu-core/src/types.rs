use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;

// ============================================================
// 工作流定义
// ============================================================

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct WorkflowDefinition {
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub description: Option<String>,
    pub version: String,
    pub steps: Vec<WorkflowStep>,
    #[serde(default)]
    pub inputs: Option<HashMap<String, InputDefinition>>,
    #[serde(rename = "inputSchema", default)]
    pub input_schema: Option<Value>,
    #[serde(default)]
    pub outputs: Option<HashMap<String, OutputDefinition>>,
    #[serde(rename = "outputSchema", default)]
    pub output_schema: Option<Value>,
    #[serde(default)]
    pub variables: Option<HashMap<String, Value>>,
    #[serde(default)]
    pub triggers: Option<Vec<TriggerDefinition>>,
    #[serde(default)]
    pub timeout: Option<u64>,
    #[serde(default)]
    pub enabled: Option<bool>,
    #[serde(default)]
    pub tags: Option<Vec<String>>,
    #[serde(rename = "error_handling", default)]
    pub error_handling: Option<Value>,
    #[serde(rename = "onError", default)]
    pub on_error: Option<Vec<WorkflowStep>>,
    #[serde(default)]
    pub priority: Option<String>,
    #[serde(rename = "retryOnError", default)]
    pub retry_on_error: Option<bool>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct InputDefinition {
    #[serde(rename = "type")]
    pub type_name: String,
    #[serde(default)]
    pub required: Option<bool>,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub default: Option<Value>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct OutputDefinition {
    #[serde(rename = "type")]
    pub type_name: String,
    #[serde(default)]
    pub description: Option<String>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct TriggerDefinition {
    #[serde(default)]
    pub intent: Option<String>,
    #[serde(default)]
    pub event: Option<String>,
}

// ============================================================
// 步骤类型 — 统一用 serde tag 区分
// ============================================================

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(tag = "type", rename_all = "lowercase")]
pub enum WorkflowStep {
    Action(ActionStep),
    Builtin(BuiltinStep),
    Condition(ConditionStep),
    Loop(LoopStep),
    Parallel(ParallelStep),
    Workflow(WorkflowCallStep),
}

impl WorkflowStep {
    pub fn id(&self) -> &str {
        match self {
            WorkflowStep::Action(s) => &s.base.id,
            WorkflowStep::Builtin(s) => &s.base.id,
            WorkflowStep::Condition(s) => &s.base.id,
            WorkflowStep::Loop(s) => &s.base.id,
            WorkflowStep::Parallel(s) => &s.base.id,
            WorkflowStep::Workflow(s) => &s.base.id,
        }
    }
}

// ============================================================
// 步骤基础字段（所有步骤共享）
// ============================================================

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct StepBase {
    pub id: String,
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(rename = "dependsOn", default)]
    pub depends_on: Option<Vec<String>>,
    #[serde(rename = "ignoreError", default)]
    pub ignore_error: Option<bool>,
    #[serde(rename = "onError", default)]
    pub on_error: Option<Value>,
    /// 步骤级条件：仅当条件满足时执行此步骤
    #[serde(default)]
    pub condition: Option<Condition>,
}

// ============================================================
// Action 步骤 — 调用外部 Adapter
// ============================================================

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct ActionStep {
    #[serde(flatten)]
    pub base: StepBase,
    pub service: String,
    pub action: String,
    /// 输入参数，值可能是模板字符串或字面量
    #[serde(default)]
    pub input: Option<Value>,
    /// 输出字段映射：{ 本地变量名: "step_output.path" }
    #[serde(default)]
    pub output: Option<HashMap<String, String>>,
    #[serde(rename = "output_schema", default)]
    pub output_schema: Option<Value>,
}

// ============================================================
// Builtin 步骤 — 内置操作
// ============================================================

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct BuiltinStep {
    #[serde(flatten)]
    pub base: StepBase,
    /// builtin action 名称，如 "return", "setVariable", "log", "arrayFind" 等
    /// 以字符串存储，支持扩展而无需修改类型定义
    pub action: String,
    #[serde(default)]
    pub input: Option<Value>,
}

// ============================================================
// Condition 步骤 — 条件分支
// ============================================================

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct ConditionStep {
    #[serde(flatten)]
    pub base: StepBase,
    pub condition: Condition,
    #[serde(rename = "onTrue", default)]
    pub on_true: Option<Vec<WorkflowStep>>,
    #[serde(rename = "onFalse", default)]
    pub on_false: Option<Vec<WorkflowStep>>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct Condition {
    pub field: String,
    pub operator: String,
    #[serde(default)]
    pub value: Option<Value>,
}

// ============================================================
// Loop 步骤 — 迭代
// ============================================================

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct LoopStep {
    #[serde(flatten)]
    pub base: StepBase,
    #[serde(default)]
    pub iterator: Option<LoopIterator>,
    pub steps: Vec<WorkflowStep>,
    #[serde(rename = "breakCondition", default)]
    pub break_condition: Option<Condition>,
    #[serde(default)]
    pub parallel: Option<bool>,
    #[serde(default)]
    pub concurrency: Option<usize>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct LoopIterator {
    pub source: String,
    pub variable: String,
    #[serde(default)]
    pub index: Option<String>,
    #[serde(default)]
    pub limit: Option<usize>,
}

// ============================================================
// Parallel 步骤 — 并行执行
// ============================================================

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct ParallelStep {
    #[serde(flatten)]
    pub base: StepBase,
    #[serde(default)]
    pub branches: Option<Vec<ParallelBranch>>,
    #[serde(rename = "maxConcurrency", default)]
    pub max_concurrency: Option<usize>,
    #[serde(rename = "waitFor", default)]
    pub wait_for: Option<String>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct ParallelBranch {
    pub name: String,
    pub steps: Vec<WorkflowStep>,
}

// ============================================================
// Workflow 步骤 — 调用子工作流
// ============================================================

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct WorkflowCallStep {
    #[serde(flatten)]
    pub base: StepBase,
    #[serde(rename = "workflowId")]
    pub workflow_id: String,
    #[serde(default)]
    pub input: Option<Value>,
}

// ============================================================
// ExecutionContext — 引擎执行时的运行时状态
// ============================================================

#[derive(Debug, Clone)]
pub struct ExecutionContext {
    /// 工作流输入参数（对应 {{inputs.xxx}} 或 {{input.xxx}}）
    pub inputs: Value,
    /// 工作流级变量（对应 {{variables.xxx}}）
    pub variables: HashMap<String, Value>,
    /// 已完成步骤的输出（对应 {{steps.id.xxx}}）
    pub step_outputs: HashMap<String, Value>,
    /// 当前 loop 上下文（对应 {{loop.item}}、{{loop.index}}）
    pub loop_context: Option<LoopContext>,
}

impl ExecutionContext {
    pub fn new(inputs: Value) -> Self {
        Self {
            inputs,
            variables: HashMap::new(),
            step_outputs: HashMap::new(),
            loop_context: None,
        }
    }

    pub fn set_step_output(&mut self, step_id: &str, output: Value) {
        self.step_outputs.insert(step_id.to_string(), output);
    }

    pub fn set_variable(&mut self, name: &str, value: Value) {
        self.variables.insert(name.to_string(), value);
    }
}

#[derive(Debug, Clone)]
pub struct LoopContext {
    pub item: Value,
    pub index: usize,
}

// ============================================================
// ExecutionResult — 工作流执行结果
// ============================================================

#[derive(Debug, Clone)]
pub struct ExecutionResult {
    pub success: bool,
    pub output: Value,
    pub step_outputs: HashMap<String, Value>,
}

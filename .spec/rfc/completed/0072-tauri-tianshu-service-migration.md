# RFC 0072: 天枢服务迁移到 Tauri

- **作者**: AI Assistant
- **状态**: ✅ 已完成
- **创建日期**: 2025-01-02
- **关联 RFC**: [RFC 0067: 创建 Tauri 应用 Photasa](../0067-tauri-app-photasa.md)

## Implementation principle (Photasa / Tauri)

> **Rust rewrite, not TypeScript copy.** Policy: [ROADMAP.md](../../../ROADMAP.md).

- Electron/Node code is a **behavioral specification** only—not a library for Photasa.
- Implement in `apps/photasa/src-tauri` and `crates/`; **do not** import `@photasa/scan`, `@photasa/import`, or other Node packages from Tauri.
- **1:1 parity** = same IPC/events/on-disk formats; **not** porting TypeScript source.

## 摘要

本文档详细说明如何将 Electron 的天枢服务迁移到 Tauri Rust 实现。天枢服务是工作流编排引擎，负责处理用户意图、协调各引擎、执行工作流。这是最复杂的服务迁移。

## 当前架构分析

### Electron 实现结构

```
apps/desktop/src/main/deity/
├── tianshu-service.ts      # 主服务（IPC 处理、引擎管理）
└── taiyi-service.ts        # 太乙服务（引擎协调）

packages/@photasa/tianshu/  # 工作流引擎包
├── src/
│   ├── TianshuEngine.ts    # 工作流引擎核心
│   ├── WorkflowParser.ts   # 工作流解析器
│   ├── WorkflowExecutor.ts # 工作流执行器
│   └── ...
└── workflows/              # 工作流定义文件（.zouwu YAML）
```

### 核心功能

1. **IPC 通信**
    - `tianshu.command` - 处理工作流命令
    - `tianshu.status` - 查询系统状态

2. **工作流引擎**
    - 解析 YAML 工作流定义（.zouwu 文件）
    - 执行工作流步骤
    - 管理工作流状态
    - 事件系统

3. **引擎协调**
    - 通过太乙服务调用各引擎
    - 管理引擎依赖关系
    - 处理引擎调用结果

4. **工作流特性**
    - 步骤依赖管理
    - 条件执行
    - 错误处理
    - 内置操作（arrayConcat, return 等）

## Tauri Rust 迁移计划

### 阶段 1: 基础架构

#### 1.1 创建 Rust 模块结构

```
apps/photasa/src-tauri/src/
├── services/
│   └── tianshu/
│       ├── mod.rs                    # 模块导出
│       ├── tianshu_service.rs       # 主服务
│       ├── engine.rs                 # 工作流引擎
│       ├── parser.rs                 # 工作流解析器
│       ├── executor.rs               # 工作流执行器
│       ├── builtin/                  # 内置操作
│       │   ├── mod.rs
│       │   ├── array_ops.rs         # 数组操作
│       │   ├── object_ops.rs         # 对象操作
│       │   └── control_flow.rs      # 控制流
│       └── types.rs                  # 类型定义
```

#### 1.2 依赖添加

```toml
[dependencies]
# YAML 解析
serde = { version = "1.0", features = ["derive"] }
serde_yaml = "0.9"

# 异步处理
tokio = { version = "1.0", features = ["full"] }
futures = "0.3"

# 表达式求值（用于工作流中的 {{}} 语法）
rhai = "1.19"              # 脚本引擎，用于表达式求值

# 文件系统
walkdir = "2.0"
glob = "0.3"

# 错误处理
anyhow = "1.0"
thiserror = "1.0"
```

### 阶段 2: 类型定义

```rust
// src-tauri/src/services/tianshu/types.rs

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TianshuCommand {
    pub id: String,
    pub intent: String,
    pub inputs: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TianshuResponse {
    pub success: bool,
    pub result: Option<serde_json::Value>,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkflowDefinition {
    pub id: String,
    pub name: String,
    pub version: String,
    pub triggers: Vec<WorkflowTrigger>,
    pub inputs: serde_json::Value,
    pub steps: Vec<WorkflowStep>,
    pub outputs: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkflowTrigger {
    pub intent: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkflowStep {
    pub id: String,
    pub name: String,
    pub r#type: StepType,
    pub service: Option<String>,
    pub action: String,
    pub input: serde_json::Value,
    pub depends_on: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum StepType {
    Action,
    Builtin,
}
```

### 阶段 3: 核心功能实现

#### 3.1 工作流解析器

```rust
// src-tauri/src/services/tianshu/parser.rs

use serde_yaml;
use std::path::Path;
use anyhow::Result;

pub struct WorkflowParser;

impl WorkflowParser {
    /// 解析工作流文件
    pub fn parse_workflow(&self, path: &Path) -> Result<WorkflowDefinition> {
        let content = std::fs::read_to_string(path)?;
        let workflow: WorkflowDefinition = serde_yaml::from_str(&content)?;
        Ok(workflow)
    }

    /// 加载所有工作流
    pub fn load_workflows(&self, workflow_dir: &str) -> Result<Vec<WorkflowDefinition>> {
        let mut workflows = Vec::new();

        for entry in glob::glob(&format!("{}/**/*.zouwu", workflow_dir))? {
            let path = entry?;
            let workflow = self.parse_workflow(&path)?;
            workflows.push(workflow);
        }

        Ok(workflows)
    }
}
```

#### 3.2 工作流执行器

```rust
// src-tauri/src/services/tianshu/executor.rs

use crate::services::tianshu::types::*;
use crate::services::tianshu::builtin;
use anyhow::Result;
use std::collections::HashMap;

pub struct WorkflowExecutor {
    builtin_ops: builtin::BuiltinOperations,
    step_results: HashMap<String, serde_json::Value>,
}

impl WorkflowExecutor {
    pub fn new() -> Self {
        Self {
            builtin_ops: builtin::BuiltinOperations::new(),
            step_results: HashMap::new(),
        }
    }

    /// 执行工作流
    pub async fn execute_workflow(
        &mut self,
        workflow: &WorkflowDefinition,
        inputs: serde_json::Value,
    ) -> Result<serde_json::Value> {
        // 1. 解析步骤依赖关系
        let execution_order = self.resolve_dependencies(&workflow.steps)?;

        // 2. 按顺序执行步骤
        for step_id in execution_order {
            let step = workflow.steps.iter()
                .find(|s| s.id == step_id)
                .ok_or_else(|| anyhow::anyhow!("Step not found: {}", step_id))?;

            let result = self.execute_step(step, &inputs).await?;
            self.step_results.insert(step_id, result);
        }

        // 3. 构建输出
        self.build_outputs(&workflow.outputs)
    }

    async fn execute_step(
        &self,
        step: &WorkflowStep,
        inputs: &serde_json::Value,
    ) -> Result<serde_json::Value> {
        match step.r#type {
            StepType::Builtin => {
                // 执行内置操作
                self.builtin_ops.execute(&step.action, &step.input, inputs, &self.step_results).await
            }
            StepType::Action => {
                // 调用服务操作
                // TODO: 通过太乙服务调用引擎
                todo!("Implement service action execution")
            }
        }
    }

    fn resolve_dependencies(&self, steps: &[WorkflowStep]) -> Result<Vec<String>> {
        // 实现拓扑排序，解析步骤依赖关系
        // 返回执行顺序
        todo!("Implement dependency resolution")
    }
}
```

#### 3.3 内置操作

```rust
// src-tauri/src/services/tianshu/builtin/mod.rs

pub mod array_ops;
pub mod object_ops;
pub mod control_flow;

use serde_json::Value;
use std::collections::HashMap;

pub struct BuiltinOperations;

impl BuiltinOperations {
    pub fn new() -> Self {
        Self
    }

    pub async fn execute(
        &self,
        action: &str,
        input: &Value,
        workflow_inputs: &Value,
        step_results: &HashMap<String, Value>,
    ) -> Result<Value, anyhow::Error> {
        match action {
            "arrayConcat" => array_ops::array_concat(input, step_results),
            "arrayCount" => array_ops::array_count(input, step_results),
            "arrayFilter" => array_ops::array_filter(input, step_results),
            "return" => control_flow::return_value(input, step_results),
            "setVariable" => control_flow::set_variable(input, step_results),
            _ => Err(anyhow::anyhow!("Unknown builtin action: {}", action)),
        }
    }
}
```

#### 3.4 主服务实现

```rust
// src-tauri/src/services/tianshu/tianshu_service.rs

use crate::services::tianshu::parser::WorkflowParser;
use crate::services::tianshu::executor::WorkflowExecutor;
use crate::services::tianshu::types::*;
use std::collections::HashMap;
use anyhow::Result;

pub struct TianshuService {
    parser: WorkflowParser,
    executor: WorkflowExecutor,
    workflows: HashMap<String, WorkflowDefinition>,
}

impl TianshuService {
    pub fn new(workflow_dir: &str) -> Result<Self> {
        let parser = WorkflowParser;
        let workflows = parser.load_workflows(workflow_dir)?;

        let mut workflow_map = HashMap::new();
        for workflow in workflows {
            workflow_map.insert(workflow.id.clone(), workflow);
        }

        Ok(Self {
            parser,
            executor: WorkflowExecutor::new(),
            workflows: workflow_map,
        })
    }

    /// 处理命令
    pub async fn process_command(&mut self, command: TianshuCommand) -> Result<TianshuResponse> {
        // 1. 根据 intent 查找工作流
        let workflow = self.find_workflow_by_intent(&command.intent)?;

        // 2. 执行工作流
        match self.executor.execute_workflow(workflow, command.inputs).await {
            Ok(result) => Ok(TianshuResponse {
                success: true,
                result: Some(result),
                error: None,
            }),
            Err(e) => Ok(TianshuResponse {
                success: false,
                result: None,
                error: Some(e.to_string()),
            }),
        }
    }

    fn find_workflow_by_intent(&self, intent: &str) -> Result<&WorkflowDefinition> {
        self.workflows
            .values()
            .find(|w| w.triggers.iter().any(|t| t.intent == intent))
            .ok_or_else(|| anyhow::anyhow!("Workflow not found for intent: {}", intent))
    }
}
```

### 阶段 4: Tauri 命令

```rust
// src-tauri/src/commands/tianshu.rs

use crate::services::tianshu::tianshu_service::TianshuService;
use crate::services::tianshu::types::*;
use tauri::{Window, State};
use std::sync::Arc;
use tokio::sync::Mutex;

type TianshuServiceState = State<'_, Arc<Mutex<TianshuService>>>;

#[tauri::command]
pub async fn tianshu_command(
    service: TianshuServiceState,
    command: TianshuCommand,
) -> Result<TianshuResponse, String> {
    let mut service = service.lock().await;
    service
        .process_command(command)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn tianshu_status(
    service: TianshuServiceState,
) -> Result<serde_json::Value, String> {
    let service = service.lock().await;
    Ok(serde_json::json!({
        "workflows": service.workflows.len(),
        "status": "ready"
    }))
}
```

## 技术挑战和解决方案

### 1. 工作流引擎复杂度

**问题**：工作流引擎是 TypeScript 实现，包含复杂的表达式求值和步骤编排

**解决方案**：

- **第一步（过渡）**：使用 WASM 运行现有工作流引擎
- **第二步（最终）**：完全重写为 Rust
- **表达式求值**：使用 `rhai` 脚本引擎处理 `{{}}` 表达式

### 2. 引擎协调

**问题**：需要通过太乙服务调用其他引擎

**解决方案**：

- 在 Rust 中实现引擎调用接口
- 通过 Tauri 命令调用其他服务
- 或通过 WASM 过渡方案

### 3. 工作流文件格式

**问题**：工作流使用自定义 YAML 格式（.zouwu）

**解决方案**：

- 使用 `serde_yaml` 解析 YAML
- 保持格式兼容性
- 支持热重载（开发环境）

## 迁移策略

### 方案 A：完全重写（推荐，长期）

完全用 Rust 重写工作流引擎

- **优点**：性能最优，类型安全
- **缺点**：工作量大，需要重写所有内置操作
- **时间**：3-4 周

### 方案 B：WASM 过渡（第一步）

将 TypeScript 工作流引擎编译为 WASM

- **优点**：快速迁移，保持现有逻辑
- **缺点**：仍有 WASM 运行时开销
- **时间**：1-2 周（过渡）

### 方案 C：混合方案（推荐）

- **第一步**：WASM 过渡，让现有代码工作
- **第二步**：逐步将内置操作重写为 Rust
- **第三步**：完全重写引擎核心

## 迁移步骤

### 步骤 1: WASM 过渡（1-2 周）

- [ ] 将工作流引擎编译为 WASM
- [ ] 在 Rust 中加载 WASM 模块
- [ ] 实现基础命令接口
- [ ] 测试工作流执行

### 步骤 2: 内置操作迁移（1 周）

- [ ] 重写数组操作（arrayConcat, arrayCount 等）
- [ ] 重写对象操作（objectMerge 等）
- [ ] 重写控制流（return, conditional 等）

### 步骤 3: 引擎核心重写（1-2 周）

- [ ] 重写工作流解析器
- [ ] 重写工作流执行器
- [ ] 实现表达式求值
- [ ] 实现步骤依赖解析

### 步骤 4: 集成和测试（1 周）

- [ ] 集成测试
- [ ] 性能优化
- [ ] 错误处理完善

## 预计时间

**总计：3-4 周**（如果采用完全重写方案）

- WASM 过渡：1-2 周
- 内置操作迁移：1 周
- 引擎核心重写：1-2 周
- 集成测试：1 周

## 注意事项

1. **复杂度**：这是最复杂的服务，需要仔细设计
2. **兼容性**：确保工作流定义格式兼容
3. **性能**：工作流执行性能至关重要
4. **可扩展性**：需要支持未来添加新的内置操作和服务

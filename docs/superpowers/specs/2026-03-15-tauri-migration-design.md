# Tauri 迁移设计文档

**日期**: 2026-03-15
**状态**: 已审查
**策略**: B — 先构建 Rust 工作流引擎，再在其之上构建 Tauri 应用层

---

## 1. 目标

将 `apps/desktop`（Electron）完全替换为 `apps/photasa`（Tauri）。Tauri 不是过渡方案，而是最终形态。Electron 代码库在迁移完成后废弃。

---

## 2. 核心架构决策

### 2.1 全量替换，非并行运行

- Tauri 完全替换 Electron，不存在"两套并行"阶段
- `apps/desktop` 作为参考实现保留，直到 Tauri 功能完备后删除

### 2.2 完整 Rust 后端重写

- 后端逻辑用 Rust 重写，不使用 WASM bridge 跑 Node.js 代码
- 当前 `src-tauri` 里已有的 `wasmtime` 依赖是**临时脚手架**，Phase 2 完成后随 stubs 一起删除
- Rust 是 source of truth，将来可编译为 WASM 供 Node/Browser 消费

### 2.3 工作流引擎先行（策略 B）

- 先在 `crates/` 下构建 Rust 工作流引擎
- Tauri 命令层在引擎就绪后接入
- 将来可提取到独立 `zouwu-wf` repo

### 2.4 插件化 Adapter 架构（策略 C）

- 引擎定义 `Adapter` trait，对具体业务逻辑零依赖
- `BuiltinAdapter` 内置于 `zouwu-builtin` crate
- 其他 Adapter（扫描、缩略图、配置等）在 `src-tauri` 侧实现，启动时注入
- 需要推送事件的 Adapter（扫描、导入、watch）在构造时注入 `Arc<AppHandle>`

---

## 3. Monorepo 布局

```
picasa-vue/
├── apps/
│   ├── desktop/                  # Electron（保留参考，迁移完成后删除）
│   └── photasa/                  # Tauri 应用
│       ├── src/                  # Vue 3 前端
│       │   └── api/              # 适配器层（window.api 兼容 Electron preload）
│       └── src-tauri/            # Rust 命令层
│           ├── src/
│           │   ├── commands/     # Tauri 命令（tianshu、scan、thumbnail 等）
│           │   ├── adapters/     # Tauri 侧 Adapter 实现
│           │   └── services/     # TianshuService（工作流引擎封装）
│           └── Cargo.toml        # 引用 workspace crates
├── crates/                       # Rust workspace（新建）
│   ├── zouwu-core/               # 引擎核心
│   ├── zouwu-builtin/            # BuiltinAdapter
│   └── zouwu-wasm/               # 将来 WASM 导出（Phase 4）
└── Cargo.toml                    # Rust workspace 根
```

---

## 4. 分层架构

```
┌──────────────────────────────────────────────────────┐
│               Vue 3 前端 (apps/photasa/src)           │
│   组件 → window.api.* → Tauri invoke / 事件监听       │
└──────────────────────────────────────────────────────┘
                           │  invoke / emit
┌──────────────────────────────────────────────────────┐
│           Tauri 命令层 (src-tauri/commands)           │
│  tianshu_command / scan_photos / create_thumbnail ... │
└──────────────────────────────────────────────────────┘
                           │
┌──────────────────────────────────────────────────────┐
│          TianshuService (src-tauri/services)          │
│  加载工作流 YAML → 注册 Adapter → 驱动引擎执行         │
│  持有 Arc<AppHandle> 注入给需要推送事件的 Adapter      │
└──────────────────────────────────────────────────────┘
                           │
┌──────────────────────────────────────────────────────┐
│              zouwu-core (crates/zouwu-core)           │
│                                                      │
│  Parser (pest)  │  Engine (tokio)  │  AdapterRegistry │
│  两阶段解析      │  步骤调度         │  Adapter trait   │
│  Expression     │  ExecutionContext │  AdapterError    │
└──────────────────────────────────────────────────────┘
         │                                    │
┌────────────────┐               ┌────────────────────┐
│ zouwu-builtin  │               │ Tauri Adapters      │
│ BuiltinAdapter │               │ ScanAdapter         │
│ return/log/    │               │ ThumbnailAdapter    │
│ delay/setVar/  │               │ ConfigAdapter       │
│ transform/error│               │ ShellAdapter        │
└────────────────┘               └────────────────────┘
```

---

## 5. zouwu-core Crate 设计

### 5.1 核心类型

```rust
pub struct WorkflowDefinition {
    pub id: String,
    pub name: String,
    pub steps: Vec<WorkflowStep>,
    pub inputs: Option<Vec<ParameterDefinition>>,
    pub outputs: Option<Vec<ParameterDefinition>>,
    pub variables: Option<HashMap<String, Value>>,
}

pub enum WorkflowStep {
    Action(ActionStep),
    Builtin(BuiltinStep),
    Condition(ConditionStep),
    Loop(LoopStep),
    Parallel(ParallelStep),
    Workflow(WorkflowCallStep),
}
```

### 5.2 ExecutionContext

引擎在执行每个步骤时传入，携带完整运行时状态：

```rust
pub struct ExecutionContext {
    /// 工作流输入参数（对应 {{inputs.xxx}}）
    pub inputs: Value,
    /// 工作流级变量（对应 {{variables.xxx}}）
    pub variables: HashMap<String, Value>,
    /// 已完成步骤的输出（对应 {{steps.id.output.xxx}}）
    pub step_outputs: HashMap<String, Value>,
    /// 当前 loop 上下文（对应 {{loop.item}}、{{loop.index}}）
    pub loop_context: Option<LoopContext>,
}

pub struct LoopContext {
    pub item: Value,
    pub index: usize,
}
```

### 5.3 Adapter Trait 与错误类型

```rust
#[derive(Debug, thiserror::Error)]
pub enum AdapterError {
    #[error("adapter not found: {0}")]
    NotFound(String),
    #[error("invalid input: {0}")]
    InvalidInput(String),
    #[error("io error: {0}")]
    Io(#[from] std::io::Error),
    #[error("internal error: {0}")]
    Internal(String),
}

#[async_trait]
pub trait Adapter: Send + Sync {
    fn name(&self) -> &str;

    async fn execute(
        &self,
        action: &str,
        input: Value,
        ctx: &ExecutionContext,
    ) -> Result<Value, AdapterError>;

    fn supported_actions(&self) -> &[&str] { &[] }
}

pub struct AdapterRegistry {
    adapters: HashMap<String, Arc<dyn Adapter>>,
}

impl AdapterRegistry {
    pub fn register(&mut self, adapter: Arc<dyn Adapter>);
    pub fn get(&self, name: &str) -> Option<&Arc<dyn Adapter>>;
}
```

### 5.4 Engine 接口

```rust
pub struct ZouwuEngine {
    registry: Arc<AdapterRegistry>,
}

impl ZouwuEngine {
    pub fn new(registry: AdapterRegistry) -> Self;

    pub async fn execute(
        &self,
        workflow: &WorkflowDefinition,
        inputs: Value,
    ) -> Result<ExecutionResult, EngineError>;
}
```

### 5.5 两阶段 YAML 解析（关键）

`.zouwu` 文件中 `{{}}` 表达式是裸文本，不是合法 YAML：

```yaml
# 这在 YAML 中不合法，serde_yaml 直接拒绝
input:
    paths: { { inputs.paths } }
```

因此采用两阶段解析：

```
阶段 1 — 原始文本预处理
  读取 .zouwu 文件字节
  → pest 扫描所有 {{...}}，用占位字符串替换
    （例如 {{inputs.paths}} → "__EXPR_0__"）
  → 建立占位符 → 原始表达式 的映射表

阶段 2 — YAML 反序列化 + 表达式还原
  → serde_yaml 解析为中间 Value 树
  → 递归遍历 Value 树，将 "__EXPR_N__" 字符串替换回 ExprNode
  → 得到 WorkflowDefinition（steps 中含有待求值的 ExprNode）

运行时求值（执行步骤时）
  → 对 ExprNode 求值，传入 ExecutionContext
  → 得到具体 Value
```

这与 Electron 侧 Peggy 预处理逻辑一致，保持现有 `.zouwu` 文件零改动可用。

### 5.6 依赖

```toml
[dependencies]
serde = { version = "1", features = ["derive"] }
serde_json = "1"
serde_yaml = "0.9"
pest = "2"
pest_derive = "2"
async-trait = "0.1"
tokio = { version = "1", features = ["full"] }
thiserror = "1"
```

---

## 6. Tauri Adapter 设计（事件推送）

需要向前端推送增量事件的 Adapter（扫描、导入、watch）在构造时注入 `Arc<AppHandle>`：

```rust
pub struct ScanAdapter {
    app_handle: Arc<AppHandle>,
}

impl ScanAdapter {
    pub fn new(app_handle: Arc<AppHandle>) -> Self {
        Self { app_handle: Arc::new(app_handle) }
    }
}

#[async_trait]
impl Adapter for ScanAdapter {
    fn name(&self) -> &str { "qianliyan" }

    async fn execute(&self, action: &str, input: Value, _ctx: &ExecutionContext)
        -> Result<Value, AdapterError>
    {
        // 发现照片时推送事件给前端
        self.app_handle.emit("picasa:find-photo", &payload)
            .map_err(|e| AdapterError::Internal(e.to_string()))?;
        Ok(Value::Null)
    }
}
```

`TianshuService` 启动时统一注入：

```rust
pub fn build_registry(app_handle: AppHandle) -> AdapterRegistry {
    let handle = Arc::new(app_handle);
    let mut registry = AdapterRegistry::new();
    registry.register(Arc::new(BuiltinAdapter::new()));
    registry.register(Arc::new(ScanAdapter::new(Arc::clone(&handle))));
    registry.register(Arc::new(ThumbnailAdapter::new()));
    registry.register(Arc::new(ConfigAdapter::new()));
    registry.register(Arc::new(ShellAdapter::new(Arc::clone(&handle))));
    registry
}
```

### Adapter 对应表

| Adapter 名称        | 对应 RFC            | 是否需要 AppHandle | 实现位置                                      |
| ------------------- | ------------------- | ------------------ | --------------------------------------------- |
| `builtin`           | —                   | 否                 | `crates/zouwu-builtin`                        |
| `wenchang`（配置）  | RFC 0071、0077-0081 | 否                 | `src-tauri/src/adapters/config_adapter.rs`    |
| `qianliyan`（扫描） | RFC 0068、0082-0087 | **是**             | `src-tauri/src/adapters/scan_adapter.rs`      |
| `maliang`（缩略图） | RFC 0069            | 否                 | `src-tauri/src/adapters/thumbnail_adapter.rs` |
| `sibu`（导入）      | RFC 0070、0093      | **是**             | `src-tauri/src/adapters/import_adapter.rs`    |
| `shell`             | RFC 0088、0091      | **是**             | `src-tauri/src/adapters/shell_adapter.rs`     |

---

## 7. 工作流文件打包与运行时路径

`.zouwu` 工作流文件需要随应用打包，在运行时通过 Tauri 资源 API 访问：

**`tauri.conf.json` 配置：**

```json
{
    "bundle": {
        "resources": ["../../apps/desktop/src/main/engines/tianshu/workflows/**"]
    }
}
```

**运行时路径解析：**

```rust
// TianshuService 初始化时
let workflows_dir = app_handle
    .path()
    .resource_dir()
    .expect("resource dir not found")
    .join("workflows");
```

不使用硬编码路径，确保 macOS app bundle、Linux AppImage、Windows 安装包均可正确访问。

---

## 8. 前端适配器层（window.api）

`apps/photasa/src/api/` 已实现平坦 legacy API，与 Electron preload `legacy.ts` 接口兼容。
所有方法最终调用 `invoke("command_name", args)` 或监听 Tauri 事件。
前端 Vue 组件无需修改。

关键推送事件：

- `picasa:find-photo` — 扫描结果（ScanAdapter emit）
- `import:progress` — 导入进度（ImportAdapter emit）
- `picasa:watch-event` — 文件系统变更（ShellAdapter emit）

---

## 9. 迁移路线图

### Phase 1 — zouwu-core Rust 引擎

1. 创建 `Cargo.toml` workspace 根，声明 `crates/zouwu-core`、`crates/zouwu-builtin`
2. 定义核心类型：`WorkflowDefinition`、`WorkflowStep` 枚举、`ExecutionContext`、`AdapterError`
3. 实现两阶段 YAML 解析器（pest 预处理 + serde_yaml 反序列化）
4. 实现表达式求值器（pest PEG 语法，`{{}}` 模板，支持点路径访问）
5. 实现 Engine 执行循环（6 种步骤类型分发，传入 `ExecutionContext`）
6. 实现 `Adapter` trait + `AdapterRegistry`
7. 实现 `zouwu-builtin`：`BuiltinAdapter`（return/log/delay/setVariable/transform/error）
8. 集成测试：用现有 `.zouwu` 工作流文件验证引擎正确性（`cargo test`）

### Phase 2 — Tauri 命令层接入引擎

1. `src-tauri/Cargo.toml` 引用 workspace crates，删除 `wasmtime` 依赖
2. `tauri.conf.json` 声明工作流文件为 bundle resources
3. 实现 `TianshuService`：启动时扫描工作流目录、构建 `AdapterRegistry`、管理引擎实例
4. 实现各 Tauri Adapter（按上表，注入 `AppHandle`）
5. 替换 `stubs.rs` 中所有 stub 实现
6. 逐 RFC 验证命令行为

### Phase 3 — 前端集成验证

1. 验证 `window.api.*` 全部方法路由正确
2. 验证 Tauri 事件推送到前端（扫描、导入、watch）
3. 验证 Pinia store 初始化流程
4. 端到端功能测试（扫描 → 缩略图 → 展示）

### Phase 4 — 提取到 zouwu-wf（后续规划）

1. 将 `crates/zouwu-core`、`crates/zouwu-builtin` 提取到独立 repo
2. 实现 `crates/zouwu-wasm`（wasm-bindgen 导出）
3. 发布 `@zouwu-wf/workflow-wasm` npm 包，替换 TS 工作流库

---

## 10. 成功标准

- [ ] `cargo test --workspace` 全部通过，用现有 `.zouwu` 文件验证引擎
- [ ] `wasmtime` 依赖已删除，stubs.rs 已替换
- [ ] `pnpm tauri:dev` 正常启动，扫描和缩略图功能可用
- [ ] `pnpm tauri:build` 打包成功，工作流文件正确 bundle
- [ ] `apps/desktop`（Electron）可以安全删除

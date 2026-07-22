# RFC 0037: 驺吾(ZouWu)工作流DSL规范

- **开始日期**: 2025-09-29
- **更新日期**: 2025-12-24
- **RFC PR**:
- **实现议题**:
- **作者**: Claude Code
- **状态**: 活跃
- **取代**: RFC 0055 (天枢工作流总结)

本RFC定义驺吾(ZouWu)工作流DSL - 一种基于YAML的声明式领域特定语言，用于定义通用的工作流逻辑。驺吾被设计为一个两层架构：

1. **核心语法层 (Core Syntax)**: 定义工作流的结构、步骤流转、条件逻辑、并行与循环以及变量引用语法。它是平台中立且通用的。
2. **运行时扩展层 (Runtime Extensions)**: 具体的执行引擎（如天枢）通过提供特定的服务列表 (Services) 和内置动作 (Builtin Actions) 来扩展核心语法。

## 动机

Picasa应用需要一种标准化的声明式方法来定义各种操作的工作流（扫描、导入、偏好设置管理等）。工作流DSL必须：

1. **人类可读**: 易于编写和理解
2. **机器可解析**: 严格的schema验证
3. **引擎无关**: 不绑定到特定的执行引擎
4. **可扩展**: 支持自定义步骤类型和操作
5. **类型安全**: 完整的TypeScript类型定义

## 驺吾哲学

驺吾是中国神话中的神兽，以仁德和守护著称。工作流DSL体现这些原则：

- **仁德处理**: 温和、非破坏性的数据处理
- **五彩架构**: 不同颜色代表不同的步骤类型
- **守护模式**: 内置数据保护和验证机制
- **AI就绪**: 为AI生成和理解而设计

## 详细设计

### 1. 工作流文件结构

```yaml
# ===== 元数据 =====
id: "workflow_unique_identifier" # 必需: 唯一工作流ID
name: "工作流显示名称" # 必需: 人类可读名称
description: "工作流描述" # 可选: 功能说明
version: "1.0.0" # 必需: 语义化版本
author: "作者名称" # 可选: 创建者
createdAt: 1727544000000 # 可选: 创建时间戳
updatedAt: 1727544000000 # 可选: 最后更新时间戳

# ===== 触发器 =====
triggers: # 可选: 工作流触发条件
 - intent: "workflow_intent" # 意图标识符
 - event: "event_name" # 事件触发
 - schedule: "0 */6 * * *" # Cron调度

# ===== 输入输出Schema =====
inputs: # 可选: 输入参数定义
 paramName: # 参数名作为键
 type: "string|number|boolean|object|array"
 required: true
 description: "参数描述"
 default: "默认值"
 validation:
 pattern: "^[a-z]+$"
 min: 0
 max: 100

outputs: # 可选: 输出定义
 resultName:
 type: "string|number|boolean|object|array"
 description: "输出描述"

# ===== 全局变量 =====
variables: # 可选: 工作流级变量
 requestId: "{{uuid()}}"
 timestamp: "{{Date.now()}}"
 maxRetries: 3

# ===== 工作流步骤 =====
steps: # 必需: 工作流步骤
 - id: "step_unique_id" # 必需: 步骤唯一ID
 name: "步骤显示名称" # 可选: 人类可读名称
 type: "condition|action|builtin|parallel|loop"
 description: "步骤描述" # 可选

# ===== 错误处理 =====
error_handling: # 可选: 全局错误处理
 default:
 type: "gentle_recovery"
 response:
 success: false
 message: "温和地处理了错误"

# ===== 工作流配置 =====
enabled: true # 可选: 是否启用
timeout: 30000 # 可选: 超时时间（毫秒）
priority: "user" # 可选: 优先级
retryOnFailure: true # 可选: 失败时重试
maxRetries: 2 # 可选: 最大重试次数
tags: ["workflow", "scan"] # 可选: 分类标签
```

### 2. 步骤类型

#### 2.1 条件步骤 (condition)

内置条件判断：

```yaml
- id: "validate_input"
 name: "验证输入"
 type: "condition"
 description: "检查输入是否有效"
 condition:
 field: "{{inputs.action}}"
 operator: "in" # eq, ne, in, gt, lt, gte, lte, exists, matches, and, or
 value: ["get", "update", "reset"]
 onTrue:
 - # 条件为真时执行的步骤
 onFalse:
 - # 条件为假时执行的步骤
```

**支持的操作符**:

- 比较: `eq`, `ne`, `gt`, `gte`, `lt`, `lte`
- 集合: `in`, `nin`
- 存在性: `exists`, `not_exists`
- 字符串: `startsWith`, `endsWith`, `contains`, `matches`
- 逻辑: `and`, `or`
- 验证: `isEmpty`, `isNotEmpty`, `string_maxlen`, `string_minlen`

#### 2.2 动作步骤 (action)

调用外部服务或适配器：

```yaml
- id: "get_preferences"
 name: "获取用户偏好"
 type: "action"
 description: "通过文昌获取当前偏好"
 service: "wenchang" # 目标服务/适配器。注意：可用服务列表由执行引擎在运行时定义。
 action: "getCurrentSnapshot" # 要调用的方法。
 input:
 # 输入参数
 output:
 snapshot: "result.data" # 输出映射
 output_schema: # 输出验证schema
 type: "object"
 properties:
 snapshot:
 type: "object"
 dependsOn: ["validate_input"] # 依赖项
 timeout: 10000
 retryOnFailure: true
 maxRetries: 3
 ignoreError: false
```

#### 2.3 内置步骤 (builtin)

内置操作：

```yaml
- id: "return_result"
 name: "返回结果"
 type: "builtin"
 action: "return" # 内置操作类型。注意：可用动作列表由执行引擎在运行时定义。
 input:
 success: true
 data: "{{steps.get_preferences.output.snapshot}}"
 message: "操作完成"
```

**内置动作**:

- `return`: 返回工作流结果
- `setVariable`: 设置工作流变量
- `log`: 记录日志
- `delay`: 延迟执行
- `transform`: 转换数据
- `error`: 抛出错误

#### 2.4 并行步骤 (parallel)

并行执行多个分支：

```yaml
- id: "parallel_processing"
 name: "并行处理"
 type: "parallel"
 description: "并行执行验证和转换"
 branches:
 - name: "validation"
 steps:
 - # 验证步骤
 - name: "transformation"
 steps:
 - # 转换步骤
 waitFor: "all" # all, any, majority
 failOn: "any" # any, all, majority
```

#### 2.5 循环步骤 (loop)

遍历集合：

```yaml
- id: "process_files"
 name: "处理文件"
 type: "loop"
 description: "处理列表中的每个文件"
 iterator:
 source: "{{inputs.files}}" # 数据源
 variable: "currentFile" # 循环变量名
 index: "index" # 索引变量名
 steps:
 - # 为每个项目执行的步骤
 breakCondition: # 可选: 中断条件
 operator: "gte"
 value: "{{index}}"
 test: 10
```

### 3. 变量解析

驺吾支持使用`{{}}`语法的模板表达式：

**支持的引用**:

- `{{steps.stepId.output.field}}` - 引用步骤输出
- `{{inputs.field}}` - 引用工作流输入
- `{{variables.field}}` - 引用运行时变量
- `{{loopContext.item}}` - 引用循环上下文
- `{{branchContext.field}}` - 引用分支上下文

**示例**:

```yaml
steps:
 - id: "get_path"
 type: "builtin"
 action: "return"
 input:
 data: "/path/to/folder"

 - id: "scan_folder"
 type: "action"
 service: "qianliyan"
 action: "scanDirectory"
 input:
 path: "{{steps.get_path.output}}" # 解析为 "/path/to/folder"
```

### 4. 验证架构 (Validation Architecture)

驺吾工作流采用 **双阶段验证策略 (Two-Stage Validation Strategy)**，确保工作流既符合标准规范，又能适应特定的运行时上下文。

#### 4.1 阶段一：结构验证 (Structural Validation)

使用 JSON Schema 进行基础结构验证。这一阶段负责检查：

- 必需字段的完整性（如 `id`, `name`, `steps`）
- 字段类型的正确性
- 正则表达式匹配（如 ID 格式、语义版本号）
- 枚举值约束（如步骤类型、并行策略）

主要 Schema 文件：

- `workflow.schema.json` - 主工作流核心规范
- `step-types.schema.json` - 核心步骤类型定义
- `template-syntax.schema.json` - 模板表达式基础语法

#### 4.2 阶段二：深度逻辑验证 (Deep Logic Validation)

手动执行无法通过 JSON Schema 简单描述的复杂逻辑检查：

- **ID 唯一性**: 确保同一个工作流中没有重复的步骤 ID。
- **依赖完整性 (Reference Integrity)**: 检查 `dependsOn` 中引用的步骤 ID 是否真实存在。
- **循环依赖检测 (Circular Dependency)**: 构建依赖图并检测是否存在相互依赖导致的死锁。
- **变量/表达式作用域**: 验证模板变量引用的路径是否在当前上下文中有效。

#### 4.3 自定义上下文扩展 (Customized Context)

验证器支持运行时选项，以便针对不同的执行引擎进行定制：

- **支持的服务 (supportedServices)**: 定义当前引擎支持的 `action` 步骤服务列表。
- **支持的操作符 (supportedOperators)**: 扩展 `condition` 步骤可用的比较操作符。
- **扩展 Schema (extensionSchema)**: 允许引擎提供补丁 Schema，以验证自定义的步骤字段或运行时特有的元数据。

### 5. CLI工具

`@zouwu-wf/cli`包提供工具：

- **验证**: `zouwu validate <workflow.yml> --context <context.json>`
- 使用 `--context` 参数提供运行时特定的限制（如 `supportedServices`）。
- **类型生成**: `zouwu generate-types <schema.json>`
- **代码检查**: `zouwu lint <workflow.yml>`

## 实现

### 包结构

```
@zouwu-wf/workflow/
├── schemas/ # JSON Schema定义
│ ├── workflow.schema.json
│ ├── step-types.schema.json
│ └── template-syntax.schema.json
├── src/
│ ├── schemas/ # Schema加载器
│ ├── types/ # TypeScript类型定义
│ ├── validators/ # 运行时验证器
│ └── index.ts

@zouwu-wf/expression-parser/
├── src/
│ ├── parser.ts # 表达式解析器
│ ├── validator.ts # 表达式验证器
│ └── types.ts

@zouwu-wf/cli/
├── src/
│ ├── commands/
│ │ ├── validate.ts # 验证命令
│ │ ├── generate.ts # 代码生成
│ │ └── lint.ts # 代码检查命令
│ └── index.ts
```

### 与天枢的集成

天枢(Tianshu)是消费驺吾工作流的工作流执行引擎。详见RFC 0050了解天枢如何实现驺吾运行时。

## 优点

1. **声明式**: 清晰、可读的工作流定义
2. **类型安全**: 完整的TypeScript支持
3. **经过验证**: 基于schema的验证
4. **可扩展**: 易于添加新的步骤类型
5. **引擎无关**: 可被任何工作流引擎使用
6. **AI友好**: 为AI生成而设计

## 缺点

1. **学习曲线**: 需要理解DSL语法
2. **冗长性**: 对于复杂工作流，YAML可能很冗长
3. **有限表达式**: 模板表达式功能有限

## 考虑的替代方案

1. **基于JavaScript的DSL**: 更灵活但不够声明式
2. **JSON Schema**: 人类可读性较差
3. **自定义二进制格式**: 无法人工编辑

## 实施计划

### 最终架构 (Final Architecture)

确立清晰的职责分离：`@zouwu-wf/workflow` 专注于**定义、解析与验证**，而天枢 (Tianshu) 负责**IO、编排与执行**。

```
驺吾 (@zouwu-wf/workflow) - 平台中立的DSL库
├── schemas/ - JSON Schema定义
├── types/ - TypeScript类型定义
├── parsers/ - 解析逻辑 (YAML/JSON String -> Workflow Object)
├── validators/ - 运行时验证器
└── index.ts - 统一导出

天枢 (@systembug/tianshu) - 统一工作流执行引擎包
├── src/core/
│ ├── TianshuEngine.ts - 引擎入口
│ └── WorkflowLoader.ts - 文件读取 (使用Node.js fs -> Zouwu Parser)
└── src/orchestration/
 ├── WorkflowOrchestrator.ts - 核心编排逻辑
 └── executors/ - 步骤执行器
```

### Phase 1: 驺吾包增强 (Parser)

目标：将解析逻辑 (YAML/JSON Parsing) 移入 Zouwu。

- 添加 `parsers/WorkflowParser.ts`：
- 封装 `js-yaml`。
- 提供 `parse(content: string): WorkflowDefinition`。
- 集成 `Validator`，在解析后自动验证。
- 导出 `WorkflowParser`。

### Phase 2: 天枢调用流程

目标：Tianshu 不再直接依赖 `js-yaml`，而是依赖 Zouwu 进行解析。

1. **读取**: `NodeWorkflowLoader` 使用 `fs.readFile` 读取文件内容 (String)。
2. **解析**: 调用 `Zouwu.WorkflowParser.parse(content)`。

- Zouwu 内部处理 YAML/JSON 转换。
- Zouwu 内部进行 Schema 验证。

3. **执行**: 获取验证后的 `WorkflowDefinition` 对象，传递给 `WorkflowOrchestrator`。

### Phase 3: 职责划分总结

| 功能                    | 负责组件             | 说明                        |
| ----------------------- | -------------------- | --------------------------- |
| **定义 (DSL)**          | `@zouwu-wf/workflow` | Schema, Types               |
| **解析 (String->Obj)**  | `@zouwu-wf/workflow` | 封装 js-yaml, 语法检查      |
| **验证 (Obj->Obj)**     | `@zouwu-wf/workflow` | Schema Validation, 逻辑检查 |
| **加载 (File->String)** | `@systembug/tianshu` | Node.js fs                  |
| **编排 (Execution)**    | `@systembug/tianshu` | 状态机, 步骤流转            |

### Phase 4: 依赖关系

- `legacy-api contract` -> `@zouwu-wf/workflow` (Types, Validators)
- `legacy-api contract` -> `@zouwu-wf/expression-parser` (Expression Evaluation)
- `legacy-api contract` -> `@systembug/diting` (Logging)

### Phase 5: CLI工具 (计划中)

- `validate`: 使用 `Zouwu` 的验证器检查工作流文件。
- `lint`: 静态代码分析。

## 迁移路径

现有的天枢工作流将逐步迁移到驺吾DSL格式。`@zouwu-wf/cli`中将提供迁移工具。

## 参考文献

- [驺吾工作流规范 v1.0](../../design/workflow/zouwu-workflow-specification-v1.0.md)
- [RFC 0039: 天枢工作流语法规范](./0039-tianshu-workflow-syntax-specification.md)
- [RFC 0050: 太乙工作流引擎设计](./0050-taiyi-workflow-adapter-engine.md)
- [@zouwu-wf/workflow 包](../../packages/@zouwu-wf/workflow/)
- [@systembug/tianshu 包](../../packages/@systembug/tianshu/)

## 变更日志

- **2025-12-24**: 更新为专注于驺吾DSL，取代RFC 0055
- **2025-09-29**: 初始版本，定义驺吾(Zouwu)工作流DSL

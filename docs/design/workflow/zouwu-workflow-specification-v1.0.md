# 驺吾工作流语法规范 v1.0

# ZouWu Workflow Syntax Specification v1.0

## 摘要

本规范定义驺吾工作流系统的完整语法规范，建立标准化的工作流描述语言。驺吾（ZouWu）是基于中国山海经神话的工作流引擎，以"五彩斑斓，仁德守护"为核心理念。

## 版本信息

- **规范版本**: 1.0.0
- **发布日期**: 2024-01-01
- **兼容性**: 向后兼容YAML工作流格式
- **文件扩展名**: `.zouwu` 或 `.zouwu.yml`

## 背景

### 设计目标

1. **仁德处理**：以温和、非破坏性的方式处理数据
2. **五彩架构**：通过颜色映射不同的步骤类型
3. **守护模式**：内置数据保护和验证机制
4. **AI就绪**：支持AI生成和理解工作流

### 核心理念

- **五彩斑斓**：不同颜色代表不同的处理逻辑
- **仁德守护**：保护原始数据，温和处理错误
- **长尾链式**：支持复杂的链式调用
- **双翼并行**：优雅的并行处理能力

## 1. 架构概览

### 1.1 核心设计原则

驺吾工作流引擎遵循以下核心设计原则：

1. **声明式工作流** (Declarative Workflow)
    - 使用 YAML 声明式定义工作流
    - 工作流与业务逻辑分离
    - 支持可视化编辑和版本控制

2. **步骤编排** (Step Orchestration)
    - 灵活的步骤类型（action、condition、loop、parallel 等）
    - 支持复杂的控制流（条件分支、循环、并行）
    - 步骤间数据传递和变量解析

3. **意图驱动** (Intent-Driven)
    - 用户意图到工作流的自动映射
    - 统一的命令处理接口
    - 智能工作流选择

4. **可观测性** (Observability)
    - 完整的执行上下文追踪
    - 实时进度反馈
    - 详细的执行指标和错误信息

5. **仁德守护** (Benevolent Guardian)
    - 温和的错误处理
    - 数据保护机制
    - 非破坏性操作

### 1.2 核心组件关系

```
┌──────────────────────────────────────────────────────────────────┐
│                  ZouWu Workflow Engine 架构                     │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌────────────────────────────────────────────────────────┐     │
│  │  ZouWuService (IPC Layer - Main Process)              │     │
│  │  - IPC 请求处理                                       │     │
│  │  - 命令队列管理                                       │     │
│  │  - 跨进程通信                                         │     │
│  └──────────────────┬─────────────────────────────────────┘     │
│                     │                                            │
│  ┌──────────────────▼─────────────────────────────────────┐     │
│  │  ZouWuEngine (Workflow Engine)                         │     │
│  │  - 用户意图理解                                       │     │
│  │  - 工作流选择                                         │     │
│  │  - 命令处理                                           │     │
│  │  - 状态管理                                           │     │
│  └──────────┬──────────────────────┬────────────────────┘     │
│             │                      │                           │
│  ┌──────────▼───────────┐  ┌──────▼─────────────────────┐     │
│  │  WorkflowLoader      │  │  WorkflowOrchestrator       │     │
│  │  - YAML 加载         │  │  - 步骤编排                │     │
│  │  - 工作流解析        │  │  - 执行调度                │     │
│  │  - 热重载            │  │  - 上下文管理              │     │
│  └──────────────────────┘  │  - 进度追踪                │     │
│                            └──────┬─────────────────────┘     │
│                                   │                           │
│                        ┌──────────▼─────────────┐             │
│                        │  VariableResolver      │             │
│                        │  - 变量解析            │             │
│                        │  - 表达式计算          │             │
│                        │  - 步骤参数解析        │             │
│                        └────────────────────────┘             │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
             │
             │ 步骤执行通过 IStepExecutor 接口
             ▼
┌──────────────────────────────────────────────────────────────────┐
│              业务适配器层（由其他引擎提供）                          │
│  - Builtin Adapter（内置操作）                                     │
│  - Wenchang Adapter（偏好管理）                                    │
│  - Qianliyan Adapter（文件扫描）                                   │
│  - ...                                                            │
└──────────────────────────────────────────────────────────────────┘
```

## 2. 工作流数据结构

### 2.1 WorkflowDefinition（工作流定义）

工作流定义是工作流的顶层结构，包含完整的元数据和执行配置：

```typescript
interface WorkflowDefinition {
    /** 工作流唯一标识 */
    id: string;
    /** 工作流名称 */
    name: string;
    /** 工作流描述 */
    description?: string;
    /** 工作流版本（语义化版本） */
    version: string;
    /** 工作流作者 */
    author?: string;
    /** 创建时间戳 */
    createdAt?: number;
    /** 更新时间戳 */
    updatedAt?: number;
    /** 工作流步骤列表 */
    steps: WorkflowStep[];
    /** 输入参数定义 */
    inputs?: Record<string, InputDefinition>;
    /** 输出参数定义 */
    outputs?: Record<string, OutputDefinition>;
    /** 工作流级别变量 */
    variables?: Record<string, any>;
    /** 工作流标签 */
    tags?: string[];
    /** 是否启用 */
    enabled?: boolean;
    /** 超时时间（毫秒） */
    timeout?: number;
    /** 重试配置 */
    retry?: {
        maxAttempts: number;
        delay: number;
        backoff?: 'linear' | 'exponential';
    };
    /** 触发器定义 */
    triggers?: TriggerDefinition[];
    /** 驺吾特性配置 */
    zouwu?: ZouWuConfig;
}
```

### 2.2 WorkflowStep（工作流步骤）

工作流步骤是工作流的基本执行单元，支持多种步骤类型：

```typescript
interface WorkflowStep {
    /** 步骤唯一标识 */
    id: string;
    /** 步骤名称 */
    name?: string;
    /** 步骤类型 */
    type: StepType;
    /** 步骤描述 */
    description?: string;
    /** 驺吾颜色标识（可选） */
    color?: 'blue' | 'red' | 'yellow' | 'white' | 'black';
    /** 服务名称（用于 action 类型） */
    service?: string;
    /** 动作名称（用于 action 类型） */
    action?: string;
    /** 输入参数（支持变量表达式） */
    input?: Record<string, any>;
    /** 输出映射（将步骤输出映射到变量） */
    output?: Record<string, string>;
    /** 输出结构声明（JSON Schema，用于验证） */
    output_schema?: Record<string, any>;
    /** 条件表达式（用于 condition 类型） */
    condition?: ConditionExpression;
    /** 条件为真时执行的步骤 */
    onTrue?: WorkflowStep[];
    /** 条件为假时执行的步骤 */
    onFalse?: WorkflowStep[];
    /** 循环配置（用于 loop 类型） */
    loop?: LoopConfig;
    /** 并行配置（用于 parallel 类型） */
    parallel?: ParallelConfig;
    /** 重试配置 */
    retry?: RetryConfig;
    /** 错误处理 */
    errorHandler?: ErrorHandlerConfig;
    /** 超时时间（毫秒） */
    timeout?: number;
    /** 是否忽略错误 */
    ignoreError?: boolean;
    /** 依赖的步骤 ID */
    dependsOn?: string[];
    /** 步骤标签 */
    tags?: string[];
    /** 驺吾守护特性 */
    guardian?: GuardianConfig;
    /** 驺吾仁德特性 */
    benevolent?: BenevolentConfig;
    /** 驺吾双翼特性（并行专用） */
    wings?: WingsConfig;
    /** 驺吾长尾特性（链式专用） */
    tail?: TailConfig;
}
```

### 2.3 StepType（步骤类型）

```typescript
type StepType =
    | 'action' // 调用业务适配器方法
    | 'condition' // 条件判断分支
    | 'loop' // 循环执行
    | 'builtin' // 内置操作
    | 'parallel' // 并行执行
    | 'sequence' // 序列执行
    | 'delay' // 延迟执行
    | 'retry' // 重试步骤
    | 'error_handler'; // 错误处理
```

### 2.4 ExecutionContext（执行上下文）

执行上下文记录工作流执行的完整状态：

```typescript
interface ExecutionContext {
    /** 执行唯一标识 */
    executionId: string;
    /** 工作流 ID */
    workflowId: string;
    /** 命令 ID */
    commandId?: string;
    /** 开始时间戳 */
    startTime: number;
    /** 当前步骤 ID */
    currentStepId?: string;
    /** 执行状态 */
    status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
    /** 输入参数 */
    input: Record<string, any>;
    /** 输出结果 */
    output?: Record<string, any>;
    /** 运行时变量 */
    variables: Record<string, any>;
    /** 步骤执行结果 */
    stepResults: Map<string, StepResult>;
    /** 错误信息 */
    error?: string;
    /** 执行指标 */
    metrics: {
        stepCount: number;
        successStepCount: number;
        failedStepCount: number;
        skippedStepCount: number;
        totalDuration: number;
    };
}
```

### 2.5 StepResult（步骤执行结果）

```typescript
interface StepResult {
    /** 步骤 ID */
    stepId: string;
    /** 执行状态 */
    status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
    /** 开始时间戳 */
    startTime: number;
    /** 结束时间戳 */
    endTime?: number;
    /** 执行耗时（毫秒） */
    duration?: number;
    /** 输出结果 */
    output?: any;
    /** 错误信息 */
    error?: string;
    /** 重试次数 */
    retryCount: number;
    /** 是否被跳过 */
    skipped: boolean;
    /** 跳过原因 */
    skipReason?: string;
}
```

## 3. 工作流执行流程

### 3.1 完整执行链路

```
1. Renderer Process (渲染进程)
   │
   ├─> 发起 UI Command: { intent: 'scan_folder', params: {...} }
   │
   ├─> IPC 请求: ipcRenderer.invoke('zouwu:processCommand', command)
   │
2. Main Process (主进程)
   │
   ├─> ZouWuService 接收 IPC 请求
   │
   ├─> 转发给 ZouWuEngine
   │
3. ZouWuEngine (工作流引擎)
   │
   ├─> 意图理解: 'scan_folder' → workflow ID
   │
   ├─> 工作流加载: WorkflowLoader.loadWorkflow(workflowId)
   │
   ├─> 创建执行上下文: ExecutionContext
   │
   ├─> 委托给 WorkflowOrchestrator
   │
4. WorkflowOrchestrator (工作流编排器)
   │
   ├─> 解析工作流步骤
   │
   ├─> FOR EACH step IN workflow.steps:
   │   │
   │   ├─> 检查依赖: checkDependencies(step)
   │   │
   │   ├─> 变量解析: VariableResolver.resolveStep(step, context)
   │   │
   │   ├─> 执行步骤:
   │   │   ├─> IF step.type === 'condition':
   │   │   │   └─> executeConditionStep() → 执行 onTrue/onFalse
   │   │   ├─> IF step.type === 'loop':
   │   │   │   └─> executeLoopStep() → 循环执行子步骤
   │   │   ├─> IF step.type === 'parallel':
   │   │   │   └─> executeParallelStep() → 并行执行子步骤
   │   │   ├─> ELSE:
   │   │   │   └─> IStepExecutor.executeAction() → 调用业务适配器
   │   │
   │   ├─> 验证输出: validateStepOutput(output, output_schema)
   │   │
   │   ├─> 更新上下文: context.stepResults.set(step.id, result)
   │   │
   │   └─> 发送进度: emit('stepProgress', ...)
   │
   ├─> 收集输出: collectWorkflowOutput(workflow, context)
   │
   └─> 返回结果: { success, output, metrics }
   │
5. 结果回传
   │
   ├─> ZouWuEngine 触发事件: emit('workflowCompleted', context)
   │
   ├─> ZouWuService 返回 IPC 响应
   │
   └─> Renderer Process 接收结果并更新 UI
```

### 3.2 步骤执行详解

#### action 步骤执行

```typescript
// action 步骤通过 IStepExecutor 调用业务适配器
{
    type: 'action',
    service: 'builtin',     // 适配器名称
    action: 'return',       // 适配器方法
    input: { data: '...' }  // 方法参数
}
↓
IStepExecutor.executeAction(step, context)
↓
调用适配器方法：builtin.return({ data: '...' })
```

#### condition 步骤执行

```typescript
// condition 步骤根据条件分支执行
{
    type: 'condition',
    condition: {
        field: 'steps.validate.output.success',
        operator: 'eq',
        value: true
    },
    onTrue: [...],  // 条件为真时的步骤
    onFalse: [...] // 条件为假时的步骤
}
↓
evaluateCondition(condition, context)
↓
IF condition === true:
    executeSteps(onTrue, context)
ELSE:
    executeSteps(onFalse, context)
```

#### loop 步骤执行

```typescript
// loop 步骤循环执行子步骤
{
    type: 'loop',
    loop: {
        variable: 'item',
        count: '{{steps.get_files.output}}',  // 数组或数字
        steps: [...]
    }
}
↓
FOR item IN count:
    context.variables[variable] = item
    executeSteps(loop.steps, context)
```

### 3.3 变量解析机制

工作流支持通过 `{{expression}}` 语法引用变量和步骤输出：

**支持的表达式格式**：

- `{{steps.stepId.output.field}}` - 引用步骤输出
- `{{inputs.field}}` - 引用工作流输入
- `{{variables.field}}` - 引用运行时变量
- `{{loopContext.item}}` - 引用循环上下文
- `{{branchContext.field}}` - 引用分支上下文

**解析示例**：

```yaml
steps:
    - id: get_path
      type: action
      service: builtin
      action: return
      input:
          data: '/path/to/folder'

    - id: scan_folder
      type: action
      service: qianliyan
      action: scanDirectory
      input:
          path: '{{steps.get_path.output}}' # 解析为 "/path/to/folder"
```

### 3.4 错误处理机制

```typescript
// 1. 步骤级错误处理
try {
    const result = await executeStep(step, context);
} catch (error) {
    if (step.errorHandler) {
        // 执行错误处理步骤
        await executeSteps(step.errorHandler.steps, context);
        if (step.errorHandler.continue) {
            // 继续执行后续步骤
            continue;
        }
    }

    if (step.ignoreError) {
        // 忽略错误，标记为跳过
        result.skipped = true;
        result.skipReason = error.message;
        continue;
    }

    // 终止工作流执行
    throw error;
}

// 2. 工作流级错误处理
try {
    await orchestrator.executeWorkflow(workflow, command, options);
    context.status = 'completed';
} catch (error) {
    context.status = 'failed';
    context.error = error.message;
    emit('workflowFailed', context);
}
```

## 4. 语法规范 v1.0

### 1. 驺吾工作流文件结构

```yaml
# ===== 驺吾元数据 =====
id: 'workflow_unique_identifier' # 必需：工作流唯一标识符
name: '驺吾工作流名称' # 必需：人类可读的名称
description: '工作流功能详细描述' # 可选：功能说明
version: '1.0.0' # 必需：语义版本号
author: '作者名称' # 可选：创建者
createdAt: 1727544000000 # 可选：创建时间戳
updatedAt: 1727544000000 # 可选：最后更新时间

# ===== 触发器定义 =====
triggers: # 可选：工作流触发条件
    - intent: 'workflow_intent' # 意图标识符
    - event: 'zouwu_awakens' # 事件触发
    - schedule: '0 */6 * * *' # 定时触发（cron格式）

# ===== 输入输出规范 =====
inputs: # 可选：输入参数定义
    paramName: # 参数名作为键
        type: 'string|number|boolean|object|array' # 数据类型
        required: true # 是否必需
        description: '参数描述' # 参数说明
        default: '默认值' # 默认值
        validation: # 验证规则
            pattern: '^[a-z]+$'
            min: 0
            max: 100

outputs: # 可选：输出结果定义
    resultName: # 输出名作为键
        type: 'string|number|boolean|object|array'
        description: '输出描述'

# ===== 全局变量 =====
variables: # 可选：工作流级变量
    requestId: '{{uuid()}}'
    timestamp: '{{Date.now()}}'
    maxRetries: 3

# ===== 驺吾五彩步骤 =====
colors: # 驺吾特色：五彩步骤（兼容steps）
    - id: 'step_unique_id' # 必需：步骤唯一标识
      name: '步骤显示名称' # 可选：人类可读名称
      color: blue|red|yellow|white|black # 驺吾特色：颜色映射
      type: condition|action|builtin|parallel|loop # 步骤类型
      description: '步骤描述' # 可选：功能说明

      # 驺吾特性
      guardian: # 守护特性
          gentle: true # 温和模式
          safe: true # 安全保护

      benevolent: # 仁德特性
          nonDestructive: true # 非破坏性
          preserveOriginal: true # 保留原始数据

      wings: # 双翼特性（并行专用）
          left: 'left_branch'
          right: 'right_branch'

      tail: # 长尾特性（链式专用）
          long: true
          graceful: true

# ===== 传统steps兼容 =====
steps: # 传统格式（与colors互斥）
    -  # 标准步骤定义

# ===== 驺吾特性配置 =====
zouwu: # 驺吾专属配置
    benevolence: true # 启用仁德模式
    fiveColors: true # 启用五彩步骤
    guardian: true # 启用守护模式
    preserveData: true # 不食活物（保护数据）
    tailLength: 'long|medium|short' # 长尾特性级别

# ===== 错误处理 =====
error_handling: # 可选：全局错误处理
    default:
        type: 'gentle_recovery' # 驺吾特色：温和恢复
        response:
            success: false
            message: '驺吾温和地处理了异常'

# ===== 工作流配置 =====
enabled: true # 可选：是否启用
timeout: 30000 # 可选：超时时间（毫秒）
priority: 'user' # 可选：优先级
retryOnFailure: true # 可选：失败时重试
maxRetries: 2 # 可选：最大重试次数
tags: ['zouwu', 'workflow'] # 可选：标签分类
```

### 2. 驺吾五彩步骤类型

#### 2.1 青色步骤 (Blue - Condition)

条件判断步骤，驺吾以仁德之心进行判断：

```yaml
- id: 'guardian_check'
  name: '驺吾守护检查'
  color: blue # 青色标识
  type: 'condition'
  condition:
      field: '{{inputs.data}}'
      operator: 'eq|ne|gt|gte|lt|lte|in|nin|exists|matches|and|or'
      value: 'expected_value'
  guardian: # 驺吾守护特性
      gentle: true
      safe: true
  onTrue:
      -  # 条件为真时执行的步骤
  onFalse:
      -  # 条件为假时执行的步骤
```

#### 2.2 赤色步骤 (Red - Action)

动作执行步骤，驺吾温和地执行外部服务调用：

```yaml
- id: 'benevolent_action'
  name: '驺吾仁德处理'
  color: red # 赤色标识
  type: 'action'
  service: 'wenchang|taiyi|qianliyan|maliang'
  action: 'methodName'
  benevolent: # 仁德特性
      nonDestructive: true
      preserveOriginal: true
  input:
      param: '{{inputs.data}}'
  output:
      result: 'result'
  output_schema: # 输出模式定义
      result:
          type: object
```

#### 2.3 黄色步骤 (Yellow - Builtin)

内置操作步骤，驺吾的基础能力：

```yaml
- id: 'gentle_log'
  name: '驺吾记录'
  color: yellow # 黄色标识
  type: 'builtin'
  action: 'return|setVariable|log|delay|transform|error'
  input:
      level: 'info'
      message: '🎨 驺吾五彩处理中...'
```

#### 2.4 白色步骤 (White - Parallel)

并行处理步骤，驺吾展开双翼：

```yaml
- id: 'dual_wings'
  name: '驺吾双翼'
  color: white # 白色标识
  type: 'parallel'
  wings: # 双翼配置
      left: 'validation'
      right: 'transformation'
  branches:
      - name: 'validation'
        steps:
            -  # 左翼步骤
      - name: 'transformation'
        steps:
            -  # 右翼步骤
  waitFor: 'all|any|majority'
  failOn: 'any|all|majority'
```

#### 2.5 玄色步骤 (Black - Loop)

循环处理步骤，驺吾长尾递归：

```yaml
- id: 'tail_recursion'
  name: '驺吾长尾'
  color: black # 玄色标识
  type: 'loop'
  tail: # 长尾特性
      long: true
      graceful: true
  iterator:
      source: '{{inputs.array}}'
      variable: 'item'
      index: 'index'
  steps:
      -  # 循环体步骤
  breakCondition:
      operator: 'gte'
      value: '{{index}}'
      test: 10
```

### 4.3 条件操作符

支持的条件操作符：

| 操作符          | 说明           | 示例                                                            |
| --------------- | -------------- | --------------------------------------------------------------- |
| `eq`            | 等于           | `{ field: "status", operator: "eq", value: "success" }`         |
| `ne`            | 不等于         | `{ field: "count", operator: "ne", value: 0 }`                  |
| `gt`            | 大于           | `{ field: "age", operator: "gt", value: 18 }`                   |
| `gte`           | 大于等于       | `{ field: "score", operator: "gte", value: 60 }`                |
| `lt`            | 小于           | `{ field: "price", operator: "lt", value: 100 }`                |
| `lte`           | 小于等于       | `{ field: "length", operator: "lte", value: 255 }`              |
| `in`            | 包含于数组     | `{ field: "type", operator: "in", value: ["image", "video"] }`  |
| `nin`           | 不包含于数组   | `{ field: "status", operator: "nin", value: ["failed"] }`       |
| `exists`        | 字段存在       | `{ field: "optional", operator: "exists", value: true }`        |
| `not_exists`    | 字段不存在     | `{ field: "error", operator: "not_exists", value: true }`       |
| `startsWith`    | 以...开始      | `{ field: "path", operator: "startsWith", value: "/home" }`     |
| `endsWith`      | 以...结束      | `{ field: "file", operator: "endsWith", value: ".jpg" }`        |
| `contains`      | 包含字符串     | `{ field: "name", operator: "contains", value: "test" }`        |
| `isEmpty`       | 为空           | `{ field: "array", operator: "isEmpty", value: true }`          |
| `isNotEmpty`    | 不为空         | `{ field: "list", operator: "isNotEmpty", value: true }`        |
| `string_maxlen` | 字符串最大长度 | `{ field: "name", operator: "string_maxlen", value: 50 }`       |
| `string_minlen` | 字符串最小长度 | `{ field: "password", operator: "string_minlen", value: 8 }`    |
| `matches`       | 正则匹配       | `{ field: "email", operator: "matches", value: "^[a-z]+@.*$" }` |
| `and`           | 逻辑与         | `{ operator: "and", conditions: [...] }`                        |
| `or`            | 逻辑或         | `{ operator: "or", conditions: [...] }`                         |

### 4.4 完整工作流示例

```yaml
id: scan/folder_scan
name: '文件夹扫描工作流'
version: '1.0.0'
enabled: true
createdAt: 1700000000000
updatedAt: 1700000000000

inputs:
    path:
        type: string
        required: true
        description: '扫描路径'

outputs:
    fileCount:
        type: number
        description: '文件数量'
    processedFiles:
        type: array
        description: '已处理文件列表'

steps:
    # 1. 验证输入路径
    - id: validate_path
      name: '验证路径'
      type: condition
      color: blue
      condition:
          field: 'inputs.path'
          operator: isNotEmpty
          value: true
      onTrue:
          - id: scan
            name: '执行扫描'
            type: action
            color: red
            service: qianliyan
            action: scanDirectory
            input:
                path: '{{inputs.path}}'
                recursive: true
            output:
                files: result
      onFalse:
          - id: error
            name: '路径为空错误'
            type: action
            color: yellow
            service: builtin
            action: error
            input:
                message: '路径不能为空'
                code: 'INVALID_PATH'

    # 2. 检查扫描结果
    - id: check_results
      name: '检查结果'
      type: condition
      color: blue
      condition:
          field: 'steps.scan.output.files.length'
          operator: gt
          value: 0
      onTrue:
          - id: process_files
            name: '处理文件'
            type: loop
            color: black
            loop:
                variable: file
                count: '{{steps.scan.output.files}}'
                steps:
                    - id: generate_thumbnail
                      name: '生成缩略图'
                      type: action
                      color: red
                      service: media
                      action: generateThumbnail
                      input:
                          path: '{{file.path}}'
                          size: 200
      onFalse:
          - id: log_empty
            name: '记录空结果'
            type: action
            color: yellow
            service: builtin
            action: log
            input:
                level: warn
                message: '未找到文件'

    # 3. 返回结果
    - id: return_result
      name: '返回结果'
      type: action
      color: yellow
      service: builtin
      action: return
      input:
          success: true
          data:
              fileCount: '{{steps.scan.output.files.length}}'
              processedFiles: '{{steps.process_files.output}}'
```

## 5. 工作流最佳实践

### 5.1 工作流设计原则

#### 单一职责原则

每个工作流应该专注于一个明确的业务目标：

- ✅ `scan/folder_scan` - 扫描文件夹
- ✅ `preference/get_preferences` - 获取偏好设置
- ❌ `scan_and_process_everything` - 职责不清晰

#### 步骤粒度

保持步骤的合理粒度：

- **太粗**：一个步骤做太多事情，难以调试和复用
- **太细**：过多的步骤增加复杂度
- **合适**：每个步骤完成一个逻辑单元

#### 变量命名

使用清晰的变量命名：

```yaml
# ✅ 好的命名
steps:
    - id: validate_input_path
    - id: scan_media_files
    - id: generate_thumbnails

# ❌ 不好的命名
steps:
    - id: step1
    - id: do_something
    - id: process
```

### 5.2 错误处理策略

#### 使用 ignoreError 处理非关键步骤

```yaml
- id: log_metrics
  type: action
  service: builtin
  action: log
  input:
      message: '处理完成'
  ignoreError: true # 日志失败不影响工作流
```

#### 使用 errorHandler 处理可恢复错误

```yaml
- id: process_file
  type: action
  service: media
  action: processFile
  input:
      path: '{{file.path}}'
  errorHandler:
      steps:
          - id: log_error
            type: action
            service: builtin
            action: log
            input:
                level: error
                message: '处理失败: {{error.message}}'
      continue: true # 记录错误后继续
```

#### 使用条件验证关键输入

```yaml
- id: validate_critical_input
  type: condition
  condition:
      field: 'inputs.required_field'
      operator: exists
      value: true
  onFalse:
      - id: throw_validation_error
        type: action
        service: builtin
        action: error
        input:
            message: '缺少必需参数'
            code: 'VALIDATION_ERROR'
```

### 5.3 性能优化

#### 使用并行执行

对于独立的任务，使用并行执行提升性能：

```yaml
- id: parallel_thumbnails
  type: parallel
  color: white
  parallel:
      maxConcurrency: 5 # 限制并发数
      steps:
          - id: thumb_small
            type: action
            service: media
            action: generateThumbnail
            input:
                size: 100
          - id: thumb_medium
            type: action
            service: media
            action: generateThumbnail
            input:
                size: 200
          - id: thumb_large
            type: action
            service: media
            action: generateThumbnail
            input:
                size: 400
```

#### 合理使用超时配置

```yaml
# 工作流级别超时
timeout: 300000 # 5 分钟

steps:
    - id: quick_operation
      type: action
      timeout: 5000 # 单个步骤 5 秒超时
```

#### 批量处理策略

对于大量数据，考虑分批处理：

```yaml
- id: batch_process
  type: loop
  loop:
      variable: batch
      count: '{{variables.file_batches}}'
      steps:
          - id: process_batch
            type: parallel
            parallel:
                maxConcurrency: 10
                steps: '{{batch.items}}'
```

### 5.4 可维护性建议

#### 使用有意义的 output 映射

```yaml
- id: get_user_info
  type: action
  service: user
  action: getUserInfo
  output:
      username: user.name
      email: user.email
      role: user.role
```

#### 添加详细的 description

```yaml
- id: complex_validation
  name: '复杂业务验证'
  description: '验证用户权限、配额和文件格式'
  type: condition
  # ...
```

#### 使用 output_schema 验证

```yaml
- id: critical_step
  type: action
  service: payment
  action: processPayment
  output_schema:
      type: object
      required: ['transactionId', 'status']
      properties:
          transactionId:
              type: string
          status:
              enum: ['success', 'pending', 'failed']
          amount:
              type: number
```

### 5.5 调试技巧

#### 使用 log 步骤追踪执行

```yaml
- id: debug_variables
  type: action
  service: builtin
  action: log
  input:
      level: debug
      message: '当前变量状态'
      metadata:
          fileCount: '{{steps.scan.output.files.length}}'
          currentIndex: '{{loopContext.index}}'
```

#### 条件步骤添加详细分支日志

```yaml
- id: check_condition
  type: condition
  condition:
      field: 'steps.validate.output.valid'
      operator: eq
      value: true
  onTrue:
      - id: log_success_path
        type: action
        service: builtin
        action: log
        input:
            message: '验证成功，进入处理流程'
  onFalse:
      - id: log_failure_path
        type: action
        service: builtin
        action: log
        input:
            level: warn
            message: '验证失败，跳过处理'
```

## 6. 语法规范 v1.0

### 6.1 驺吾工作流文件结构

```yaml
# 基本变量引用
value: "{{inputs.userName}}"
value: "{{variables.processCount}}"
value: "{{colors.stepId.output.result}}"    # 驺吾五彩步骤引用

# 默认值语法
value: "{{inputs.optionalField || 'default_value'}}"

# 嵌套属性访问
value: "{{inputs.user.profile.preferences.theme}}"
```

#### 6.3.2 驺吾内置函数

```yaml
# 标准函数
value: "{{uuid()}}"                         # 生成UUID
value: "{{timestamp()}}"                    # 当前时间戳
value: "{{now()}}"                         # 当前时间

# 驺吾特色函数
value: "{{zouwu.gentle(data)}}"            # 温和处理
value: "{{zouwu.guard(value)}}"            # 守护检查
value: "{{zouwu.benevolent(action)}}"      # 仁德执行
```

### 6.4 依赖管理

```yaml
colors:
    - id: 'step_a'
      # 步骤定义

    - id: 'step_b'
      dependsOn: ['step_a'] # 单个依赖

    - id: 'step_c'
      dependsOn: ['step_a', 'step_b'] # 多个依赖
```

### 6.5 错误处理规范

#### 6.5.1 驺吾仁德错误处理

```yaml
error_handling:
    validation_error:
        type: 'benevolent_failure' # 仁德失败
        response:
            success: false
            error: '驺吾检测到验证未通过'
            guardian: 'zouwu_protected'

    engine_error:
        type: 'gentle_retry' # 温和重试
        maxRetries: 3
        backoff: 'linear'
        delay: 1000
```

### 6.6 驺吾特性配置

```yaml
zouwu:
    # 核心特性
    benevolence: true # 仁德模式
    fiveColors: true # 五彩架构
    guardian: true # 守护模式

    # 行为配置
    preserveData: true # 不食活物
    gentleErrors: true # 温和错误
    safeMode: true # 安全模式

    # 性能配置
    tailLength: 'long' # 长尾级别
    wingSpan: 'wide' # 双翼展开度
```

## 向后兼容性

驺吾工作流系统完全兼容标准YAML工作流格式：

1. **steps vs colors**: 可以使用传统的`steps`字段，也可以使用驺吾特色的`colors`字段
2. **标准字段支持**: 所有RFC 0039定义的标准字段都被支持
3. **扩展不破坏**: 驺吾特性是可选的，不影响标准工作流执行

## 版本迁移指南

从标准工作流迁移到驺吾工作流：

1. 将文件扩展名改为`.zouwu`
2. 将`steps`重命名为`colors`（可选）
3. 为每个步骤添加`color`属性
4. 添加`zouwu`配置节（可选）
5. 使用驺吾特性增强工作流（可选）

## 工具支持

- **验证器**: ZouWuValidator - 验证工作流语法
- **解析器**: ZouWuParser - 解析.zouwu文件
- **CLI工具**: @systembug/zouwu-cli - 命令行工具
- **VS Code插件**: 语法高亮和智能提示（计划中）

## 结论

驺吾工作流规范v1.0在保持与标准工作流兼容的基础上，增加了独特的"五彩斑斓，仁德守护"特性，为工作流系统带来了新的设计理念和实现方式。

## 7. 参考资料

### 7.1 代码参考

- ZouWuEngine: 工作流引擎核心实现
- WorkflowOrchestrator: 工作流编排器
- WorkflowLoader: 工作流加载器
- VariableResolver: 变量解析器
- 工作流类型定义: TypeScript 接口定义

### 7.2 测试参考

- WorkflowOrchestrator Tests: 工作流编排器测试
- RFC Compliance Tests: 规范合规性测试
- Integration Tests: 集成测试

## 8. 参考文档

- RFC 0039: 驺吾工作流语法规范（基础）
- 山海经·驺吾传说（文化背景）
- YAML 1.2 规范（语法基础）
- Legacy Tianshu Workflow Specification: 天枢工作流规范（历史参考）

## 9. 变更日志

- **2024-01-01**: 初始版本 v1.0.0
    - 添加完整的工作流数据结构定义
    - 添加详细的执行流程说明
    - 添加 YAML 配置格式和示例
    - 添加工作流最佳实践指南
    - 添加完整条件操作符列表
    - 添加架构概览和组件关系图

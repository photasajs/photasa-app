# RFC-0055: Tianshu Workflow Engine - 工作流规范

## 元数据

- **状态**: 草案
- **创建日期**: 2025-11-16
- **作者**: System
- **依赖**: 无（本文档为自包含规范）

## 执行摘要

Tianshu（天枢）工作流引擎是 Picasa 应用的核心工作流编排引擎，负责用户意图理解、工作流选择、步骤调度和执行监控。本 RFC 对 Tianshu 工作流系统的完整规范进行全面总结，包括工作流数据结构、执行流程、YAML 配置格式和最佳实践，为开发者提供权威参考。

## 1. 架构概览

### 1.1 核心设计原则

Tianshu 工作流引擎遵循以下核心设计原则：

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

### 1.2 核心组件关系图

```
┌──────────────────────────────────────────────────────────────────┐
│                  Tianshu Workflow Engine 架构                     │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌────────────────────────────────────────────────────────┐     │
│  │  TianshuService (IPC Layer - Main Process)            │     │
│  │  - IPC 请求处理                                       │     │
│  │  - 命令队列管理                                       │     │
│  │  - 跨进程通信                                         │     │
│  └──────────────────┬─────────────────────────────────────┘     │
│                     │                                            │
│  ┌──────────────────▼─────────────────────────────────────┐     │
│  │  TianshuEngine (Workflow Engine)                      │     │
│  │  - 用户意图理解                                       │     │
│  │  - 工作流选择                                         │     │
│  │  - 命令处理                                           │     │
│  │  - 状态管理                                           │     │
│  └──────────┬──────────────────────┬────────────────────┘     │
│             │                      │                           │
│  ┌──────────▼───────────┐  ┌──────▼─────────────────────┐     │
│  │  WorkflowLoader      │  │  WorkflowOrchestrator      │     │
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

**位置**: `src/engines/tianshu/types/workflows.ts`

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
    createdAt: number;
    /** 更新时间戳 */
    updatedAt: number;
    /** 工作流步骤列表 */
    steps: WorkflowStep[];
    /** 输入参数 JSON Schema */
    inputSchema?: Record<string, any>;
    /** 输出参数 JSON Schema */
    outputSchema?: Record<string, any>;
    /** 工作流级别变量 */
    variables?: Record<string, any>;
    /** 工作流标签 */
    tags?: string[];
    /** 是否启用 */
    enabled: boolean;
    /** 超时时间（毫秒） */
    timeout?: number;
    /** 重试配置 */
    retry?: {
        maxAttempts: number;
        delay: number;
        backoff?: 'linear' | 'exponential';
    };
}
```

### 2.2 WorkflowStep（工作流步骤）

工作流步骤是工作流的基本执行单元，支持多种步骤类型：

```typescript
interface WorkflowStep {
    /** 步骤唯一标识 */
    id: string;
    /** 步骤名称 */
    name: string;
    /** 步骤类型 */
    type: StepType;
    /** 步骤描述 */
    description?: string;
    /** 执行模式：sync | async | parallel */
    mode?: ExecutionMode;
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
    loop?: {
        variable: string;
        count: number | string;
        steps: WorkflowStep[];
    };
    /** 并行配置（用于 parallel 类型） */
    parallel?: {
        maxConcurrency?: number;
        steps: WorkflowStep[];
    };
    /** 重试配置 */
    retry?: {
        maxAttempts: number;
        delay: number;
        backoff?: 'linear' | 'exponential';
        retryCondition?: ConditionExpression;
    };
    /** 错误处理 */
    errorHandler?: {
        errorType?: string;
        steps: WorkflowStep[];
        continue?: boolean;
    };
    /** 超时时间（毫秒） */
    timeout?: number;
    /** 是否忽略错误 */
    ignoreError?: boolean;
    /** 依赖的步骤 ID */
    dependsOn?: string[];
    /** 步骤标签 */
    tags?: string[];
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
    commandId: string;
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
   ├─> IPC 请求: ipcRenderer.invoke('tianshu:processCommand', command)
   │
2. Main Process (主进程)
   │
   ├─> TianshuService 接收 IPC 请求
   │
   ├─> 转发给 TianshuEngine
   │
3. TianshuEngine (工作流引擎)
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
   ├─> TianshuEngine 触发事件: emit('workflowCompleted', context)
   │
   ├─> TianshuService 返回 IPC 响应
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

## 4. YAML 工作流配置格式

### 4.1 基本结构

工作流使用 YAML 格式定义，存储在 `workflows/` 目录下：

```yaml
# 工作流元数据
id: scan/folder_scan
name: '文件夹扫描工作流'
description: '扫描指定文件夹并生成缩略图'
version: '1.0.0'
author: 'System'
enabled: true
createdAt: 1700000000000
updatedAt: 1700000000000

# 输入参数 Schema（可选）
inputSchema:
    type: object
    required: ['path']
    properties:
        path:
            type: string
            description: '扫描路径'
        recursive:
            type: boolean
            default: true

# 输出参数 Schema（可选）
outputSchema:
    type: object
    properties:
        fileCount:
            type: number
        duration:
            type: number

# 工作流级别变量（可选）
variables:
    maxFiles: 1000
    batchSize: 100

# 工作流步骤
steps:
    # ... 步骤定义（见下文）

# 超时配置（可选）
timeout: 300000 # 5 分钟

# 重试配置（可选）
retry:
    maxAttempts: 3
    delay: 1000
    backoff: exponential
```

### 4.2 步骤类型详解

#### 4.2.1 action 步骤（调用业务适配器）

```yaml
- id: scan_directory
  name: '扫描文件夹'
  type: action
  service: qianliyan # 适配器名称
  action: scanDirectory # 适配器方法
  input:
      path: '{{inputs.path}}'
      recursive: true
  output:
      files: result.files # 将输出映射到变量
  output_schema: # 验证输出结构
      type: object
      required: ['files']
      properties:
          files:
              type: array
```

#### 4.2.2 builtin 步骤（内置操作）

```yaml
- id: return_result
  name: '返回结果'
  type: action
  service: builtin
  action: return
  input:
      success: true
      data:
          fileCount: '{{steps.scan_directory.output.files.length}}'
          duration: '{{variables.duration}}'
```

#### 4.2.3 condition 步骤（条件分支）

```yaml
- id: check_file_count
  name: '检查文件数量'
  type: condition
  condition:
      field: 'steps.scan_directory.output.files.length'
      operator: gt
      value: 0
  onTrue:
      - id: process_files
        name: '处理文件'
        type: action
        service: media
        action: processFiles
        input:
            files: '{{steps.scan_directory.output.files}}'
  onFalse:
      - id: log_empty
        name: '记录空结果'
        type: action
        service: builtin
        action: log
        input:
            level: warn
            message: '未找到任何文件'
```

#### 4.2.4 loop 步骤（循环执行）

```yaml
- id: process_each_file
  name: '逐个处理文件'
  type: loop
  loop:
      variable: file
      count: '{{steps.scan_directory.output.files}}'
      steps:
          - id: generate_thumbnail
            name: '生成缩略图'
            type: action
            service: media
            action: generateThumbnail
            input:
                path: '{{file.path}}'
                size: 200
```

#### 4.2.5 parallel 步骤（并行执行）

```yaml
- id: parallel_processing
  name: '并行处理'
  type: parallel
  parallel:
      maxConcurrency: 5
      steps:
          - id: task_1
            type: action
            service: builtin
            action: delay
            input:
                milliseconds: 1000
          - id: task_2
            type: action
            service: builtin
            action: log
            input:
                level: info
                message: '并行任务 2'
```

### 4.3 条件操作符

支持的条件操作符：

| 操作符          | 说明           | 示例                                                           |
| --------------- | -------------- | -------------------------------------------------------------- |
| `eq`            | 等于           | `{ field: "status", operator: "eq", value: "success" }`        |
| `ne`            | 不等于         | `{ field: "count", operator: "ne", value: 0 }`                 |
| `gt`            | 大于           | `{ field: "age", operator: "gt", value: 18 }`                  |
| `gte`           | 大于等于       | `{ field: "score", operator: "gte", value: 60 }`               |
| `lt`            | 小于           | `{ field: "price", operator: "lt", value: 100 }`               |
| `lte`           | 小于等于       | `{ field: "length", operator: "lte", value: 255 }`             |
| `in`            | 包含于数组     | `{ field: "type", operator: "in", value: ["image", "video"] }` |
| `nin`           | 不包含于数组   | `{ field: "status", operator: "nin", value: ["failed"] }`      |
| `exists`        | 字段存在       | `{ field: "optional", operator: "exists", value: true }`       |
| `not_exists`    | 字段不存在     | `{ field: "error", operator: "not_exists", value: true }`      |
| `startsWith`    | 以...开始      | `{ field: "path", operator: "startsWith", value: "/home" }`    |
| `endsWith`      | 以...结束      | `{ field: "file", operator: "endsWith", value: ".jpg" }`       |
| `contains`      | 包含字符串     | `{ field: "name", operator: "contains", value: "test" }`       |
| `isEmpty`       | 为空           | `{ field: "array", operator: "isEmpty", value: true }`         |
| `isNotEmpty`    | 不为空         | `{ field: "list", operator: "isNotEmpty", value: true }`       |
| `string_maxlen` | 字符串最大长度 | `{ field: "name", operator: "string_maxlen", value: 50 }`      |
| `string_minlen` | 字符串最小长度 | `{ field: "password", operator: "string_minlen", value: 8 }`   |

### 4.4 变量表达式语法

**基本语法**：`{{expression}}`

**支持的表达式**：

- `{{inputs.fieldName}}` - 引用工作流输入参数
- `{{variables.fieldName}}` - 引用工作流变量
- `{{steps.stepId.output.field}}` - 引用步骤输出
- `{{steps.stepId.output.nested.field}}` - 引用嵌套字段

**示例**：

```yaml
steps:
    - id: get_config
      type: action
      service: wenchang
      action: getPreferences
      output:
          theme: preferences.ui.theme

    - id: use_config
      type: action
      service: builtin
      action: log
      input:
          message: '当前主题: {{steps.get_config.output.theme}}'
```

### 4.5 完整工作流示例

```yaml
id: scan/folder_scan
name: '文件夹扫描工作流'
version: '1.0.0'
enabled: true
createdAt: 1700000000000
updatedAt: 1700000000000

inputSchema:
    type: object
    required: ['path']
    properties:
        path:
            type: string

steps:
    # 1. 验证输入路径
    - id: validate_path
      name: '验证路径'
      type: condition
      condition:
          field: 'inputs.path'
          operator: isNotEmpty
          value: true
      onTrue:
          - id: scan
            name: '执行扫描'
            type: action
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
            service: builtin
            action: throwError
            input:
                message: '路径不能为空'
                code: 'INVALID_PATH'

    # 2. 检查扫描结果
    - id: check_results
      name: '检查结果'
      type: condition
      condition:
          field: 'steps.scan.output.files.length'
          operator: gt
          value: 0
      onTrue:
          - id: process_files
            name: '处理文件'
            type: loop
            loop:
                variable: file
                count: '{{steps.scan.output.files}}'
                steps:
                    - id: generate_thumbnail
                      name: '生成缩略图'
                      type: action
                      service: media
                      action: generateThumbnail
                      input:
                          path: '{{file.path}}'
                          size: 200
      onFalse:
          - id: log_empty
            name: '记录空结果'
            type: action
            service: builtin
            action: log
            input:
                level: warn
                message: '未找到文件'

    # 3. 返回结果
    - id: return_result
      name: '返回结果'
      type: action
      service: builtin
      action: return
      input:
          success: true
          data:
              fileCount: '{{steps.scan.output.files.length}}'
              processedFiles: '{{steps.process_files.output.length}}'
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
        action: throwError
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
          currentIndex: '{{loop.index}}'
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

## 6. 参考资料

### 6.1 代码参考

- TianshuEngine: `src/engines/tianshu/core/TianshuEngine.ts`
- WorkflowOrchestrator: `src/engines/tianshu/orchestration/WorkflowOrchestrator.ts`
- WorkflowLoader: `src/engines/tianshu/core/WorkflowLoader.ts`
- VariableResolver: `src/engines/tianshu/orchestration/VariableResolver.ts`
- 工作流类型: `src/engines/tianshu/types/workflows.ts`

### 6.2 测试参考

- WorkflowOrchestrator Tests: `src/engines/tianshu/__tests__/workflow-condition-execution.spec.ts`
- RFC Compliance Tests: `src/engines/tianshu/__tests__/rfc-compliance.spec.ts`
- Integration Tests: `src/engines/tianshu/__tests__/workflows-scan-integration.spec.ts`

## 7. 变更日志

- **2025-11-16**: 初始版本 - 基于 Tianshu 实际实现的完整工作流规范
    - 添加完整的工作流数据结构定义
    - 添加详细的执行流程说明
    - 添加 YAML 配置格式和示例
    - 添加工作流最佳实践指南

---

**文档维护者**: Tianshu Workflow Team
**最后更新**: 2025-11-16
**文档版本**: 1.0.0

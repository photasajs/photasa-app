# RFC 0039: 天枢工作流语法规范

## 摘要

本RFC定义天枢(Tianshu)引擎的工作流语法规范。天枢工作流是 **驺吾(ZouWu)工作流DSL** (参见 RFC 0037) 的一个具体运行时实现。本规范在遵循驺吾通用核心语法的基础上，定义了天枢引擎特有的服务适配器、内置动作以及运行时约束。

## 背景

### 设计目标

1. **运行时逻辑描述**：通过YAML描述所有业务逻辑，支持动态修改而无需重新编译
2. **AI集成就绪**：为未来AI基于用户语言生成工作流提供可解析的语法结构
3. **类型安全**：明确的语法规范确保工作流的正确性和可预测性
4. **扩展性设计**：支持新功能和自定义步骤类型的添加

### 核心原则

- **声明式语法**：描述"做什么"而非"怎么做"
- **组合性设计**：基础步骤类型可组合成复杂工作流
- **清晰的职责分离**：内置处理器 vs 引擎路由明确区分
- **标准化格式**：统一的YAML结构便于工具处理和验证

## 语法规范

### 1. 工作流文件结构

```yaml
# ===== 工作流元数据 =====
id: "workflow_unique_identifier" # 必需：工作流唯一标识符
name: "工作流显示名称" # 必需：人类可读的名称
description: "工作流功能详细描述" # 可选：功能说明
version: "1.0.0" # 必需：语义版本号
author: "作者名称" # 可选：创建者
createdAt: 1727544000000 # 可选：创建时间戳
updatedAt: 1727544000000 # 可选：最后更新时间

# ===== 触发器定义 =====
triggers: # 可选：工作流触发条件
    - intent: "get_preferences" # 意图标识符
    - intent: "preference_get" # 支持多个别名
    - event: "preference_changed" # 事件触发
    - schedule: "0 */6 * * *" # 定时触发（cron格式）

# ===== 输入输出规范 =====
inputs: # 可选：输入参数定义
    - name: "delta" # 参数名称
      type: "object" # 数据类型
      required: true # 是否必需
      description: "偏好设置变更增量" # 参数说明
      default: {} # 默认值
      validation: # 验证规则
          schema:
              type: "object"
              properties:
                  ui: { type: "object" }
                  display: { type: "object" }

outputs: # 可选：输出结果定义
    - name: "success"
      type: "boolean"
      description: "操作是否成功"
    - name: "data"
      type: "object"
      description: "返回的数据"

# ===== 全局变量 =====
variables: # 可选：工作流级变量
    requestId: "{{inputs.requestId || 'auto-' + timestamp}}"
    timestamp: "{{Date.now()}}"
    maxRetries: 3

# ===== 工作流步骤 =====
steps: # 必需：步骤定义列表
    -  # 步骤定义（见下文详细规范）

# ===== 错误处理 =====
error_handling: # 可选：全局错误处理
    default:
        type: "graceful_failure" # 处理类型
        response:
            success: false
            error: "工作流执行失败"
            data: null
    validation_error:
        type: "return_error"
        response:
            success: false
            error: "输入数据验证失败"

# ===== 工作流配置 =====
enabled: true # 可选：是否启用
timeout: 30000 # 可选：超时时间（毫秒）
priority: "user" # 可选：优先级 [system, user, background]
retryOnFailure: true # 可选：失败时是否重试
maxRetries: 2 # 可选：最大重试次数
tags: ["preferences", "user"] # 可选：标签分类
```

### 2. 步骤类型规范

#### 2.1 条件步骤 (condition)

**用途**：内置条件判断，由TianshuEngine直接处理，不路由到外部引擎。特别适用于处理前置步骤的执行结果，如验证结果、业务逻辑判断等。

```yaml
- id: "validate_action" # 必需：步骤唯一标识
  name: "验证操作类型" # 可选：步骤显示名称
  type: "condition" # 必需：步骤类型
  description: "检查请求的操作类型是否有效" # 可选：步骤说明

  # 条件表达式
  condition:
      field: "{{inputs.action}}" # 要检查的字段路径
      operator: "in" # 比较操作符
      value: ["get", "update", "reset"] # 预期值

  # 条件为真时执行的步骤
  onTrue:
      - id: "process_request"
        type: "action"
        service: "wenchang"
        action: "processRequest"
        input:
            action: "{{inputs.action}}"

  # 条件为假时执行的步骤
  onFalse:
      - id: "return_error"
        type: "builtin"
        action: "error"
        input:
            message: "无效的操作类型: {{inputs.action}}"
            code: "INVALID_ACTION"
```

**验证结果处理模式**：

```yaml
# 示例：处理验证步骤的结果
- id: "data_validation"
  name: "验证输入数据"
  type: "action"
  service: "wenchang"
  action: "validate"
  input:
      data: "{{inputs.delta}}"
      rules:
          - type: "object"
          - notEmpty: true

- id: "check_validation_result"
  name: "检查验证结果"
  type: "condition"
  description: "根据验证结果决定是否继续执行"
  dependsOn: ["data_validation"]
  condition:
      field: "{{steps.data_validation.valid}}" # 引用前置步骤的返回字段
      operator: "eq"
      value: true
  onTrue:
      - id: "continue_processing"
        type: "action"
        service: "wenchang"
        action: "processData"
        input:
            data: "{{inputs.delta}}"
  onFalse:
      - id: "return_validation_error"
        type: "builtin"
        action: "return"
        input:
            success: false
            error: "数据验证失败"
            details: "{{steps.data_validation.errors}}"
```

**支持的操作符**：

- `eq`: 等于
- `ne`: 不等于
- `gt`: 大于
- `gte`: 大于等于
- `lt`: 小于
- `lte`: 小于等于
- `in`: 包含在数组中
- `nin`: 不包含在数组中
- `exists`: 字段存在
- `matches`: 正则表达式匹配
- `and`: 逻辑与（需要conditions数组）
- `or`: 逻辑或（需要conditions数组）

**复杂条件示例**：

```yaml
condition:
    operator: "and"
    conditions:
        - field: "{{inputs.delta}}"
          operator: "exists"
        - field: "{{inputs.delta}}"
          operator: "ne"
          value: null
        - operator: "or"
          conditions:
              - field: "{{inputs.delta.ui}}"
                operator: "exists"
              - field: "{{inputs.delta.display}}"
                operator: "exists"
```

#### 2.2 动作步骤 (action)

**用途**：调用外部引擎执行业务逻辑。在天枢运行时中，通过 TaiyiService 路由到目标服务。天枢支持的服务列表（如 `wenchang`, `maliang` 等）属于运行时特定的约束。

```yaml
- id: "update_preferences"
  name: "更新偏好设置"
  type: "action"
  description: "调用文昌引擎更新用户偏好设置"

  # 路由信息
  service: "wenchang" # 目标服务/引擎
  action: "applyDelta" # 调用的方法

  # 输入数据
  input:
      delta: "{{inputs.delta}}" # 支持模板语法
      source: "{{inputs.source || 'user'}}" # 支持默认值
      timestamp: "{{Date.now()}}" # 支持JavaScript表达式

  # 输出映射
  output:
      revision: "result.revision" # 提取返回结果字段
      updatedData: "result.data"
      success: "result.success"

  # 执行控制
  dependsOn: ["validate_action"] # 依赖的步骤
  condition: # 可选：执行条件
      field: "{{inputs.action}}"
      operator: "eq"
      value: "update"

  # 错误处理
  onError:
      type: "retry" # 错误处理类型
      maxRetries: 3
      backoff: "exponential" # 退避策略
      fallback: # 降级处理
          - id: "log_error"
            type: "builtin"
            action: "log"
            input:
                level: "error"
                message: "偏好设置更新失败: {{error.message}}"

  # 性能配置
  timeout: 10000 # 步骤超时
  priority: "high" # 执行优先级
  async: false # 是否异步执行
```

**特殊路由模式**：

1. **太乙路由模式**：

```yaml
service: "taiyi"
action: "callEngine"
input:
    engineName: "wenchang"
    methodName: "getCurrentSnapshot"
    args: []
```

2. **直接引擎调用**：

```yaml
service: "wenchang"
action: "getCurrentSnapshot"
input: {}
```

#### 2.3 内置操作步骤 (builtin)

**用途**：执行系统内置操作。天枢引擎实现了一组标准动作（如 `return`, `setVariable`, `log` 等），这些动作在天枢运行时中作为核心能力提供。

```yaml
- id: "return_success"
  name: "返回成功结果"
  type: "builtin"
  action: "return" # 内置操作类型
  input:
      success: true
      data: "{{steps.update_preferences.output}}"
      message: "偏好设置更新成功"
      timestamp: "{{Date.now()}}"
  condition:
      field: "{{steps.update_preferences.output.success}}"
      operator: "eq"
      value: true
```

**内置操作类型**：

1. **返回操作 (return)**：

```yaml
action: "return"
input:
    success: true
    data: { /* 返回数据 */ }
    error: null
    message: "操作完成"
```

2. **变量设置 (setVariable)**：

```yaml
action: "setVariable"
input:
    name: "processedCount"
    value: "{{variables.processedCount + 1}}"
    scope: "workflow" # workflow, step, global
```

3. **日志记录 (log)**：

```yaml
action: "log"
input:
    level: "info" # debug, info, warn, error
    message: "处理步骤 {{stepId}} 完成"
    data: "{{stepContext}}"
```

4. **延迟执行 (delay)**：

```yaml
action: "delay"
input:
    milliseconds: 1000
    reason: "等待外部服务响应"
```

5. **数据转换 (transform)**：

```yaml
action: "transform"
input:
    source: "{{steps.getData.output}}"
    mapping:
        id: "data.user.id"
        name: "data.user.profile.name"
        preferences: "data.settings"
```

6. **错误抛出 (error)**：

```yaml
action: "error"
input:
    message: "业务逻辑验证失败"
    code: "VALIDATION_ERROR"
    details: "{{validationErrors}}"
```

#### 2.4 循环步骤 (loop)

**用途**：循环执行一组步骤，支持数组迭代和条件循环。

```yaml
- id: "process_file_list"
  name: "批量处理文件"
  type: "loop"
  description: "循环处理上传的文件列表"

  # 迭代配置
  iterator:
      source: "{{inputs.files}}" # 数据源
      variable: "currentFile" # 循环变量名
      index: "fileIndex" # 索引变量名（可选）
      limit: 100 # 最大迭代次数（可选）

  # 循环体步骤
  steps:
      - id: "validate_file"
        type: "condition"
        condition:
            field: "{{currentFile.name}}"
            operator: "matches"
            value: "\\.(jpg|png|gif|bmp|webp)$"
        onFalse:
            - id: "skip_file"
              type: "builtin"
              action: "log"
              input:
                  level: "warn"
                  message: "跳过非图片文件: {{currentFile.name}}"

      - id: "process_image"
        type: "action"
        service: "maliang"
        action: "processImage"
        input:
            file: "{{currentFile}}"
            options: "{{inputs.processOptions}}"
        dependsOn: ["validate_file"]

  # 循环控制
  breakCondition: # 退出条件（可选）
      operator: "gte"
      value: "{{loopContext.errorCount}}"
      test: 5

  continueCondition: # 继续条件（可选）
      operator: "lt"
      value: "{{loopContext.processedCount}}"
      test: "{{inputs.maxFiles || 1000}}"

  # 并发控制
  parallel: false # 是否并行执行
  concurrency: 4 # 并发数量（parallel为true时）

  # 错误处理
  onError:
      type: "continue" # continue, break, fail
      maxErrors: 3 # 最大错误数
```

**循环上下文变量**：

- `loopContext.index`: 当前迭代索引
- `loopContext.total`: 总迭代次数
- `loopContext.processedCount`: 已处理数量
- `loopContext.errorCount`: 错误数量
- `loopContext.isFirst`: 是否首次迭代
- `loopContext.isLast`: 是否最后一次迭代

#### 2.5 并行步骤 (parallel)

**用途**：并行执行多个独立的步骤分支。

```yaml
- id: "parallel_processing"
  name: "并行数据处理"
  type: "parallel"
  description: "同时执行多个独立的数据处理任务"

  # 并行分支
  branches:
      - name: "generate_thumbnail"
        steps:
            - id: "create_thumb"
              type: "action"
              service: "maliang"
              action: "generateThumbnail"
              input:
                  source: "{{inputs.imageFile}}"
                  size: 200

      - name: "extract_metadata"
        steps:
            - id: "read_exif"
              type: "action"
              service: "qianliyan"
              action: "extractMetadata"
              input:
                  file: "{{inputs.imageFile}}"

      - name: "detect_faces"
        steps:
            - id: "face_detection"
              type: "action"
              service: "tianshu"
              action: "detectFaces"
              input:
                  image: "{{inputs.imageFile}}"

  # 并发控制
  maxConcurrency: 3 # 最大并发分支数
  timeout: 30000 # 总超时时间

  # 完成策略
  waitFor: "all" # all, any, majority
  failOn: "any" # any, all, majority

  # 结果合并
  mergeStrategy: "object" # object, array, first
  output:
      thumbnail: "branches.generate_thumbnail.create_thumb.output"
      metadata: "branches.extract_metadata.read_exif.output"
      faces: "branches.detect_faces.face_detection.output"
```

### 3. 模板语法规范

#### 3.1 变量引用

```yaml
# 基本变量引用
value: "{{inputs.userName}}"
value: "{{variables.processCount}}"
value: "{{steps.getData.output.result}}"

# 默认值语法
value: "{{inputs.optionalField || 'default_value'}}"
value: "{{steps.getData.output.name || '未知用户'}}"

# 嵌套属性访问
value: "{{inputs.user.profile.preferences.theme}}"
value: "{{steps.getUser.output.data[0].name}}"
```

#### 3.2 表达式语法

```yaml
# 数学运算
value: "{{variables.count + 1}}"
value: "{{inputs.price * 0.8}}"

# 字符串操作
value: "{{inputs.name.toUpperCase()}}"
value: "{{inputs.email.split('@')[1]}}"

# 日期时间
value: "{{Date.now()}}"
value: "{{new Date().toISOString()}}"

# 条件表达式
value: "{{inputs.type === 'admin' ? 'full_access' : 'limited_access'}}"

# 数组操作
value: "{{inputs.files.length}}"
value: "{{inputs.tags.join(', ')}}"
```

#### 3.3 函数调用

```yaml
# 内置函数
value: "{{uuid()}}"                        # 生成UUID
value: "{{timestamp()}}"                   # 当前时间戳
value: "{{hash(inputs.data)}}"             # 数据哈希
value: "{{base64(inputs.text)}}"           # Base64编码
value: "{{json(inputs.object)}}"           # JSON序列化

# 自定义函数（引擎提供）
value: "{{formatDate(inputs.date, 'YYYY-MM-DD')}}"
value: "{{validateEmail(inputs.email)}}"
```

### 4. 依赖管理

#### 4.1 步骤依赖

```yaml
steps:
    - id: "step_a"
      type: "action"
      # ... 步骤定义

    - id: "step_b"
      type: "action"
      dependsOn: ["step_a"] # 单个依赖
      # ... 步骤定义

    - id: "step_c"
      type: "action"
      dependsOn: ["step_a", "step_b"] # 多个依赖
      # ... 步骤定义
```

#### 4.2 条件依赖

```yaml
- id: "conditional_step"
  type: "action"
  dependsOn: ["validation"]
  condition:
      field: "{{steps.validation.output.success}}"
      operator: "eq"
      value: true
  # 只有在validation成功时才执行
```

#### 4.3 动态依赖

```yaml
- id: "dynamic_step"
  type: "action"
  dependsOn: "{{inputs.enableAdvanced ? ['advanced_validation'] : ['basic_validation']}}"
```

### 5. 错误处理规范

#### 5.1 步骤级错误处理

```yaml
- id: "risky_operation"
  type: "action"
  service: "external_api"
  action: "call"
  onError:
      type: "retry"
      maxRetries: 3
      backoff: "exponential" # linear, exponential, fixed
      delay: 1000 # 初始延迟
      multiplier: 2 # 退避倍数
      fallback:
          - id: "log_failure"
            type: "builtin"
            action: "log"
            input:
                level: "error"
                message: "外部API调用失败"
          - id: "return_default"
            type: "builtin"
            action: "return"
            input:
                success: false
                data: null
                error: "{{error.message}}"
```

#### 5.2 工作流级错误处理

```yaml
error_handling:
    timeout_error:
        type: "graceful_failure"
        response:
            success: false
            error: "工作流执行超时"
            timeout: true

    validation_error:
        type: "return_error"
        response:
            success: false
            error: "输入数据验证失败"
            validation_errors: "{{error.details}}"

    system_error:
        type: "escalate"
        notify: ["admin@example.com"]
        response:
            success: false
            error: "系统内部错误"
            incident_id: "{{generateIncidentId()}}"
```

### 6. 性能和资源控制

#### 6.1 超时配置

```yaml
# 工作流级超时
timeout: 60000 # 60秒

# 步骤级超时
steps:
    - id: "slow_operation"
      timeout: 30000 # 30秒
      type: "action"
      service: "heavy_processor"
```

#### 6.2 并发控制

```yaml
# 全局并发限制
maxConcurrentSteps: 5

# 步骤组并发控制
- id: "batch_process"
  type: "parallel"
  maxConcurrency: 3
  branches:
    # 并行分支定义
```

#### 6.3 资源限制

```yaml
# 工作流资源配置
resources:
  memory: "512MB"
  cpu: "0.5"
  storage: "1GB"
  network: "limited"

# 步骤资源配置
- id: "memory_intensive"
  type: "action"
  resources:
    memory: "1GB"
    priority: "high"
```

## 验证和工具支持

### 1. 语法验证器

天枢引擎使用 `@zouwu-wf/workflow` 提供的 `WorkflowValidator` 进行验证。根据 **RFC 0037** 的双阶段验证策略，天枢通过自定义上下文进行扩展：

```typescript
// 天枢特定的验证上下文扩展示例
const tianshuValidationOptions = {
    supportedServices: ["wenchang", "maliang", "qianliyan", "tianshu", "taiyi"],
    supportedBuiltinActions: ["return", "setVariable", "log", "delay", "transform", "error"],
    extensionSchema: tianshuExtensionSchema, // 包含天枢特有的步骤属性验证
};
```

验证器在执行前会进行：

1. **Schema 验证**: 基础 DSL 结构校验。
2. **天枢上下文校验**: 检查调用服务是否在天枢支持列表中。
3. **深度语义检查**: 步骤 ID 唯一性、依赖图有效性、模板变量路径合法性。

### 2. 开发工具

```yaml
# 工作流元数据用于开发工具
metadata:
    editor:
        autoComplete: true
        syntax: "tianshu-workflow-1.0"
    linter:
        rules: ["no-unused-variables", "required-descriptions"]
    debugger:
        breakpoints: ["step_validation", "error_handler"]
```

### 3. 测试支持

```yaml
# 测试配置
testing:
    mocks:
        wenchang:
            getCurrentSnapshot:
                success: true
                data: { /* 模拟数据 */ }

    scenarios:
        - name: "successful_update"
          inputs: { /* 测试输入 */ }
          expected: { /* 预期输出 */ }

        - name: "validation_failure"
          inputs: { /* 错误输入 */ }
          expectedError: "VALIDATION_ERROR"
```

## 实施指南

### 1. 迁移策略

1. **向后兼容**：支持现有工作流格式，提供自动转换工具
2. **渐进迁移**：分批次迁移现有工作流到新格式
3. **验证工具**：提供语法检查和最佳实践建议

### 2. 最佳实践

1. **命名规范**：使用描述性的ID和名称
2. **文档化**：为每个步骤提供清晰的描述
3. **错误处理**：为关键步骤添加适当的错误处理
4. **性能考虑**：合理设置超时和并发限制

### 3. 调试支持

```yaml
# 调试配置
debug:
    enabled: true
    logLevel: "debug"
    traceSteps: true
    breakpoints: ["error_handler"]
    variables: ["user_input", "processing_result"]
```

## 扩展性设计

### 1. 自定义步骤类型

```yaml
# 插件步骤类型
- id: "custom_ai_process"
  type: "ai_plugin" # 自定义类型
  plugin: "openai_gpt"
  config:
      model: "gpt-4"
      temperature: 0.7
  input:
      prompt: "分析这个图片: {{inputs.imageUrl}}"
```

### 2. 工作流组合

```yaml
# 子工作流调用
- id: "call_subworkflow"
  type: "workflow"
  workflowId: "image_processing_pipeline"
  input:
      image: "{{inputs.sourceImage}}"
      options: "{{inputs.processOptions}}"
```

### 3. 动态工作流生成

```yaml
# AI生成的工作流片段
ai_generated:
    intent: "process user uploaded photos"
    confidence: 0.95
    steps:
        # AI生成的步骤定义
```

## 未来发展

### 1. AI集成路线图

- **阶段1**：基于意图的工作流匹配
- **阶段2**：动态工作流参数调整
- **阶段3**：完全自动化的工作流生成

### 2. 高级特性

- **可视化编辑器**：图形化工作流设计界面
- **版本控制**：工作流版本管理和回滚
- **性能分析**：执行时间和资源使用分析
- **A/B测试**：工作流变体对比测试

## 结论

本RFC定义了天枢工作流的完整语法规范，为构建强大、灵活、可扩展的工作流系统提供了坚实的基础。通过标准化的语法和清晰的语义定义，系统能够：

1. **支持复杂的业务逻辑描述**
2. **为AI集成提供可解析的结构**
3. **确保工作流的正确性和可维护性**
4. **提供强大的调试和开发工具支持**

这种设计将为天枢引擎的长期发展和AI驱动的自动化奠定重要基础。

## 参考文档

- RFC 0037: 驺吾(Zouwu)工作流DSL规范
- RFC 0038: 偏好设置工作流集成
- GitHub Actions Workflow Syntax
- AWS Step Functions State Language
- Apache Airflow DAG Definition

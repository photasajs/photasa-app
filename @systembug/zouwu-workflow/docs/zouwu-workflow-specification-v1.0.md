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

## 语法规范 v1.0

### 1. 驺吾工作流文件结构

```yaml
# ===== 驺吾元数据 =====
id: "workflow_unique_identifier"              # 必需：工作流唯一标识符
name: "驺吾工作流名称"                         # 必需：人类可读的名称
description: "工作流功能详细描述"               # 可选：功能说明
version: "1.0.0"                              # 必需：语义版本号
author: "作者名称"                             # 可选：创建者
createdAt: 1727544000000                      # 可选：创建时间戳
updatedAt: 1727544000000                      # 可选：最后更新时间

# ===== 触发器定义 =====
triggers:                                    # 可选：工作流触发条件
  - intent: "workflow_intent"                # 意图标识符
  - event: "zouwu_awakens"                   # 事件触发
  - schedule: "0 */6 * * *"                  # 定时触发（cron格式）

# ===== 输入输出规范 =====
inputs:                                      # 可选：输入参数定义
  paramName:                                 # 参数名作为键
    type: "string|number|boolean|object|array" # 数据类型
    required: true                          # 是否必需
    description: "参数描述"                  # 参数说明
    default: "默认值"                        # 默认值
    validation:                              # 验证规则
      pattern: "^[a-z]+$"
      min: 0
      max: 100

outputs:                                     # 可选：输出结果定义
  resultName:                                # 输出名作为键
    type: "string|number|boolean|object|array"
    description: "输出描述"

# ===== 全局变量 =====
variables:                                   # 可选：工作流级变量
  requestId: "{{uuid()}}"
  timestamp: "{{Date.now()}}"
  maxRetries: 3

# ===== 驺吾五彩步骤 =====
colors:                                      # 驺吾特色：五彩步骤（兼容steps）
  - id: "step_unique_id"                    # 必需：步骤唯一标识
    name: "步骤显示名称"                     # 可选：人类可读名称
    color: blue|red|yellow|white|black      # 驺吾特色：颜色映射
    type: condition|action|builtin|parallel|loop # 步骤类型
    description: "步骤描述"                  # 可选：功能说明

    # 驺吾特性
    guardian:                                # 守护特性
      gentle: true                          # 温和模式
      safe: true                            # 安全保护

    benevolent:                             # 仁德特性
      nonDestructive: true                  # 非破坏性
      preserveOriginal: true                # 保留原始数据

    wings:                                  # 双翼特性（并行专用）
      left: "left_branch"
      right: "right_branch"

    tail:                                   # 长尾特性（链式专用）
      long: true
      graceful: true

# ===== 传统steps兼容 =====
steps:                                       # 传统格式（与colors互斥）
  - # 标准步骤定义

# ===== 驺吾特性配置 =====
zouwu:                                       # 驺吾专属配置
  benevolence: true                         # 启用仁德模式
  fiveColors: true                          # 启用五彩步骤
  guardian: true                            # 启用守护模式
  preserveData: true                        # 不食活物（保护数据）
  tailLength: "long|medium|short"           # 长尾特性级别

# ===== 错误处理 =====
error_handling:                             # 可选：全局错误处理
  default:
    type: "gentle_recovery"                 # 驺吾特色：温和恢复
    response:
      success: false
      message: "驺吾温和地处理了异常"

# ===== 工作流配置 =====
enabled: true                               # 可选：是否启用
timeout: 30000                              # 可选：超时时间（毫秒）
priority: "user"                            # 可选：优先级
retryOnFailure: true                        # 可选：失败时重试
maxRetries: 2                               # 可选：最大重试次数
tags: ["zouwu", "workflow"]                 # 可选：标签分类
```

### 2. 驺吾五彩步骤类型

#### 2.1 青色步骤 (Blue - Condition)

条件判断步骤，驺吾以仁德之心进行判断：

```yaml
- id: "guardian_check"
  name: "驺吾守护检查"
  color: blue                               # 青色标识
  type: "condition"
  condition:
    field: "{{inputs.data}}"
    operator: "eq|ne|gt|gte|lt|lte|in|nin|exists|matches|and|or"
    value: "expected_value"
  guardian:                                 # 驺吾守护特性
    gentle: true
    safe: true
  onTrue:
    - # 条件为真时执行的步骤
  onFalse:
    - # 条件为假时执行的步骤
```

#### 2.2 赤色步骤 (Red - Action)

动作执行步骤，驺吾温和地执行外部服务调用：

```yaml
- id: "benevolent_action"
  name: "驺吾仁德处理"
  color: red                                # 赤色标识
  type: "action"
  service: "wenchang|taiyi|qianliyan|maliang"
  action: "methodName"
  benevolent:                               # 仁德特性
    nonDestructive: true
    preserveOriginal: true
  input:
    param: "{{inputs.data}}"
  output:
    result: "result"
  output_schema:                            # 输出模式定义
    result:
      type: object
```

#### 2.3 黄色步骤 (Yellow - Builtin)

内置操作步骤，驺吾的基础能力：

```yaml
- id: "gentle_log"
  name: "驺吾记录"
  color: yellow                             # 黄色标识
  type: "builtin"
  action: "return|setVariable|log|delay|transform|error"
  input:
    level: "info"
    message: "🎨 驺吾五彩处理中..."
```

#### 2.4 白色步骤 (White - Parallel)

并行处理步骤，驺吾展开双翼：

```yaml
- id: "dual_wings"
  name: "驺吾双翼"
  color: white                              # 白色标识
  type: "parallel"
  wings:                                    # 双翼配置
    left: "validation"
    right: "transformation"
  branches:
    - name: "validation"
      steps:
        - # 左翼步骤
    - name: "transformation"
      steps:
        - # 右翼步骤
  waitFor: "all|any|majority"
  failOn: "any|all|majority"
```

#### 2.5 玄色步骤 (Black - Loop)

循环处理步骤，驺吾长尾递归：

```yaml
- id: "tail_recursion"
  name: "驺吾长尾"
  color: black                              # 玄色标识
  type: "loop"
  tail:                                      # 长尾特性
    long: true
    graceful: true
  iterator:
    source: "{{inputs.array}}"
    variable: "item"
    index: "index"
  steps:
    - # 循环体步骤
  breakCondition:
    operator: "gte"
    value: "{{index}}"
    test: 10
```

### 3. 模板语法规范

#### 3.1 变量引用

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

#### 3.2 驺吾内置函数

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

### 4. 依赖管理

```yaml
colors:
  - id: "step_a"
    # 步骤定义

  - id: "step_b"
    dependsOn: ["step_a"]                  # 单个依赖

  - id: "step_c"
    dependsOn: ["step_a", "step_b"]        # 多个依赖
```

### 5. 错误处理规范

#### 5.1 驺吾仁德错误处理

```yaml
error_handling:
  validation_error:
    type: "benevolent_failure"              # 仁德失败
    response:
      success: false
      error: "驺吾检测到验证未通过"
      guardian: "zouwu_protected"

  engine_error:
    type: "gentle_retry"                    # 温和重试
    maxRetries: 3
    backoff: "linear"
    delay: 1000
```

### 6. 驺吾特性配置

```yaml
zouwu:
  # 核心特性
  benevolence: true                         # 仁德模式
  fiveColors: true                          # 五彩架构
  guardian: true                            # 守护模式

  # 行为配置
  preserveData: true                        # 不食活物
  gentleErrors: true                        # 温和错误
  safeMode: true                           # 安全模式

  # 性能配置
  tailLength: "long"                        # 长尾级别
  wingSpan: "wide"                         # 双翼展开度
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

## 参考文档

- RFC 0039: 天枢工作流语法规范（基础）
- 山海经·驺吾传说（文化背景）
- YAML 1.2 规范（语法基础）
# RFC-0055: Taiyi Workflow Specification

## 元数据

- **状态**: 草案
- **创建日期**: 2025-11-16
- **作者**: System
- **相关RFC**:
  - RFC-0037: Tianshu YAML Workflow DSL
  - RFC-0039: Tianshu Workflow Syntax Specification
  - RFC-0050: Taiyi Workflow Engine（引擎架构）
  - RFC-0048: Scan Orchestration Business Logic Migration
  - RFC-0042: Reactive Store Automation

## 执行摘要

本 RFC 定义 Picasa 应用中所有 Taiyi 工作流的详细规范，包括 YAML 语法、输入输出定义、步骤配置、依赖管理和测试要求。这是工作流开发的权威参考文档。

**重要区分**：
- **RFC-0050**：定义 Taiyi 引擎的架构（适配器、注册、IPC）
- **RFC-0055**（本文档）：定义所有工作流的规范和文档

## 1. 工作流 YAML 语法规范

### 1.1 基础结构

```yaml
# 工作流元数据
id: "workflow_id"                # 必需：工作流唯一标识符
name: "工作流名称"                # 必需：人类可读的名称
description: "工作流描述"         # 必需：功能描述
version: "1.0.0"                 # 必需：语义化版本号

# 输入定义
inputs:
  param_name:
    type: "string|number|boolean|array|object"  # 必需：参数类型
    required: true|false                         # 必需：是否必需
    default: value                               # 可选：默认值
    description: "参数描述"                      # 必需：参数说明

# 工作流步骤
steps:
  - id: "step_id"                # 必需：步骤唯一标识符
    name: "步骤名称"              # 必需：步骤描述
    type: "action|builtin"       # 必需：步骤类型
    service: "service_name"      # action类型必需：服务名称
    action: "method_name"        # 必需：操作名称
    input:                       # 必需：输入参数
      key: "{{expression}}"      # 支持表达式插值
    output_schema:               # 可选：输出模式定义
      type: type_definition
    dependsOn: ["step_id"]       # 可选：依赖的步骤列表

# 输出定义
outputs:
  output_name:
    description: "输出描述"       # 必需：输出说明
    type: "type"                 # 必需：输出类型
    path: "path.to.value"        # 必需：输出路径
```

### 1.2 表达式语法

工作流支持以下表达式：

```yaml
# 输入参数引用
"{{inputs.param_name}}"

# 步骤输出引用（扁平化数据，不需要.result）
"{{steps.step_id}}"              # 直接引用步骤输出
"{{steps.step_id.field}}"        # 引用输出字段

# 内置函数
"{{now()}}"                      # 当前时间戳
```

### 1.3 步骤类型

#### 1.3.1 action 类型

调用外部服务方法：

```yaml
- id: "call_engine"
  type: "action"
  service: "taiyi"              # 服务名称
  action: "callEngine"          # 方法名称
  input:
    engineName: "qianliyan"     # 引擎名称
    methodName: "restoreQueue"  # 引擎方法
    params: []                  # 方法参数
```

#### 1.3.2 builtin 类型

调用内置操作（由 BuiltinAdapter 提供）：

```yaml
- id: "return_result"
  type: "builtin"
  action: "return"              # 内置操作名称
  input:
    success: true
    data: "{{steps.previous}}"
```

### 1.4 依赖管理

```yaml
steps:
  - id: "step1"
    # ...

  - id: "step2"
    dependsOn: ["step1"]        # 单个依赖
    # ...

  - id: "step3"
    dependsOn: ["step1", "step2"]  # 多个依赖
    # ...
```

### 1.5 输出模式定义

```yaml
output_schema:
  type: array                   # 基础类型：string, number, boolean, array, object
  items:                        # array 类型的元素定义
    type: object
    properties:
      field1:
        type: string
      field2:
        type: number
```

**关键原则**：
- `output_schema` 定义步骤的**原始返回值**类型
- Taiyi 服务会自动扁平化数据（提取 `result` 字段）
- 后续步骤直接使用 `{{steps.step_id}}` 访问

## 2. 工作流分类与清单

### 2.1 扫描工作流（Scan Workflows）

位置：`src/engines/tianshu/workflows/scan/`

| 工作流 ID | 文件 | 用途 | 测试覆盖 |
|-----------|------|------|----------|
| `add_scan_action` | add_scan_action.yml | 添加扫描任务到队列 | ✅ 已覆盖 |
| `remove_scan_action` | remove_scan_action.yml | 从队列移除扫描任务 | ✅ 已覆盖 |
| `get_scanning_queue` | get_scanning_queue.yml | 获取扫描队列快照 | ✅ 已覆盖 |
| `folder_scan` | folder_scan.yml | 执行文件夹扫描 | ❌ 待测试 |

### 2.2 偏好设置工作流（Preference Workflows）

位置：`src/engines/tianshu/workflows/preferences/`

| 工作流 ID | 文件 | 用途 | 测试覆盖 |
|-----------|------|------|----------|
| `get_preferences` | get_preferences.yml | 获取偏好设置 | ❌ 待测试 |
| `update_preferences` | update_preferences.yml | 更新偏好设置 | ❌ 待测试 |
| `reset_preferences` | reset_preferences.yml | 重置偏好设置 | ❌ 待测试 |
| `preference_management` | preference_management.yml | 偏好设置管理 | ❌ 待测试 |
| `import_preferences` | import_preferences.yml | 导入偏好设置 | ❌ 待测试 |
| `export_preferences` | export_preferences.yml | 导出偏好设置 | ❌ 待测试 |
| `get_history` | get_history.yml | 获取偏好设置历史 | ❌ 待测试 |
| `restore_revision` | restore_revision.yml | 恢复历史版本 | ❌ 待测试 |

### 2.3 应用状态工作流（AppState Workflows）

位置：`src/engines/tianshu/workflows/appstate/`

| 工作流 ID | 文件 | 用途 | 测试覆盖 |
|-----------|------|------|----------|
| `restore_app_state` | restore_app_state.yml | 恢复应用状态 | ❌ 待测试 |
| `switch_current_folder` | switch_current_folder.yml | 切换当前文件夹 | ❌ 待测试 |
| `update_folder_tree` | update_folder_tree.yml | 更新文件夹树 | ❌ 待测试 |

### 2.4 引擎工作流（Engine Workflows）

位置：`src/engines/tianshu/workflows/`

| 工作流 ID | 文件 | 用途 | 测试覆盖 |
|-----------|------|------|----------|
| `engine_status_check` | engine_status_check.yml | 检查引擎状态 | ❌ 待测试 |

## 3. 工作流详细规范

### 3.1 扫描工作流

#### 3.1.1 add_scan_action - 添加扫描任务

**文件**: `src/engines/tianshu/workflows/scan/add_scan_action.yml`

**用途**: 接收 ScanAction 数组，批量添加到扫描队列并持久化

**输入**:
```yaml
inputs:
  actions:                      # ScanAction 对象数组
    type: array
    required: true
    items:
      type: object
      properties:
        path: string            # 扫描路径
        action: string          # scan/rescan/current
        source: string          # user/auto
        timestamp: number       # 添加时间戳
```

**输出**:
```yaml
outputs:
  queue:                        # 完整扫描队列
    type: array
    path: "queue"
  queueSize:                    # 队列大小
    type: number
    path: "queueSize"
  persisted:                    # 是否已持久化
    type: boolean
    path: "persisted"
```

**执行流程**:
1. **restore_queue**: 从千里眼引擎恢复当前队列
2. **append_actions**: 使用 builtin.arrayConcat 合并队列
3. **persist_queue**: 通过千里眼引擎持久化队列
4. **calculate_size**: 使用 builtin.arrayCount 计算队列大小
5. **format_response**: 使用 builtin.return 返回结果

**关键设计**:
- ✅ 支持批量添加（数组输入）
- ✅ 自动持久化到 `~/.photasa/scan/scanning.json`
- ✅ 返回完整队列用于 Store 同步
- ✅ RFC 0042: 与 matter-sync.yml 的 `add_scan_action` 配合

**测试覆盖**: ✅ `yuchigong.test.ts` 已覆盖

**依赖服务**:
- 千里眼引擎（Qianliyan）: restoreQueue, persistQueue
- 内置操作（Builtin）: arrayConcat, arrayCount, return

---

#### 3.1.2 remove_scan_action - 移除扫描任务

**文件**: `src/engines/tianshu/workflows/scan/remove_scan_action.yml`

**用途**: 从扫描队列移除指定路径的任务并持久化

**输入**:
```yaml
inputs:
  path:                         # 要移除的路径
    type: string
    required: true
```

**输出**:
```yaml
outputs:
  queue:                        # 移除后的完整队列
    type: array
    path: "queue"
  queueSize:                    # 队列大小
    type: number
    path: "queueSize"
  persisted:                    # 是否已持久化
    type: boolean
    path: "persisted"
```

**执行流程**:
1. **restore_queue**: 从千里眼引擎恢复当前队列
2. **filter_action**: 使用 builtin.arrayFilter 过滤路径
3. **persist_queue**: 持久化更新后的队列
4. **calculate_size**: 计算新队列大小
5. **format_response**: 返回结果

**关键设计**:
- ✅ 使用 arrayFilter 操作符 `ne`（不等于）过滤
- ✅ 自动持久化变更
- ✅ RFC 0042: 与 matter-sync.yml 的 `remove_scan_action` 配合

**测试覆盖**: ✅ `yuchigong.test.ts` 已覆盖

---

#### 3.1.3 get_scanning_queue - 获取扫描队列

**文件**: `src/engines/tianshu/workflows/scan/get_scanning_queue.yml`

**用途**: 从千里眼引擎恢复扫描队列快照

**输入**:
```yaml
inputs:
  source:                       # 获取来源标识
    type: string
    required: false
    default: "startup"          # startup/manual/refresh
```

**输出**:
```yaml
outputs:
  success:                      # 是否成功
    type: boolean
  queue:                        # 扫描队列
    type: array
  queueSize:                    # 队列大小
    type: number
  source:                       # 获取来源
    type: string
```

**执行流程**:
1. **restore_queue**: 调用千里眼引擎 restoreQueue
2. **calculate_size**: 计算队列大小
3. **format_response**: 格式化返回（包含时间戳）

**关键设计**:
- ✅ 只读操作，不修改队列
- ✅ RFC 0042: 与 matter-sync.yml 的 `get_scanning_queue` 配合
- ✅ 启动时自动调用（source: "startup"）

**错误处理**:
```yaml
error_handling:
  engine_error:
    type: "return_error"
    response:
      success: false
      error: "千里眼引擎恢复队列失败"
      queue: []
```

**测试覆盖**: ✅ 启动流程测试已覆盖

---

#### 3.1.4 folder_scan - 文件夹扫描

**文件**: `src/engines/tianshu/workflows/scan/folder_scan.yml`

**用途**: 通过千里眼引擎执行文件夹扫描任务

**输入**:
```yaml
inputSchema:
  paths:                        # 扫描路径列表
    type: array
    items:
      type: string
  recursive:                    # 是否递归
    type: boolean
    default: true
  priority:                     # 优先级
    type: string
    enum: ["urgent", "normal", "background"]
    default: "normal"
  filters:                      # 过滤器
    type: object
    properties:
      includePatterns: array
      excludePatterns: array
```

**输出**:
```yaml
outputSchema:
  requestId:                    # 扫描请求ID
    type: string
  status:                       # 扫描状态
    type: string
  fileCount:                    # 文件数量
    type: number
```

**执行流程**:
1. **validate_paths**: 验证路径有效性
2. **execute_scan**: 执行扫描

**关键设计**:
- ✅ RFC 0032: 千里眼引擎集成
- ✅ 支持批量路径扫描
- ✅ 支持过滤器配置
- ⏱ 超时：300秒（5分钟）

**测试覆盖**: ❌ **待补充测试**

---

### 3.2 偏好设置工作流

（待补充详细规范，基于实际 YAML 文件）

### 3.3 应用状态工作流

（待补充详细规范，基于实际 YAML 文件）

## 4. 工作流开发指南

### 4.1 创建新工作流

**步骤**:
1. 在对应目录创建 YAML 文件
2. 定义 id、name、description、version
3. 定义 inputs（输入参数和验证）
4. 设计 steps（步骤序列和依赖）
5. 定义 outputs（输出映射）
6. 编写测试用例

**最佳实践**:
- ✅ 每个步骤单一职责
- ✅ 使用 builtin 操作简化逻辑
- ✅ 明确依赖关系（dependsOn）
- ✅ 提供清晰的错误处理

### 4.2 内置操作清单

由 BuiltinAdapter 提供的操作：

| 操作 | 用途 | 输入 | 输出 |
|------|------|------|------|
| `return` | 返回值 | 任意对象 | 原样返回 |
| `arrayConcat` | 合并数组 | array1, array2 | 合并后的数组 |
| `arrayFilter` | 过滤数组 | array, condition | 过滤后的数组 |
| `arrayCount` | 数组长度 | array | number |
| `set_variable` | 设置变量 | key, value | - |
| `log` | 日志输出 | message, level | - |
| `delay` | 延迟执行 | milliseconds | - |
| `conditional` | 条件分支 | condition, ifTrue, ifFalse | 条件结果 |
| `transform` | 数据转换 | data, transform | 转换后数据 |
| `noop` | 空操作 | - | - |

**arrayFilter 条件操作符**:
- `eq`: 等于
- `ne`: 不等于
- `gt`: 大于
- `lt`: 小于
- `contains`: 包含

### 4.3 命名规范

**工作流 ID**:
- 小写字母 + 下划线
- 动词_名词格式
- 示例：`add_scan_action`, `get_preferences`

**步骤 ID**:
- 小写字母 + 下划线
- 描述性名称
- 示例：`restore_queue`, `filter_action`, `format_response`

**输入/输出参数**:
- 驼峰命名法
- 示例：`queueSize`, `requestId`

### 4.4 数据扁平化原则

**Taiyi 服务的数据处理**:

```typescript
// 引擎返回的原始数据
{
  success: true,
  result: [...],        // ← 实际数据
  duration: 123
}

// TaiyiService 自动提取 result 字段
// 步骤输出直接就是 result 的值
{{steps.restore_queue}}  // 直接得到数组，不需要 .result
```

**YAML 中的表达式**:
```yaml
# ✅ 正确
"{{steps.restore_queue}}"

# ❌ 错误（多余的 .result）
"{{steps.restore_queue.result}}"
```

### 4.5 副作用操作处理

对于不返回值的操作（如 persistQueue）：

```yaml
- id: "persist_queue"
  type: "action"
  service: "taiyi"
  action: "callEngine"
  input:
    engineName: "qianliyan"
    methodName: "persistQueue"
    params: ["{{steps.append_actions}}"]
  # ✅ RFC 0045: 副作用操作不声明 output_schema
  # 成功完成即表示成功，失败抛出异常
  dependsOn: ["append_actions"]
```

## 5. 测试要求

### 5.1 测试覆盖标准

每个工作流必须有：

- ✅ **正常流程测试**: 验证标准输入产生预期输出
- ✅ **边界条件测试**: 空数组、单元素、大量元素
- ✅ **异常处理测试**: 无效输入、依赖失败
- ✅ **集成测试**: 验证与 Store 同步、持久化

### 5.2 测试文件组织

```
src/renderer/src/services/<service>/__tests__/
  ├── <service>.test.ts         # 服务单元测试
  └── workflow-integration.test.ts  # 工作流集成测试
```

### 5.3 测试用例模板

```typescript
describe('工作流: add_scan_action', () => {
  it('应该成功添加单个扫描任务', async () => {
    // Arrange: 准备输入
    const input = { actions: [{ path: '/test/path', action: 'scan' }] };

    // Act: 执行工作流
    const result = await executeWorkflow('add_scan_action', input);

    // Assert: 验证输出
    expect(result.success).toBe(true);
    expect(result.queue).toHaveLength(1);
    expect(result.persisted).toBe(true);
  });

  it('应该拒绝无效输入', async () => {
    // Arrange
    const input = { actions: [] };  // 空数组

    // Act & Assert
    await expect(
      executeWorkflow('add_scan_action', input)
    ).rejects.toThrow('actions 数组不能为空');
  });
});
```

## 6. Store 同步集成

### 6.1 同步配置

工作流输出通过 matter-sync.yml 自动同步到 Store：

**文件**: `src/renderer/src/services/fangxuanling/store-automation/matter-sync.yml`

```yaml
matters:
  add_scan_action:
    propertyPath: "queue"       # 从 response.data.queue 提取
    syncStrategy: "replace"     # 替换 store.queue
    storeName: "scanning"       # 目标 store
    autoSync: true              # 自动同步
```

### 6.2 同步策略

- **replace**: 完全替换（用于 get_scanning_queue）
- **merge**: 深度合并（用于 update_preferences）
- **patch**: 浅层合并

## 7. 错误处理规范

### 7.1 错误类型

- **validation_error**: 输入参数验证失败
- **engine_error**: 引擎调用失败
- **persistence_error**: 持久化失败
- **dependency_error**: 依赖步骤失败

### 7.2 错误响应格式

```yaml
error_handling:
  <error_type>:
    type: "return_error"
    response:
      success: false
      error: "错误消息"
      reason: "{{error.message}}"
      <fallback_data>: []       # 提供安全的回退数据
```

## 8. 性能考量

### 8.1 超时配置

```yaml
timeout: 10000                  # 10秒（默认）
priority: "normal"              # normal/high/low
```

### 8.2 依赖优化

- ✅ 无依赖步骤可并行执行
- ✅ 使用 dependsOn 明确串行依赖
- ✅ 避免不必要的中间步骤

## 9. 未来改进

### 9.1 待完成工作流

- ❌ folder_scan 测试覆盖
- ❌ 所有 preference 工作流的详细规范和测试
- ❌ 所有 appstate 工作流的详细规范和测试
- ❌ engine_status_check 工作流规范和测试

### 9.2 功能增强

- 🔲 工作流版本控制和兼容性管理
- 🔲 工作流执行历史和审计
- 🔲 动态工作流编排
- 🔲 工作流可视化编辑器

## 10. 参考资料

### 10.1 相关 RFC

- [RFC-0037: Tianshu YAML Workflow DSL](./0037-tianshu-yaml-workflow-dsl.md)
- [RFC-0039: Tianshu Workflow Syntax Specification](./0039-tianshu-workflow-syntax-specification.md)
- [RFC-0042: Reactive Store Automation](./completed/0042-reactive-store-automation.md)
- [RFC-0045: Builtin Array Operations](./completed/0045-builtin-array-operations.md)
- [RFC-0048: Scan Orchestration Business Logic Migration](./0048-scan-orchestration-business-logic-migration.md)
- [RFC-0050: Taiyi Workflow Engine](./0050-taiyi-workflow-engine.md)（引擎架构）

### 10.2 工作流文件位置

- 扫描工作流: `src/engines/tianshu/workflows/scan/`
- 偏好设置工作流: `src/engines/tianshu/workflows/preferences/`
- 应用状态工作流: `src/engines/tianshu/workflows/appstate/`
- 引擎工作流: `src/engines/tianshu/workflows/`

### 10.3 测试文件位置

- 尉迟恭服务测试: `src/renderer/src/services/yuchigong/__tests__/yuchigong.test.ts`
- 李世民路由测试: `src/renderer/src/services/lishimin/__tests__/router.test.ts`

## 11. 变更日志

- **2025-11-16**: 初始版本 - 定义工作流 YAML 规范和扫描工作流详细文档

---

**文档维护者**: Taiyi Workflow Development Team
**最后更新**: 2025-11-16
**文档版本**: 1.0.0

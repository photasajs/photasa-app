# RFC 0036: 天枢YAML工作流DSL规范

- **开始日期**: 2025-09-29
- **更新日期**: 2025-09-29
- **RFC PR**:
- **实现议题**:
- **作者**: Claude Code
- **状态**: 草案

## 摘要

本RFC定义天枢引擎YAML工作流描述语言(DSL)的完整规范，包括工作流格式、步骤类型分类、处理器分工和路由规则。解决当前YAML工作流执行中的步骤类型混乱和路由错误问题。

## 动机

当前天枢工作流系统存在以下问题：

1. **步骤类型处理混乱**：`condition`类型步骤被错误路由到`system`引擎
2. **内置操作缺失**：`builtin`操作如`return`没有对应的适配器处理
3. **路由规则不明确**：TaiyiService缺乏清晰的步骤分类和路由逻辑
4. **工作流格式不规范**：缺乏标准化的YAML格式定义

需要建立清晰的工作流DSL规范，明确各类步骤的处理方式和路由规则。

## 详细设计

### 工作流基础结构

```yaml
# 工作流元数据
id: "workflow_identifier"
name: "工作流显示名称"
description: "工作流功能描述"
version: "1.0.0"
author: "作者"
createdAt: 1727544000000
updatedAt: 1727544000000

# 输入输出schema
inputSchema:
  type: "object"
  properties:
    # 输入参数定义

outputSchema:
  type: "object"
  properties:
    # 输出参数定义

# 工作流步骤
steps:
  - # 步骤定义列表

# 错误处理
onError:
  - # 错误处理步骤

# 工作流配置
enabled: true
timeout: 30000
retryOnError: true
maxRetries: 2
tags: ["tag1", "tag2"]
```

### 步骤类型分类

#### 1. 条件步骤 (condition)

**用途**：内置条件判断，不路由到外部引擎

```yaml
- id: "validate_input"
  name: "验证输入参数"
  type: "condition"
  description: "检查输入参数是否有效"
  condition:
    field: "input.action"
    operator: "in" # eq, ne, in, gt, lt, exists, matches
    value: ["get", "update", "reset"]
  # 可选：条件不满足时的处理
  onFalse:
    action: "skip" # skip, error, goto
    message: "无效的操作类型"
```

**处理方式**：由TianshuEngine内置条件处理器执行，不经过TaiyiService路由。

#### 2. 动作步骤 (action)

**用途**：调用外部引擎执行业务逻辑

```yaml
- id: "get_preferences"
  name: "获取用户偏好"
  type: "action"
  description: "通过文昌引擎获取当前偏好快照"
  service: "taiyi"  # 路由目标
  action: "callEngine"  # 调用方法
  input:
    engineName: "wenchang"
    methodName: "getCurrentSnapshot"
    args: []
  output:
    snapshot: "result.result"
    success: "result.success"
  dependsOn: ["validate_input"]
  timeout: 10000
  retryOnFailure: true
  maxRetries: 3
  ignoreError: false
```

**路由规则**：
- `service: "taiyi"` + `action: "callEngine"` → 太乙路由模式
- `service: "engineName"` + `action: "methodName"` → 直接引擎调用
- `service: "builtin"` + `action: "operationName"` → 内置操作

#### 3. 内置操作步骤 (builtin)

**用途**：执行内置操作，如返回结果、设置变量等

```yaml
- id: "return_result"
  name: "返回处理结果"
  type: "builtin"  # 明确标识为内置操作
  action: "return"  # 内置操作类型
  input:
    success: true
    data: "${step.get_preferences.output.snapshot}"
    message: "操作完成"
  condition:
    field: "input.action"
    operator: "eq"
    value: "get"
```

**内置操作类型**：
- `return`: 返回工作流结果
- `setVariable`: 设置工作流变量
- `log`: 记录日志信息
- `delay`: 延迟执行
- `noop`: 空操作（用于流程控制）

#### 4. 循环步骤 (loop)

**用途**：循环执行一组步骤

```yaml
- id: "process_files"
  name: "批量处理文件"
  type: "loop"
  description: "循环处理文件列表"
  iterator:
    source: "input.files"  # 数据源
    variable: "currentFile"  # 循环变量名
  steps:
    - id: "process_single_file"
      type: "action"
      service: "maliang"
      action: "processImage"
      input:
        file: "${currentFile}"
  condition:
    # 可选：循环终止条件
    field: "loopContext.processedCount"
    operator: "lt"
    value: 100
```

### TaiyiService路由逻辑

```typescript
async executeAction(step: WorkflowStep, context: ExecutionContext): Promise<StepExecutionResult> {
    // 步骤类型分发
    switch (step.type) {
        case "condition":
            // 错误：条件步骤不应该到达TaiyiService
            throw new Error(`Condition steps should be handled by TianshuEngine, not TaiyiService: ${step.id}`);

        case "loop":
            // 错误：循环步骤不应该到达TaiyiService
            throw new Error(`Loop steps should be handled by TianshuEngine, not TaiyiService: ${step.id}`);

        case "builtin":
            // 内置操作：路由到builtin适配器
            return this.routeToBuiltin(step, context);

        case "action":
            // 动作步骤：根据service字段路由
            return this.routeToEngine(step, context);

        default:
            throw new Error(`Unknown step type: ${step.type} in step ${step.id}`);
    }
}

private async routeToEngine(step: WorkflowStep, context: ExecutionContext): Promise<StepExecutionResult> {
    if (step.service === "taiyi" && step.action === "callEngine") {
        // 太乙路由模式
        const engineName = step.input?.engineName || "system";
        const methodName = step.input?.methodName || "execute";
        const args = step.input?.args || [step.input];

        return await this.engine.callEngine(engineName, methodName, ...args);
    } else {
        // 直接引擎调用
        const engineName = step.service || "system";
        const methodName = step.action || "execute";
        const args = step.input ? [step.input] : [];

        return await this.engine.callEngine(engineName, methodName, ...args);
    }
}

private async routeToBuiltin(step: WorkflowStep, context: ExecutionContext): Promise<StepExecutionResult> {
    // 路由到builtin适配器
    return await this.engine.callEngine("builtin", step.action || "unknown", step.input || {});
}
```

### TianshuEngine内置处理器

```typescript
class TianshuEngine {
    private async executeStep(step: WorkflowStep, context: ExecutionContext): Promise<StepResult> {
        switch (step.type) {
            case "condition":
                return this.executeCondition(step, context);

            case "loop":
                return this.executeLoop(step, context);

            case "action":
            case "builtin":
                // 委托给TaiyiService处理
                return this.stepExecutor.executeAction(step, context);

            default:
                throw new Error(`Unsupported step type: ${step.type}`);
        }
    }

    private async executeCondition(step: WorkflowStep, context: ExecutionContext): Promise<StepResult> {
        const condition = step.condition;
        const result = this.evaluateCondition(condition, context);

        return {
            stepId: step.id,
            status: "completed",
            output: { conditionResult: result },
            // 如果条件为false且有onFalse配置，处理相应逻辑
        };
    }
}
```

### Builtin适配器实现

```typescript
@Adapter({
    name: "builtin",
    displayName: "内置操作适配器",
    priority: AdapterPriority.Highest,
    description: "处理工作流内置操作，如return、setVariable等",
    engineType: "builtin",
    dependencies: [],
})
export class BuiltinAdapter implements IAdapter {
    readonly name = "builtin";

    async initialize(): Promise<void> {
        // 无需初始化
    }

    async shutdown(): Promise<void> {
        // 无需清理
    }

    // 内置操作方法
    async return(data: any): Promise<any> {
        return data;
    }

    async setVariable(params: { name: string; value: any }): Promise<void> {
        // 设置工作流变量（通过context传递）
    }

    async log(params: { level: string; message: string }): Promise<void> {
        // 记录日志
        console.log(`[Workflow] ${params.level}: ${params.message}`);
    }

    async delay(params: { milliseconds: number }): Promise<void> {
        await new Promise(resolve => setTimeout(resolve, params.milliseconds));
    }

    async noop(): Promise<void> {
        // 空操作
    }
}
```

## 优点

1. **类型安全**：明确的步骤类型分类避免路由混乱
2. **职责清晰**：内置处理器vs引擎路由职责分离
3. **扩展性强**：支持新的步骤类型和内置操作
4. **调试友好**：清晰的错误信息和路由追踪
5. **标准化**：统一的YAML格式规范

## 缺点

1. **复杂度增加**：需要理解多种步骤类型和路由规则
2. **向后兼容**：现有工作流可能需要调整格式
3. **维护成本**：需要维护内置处理器和适配器

## 替代方案

1. **统一路由模式**：所有步骤都通过TaiyiService路由
   - 优点：实现简单
   - 缺点：条件判断等内置操作也需要适配器，过度复杂

2. **纯DSL模式**：使用更复杂的DSL语法
   - 优点：表达能力强
   - 缺点：学习成本高，可读性差

## 实施计划

### Phase 1: 规范定义与验证 (1天)
- [ ] 完善RFC文档，定义详细的YAML格式规范
- [ ] 创建示例工作流，验证格式合理性
- [ ] 与现有工作流对比，确定迁移策略

### Phase 2: 内置处理器实现 (2天)
- [ ] 在TianshuEngine中实现条件和循环处理器
- [ ] 创建BuiltinAdapter实现常用内置操作
- [ ] 确保适配器正确注册到AdapterRegistry

### Phase 3: 路由逻辑修复 (1天)
- [ ] 修复TaiyiService的executeAction方法
- [ ] 实现正确的步骤类型分发逻辑
- [ ] 添加详细的错误信息和调试日志

### Phase 4: 测试验证 (1天)
- [ ] 创建单元测试覆盖所有步骤类型
- [ ] 端到端测试验证工作流执行
- [ ] 迁移现有工作流到新格式

### Phase 5: 文档和工具 (1天)
- [ ] 更新开发文档和API文档
- [ ] 创建工作流格式验证工具
- [ ] 提供迁移指南和最佳实践

## 未解决问题

1. 现有工作流的迁移策略和时间计划
2. 复杂条件表达式的语法设计
3. 循环步骤的性能优化和错误处理
4. 工作流版本控制和向后兼容性

## 参考文献

- RFC 0035: 天枢·顺风耳·千里眼·司簿·马良五引擎编排架构
- GitHub Actions Workflow Syntax
- Apache Airflow DAG Definition
- AWS Step Functions State Language
# RFC 0050: 太乙(Taiyi) - 工作流适配器与执行引擎

## 元数据

- **状态**: 活跃
- **创建日期**: 2024-12-19
- **更新日期**: 2025-12-24
- **作者**: System
- **相关RFC**:
    - RFC 0037: 驺吾工作流DSL规范
    - RFC 0048: 扫描编排业务逻辑迁移

## 摘要

太乙(太乙真人)是Picasa中基于适配器模式的工作流执行引擎。它通过将工作流步骤路由到适当的服务适配器，为执行驺吾DSL定义的工作流提供统一接口。太乙充当声明式驺吾工作流和命令式服务实现之间的桥梁。

## 背景与动机

Picasa需要一个灵活的系统来执行各种类型的工作流：

- 文件扫描工作流
- 偏好设置管理工作流
- 数据同步工作流
- 导入/导出工作流

太乙提供了以下能力，而不是在每个服务中实现工作流逻辑：

1. **统一执行接口**: 所有工作流的单一入口点
2. **适配器模式**: 不同服务的可插拔适配器
3. **关注点分离**: 工作流定义(驺吾)与执行(太乙)分离
4. **类型安全**: 完整的TypeScript类型检查

## 设计目标

1. **模块化**: 基于适配器的架构实现松耦合
2. **可扩展性**: 易于添加新适配器
3. **类型安全**: TypeScript确保编译时安全
4. **统一接口**: 一致的工作流执行API
5. **可测试性**: 支持单元测试和集成测试

## 架构

### 核心组件

#### 1. TaiyiEngine (太乙引擎)

**位置**: `src/engines/taiyi/core/TaiyiEngine.ts`

核心引擎负责：

- 管理适配器注册表
- 将工作流步骤路由到适配器
- 执行工作流
- 管理执行生命周期

**关键方法**:

```typescript
class TaiyiEngine {
    // 初始化适配器
    async initialize(): Promise<void>;

    // 调用适配器方法
    async callEngine(engineName: string, methodName: string, ...args: any[]): Promise<any>;

    // 执行工作流步骤
    async executeStep(step: WorkflowStep, context: ExecutionContext): Promise<StepResult>;
}
```

#### 2. AdapterRegistry (适配器注册表)

**位置**: `src/engines/taiyi/core/adapter-registry.ts`

管理所有已注册的适配器：

- 适配器注册
- 按名称查找适配器
- 适配器验证
- 适配器生命周期管理

**设计模式**: 单例模式 + 注册表模式

```typescript
class AdapterRegistry {
    // 注册适配器
    register(adapter: IAdapter): void;

    // 按名称获取适配器
    get(name: string): IAdapter | undefined;

    // 检查适配器是否存在
    has(name: string): boolean;

    // 获取所有适配器
    getAll(): Map<string, IAdapter>;
}
```

#### 3. 适配器装饰器

**位置**: `src/engines/taiyi/core/adapter-decorators.ts`

提供装饰器以简化适配器注册：

```typescript
@Adapter({
    name: "wenchang",
    displayName: "文昌星君",
    priority: AdapterPriority.High,
    description: "偏好设置管理适配器",
    engineType: "preference",
    dependencies: [],
})
export class WenchangAdapter implements IAdapter {
    // 适配器实现
}
```

#### 4. TaiyiService (太乙服务)

**位置**: `src/main/deity/taiyi-service.ts`

主进程服务层：

- 初始化TaiyiEngine
- 为渲染进程提供IPC接口
- 管理工作流执行上下文
- 处理跨进程通信

### 架构图

```
┌─────────────────────────────────────────────────────────┐
│                    渲染进程                              │
│  ┌───────────────────────────────────────────────────┐  │
│  │         渲染进程服务 / 组件                       │  │
│  └──────────────────┬────────────────────────────────┘  │
│                     │ IPC                               │
└─────────────────────┼───────────────────────────────────┘
                      │
┌─────────────────────┼───────────────────────────────────┐
│                主进程                                    │
│  ┌──────────────────┼──────────────────────────────┐    │
│  │         TaiyiService (IPC处理器)                │    │
│  └──────────────────┬──────────────────────────────┘    │
│                     │                                    │
│  ┌──────────────────┼──────────────────────────────┐    │
│  │            TaiyiEngine                           │    │
│  │  ┌───────────────────────────────────────────┐  │    │
│  │  │      AdapterRegistry                      │  │    │
│  │  │  ┌──────────┐  ┌──────────┐  ┌─────────┐ │  │    │
│  │  │  │ Builtin  │  │  文昌    │  │ 千里眼  │ │  │    │
│  │  │  │ 适配器   │  │  适配器  │  │ 适配器  │ │  │    │
│  │  │  └──────────┘  └──────────┘  └─────────┘ │  │    │
│  │  └───────────────────────────────────────────┘  │    │
│  └──────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────┘
```

## 实现细节

### 适配器接口

所有适配器必须实现`IAdapter`接口：

```typescript
interface IAdapter {
    // 适配器名称（唯一标识符）
    readonly name: string;

    // 初始化适配器
    initialize(): Promise<void>;

    // 关闭适配器
    shutdown(): Promise<void>;

    // 适配器特定方法...
}
```

### 步骤执行流程

1. **接收请求**: TaiyiService从渲染进程接收IPC请求
2. **解析步骤**: 从工作流步骤中提取服务名称和动作
3. **路由到适配器**: 从注册表中查找适当的适配器
4. **执行动作**: 使用参数调用适配器方法
5. **返回结果**: 处理结果并返回给调用者
6. **错误处理**: 捕获并处理执行错误

```typescript
async executeStep(step: WorkflowStep, context: ExecutionContext): Promise<StepResult> {
  // 步骤类型路由
  switch (step.type) {
    case 'condition':
    case 'loop':
      // 这些由工作流编排器(天枢)处理
      throw new Error(`步骤类型 ${step.type} 应由编排器处理`)

    case 'builtin':
      // 路由到内置适配器
      return this.routeToBuiltin(step, context)

    case 'action':
      // 路由到服务适配器
      return this.routeToAdapter(step, context)

    default:
      throw new Error(`未知步骤类型: ${step.type}`)
  }
}

private async routeToAdapter(step: WorkflowStep, context: ExecutionContext): Promise<StepResult> {
  const serviceName = step.service || 'builtin'
  const actionName = step.action || 'execute'
  const input = step.input || {}

  // 通过引擎调用适配器
  const result = await this.engine.callEngine(serviceName, actionName, input)

  return {
    stepId: step.id,
    status: 'completed',
    output: result,
    startTime: Date.now(),
    endTime: Date.now()
  }
}
```

### 内置适配器

内置适配器提供常见的工作流操作：

```typescript
@Adapter({
    name: "builtin",
    displayName: "内置操作适配器",
    priority: AdapterPriority.Highest,
    description: "内置工作流操作",
    engineType: "builtin",
    dependencies: [],
})
export class BuiltinAdapter implements IAdapter {
    readonly name = "builtin";

    async initialize(): Promise<void> {}
    async shutdown(): Promise<void> {}

    // 返回数据
    async return(data: any): Promise<any> {
        return data;
    }

    // 设置变量
    async setVariable(params: { name: string; value: any }): Promise<void> {
        // 在执行上下文中设置
    }

    // 记录日志
    async log(params: { level: string; message: string }): Promise<void> {
        logger.log(params.level, params.message);
    }

    // 延迟执行
    async delay(params: { milliseconds: number }): Promise<void> {
        await new Promise((resolve) => setTimeout(resolve, params.milliseconds));
    }

    // 空操作
    async noop(): Promise<void> {}
}
```

## 与驺吾和天枢的集成

### 关系

- **驺吾**: 定义工作流DSL（执行什么）
- **太乙**: 提供服务集成的适配器（如何执行）
- **天枢**: 使用太乙适配器编排工作流执行（何时执行）

### 执行流程

```
驺吾工作流 (YAML)
  ↓
天枢引擎 (编排器)
  ├─ 解析工作流
  ├─ 解析变量
  ├─ 处理控制流 (condition, loop, parallel)
  └─ 将action/builtin步骤委托给太乙
      ↓
太乙引擎 (适配器路由器)
  ├─ 路由到适当的适配器
  ├─ 执行适配器方法
  └─ 将结果返回给天枢
      ↓
天枢继续工作流执行
```

## 文件结构

```
src/engines/taiyi/
├── index.ts                    # 导出入口点
├── core/
│   ├── TaiyiEngine.ts         # 核心引擎
│   ├── adapter-registry.ts    # 适配器注册表
│   └── adapter-decorators.ts  # 装饰器
├── adapters/
│   ├── index.ts               # 导入所有适配器
│   ├── BuiltinAdapter.ts      # 内置操作
│   ├── WenchangAdapter.ts     # 偏好设置管理
│   ├── QianliyanAdapter.ts    # 文件扫描
│   └── ...
└── __tests__/
    ├── TaiyiEngine.spec.ts    # 引擎测试
    └── adapters/              # 适配器测试

src/main/deity/
└── taiyi-service.ts           # 主进程服务
```

## 使用示例

### 定义适配器

```typescript
import { Adapter, AdapterPriority } from "@engines/taiyi/core/adapter-decorators";
import { IAdapter } from "@engines/taiyi";

@Adapter({
    name: "myservice",
    displayName: "我的服务",
    priority: AdapterPriority.Normal,
    description: "自定义服务适配器",
    engineType: "custom",
    dependencies: [],
})
export class MyServiceAdapter implements IAdapter {
    readonly name = "myservice";

    async initialize(): Promise<void> {
        // 初始化服务
    }

    async shutdown(): Promise<void> {
        // 清理
    }

    async doSomething(params: any): Promise<any> {
        // 实现
        return { success: true, data: params };
    }
}
```

### 在驺吾工作流中使用

```yaml
steps:
    - id: "call_my_service"
      type: "action"
      service: "myservice" # 路由到MyServiceAdapter
      action: "doSomething" # 调用doSomething方法
      input:
          param1: "value1"
          param2: "value2"
```

## 测试策略

### 单元测试

- **TaiyiEngine.spec.ts**: 测试引擎核心功能
    - 适配器注册
    - 步骤路由
    - 错误处理
    - 生命周期管理

### 集成测试

- 测试适配器注册和发现
- 测试跨进程IPC通信
- 测试工作流步骤执行
- 测试错误恢复机制

## 优势

1. **模块化**: 适配器独立且可重用
2. **可扩展性**: 易于添加新的服务适配器
3. **统一管理**: 所有工作流使用相同的执行接口
4. **类型安全**: TypeScript提供编译时检查
5. **可测试性**: 清晰的接口便于测试
6. **可维护性**: 关注点清晰分离

## 已知限制

1. **适配器发现**: 需要手动导入适配器
2. **错误恢复**: 错误恢复机制需要改进
3. **性能监控**: 缺少详细的执行指标
4. **并发控制**: 没有内置的并发限制

## 未来改进

1. **自动发现**: 自动适配器发现机制
2. **性能监控**: 添加执行性能跟踪
3. **并发控制**: 实现工作流并发限制
4. **重试逻辑**: 失败步骤的内置重试机制
5. **缓存**: 缓存适配器结果以提高性能

## 相关文档

- [驺吾工作流DSL (RFC 0037)](./0037-zouwu-workflow-dsl.md)
- [扫描编排 (RFC 0048)](./0048-scan-orchestration-business-logic-migration.md)
- [架构文档](../architecture/MYTHOLOGY.md)

## 变更日志

- **2025-12-24**: 更新为专注于太乙适配器设计，阐明与驺吾和天枢的关系
- **2024-12-19**: 初始版本，实现核心引擎和适配器系统

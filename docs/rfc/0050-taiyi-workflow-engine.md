# RFC-0050: Taiyi Workflow Engine

## 元数据

- **状态**: 已完成
- **创建日期**: 2024-12-19
- **作者**: System
- **相关RFC**:
  - RFC-0037: Tianshu YAML Workflow DSL
  - RFC-0048: Scan Orchestration Business Logic Migration

## 目录

- [摘要](#摘要)
- [背景与动机](#背景与动机)
- [工作流规范详细说明](#工作流规范详细说明)
  - [工作流数据结构](#工作流数据结构)
  - [工作流执行流程](#工作流执行流程)
  - [工作流配置格式](#工作流配置格式)
  - [工作流适配器接口](#工作流适配器接口)
  - [工作流上下文与结果](#工作流上下文与结果)
- [实现细节](#实现细节)
- [使用示例](#使用示例)
- [测试策略](#测试策略)
- [已知限制](#已知限制)
- [未来改进](#未来改进)

## 摘要

Taiyi（太乙）工作流引擎是一个基于适配器模式的模块化工作流执行引擎，用于在 Picasa 应用中统一管理和执行各种业务工作流。该引擎通过装饰器模式注册适配器，提供了灵活、可扩展的工作流处理能力。

## 背景与动机

在 Picasa 应用的发展过程中，需要处理多种不同类型的工作流，包括：
- 文件扫描工作流
- 配置管理工作流
- 数据同步工作流
- 其他业务逻辑工作流

为了统一管理这些工作流，避免代码重复，提高可维护性和可扩展性，需要一个统一的工作流引擎。Taiyi 引擎应运而生，它采用适配器模式，允许不同的业务模块通过适配器接入工作流系统。

## 设计目标

1. **模块化**: 通过适配器模式实现模块解耦
2. **可扩展性**: 易于添加新的工作流适配器
3. **类型安全**: 使用 TypeScript 确保类型安全
4. **统一接口**: 提供统一的工作流执行接口
5. **可测试性**: 支持单元测试和集成测试

## 架构设计

### 核心组件

#### 1. TaiyiEngine (核心引擎)

**文件**: `src/engines/taiyi/core/TaiyiEngine.ts`

TaiyiEngine 是工作流引擎的核心类，负责：
- 管理适配器注册表
- 执行工作流
- 处理工作流生命周期
- 管理工作流状态

**关键特性**:
- 适配器注册与查找
- 工作流执行调度
- 错误处理与恢复
- 状态管理

#### 2. AdapterRegistry (适配器注册表)

**文件**: `src/engines/taiyi/core/adapter-registry.ts`

AdapterRegistry 负责管理所有已注册的适配器，提供：
- 适配器注册功能
- 适配器查找功能
- 适配器验证功能

**设计模式**: 单例模式 + 注册表模式

#### 3. AdapterDecorators (适配器装饰器)

**文件**: `src/engines/taiyi/core/adapter-decorators.ts`

AdapterDecorators 提供装饰器函数，用于简化适配器的注册：

```typescript
@RegisterAdapter('adapter-name')
class MyAdapter implements WorkflowAdapter {
  // 适配器实现
}
```

**关键装饰器**:
- `@RegisterAdapter(name: string)`: 注册适配器
- `@ValidateAdapter()`: 验证适配器实现

#### 4. TaiyiService (主进程服务)

**文件**: `src/main/deity/taiyi-service.ts`

TaiyiService 是主进程中的服务层，负责：
- 初始化 TaiyiEngine
- 提供 IPC 接口供渲染进程调用
- 管理工作流执行上下文
- 处理跨进程通信

### 架构图

```
┌─────────────────────────────────────────────────────────┐
│                    Renderer Process                      │
│  ┌───────────────────────────────────────────────────┐  │
│  │         Renderer Services / Components            │  │
│  └──────────────────┬──────────────────────────────────┘  │
│                    │ IPC                                │
└────────────────────┼────────────────────────────────────┘
                     │
┌────────────────────┼────────────────────────────────────┐
│                    Main Process                            │
│  ┌────────────────┼──────────────────────────────────┐     │
│  │         TaiyiService (IPC Handler)               │     │
│  └────────────────┬──────────────────────────────────┘     │
│                   │                                        │
│  ┌────────────────┼──────────────────────────────────┐     │
│  │            TaiyiEngine                            │     │
│  │  ┌────────────────────────────────────────────┐   │     │
│  │  │      AdapterRegistry                       │   │     │
│  │  │  ┌──────────┐  ┌──────────┐  ┌──────────┐ │   │     │
│  │  │  │Adapter 1 │  │Adapter 2 │  │Adapter N │ │   │     │
│  │  │  └──────────┘  └──────────┘  └──────────┘ │   │     │
│  │  └────────────────────────────────────────────┘   │     │
│  └────────────────────────────────────────────────────┘     │
└────────────────────────────────────────────────────────────┘
```

## 实现细节

### 适配器接口

所有适配器必须实现 `WorkflowAdapter` 接口：

```typescript
interface WorkflowAdapter {
  // 适配器名称
  name: string;

  // 执行工作流
  execute(context: WorkflowContext): Promise<WorkflowResult>;

  // 验证工作流配置
  validate(config: WorkflowConfig): boolean;

  // 获取适配器元数据
  getMetadata(): AdapterMetadata;
}
```

### 工作流上下文

```typescript
interface WorkflowContext {
  // 工作流ID
  workflowId: string;

  // 输入数据
  input: Record<string, any>;

  // 执行参数
  params: Record<string, any>;

  // 元数据
  metadata: Record<string, any>;
}
```

### 工作流结果

```typescript
interface WorkflowResult {
  // 是否成功
  success: boolean;

  // 输出数据
  output?: Record<string, any>;

  // 错误信息
  error?: Error;

  // 执行时间
  duration: number;
}
```

### 适配器注册流程

1. **定义适配器类**: 实现 `WorkflowAdapter` 接口
2. **使用装饰器注册**: 使用 `@RegisterAdapter()` 装饰器
3. **自动注册**: 引擎启动时自动发现并注册适配器
4. **验证适配器**: 使用 `@ValidateAdapter()` 验证实现

### 工作流执行流程

1. **接收请求**: TaiyiService 接收 IPC 请求
2. **查找适配器**: 根据工作流类型查找对应适配器
3. **验证配置**: 验证工作流配置的有效性
4. **执行工作流**: 调用适配器的 `execute()` 方法
5. **处理结果**: 处理执行结果并返回
6. **错误处理**: 捕获并处理执行过程中的错误

## 文件结构

```
src/engines/taiyi/
├── index.ts                    # 导出入口
├── core/
│   ├── TaiyiEngine.ts         # 核心引擎类
│   ├── adapter-registry.ts    # 适配器注册表
│   └── adapter-decorators.ts  # 适配器装饰器
└── __tests__/
    ├── TaiyiEngine.spec.ts    # 引擎单元测试
    └── clean-data-flow.spec.ts # 数据流清理测试

src/main/deity/
└── taiyi-service.ts           # 主进程服务
```

## 使用示例

### 定义适配器

```typescript
import { RegisterAdapter, ValidateAdapter } from '@engines/taiyi/core/adapter-decorators';
import { WorkflowAdapter, WorkflowContext, WorkflowResult } from '@engines/taiyi';

@RegisterAdapter('scan-workflow')
@ValidateAdapter()
export class ScanWorkflowAdapter implements WorkflowAdapter {
  name = 'scan-workflow';

  async execute(context: WorkflowContext): Promise<WorkflowResult> {
    const startTime = Date.now();

    try {
      // 执行扫描逻辑
      const result = await this.performScan(context.input);

      return {
        success: true,
        output: result,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        error: error as Error,
        duration: Date.now() - startTime,
      };
    }
  }

  validate(config: WorkflowConfig): boolean {
    // 验证配置
    return config.type === 'scan' && !!config.path;
  }

  getMetadata(): AdapterMetadata {
    return {
      name: this.name,
      version: '1.0.0',
      description: '文件扫描工作流适配器',
    };
  }

  private async performScan(input: any): Promise<any> {
    // 扫描实现
  }
}
```

### 使用引擎

```typescript
import { TaiyiEngine } from '@engines/taiyi';

const engine = new TaiyiEngine();

// 执行工作流
const result = await engine.execute({
  workflowId: 'scan-workflow',
  input: { path: '/path/to/scan' },
  params: {},
  metadata: {},
});

if (result.success) {
  console.log('工作流执行成功:', result.output);
} else {
  console.error('工作流执行失败:', result.error);
}
```

### IPC 调用（从渲染进程）

```typescript
// 渲染进程
import { ipcRenderer } from 'electron';

const result = await ipcRenderer.invoke('taiyi:execute', {
  workflowId: 'scan-workflow',
  input: { path: '/path/to/scan' },
  params: {},
  metadata: {},
});
```

## 测试策略

### 单元测试

- **TaiyiEngine.spec.ts**: 测试引擎核心功能
  - 适配器注册
  - 工作流执行
  - 错误处理
  - 状态管理

- **clean-data-flow.spec.ts**: 测试数据流清理
  - 数据流验证
  - 清理逻辑
  - 边界条件

### 集成测试

- 测试适配器注册与发现
- 测试跨进程通信
- 测试工作流执行流程
- 测试错误恢复机制

## 优势与收益

1. **模块化**: 通过适配器模式实现业务逻辑解耦
2. **可扩展性**: 易于添加新的工作流类型
3. **统一管理**: 所有工作流通过统一接口管理
4. **类型安全**: TypeScript 提供完整的类型检查
5. **可测试性**: 清晰的接口便于单元测试
6. **可维护性**: 代码结构清晰，易于维护

## 已知限制

1. **适配器发现**: 当前需要手动导入适配器类才能注册
2. **错误恢复**: 错误恢复机制需要进一步完善
3. **性能监控**: 缺少详细的工作流执行性能监控
4. **并发控制**: 当前不支持工作流并发执行控制

## 未来改进

1. **自动发现**: 实现适配器自动发现机制
2. **性能监控**: 添加工作流执行性能监控
3. **并发控制**: 实现工作流并发执行控制
4. **工作流编排**: 支持复杂工作流的编排
5. **持久化**: 支持工作流执行状态的持久化
6. **可视化**: 提供工作流执行的可视化界面

## 相关文档

- [Tianshu Workflow DSL (RFC-0037)](./0037-tianshu-yaml-workflow-dsl.md)
- [Scan Orchestration (RFC-0048)](./0048-scan-orchestration-business-logic-migration.md)
- [Architecture Documentation](../architecture/MYTHOLOGY.md)

## 变更日志

- **2024-12-19**: 初始版本，实现核心引擎和适配器系统


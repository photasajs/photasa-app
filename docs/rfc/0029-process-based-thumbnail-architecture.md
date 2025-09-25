# RFC 0029: Process-Based Thumbnail Architecture

- **Start Date**: 2025-09-23
- **RFC PR**: (leave this empty)
- **Implementation Issue**: (leave this empty)
- **Status**: Draft
- **Assignee**: Development Team
- **Target Release**: v1.8.0

## Summary

将当前基于单一 Worker Thread 的缩略图生成架构重构为基于进程池的混合架构，以解决内存泄漏和性能瓶颈问题。轻量级任务继续使用 Worker Thread 处理，重型任务（视频、大图片、HEIC）迁移到独立子进程处理。

## Motivation

### 当前问题

1. **内存泄漏问题**
   - 单一 Worker Thread 处理所有缩略图任务，内存无法有效释放
   - HEIC WASM 模块存在内存管理问题，长时间运行导致内存占用不断增长
   - Sharp 库在处理大量图片后也存在内存累积问题

2. **性能瓶颈**
   - 所有任务串行处理，CPU 多核资源未充分利用
   - 大文件处理阻塞后续任务，影响用户体验
   - 视频缩略图生成特别耗时，阻塞整个队列

3. **稳定性问题**
   - Worker 崩溃会影响所有待处理任务
   - 没有任务隔离，一个任务的问题可能影响整个 Worker
   - 缺乏健康检查和自动恢复机制

### 期望成果

- **改善内存管理**：通过进程隔离和生命周期管理，有效控制内存使用
- **提升性能**：充分利用多核 CPU，并行处理多个缩略图任务
- **增强稳定性**：进程隔离确保单个任务失败不影响其他任务
- **优化用户体验**：减少等待时间，提供更流畅的缩略图加载体验

## Detailed Design

### 架构设计

#### 1. 混合处理架构

```
┌─────────────────────────────────────────┐
│         ThumbnailService (主进程)        │
│  - IPC 接口                             │
│  - 任务路由                             │
│  - 结果缓存                             │
└────────────┬────────────────────────────┘
             │
      ┌──────▼──────┐
      │ TaskRouter  │
      │  任务分类    │
      └──┬───────┬──┘
         │       │
    轻量级任务  重型任务
         │       │
    ┌────▼───┐ ┌─▼──────────┐
    │ Worker │ │ Process    │
    │  Pool  │ │   Pool     │
    └────────┘ └────────────┘
```

#### 2. 任务分类策略

```typescript
interface TaskClassification {
  // 轻量级任务（使用 Worker Pool）
  lightweight: {
    criteria: {
      fileSize: '<5MB',
      formats: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
      operations: ['resize', 'rotate', 'crop']
    },
    executor: 'WorkerPool'
  },
  
  // 重型任务（使用 Process Pool）
  heavyweight: {
    criteria: {
      fileSize: '>=5MB',
      formats: ['heic', 'heif', 'raw', 'video/*'],
      operations: ['decode', 'transcode', 'extract']
    },
    executor: 'ProcessPool'
  }
}
```

#### 3. ProcessPool 实现

```typescript
export class ProcessPool {
  private processes: Map<string, ManagedProcess>
  private config: {
    minProcesses: 2,
    maxProcesses: cpus().length - 1,
    idleTimeout: 30 * 60 * 1000, // 30分钟
    taskTimeout: 60 * 1000,       // 60秒
  }
  
  // 进程生命周期管理
  private async createProcess(): Promise<ManagedProcess>
  private async terminateProcess(id: string): Promise<void>
  private async recycleIdleProcesses(): Promise<void>
  
  // 任务执行
  public async execute<T, R>(task: ProcessTask<T>): Promise<R>
  
  // 健康检查
  private async healthCheck(): Promise<void>
  private async restartFailedProcesses(): Promise<void>
}
```

#### 4. 子进程架构

```typescript
// thumbnail-process.ts - 独立进程入口
import { parentPort } from 'worker_threads'

class ThumbnailProcess {
  private handlers: Map<string, TaskHandler>
  
  constructor() {
    this.registerHandlers()
    this.setupIPC()
    this.setupMemoryMonitor()
  }
  
  private setupMemoryMonitor() {
    setInterval(() => {
      const usage = process.memoryUsage()
      if (usage.heapUsed > MAX_HEAP_SIZE) {
        this.gracefulShutdown()
      }
    }, 10000)
  }
  
  private async handleTask(task: ProcessTask) {
    const handler = this.handlers.get(task.type)
    if (!handler) {
      throw new Error(`Unknown task type: ${task.type}`)
    }
    
    try {
      const result = await handler.execute(task.data)
      this.sendResult(task.id, result)
    } catch (error) {
      this.sendError(task.id, error)
    }
  }
}
```

#### 5. 任务处理器分离

```typescript
// handlers/video-handler.ts
export class VideoHandler implements TaskHandler {
  async execute(task: VideoTask): Promise<ThumbnailResult> {
    const { inputPath, outputPath, options } = task
    
    // 使用 FFmpeg 生成视频缩略图
    await this.extractFrame(inputPath, outputPath, options)
    
    return {
      success: true,
      path: outputPath,
      metadata: await this.getMetadata(inputPath)
    }
  }
}

// handlers/heic-handler.ts
export class HeicHandler implements TaskHandler {
  private heifModule: any
  
  async execute(task: HeicTask): Promise<ThumbnailResult> {
    // HEIC 解码和处理
    const decoded = await this.decode(task.inputBuffer)
    const thumbnail = await this.createThumbnail(decoded, task.options)
    
    // 主动释放内存
    this.cleanup(decoded)
    
    return thumbnail
  }
  
  private cleanup(decoded: any) {
    // 显式释放 WASM 内存
    if (this.heifModule && this.heifModule.free) {
      this.heifModule.free(decoded)
    }
  }
}
```

#### 6. 通信协议

```typescript
// 进程间通信消息格式
interface ProcessMessage {
  id: string           // 消息ID，用于关联请求和响应
  type: 'task' | 'result' | 'error' | 'control'
  payload: any
  timestamp: number
}

// 任务消息
interface TaskMessage extends ProcessMessage {
  type: 'task'
  payload: {
    taskType: string   // 'video', 'heic', 'image'
    data: any          // 任务数据
    timeout?: number   // 任务超时时间
  }
}

// 结果消息
interface ResultMessage extends ProcessMessage {
  type: 'result'
  payload: {
    success: boolean
    data?: any
    error?: string
    stats?: {
      duration: number
      memoryUsed: number
    }
  }
}
```

### 迁移策略

#### 第一阶段：基础设施准备
1. 实现 ProcessPool 类
2. 创建子进程通信协议
3. 实现进程健康检查和监控

#### 第二阶段：视频处理迁移
1. 将视频缩略图生成迁移到独立进程
2. 实现视频处理的进程池化
3. 测试和优化视频处理性能

#### 第三阶段：HEIC 处理迁移
1. 将 HEIC 解码迁移到独立进程
2. 优化 WASM 内存管理
3. 实现 HEIC 处理的批量优化

#### 第四阶段：智能路由实现
1. 实现任务分类器
2. 集成 WorkerPool 和 ProcessPool
3. 实现动态负载均衡

#### 第五阶段：监控和优化
1. 添加性能监控指标
2. 实现自适应资源调度
3. 优化内存使用和进程生命周期

### 配置管理

```typescript
interface ThumbnailConfig {
  // Worker Pool 配置
  workerPool: {
    enabled: boolean
    minWorkers: number
    maxWorkers: number
  }
  
  // Process Pool 配置
  processPool: {
    enabled: boolean
    minProcesses: number
    maxProcesses: number
    idleTimeout: number
    taskTimeout: number
  }
  
  // 任务路由配置
  routing: {
    fileSizeThreshold: number  // 文件大小阈值（字节）
    videoAlwaysProcess: boolean // 视频总是使用进程处理
    heicAlwaysProcess: boolean  // HEIC 总是使用进程处理
  }
  
  // 性能配置
  performance: {
    maxConcurrent: number       // 最大并发任务数
    queueSize: number          // 任务队列大小
    memoryLimit: number        // 内存限制（MB）
  }
}
```

### 监控和调试

```typescript
interface ProcessPoolMetrics {
  // 进程指标
  totalProcesses: number
  activeProcesses: number
  idleProcesses: number
  
  // 任务指标
  tasksCompleted: number
  tasksFailed: number
  tasksInQueue: number
  avgTaskDuration: number
  
  // 资源指标
  totalMemoryUsage: number
  cpuUsage: number
  
  // 健康指标
  processRestarts: number
  lastHealthCheck: Date
}
```

## Drawbacks

1. **复杂度增加**
   - 需要维护 Worker 和 Process 两套处理机制
   - 调试和故障排查变得更复杂
   - 需要更多的配置项和调优参数

2. **资源开销**
   - 每个进程都有独立的 Node.js 运行时开销
   - 进程间通信比线程间通信开销略大
   - 需要更多内存来维持进程池

3. **启动时间**
   - 进程启动比线程慢，需要预热机制
   - 首次请求可能有延迟

## Alternatives

### 方案 1：纯 Worker Pool 优化
- 仅使用多个 Worker Thread，不引入进程
- 优点：架构简单，资源开销小
- 缺点：无法解决 WASM 内存泄漏问题，进程级别的隔离性不足

### 方案 2：完全进程化
- 所有缩略图处理都使用独立进程
- 优点：完全隔离，内存管理简单
- 缺点：资源开销大，小任务处理效率低

### 方案 3：外部服务化
- 将缩略图生成作为独立服务运行
- 优点：完全解耦，可独立扩展
- 缺点：部署复杂，需要额外的服务管理

## Unresolved Questions

1. **进程池大小的动态调整策略**
   - 如何根据系统负载动态调整进程数？
   - 是否需要基于历史数据的预测性扩缩容？

2. **任务优先级机制**
   - 如何实现用户可见区域的缩略图优先生成？
   - 是否需要支持任务抢占？

3. **错误恢复策略**
   - 进程崩溃后，未完成的任务如何处理？
   - 是否需要任务持久化以支持恢复？

4. **内存限制机制**
   - 如何精确控制每个进程的内存使用？
   - 是否使用 cgroup 或其他系统级限制？

## Implementation Plan

### Phase 1: Foundation (Week 1-2)
- [ ] 实现 ProcessPool 基础类
- [ ] 创建进程通信协议
- [ ] 实现基本的任务执行流程
- [ ] 添加单元测试

### Phase 2: Migration (Week 3-4)
- [ ] 迁移视频处理到进程
- [ ] 迁移 HEIC 处理到进程
- [ ] 实现任务路由器
- [ ] 集成测试

### Phase 3: Optimization (Week 5-6)
- [ ] 实现进程生命周期管理
- [ ] 添加监控和指标
- [ ] 性能优化和调优
- [ ] 压力测试

### Phase 4: Rollout (Week 7-8)
- [ ] Beta 测试
- [ ] 文档编写
- [ ] 生产环境部署
- [ ] 监控和调优

## Success Metrics

1. **性能指标**
   - 缩略图生成速度提升 50%+
   - CPU 利用率提升到 70%+
   - 并发处理能力提升 3x

2. **稳定性指标**
   - 内存泄漏问题完全解决
   - 进程崩溃恢复时间 <1s
   - 任务失败率 <1%

3. **用户体验指标**
   - 首屏缩略图加载时间减少 40%
   - 滚动时缩略图加载延迟 <100ms
   - 用户满意度提升

## References

- [Node.js Child Process Documentation](https://nodejs.org/api/child_process.html)
- [Worker Threads vs Child Process Performance](https://nodejs.org/en/docs/guides/worker-threads/)
- [Process Pool Pattern in Node.js](https://github.com/piscinajs/piscina)
- [Memory Management in Node.js](https://nodejs.org/en/docs/guides/simple-profiling/)
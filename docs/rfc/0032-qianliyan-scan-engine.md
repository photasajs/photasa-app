# RFC 0032: 千里眼扫描引擎

- **开始日期**: 2024-05-24
- **RFC PR**: 
- **实现议题**: 

## 摘要

在主进程内建立专用的「千里眼」扫描引擎，集中处理所有文件夹与媒体扫描职责。该引擎保持环境无关，仅通过统一接口统筹扫描规划、执行适配（Worker / 进程）、缓存协同与状态上报；由外层服务决定如何接入 IPC、日志和 UI。引擎既服务用户主动发起的扫描，也处理实时监听产生的任务。

## 动机

- 目前扫描责任散落在 `ScanService`、多个 Worker 辅助模块以及渲染进程 IPC 处理器之间，行为难以推理，也不利于后续扩展。
- Watcher 触发的扫描复用临时拼装的 IPC 负载，导致重复工作，并且手动扫描与自动扫描之间缺乏一致的节流策略。
- RFC 0007、0008、0015 引入的增量缓存逻辑需要一个中心化的仲裁者，避免重复扫描，同时对外提供一致的进度与诊断信息。
- 具名引擎（千里眼）能够作为长期稳定的抽象，便于承载未来的功能，如扫描优先级、启动自动恢复、远程控制等。

## 详细设计

### 引擎职责（环境无关）

1. **命令受理**
   - 提供单一的 `planScan(command: ScanCommand)` API，供主进程服务（渲染进程 IPC、Watcher 集成、计划任务等）调用。
   - 对输入请求做归一化处理：解析绝对路径、基于指纹去重、合并重复命令。
2. **策略决策**
   - 查询增量缓存清单，利用既有策略工具（`strategy/scan-strategy`）选择跳过、增量或全量扫描。
   - 将结果记录到 `ScanRegistry`，确保同一路径在扫描进行期间不会被重复调度。
3. **执行流水线**
   - 将经决策的任务推入 `TaskQueue`，由现有 Worker 池（`scan-worker`）消费。
   - 维护任务上下文（requestId、触发来源、优先级、取消令牌）。
   - 将 Worker 的进度、错误、完成事件流式推送给订阅者。
4. **状态与持久化**
   - 在 `scan/cache` 下存储扫描清单（文件夹指纹 → 最新结果），供应用重启后复用。
   - 持久化队列状态（待处理/执行中），以便在崩溃或重启后恢复。
5. **状态广播**
   - 将扫描状态以结构化事件推送至内部事件总线（`StatusBus`），供主进程服务自行订阅。
   - 引擎不直接操作 Electron IPC；`ScanService` 等外层消费者将事件转译为现有的 `notifyStatus`、`picasa:find-photo` 等通知。

### 模块结构

```
src/main/engines/qianliyan/
  index.ts            // 引擎启动入口，暴露 planScan/subscribe 等接口
  registry.ts         // 跟踪活动与已完成的扫描任务
  planner.ts          // 策略决策与缓存查询
  queue.ts            // 任务队列与执行适配（worker / 进程）
  manifest-store.ts   // 持久化元数据存取
  status-bus.ts       // 环境无关的事件总线
  execution-adapter/  // 可插拔的执行后端（初始为 Worker）
```

现有文件（`scan-service.ts`、`scan-worker.ts`、`scan-photos.ts`）将重构为委托给引擎，同时保留原有测试。执行适配层初期仍包装当前 Worker 协议，后续可无缝替换为多进程或远程方案。

### 服务集成

- `ScanService` 在初始化时构造引擎实例，负责将引擎事件转发到现有 IPC (`picasa:find-photo`、`notifyStatus`) 并处理依赖注入（LogViewer、配置等）。
- 渲染层仍通过既有 IPC 调用 `ScanService`；引擎对 IPC 实现保持透明，仅消费由服务传入的 `ScanCommand`。
- `WatchService`（顺风耳）使用引擎提供的 `enqueueOperations`/`planScan` API，将 Watch 引擎产出的命令推入统一扫描通道（详见 RFC 0033）。

### 数据契约

新增 `ScanCommand`：

```ts
interface ScanCommand {
    id: string;              // deterministic id (hash(path+action+source))
    action: ScanAction;      // existing scan payload
    source: "manual" | "watch" | "system";
    priority: "user" | "background";
    hints?: {
        thumbnailSize?: number;
        retryCount?: number;
    };
    requestedAt: number;
}
```

`ScanRegistry` 维护：

```ts
interface ScanJobState {
    command: ScanCommand;
    status: "pending" | "running" | "completed" | "failed" | "skipped";
    progress?: {
        processed: number;
        total?: number;
        currentFile?: string;
    };
    lastUpdate: number;
}
```

### 状态生命周期

1. `planScan` 入队命令 → 发出 `queued` 状态。
2. `TaskQueue` 取出任务 → 发出带初始进度的 `running` 状态。
3. Worker 进度事件 → 持续更新 `progress`。
4. 任务完成 → 写入清单并发出包含结果路径、缩略图的 `completed`。
5. 发生错误 → 触发可配置的重试策略，并发出带诊断信息的 `failed`。

### 迁移策略

- **阶段 1**：在不改动 IPC 的前提下，引擎接管 `ScanService` 内部逻辑，保持对渲染层完全透明。
- **阶段 2**：视需要优化主进程-渲染层协议时，再由服务层评估 IPC 命名更新，届时引擎无需调整。
- **阶段 3**：顺风耳完成与引擎的直接对接后，可逐步移除旧的 renderer 队列桥接与冗余逻辑（参见 RFC 0033）。

### 成功指标

- 同一文件夹 5 分钟内的重复扫描请求有 95% 被跳过或合并。
- 引擎初始化（服务启动延迟后）500ms 内即可开始冷启动扫描。
- 至少 90% 的扫描进度事件包含 `processed` 计数，与缓存清单数据一致。

## 缺点

- 新增抽象层，需要同时重构多个模块。
- 队列状态持久化若序列化失败，存在潜在的数据损坏风险。
- 必须与渲染进程协同，过渡期的兼容层会增加复杂度。

## 替代方案

1. **增量式重构**：继续强化 `ScanService` 而不引入具名引擎。拒绝原因：责任仍分散，沟通成本高。
2. **渲染进程编排**：让渲染进程负责调度，主进程仅做 Worker 代理。拒绝原因：IPC 消耗高，且文件系统访问的安全性较差。
3. **引入现成任务框架**：使用第三方队列（如 BullMQ、Agenda）。拒绝原因：Electron 主进程环境与现有 Worker 集成高度定制，外部框架适配成本高。

## 未决问题

- 队列持久化应与增量缓存共用 JSON 文件，还是采用轻量级嵌入式数据库（如 SQLite）？
- 针对损坏文件导致的扫描失败，最佳策略是自动重试还是交由 UI 手动处理？
- 引擎应如何暴露可观测性指标（继续整合日志查看器，或提供独立的遥测服务）？

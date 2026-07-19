# RFC 0033: Shunfenger Watch Engine

- **Start Date**: 2024-05-24
- **RFC PR**:
- **Implementation Issue**:

## Summary

Define the Shunfenger Watch Engine as the unified gateway for filesystem change detection. The engine fully掌管监听生命周期、事件节流、错误恢复与命令生成，保持环境无关；外层 `WatchService` 仅作为薄壳负责 IPC 兼容与依赖注入。Shunfenger 必须覆盖现有 WatchService 的全部行为，使服务层无感迁移。

## Motivation

- Current `WatchService` forwards deduplicated events directly to the renderer, creating a tight coupling between chokidar callbacks and UI queue management.
- Different modules dispatch watch requests inconsistently, producing duplicate scans and race conditions when folders are added or removed rapidly.
- A named watch engine (Shunfenger) clarifies responsibility: listen to the world, understand intent, and notify Qianliyan with actionable commands.
- Centralization enables future enhancements such as adaptive throttling, folder onboarding workflows, and persistent watch configuration.

## Detailed Design

### Engine Responsibilities (Environment Agnostic)

1. **Watch Lifecycle Ownership**
    - 内部管理 chokidar watcher 的创建、暂停、恢复与销毁，暴露 `configure/profile`, `pause`, `resume`, `stop`, `flush` API；出现错误时自动进入 `paused` 状态并通知消费方。
    - 统一承载现有选项：`ignoreInitial`, `awaitWriteFinish`, 忽略规则、递归策略等，并支持 profile 级覆盖。
2. **Event Normalization**
    - Convert chokidar `add/change/delete/addDir/deleteDir/raw` 事件为 `FileObservation`；检测 rename（成对 add+delete）并合并；对非媒体文件打上标记供下游处理。
    - 复制现有 WatchService 的节流策略：`shouldDeduplicateEvent` + `calculateDebounceTime` 动态延迟，并在 backlog 接近阈值时强制 flush。
3. **Command Emission**
    - 将观察事件映射为 `ScanAction`/`FileOperation`：复用 `createFileOperation`/优先级规则，目录事件注入完整的 `priority/timestamp/source` 字段，删除事件触发相应清理命令。
    - 通过注入的 dispatcher 向千里眼 `planScan` 或 `enqueueOperations` 发送命令，同时允许 Service 监听这些命令以兼容旧 IPC。
4. **Health & Diagnostics**
    - 监听 chokidar `ready/error/raw`，在 `status-bus` 中输出 `ready/paused/error/flushing/raw` 事件、backlog 指标与错误详情，保证监控与 LogViewer 能按原逻辑工作。
    - 定义错误恢复策略：如 ENOSPC 自动退回 paused，重试策略由引擎配置决定。
5. **Persistent Watch Profiles**
    - Profile manifest 存储于应用数据目录（默认 `~/.photasa/watch/profiles.json`），支持外部注入路径；加载失败时退回空配置并记录错误。

### Module Layout

```
src/engines/shunfenger/
  index.ts            // Public facade exposing configure/pause/resume APIs
  watcher-factory.ts  // chokidar setup and lifecycle management
  event-buffer.ts     // Debounce, dedupe, dynamic throttling, rename coalescing
  observation.ts      // FileObservation model + media detection helpers
  command-adapter.ts  // Map observations -> ScanCommand
  status-bus.ts       // Environment-agnostic engine health events
  profile-store.ts    // Persist and restore watch configurations
  error-strategy.ts   // 定义 watcher 异常恢复与重试策略
```

Existing `watch-service.ts` becomes a thin wrapper around the engine for compatibility with service decorators.

### Interaction with Qianliyan

- 所有 `FileObservation` 经 `command-adapter` 转成命令后直接调用注入的 dispatcher（默认连接千里眼 `planScan/enqueueOperations`）。
- 删除命令在千里眼侧触发队列清理，目录命令则触发增量扫描；engine 监听千里眼的完成/错误事件以调整节流与重试计划。
- Service 可订阅 `status-bus` 和 command 流，在迁移期双写旧 IPC (`picasa:add-to-scan-queue`, `WatchServiceEvent.*`)。

### Service Integration

- `WatchService` 只在初始化/关闭时生存周期管理 Shunfenger，并把 IPC (`WatchServiceEvent.start/stop`, `picasa:stop-file-watch`) 映射到 `configure/pause/resume/flush`；事件全部来源于 `status-bus` / command 流。
- 兼容策略：
    1. **Phase 1**：Service 收到命令后继续 mirror 到 `picasa:add-to-scan-queue`，Renderer 保持旧逻辑；
    2. **Phase 2**：Renderer UI 改为订阅 `qianliyan` 状态和新的 watch 事件；
    3. **Phase 3**：移除旧 IPC，Service 仅保留薄封装。
- 引擎负责错误时的自动恢复与通知，Service 仅将错误状态传达给 UI。

### Data Contracts

`FileObservation` structure（包含 rename/raw 支持）:

```ts
interface FileObservation {
    id: string; // hash(eventType + path + mtime)
    path: string;
    kind: "add" | "change" | "delete" | "addDir" | "deleteDir";
    isDirectory: boolean;
    isMediaFile: boolean;
    detectedAt: number;
    sourceProfileId: string;
    metadata?: {
        size?: number;
        mtimeMs?: number;
        thumbnailSize?: number;
        pairedWith?: string; // rename pair id
        rawArgs?: any[]; // chokidar raw payload
    };
}
```

`WatchProfile` persistence:

```ts
interface WatchProfile {
    id: string;
    rootPath: string;
    recursive: boolean;
    ignoreGlobs: string[];
    thumbnailSize: number;
    autoStart: boolean;
}
```

### Operational Flow

1. Renderer (or config service) loads watch profiles and calls `configure`.
2. Shunfenger starts chokidar watchers, emits `shunfenger:status` ready event.
3. File changes generate `FileObservation`s buffered and deduped.
4. Buffered observations flush to `ScanCommand`s and sent to Qianliyan.
5. Qianliyan executes scans, emits status; Shunfenger listens for completion to manage follow-up (e.g., re-enable watchers after bulk import).
6. 错误时 Shunfenger 自动 `pause` watcher，记录日志并在状态总线上抛出 error；`WatchService` 可提供重试按钮或自动恢复策略。

### Success Metrics

- Watcher ready time under 2 seconds for 95% of start-ups (with <= 5 roots).
- Duplicate `ScanCommand`s triggered by the same file within 10 seconds reduced by 90% versus baseline.
- Persistent watch profiles survive restart with no more than 0.1% validation failures.

## Drawbacks

- More moving parts compared to the current direct chokidar → renderer flow.
- Requires careful synchronization with Qianliyan to avoid deadlocks or feedback loops.
- Persisting watch profiles introduces the need for migration tooling when configuration schema changes.

## Alternatives

1. **Keep Renderer Queue**: Continue sending raw watcher events to renderer and let UI decide. Rejected due to IPC spam and split responsibility.
2. **OS-Level Watch Aggregator**: Integrate with platform-native watch APIs through native addons. Rejected for now; higher implementation cost and limited cross-platform parity.
3. **Event Bus Only**: Introduce an event bus without an explicit engine abstraction. Rejected because command semantics and state tracking still need a dedicated module.

## Unresolved Questions

- 千里眼负载反馈：需要定义何种指标触发 Shunfenger 降频（例如队列长度、执行耗时）。
- Profile 冲突检出：如果不同 profile 监听了嵌套目录，是否需要提示用户或自动合并策略？
- 用户扩展：是否提供 hook 让用户在引擎触发命令前做额外校验或过滤？
- 权限与路径：Profile manifest 存储在用户目录时的权限处理，是否支持多用户或便携模式。

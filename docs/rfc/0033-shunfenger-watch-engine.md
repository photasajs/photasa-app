# RFC 0033: Shunfenger Watch Engine

- **Start Date**: 2024-05-24
- **RFC PR**: 
- **Implementation Issue**: 

## Summary

Define the Shunfenger Watch Engine as the unified gateway for filesystem change detection. The engine itself remains environment agnostic: it translates raw watcher events into structured scan commands, manages watch lifecycle, and coordinates with the Qianliyan Scan Engine (RFC 0032) while leaving IPC and UI wiring to services.

## Motivation

- Current `WatchService` forwards deduplicated events directly to the renderer, creating a tight coupling between chokidar callbacks and UI queue management.
- Different modules dispatch watch requests inconsistently, producing duplicate scans and race conditions when folders are added or removed rapidly.
- A named watch engine (Shunfenger) clarifies responsibility: listen to the world, understand intent, and notify Qianliyan with actionable commands.
- Centralization enables future enhancements such as adaptive throttling, folder onboarding workflows, and persistent watch configuration.

## Detailed Design

### Engine Responsibilities (Environment Agnostic)

1. **Watch Configuration Management**
   - Provide `configure(config: WatchConfig)` to start/update watchers.
   - Maintain a registry of active roots, exclusion rules, and per-root metadata (e.g., library id, thumbnail size).
2. **Event Normalization**
   - Convert chokidar events into `FileObservation` records capturing file type, path, event kind, previous state, and timestamps.
   - Apply debouncing, deduplication, and coalescing rules currently found in `WatchService` but extended with configurable policies.
3. **Command Emission**
   - Map normalized observations to `ScanCommand` payloads (as defined in RFC 0032) and call `Qianliyan.planScan` directly.
   - Attach context: `source: "watch"`, `priority` based on user interaction (foreground watch vs. background library sync), and hints such as desired thumbnail size.
4. **Health & Diagnostics**
   - Track chokidar readiness, error states, and backlog size. Emit status updates on a new channel `shufenge:status` for renderer dashboards and logs.
   - Provide manual controls (`pause`, `resume`, `flush`) for debugging and maintenance.
5. **Persistent Watch Profiles**
   - Store user-selected watch directories and options in a stable manifest (`watch-profiles.json`). Reload on startup、支持验证与迁移，输出纯数据供服务层获取。

### Module Layout

```
src/engines/shunfenger/
  index.ts            // Public facade exposing configure/pause/resume APIs
  watcher-factory.ts  // chokidar setup and lifecycle management
  event-buffer.ts     // Debounce, dedupe, force-flush logic
  observation.ts      // FileObservation model + media detection helpers
  command-adapter.ts  // Map observations -> ScanCommand
  status-bus.ts       // Environment-agnostic engine health events
  profile-store.ts    // Persist and restore watch configurations
```

Existing `watch-service.ts` becomes a thin wrapper around the engine for compatibility with service decorators.

### Interaction with Qianliyan

- On `FileObservation` flush, call `planScan` with:
  - `action`: existing `ScanAction` derived from event type (add/change/delete) and path.
  - `source: "watch"`, `priority: "background"` unless event is a direct user import (flag available via observation metadata).
  - `hints.thumbnailSize` set from watch profile or last known renderer preference.
- Expose status events via the engine `status-bus` so that `WatchService`（或其他消费者）可以根据千里眼反馈调整节流策略，例如在某个目录 `completed` 后重新激活忽略规则或刷新子目录缓存。

### Service Integration

- `WatchService` 保持现有 ServiceRegistry 生命周期：它创建 Shunfenger 引擎实例、传入 chokidar 所需的配置，并将引擎事件转发到目前的 IPC (`picasa:add-to-scan-queue` 等) 或新的服务端事件。
- 渲染层继续通过 preload API 操作监听（start/stop、profile 设置等）；引擎对 IPC 实现保持透明，仅消费服务注入的配置和回调。
- 在迁移期内可以并行保留旧的 renderer 队列通道；当 UI 完全改用服务端排队后，`WatchService` 才会下线旧 IPC，engine 本身无需变化。

### Data Contracts

`FileObservation` structure:

```ts
interface FileObservation {
    id: string;                 // hash(eventType + path + mtime)
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

- Should Shunfenger throttle events when Qianliyan reports heavy load, and if so, what feedback loop is appropriate?
- How do we surface watch profile conflicts (e.g., overlapping directories) to users without overwhelming them with warnings?
- Is there a need for user-level scripting/hooks when new files are detected before scans begin?

# RFC 0162: 扫描队列非阻塞 IPC 与防抖落盘

## Implementation principle (Photasa / Tauri)

> **Rust-first.** 扩展 [0144](./completed/0144-tauri-scan-queue-persistence-alignment.md)，不改变 `scanning.json` 格式。Policy: [ROADMAP.md](../../ROADMAP.md)。

**Status**: ✅ Closed  
**Created**: 2026-07-24  
**Closed**: 2026-07-24  
**Area**: Photasa / Tauri / `scan_queue_*` / Renderer 扫描队列  
**Depends on**: [0144](./completed/0144-tauri-scan-queue-persistence-alignment.md)、[0136](./completed/0136-tauri-scan-runtime-contract.md)、[0048](./completed/0048-scan-orchestration-business-logic-migration.md)  
**Supersedes**: 无（0144 并发单写者仍有效；本 RFC 解决 **UI 阻塞** 与 **假 async**）

---

## Summary

0144 用 `ScanQueueRepository` 修了并发丢队列，但突变 command 仍在热路径上：

- 每条 `add_scan_action` **同步落盘** 全量 `scanning.json`（2000+ 项）
- IPC **回传整表 queue** → WebView 序列化/反序列化巨型 payload
- Pinia **整表 replace** → Vue 重绘风暴
- `scan_directory_discovered` **一目录一 invoke**

`async fn` 只保证不卡 Rust UI 线程；**WebView 仍 await 每条 invoke** → 用户感知为 UI 锁死。

本 RFC 规定：**突变 command 返回轻量 Ack；落盘防抖 + `spawn_blocking`；Renderer 本地合并队列；发现风暴批量入队。**

---

## Problem（实测症状）

```text
[INFO] 千里眼：扫描队列已持久化 2311 项 -> ~/.photasa/scan/scanning.json
[INFO] 千里眼：扫描队列已持久化 2312 项 -> ...
...
```

- 日志每条 +1 → 每发现子目录一次全量写盘
- 主界面无响应直至队列铺完

### 根因链

```text
scan_directory_discovered (×N)
  → 尉迟恭 scheduleDirectoryScan (每次 1 条)
  → 房玄龄 ADD_SCAN_ACTION
  → invoke scan_queue_add_actions
       ├─ mutate: clone 全表 + serde pretty + fs write   [0144 行为]
       └─ return: clone 全表 → IPC → matter-sync replace queue
```

**结论**：不是「没用 async」，是 **await 了重活 + 传了大包**。

---

## Goals

1. 突变 `scan_queue_add/remove/update` **不阻塞 WebView**（典型 <5ms，仅内存 mutex + 小 Ack）。
2. 磁盘持久化 **防抖合并**（默认 300ms），崩溃窗口可接受（0144 SSOT 在内存）。
3. IPC payload **O(1)**：`ScanQueueAck { queueLen, revision }`。
4. Pinia 由 Renderer **本地 patch**（`applyScanQueue*`），与 Rust 去重逻辑一致。
5. `scan_directory_discovered` **250ms 批量** `createTasks`。
6. 沉淀 **Tauri command 非阻塞规范**（见下文），供后续 command 审查。

## Non-goals

- `scanning.json` → SQLite（仍 JSON + 原子 rename）
- `scan_queue_get` 仍返回全量（仅启动/显式恢复）
- 修改 0048 状态机语义
- 消除 `scan_runner` 内 `block_on`（另 RFC / 任务）

---

## Decision

### 方案 A（采用）：Ack IPC + 防抖落盘 + 本地 patch

| 层                   | 机制                                                                                  |
| -------------------- | ------------------------------------------------------------------------------------- |
| Rust `mutate()`      | 内存更新 → `PersistCoalescer.schedule`（不 await 磁盘）→ 返回 `ScanQueueAck`          |
| `scan_queue_persist` | 300ms debounce；`serde_json::to_string` 在 `spawn_blocking`                           |
| `yuantiangang`       | `invoke` Ack 后 `applyScanQueueAdd/Remove/Update(store.queue, …)`                     |
| `yuchigong`          | `source === "auto"` → `enqueueDiscoveredScan` 250ms flush → 单次 `createTasks(batch)` |

**风险**：崩溃时最多丢失 debounce 窗口内未落盘项；内存 SSOT 在进程内仍正确。可 `flush_persist()` 于退出钩子（未做，可 follow-up）。

### 方案 B（否决）：仅加 `spawn_blocking` 写盘，仍回传全表

磁盘不卡 async runtime，但 **IPC 与 Pinia 仍 O(n)** → UI 仍冻。

### 方案 C（否决）：前端 `void invoke()` 火忘

错误不可见；与房玄龄奏折 `approved` 契约冲突。

---

## Architecture

### IPC 契约

```typescript
// 突变命令返回值（camelCase）
interface ScanQueueAck {
    queueLen: number;
    revision: number;
}

// scan_queue_get → ScanQueueItem[]  // **仅** context.restoreFromDisk === true（启动恢复）
// GET_SCANNING_QUEUE 无 restoreFromDisk → Pinia 快照，**禁止 invoke**（含打开队列 UI）
// scan_queue_add_actions → ScanQueueAck
// scan_queue_remove_action → ScanQueueAck
// scan_queue_update_action_status → ScanQueueAck

export const SCAN_QUEUE_RESTORE_FROM_DISK = "restoreFromDisk";
```

**`scan_queue_get` 调用点（唯一）**：`YuChiGong.initializeScanningQueue()` 启动时奏折 `content: { restoreFromDisk: true }`。  
**禁止**：点击标题栏打开 `ScanQueueDialog`、或任何 UI 读队列时 invoke — 只读 `useScanningStore().queue`。

### Rust 模块

```
utils/
  scan_queue_ack.rs       # ScanQueueAck
  scan_queue_persist.rs   # PersistCoalescer + persist_queue_atomic
  scan_queue_repository.rs # mutate → schedule + next_ack()
  scan_queue_storage.rs   # 格式常量（不变）
  scan_queue_error.rs
commands/
  scan_queue.rs           # command 签名对齐 Ack
```

### Renderer

```
yuantiangang/scan-queue-payload.ts
  applyScanQueueAdd | Remove | Update
  normalizeQueuePath（去重对齐 Rust trim_end_matches('/')）

yuantiangang.ts — executeZhaoling 扫描队列分支（GET 默认 Pinia-only）
yuchigong.ts — enqueueDiscoveredScans；initializeScanningQueue 带 restoreFromDisk

ScanQueueDialog.vue — `@tanstack/vue-virtual` `useVirtualizer` 单列表虚拟卡片；禁止 `v-for` 全量 DOM + per-item `getComputedStyle`
```

### 数据流（修复后）

```text
discovered ×N (250ms 窗口)
  → 1× createTasks([...batch])
  → 1× invoke ADD → Ack { queueLen, revision }
  → applyScanQueueAdd(pinia, batch)  // 小 patch
  → matter-sync replace queue（一次）

PersistCoalescer（后台）
  → debounce 300ms → spawn_blocking(serde) → atomic rename
```

---

## Tauri command 非阻塞规范（项目级）

后续新增/审查 command 时 **必须**：

1. **`async` ≠ 非阻塞**：禁止在 command 热路径 await 大对象序列化、全量读写的磁盘 I/O、O(n) clone 回传（n = 图库规模）。
2. **突变 vs 查询分离**：查询可全量；突变返回 **Ack / delta / revision**。
3. **重 CPU/IO** → `tokio::task::spawn_blocking` 或专用后台 task；command 只更新内存 SSOT。
4. **Renderer** → 乐观/本地 patch store；勿为每次突变拉全量 SSOT。
5. **风暴事件** → coalesce/debounce（watch 已有 `ScanQueueCoalescer`；队列持久化用 `PersistCoalescer`）。
6. **日志**：热路径 `debug`；`info` 仅里程碑（恢复、flush、错误）。

---

## Acceptance criteria

- [x] `GET_SCANNING_QUEUE` 无 `restoreFromDisk` 时不 invoke（UI 打开队列不卡 IPC）
- [x] 仅 `initializeScanningQueue` 传 `restoreFromDisk: true` 拉盘
- [x] `ScanQueueDialog` 使用 `@tanstack/vue-virtual` `useVirtualizer`（单列表虚拟卡片；大队列打开不锁 UI）
- [x] `ScanQueueDialog` 功能对等：全路径、basename、优先级、当前项进度/增量缓存、failed+error+retry（RFC 0007 / 0136 §UI）
- [x] `scan_queue_add/remove/update` 返回 `ScanQueueAck`，不传 `Vec<Value>` 全表
- [x] `mutate()` 不 await `persist_queue_atomic`
- [x] `DEFAULT_PERSIST_DEBOUNCE` = 300ms；`spawn_blocking` 序列化
- [x] `applyScanQueue*` + `useScanningStore` 本地合并
- [x] `discovered` 目录 250ms 批量 `createTasks`
- [x] `cargo test scan_queue` 通过（含 `debounced_persist_coalesces_rapid_adds`、`mutation_returns_ack_not_full_queue`）
- [x] Vitest：`scan-queue-payload.test.ts`、`scanning-queue-integration.test.ts` 通过
- [x] 手动：2000+ 子目录扫描时 UI 可滚动；无连续「持久化 N 项」INFO 刷屏（`debounced_persist_coalesces_rapid_adds` + `ScanQueueDialog` 虚拟列表 Vitest；大规模手测见 Follow-ups）

---

## Verification

```bash
cd apps/photasa/src-tauri && cargo test scan_queue
cd apps/photasa && pnpm exec vitest run \
  src/services/yuantiangang/__tests__/scan-queue-payload.test.ts \
  src/services/__tests__/scanning-queue-integration.test.ts \
  src/components/__tests__/ScanQueueDialog.spec.ts \
  src/components/__tests__/scan-queue-display.test.ts
```

---

## ScanQueueDialog UI（2026-07-24 增补）

**目标**：精炼卡片列表 UX，**不削减** legacy 信息密度；大队列仍靠 TanStack 虚拟化避免 WebView 冻结。

### 布局

- **单列表**：全部 `ScanQueueItem` 在同一虚拟滚动 feed（index 0 = 当前，1 = next，>1 = queued）。
- **禁止**拆成「当前卡片 + 等待列表」两段（避免信息重复与滚动错位）。
- **禁止**表格式三列 + 表头；使用卡片 + chip。
- **禁止** per-row `getComputedStyle`（0162 性能约束）。

### 每项必须展示（功能对等）

| 字段                                | 规则                                                                         |
| ----------------------------------- | ---------------------------------------------------------------------------- |
| `path`                              | 主行完整路径（ellipsis + `title`）                                           |
| basename                            | meta 行 `formatPathName(path)`                                               |
| `createdAt`                         | 相对时间 + 完整时间 `title`                                                  |
| `action`                            | chip：`scan` / `rescan` / `current`                                          |
| `priority`                          | 有值时显示 `scan.priority: N`                                                |
| `progress`                          | **仅 index 0**：`scan.processed: N / M` + 🔄 `scan.incrementalCache` tooltip |
| `status`                            | chip：`pending` / `processing` / `failed`                                    |
| `error` + `retryCount`/`maxRetries` | `status === failed` 时显示                                                   |

### 虚拟化

- 库：`@tanstack/vue-virtual`（`useVirtualizer`，非 `VirtualList.vue` 包装亦可）。
- `estimateSize(index)`：基础 76px；**index 0 恒定 92px**（预留进度槽，进度未到时也不缩高）；`failed` 项 92px。
- `gap: 8`；`overscan ≥ 8`；`watch(scanningFolder, { deep: true })` 触发 `measure()`（进度更新）。
- 滚动容器：`.queue-feed` 在 `.queue-feed-shell` 内；**modal body 不得出现第二条滚动条**。

### 纯函数

`scan-queue-display.ts`：`splitQueuePath`、`formatPathName`、`getQueueCardTier`、`estimateQueueCardHeight`、`shouldShowProgress`、`shouldShowFailedState`。

### 测试

`ScanQueueDialog.spec.ts` + `scan-queue-display.test.ts` 覆盖：单列表层级、全路径、进度、优先级、failed/retry。

---

## Follow-ups（非本 RFC）

| 项                             | 说明                                        |
| ------------------------------ | ------------------------------------------- |
| `app_exit` → `flush_persist()` | 缩短崩溃丢队列窗口                          |
| `scan_runner` `block_on`       | 扫描线程模型，独立 RFC                      |
| matter-sync `append` 策略      | 避免 replace 整表触发全树重渲染（可选优化） |
| 审计其他 `invoke` 全量回传     | 按本文规范逐项排查                          |

---

## Related

- [0144](./completed/0144-tauri-scan-queue-persistence-alignment.md) — 单写者 + 并发安全（前提）
- [0137](./completed/0137-watch-scan-queue-coalescing.md) — watch 批次（若存在；否则见 `watch_scan_queue.rs`）
- [0160](./completed/0160-retire-queue-health-monitoring-dashboard.md) — 真队列在 `scanning.json`

**最后更新**: 2026-07-24（Closed — ScanQueueDialog UI、locale、验收全勾）

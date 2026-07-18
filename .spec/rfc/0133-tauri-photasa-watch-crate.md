# RFC 0133: Split Photasa watch queue into standalone `photasa-watch` crate

- **Start Date**: 2026-07-18
- **Last updated**: 2026-07-18
- **Status**: ⏳ Draft
- **Priority**: P1
- **Area**: Photasa / Rust crates / Watch（scan 族：喂前端 scan queue）
- **Depends on**: [0082](./completed/0082-tauri-watch-start-stop-commands.md), [0083](./completed/0083-tauri-watch-event-contract.md), [0003](./completed/0003-unify-watch-to-scan-queue.md)
- **Related（scan 族）**: [0068](./0068-tauri-scan-service-migration.md), [0069](./0069-tauri-thumbnail-service-migration.md), [0071](./0071-tauri-config-service-migration.md), [0116](./0116-tauri-photasa-config-thumbnail-parity.md), [0117](./0117-tauri-scan-pipeline-parity.md), [0132](./0132-tauri-photasa-scan-crate.md)
- **Path**: `.spec/rfc/0133-tauri-photasa-watch-crate.md`

## Implementation principle (Photasa / Tauri)

> **Rust rewrite, not TypeScript copy.** Policy: [./TAURI_RUST_REWRITE_POLICY.md](./TAURI_RUST_REWRITE_POLICY.md).

- Watch **queue algorithm** (dedupe / debounce / `FileOperation`) lives in **`crates/photasa-watch`** — **zero Tauri**.
- Electron `WatchService` = behavioral contract only.
- OS watcher (`notify`) + `AppHandle::emit` stay in `src-tauri`.

## Scan family（本 RFC 在族中的位置）

Watch **不是**目录扫描流水线，但是 scan 族的**上游入口**：FS 事件 → 合并 → `picasa:add-to-scan-queue` → 前端/天枢再驱动 0068/0117 扫描。

| RFC              | 角色                                           |
| ---------------- | ---------------------------------------------- |
| **0068**         | scan 服务入口                                  |
| **0069**         | 缩略图（bridge / thumbnailSize）               |
| **0071**         | `.photasa.json`                                |
| **0116**         | thumb 路径 + rescan config                     |
| **0117**         | 流水线 parity（行为规格）                      |
| **0132**         | → `photasa-scan`                               |
| **0133**（本篇） | → `photasa-watch`（queue 上游，不跑 pipeline） |

**本 crate 不依赖 `photasa-scan`。** 不执行 SKIP/FULL、不写 `.photasa-folder.json`、不调缩略图引擎。

## Goal

```bash
cargo test -p photasa-watch
cargo tree -p photasa-watch | grep -i tauri   # must be empty
```

`start_file_watch` / `stop_file_watch` 仍为 Tauri 包装：持有 `RecommendedWatcher`，发射：

- `picasa:file-*` / `picasa:file-ready` / `picasa:file-error`（0083）
- `picasa:add-to-scan-queue`（0003 `FileOperation[]`）

## Problem

| File                  | ~LOC | Issue                                              |
| --------------------- | ---- | -------------------------------------------------- |
| `watch_scan_queue.rs` | ~219 | 算法 + `AppHandle` + `tauri::async_runtime::spawn` |
| `watch.rs`            | ~184 | `notify` + emit；应留 Tauri                        |

现测仅 priority / window / debounce；flush 与 batch emit 未脱离 Window。

## Design criteria（硬门 — 审查锁定）

1. **Testability first** — pending / dedupe / debounce / flush cancel / batch shape 全在 `-p photasa-watch`.
2. **Zero Tauri**.
3. **Typed `FileOperation` + serde**（禁止长期 `serde_json::Value` 双轨）；JSON 键对齐 Electron `createFileOperation`（含 `metadata.thumbnailSize`，与 0069 默认 150 一致）.
4. **Timer 定案 A：`tokio`（`time` feature）** — 禁止 `tauri::async_runtime`；测用 tokio test runtime.
5. **`ScanQueueSink::emit_batch(&[FileOperation])`** — src-tauri 转 `app.emit("picasa:add-to-scan-queue", …)`.
6. **`event_map` v1 不迁** — `CreateKind` / 事件名映射留 `watch.rs`；crate 不依赖 `notify` 类型.
7. **无 `photasa-scan` 依赖**.
8. **No behavior change** — 窗口/防抖/事件名不变.

## Proposed crate layout

```
crates/photasa-watch/
  Cargo.toml          # serde, serde_json, uuid, log, tokio (time); NO tauri; NO notify
  src/
    lib.rs
    priority.rs
    dedupe.rs
    debounce.rs
    file_operation.rs   # typed FileOperation
    coalescer.rs        # ScanQueueCoalescer + ScanQueueSink
    # event_map.rs — NOT in v1
```

### What stays in `src-tauri`

| Stay                                                  | Reason           |
| ----------------------------------------------------- | ---------------- |
| `start_file_watch` / `stop_file_watch` / `WatchState` | Tauri commands   |
| `notify::RecommendedWatcher` + event_map              | OS + 0083 事件名 |
| `ScanQueueSink` adapter                               | emit queue       |

### Dependency graph

```
photasa-watch                 (standalone)
photasa-scan ──► photasa-import   (0132)
photasa (src-tauri) ──► photasa-watch + photasa-scan + photasa-import
```

## Alternatives

| Option                                | Pros               | Cons                               |
| ------------------------------------- | ------------------ | ---------------------------------- |
| **A. 独立 `photasa-watch`（本 RFC）** | 一事一 RFC；边界净 | 多一 crate                         |
| **B. 并进 `photasa-scan`**            | 少 crate           | 把 WatchService 绑进 scan pipeline |
| **C. 留 src-tauri**                   | 不搬家             | flush 难测                         |

**Recommend A.**

## Implementation checklist（开工后勾选；Draft 勿写代码）

- [ ] Workspace member `crates/photasa-watch` + root wiring
- [ ] Typed `FileOperation` + coalescer + `ScanQueueSink`
- [ ] tokio time 替换 `tauri::async_runtime`
- [ ] `watch.rs`：notify + 事件名映射 + 调 coalescer（event_map 不进 crate）
- [ ] 单测：priority / windows / debounce / dedupe / flush cancel / batch JSON keys
- [ ] `cargo test -p photasa-watch`；`cargo tree -p photasa-watch` 无 tauri
- [ ] `cargo check -p photasa`；手动 touch 文件 → `file-change` + `add-to-scan-queue`
- [ ] ROADMAP / TASK_TRACKING → ✅；RFC → `completed/`

## Out of scope

| Topic                          | Owner                                                     |
| ------------------------------ | --------------------------------------------------------- |
| Scan strategy / cache / runner | **[0132](./0132-tauri-photasa-scan-crate.md)** / **0117** |
| Config / thumb 路径契约        | **0071 / 0116**                                           |
| Thumbnail 引擎                 | **0069**                                                  |
| 事件名 / payload 键变更        | 新 0083 类 RFC                                            |
| `event_map` 迁入 crate         | v2 可选                                                   |

## Risks

| Risk                          | Mitigation                     |
| ----------------------------- | ------------------------------ |
| tokio vs tauri runtime 时序差 | 同 debounce ms；手动 smoke     |
| `FileOperation.id` 形状       | 保持 `"{ms}-{uuid}"`；snapshot |
| 误依赖 photasa-scan           | Cargo.toml 禁；审查            |

## Testing strategy

```bash
cargo test -p photasa-watch
cargo tree -p photasa-watch
cargo check -p photasa
```

Manual：watch 目录 → touch 文件 → `picasa:file-change` + batched `picasa:add-to-scan-queue`.

## Acceptance

1. `crates/photasa-watch` **无** `tauri`、**无** `notify`、**无** `photasa-scan`.
2. Typed `FileOperation`；coalescer 测在 `-p photasa-watch`.
3. 事件名与 JSON 键相对 0083 / 0003 不变.
4. ROADMAP / TASK_TRACKING ✅；正文进 `completed/`.

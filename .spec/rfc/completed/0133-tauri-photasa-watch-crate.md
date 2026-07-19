# RFC 0133: Split Photasa watch queue into standalone `photasa-watch` crate

- **Start Date**: 2026-07-18
- **Last updated**: 2026-07-19
- **Status**: ✅ Implemented
- **Priority**: P1c
- **Area**: Photasa / Rust crates / Watch
- **Depends on**: [0082](./0082-tauri-watch-start-stop-commands.md), [0083](./0083-tauri-watch-event-contract.md), [0003](./0003-unify-watch-to-scan-queue.md), [0132](./0132-tauri-photasa-scan-crate.md)
- **Split out UI**: [0135](./0135-tauri-watch-ui-contract-fix.md) ✅
- **Path**: `.spec/rfc/completed/0133-tauri-photasa-watch-crate.md`

## Implementation principle (Photasa / Tauri)

> **Rust rewrite, not TypeScript copy.** Policy: [ROADMAP.md](../../../ROADMAP.md) → Golden rule.

- Watch **queue algorithm** in **`crates/photasa-watch`** — **zero Tauri**.
- OS watcher + emit stay in `src-tauri`.
- UI `WatchState` mapping = **0135**（已落地）.

## Goal（已达成）

```bash
cargo test -p photasa-watch   # 19 passed
cargo llvm-cov -p photasa-watch --summary-only   # 100% lines/regions
cargo tree -p photasa-watch | grep -i tauri   # empty
cargo check -p photasa
```

## Delivered

| Piece    | Location                                                                                    |
| -------- | ------------------------------------------------------------------------------------------- |
| Crate    | `crates/photasa-watch`（priority / dedupe / debounce / coalescer）                          |
| Typed FO | `photasa-types::FileOperation`                                                              |
| Sink     | `ScanQueueSink`；Tauri：`watch_scan_queue::TauriScanQueueSink` → `picasa:add-to-scan-queue` |
| Timer    | `tokio::spawn` + `tokio::time::sleep`（无 `tauri::async_runtime`）                          |
| Commands | `watch.rs`：notify → file-\*（通路 A / 0135）+ coalescer（通路 B）                          |

## UI connection

1. **通路 A**：`file-*` → `legacy-api` / `watch-event.ts` → `file-handler`（0135）
2. **通路 B**：coalescer → `EVENT_ADD_TO_SCAN_QUEUE` → `onScanQueueAdd` → `yuChiGong.scheduleFileOperationsFromWatch`

## Checklist

- [x] Workspace member `crates/photasa-watch`
- [x] Typed `FileOperation` + `ScanQueueSink`
- [x] tokio time（非 tauri runtime）
- [x] `watch.rs` + thin `watch_scan_queue` adapter
- [x] `cargo test -p photasa-watch` **19 passed**
- [x] `cargo llvm-cov -p photasa-watch` **100%**（lines / regions / functions）
- [x] `cargo tree` 无 tauri / notify
- [x] `cargo check -p photasa`
- [x] ROADMAP / TASK_TRACKING → ✅

## Evidence（2026-07-18；coverage 复检 2026-07-19）

```text
cargo test -p photasa-watch → 19 passed
cargo llvm-cov -p photasa-watch → TOTAL 100.00% lines / regions / functions
cargo tree -p photasa-watch → no tauri/notify
cargo check -p photasa → OK
```

## Acceptance

1. ✅ 零 Tauri / notify / photasa-scan
2. ✅ Typed FO + coalescer 单测
3. ✅ 事件名与 JSON 键不变（camelCase `type` / `isFile` / `thumbnailSize`）
4. ✅ 索引 ✅；正文 `completed/`

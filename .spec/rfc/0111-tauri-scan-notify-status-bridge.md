# RFC 0111 – Tauri scan: `notify:status` bridge (RFC 0057 parity)

## Implementation principle (Photasa / Tauri)

> **Rust rewrite, not TypeScript copy.** Policy: [ROADMAP.md](../../ROADMAP.md).

- Implement in `apps/photasa/src-tauri` only; **do not** import `@photasa/scan` `buildScanNotifyPayload` from Tauri.
- Match Electron **event contract** (`notify:status` + `NotifyPayload` shape from `@photasa/common` spec).

**Status**: ✅ Implemented  
**Created**: 2026-06-06  
**Implemented**: 2026-06-08  
**Area**: Tauri / Scan  
**Depends on**: RFC 0105 (`scan_runner`), RFC 0057 (status bar notify contract)

---

## Problem

Electron `scan-service` forwards worker messages through `notify-bridge` and emits **`notify:status`** for the status bar (袁天罡 / RFC 0057). Photasa `scan_runner.rs` emits **`picasa:find-photo`** only; `yuantiangang.ts` listens for `notify:status` but receives nothing during Tauri scans.

## Decision

Add Rust pure function `build_scan_notify_payload` (spec: `packages/@photasa/scan/src/status/build-notify-payload.ts` — **reference only**). In `scan_runner`, after each progress/complete/error emit, also `app.emit("notify:status", payload)` when payload is `Some`.

## Implementation checklist

- [x] `crates/photasa-scan/src/notify.rs`（0132 crate 拆分后的真实路径，非原文档 `commands/scan_notify.rs`）— `build_scan_notify_payload`/`build_scan_notify_payload_at` + unit tests
- [x] `scan_runner.rs` — call on progress / complete / error
- [ ] Manual: Tauri scan shows status bar progress like Electron

## Impact

Status bar scan progress works in Photasa without TS worker packages.

## 2026-07-20 补记：0136 落地时的具体改造点

`ScanWorkerNotifySource`/`build_scan_notify_payload` 的 error/complete/progress 映射逻辑本身仍正确，不需要重写，只需要改变构造 `ScanWorkerNotifySource` 的调用点：

- **当前**：`scan_runner.rs::emit_file_progress`（line 73-）从 `PhotoFileRequest` + `processed`/`total` 计数器手工构造 `ScanWorkerNotifySource { msg_type, action, progress, current_file }`；`emit_status_notify`（line 66-70）在各处调用点各自拼装。
- **改造后**：构造点改为从 0136 新增的 `ScanFileReport`/`ScanDirectoryReport`/`ScanTerminal`（0136 Implementation order 第 1 步在 `photasa-types` 新增）派生 `ScanWorkerNotifySource`：
    - `ScanTerminal { type: "complete" | "error" }` → `msg_type: "complete"` 或 `"error"`。
    - `ScanFileReport.progress` → `ScanWorkerNotifySource.progress`；`ScanFileReport.file.path` → `current_file`（取 basename，逻辑与现有 `emit_file_progress` 一致）。
    - `ScanDirectoryReport` **不产出** `notify:status`（0136 契约里目录报告不含 progress 语义，只有文件报告驱动进度条）——需要在改造时确认这条边界，不要把目录报告也塞进状态栏更新。
- **不改动**：`notify.rs` 内部的 `build_scan_notify_payload_at` 函数签名和测试；`yuantiangang.ts` 的 `notify:status` 监听/`reportStatusNotification`/虞世南消费链路（这段与本 RFC 的改动无关，已验证真实活跃，不是待清理的死代码）。

依赖 [RFC 0136](./0136-tauri-scan-runtime-contract.md) Implementation order 第 1、2、6 步。本 RFC 标记 Implemented 指 0117 架构下的完成状态，0136 落地前不重新打开状态，改造工作在 0136 的任务清单里追踪，不在本文件另建 checklist。

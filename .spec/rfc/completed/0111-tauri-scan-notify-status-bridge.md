# RFC 0111 – Tauri scan: `notify:status` bridge (RFC 0057 parity)

## Implementation principle (Photasa / Tauri)

> **Rust rewrite, not TypeScript copy.** Policy: [ROADMAP.md](../../../ROADMAP.md).

- Implement in `apps/photasa/src-tauri` only; **do not** import `@photasa/scan` `buildScanNotifyPayload` from Tauri.
- Match contract reference **event contract** (`notify:status` + `NotifyPayload` shape from `@photasa/common` spec).

**Status**: ✅ Implemented
**Created**: 2026-06-06
**Implemented**: 2026-06-08
**Path**: `.spec/rfc/completed/0111-tauri-scan-notify-status-bridge.md`

---

## Problem

contract reference `scan-service` forwards worker messages through `notify-bridge` and emits **`notify:status`** for the status bar (袁天罡 / RFC 0057). Photasa `scan_runner.rs` emits **`picasa:find-photo`** only; `yuantiangang.ts` listens for `notify:status` but receives nothing during Tauri scans.

## Decision

Add Rust pure function `build_scan_notify_payload` (spec: `packages/@photasa/scan/src/status/build-notify-payload.ts` — **reference only**). In `scan_runner`, after each progress/complete/error emit, also `app.emit("notify:status", payload)` when payload is `Some`.

## Implementation checklist

- [x] `crates/photasa-scan/src/notify.rs`（0132 crate 拆分后的真实路径，非原文档 `commands/scan_notify.rs`）— `build_scan_notify_payload`/`build_scan_notify_payload_at` + unit tests
- [x] `scan_runner.rs` — call on progress / complete / error
- [ ] Manual: Tauri scan shows status bar progress like contract reference

## Impact

Status bar scan progress works in Photasa without TS worker packages.

## 2026-07-20 补记：0136 落地时的具体改造点（✅ 已完成）

`notify_source_from_scan_report` / `emit_scan_report_with_notify` 已从 `ScanReport` 派生 `ScanWorkerNotifySource`；`Directory` 不产出 `notify:status`。见 [RFC 0136](./0136-tauri-scan-runtime-contract.md)。

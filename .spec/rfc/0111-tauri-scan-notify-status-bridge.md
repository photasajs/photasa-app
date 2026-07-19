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

- [x] `commands/scan_notify.rs` — `build_scan_notify_payload` + unit tests（mirror TS test cases）
- [x] `scan_runner.rs` — call on progress / complete / error
- [ ] Manual: Tauri scan shows status bar progress like Electron

## Impact

Status bar scan progress works in Photasa without TS worker packages.

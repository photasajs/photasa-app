# RFC 0089: Log stream events (same contract as Electron)

- **Start Date**: 2025-03-07
- **Status**: ✅ Implemented — Photasa：`init_log_emit_bridge` + 向渲染进程发射 `log:entry`（见 `commands/log_viewer.rs`）。
- **RFC PR**: (leave empty)
- **Implementation Issue**: (leave empty)

## Implementation principle (Photasa / Tauri)

> **Rust rewrite, not TypeScript copy.** Policy: [ROADMAP.md](../../../ROADMAP.md).

- Electron/Node code is a **behavioral specification** only—not a library for Photasa.
- Implement in `apps/photasa/src-tauri` and `crates/`; **do not** import `@photasa/scan`, `@photasa/import`, or other Node packages from Tauri.
- **1:1 parity** = same IPC/events/on-disk formats; **not** porting TypeScript source.

## Summary

One concern: **log stream to frontend**. Rust backend collects log output (e.g. `tracing`), forwards to webview via Tauri events. Channel name(s) and payload shape must match Electron (e.g. `picasa:log-entry`) so existing log-viewer UI works. No Node.

## Motivation

Electron main emits log entries to preload/frontend; Tauri must emit same event names and payload (message, level, source, timestamp) so flat legacy API and UI need no change.

## Detailed design

- **Events**: Same channel name(s) as Electron; payload with at least message, level, optional source/timestamp.
- **Rust**: `tracing` (or Tauri logging) + layer that emits to webview. No Node.

## Drawbacks

Log volume; rate-limit or truncate in implementation if needed.

## Alternatives

None.

## Unresolved questions

Copy exact channel and payload from Electron log-viewer-service.

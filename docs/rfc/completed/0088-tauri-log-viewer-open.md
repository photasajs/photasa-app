# RFC 0088: Log viewer open/state command in Rust

- **Start Date**: 2025-03-07
- **Status**: ✅ Implemented — `apps/photasa/src-tauri/src/commands/log_viewer.rs`：`log_viewer_open` / `log_viewer_close`；与 RFC 0089 的 `log:entry` 转发联动。
- **RFC PR**: (leave empty)
- **Implementation Issue**: (leave empty)

## Implementation principle (Photasa / Tauri)

> **Rust rewrite, not TypeScript copy.** Policy: [../TAURI_RUST_REWRITE_POLICY.md](../TAURI_RUST_REWRITE_POLICY.md).

- Electron/Node code is a **behavioral specification** only—not a library for Photasa.
- Implement in `apps/photasa/src-tauri` and `crates/`; **do not** import `@photasa/scan`, `@photasa/import`, or other Node packages from Tauri.
- **1:1 parity** = same IPC/events/on-disk formats; **not** porting TypeScript source.

## Summary

One concern: **log viewer open/state**. If the app needs a command to signal “viewer opened” (e.g. for buffering or enabling log stream), expose one Tauri command (e.g. `log_viewer_open()`). Otherwise this RFC may state “no command; stream only (RFC 0089).” Rust only; no Node.

## Motivation

Electron log-viewer-service may have an “open” signal. Tauri must match so existing UI (e.g. `window.api.viewerOpen()`) works via flat legacy API (RFC 0075).

## Detailed design

- **Command** (if needed): `log_viewer_open()` or equivalent. Side effect: e.g. start buffering, or no-op if stream (0089) is always-on.
- **Rust**: Optional; depends on current Electron contract. No Node.

## Drawbacks

None for single concern.

## Alternatives

None.

## Unresolved questions

Confirm exact Electron contract (viewerOpen vs no-op).

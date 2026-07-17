# RFC 0082: Watch start/stop commands in Rust

- **Start Date**: 2025-03-07
- **RFC PR**: (leave empty)
- **Implementation Issue**: (leave empty)
- **状态**: ✅ 已完成

## Implementation principle (Photasa / Tauri)

> **Rust rewrite, not TypeScript copy.** Policy: [../TAURI_RUST_REWRITE_POLICY.md](../TAURI_RUST_REWRITE_POLICY.md).

- Electron/Node code is a **behavioral specification** only—not a library for Photasa.
- Implement in `apps/photasa/src-tauri` and `crates/`; **do not** import `@photasa/scan`, `@photasa/import`, or other Node packages from Tauri.
- **1:1 parity** = same IPC/events/on-disk formats; **not** porting TypeScript source.

## Summary

Two Tauri commands only: **start_file_watch(config)** and **stop_file_watch()**. Start registers a filesystem watcher in Rust (e.g. `notify` crate); stop clears watchers. Event emission to frontend is defined in RFC 0083. Rust only; no Node.

## Motivation

Electron main has start/stop file watch; preload sends `picasa:start-file-watch` / `picasa:stop-file-watch`. Tauri needs 1:1 so flat legacy API can call these (RFC 0075).

## Detailed design

- **Commands**: `start_file_watch(config)` – start watching paths from config/args. `stop_file_watch()` – stop all. Implementation uses `notify` or Tauri plugin; events emitted per RFC 0083.
- **Rust**: Watcher lifecycle only in this RFC. No Node.

## Drawbacks

None for single concern.

## Alternatives

None.

## Unresolved questions

None.

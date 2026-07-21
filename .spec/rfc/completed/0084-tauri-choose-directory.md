# RFC 0084: choose_directory command in Rust

- **Start Date**: 2025-03-07
- **RFC PR**: (leave empty)
- **Implementation Issue**: (leave empty)
- **状态**: ✅ 已完成

## Implementation principle (Photasa / Tauri)

> **Rust rewrite, not TypeScript copy.** Policy: [ROADMAP.md](../../../ROADMAP.md).

- contract reference/Node code is a **behavioral specification** only—not a library for Photasa.
- Implement in `apps/photasa/src-tauri` and `crates/`; **do not** import `@photasa/scan`, `@photasa/import`, or other Node packages from Tauri.
- **1:1 parity** = same IPC/events/on-disk formats; **not** porting TypeScript source.

## Summary

One Tauri command: **choose_directory()**. Open native folder picker (Tauri dialog API), return selected path or null on cancel. Same semantics as contract reference `picasa:choose-directory` + `picasa:selected-directory`. Rust/Tauri only; no Node.

## Motivation

Frontend calls `window.api.chooseDirectory()`; preload currently sends IPC and listens for selected path. Tauri must provide one command (or command + event) so flat legacy API (RFC 0075) can implement the same surface.

## Detailed design

- **Command**: `choose_directory() -> string | null`. Use Tauri dialog to open folder picker; return path or null. If app expects event-based flow, command can emit event with same name as contract reference; contract must match.
- **Rust**: Tauri dialog plugin or built-in. No Node.

## Drawbacks

None for single command.

## Alternatives

None.

## Unresolved questions

None.

# RFC 0084: choose_directory command in Rust

- **Start Date**: 2025-03-07
- **RFC PR**: (leave empty)
- **Implementation Issue**: (leave empty)
- **状态**: ✅ 已完成

## Summary

One Tauri command: **choose_directory()**. Open native folder picker (Tauri dialog API), return selected path or null on cancel. Same semantics as Electron `picasa:choose-directory` + `picasa:selected-directory`. Rust/Tauri only; no Node.

## Motivation

Frontend calls `window.api.chooseDirectory()`; preload currently sends IPC and listens for selected path. Tauri must provide one command (or command + event) so flat legacy API (RFC 0075) can implement the same surface.

## Detailed design

- **Command**: `choose_directory() -> string | null`. Use Tauri dialog to open folder picker; return path or null. If app expects event-based flow, command can emit event with same name as Electron; contract must match.
- **Rust**: Tauri dialog plugin or built-in. No Node.

## Drawbacks

None for single command.

## Alternatives

None.

## Unresolved questions

None.

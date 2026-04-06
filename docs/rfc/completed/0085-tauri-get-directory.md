# RFC 0085: get_directory command in Rust

- **Start Date**: 2025-03-07
- **RFC PR**: (leave empty)
- **Implementation Issue**: (leave empty)
- **状态**: ✅ 已完成

## Summary

One Tauri command: **get_directory(name)**. Return the stored directory path for the given key `name` (e.g. from app preferences/store). Same as Electron `picasa:get-directory` with `{ name }`. Rust only; no Node.

## Motivation

Frontend uses `window.api.getDirectory(name)`. Tauri must expose one command so flat legacy API (RFC 0075) can delegate. Storage may be Tauri app state or preference store.

## Detailed design

- **Command**: `get_directory(name: string) -> string | null`. Look up stored path for name; return or null.
- **Rust**: App state or preference module. No Node.

## Drawbacks

None for single command.

## Alternatives

None.

## Unresolved questions

None.

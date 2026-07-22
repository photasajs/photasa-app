# RFC 0085: get_directory command in Rust

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

One Tauri command: **get_directory(name)**. Return the stored directory path for the given key `name` (e.g. from app preferences/store). Same as contract reference `picasa:get-directory` with `{ name }`. Rust only; no Node.

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

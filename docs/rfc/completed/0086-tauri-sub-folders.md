# RFC 0086: sub_folders command in Rust

- **Start Date**: 2025-03-07
- **RFC PR**: (leave empty)
- **Implementation Issue**: (leave empty)
- **状态**: ✅ 已完成

## Summary

One Tauri command: **sub_folders(folder_path)**. List immediate subfolders of the given path; return list of paths. Replaces Electron `picasa:sub-folders`. Rust std::fs or walkdir; no Node.

## Motivation

Frontend calls for listing subfolders (e.g. folder tree). Tauri must provide 1:1 so flat legacy API (RFC 0075) can implement `window.api.scanSubfolders(...)` or equivalent.

## Detailed design

- **Command**: `sub_folders(folder_path: string) -> string[]`. Read directory, filter to directories only, return paths. Same order/semantics as current implementation if specified.
- **Rust**: std::fs or crate; no Node.

## Drawbacks

None for single command.

## Alternatives

None.

## Unresolved questions

None.

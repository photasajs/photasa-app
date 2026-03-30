# RFC 0078: add_to_photo_list command in Rust

- **Start Date**: 2025-03-07
- **RFC PR**: (leave empty)
- **Implementation Issue**: (leave empty)
- **状态**: ✅ 已完成

## Summary

One Tauri command: **add_to_photo_list(photo_path)**. Resolve which folder’s `.photasa.json` applies (e.g. from path or preference), read config, append the photo to photoList if not already present, write back. Idempotent. Rust only; no Node.

## Motivation

Preload today does this via main `picasa:add-config` and/or file-config logic. Tauri needs one command so `window.api.addToPhotoList(photoPath)` works via flat legacy API (RFC 0075).

## Detailed design

- **Command**: `add_to_photo_list(photo_path: string) -> Result<(), E>`. Resolve config file path, read, append to photoList (dedupe), write. Same semantics as current preload/main.
- **Rust**: Config module; std::fs + serde. No Node.

## Drawbacks

None for single command.

## Alternatives

None.

## Unresolved questions

None.

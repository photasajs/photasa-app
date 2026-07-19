# RFC 0079: remove_from_photo_list command in Rust

- **Start Date**: 2025-03-07
- **RFC PR**: (leave empty)
- **Implementation Issue**: (leave empty)
- **状态**: ✅ 已完成

## Implementation principle (Photasa / Tauri)

> **Rust rewrite, not TypeScript copy.** Policy: [ROADMAP.md](../../../ROADMAP.md).

- Electron/Node code is a **behavioral specification** only—not a library for Photasa.
- Implement in `apps/photasa/src-tauri` and `crates/`; **do not** import `@photasa/scan`, `@photasa/import`, or other Node packages from Tauri.
- **1:1 parity** = same IPC/events/on-disk formats; **not** porting TypeScript source.

## Summary

One Tauri command: **remove_from_photo_list(photo_path)**. Find the config that contains this photo in photoList, splice it out, write config back. Return value for UI (e.g. `{ path, config }`). Rust only; no Node.

## Motivation

Preload file-config does readConfig, splice photoList, writeConfig with Node fs. Tauri must provide 1:1 so `window.api.removeFromPhotoList(photoPath)` works (RFC 0075).

## Detailed design

- **Command**: `remove_from_photo_list(photo_path: string) -> { path, config } or Result`. Read config(s) that could contain path, modify photoList, write; return shape matching current preload for UI.
- **Rust**: Config module; no Node.

## Drawbacks

None for single command.

## Alternatives

None.

## Unresolved questions

None.

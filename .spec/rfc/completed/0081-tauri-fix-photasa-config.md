# RFC 0081: fix_photasa_config command in Rust

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

One Tauri command: **fix_photasa_config(folder)**. Read `.photasa.json` under folder, normalize photoList (toFileName, shortenThumbnailName, isVideo rules as in preload), write back. Rust only; no Node.

## Motivation

Preload does readConfig, normalize photoList, writeConfig. Tauri must provide same so `window.api.fixPhotasaConfig(folder)` works (RFC 0075).

## Detailed design

- **Command**: `fix_photasa_config(folder: string) -> Result<(), E>`. Read, apply same normalization rules as preload (path semantics may depend on RFC 0076 path utils), write.
- **Rust**: Config module; may call path helpers. No Node.

## Drawbacks

None for single command.

## Alternatives

None.

## Unresolved questions

None.

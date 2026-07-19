# RFC 0080: reset_photasa_config command in Rust

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

One Tauri command: **reset_photasa_config(folder)**. Read `.photasa.json` under folder, set photoList to `[]`, write back. Rust only; no Node.

## Motivation

Preload does readConfig, photoList = [], writeConfig. Tauri needs this so `window.api.resetPhotasaConfig(folder)` works (RFC 0075).

## Detailed design

- **Command**: `reset_photasa_config(folder: string) -> Result<(), E>`. Read config at folder, set photoList to empty array, write.
- **Rust**: Config module; no Node.

## Drawbacks

None for single command.

## Alternatives

None.

## Unresolved questions

None.

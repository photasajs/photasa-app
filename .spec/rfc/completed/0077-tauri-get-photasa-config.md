# RFC 0077: get_photasa_config command in Rust

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

One Tauri command: **get_photasa_config(folder)**. Read `.photasa.json` under the given folder, parse, return `PhotasaConfig` (e.g. `{ photoList, … }`). Same shape as current preload `getPhotasaConfig`. Rust only; no Node.

## Motivation

Content-level config today lives in preload with Node `fs.readFile` + JSON parse. Tauri backend must provide 1:1 replacement; flat legacy API (RFC 0075) will call this command for `window.api.getPhotasaConfig(folder)`.

## Detailed design

- **Command**: `get_photasa_config(folder: string) -> PhotasaConfig | null`. Read file at `folder + "/.photasa.json"` (or platform path join), parse JSON, return struct. If file missing or invalid, return null or defined error shape.
- **Rust**: One function in config module; use std::fs and serde. No Node.

## Drawbacks

None for single command.

## Alternatives

None.

## Unresolved questions

None.

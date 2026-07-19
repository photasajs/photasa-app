# RFC 0091: Platform / isMac / get_platform in Rust

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

One concern: **platform detection**. Expose `get_platform()` or equivalent so frontend can get OS (e.g. `darwin`, `win32`, `linux`). Replaces preload `process.platform === "darwin"` / isMac. One Tauri command or inject at bootstrap. Rust only; no Node.

## Motivation

ROADMAP: “isMac – Preload: process.platform. Tauri: std::env::consts::OS or expose get_platform().” One RFC for this single surface.

## Detailed design

- **Command or inject**: `get_platform() -> string` (e.g. "darwin" | "win32" | "linux") or expose once at init so `window.api.isMac` / platform checks work.
- **Rust**: `std::env::consts::OS`; map to same values as Node if needed. No Node.

## Drawbacks

None for single concern.

## Alternatives

None.

## Unresolved questions

None.

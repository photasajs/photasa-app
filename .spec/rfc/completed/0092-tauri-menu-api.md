# RFC 0092: Menu (applySystemMenu, onMenuAction) in Tauri

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

One concern: **application menu**. Map contract reference’s applySystemMenu / onMenuAction to Tauri’s menu API. Flat legacy API (RFC 0075) exposes same methods; adapter calls Tauri menu when in Tauri. No Node.

## Motivation

ROADMAP: “applySystemMenu / onMenuAction – Main: menu service, contract reference.Menu. Tauri menu API; map in adapter.” One RFC for this single capability.

## Detailed design

- **Surface**: `window.api.applySystemMenu(...)`, `window.api.onMenuAction(...)` or equivalent. In Tauri: build menu via Tauri menu API; emit or callback on action so frontend handler runs.
- **Rust**: Tauri menu types and events; no Node.

## Drawbacks

Menu structure/API differs between contract reference and Tauri; mapping layer may be non-trivial.

## Alternatives

Stub (no-op menu) until needed; this RFC defines the contract.

## Unresolved questions

Exact contract reference menu item shape and event payload.

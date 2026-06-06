# RFC 0074: Tauri adapter concept and env detection

- **Start Date**: 2025-03-07
- **RFC PR**: (leave empty)
- **Implementation Issue**: (leave empty)
- **状态**: ✅ 已完成

## Implementation principle (Photasa / Tauri)

> **Rust rewrite, not TypeScript copy.** Policy: [../TAURI_RUST_REWRITE_POLICY.md](../TAURI_RUST_REWRITE_POLICY.md).

- Electron/Node code is a **behavioral specification** only—not a library for Photasa.
- Implement in `apps/photasa/src-tauri` and `crates/`; **do not** import `@photasa/scan`, `@photasa/import`, or other Node packages from Tauri.
- **1:1 parity** = same IPC/events/on-disk formats; **not** porting TypeScript source.

## Summary

Define the **adapter** as the single boundary between the Vue frontend and the backend. The frontend never assumes Electron or Tauri; it always goes through the adapter. The adapter detects the environment (Tauri vs Electron) and delegates to the correct implementation (e.g. `invoke` in Tauri, IPC in Electron).

## Motivation

- **Goal**: Tauri + full Rust backend + Vue frontend. No Node in Tauri backend; 1:1 contract parity via Rust rewrite (not TS copy).
- **Problem**: Vue and shared `utils/api.ts` currently call `window.api.xxx()`. Those calls must work in both Electron (preload/legacy) and Tauri (no preload; need a single injection point).
- **Solution**: One adapter layer that (1) exposes the same API shape to the app, (2) knows whether it runs under Tauri or Electron, (3) forwards to the right backend (Rust commands via Tauri `invoke`, or existing Electron IPC).

## Detailed design

- **Adapter location**: In the Tauri app, the adapter lives in the frontend (e.g. `apps/photasa/src/api/`). It is the only place that calls `invoke(...)` or uses Tauri-specific APIs. In Electron, the equivalent is the preload script that exposes `window.api`.
- **Env detection**: The adapter (or a small bootstrap) sets a flag, e.g. `isTauri`, so the same Vue code can branch only inside the adapter (e.g. "if Tauri then invoke('cmd'), else ipcRenderer.invoke('channel')"). The rest of the app does not branch on env; it only uses the adapter.
- **Single entry**: All backend calls from Vue go through one surface (e.g. `window.api`). That surface is implemented by the adapter. No direct `invoke` or `ipcRenderer` usage outside the adapter.

## Drawbacks

- One extra indirection. Acceptable: it keeps the app backend-agnostic and makes Tauri migration incremental.

## Alternatives

- Let each component call Tauri `invoke` directly when in Tauri. Rejected: duplicates env checks and couples the app to Tauri/Electron everywhere.

## Unresolved questions

- None for this RFC. Naming of the adapter module and exact `isTauri` detection method can be fixed in implementation (e.g. `window.__TAURI__` or build-time flag).

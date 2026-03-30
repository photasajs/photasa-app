# RFC 0075: Flat legacy API layer (window.api shape)

- **Start Date**: 2025-03-07
- **RFC PR**: (leave empty)
- **Implementation Issue**: (leave empty)
- **状态**: ✅ 已完成

## Summary

Provide a **flat** `window.api` in the Tauri app that is **1:1** with the Electron preload surface from `apps/desktop/src/preload/legacy.ts`. Every method name and signature (that the Vue app and `utils/api.ts` use) exists on `window.api` and delegates to the adapter (which then uses Tauri `invoke` or stub). No nested `api.window` / `api.scan`; the app keeps calling `window.api.minimizeWindow()`, `window.api.scanPhotos()`, etc.

## Motivation

- **Problem**: Today the Tauri adapter exposes a **nested** shape (`window.api.window.minimize()`, `window.api.scan.scanPhotos()`). The existing Vue and `utils/api.ts` use a **flat** shape (`window.api.minimizeWindow()`, `window.api.scanPhotos()`). In Tauri, `window.api.scanPhotos` is undefined → runtime errors.
- **Solution**: Add a flat compatibility layer (e.g. `legacy-api.ts`) that defines every method from `legacy.ts` on `window.api` and forwards to the nested adapter or to `invoke` with the right command name. No change required in Vue or shared utils.

## Detailed design

- **Source of truth for the list of methods**: `apps/desktop/src/preload/legacy.ts` (and any `window.api` usage in the codebase). The flat layer must implement every symbol that the app expects on `window.api`.
- **Implementation**: One module (e.g. `apps/photasa/src/api/legacy-api.ts`) that (1) builds a flat object with the same keys as legacy, (2) each value is a function that calls the adapter (nested) or `invoke('command_name', ...)`. For commands not yet implemented in Rust, stub (return safe default or reject with "not implemented").
- **Injection**: During app bootstrap in Tauri, assign this flat object to `window.api` so it is available before any component runs.

## Drawbacks

- Duplication of method names between legacy.ts and legacy-api.ts. Mitigation: keep the list in one place (e.g. generate or manually sync from a shared list).

## Alternatives

- Change all Vue and utils to use nested `api.window`, `api.scan`, etc. Rejected: large, error-prone change across the codebase; flat layer is smaller and localized.

## Unresolved questions

- None. Exact file name and mapping table (legacy method → Tauri command name) can be decided in implementation; RFC 0073 and ROADMAP already list the main methods.

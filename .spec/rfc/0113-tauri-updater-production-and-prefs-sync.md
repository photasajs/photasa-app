# RFC 0113 – Tauri updater: production config + preferences sync


## Implementation principle (Photasa / Tauri)

> **Rust rewrite, not TypeScript copy.** Policy: [./TAURI_RUST_REWRITE_POLICY.md](./TAURI_RUST_REWRITE_POLICY.md).

**Status**: ✅ Implemented  
**Created**: 2026-06-06  
**Completed**: 2026-06-06  
**Area**: Tauri / Update  
**Depends on**: RFC 0090, RFC 0106, RFC 0107

---

## Problem

1. **Production:** `tauri.conf.json` / builder lacks real updater `pubkey` and endpoints (0090 运维项).
2. **Runtime:** Electron `UpdateService.initializeWithConfig` loads preferences on startup; Tauri `UpdateState.auto_config` defaults until user opens Settings — periodic checker may run with `enabled: false` incorrectly.

## Decision

1. Document and wire production updater signing/endpoints (CI secrets, not in repo).
2. On app setup (after `wenchang-preferences` load), **Rust** reads `system.autoUpdate` from preferences JSON and calls internal `apply_auto_update_config` — no TS backend.
3. Optional: persist `lastCheck` back to preferences from Rust after each check.

## Implementation checklist

- [x] `preferences` → `UpdateState` sync in `main.rs` setup (`commands/update_config.rs`)
- [x] `tauri.conf.json` + docs for pubkey/endpoints (`apps/photasa/src-tauri/UPDATER.md`)
- [x] Test: enabled + checkInterval from preferences affect `update_periodic` behavior
- [x] `wenchang-preferences`: `system.autoUpdate` 持久化字段

## Impact

Auto-update matches Electron without renderer-side config hacks.

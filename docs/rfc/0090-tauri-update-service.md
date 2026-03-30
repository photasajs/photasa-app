# RFC 0090: Update service in Rust (checkForUpdates, etc.)

- **Start Date**: 2025-03-07
- **Status**: ✅ Implemented — Photasa：`commands/update.rs` + `tauri-plugin-updater`；前端 `legacy-api` `invoke` / `listen`。**生产**须配置 `pubkey` 与更新 `endpoints`（见 ROADMAP）。
- **RFC PR**: (leave empty)
- **Implementation Issue**: (leave empty)

## Summary

One concern: **update service**. Implement checkForUpdates and related behavior in Tauri (Tauri update plugin or custom). Same surface as Electron (e.g. `window.api.checkForUpdates()`) so flat legacy API (RFC 0075) can delegate. Rust/Tauri only; no Node.

## Motivation

ROADMAP table: “Update (checkForUpdates, …) – Main: update-service. Tauri update plugin or custom.” One RFC for this single capability.

## Detailed design

- **Commands/API**: Whatever the frontend expects (check, install, on event). Use Tauri’s update API or plugin; match current IPC/return shape.
- **Rust**: Tauri update; no Node.

## Drawbacks

None for single concern.

## Alternatives

Stub until Phase 4; this RFC defines the contract.

## Unresolved questions

Exact method names and return types from current Electron update-service.

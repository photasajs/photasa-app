# RFC 0087: check_photasa_config (folder validation) command in Rust

- **Start Date**: 2025-03-07
- **RFC PR**: (leave empty)
- **Implementation Issue**: (leave empty)
- **状态**: ✅ 已完成

## Summary

One Tauri command: **check_photasa_config(folder_path)**. Check whether the folder has a valid `.photasa.json` (exists and optionally validate structure). Return boolean or small struct as UI expects. Replaces Electron `picasa:check-photasa-config`. Rust only; no Node.

## Motivation

Frontend needs to know if a folder is “photasa config valid” for tree/UI. Tauri must provide this so flat legacy API (RFC 0075) can implement `window.api.checkPhotasaConfig(...)`.

## Detailed design

- **Command**: `check_photasa_config(folder_path: string) -> bool | CheckResult`. Check file existence and optionally schema; return result matching current IPC.
- **Rust**: std::fs + optional serde validation; no Node.

## Drawbacks

None for single command.

## Alternatives

None.

## Unresolved questions

None.

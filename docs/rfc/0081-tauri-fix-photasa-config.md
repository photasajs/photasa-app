# RFC 0081: fix_photasa_config command in Rust

- **Start Date**: 2025-03-07
- **RFC PR**: (leave empty)
- **Implementation Issue**: (leave empty)
- **状态**: ✅ 已完成

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

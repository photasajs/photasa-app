# RFC 0083: Watch event contract (same event names as contract reference)

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

Define the **event contract** for file watch in Tauri: same channel/event names and payload shape as contract reference (`picasa:file-add`, `picasa:file-change`, `picasa:file-unlink`, etc.). Tauri backend (RFC 0082 impl) must emit to the webview using these exact names and a payload compatible with `WatchServiceEvent` so existing frontend listeners work unchanged.

## Motivation

ROADMAP: "Tauri watch implementation must emit the same event names." One RFC for the contract keeps implementation (0082) and contract (this) separate.

## Detailed design

- **Event names**: List and document every channel name the frontend expects (from packages/common or legacy main). No new or renamed events.
- **Payload**: Shape (path, type, etc.) compatible with current IPC. Reference contract reference watch service / WatchServiceEvent type.
- **Tauri**: Emit via Tauri’s event API to webview with these names and shape when watcher (0082) receives filesystem events.

## Drawbacks

None for contract-only RFC.

## Alternatives

None.

## Unresolved questions

None.

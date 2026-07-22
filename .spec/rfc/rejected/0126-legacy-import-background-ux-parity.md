# RFC 0126: The removed desktop tree import background-dismiss UX parity

- **Start Date**: 2026-07-17
- **Status**: ❌ Rejected / Won't Fix（2026-07-18）
- **Area**: contract reference / Import UI
- **Depends on**: [0118](../completed/0118-tauri-import-background-ui.md)（Photasa first）
- **One thing only**: Port 0118 dismiss/chip UX to `legacy-api contract` if still shipping contract reference

## Implementation principle

Photasa/Tauri is primary. This RFC is **deferred UI** if Activated — not a Photasa Rust migration item.

## Summary

0118 is **Photasa-only**. This RFC would have mirrored dismiss/chip behavior back into contract reference. That is now rejected: Photasa active work must target the Tauri/Rust path, not revive contract reference UI parity.

## Rejection reason

contract parity is not a Photasa Rust migration item. Keeping this as Deferred makes the roadmap lie about future work. The maintained import UX is `apps/photasa` + Tauri commands + Rust import crate.

## Non-goals

- No changes under `legacy-api contract`
- No `@photasa/*` backend packages for Tauri
- No second import background UI surface

## Verification

- [x] No code needed; this is an deferred scope rejection.
- [x] ROADMAP / TASK_TRACKING updated to rejected.

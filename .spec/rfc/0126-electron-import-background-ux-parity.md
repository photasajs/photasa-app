# RFC 0126: Electron `apps/desktop` import background-dismiss UX parity

- **Start Date**: 2026-07-17
- **Status**: ⏸️ Deferred
- **Area**: Electron desktop / Import UI
- **Depends on**: [0118](./0118-tauri-import-background-ui.md)（Photasa first）
- **One thing only**: Port 0118 dismiss/chip UX to `apps/desktop` if still shipping Electron

## Implementation principle

Photasa/Tauri is primary. This RFC is **Electron-only UI** if Activated — not a Photasa Rust migration item.

## Summary

0118 is **Photasa-only**. If product still needs same dismiss/chip on Electron desktop ImportProgressModal, implement here after 0118 ✅.

## Non-goals

- Photasa 0118 work
- Any `@photasa/*` as Tauri backend

## Checklist (when Activated)

- [ ] Mirror dismiss ≠ cancel on desktop modal
- [ ] Chip / session pattern or Electron-equivalent
- [ ] Tests
- [ ] ROADMAP ✅

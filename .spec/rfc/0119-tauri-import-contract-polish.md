# RFC 0119: Tauri import contract polish (checksum, duplicateCount, resume shape)

- **Start Date**: 2026-07-17
- **Status**: ⏳ Draft / **P3**（未开工）
- **Area**: Photasa / Import / Contract
- **Depends on**: [0070](./0070-tauri-import-service-migration.md), [0096](./completed/0096-tauri-import-pause-resume.md), [0118](./0118-tauri-import-background-ui.md)（可并行，不阻塞）
- **Tracks gaps**: import result honesty (was ROADMAP P3; related to review notes, not 0118 G1–G14)

## Implementation principle (Photasa / Tauri)

> **Rust rewrite, not TypeScript copy.** Policy: [./TAURI_RUST_REWRITE_POLICY.md](./TAURI_RUST_REWRITE_POLICY.md).

## Summary

Make import completion / progress JSON **honest**:

1. `checksum` — compute or **omit** field (no perpetual `null` pretend).
2. `statistics.duplicateCount` — real count or omit.
3. `resumeImport` return value — align with Electron or document Photasa-only stub in types.
4. Optional: emit `import:progress` with `status: "paused"` on `pause_import` (0096 unresolved).

## Non-goals

- Background UI (→ **0118**)
- Quit recovery (→ **0120**)
- Settings import prefs (→ **0121**)
- Legacy importPhotos UX (→ **0122**)

## Checklist

- [ ] Decide checksum: hash vs remove field
- [ ] duplicateCount real or remove
- [ ] resume return shape + Vitest
- [ ] Optional paused status emit
- [ ] Rust tests + ROADMAP ✅

## Testing

- Rust unit: field present/absent matches decision
- Vitest: adapter resume shape

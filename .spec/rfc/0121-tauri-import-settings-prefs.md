# RFC 0121: Tauri import — Settings preferences panel

- **Start Date**: 2026-07-17
- **Status**: ⏸️ Deferred（tracked; **not** in 0118）
- **Area**: Photasa / Import / Settings UI
- **Depends on**: [0070](./0070-tauri-import-service-migration.md), [0107](./0107-tauri-wenchang-preferences-storage.md)
- **Tracks gap**: **G12** (0118 gap analysis)

## Implementation principle (Photasa / Tauri)

> **Rust rewrite, not TypeScript copy.** Policy: [./TAURI_RUST_REWRITE_POLICY.md](./TAURI_RUST_REWRITE_POLICY.md).

- Prefs persistence via existing Wenchang / preference store (Rust already for system prefs); no Node.

## Summary

Today: **no** Import tab in Settings; wizard holds duplicate strategy / filters per run.  
**0121** = optional defaults (default target folder, default duplicate strategy, include-subfolders default) in Settings + preference sync.

## Why deferred

0118 explicitly excludes Settings. Defaults are product polish, not background-progress UX.

## Non-goals until Accepted

- No Settings Import panel while Deferred
- Must not block 0118 ✅

## Checklist (when activated)

- [ ] Preference schema fields
- [ ] `GeneralSettings` or new `ImportSettings.vue`
- [ ] Wizard reads defaults
- [ ] ROADMAP ⏸️ → 🔨 → ✅

# RFC 0121: Tauri import — Settings preferences panel

- **Start Date**: 2026-07-17
- **Status**: ✅ Implemented（2026-07-18）
- **Area**: Photasa / Import / Settings UI
- **Depends on**: [0070](../0070-tauri-import-service-migration.md), [0107](../0107-tauri-wenchang-preferences-storage.md)
- **Tracks gap**: **G12** (0118 gap analysis)

## Implementation principle (Photasa / Tauri)

> **Rust rewrite, not TypeScript copy.** Policy: [../TAURI_RUST_REWRITE_POLICY.md](../TAURI_RUST_REWRITE_POLICY.md).

- Prefs persistence via existing Wenchang / preference store (Rust already for system prefs); no Node.

## Summary

Settings now has an **Import** tab backed by the existing persisted `PreferenceState`. New import wizard sessions read those defaults instead of hard-coding every run.

Implemented defaults:

- Default target folder
- Default duplicate strategy
- Include subfolders by default

Explicit `initialTargetPath` still wins. If no import default is set, the wizard keeps the old fallback to the first watched folder, so existing users are not broken.

## Implementation

- `apps/photasa/src/stores/preference.ts`: `importing` preference block and narrow update actions.
- `apps/photasa/src/components/settings/ImportSettings.vue`: Import tab controls.
- `apps/photasa/src/components/UserPreference.vue`: Settings tab registration.
- `apps/photasa/src/utils/import-wizard-helpers.ts`: initial wizard configuration reads import defaults.
- `packages/common/src/import-types.ts`: `ImportPreferences` type.
- `apps/photasa/src/locales/en-US.json`, `apps/photasa/src/locales/zh-CN.json`: UI strings.

## Verification

- [x] `pnpm --filter @photasa/photasa run typecheck`
- [x] Import wizard helper test covers import defaults precedence.
- [x] Preference store test covers default shape and update actions.

## Checklist

- [x] Preference schema fields
- [x] New `ImportSettings.vue`
- [x] Wizard reads defaults
- [x] ROADMAP ⏸️ → ✅

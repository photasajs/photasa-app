# RFC 0107 – Tauri Wenchang: application preferences storage parity

**Status**: Draft  
**Created**: 2026-04-06  
**Area**: Tauri / Preferences / Tianshu

---

## Summary

Electron stores **application-level preferences** via the **Wenchang engine** and exposes them to the Renderer through Tianshu workflows (`get_preferences`, `update_preferences`, etc).  
Tauri currently mis-registers a folder-level `.photasa.json` adapter as `service: "wenchang"`, so preference workflows cannot execute.

This RFC introduces a **dedicated Rust workspace crate** for Wenchang preferences, plus a Tauri adapter named `wenchang` that provides the same workflow actions as Electron.

---

## Motivation / Problem

We need 1:1 parity for:

- **Storage location**: `~/.photasa/preferences/preferences.json`
- **Workflow surface**: `service: "wenchang"` actions used by preference workflows
- **UI sync**: `get_preferences` / `update_preferences` outputs must satisfy Renderer store automation (`matter-sync.yml` → `preferences` store)

Current Tauri state:

- `apps/photasa/src-tauri/src/adapters/config_adapter.rs` is named `"wenchang"` but only reads/writes per-folder `.photasa.json`.
- Preference workflows from Electron (`apps/desktop/src/main/engines/tianshu/workflows/preference/*.zouwu`) require Wenchang-specific actions (e.g. `validate`, `sanitize`, `updatePreferences`, `getHistory`, etc).

---

## Goals

1. **Correct responsibility split**
   - `.photasa.json` (folder-level) is no longer implemented under adapter name `"wenchang"`.
   - `"wenchang"` is reserved for application-level preferences.

2. **Dedicated crate**
   - Implement preferences persistence in a new Rust workspace crate under `crates/`.
   - Keep Tauri adapter as a thin boundary layer.

3. **Workflow parity**
   - Implement the minimal action surface needed by Electron preference workflows:
     - `getCurrentSnapshot`
     - `updatePreferences`
     - `resetToDefaults`
     - `exportPreferences`
     - `importPreferences`
     - `getHistory`
     - `restoreRevision`
     - `validate`
     - `sanitize`
     - `emitEvent`
     - `formatResponse`

---

## Non-goals

- Re-implementing all Electron-side UI flows for preference export/import dialogs.
- Adding YAML/TOML preferences formats. Storage is JSON to match Electron.

---

## Detailed design

### Storage layout

Default directory:

```
~/.photasa/preferences/
  preferences.json
  history.json
  revisions/
    00000001.json
    00000002.json
    ...
```

### Data model

Align with `packages/@photasa/wenchang/src/types/index.ts`:

- `UserPreferences` includes `revision` and `lastModified`
- `PreferenceDelta` is a partial update object `{ ui?, display?, scanning?, performance? }`

### Tauri adapter registration

- `ConfigAdapter` renamed to `"config"` (folder-level `.photasa.json`).
- New `PreferencesAdapter` uses `"wenchang"` and connects to the new crate.

### Workflow directory

Tauri dev mode uses Electron workflows at:

`apps/desktop/src/main/engines/tianshu/workflows`

Production builds must bundle `workflows/` into `resource_dir/workflows` (tracked separately if needed).

---

## Testing strategy

- Rust unit tests in the new crate:
  - default initialization (no file) → defaults written
  - apply delta → revision increments, deep merge works, `preferences.json` persists
  - history + revisions files updated
  - restoreRevision loads previous snapshot
- Tauri compile proof:
  - `cargo test -p photasa-wenchang-preferences`
  - `cargo build -p photasa`
- Optional manual validation:
  - Renderer triggers `get_preferences` and sees preferences store replaced via `matter-sync.yml`
  - Update theme/language/thumbnailSize triggers `update_preferences` and persists to `~/.photasa/preferences/preferences.json`

---

## Risks

- If workflow action shapes differ, store automation may not sync; mitigate by matching Electron workflow expectations precisely.
- Bundling workflows in production is a separate packaging concern; dev path already points to Electron workflows.


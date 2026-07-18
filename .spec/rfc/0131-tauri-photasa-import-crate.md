# RFC 0131: Split Photasa import into standalone `photasa-import` crate

- **Start Date**: 2026-07-18
- **Last updated**: 2026-07-18
- **Status**: ✅ Implemented
- **Area**: Photasa / Rust crates
- **Path**: `.spec/rfc/0131-tauri-photasa-import-crate.md`

## Implementation principle (Photasa / Tauri)

> **Rust rewrite, not TypeScript copy.** Policy: [./TAURI_RUST_REWRITE_POLICY.md](./TAURI_RUST_REWRITE_POLICY.md).

- Import algorithm in **`crates/photasa-import`** only — **no** `@photasa/import` Node/TS in Tauri backend.
- Electron/TS = behavior spec only.

## Goal

Import **algorithm** lives in workspace crate `crates/photasa-import` with **zero Tauri**.  
`apps/photasa/src-tauri` keeps **thin** `#[tauri::command]` + metadata bridge only.

## Design criteria

1. **Testability first** — `cargo test -p photasa-import` covers copy/date/path/session without Window.
2. **No `@photasa/import` TS** in Tauri backend (policy unchanged).
3. **Metadata** via `MetadataExtractor` trait; Photasa implements with `extract_metadata_request`.

## Modules (crate)

| Module | Responsibility |
|--------|----------------|
| `path_filter` | media ext / ignore / hidden |
| `file_groups` | RAW+JPEG grouping |
| `date` | date subpath + `MetadataExtractor` |
| `copy_loop` | duplicate strategy, pause/cancel wait, copy loop |
| `session` | history JSON + undo helpers |
| `metadata` | re-export trait |

## Checklist

- [x] Workspace crate `crates/photasa-import` (zero Tauri dep)
- [x] Modules: path_filter / file_groups / date / copy_loop / session / metadata
- [x] Tauri thin wrappers re-export / bridge (`import_execute`, `import_date_util`, …)
- [x] `cargo test -p photasa-import` green
- [x] `cargo check -p photasa` green
- [x] ROADMAP / TASK_TRACKING → ✅

## Verification

```bash
cargo test -p photasa-import
cargo check -p photasa
```

**Evidence (2026-07-18):** `cargo test -p photasa-import` → **36 passed**; `cargo check -p photasa` OK; crate sources have **no** `tauri` dependency.

Coverage gate for algorithm: measure **`-p photasa-import`** only — not whole photasa binary.

## Out of scope

| Topic | RFC |
|-------|-----|
| `import_legacy.rs` copy dedup into crate | **[0130](./0130-tauri-import-legacy-copy-dedup.md)** |
| `import:progress` missing `importId` | **[0128](./0128-tauri-import-progress-import-id.md)** |

## Note

**0128** = `import:progress` 缺 `importId`（一事另案）。本 RFC 仅 crate 拆分。

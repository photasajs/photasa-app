# RFC 0131: Split Photasa import into standalone `photasa-import` crate

- **Start Date**: 2026-07-18
- **Last updated**: 2026-07-18
- **Status**: 🔨 In Progress
- **Area**: Photasa / Rust crates
- **Path**: `.spec/rfc/0131-tauri-photasa-import-crate.md`

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

## Verification

```bash
cargo test -p photasa-import
cargo check -p photasa
```

Coverage gate for algorithm: measure **`-p photasa-import`** only — not whole photasa binary.

## Note

**0128** already = `import:progress` 缺 `importId`. This crate split is **0131**.

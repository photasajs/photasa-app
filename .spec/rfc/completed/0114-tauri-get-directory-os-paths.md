# RFC 0114 — `get_directory` OS Path Mapping + `scan_directories` FileGroup[] + WASM Cleanup

| Field         | Value                     |
| ------------- | ------------------------- |
| **RFC**       | 0114                      |
| **Status**    | ✅ Implemented            |
| **Completed** | 2026-06-08                |
| **Author**    | AI                        |
| **Target**    | apps/photasa (Tauri/Rust) |

---

## Summary

Three remaining items from RFC 0097 (Phase 7 closure):

1. `get_directory` must resolve OS standard paths (`desktop`, `documents`, `home`, …) via `app.getPath(name)` equivalent — previously always returned `null` for these names.
2. `scan_directories` must return `FileGroup[]` (with optional `filters`) instead of a flat `string[]` — matching Electron `import-worker` `handleScanDirectories` → `detectEnhancedFileGroups`.
3. Remove deprecated WASM stub commands (`load_wasm_module`, `call_wasm_function`) and their supporting `wasm.rs` files.

---

## Motivation

### `get_directory`

Electron `DirectoryService` delegates to `app.getPath(name)` directly:

```typescript
// apps/desktop/src/main/directory/directory-service.ts:74
this.ipcMain.handle("picasa:get-directory", async (_, args) => {
    return this.app.getPath(args.name);
});
```

The old Tauri implementation only looked up `DirectoryStore` (an in-memory map populated by `set_directory`). Since no code calls `set_directory` for `"desktop"` / `"home"` / `"documents"` at startup, those always returned `null`, breaking `folderSelectionService` quick-access buttons.

### `scan_directories`

The Electron worker returns `FileGroup[]` after running `detectEnhancedFileGroups`. The old Tauri stub returned a flat `Vec<String>` (raw paths), which was incompatible with the TypeScript `FileGroup` shape consumed by the import flow.

### WASM cleanup

`commands/wasm.rs` and `utils/wasm.rs` were empty stubs kept only to satisfy `main.rs` type-checks after wasmtime removal. They are now safe to delete.

---

## Design

### 1 — `get_directory` OS fallback (`commands/directory.rs`)

```rust
pub fn resolve_known_directory_path(name: &str) -> Option<String> {
    let path = match name {
        "home"      => dirs::home_dir(),
        "desktop"   => dirs::desktop_dir(),
        "documents" => dirs::document_dir(),
        "downloads" => dirs::download_dir(),
        "music"     => dirs::audio_dir(),
        "pictures"  => dirs::picture_dir(),
        "videos"    => dirs::video_dir(),
        _           => None,
    }?;
    Some(path.to_string_lossy().into_owned())
}
```

`get_directory` now checks `DirectoryStore` first (non-empty value wins), then falls back to `resolve_known_directory_path`. This preserves override behaviour while adding OS path resolution.

### 2 — `import_file_groups.rs` (`detect_enhanced_file_groups`)

Pure-function port of `@photasa/import` `detectEnhancedFileGroups`:

- Same `ENHANCED_RELATED_EXTENSIONS` map (RAW+JPEG, video+sidecar, etc.)
- Same file priority sort (video > RAW > HEIC > JPEG > sidecar)
- Same special patterns (GoPro GOPR→GP0x, DJI*, Sony DSC, Canon IMG*)

### 3 — `import_scan_directories.rs` (`scan_directories` command)

Replaces stub `stubs::scan_directories`:

- Walks each source path with `walkdir`
- Applies `filters` (fileTypes, sizeRange, includeSubfolders, hidden/photasa exclusions)
- Calls `extract_metadata_request` per file (matching Electron `createFileInfo`)
- Groups result via `detect_enhanced_file_groups`
- Returns `Vec<Value>` in camelCase `FileGroup` shape

---

## Files Changed

| File                                                             | Action                                                                      |
| ---------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `apps/photasa/src-tauri/src/commands/directory.rs`               | Add `resolve_known_directory_path`, update `get_directory`, add tests       |
| `apps/photasa/src-tauri/src/commands/import_file_groups.rs`      | **New** — `detect_enhanced_file_groups`, `are_files_related`                |
| `apps/photasa/src-tauri/src/commands/import_scan_directories.rs` | **New** — `scan_directories` Tauri command                                  |
| `apps/photasa/src-tauri/src/commands/stubs.rs`                   | Remove old `scan_directories` stub                                          |
| `apps/photasa/src-tauri/src/commands/mod.rs`                     | Add `import_file_groups`, `import_scan_directories`; remove `wasm`          |
| `apps/photasa/src-tauri/src/main.rs`                             | Use `import_scan_directories::scan_directories`; remove wasm commands/state |
| `apps/photasa/src-tauri/src/commands/wasm.rs`                    | **Deleted**                                                                 |
| `apps/photasa/src-tauri/src/utils/wasm.rs`                       | **Deleted**                                                                 |
| `apps/photasa/src-tauri/src/utils/mod.rs`                        | Remove `pub mod wasm`                                                       |
| `apps/photasa/src-tauri/Cargo.toml`                              | Add `dirs = "5"`                                                            |
| `apps/photasa/src/api/import.adapter.ts`                         | `scanDirectories` passes `filters`                                          |
| `apps/photasa/src/api/legacy-api.ts`                             | `scanDirectories` passes `filters`                                          |

---

## Implementation checklist

- [x] `resolve_known_directory_path` — all 7 `PathName` variants covered
- [x] `get_directory` — store-first, OS-fallback logic + unit tests
- [x] `import_file_groups.rs` — enhanced detection, priority sort, special patterns, unit tests
- [x] `import_scan_directories.rs` — full filter support, metadata extraction, unit tests
- [x] `stubs.rs` old `scan_directories` removed; `main.rs` uses new command
- [x] WASM files deleted; `main.rs` no longer registers WASM commands or manages `WasmModuleCache`
- [x] `Cargo.toml` `dirs = "5"` added
- [x] Frontend adapters pass `filters` through to Rust

---

## Test evidence

```
test commands::directory::tests::resolve_known_directory_home_is_some ... ok
test commands::directory::tests::resolve_unknown_name_is_none ... ok
test commands::directory::tests::get_directory_prefers_non_empty_store_over_os ... ok

test commands::import_file_groups::tests::are_files_related_cr2_jpg ... ok
test commands::import_file_groups::tests::detect_groups_empty ... ok
test commands::import_file_groups::tests::detect_groups_raw_and_jpeg ... ok

test commands::import_scan_directories::tests::include_subfolders_defaults_true ... ok
test commands::import_scan_directories::tests::apply_file_type_filter_image_only ... ok
test commands::import_scan_directories::tests::scan_returns_file_groups_not_flat_paths ... ok

test result: ok. 9 passed; 0 failed
```

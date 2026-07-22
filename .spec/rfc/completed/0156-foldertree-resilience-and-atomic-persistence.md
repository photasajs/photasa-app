# RFC 0156 – FolderTree Robustness, File Filtering, & Atomic Persistence

## Implementation principle (Photasa / Tauri)

> **Rust rewrite, not TypeScript copy.** Policy: [ROADMAP.md](../../ROADMAP.md).

**Status**: ✅ Implemented
**Created**: 2026-07-22
**Area**: Tauri / Rust / State / FolderTree
**Related**: [0042](../completed/0042-scanning-folder-migration.md), [0047](../completed/0047-foldertree-persistence-initialization.md), [0145](../completed/0145-appstate-rust-migration.md)

---

## Context & Problem

1. **Media Files Pollution in Tree UI**: During folder scanning and import workflows, photo/video file paths (`.jpg`, `.png`, `.heic`, `.mp4`, etc.) were occasionally added as leaf nodes in `folderTree`, rendering media filenames inside the sidebar directory tree.
2. **Aggressive Path Truncation**: Early filename stripping attempts relied on generic dot testing (`/\.[a-zA-Z0-9]+$/i`), which incorrectly truncated valid directory names that contain dots (e.g. `2026.05`, `v1.0`, `my.album`).
3. **Disk Serialization Corruption**: `FolderTreeStore::write_app_state` in `crates/photasa-folder-tree` directly called `std::fs::write` on `~/.photasa/appState/photasa.json`. Interrupted writes or writing shorter JSON states over larger existing files left trailing junk characters (e.g., `restore_app_state JSON 序列化错误: trailing characters at line 577 column 2`).
4. **Blank Sidebar UI on Startup Error**: When `restore_app_state` failed due to corrupt JSON on disk, `WeiZhengService.initializeAppState()` threw an error, leaving Pinia `appStateStore.folderTree` completely blank (`[]`).

---

## Architectural Decisions

### 1. Atomic File Transactions (`crates/photasa-folder-tree`)

To guarantee disk storage integrity across crashes or restarts:

- `FolderTreeStore::write_app_state` writes state payloads atomically using sibling temporary file transactions (`photasa.json.tmp` or `tempfile::NamedTempFile`) followed by OS-level atomic replacement (`std::fs::rename`).
- **Recommended Crate**: `tempfile` (`NamedTempFile::persist()`) or standard tempfile atomic rename pattern.
- Ensures `photasa.json` is never left partially written, truncated, or corrupted with trailing characters.

### 2. Self-Healing State Deserialization (`crates/photasa-folder-tree`)

- `FolderTreeStore::read_app_state` catches `serde_json` parse and trailing character errors.
- If corrupt disk state is encountered, it logs a warning (`⚠️ read_app_state 遇到损坏的 JSON，自动重置`) and returns `default_app_state_value()` so application initialization never fails.

### 3. Watched Path Reconcilation on Startup (`apps/photasa/src/services/weizheng/weizheng.ts`)

- `WeiZhengService.initializeAppState()` iterates over all configured root paths in `preference.paths` during startup.
- Invokes `addRoot()` for any watched path missing from `folderTree`, guaranteeing that configured user library roots always appear in the sidebar tree.

### 4. Precise Media Extension Matching (`apps/photasa/src/utils/folder-tree.ts`)

- Introduced `MEDIA_EXTENSION_REGEX` matching exact media formats (`.jpg`, `.png`, `.heic`, `.raw`, `.mp4`, `.mov`, etc.).
- Updated `directoryPathForFolderTree` to respect `file.isDirectory`.
- Normalized `child.title` for non-root nodes to display folder basenames (`resolved.split("/").pop()`) while retaining full canonical keys for IPC operations.

---

## Verification & Golden Parity

- **Rust Crate Unit Tests**: `cargo test -p photasa-folder-tree` passes 6/6 tests, including new test `restore_app_state_falls_back_on_corrupt_json`.
- **Frontend Vitest Suite**: All 826 unit tests pass clean (`pnpm --filter @photasa/photasa run test:unit`).

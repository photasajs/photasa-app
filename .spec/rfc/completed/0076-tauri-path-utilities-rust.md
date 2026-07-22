# RFC 0076: Path utilities in Rust (1:1 from Node, zero Node)

- **Start Date**: 2025-03-07
- **RFC PR**: (leave empty)
- **Implementation Issue**: (leave empty)
- **状态**: ✅ 已完成

## Implementation principle (Photasa / Tauri)

> **Rust rewrite, not TypeScript copy.** Policy: [ROADMAP.md](../../../ROADMAP.md).

- contract reference/Node code is a **behavioral specification** only—not a library for Photasa.
- Implement in `apps/photasa/src-tauri` and `crates/`; **do not** import `@photasa/scan`, `@photasa/import`, or other Node packages from Tauri.
- **1:1 parity** = same IPC/events/on-disk formats; **not** porting TypeScript source.

## Summary

Implement path-related behavior used by the app (normalizePath, mergePath, toFileName, toDirName, getSeparator, isHiddenFile, resolvePath, relativePath, etc.) **in Rust** in the Tauri backend, with **no Node usage**. Each function is a 1:1 replacement for the current Node `path` / `path-util` / preload path-helper behavior, exposed as Tauri commands. The flat legacy API layer (RFC 0075) calls these commands when running under Tauri.

## Motivation

- **Goal**: Tauri backend is 100% Rust; 1:1 contract parity via Rust rewrite (not TS copy).
- **Current state**: Path logic lives in Node (`path`, `@shared/path-util`, preload path-helper). In Tauri we must not run Node; the same semantics must be provided by Rust (e.g. `std::path` or a crate like `path-clean` / `normpath` for normalization).

## Detailed design

- **Rust module**: One module (or a small set) in the Tauri app (e.g. `src-tauri/src/path.rs` or under a `path` crate) that implements:
- `normalize_path` (handle `file://`, resolve, separators)
- `merge_path` (join)
- `to_file_name` (basename), `to_dir_name` (dirname)
- `get_separator` (platform-specific)
- `is_hidden_file` (e.g. dot-prefix on Unix, hidden attribute on Windows if needed)
- `resolve_path`, `relative_path` if used by the app
- **Commands**: Each function exposed as a Tauri command so the frontend adapter can `invoke('normalize_path', { path })` etc. No Node in the call chain.
- **Semantics**: Match existing contract reference/preload behavior on Windows and macOS (separators, `file://`, drive letters, UNC if applicable). Add tests for edge cases (file://, trailing slash, empty segments).

## Drawbacks

- More Tauri commands and round-trips if the UI calls path often. Option: provide a small set of batch or composite commands, or implement pure-TS path in the renderer with only `get_separator` from Tauri (see ROADMAP "Path: Option B/C"). This RFC does not forbid that hybrid; it only requires that any path logic that today runs in Node is either in Rust or in pure TS with no Node, and that the 1:1 mapping is documented.

## Alternatives

- Pure TypeScript path in the renderer with a single `get_separator()` from Tauri. Acceptable for Phase 2 to reduce commands; Rust path commands can be added later where TS cannot match behavior (e.g. normalizePath with file:// on Windows). This RFC still stands as "when we implement path in Rust, it is 1:1 and zero Node."

## Unresolved questions

- None. Choice of Rust crates and exact command names can be decided in implementation.

# RFC 0130: `import_legacy.rs` — dedup `copy_with_unique_name` against shared crate

- **Start Date**: 2026-07-18
- **Status**: ⏳ Draft / **P4**（cleanup，未开工）
- **Area**: Photasa / Import / Maintenance
- **Depends on**: [0093](./completed/0093-tauri-legacy-importphotos-rust.md)（legacy importPhotos Rust API）
- **One thing only**: `import_legacy.rs`'s `copy_with_unique_name` duplicates the shared `photasa-import` crate's collision-rename logic

## Implementation principle (Photasa / Tauri)

> **Rust rewrite, not TypeScript copy.** Policy: [./TAURI_RUST_REWRITE_POLICY.md](./TAURI_RUST_REWRITE_POLICY.md).

## Summary

Code review (2026-07-18) confirmed: `apps/photasa/src-tauri/src/commands/import_legacy.rs:37` defines its own `copy_with_unique_name` (collision-suffix rename algorithm: `name_1.ext`, `name_2.ext`, …), independent from `crates/photasa-import/src/copy_loop.rs`'s `copy_one`, which `import_execute.rs` already correctly delegates to (`import_execute.rs`'s doc comment: "算法在 `photasa-import::copy_loop`"). A fix to the collision-suffix algorithm in the shared crate (off-by-one, multi-dot-extension handling, etc.) won't propagate to `import_legacy.rs`'s independent copy, silently leaving the legacy import path on old/possibly-buggy behavior.

`import_legacy.rs`'s version also calls `set_file_times` to preserve mtime/atime, which the crate's `copy_one` does not — a legitimate extra step, not a reason for the whole algorithm to be reimplemented.

## Fix

`import_legacy.rs` should call the shared crate's collision-rename helper for path resolution, then layer `set_file_times` on top as a separate post-copy step — rather than reimplementing the rename-suffix loop inline.

## Non-goals

| Topic | RFC |
|-------|-----|
| `status: "paused"` emit / cancelled-payload fields | **0125** |
| `import:progress` missing `importId` | **0128** |
| Progress emit throttling | **0129** |

## Checklist

- [ ] Extract/expose a reusable collision-rename function from `crates/photasa-import` usable by both `copy_one` and `import_legacy.rs`
- [ ] `import_legacy.rs` calls the shared function, then applies `set_file_times`
- [ ] Existing `import_legacy.rs` tests (`copy_with_unique_name_*`) still pass unchanged (same observable behavior)
- [ ] ROADMAP ✅

## Testing

- Existing Rust unit tests for `copy_with_unique_name` (keeps original basename when free / appends suffix on collision / increments until free slot) continue to pass after delegating to the shared implementation.

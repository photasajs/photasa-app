# RFC 0130: `import_legacy.rs` — dedup `copy_with_unique_name` against shared crate

- **Start Date**: 2026-07-18
- **Last updated**: 2026-07-18
- **Status**: ✅ Implemented
- **Area**: Photasa / Import / Maintenance
- **Path**: `.spec/rfc/0130-tauri-import-legacy-copy-dedup.md`
- **Depends on**: [0093](./completed/0093-tauri-legacy-importphotos-rust.md), [0131](./0131-tauri-photasa-import-crate.md)
- **One thing only**: `import_legacy.rs`'s `copy_with_unique_name` duplicates the shared `photasa-import` crate's collision-rename logic

## Implementation principle (Photasa / Tauri)

> **Rust rewrite, not TypeScript copy.** Policy: [./TAURI_RUST_REWRITE_POLICY.md](./TAURI_RUST_REWRITE_POLICY.md).

## Summary

`import_legacy.rs` had its own `copy_with_unique_name` (collision-suffix rename). `import_execute` already used `photasa-import::copy_loop::copy_one`. Fix: shared `unique_dest_path` + `copy_one`; legacy layers `set_file_times` after copy.

## Fix (delivered)

1. `crates/photasa-import/src/copy_loop.rs`: public `unique_dest_path`; `copy_one` rename path uses it.
2. `import_legacy.rs`: `copy_with_unique_name` → `copy_one(..., "rename")` then `set_file_times`.

## Non-goals

| Topic                                              | RFC      |
| -------------------------------------------------- | -------- |
| `status: "paused"` emit / cancelled-payload fields | **0125** |
| `import:progress` missing `importId`               | **0128** |
| Progress emit throttling                           | **0129** |

## Checklist

- [x] Extract/expose `unique_dest_path` from `photasa-import` for `copy_one` + legacy
- [x] `import_legacy.rs` calls shared `copy_one`, then `set_file_times`
- [x] Existing `copy_with_unique_name_*` tests pass
- [x] ROADMAP / TASK_TRACKING → ✅

## Verification

```bash
cargo test -p photasa-import
cargo test -p photasa copy_with_unique_name
```

**Evidence (2026-07-18):** `photasa-import` **37 passed**; `copy_with_unique_name_*` **3 passed**.

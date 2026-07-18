# RFC 0130: `import_legacy.rs` wrapper + legacy copy dedup

- **Start Date**: 2026-07-18
- **Last updated**: 2026-07-18
- **Status**: ✅ Implemented
- **Area**: Photasa / Import / Maintenance
- **Path**: `.spec/rfc/completed/0130-tauri-import-legacy-copy-dedup.md`
- **Depends on**: [0093](./0093-tauri-import-photos-legacy.md), [0131](./0131-tauri-photasa-import-crate.md)
- **One thing only**: legacy `importPhotos` command must not own copy-loop mechanics; those belong in shared Rust import code

## Implementation principle (Photasa / Tauri)

> **Rust rewrite, not TypeScript copy.** Policy: [../TAURI_RUST_REWRITE_POLICY.md](../TAURI_RUST_REWRITE_POLICY.md).

## Summary

`import_legacy.rs` had its own `copy_with_unique_name` (collision-suffix rename) and too much loop code. `import_execute` already used `photasa-import::copy_loop::copy_one`. Fix: shared `unique_dest_path` + `copy_one`, plus `photasa-import::legacy_loop` owns traversal/filter/copy/time-preserve; `import_legacy.rs` is now only the Tauri command wrapper and event bridge.

## Fix (delivered)

1. `crates/photasa-import/src/copy_loop.rs`: public `unique_dest_path`; `copy_one` rename path uses it.
2. `crates/photasa-import/src/legacy_loop.rs`: owns legacy traversal, filtering, event payload shape, collision rename, and `set_file_times`.
3. `import_legacy.rs`: wrapper around `run_legacy_import`, passing the legacy EXIF target-name resolver and emitting Tauri events.

## Non-goals

| Topic                                              | RFC      |
| -------------------------------------------------- | -------- |
| `status: "paused"` emit / cancelled-payload fields | **0125** |
| `import:progress` missing `importId`               | **0128** |
| Progress emit throttling                           | **0129** |

## Checklist

- [x] Extract/expose `unique_dest_path` from `photasa-import` for `copy_one` + legacy
- [x] `photasa-import::legacy_loop` calls shared `copy_one`, then `set_file_times`
- [x] `import_legacy.rs` is a wrapper/event bridge
- [x] Existing legacy copy tests pass in `photasa-import`
- [x] ROADMAP / TASK_TRACKING → ✅

## Verification

```bash
cargo test -p photasa-import
cargo test -p photasa
```

**Evidence (2026-07-18):** `photasa-import` **43 passed**; `photasa` **118 passed, 3 ignored**.

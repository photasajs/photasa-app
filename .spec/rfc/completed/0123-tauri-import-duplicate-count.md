# RFC 0123: Tauri import result — `duplicateCount` honesty

- **Start Date**: 2026-07-17
- **Status**: ✅ Implemented（2026-07-18）
- **Area**: Photasa / Import / Contract
- **Depends on**: [0070](./0070-tauri-import-service-migration.md)
- **One thing only**: `statistics.duplicateCount`

## Implementation principle (Photasa / Tauri)

> **Rust rewrite, not TypeScript copy.** Policy: [../TAURI_RUST_REWRITE_POLICY.md](../TAURI_RUST_REWRITE_POLICY.md).

## Summary

Count real duplicate target-name collisions during `execute_import`. `skip`, `rename`, and `overwrite` all count when the original target path already exists.

## Non-goals

| Topic        | RFC      |
| ------------ | -------- |
| `checksum`   | **0119** |
| resume shape | **0124** |
| paused emit  | **0125** |

## Checklist

- [x] Define duplicate as existing original target path
- [x] Wire `duplicate_count` through `copy_one` → `run_import_file_loop` → history statistics
- [x] Rust unit test
- [x] ROADMAP ✅

## Testing

- Import with existing target file + `skip` → duplicateCount ≥ 1 **or** field omitted per decision.

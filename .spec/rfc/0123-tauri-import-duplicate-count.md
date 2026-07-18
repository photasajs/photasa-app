# RFC 0123: Tauri import result — `duplicateCount` honesty

- **Start Date**: 2026-07-17
- **Status**: ⏳ Draft / **P3**（未开工）
- **Area**: Photasa / Import / Contract
- **Depends on**: [0070](./0070-tauri-import-service-migration.md)
- **One thing only**: `statistics.duplicateCount`（今日写死 `0`）

## Implementation principle (Photasa / Tauri)

> **Rust rewrite, not TypeScript copy.** Policy: [./TAURI_RUST_REWRITE_POLICY.md](./TAURI_RUST_REWRITE_POLICY.md).

## Summary

Count real skip/rename-as-duplicate outcomes during `execute_import`, **or** omit `duplicateCount` from statistics JSON.

## Non-goals

| Topic | RFC |
|-------|-----|
| `checksum` | **0119** |
| resume shape | **0124** |
| paused emit | **0125** |

## Checklist

- [ ] Define what counts as “duplicate” (skip vs rename)
- [ ] Wire counter in `import_execute.rs`
- [ ] Rust unit test
- [ ] ROADMAP ✅

## Testing

- Import with existing target file + `skip` → duplicateCount ≥ 1 **or** field omitted per decision.

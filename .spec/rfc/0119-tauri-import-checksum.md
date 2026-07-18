# RFC 0119: Tauri import result — `checksum` field honesty

- **Start Date**: 2026-07-17
- **Status**: ⏳ Draft / **P3**（未开工）
- **Area**: Photasa / Import / Contract
- **Depends on**: [0070](./0070-tauri-import-service-migration.md)
- **One thing only**: `importedFiles[].checksum`（今日恒 `null`）

## Implementation principle (Photasa / Tauri)

> **Rust rewrite, not TypeScript copy.** Policy: [./TAURI_RUST_REWRITE_POLICY.md](./TAURI_RUST_REWRITE_POLICY.md).

## Summary

Decide and implement **one** of:

1. Compute checksum (e.g. MD5/SHA) per copied file in `execute_import`, or  
2. **Omit** `checksum` from JSON (no fake `null`).

## Non-goals (other RFCs)

| Topic | RFC |
|-------|-----|
| `duplicateCount` | **0123** |
| `resumeImport` return shape | **0124** |
| `status: "paused"` emit | **0125** |
| Background UI | **0118** |

## Checklist

- [ ] Product decision: hash vs omit
- [ ] `import_execute.rs` change
- [ ] Rust unit test
- [ ] ROADMAP ✅

## Testing

- Unit: field present with hex **or** absent; never perpetual null pretend.

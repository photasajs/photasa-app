# RFC 0119: Tauri import result — `checksum` field honesty

- **Start Date**: 2026-07-17
- **Status**: ✅ Implemented（2026-07-18）
- **Area**: Photasa / Import / Contract
- **Depends on**: [0070](../0070-tauri-import-service-migration.md)
- **One thing only**: `importedFiles[].checksum`

## Implementation principle (Photasa / Tauri)

> **Rust rewrite, not TypeScript copy.** Policy: [../TAURI_RUST_REWRITE_POLICY.md](../TAURI_RUST_REWRITE_POLICY.md).

## Summary

Decision: **omit** `checksum` from Tauri `execute_import` copied-file JSON. Unknown checksum is no field, not fake `null`; this avoids an extra file read/hash on every copied file.

## Non-goals (other RFCs)

| Topic                       | RFC      |
| --------------------------- | -------- |
| `duplicateCount`            | **0123** |
| `resumeImport` return shape | **0124** |
| `status: "paused"` emit     | **0125** |
| Background UI               | **0118** |

## Checklist

- [x] Product decision: omit unknown checksum
- [x] `crates/photasa-import/src/copy_loop.rs` omits `checksum`
- [x] Type shape allows optional checksum
- [x] Rust unit test
- [x] ROADMAP ✅

## Testing

- Unit: field present with hex **or** absent; never perpetual null pretend.

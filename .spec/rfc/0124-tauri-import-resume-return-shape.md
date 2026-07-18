# RFC 0124: Tauri `resumeImport` return shape parity

- **Start Date**: 2026-07-17
- **Status**: ⏳ Draft / **P3**（未开工）
- **Area**: Photasa / Import / Adapter
- **Depends on**: [0096](./completed/0096-tauri-import-pause-resume.md)
- **One thing only**: `resumeImport` / `import.adapter` `RESUME_STUB` return value

## Implementation principle (Photasa / Tauri)

> **Rust rewrite, not TypeScript copy.** Policy: [./TAURI_RUST_REWRITE_POLICY.md](./TAURI_RUST_REWRITE_POLICY.md).

## Summary

Today Tauri resume only clears `paused` and returns a **minimal stub** `ImportResult`. Choose:

1. Document Photasa-only: resume → `{ importId }` / void; update TS types, or  
2. Align closer to Electron resume return (if product still needs full `ImportResult`).

Final outcome still via `import:complete` either way.

## Non-goals

| Topic | RFC |
|-------|-----|
| checksum | **0119** |
| duplicateCount | **0123** |
| paused progress emit | **0125** |
| pause/resume **flags** (already done) | **0096** ✅ |

## Checklist

- [ ] Decision: stub-documented vs richer return
- [ ] `import.adapter.ts` + types
- [ ] Vitest
- [ ] ROADMAP ✅

## Testing

- Vitest: resume return matches chosen contract; complete event still delivers finals.

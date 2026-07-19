# RFC 0124: Tauri `resumeImport` return shape parity

- **Start Date**: 2026-07-17
- **Status**: ✅ Implemented（2026-07-18）
- **Area**: Photasa / Import / Adapter
- **Depends on**: [0096](./0096-tauri-import-pause-resume.md)
- **One thing only**: `resumeImport` / `import.adapter` return value

## Implementation principle (Photasa / Tauri)

> **Rust rewrite, not TypeScript copy.** Policy: [ROADMAP.md](../../../ROADMAP.md).

## Summary

Decision: Tauri resume returns `{ importId }`. It only clears the paused flag on an existing import. Final result still comes from `import:complete`.

## Non-goals

| Topic                                 | RFC         |
| ------------------------------------- | ----------- |
| checksum                              | **0119**    |
| duplicateCount                        | **0123**    |
| paused progress emit                  | **0125**    |
| pause/resume **flags** (already done) | **0096** ✅ |

## Checklist

- [x] Decision: `{ importId }`, no fake `ImportResult`
- [x] `import.adapter.ts` + common type
- [x] Vitest
- [x] ROADMAP ✅

## Testing

- Vitest: resume return matches chosen contract; complete event still delivers finals.

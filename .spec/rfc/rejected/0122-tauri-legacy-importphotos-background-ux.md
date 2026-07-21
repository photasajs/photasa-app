# RFC 0122: Legacy `importPhotos` background progress UX

- **Start Date**: 2026-07-17
- **Status**: ❌ Rejected / Won't Fix（2026-07-18）
- **Area**: Photasa / Import / Legacy UI
- **Depends on**: [0093](../completed/0093-tauri-import-photos-legacy.md), [0118](../completed/0118-tauri-import-background-ui.md)
- **Tracks gap**: **G10** (0118 gap analysis)

## Implementation principle (Photasa / Tauri)

> **Rust rewrite, not TypeScript copy.** Policy: [ROADMAP.md](../../../ROADMAP.md).

- Legacy copy path already Rust (**0093**). This RFC is **UI only** if ever Activated.

## Summary

**0093** delivers `import_photos_legacy` + events. Gap G10 = same dismiss/chip UX for that callback surface.  
**Final decision:** Photasa primary UX = wizard `executeImport` + **0118** + **0120**. Legacy `importPhotos` remains a compatibility wrapper/event bridge only. It does not get a second chip/dismiss surface.

## Rejection reason

Duplicating background UX for legacy `importPhotos` creates a second state model for no current product path. That is not migration work; it is UI debt. The wrapper remains supported for callers that depend on the old event callback shape, but it will not become a first-class UI surface.

## Current replacement

- Use wizard `executeImport` for user-facing import.
- Use **0118** for background progress and dismiss behavior.
- Use **0120** for restart cleanup/keep after interrupted import.
- Keep `import_legacy.rs` as a thin wrapper/event bridge.

## Verification

- [x] No code needed; this is a product/architecture rejection.
- [x] ROADMAP / TASK_TRACKING updated to rejected.

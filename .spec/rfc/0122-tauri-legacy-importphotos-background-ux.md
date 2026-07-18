# RFC 0122: Legacy `importPhotos` background progress UX

- **Start Date**: 2026-07-17
- **Status**: ⏸️ Deferred / **Won't prioritize**（tracked decision）
- **Area**: Photasa / Import / Legacy UI
- **Depends on**: [0093](./completed/0093-tauri-import-photos-legacy.md), [0118](./0118-tauri-import-background-ui.md)
- **Tracks gap**: **G10** (0118 gap analysis)

## Implementation principle (Photasa / Tauri)

> **Rust rewrite, not TypeScript copy.** Policy: [./TAURI_RUST_REWRITE_POLICY.md](./TAURI_RUST_REWRITE_POLICY.md).

- Legacy copy path already Rust (**0093**). This RFC is **UI only** if ever Activated.

## Summary

**0093** delivers `import_photos_legacy` + events. Gap G10 = same dismiss/chip UX for that callback surface.  
**Decision (tracked here):** Photasa primary UX = wizard `executeImport` + **0118**. Legacy `importPhotos` keeps event callback; **no** chip/dismiss work unless this RFC is Activated later.

## Why deferred / low priority

One progress UX (0118) for the wizard is enough. Duplicating for legacy doubles UI surface.

## Activation criteria

Only if product still ships a first-class legacy importPhotos UI that needs background dismiss.

## Checklist (when activated)

- [ ] Reuse 0118 session store or bridge legacy events into it
- [ ] Tests parallel to 0118 T1/T2 for legacy entry
- [ ] ROADMAP update

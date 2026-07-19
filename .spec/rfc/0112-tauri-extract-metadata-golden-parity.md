# RFC 0112 – Tauri `extract_metadata` golden parity

## Implementation principle (Photasa / Tauri)

> **Rust rewrite, not TypeScript copy.** Policy: [ROADMAP.md](../../ROADMAP.md).

- Golden tests: same fixture files → same JSON field shapes as Electron `import:extract-metadata` (spec from `apps/desktop`, not `@photasa/import` runtime).

**Status**: ✅ Implemented  
**Created**: 2026-06-06  
**Implemented**: 2026-06-08  
**Area**: Tauri / Import / Metadata  
**Depends on**: RFC 0097

---

## Problem

`extract_metadata.rs` implements the main pipeline in Rust, but **MakerNote**, edge video tags, and real container fixtures are not black-box compared to Electron output.

## Decision

1. Add fixture corpus under `apps/photasa/src-tauri/tests/fixtures/metadata/` (small redistributable samples).
2. Rust integration tests assert subset equality on `FileMetadata` JSON vs recorded Electron golden JSON (generated once from spec runs).
3. Close 0097 «仍差» for metadata.

## Implementation checklist

- [x] Document golden generation procedure (`tests/fixtures/metadata/README.md`)
- [x] Image: Nikon/Canon/Sony sample fields + fixture JPEGs
- [x] Video: `sample-video.mp4` + corrupt fallback
- [x] Error paths: missing file → `extract_metadata` Err
- [x] EXIF 根因修复：按 tag number 匹配 + `Double` 曝光/光圈/焦距

## Impact

Import preview and execute date paths trust metadata parity.

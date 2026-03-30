# RFC 0093: importPhotos (legacy copy flow) in Rust

- **Start Date**: 2025-03-07
- **Status**: ✅ Photasa 已实现核心：`import_photos_legacy`（`commands/import_legacy.rs`）+ 事件 `picasa:import-photos-legacy`；前端 `legacy-api.importPhotos` `invoke` 与监听。**余量：** 与 Electron 回调载荷/边界行为做逐项对照测试并收口本文「Unresolved」。
- **RFC PR**: (leave empty)
- **Implementation Issue**: (leave empty)

## Summary

One concern: **importPhotos(folders, target, callback)** – the legacy copy flow. Today preload runs RxJS + path-helper + Node fs (scan folders, filter image/video, ensure dirs, copy files, progress callback). In Tauri this must be one (or a few) Rust commands: scan folders, copy, emit progress; no Node. executeImport (full import UI) is a separate service (RFC 0070).

## Motivation

ROADMAP: “importPhotos – Preload RxJS + fs. Rust: reimplement scan + copy + progress; do not leave in renderer.” One RFC for this single flow so flat legacy API can implement `window.api.importPhotos(...)`.

## Detailed design

- **Command(s)**: e.g. `import_photos_legacy(folders, target)` with events or progress callback contract. Rust: walkdir (or equivalent), filter by extension, copy files, emit progress (same shape as current callback) via Tauri events.
- **Rust**: std::fs or crate; no Node, no RxJS in renderer.

## Drawbacks

Complex flow; may need multiple commands or event stream. Still one RFC for the “one thing”: legacy importPhotos behavior in Rust.

## Alternatives

Deprecate importPhotos and route to executeImport subset; document in this RFC if chosen.

## Unresolved questions

Exact callback/event shape from current preload importPhotos.

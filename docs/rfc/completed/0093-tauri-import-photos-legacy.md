# RFC 0093: importPhotos (legacy copy flow) in Rust

- **Start Date**: 2025-03-07
- **Status**: ✅ Photasa 已实现核心：`import_photos_legacy`（`commands/import_legacy.rs`）+ 事件 `picasa:import-photos-legacy`；前端 `legacy-api.importPhotos` `invoke` 与监听。**测试：** Rust `copy_with_unique_name` 单测（`import_legacy.rs`）；前端 `legacy-api-import-photos.test.ts`（invoke 失败、`next`/`complete`、`created`→`Date`）。**余量：** 与 Electron 大规模 fixtures 的端到端对拍（可选）。
- **RFC PR**: (leave empty)
- **Implementation Issue**: (leave empty)

## Implementation principle (Photasa / Tauri)

> **Rust rewrite, not TypeScript copy.** Policy: [../TAURI_RUST_REWRITE_POLICY.md](../TAURI_RUST_REWRITE_POLICY.md).

- Electron/Node code is a **behavioral specification** only—not a library for Photasa.
- Implement in `apps/photasa/src-tauri` and `crates/`; **do not** import `@photasa/scan`, `@photasa/import`, or other Node packages from Tauri.
- **1:1 parity** = same IPC/events/on-disk formats; **not** porting TypeScript source.

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

## Callback / event shape（与 Electron `photo-import.ts` + `FileAction` 对齐）

- **事件名**：`picasa:import-photos-legacy`（Tauri）；Electron 为 preload 进程内 RxJS，无同名 IPC 事件。
- **载荷**：`{ sessionId, type: "next"|"error"|"complete", error, action }`。`next` 时 `action` 与 `@photasa/common` 的 `FileAction` 同字段（`file`, `name`, `created`, `isImage`, `isVideo`, `target`, `targetDir`, `targetFileName`, `targetFullPath`）。Rust 发出时 `created` 为 **RFC3339 字符串**；`legacy-api.importPhotos` 在转调回调前将 `created` **规范为 `Date`**，与 preload 侧一致。
- **子目录规则**：图片按 EXIF/文件时间 `YYYY/YYYYMMDD`（见 `extract_metadata_exif::legacy_import_target_name`）；视频落目标根目录（与 `exif-helper.resolveExifDate` 拒识视频后 `targetName` 为空一致）。
- **清理**：`listen` 返回的 `unlisten` 会登记到 `removeImportListeners` 使用的同一队列（`globalThis.__photasaImportUnsubs`）；`complete` 时先 `unlisten` 再从队列摘除；未结束时可用 `removeImportListeners()` 统一取消（与 `onImportProgress` 等一致）。

## Unresolved questions

- 可选：用固定媒体夹具跑 Electron vs Tauri 双端回归，自动 diff 回调序列。

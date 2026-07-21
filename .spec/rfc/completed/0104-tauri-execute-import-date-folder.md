# RFC 0104 – execute_import: date-based folder organization

## Implementation principle (Photasa / Tauri)

> **Rust rewrite, not TypeScript copy.** Policy: [ROADMAP.md](../../../ROADMAP.md).

- Electron/Node code is a **behavioral specification** only—not a library for Photasa.
- Implement in `apps/photasa/src-tauri` and `crates/`; **do not** import `@photasa/scan`, `@photasa/import`, or other Node packages from Tauri.
- **1:1 parity** = same IPC/events/on-disk formats; **not** porting TypeScript source.

**Status**: ✅ Implemented  
**Created**: 2026-04-05  
**Last updated**: 2026-07-20  
**Area**: Tauri / Import  
**Path**: `.spec/rfc/completed/0104-tauri-execute-import-date-folder.md`

---

## Problem

`apps/photasa/src-tauri/src/commands/import_execute.rs` copies every selected file
flat into the raw `targetPath` directory:

```rust
match copy_one(src, &target_pb, strategy) { … }
// target_pb == PathBuf::from(&target_path)  ← no subdirectory generation
```

The Electron `import-worker.ts` / `handleExecuteImport` uses:

```ts
const datePath = generateDatePath(group); // → "{year}/{YYYYMMDD}"
const groupDir = path.join(targetPath, datePath);
// files land in  <targetPath>/2024/20240315/photo.jpg
```

`import_preview.rs` already implements `generate_date_path_utc` and
`determine_group_target_utc` to match the **Electron preview contract** (Rust implementation; TS is spec reference only).
`execute_import` must use the **same per-file date sub-path** so the files on
disk match what the preview step presented to the user.

---

## Decision

Extend `execute_import` in Rust to call the date-path helpers already in
`import_preview.rs` (or a shared internal module) and construct the final
destination as:

```
<targetPath>/<generate_date_path_utc(date_of_file)>/<filename>
```

The date is resolved with the same fallback chain already used by `determine_group_target_utc`:

1. EXIF `dateTime`
2. `createdTime` / `modifiedTime` from `extract_metadata_request`
3. File system `mtime` fallback

### Steps

1. Extract `generate_date_path_utc` and `determine_group_target_utc` into a
   shared `import_date_util` internal module (or make `import_preview`'s
   functions `pub(crate)`).
2. In `execute_import`, for each `src` file:
    - Call `extract_metadata_request` (or read cached metadata from the config
      payload's `selectedFiles` entries if the preview result is passed in).
    - Compute date sub-path via `generate_date_path_utc`.
    - Construct `target_dir = PathBuf::from(&target_path).join(&date_sub_path)`.
    - Call `copy_one(src, &target_dir, strategy)` instead of using the flat
      `target_pb`.
3. Emit `targetPath` in the `imported_files` array elements as the full
   `{year}/{YYYYMMDD}/filename` path so the frontend can index them correctly.
4. Unit test: create temp dir, call execute_import with a known EXIF date,
   assert file lands in `<tmp>/2024/20240315/`.

---

## Impact

- Files imported via Tauri will be organized in the same date-hierarchy as
  files imported via Electron, ensuring the photo library is consistent.
- `import_preview.rs` already generates and shows date paths to the user;
  this RFC closes the gap so the actual copy matches the preview.
- No API or event shape change; only the on-disk layout changes.

---

## Verification (2026-06-06)

Implemented in Rust (`commands/import_date_util.rs`, shared by `import_preview` / `import_execute`). Electron `import-worker.ts` used as **behavior spec only** per [ROADMAP.md](../../../ROADMAP.md).

## 2026-07-20 复核：路径已随 0131 crate 拆分变化，功能本身无问题

`generate_date_path_utc`/`determine_group_target_utc` 等核心算法已随 [0131](./0131-tauri-photasa-import-crate.md) 迁入 `crates/photasa-import/src/date.rs`（零 Tauri，6 个单测覆盖，`cargo test -p photasa-import date` 全绿）。`commands/import_date_util.rs` 现在是纯转发层（`pub use photasa_import::date::{...}`）+ Tauri 侧 `PhotasaMetadataExtractor`（提供 `extract_metadata_request` 宿主适配，因为元数据提取需要 Tauri app 运行时的 HEIC/FFmpeg 能力，这部分不能下沉进零依赖 crate）。`import_execute.rs`/`import_preview.rs` 实际调用的是这层转发，行为与本 RFC 描述一致，不是分叉或遗留死代码。

## 2026-07-20 归档

RFC 已移至 `completed/`；ROADMAP / TASK_TRACKING 链接已对齐 `.spec/rfc/completed/`。

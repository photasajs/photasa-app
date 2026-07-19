# RFC 0116 – Tauri `.photasa.json` thumbnail path parity & rescan config contract

## Implementation principle (Photasa / Tauri)

> **Rust rewrite, not TypeScript copy.** Policy: [ROADMAP.md](../../ROADMAP.md).

- Electron / `@photasa/config-core` / `apps/desktop/src/shared/path-util.ts` are the **only** path contracts.
- **No new thumbnail naming.** Canonical relative path remains:
  `.photasaoriginals/thumbnail-{fileName}.png` (`toRelativeThumbnailPath` / `toThumbnailName`).
- Photasa fixes **broken stubs and drift**, not a second schema.

| Field            | Value                                                                                                                                                                                                                                                                       |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Status**       | ✅ Implemented                                                                                                                                                                                                                                                              |
| **Created**      | 2026-06-06                                                                                                                                                                                                                                                                  |
| **Last updated** | 2026-06-06                                                                                                                                                                                                                                                                  |
| **Area**         | Tauri / Config / Scan / WebView                                                                                                                                                                                                                                             |
| **Depends on**   | [0071](0071-tauri-config-service-migration.md), [0068](0068-tauri-scan-service-migration.md), [0105](0105-tauri-scan-incremental-cache.md), [0048](completed/0048-scan-orchestration-business-logic-migration.md), [0115](0115-tauri-webview-local-image-asset-protocol.md) |

---

## Summary

Tauri Photasa shows `tauri::protocol::asset` 404s and broken grids because:

1. **`legacy-api.ts` path stubs** return basename only for `shortenThumbnailName` / `toThumbnailName`, corrupting `photoList[].thumbnail` when scan events update the store.
2. **`ConfigAdapter.fixConfig`** treats `photoList` as string array (wrong); Rust `fix_photasa_config` did not normalize thumbnails to the Electron contract.
3. **`add_photo_to_folder_list`** skips existing photos even when `thumbnail` is legacy/wrong (Electron updates when `!photo.thumbnail`).
4. **Folder switch race**: `currentFolder` updates before `currentFolderConfig` reload, so UI builds `asset://` URLs with folder A + photoList from folder B.

Rescan (`resetPhotasaConfig` + scan + `always: true`) was already specified in RFC 0048 / Electron `yuchigong.ts`; this RFC ensures **on-disk config and UI** stay on the **same Electron path contract** before and after rescan.

---

## Electron reference (source of truth)

| Behavior                    | Electron location                                                                           |
| --------------------------- | ------------------------------------------------------------------------------------------- |
| Thumbnail relative path     | `packages/@photasa/config-core/src/path-util.ts` → `toRelativeThumbnailPath`                |
| Shorten absolute → relative | `shortenThumbnailName` → `.photasaoriginals/` + basename                                    |
| Add to photoList            | `config-storage.ts` → `addToPhotoList` uses `toRelativeThumbnailPath`                       |
| Fix config                  | `fixPhotasaConfig` → normalize `path` + `shortenThumbnailName(thumbnail)`                   |
| Rescan                      | `yuchigong.executeScan` → `resetPhotasaConfig` then scan; `scan-helpers` → `always: rescan` |
| Scan write config           | `addToPhotasaConfig` after thumbnail worker                                                 |

**Canonical thumbnail path (unchanged since v2.0):**

```
.photasaoriginals/thumbnail-{basename(sourceFile)}.png
```

Legacy corrupt paths observed in the field (e.g. `.photasaoriginals/.photasaoriginals/foo.heic.png` without `thumbnail-` prefix) are **bugs**, not a supported format.

---

## Proposed solution (strict Electron port — no read-time migration)

### 1. Rust `photasa_config.rs`

- **`read_config_sync`**: return parsed config; **never** silently rewrite disk (Electron `readConfig`).
- **`parse_photo_list`**: preserve `thumbnail` from disk for object entries; only fill via `to_relative_thumbnail_path` when empty; legacy string entries still migrate to objects.
- **`add_photo_to_folder_list`**: new entries use `to_relative_thumbnail_path`; existing entries updated **only if `thumbnail` is empty** (Electron `addToPhotoList`).
- **`fix_config_sync`**: `path = basename`; `thumbnail = shortenThumbnailName(thumbnail)` only — **not** `to_relative_thumbnail_path` for all entries (Electron `fixPhotasaConfig`).

### 2. Rust `config_adapter.rs`

- `fixConfig` action delegates to `photasa_config::fix_config_sync` (object photoList), not string dedupe.

### 3. Photasa renderer `photasa-path.ts`

- Pure TS helpers mirroring `apps/desktop/src/shared/path-util.ts`:
  `shortenThumbnailName`, `toThumbnailName`, `toRelativeThumbnailPath`.
- `legacy-api.ts` uses these instead of basename-only stubs.
- `preference.ts` `addToCurrentPhotasaConfig` uses `shortenThumbnailName(request.thumbnail)` (Electron desktop), **not** `toRelativeThumbnailPath(request.path)`.

### 4. Folder switch (renderer)

- **Electron `FolderList`**：仅当 `currentFolder !== selectedKeys[0]` 时更新 folder 并 `getPhotasaConfig`；不预先清空 `photoList`。
- **Electron `ImageList`**：`card` 始终 `toImageList`；loading 遮罩盖住旧数据；`currentFolderConfig` watch 立即 `loadingPhotasaConfig = false`。
- Photasa 已对齐上述行为（移除 RFC 0116 占位清空、lastModified 门控、ImageList 内 scan 监听）。

### 5. BaseImage / MediaPreview（Electron 6-prop 设计）

- 网格：`src=thumbnail`，`@error` → 仅 `fallback` 占位图（**不** preview/raw 链）。
- Lightbox：`src=preview||raw`，`fallback=thumbnail`（与 Electron `MediaPreview.vue` 一致）。
- 移除 Photasa 自创：`base-image-error-fallback`、`fallbackToThumbnail`、`eagerLoad`、`fitViewport`、RAW 占位角标、`thumbnail-fallback-cache` UI 挂钩。

- `resetPhotasaConfig` clears `photoList`, then scan with `always: true` re-adds entries via `addToPhotoList` (canonical `thumbnail-*` paths).
- **No** post-rescan `fix_config_sync` in `scan_runner.rs` — rescan rebuilds list through add, not fix.

### Fixing legacy corrupt `.photasa.json`

- User action: **Rescan** (reset + re-add) or explicit **Fix Config** (`shortenThumbnailName` only).
- Do **not** auto-heal wrong thumbnails on read — that is recreation, not porting.

---

## Implementation checklist

- [x] RFC 0116 registered in `ROADMAP.md` + `TASK_TRACKING.md`
- [x] `photasa_config.rs` strict Electron parity + tests (9 cases)
- [x] `config_adapter.rs` fixConfig parity
- [x] Removed post-rescan `fix_config_sync` from `scan_runner.rs`
- [x] `photasa-path.ts` + `legacy-api.ts` stubs
- [x] `preference.ts` uses `shortenThumbnailName(request.thumbnail)`
- [x] `FolderList.vue` + `ImageList.vue` folder/config race
- [x] `cargo test` + Vitest for path helpers

---

## Testing strategy

```bash
cd apps/photasa/src-tauri && cargo test photasa_config
pnpm --filter @photasa/photasa exec vitest run src/utils/__tests__/photasa-path.test.ts
```

Manual: open folder with legacy `.photasa.json` → Fix Config or Rescan → grid loads without asset 404; switch folders rapidly → no cross-folder thumbnail requests.

---

## Risks

- Legacy corrupt paths (e.g. `.photasaoriginals/.photasaoriginals/foo.heic.png`) remain until user runs **Rescan** or **Fix Config** — same as Electron; no silent migration on read.
- `fixPhotasaConfig` shortens to basename only; it does not rebuild `thumbnail-*` names. Full repair requires rescan after reset.

## Alternatives considered

- **Read-time auto-migration to canonical `thumbnail-*`** — rejected (user requirement: port Electron, do not recreate behavior).
- **New preview-style path** — rejected (user requirement: no new patterns).
- **Frontend-only workaround** — rejected; config on disk must match Electron contract after explicit user actions.

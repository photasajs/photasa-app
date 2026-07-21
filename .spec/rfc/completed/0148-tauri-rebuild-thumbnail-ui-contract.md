# RFC 0148: 单张「重建缩略图」UI 契约（Tauri）

- **Start Date**: 2026-07-21
- **Last updated**: 2026-07-21
- **Status**: ✅ Implemented
- **Priority**: P2（用户可见：右键重建后缩略图不刷新）
- **Area**: Photasa / Renderer / `ImageList` / `create_thumbnail` IPC
- **Depends on**: [0134](./0134-tauri-photasa-thumbnail-crate.md)（`photasa-thumbnail`）、[0115](./0115-tauri-webview-local-image-asset-protocol.md)（asset URL）、[0116](./0116-tauri-photasa-config-thumbnail-parity.md)（`.photasaoriginals` 路径契约）
- **Related**: [0136](./0136-tauri-scan-runtime-contract.md)（文件夹 **Rescan** — **不同功能**，见 §边界）
- **Path**: `.spec/rfc/completed/0148-tauri-rebuild-thumbnail-ui-contract.md`

## Decision

**「重建缩略图」= 对当前网格中的单张照片，用 `always: true` 调用既有 Tauri `create_thumbnail`，覆盖磁盘 PNG，并强制 WebView 重新加载该格子的缩略图。**

| 做                                                                                                  | 不做                                           |
| --------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| `ImageList` 右键 → `requestThumbnail` → `window.api.createThumbnail` → `invoke("create_thumbnail")` | 贞观启奏 / 扫描队列 / 尉迟恭                   |
| 源路径：`image.raw`（无则 `image.preview`）                                                         | 整夹 Rescan（`REQUEST_RESCAN`）                |
| 目标路径：`.photasa.json` 里已有的 `photo.thumbnail`（经 `image.thumbnail` / `image.src`）          | 重算路径后写错目录                             |
| `always: true` 强制覆盖 PNG                                                                         | 更新 `.photasa.json` / Pinia                   |
| UI 层 `rebuiltThumbnailSrcByKey` + `?t=` 缓存破坏                                                   | 原地改 `image.thumbnail`（`card` 为 computed） |

**无独立 CLI / npm script / cargo 子命令。** 用户入口仅应用内右键菜单。

## 功能定义（读码为准）

### 入口

`apps/photasa/src/components/ImageList.vue` — 图片右键 `menu.rebuildThumbnail` → `rebuildThumbnail(image)`。

### 数据流

```text
rebuildThumbnail(image)
 → requestThumbnail(image, preferenceStore.thumbnailSize) // ImageListHelper.ts
 → createThumbnailTask.perform({ path, thumbnail, width, height, always: true, preview: "" })
 → window.api.createThumbnail // legacy-api → thumbnail.adapter
 → invoke("create_thumbnail", { request }) // normalize_path 后
 → photasa_thumbnail::create_thumbnail (Rust)
 → rebuiltThumbnailSrcByKey[image.key] = webviewUrl + "?t=" + Date.now()
 → BaseImage :src="thumbnailDisplaySrc(image)" :key="..."
```

### 路径契约

`toImage(currentFolder, photo)`（`common/image.ts`）：

| `Image` 字段        | 来源                                                                                     |
| ------------------- | ---------------------------------------------------------------------------------------- |
| `key`               | `photo.path`（`.photasa.json` 内文件名）                                                 |
| `raw`               | `currentFolder` + `photo.path` → asset URL                                               |
| `thumbnail` / `src` | `currentFolder` + `photo.thumbnail`（通常 `.photasaoriginals/thumbnail-{basename}.png`） |

`requestThumbnail` 将 asset/file URL 转为磁盘路径后调用 Rust；**目标缩略图路径必须来自 config 已有 `photo.thumbnail`**，禁止仅从 `raw` 父目录重算（与 legacy-api `ImageListHelper` 语义一致：`thumbnail: image.src`）。

### Rust 行为（已有，本 RFC 不扩 scope）

`photasa-thumbnail`：`always: true` 时跳过「目标已存在则直接返回」；按 `classify_media` 生成 Image/Video/Heic/Raw(占位)/Unknown(失败)。**不生成 preview**（`preview: ""`）。

## 与「文件夹 Rescan」边界

|          | **重建缩略图（本 RFC）** | **文件夹 Rescan**                              |
| -------- | ------------------------ | ---------------------------------------------- |
| 入口     | `ImageList` 单图右键     | `FolderList` → `REQUEST_RESCAN`                |
| 范围     | 1 张                     | 整目录扫描队列                                 |
| IPC      | `create_thumbnail` 直连  | `scan_photos` / 扫描流水线                     |
| 贞观     | 无                       | 尉迟恭 + 李世民路由                            |
| `always` | 前端 `always: true`      | `action == "rescan"` 时 Rust 侧 `always: true` |

二者都可覆盖 PNG，但**不是同一条代码路径**；不得用 Rescan 文档描述单图重建。

## 2026-07-21 Postmortem：Tauri 下「点了没反应」

### 现象

用户右键「重建缩略图」后，磁盘可能已更新，但网格仍显示旧图；或误以为功能未执行。

### 根因

1. **`card` 为 `computed`**：`toImageList(currentFolder, currentFolderConfig)` 每次依赖变更才重建；对 `image.thumbnail` 原地赋值**不触发** Vue 对 `BaseImage :src` 的更新。
2. **`prefetchImageTask` 剥离 query**：`imageSrc.replace(/\?.*$/, "")` 在 prefetch 前去掉 `?t=`，缓存破坏失效。
3. **（次要）** 早期 Photasa 用 `absoluteThumbnailPathForSource(raw)` 重算目标路径，与 `.photasa.json` 中 `photo.thumbnail` 可能不一致；已改为 `webviewMediaUrlToAbsolutePath(image.thumbnail || image.src)`。

### 修复

| 文件                 | 变更                                                                                              |
| -------------------- | ------------------------------------------------------------------------------------------------- |
| `ImageList.vue`      | `rebuiltThumbnailSrcByKey` + `thumbnailDisplaySrc()`；`clearDataState` 清空；`BaseImage` `:key`   |
| `ImageListHelper.ts` | `requestThumbnail` 返回新 WebView URL；`createThumbnail` 失败抛错；目标路径取自 `image.thumbnail` |
| `image-prefetch.ts`  | 加载时**保留** query 串                                                                           |

## 实现检查清单

- [x] `requestThumbnail` → `always: true`，路径来自 config 缩略图字段
- [x] `rebuiltThumbnailSrcByKey` 驱动 UI，不 mutate computed 内 `Image`
- [x] `prefetchImageTask` 不剥离 `?t=`
- [x] 失败 `logger.error`，不静默
- [x] 测试：`ImageListHelper.test.ts`、`image-prefetch.test.ts`

## Acceptance

1. 右键单图重建后，**同一 session** 内网格显示新缩略图（无需切换文件夹）。
2. `invoke("create_thumbnail")` 的 `request.always === true`；`request.thumbnail` 对应当前 `photo.thumbnail` 磁盘路径。
3. 不触发 `request_rescan` / 扫描队列 / 贞观启奏。
4. `pnpm --filter @photasa/photasa exec vitest run src/components/__tests__/ImageListHelper.test.ts src/utils/__tests__/image-prefetch.test.ts` 通过。

```bash
# 无独立 CLI；验收为 Vitest + 手动右键单图
pnpm --filter @photasa/photasa exec vitest run \
 src/components/__tests__/ImageListHelper.test.ts \
 src/utils/__tests__/image-prefetch.test.ts
```

## Out of scope

- 批量重建 / CLI
- 重建 HEIC **preview**（`.jpeg`）
- 修改 `.photasa.json` 或 `photoList` 条目
- 将单图重建迁入贞观（无业务必要性；保持薄 IPC 与 legacy-api 一致）

## Related

- **0069** / **0134**：`create_thumbnail` Rust 实现
- **0073**：`thumbnail.adapter.ts` + `legacy-api` 形状
- **0116**：`fixPhotasaConfig` 不重建 `thumbnail-*` 文件名 — 坏名需 Rescan 或本功能单张覆盖

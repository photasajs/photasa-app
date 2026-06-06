# RFC 0097: Tauri 扁平 legacy-api 延期表面（跟踪清单）

- **Start Date**: 2026-03-21
- **Status**: 🚧 Partial — 导入/扫描队列/watch/缩略图主干/Splash 核心已在 Photasa 接线；与 Electron 仍差元数据精度（含 MakerNote）、更新端点配置、Splash 进度事件、RAW 占位信息量等（见表与「仍差」）
- **Depends on**: RFC 0075（扁平 API）；0088、0089、0090（日志/更新 — Photasa 已实现）；0070 + Rust（导入执行内核）

## Implementation principle (Photasa / Tauri)

> **Rust rewrite, not TypeScript copy.** Policy: [./TAURI_RUST_REWRITE_POLICY.md](./TAURI_RUST_REWRITE_POLICY.md).

- Electron/Node code is a **behavioral specification** only—not a library for Photasa.
- Implement in `apps/photasa/src-tauri` and `crates/`; **do not** import `@photasa/scan`, `@photasa/import`, or other Node packages from Tauri.
- **1:1 parity** = same IPC/events/on-disk formats; **not** porting TypeScript source.

## Summary

本 RFC 跟踪 **`window.api` 上与 Electron 尚未达到契约级 1:1** 的条目。对拍方式为 **Rust 实现 + Electron 行为规格**（见 [TAURI_RUST_REWRITE_POLICY.md](./TAURI_RUST_REWRITE_POLICY.md)），**不是**回退到复制 TypeScript 或扩展 `@photasa/*` Node 包。

## 状态表（相对 Electron）

| 区域 | API / 行为 | 状态 | 说明 |
|------|--------------|------|------|
| 更新 | `checkForUpdates`、`downloadUpdate`、`installUpdate`、`getUpdateStatus`、`updateAutoUpdateConfig` + `picasa:update-*` | ✅ Photasa | RFC 0090；**生产**仍需配置 `updater` 公钥与 endpoints |
| 日志 | `log_viewer_open` / `log_viewer_close`、`log:entry` 桥接 | ✅ Photasa | RFC 0088、0089 |
| 导入扩展 | `previewImport`、`extractMetadata`、`executeImport`、暂停/恢复（0096）、`getImportHistory`、`getImportDetails`、`getImportProgress`、`previewUndo`、`undoImport` | ✅ Photasa 已 `invoke` | 历史落盘：`app_data_dir/import_history_v1.json`（`ImportSessionStore`，原子写）。**`extract_metadata`：** 图片侧 `kamadak-exif`（日期/GPS、`cameraInfo.make/model`）；并已写入 **`cameraInfo.lens`（LensModel）、`iso`（PhotographicSensitivity / REI / ISOSpeed 等）、`focalLength`、`aperture`（FNumber）、`shutterSpeed`（ExposureTime，秒）**；视频侧 **`ffmpeg-next`（libavformat 探测，与 ffprobe JSON 同构的合并逻辑）**：`duration`、`codec`、`width`/`height`、`resolution`、`dateTime`+`dateSource:video_metadata`、`gpsInfo`（ISO6709 类标签）、`rawMetadata.rotation`；`computeMd5: true` → `rawMetadata.md5`。**构建**：`ffmpeg-next` **`build` + `build-zlib`**，静态链接 FFmpeg，**不**要求用户或 CI 安装系统 `ffmpeg` / `pkg-config`；构建机需能编译 C/汇编（见根目录 `AGENTS.md`）。**`preview_import`**：每组对每个候选文件调用同一 `extract_metadata_request` 再合并（`processFileGroup` 级），`determineGroupTargetDate`/`generateDatePath` 定 `targetPath`，`targetStructure`/`statistics`/`estimatedDuration` 与 Electron 预览对齐。**回归单测（Rust）**：`extract_metadata.rs` — 缺文件、`computeMd5`、`.txt`→`other`、最小 JPEG→`image`、`fileType:image` 覆盖未知扩展名；`extract_metadata_video.rs` — 与 `video-extractor.ts` 同构逻辑：`video_rotation`（tags/side_data/format）、`video_stream_dims` 90° 交换宽高、`select_best_date` Apple 优先、`extract_video_gps`、`parse_video_date_str`。**仍差**：真实容器 fixtures 端到端、MakerNote/静态图细字段 |
| 扫描队列 | `picasa:add-to-scan-queue` | ✅ Photasa | `watch_scan_queue.rs` + `notify` 合并发射；与 ROADMAP「对齐 WatchService」一致 |
| 遗留导入 | `importPhotos(…)` 整流 | ✅ Photasa（核心） | RFC **0093**：`import_photos_legacy` + `legacy-api`；`action.created` 规范为 `Date`；Rust/TS 单测已加；可选 fixtures 端到端对拍 |
| 缩略图 | `create_thumbnail` / `thumbnail.create` | ✅ Photasa | RFC **0069**；**0102**：RAW → JPEG 占位 + `fallback: true`；网格上 **「占位预览」** 徽标（`thumbnail-fallback-cache` + `BaseImage`）；扩展名绘入图内仍可选 |
| 启动 | Splash → 主窗 | ✅ Photasa（核心） | RFC **0101**：双窗 + `close_splashscreen`；**仍差**：Electron `SplashWindow.updateProgress` / `updateStatus` 类事件驱动文案（可选） |

## 仍差（下一批实现 / 文档）

1. **0097 导入表面**：`extract_metadata` 视频与 Electron **逐项对拍**（回退、边缘标签）；静态图 EXIF 已与 `CameraInfo` 对齐常见标签（镜头/ISO/焦距/光圈/快门），**MakerNote 与 UI 展示级差异**仍待对拍；`preview_import` 已与 Electron 预览链 **1:1**（每组全量元数据合并 + 目标路径/结构/统计/时长估算）。（静态图 EXIF 核心、视频 `ffmpeg-next` 探测主干、按需 MD5 已在 Rust 落地。）
2. ~~**0093**~~：`importPhotos` 核心已与 Electron 行为与 `FileAction` 形状对齐（见 **0093** 正文「Callback / event shape」）；大规模双端回归夹具仍为可选。
3. **0090 运维**：`tauri.conf.json` / builder 侧真实 `pubkey` 与更新端点。
4. **0101 延伸**：Splash 页若需与 Electron 一致的可变进度/状态，需 `emit`/`listen` 或 IPC 小协议（当前为静态 HTML）。
5. **0102 延伸**（部分已做）：`ImageList` + `BaseImage` 在内存缓存命中占位标记时展示「占位预览」徽标；占位图上绘制扩展名（更接近 `FallbackBrush`）仍为可选。

## 说明

- `cleanupScanQueue`：Electron 侧为空实现；Tauri 保持空操作即可，不单独 RFC。
- 从本清单移除某项时：同步更新本文件 Status、`README.md` 小表、必要时 `ROADMAP.md`「Current state」。

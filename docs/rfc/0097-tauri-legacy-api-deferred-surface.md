# RFC 0097: Tauri 扁平 legacy-api 延期表面（跟踪清单）

- **Start Date**: 2026-03-21
- **Status**: 🚧 Partial — 导入/扫描队列/watch 等已在 Photasa 接线；与 Electron 仍差元数据精度、`importPhotos` 遗留流（0093）、更新端点配置等（见文末「仍差」）
- **Depends on**: RFC 0075（扁平 API）；0088、0089、0090（日志/更新 — Photasa 已实现）；0070 + Rust（导入执行内核）

## Summary

本 RFC 跟踪 **`window.api` 上与 Electron 尚未 1:1** 或需持续对齐的条目，避免把多主题塞进单篇「胖 RFC」。逐项完成后在此表更新状态并同步 `docs/rfc/README.md` / `ROADMAP.md`。

## 状态表（相对 Electron）

| 区域 | API / 行为 | 状态 | 说明 |
|------|--------------|------|------|
| 更新 | `checkForUpdates`、`downloadUpdate`、`installUpdate`、`getUpdateStatus`、`updateAutoUpdateConfig` + `picasa:update-*` | ✅ Photasa | RFC 0090；**生产**仍需配置 `updater` 公钥与 endpoints |
| 日志 | `log_viewer_open` / `log_viewer_close`、`log:entry` 桥接 | ✅ Photasa | RFC 0088、0089 |
| 导入扩展 | `previewImport`、`extractMetadata`、`executeImport`、暂停/恢复（0096）、`getImportHistory`、`getImportDetails`、`getImportProgress`、`previewUndo`、`undoImport` | ✅ Photasa 已 `invoke` | 历史落盘：`app_data_dir/import_history_v1.json`（`ImportSessionStore`，原子写）。**`extract_metadata`：** 图片侧 `kamadak-exif`（日期/GPS/机型）；视频侧 **`ffmpeg-next`（libavformat 探测，与 ffprobe JSON 同构的合并逻辑）**：`duration`、`codec`、`width`/`height`、`resolution`、`dateTime`+`dateSource:video_metadata`、`gpsInfo`（ISO6709 类标签）、`rawMetadata.rotation`；`computeMd5: true` → `rawMetadata.md5`。**构建**：`ffmpeg-next` **`build` + `build-zlib`**，静态链接 FFmpeg，**不**要求用户或 CI 安装系统 `ffmpeg` / `pkg-config`；构建机需能编译 C/汇编（见根目录 `AGENTS.md`）。**仍差**：镜头/ISO 等细 EXIF、更复杂容器标签与 Electron 逐项对拍、预览 `targetStructure` 细粒度 |
| 扫描队列 | `picasa:add-to-scan-queue` | ✅ Photasa | `watch_scan_queue.rs` + `notify` 合并发射；与 ROADMAP「对齐 WatchService」一致 |
| 遗留导入 | `importPhotos(…)` 整流 | ⏳ | RFC **0093** — 与 0070/0097 区分：旧回调式复制流 |

## 仍差（下一批实现 / 文档）

1. **0097 导入表面**：`extract_metadata` 视频与 Electron **逐项对拍**（回退、边缘标签）；EXIF 扩展字段（镜头、ISO 等）与 Ma-Liang 深度对齐；`previewImport` 的 `targetStructure` 细化。（静态图 EXIF 核心、视频 `ffmpeg-next` 探测主干、按需 MD5 已在 Rust 落地。）
2. **0093**：`importPhotos` Rust 与 legacy-api 1:1 核查（若已部分实现，在本 RFC 表与 0093 正文互链更新）。
3. **0090 运维**：`tauri.conf.json` / builder 侧真实 `pubkey` 与更新端点。

## 说明

- `cleanupScanQueue`：Electron 侧为空实现；Tauri 保持空操作即可，不单独 RFC。
- 从本清单移除某项时：同步更新本文件 Status、`README.md` 小表、必要时 `ROADMAP.md`「Current state」。

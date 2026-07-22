# RFC 0097: Tauri 扁平 legacy-api 延期表面（跟踪清单）

- **Start Date**: 2026-03-21
- **Last updated**: 2026-06-08
- **Status**: ✅ Implemented — Phase 7（0111–0114）全部完成；表内 0107（天枢/偏好）独立存在已知生产打包缺口，详见 0107 自身文档，不影响本清单归档（2026-07-21 复核修正）
- **Depends on**: RFC 0075（扁平 API）；0088–0090；0070 + Rust 导入内核；[ROADMAP.md](../../../ROADMAP.md)

## Implementation principle (Photasa / Tauri)

> **Rust rewrite, not TypeScript copy.** Policy: [ROADMAP.md](../../../ROADMAP.md).

- contract reference/Node code is a **behavioral specification** only—not a library for Photasa.
- Implement in `apps/photasa/src-tauri` and `crates/`; **do not** import `@photasa/scan`, `@photasa/import`, or other Node packages from Tauri.
- **1:1 parity** = same IPC/events/on-disk formats; **not** porting TypeScript source.

## Summary

本 RFC 是 **Photasa 唯一的 Active 跟踪 RFC**：对照 contract reference 全量后端能力，列出 **已在 Rust 重写**、**Partial**、**未重写/禁止路径**。对拍方式 = Rust 实现 + legacy-api 契约，见 [ROADMAP.md](../../../ROADMAP.md) → **contract reference → Rust parity audit**。

---

## v2.0 能力 → Rust 状态总表

| 能力域              | contract reference       | Rust                                              | 状态                                                                  |
| ------------------- | ------------------------ | ------------------------------------------------- | --------------------------------------------------------------------- |
| 窗口 / Shell / 平台 | preload + main           | `window`, `shell`, `platform`                     | ✅                                                                    |
| 路径                | Node path-util           | `path.rs` + 少量 Vue 纯 TS                        | ✅                                                                    |
| 配置读写            | worker + preload fs      | `config.rs`                                       | ✅                                                                    |
| 目录对话框          | directory-service        | `directory.rs`                                    | ✅（**0114** OS 路径映射）                                            |
| 扫描                | scan-worker + cache      | `scan_runner` + `scan_cache`                      | ✅（0105）                                                            |
| 扫描状态条          | `notify:status`          | **`scan_notify.rs` + scan_runner**                | ✅（**0111**）                                                        |
| 监视 / 扫描队列     | watch-service            | `watch` + `watch_scan_queue`                      | ✅                                                                    |
| 缩略图              | Ma-Liang worker          | `thumbnail.rs`                                    | ✅（0102/0103）                                                       |
| 导入流水线          | import-worker            | `import_*` + `import_date_util`                   | ✅（0104, **0114** scan FileGroup）                                   |
| 遗留导入            | preload fs               | `import_photos_legacy`                            | ✅（0093）                                                            |
| 元数据              | worker + preload EXIF    | `extract_metadata*.rs`                            | ✅（**0112** golden）                                                 |
| 日志                | log-viewer               | `log_viewer.rs`                                   | ✅                                                                    |
| 更新                | update-service           | `update.rs` + `update_periodic` + `update_config` | ✅（**0113**）                                                        |
| 菜单                | menu-service             | `menu.rs` + 天枢                                  | ✅                                                                    |
| 天枢 / 偏好         | tianshu + wenchang       | `TianshuService` + `photasa-preference`           | 🔨（0107，crate/adapter 完成，生产打包 workflow 加载缺失，详见 0107） |
| Splash / 单实例     | splash + single-instance | 0100/0101                                         | 🚧 UI polish 可选                                                     |
| WASM 命令           | （历史）                 | ✅ **已删除**（0114）                             |
| `@photasa/*` 包     | 0098 contract reference  | **禁止** Tauri 引用                               | ⛔                                                                    |

---

## ✅ 已在 Rust 重写（0097 子项）

| 区域                   | API / 行为                                         | RFC              |
| ---------------------- | -------------------------------------------------- | ---------------- |
| 更新命令 + 事件 + 定时 | `checkForUpdates`… + `picasa:update-*` + 后台 loop | 0090, **0106**   |
| 日志                   | `log_viewer_*` + `log:entry`                       | 0088, 0089       |
| 导入扩展               | preview/execute/cancel/pause/resume/history/undo   | 0070, 0096, 0104 |
| 扫描                   | `scan_photos` + `.photasa-folder.json` + progress  | **0105**         |
| 扫描队列               | `picasa:add-to-scan-queue`                         | watch_scan_queue |
| 遗留导入               | `importPhotos` 流                                  | 0093             |
| 缩略图                 | RAW fallback                                       | 0069, 0102       |
| Splash 核心            | 双窗 + close                                       | 0101             |

---

## 🚧 Partial — 已全部收口（Phase 7）

| 缺口                            | Rust 下一步                                    | 子 RFC      |
| ------------------------------- | ---------------------------------------------- | ----------- |
| **`notify:status` 缺失**        | ~~`build_scan_notify_payload`~~                | ✅ **0111** |
| 元数据 golden / MakerNote       | fixtures + 对拍测试                            | ✅ **0112** |
| **updater pubkey + 启动灌配置** | preferences → `UpdateState`                    | ✅ **0113** |
| **`scanDirectories` 形状**      | 返回 `FileGroup[]` + 可选 `filters`            | ✅ **0114** |
| **`get_directory` OS 路径**     | `desktop`/`documents`/`home` → `dirs::*_dir()` | ✅ **0114** |
| **Splash / RAW 占位 polish**    | ✅ RAW 扩展名 + Splash 主题同步                | 完成        |
| **WASM 废弃文件**               | `wasm.rs` × 2 删除，`main.rs` 解注册           | ✅ **0114** |

---

## ⛔ 不是 Photasa 重写目标（勿误标为缺口）

| 项                                         | 原因                                      |
| ------------------------------------------ | ----------------------------------------- |
| **RFC 0098** `@photasa/*` 抽包             | deferred，Deferred                        |
| **Ma-Liang / `@photasa/maliang` WASM**     | 已由 Rust `image` + libheif + ffmpeg 替代 |
| **preload 本地 `importPhotos` fs**         | 已由 `import_photos_legacy` Rust 替代     |
| **v2.0 contract reference RFC（0032 等）** | Legacy 索引；Photasa 用 0068/0105         |

---

## ✅ 全部完成（Phase 7 收口）

1. ~~**0111**~~ ✅ — `notify:status`
2. ~~**0112**~~ ✅ — `extract_metadata` golden
3. ~~**0113**~~ ✅ — updater 生产 + preferences 同步
4. ~~**0114**~~ ✅ — `get_directory` OS 路径映射 + `scan_directories` → `FileGroup[]` + WASM 清理

**Status: ✅ Implemented。**

---

## 说明

- `cleanupScanQueue`：contract reference 空实现；Tauri 保持空操作。
- 从本清单移除某项时：同步 ROADMAP parity audit、`TASK_TRACKING.md` Photasa Active 表。

# TASK_TRACKING.md

当前活跃任务和 RFC 实现进度。不重复 ROADMAP.md 中的战略规划；本文件只跟踪**具体实现任务**的当前状态。

**Photasa 黄金规则：** [TAURI_RUST_REWRITE_POLICY.md](./docs/rfc/TAURI_RUST_REWRITE_POLICY.md) — Rust 重写后端；Electron/TS 仅作行为规格，禁止复制 TS 到 Tauri。

**Active RFC 规则：** 凡标为 **Photasa Active** 的 RFC，实现目标必须是 **`apps/photasa/src-tauri` / `crates/` 中的 Rust**；不得把 `@photasa/*` Node 包或 Electron main 抽包当作 Photasa 交付路径。

---

## Phase 5 – 1:1 Parity Gaps（2026-04）

以下 5 个任务来自 Electron vs Tauri 全面对比分析。每项对应一个 RFC，优先级见下表。

| 任务                 | RFC                                                                   | 优先级    | 状态 | 阻断 CI？                           |
| -------------------- | --------------------------------------------------------------------- | --------- | ---- | ----------------------------------- |
| 单实例管理           | [0100](./docs/rfc/completed/0100-tauri-single-instance.md)            | 🔴 High   | Done | 否（UX 问题）                       |
| 原生依赖构建策略     | [0103](./docs/rfc/completed/0103-tauri-native-deps-build-strategy.md) | 🔴 High   | Done | 否（embedded-libheif；FFmpeg 仍重） |
| window_reload 命令   | [0099](./docs/rfc/completed/0099-tauri-window-reload.md)              | 🟡 Medium | Done | 否                                  |
| RAW 缩略图回退       | [0102](./docs/rfc/completed/0102-tauri-thumbnail-raw-fallback.md)     | 🟢 Low    | Done | 否                                  |
| 启动 Splash 屏幕     | [0101](./docs/rfc/completed/0101-tauri-startup-splash.md)             | 🟢 Low    | Done | 否                                  |
| 应用偏好（文昌）落盘 | [0107](./docs/rfc/0107-tauri-wenchang-preferences-storage.md)         | 🔴 High   | Done | 否                                  |

### RFC 0107 — 应用偏好（文昌）落盘

**目标**：Tauri 侧与 Electron 等价：应用级偏好落盘 `~/.photasa/preferences/preferences.json`，并能通过天枢 `get_preferences` / `update_preferences` 回传并自动同步到 Renderer store。

- [x] 新增 workspace crate：`crates/wenchang-preferences`
- [x] `ConfigAdapter` 改名为 `config`（不再占用 `wenchang`）
- [x] 新增 `PreferencesAdapter`：`name() == "wenchang"`，实现 preference 工作流所需 actions
- [x] `TianshuService`：注册 `PreferencesAdapter` 与 `ConfigAdapter`
- [x] Rust 单测：默认偏好、apply delta、history、restore revision
- [x] 验证证据：`cargo test -p wenchang-preferences` + `cargo build -p photasa`（2026-04-12）

### RFC 0100 — 单实例管理

**目标**：第二个 Photasa 实例启动时自动退出并聚焦已有窗口。

- [x] `Cargo.toml`：`tauri-plugin-single-instance = "2"`
- [x] `main.rs`：首插件 `single_instance::init`，回调内聚焦 `main` 标签 WebviewWindow
- [x] `main.rs`：`build` + `run` 闭包处理 macOS `RunEvent::Reopen`（`restore_main_window`）
- [ ] 验证：macOS + Windows 各启动两个实例（手测）

### RFC 0103 — 原生依赖构建策略

**目标**：CI 能在 macOS / Linux / Windows 上无需手动安装系统 ffmpeg / libheif 完成构建。

- [x] 确认 `ffmpeg-next` 使用 `build` + `build-zlib` feature（`apps/photasa/src-tauri/Cargo.toml`）
- [x] `libheif-rs` 使用 **`embedded-libheif`**（无需系统 libheif-dev）
- [ ] 编写 GitHub Actions 片段（NASM 安装：macOS `brew` / Linux `apt` / Windows `ilammy/setup-nasm`）— 以各 workflow 为准
- [ ] 启用 `Swatinem/rust-cache` 减少构建时间
- [ ] CI 构建后执行 `otool -L` / `ldd` 验证静态链接（可选）
- [x] 在根目录 `AGENTS.md` 补充 FFmpeg + HEIC（embedded）说明

### RFC 0099 — window_reload 命令

**目标**：Tauri 菜单「重新加载」(Ctrl+R) 能刷新 WebView。

- [x] `commands/window.rs`：`reload_window`（`WebviewWindow::reload()`）
- [x] `main.rs`：注册 `reload_window`
- [x] `legacy-api.ts`：`reloadWindow` → `invoke("reload_window")`
- [x] `zhangsunwuji`：`view-reload` / `view-force-reload` 按 key 调用 `api.reloadWindow`（系统菜单事件无 `role`）

### RFC 0102 — RAW 缩略图回退

**目标**：CR2/CR3/NEF/ARW 等 RAW 格式生成占位缩略图而非空白。

- [x] `thumbnail.rs`：`make_raw_placeholder_thumbnail`（纯色 JPEG 占位）
- [x] `create_thumbnail`：RAW 分支走占位逻辑
- [x] `ThumbnailResponse`：`fallback: Option<bool>`
- [x] 前端：`ImageList` / `BaseImage` 「占位预览」徽标（`thumbnail-fallback-cache`）；扩展名绘入图内仍可选

### RFC 0101 — 启动 Splash 屏幕

**目标**：冷启动时显示 Splash 窗口，主窗口就绪后过渡。

- [x] `tauri.conf.json`：`splash` + `main`（`visible: false`）
- [x] `commands/window.rs`：`close_splashscreen`
- [x] `main.rs`：注册 `close_splashscreen`
- [x] `apps/photasa/public/splash.html`：轻量 Splash UI
- [x] `App.vue`：`initializeApp` 的 `finally` 中 `invoke("close_splashscreen")`

---

---

## Phase 6 – Deep Code Parity（2026-04）

Deep line-by-line review of every Rust command file against its TypeScript equivalent found 3 additional gaps.

| 任务                        | RFC                                                         | 优先级    | 状态    | 说明                                                                |
| --------------------------- | ----------------------------------------------------------- | --------- | ------- | ------------------------------------------------------------------- |
| execute_import 日期目录组织 | [0104](./docs/rfc/0104-tauri-execute-import-date-folder.md) | 🔴 High   | Done    | `import_date_util` + `execute_import` 日期子目录与相对 `targetPath` |
| 扫描增量缓存                | [0105](./docs/rfc/0105-tauri-scan-incremental-cache.md)     | 🔴 High   | ✅ Done | `scan_cache` + `scan_runner`；progress total 对齐 Electron          |
| 更新定时检查                | [0106](./docs/rfc/0106-tauri-update-periodic-check.md)      | 🟡 Medium | ✅ Done | `update_periodic.rs` Tokio 后台循环                                 |

### RFC 0104 — execute_import 日期目录组织

**目标**：导入执行时按文件拍摄日期生成 `{year}/{YYYYMMDD}/` 子目录，与 Electron 行为 1:1 一致。

- [x] 将 `generate_date_path_utc` / `determine_group_target_utc` 等提取至 `commands/import_date_util.rs`，`import_preview` 复用
- [x] 每文件经 `date_subpath_for_import_source`（内部 `extract_metadata_request`）解析日期
- [x] `target_dir = join_date_subpath(target_path, date_sub)` + `copy_one`
- [x] `imported_files[].targetPath` 为相对路径 `{year}/{YYYYMMDD}/filename`
- [x] 单元测试：`import_date_util` 中 `date_subpath_follows_file_mtime_when_no_exif` 等（2026-04-12）

### RFC 0105 — 扫描增量缓存

**目标**：Rust `scan_photos` 读写 `.photasa-folder.json` 缓存，对前端上报准确 `processed/total`，支持断点续扫。

- [x] `FolderScanCache` 结构体（`version`, `processedFiles`, `pendingFiles`, …）— `scan_cache.rs`
- [x] Discovery 阶段：walkdir 收集候选路径写入 `pendingFiles`，持久化 `.photasa-folder.json`
- [x] Processing 循环：每处理一文件更新缓存，emit `progress { processed, total }`
- [x] Resume：缓存存在且 `pendingFiles` 非空时跳过 discovery
- [x] `operationType == "file"`：`is_photasa_media_file` 扩展名守卫（`scan_runner.rs`）
- [x] `scan_adapter.rs` 的 `scanPaths` 使用 `run_directory_scan_sync`
- [x] 单元测试：`scan_cache` + `scan_runner` routing（2026-06-06）

### RFC 0106 — 更新定时检查

**目标**：app 启动后 5 秒自动检查一次，并按配置的 `checkInterval` 小时循环检查。

- [x] `main.rs` setup 中 `spawn_periodic_update_checker` 后台任务
- [x] 初始延迟 5 秒 + 启动时始终检查（对齐 Electron）
- [x] 循环读取 `UpdateState.auto_config.enabled` / `check_interval`，禁用时跳过检查但保持循环
- [x] `perform_check_for_updates` 供命令与后台共用
- [x] `RunEvent::ExitRequested` 取消后台任务
- [x] `get_app_version` 已在 `platform.rs` 注册
- [x] 单元测试：`check_interval_secs`（2026-06-06）

---

## Phase 7 – Rust Parity Closure（2026-06）

**父跟踪 RFC：[0097](./docs/rfc/0097-tauri-legacy-api-deferred-surface.md)**。全部交付物为 Rust；Electron/TS 仅作契约对照。

| 任务                              | RFC                                                                 | 优先级    | 状态    | 说明                                                                           |
| --------------------------------- | ------------------------------------------------------------------- | --------- | ------- | ------------------------------------------------------------------------------ |
| 扫描 `notify:status`              | [0111](./docs/rfc/0111-tauri-scan-notify-status-bridge.md)          | 🔴 High   | ✅ Done | `scan_notify.rs` + `scan_runner` 双 emit                                       |
| 元数据 golden 对拍                | [0112](./docs/rfc/0112-tauri-extract-metadata-golden-parity.md)     | 🔴 High   | ✅ Done | fixtures + golden 测试 + EXIF tag-number 修复                                  |
| 更新运维 + 偏好同步               | [0113](./docs/rfc/0113-tauri-updater-production-and-prefs-sync.md)  | 🟡 Medium | ✅ Done | `update_config.rs` + `UPDATER.md` + `system.autoUpdate`                        |
| legacy-api 小项                   | [0114](./docs/rfc/0114-tauri-get-directory-os-paths.md)             | 🟡 Medium | ✅ Done | `get_directory` OS 路径；`scan_directories` FileGroup+filters                  |
| 废弃 WASM 命令                    | 0114                                                                | 🟢 Low    | ✅ Done | 已删除 `load_wasm_module` / `call_wasm_function` + `wasm.rs`；无 wasmtime 依赖 |
| WebView 本地图片 asset 协议       | [0115](./docs/rfc/0115-tauri-webview-local-image-asset-protocol.md) | 🔴 High   | ✅ Done | `convertFileSrc` + CSP/assetProtocol；修复 file:// 不可加载                    |
| `.photasa.json` 缩略图路径 parity | [0116](./docs/rfc/0116-tauri-photasa-config-thumbnail-parity.md)    | 🔴 High   | ✅ Done | Electron `toRelativeThumbnailPath`；fix legacy stubs + folder race             |
| 扫描流水线 Electron 契约          | [0117](./docs/rfc/0117-tauri-scan-pipeline-parity.md)               | 🔴 High   | ✅ Done | SKIP-only 递归 + SKIP progress `(N,N)` 已修；52 scan 测试通过                  |

**建议执行顺序：** ~~0111 → 0112 → 0113 → 0114~~ ✅ **Phase 7 全部完成。** 0097 已标 ✅ Implemented。0115 为图库显示 hotfix（2026-06-06）。**0116** 修复 config/thumbnail/rescan 契约（2026-06-06 ✅）。**0117** 扫描流水线对齐 Electron（2026-06-06 ✅，含 SKIP-only 递归 + SKIP progress 修复）。

### RFC 0117 — 扫描流水线 Electron 契约

**目标**：`scan_runner.rs` 按 Electron `@photasa/scan` **行为契约**补回 SKIP/FULL 策略、文件级门控、续扫、子目录递归与批量缓存写入。

- [x] `scan_strategy.rs`：`decide_scan_strategy` / `should_process_file` / `should_scan_one_level` / `compute_folder_hash`（精确决策表 + 单测）
- [x] `scan_runner.rs`：策略驱动编排（SKIP / FULL fresh / FULL resume / fallback）
- [x] `scan_runner.rs`：SKIP 路径 `restore_cached_files` + **仅 SKIP** 子目录递归（`should_recurse_subdirs`）
- [x] 串行 `create_thumbnail_sync`（与 Electron `concatMap` 一致）；`should_process_file` 门控
- [x] `IncrementalCacheManager` 批量写入（20/50/200 + 5s）；progress `currentFile` 契约修正；内存计数
- [x] 统一 process→record 顺序；去掉 50ms sleep（同步写）
- [x] `scan_cleanup.rs`：`extended_cleanup`（7 天 GC）+ 单测（**已移植但无 live caller，未接线**）
- [x] **BUG①**：FULL 不递归子目录；`current` 不递归 — `should_recurse_subdirs` + 3 单测
- [x] **BUG②**：SKIP progress `(idx+1, N)` → `(N,N)` — `restore_cached_files` + 映射单测
- [x] `complete.paths` 恒 `[]`（Electron parity）
- [x] `cargo test scan_`（**52 passed**）+ `cargo build -p photasa`
- [ ] **集成测试**：`app.emit` 副作用序列仍需 Tauri harness（可选后续）

### RFC 0116 — `.photasa.json` thumbnail parity

- [x] `photasa_config.rs`：`fix_config_sync` + `add_photo_to_folder_list` 对齐 Electron
- [x] `config_adapter.rs`：`fixConfig` 委托 Rust `fix_config_sync`
- [x] `scan_runner.rs`：rescan 完成后 `fix_config_sync`
- [x] `photasa-path.ts` + `legacy-api.ts` 路径 stub 修复
- [x] `FolderList.vue` / `ImageList.vue` 切换文件夹竞态
- [x] `cargo test` + Vitest

### RFC 0115 — WebView 本地图片（asset 协议）

- [x] `media-url.ts`：`ensureWebviewMediaUrl`、`parseAssetWebviewUrl`
- [x] `index.html` + `tauri.conf.json` CSP 对齐 `asset:`
- [x] `BaseImage.vue` / `image-prefetch.ts` 加载前转换
- [x] `legacy-api` + `path.rs` 停止产出 `file://` 给 WebView
- [x] Vitest + `file_url_from_path` Rust 单测
- [ ] 手测：重启 `tauri dev` 后网格缩略图可见，`src` 为 `asset://localhost/…`

### RFC 0111 — notify:status

- [x] `commands/scan_notify.rs` + 单测
- [x] `scan_runner.rs` progress/complete/error 双 emit
- [ ] 手测：Tauri 扫描时状态栏有进度

### RFC 0112 — extract_metadata golden

- [x] fixtures + golden JSON（`tests/fixtures/metadata/`）
- [x] Nikon/Canon/Sony EXIF + sample/corrupt video
- [x] 缺文件 / 损坏容器回退；EXIF 按 tag number + Double 解析

### RFC 0113 — updater 生产 + 偏好

- [x] `main.rs` setup：从 `preferences.json` 灌 `UpdateState`（`update_config.rs`）
- [x] 文档化 `tauri.conf.json` pubkey/endpoints（`apps/photasa/src-tauri/UPDATER.md`）
- [x] 单测：preferences 影响 periodic checker
- [x] `wenchang-preferences`：`system.autoUpdate` 字段

### RFC 0097 / 0114 — 剩余 Rust 收口

- [x] **`get_directory`**：`desktop`/`documents`/`home` 映射 OS 路径（Electron `app.getPath`），非空 `DirectoryStore` 优先
- [x] **`scan_directories`**：返回 `FileGroup[]` + 可选 `filters`（非 flat `string[]`）
- [x] **WASM 清理**：删除 stub 命令与 `wasm.rs`；**禁止** wasmtime / WASM 过渡方案（见 [TAURI_RUST_REWRITE_POLICY](./docs/rfc/TAURI_RUST_REWRITE_POLICY.md)）
- [x] **RAW 占位扩展名**：`thumbnail_placeholder.rs` 位图字体（0102 迭代）
- [x] **`picasa:engine-status`**：`engine_status.rs` — setup 里程碑发射（`initializing` / `ready` / `error`）
- [x] **Splash 主题同步**：`splash_bridge.rs` — `splash:theme-changed` + `WindowEvent::ThemeChanged`

---

## 已完成（截至 2026-04-05）

所有 Phase 1–4 RFC（0074–0097）均已实现。详见 [ROADMAP.md](./ROADMAP.md)（**RFC 仓库索引** + Current state）与本文件下文 **Active / Implemented** 全表。

核心服务对等状态：

| 服务        | Electron                                 | Rust/Tauri                                             | 状态                               |
| ----------- | ---------------------------------------- | ------------------------------------------------------ | ---------------------------------- |
| 扫描        | `scan-service.ts` + `scan-worker.ts`     | `scan_runner.rs` + `scan_cache.rs`                     | ✅ RFC 0105 增量缓存               |
| 缩略图      | `thumbnail-service.ts` (MaLiang)         | `thumbnail.rs` (image/libheif/ffmpeg + RAW 扩展名占位) | ✅（RAW 标签 2026-06）             |
| 导入执行    | `import-service.ts`                      | `import_execute.rs`                                    | ✅ RFC 0104 日期子目录             |
| 导入预览    | `import-service.ts`                      | `import_preview.rs`                                    | ✅                                 |
| 导入历史    | `ImportHistoryManager`                   | `import_session_store.rs`                              | ✅                                 |
| 遗留导入    | `preload/legacy.ts` RxJS 流              | `import_legacy.rs`                                     | ✅                                 |
| 元数据提取  | `import-worker` + MaLiang EXIF           | `extract_metadata.rs` + `ffmpeg-next`                  | ✅ (MakerNote 待)                  |
| 配置        | `config-service.ts` + `config-worker.ts` | `config.rs`                                            | ✅                                 |
| 文件监视    | `watch-service.ts` (chokidar)            | `watch.rs` (notify) + `watch_scan_queue.rs`            | ✅                                 |
| 目录操作    | `directory-service.ts`                   | `directory.rs`                                         | ✅                                 |
| 窗口控制    | `window-service.ts`                      | `window.rs`                                            | ✅（含 reload，RFC 0099）          |
| Shell       | `shell-service.ts`                       | `shell.rs`                                             | ✅                                 |
| 菜单        | `menu-service.ts`                        | `menu.rs`                                              | ✅                                 |
| 日志查看器  | `log-viewer-service.ts`                  | `log_viewer.rs` + `log_toggle_shortcut.rs`             | ✅                                 |
| 自动更新    | `update-service.ts`                      | `update.rs` + `update_periodic.rs`                     | ✅ RFC 0106 定时检查（端点待配置） |
| 平台检测    | `platform.ts`                            | `platform.rs`                                          | ✅                                 |
| 路径工具    | `@shared/path-util`                      | `path.rs`                                              | ✅                                 |
| 单实例      | `single-instance-manager.ts`             | `tauri-plugin-single-instance` + `RunEvent::Reopen`    | ✅ RFC 0100                        |
| Splash 屏幕 | `splash-window.ts`                       | `tauri.conf` 双窗 + `close_splashscreen`               | ✅ RFC 0101                        |

---

## Photosa Active RFCs（Rust-only — 唯一活跃 sprint 源）

以下 RFC **允许**作为 Photasa 当前/下一 sprint 的实现依据。后端交付物必须是 Rust；Electron/TS 仅作契约对照。全量对拍见 [ROADMAP.md](./ROADMAP.md) → **Electron → Rust parity audit（2026-06）**。

| RFC                                                                   | Title                                                    | Status                   | Rust 交付                                                                 |
| --------------------------------------------------------------------- | -------------------------------------------------------- | ------------------------ | ------------------------------------------------------------------------- |
| [0097](./docs/rfc/0097-tauri-legacy-api-deferred-surface.md)          | legacy-api 与 Electron 1:1 跟踪（**父 RFC**）            | ✅ Implemented           | Phase 7（0111–0114）全部完成                                              |
| [0111](./docs/rfc/0111-tauri-scan-notify-status-bridge.md)            | 扫描 `notify:status` 桥                                  | ✅ Implemented           | `scan_notify.rs` + `scan_runner`                                          |
| [0112](./docs/rfc/0112-tauri-extract-metadata-golden-parity.md)       | `extract_metadata` golden                                | ✅ Implemented           | fixtures + golden 测试                                                    |
| [0113](./docs/rfc/0113-tauri-updater-production-and-prefs-sync.md)    | updater 生产 + 偏好同步                                  | ✅ Implemented           | `update_config.rs` + `UPDATER.md`                                         |
| [0114](./docs/rfc/0114-tauri-get-directory-os-paths.md)               | `get_directory` OS 路径 + `scan_directories` FileGroup[] | ✅ Implemented           | `directory.rs` + `import_file_groups.rs` + `import_scan_directories.rs`   |
| [0115](./docs/rfc/0115-tauri-webview-local-image-asset-protocol.md)   | WebView 本地图片 asset 协议                              | ✅ Implemented           | `media-url.ts` + CSP/assetProtocol + `path.rs`                            |
| [0118](./.spec/rfc/0118-tauri-import-background-ui.md)                | 导入后台 UI（G1–G9,G13–G14）                             | 🔨 In Progress（**P2**） | Vue session + chip                                                        |
| [0119](./.spec/rfc/0119-tauri-import-checksum.md)                     | checksum 诚实                                            | ⏳ Draft（**P3a**）      | 一事                                                                      |
| [0120](./.spec/rfc/0120-tauri-import-quit-recovery.md)                | 退出恢复（G11）                                          | ⏸️ Deferred              | 一事                                                                      |
| [0121](./.spec/rfc/0121-tauri-import-settings-prefs.md)               | Settings 导入（G12）                                     | ⏸️ Deferred              | 一事                                                                      |
| [0122](./.spec/rfc/0122-tauri-legacy-importphotos-background-ux.md)   | Legacy importPhotos UX（G10）                            | ⏸️ Deferred              | 一事                                                                      |
| [0123](./.spec/rfc/0123-tauri-import-duplicate-count.md)              | duplicateCount 诚实                                      | ⏳ Draft（**P3b**）      | 一事                                                                      |
| [0124](./.spec/rfc/0124-tauri-import-resume-return-shape.md)          | resume 返回形状                                          | ⏳ Draft（**P3c**）      | 一事                                                                      |
| [0125](./.spec/rfc/0125-tauri-import-paused-progress-emit.md)         | paused progress emit                                     | ⏳ Draft（**P3d**）      | 一事                                                                      |
| [0126](./.spec/rfc/0126-electron-import-background-ux-parity.md)      | Electron desktop UX                                      | ⏸️ Deferred              | 一事                                                                      |
| [0127](./.spec/rfc/0127-tauri-import-error-payload-shape.md)          | `import:error` payload 形状（`[object Object]`）         | ⏳ Draft（**P3e**）      | 一事                                                                      |
| [0128](./.spec/rfc/completed/0128-tauri-import-progress-import-id.md) | `import:progress` 缺 `importId`                          | ✅ Implemented           | Rust progress JSON + frontend filter (2026-07-18)                         |
| [0129](./.spec/rfc/0129-tauri-import-progress-throttle.md)            | `import:progress` 无节流                                 | ⏳ Draft（**P3g**）      | 一事                                                                      |
| [0130](./.spec/rfc/completed/0130-tauri-import-legacy-copy-dedup.md)  | `import_legacy.rs` 复制逻辑去重                          | ✅ Implemented           | `unique_dest_path` + `copy_one`；legacy 叠 `set_file_times`（2026-07-18） |
| [0131](./.spec/rfc/completed/0131-tauri-photasa-import-crate.md)      | `photasa-import` 独立 crate                              | ✅ Implemented           | 算法零 Tauri；`cargo test -p photasa-import` **36 passed**（2026-07-18）  |

**Gap/T3 铁律：** 一事一 RFC；禁 mono 袋。P1 验收 → **P2 0118** → **P3a–g 0119/0123/0124/0125/0127/0128✅/0129** → **P4 0130** ✅；infra **0131** ✅。

**Phase 5–6** Done。禁 **0098** 作 Photasa 路径。

---

## Legacy / Electron backlog（非 Photasa Active）

v2.0 Electron RFC（Draft / In Progress）**不算** Photasa 活跃项。若要在 Photasa 交付同等能力，必须 **新建或引用已有 Tauri Rust RFC**（如 0105 替代 Electron 扫描缓存），**不得**直接推进下表作为 Tauri 路径。

| RFC                                                                                                          | Title                        | Status      | 说明                                        |
| ------------------------------------------------------------------------------------------------------------ | ---------------------------- | ----------- | ------------------------------------------- |
| [0098](./docs/rfc/0098-main-module-extraction-to-packages.md)                                                | main → `@photasa/*` packages | ⏸️ Deferred | **Electron-only**；Phase 2 冻结；非 Photasa |
| [0004](./docs/rfc/0004-ai-file-preview-service.md) … [0061](./docs/rfc/0061-zouwu-workflow-visualization.md) | （v2.0 能力草案）            | Draft / 🔨  | Legacy Electron；见下表全量索引             |

---

## Active RFCs（全量历史索引 — 含 Legacy）

路径相对仓库根。状态与正文头部不一致时，以 RFC 文件内 **Status** 为准并回写本表。

| RFC                                                                        | Title                                                | Status                           | Author | Target Release |
| -------------------------------------------------------------------------- | ---------------------------------------------------- | -------------------------------- | ------ | -------------- |
| [0004](./docs/rfc/0004-ai-file-preview-service.md)                         | AI文件在线预览服务                                   | Draft                            | 李鹏   | v2.0.0         |
| [0008](./docs/rfc/0008-scan-strategy-optimization.md)                      | 扫描策略优化                                         | Draft                            | 李鹏   | v2.0.0         |
| [0010](./docs/rfc/0010-folder-statistics-display.md)                       | 文件夹树节点统计信息显示                             | Draft                            | 李鹏   | v2.0.0         |
| [0012](./docs/rfc/0012-unified-path-handling-architecture.md)              | 统一路径处理架构重构                                 | Draft                            | 李鹏   | v2.0.0         |
| [0014](./docs/rfc/0014-file-scan-folder-tree-update.md)                    | 文件扫描时文件夹树更新优化                           | Draft                            | 李鹏   | v2.0.0         |
| [0018](./docs/rfc/0018-scanning-folder-priority-sorting.md)                | 扫描文件夹优先级排序优化                             | Draft                            | 李鹏   | v2.0.0         |
| [0020](./docs/rfc/0020-auto-update-server.md)                              | Auto-Update System - Server Implementation           | Draft                            | 李鹏   | v2.0.0         |
| [0021](./docs/rfc/0021-playwright-e2e-testing-architecture-enhancement.md) | Playwright E2E Testing Architecture Enhancement      | Draft                            | 李鹏   | v2.0.0         |
| [0022](./docs/rfc/0022-test-stabilization-issues-and-solutions.md)         | Test Stabilization Issues and Solutions              | Draft                            | 李鹏   | v2.0.0         |
| [0023](./docs/rfc/0023-startup-performance-optimization.md)                | Startup Performance Optimization                     | Draft                            | 李鹏   | v2.0.0         |
| [0025](./docs/rfc/0025-tree-auto-focus-on-expand.md)                       | 树组件自动聚焦展开优化                               | Draft                            | 李鹏   | v2.0.0         |
| [0029](./docs/rfc/0029-scan-skip-strategy-completion-fix.md)               | 扫描跳过策略完成修复                                 | Draft                            | 李鹏   | v2.0.0         |
| [0032](./docs/rfc/0032-qianliyan-scan-engine.md)                           | 千里眼扫描引擎 (含scan-service迁移)                  | 🔨 In Progress                   | 李鹏   | v2.0.0         |
| [0033](./docs/rfc/0033-shunfenger-watch-engine.md)                         | 顺风耳监听引擎                                       | Draft                            | 李鹏   | v2.0.0         |
| [0034](./docs/rfc/0034-linglong-vision-engine.md)                          | 玲珑视觉引擎                                         | Draft                            | 李鹏   | v2.0.0         |
| [0037](./docs/rfc/0037-zouwu-workflow-dsl.md)                              | 驺吾(Zouwu)工作流DSL                                 | Draft                            | 李鹏   | v2.0.0         |
| [0039](./docs/rfc/0039-tianshu-workflow-syntax-specification.md)           | 天枢工作流语法规范                                   | Draft                            | 李鹏   | v2.0.0         |
| [0043](./docs/rfc/0043-useqinqiong-access-pattern.md)                      | useQinQiong()访问模式 - appState统一访问             | Draft                            | AI     | v2.0.0         |
| [0049](./docs/rfc/0049-correct-e2e-testing-architecture.md)                | 正确的E2E测试架构设计                                | Draft                            | AI     | v2.0.0         |
| [0050](./docs/rfc/0050-taiyi-workflow-adapter-engine.md)                   | 太乙 - 工作流适配器与执行引擎                        | Draft                            | AI     | v2.0.0         |
| [0056](./docs/rfc/0056-yuchigong-code-quality-improvements.md)             | 尉迟恭代码质量改进                                   | Draft                            | AI     | v2.0.0         |
| [0058](./docs/rfc/0058-zhangsunwuji-menu-service.md)                       | 长孙无忌菜单服务 - 统一菜单管理到qizou流程           | 🔨 In Progress                   | AI     | v2.0.0         |
| [0061](./docs/rfc/0061-zouwu-workflow-visualization.md)                    | 驺吾工作流可视化 (Workflow Visualization)            | Draft                            | AI     | v2.0.0         |
| [0067](./docs/rfc/0067-tauri-app-photasa.md)                               | 创建 Tauri 应用 Photasa - 总体架构与迁移策略         | Implemented（总体索引）          | AI     | v2.1.0         |
| [0068](./docs/rfc/0068-tauri-scan-service-migration.md)                    | 扫描服务迁移到 Tauri                                 | Implemented                      | AI     | v2.1.0         |
| [0069](./docs/rfc/0069-tauri-thumbnail-service-migration.md)               | 缩略图服务迁移到 Tauri                               | Implemented（RAW 占位见 0102）   | AI     | v2.1.0         |
| [0070](./docs/rfc/0070-tauri-import-service-migration.md)                  | 导入服务迁移到 Tauri                                 | Implemented（细项对拍见 0097）   | AI     | v2.1.0         |
| [0071](./docs/rfc/0071-tauri-config-service-migration.md)                  | 配置服务迁移到 Tauri                                 | Implemented                      | AI     | v2.1.0         |
| [0072](./docs/rfc/0072-tauri-tianshu-service-migration.md)                 | 天枢服务迁移到 Tauri                                 | Implemented                      | AI     | v2.1.0         |
| [0073](./docs/rfc/0073-tauri-ui-migration-adapter.md)                      | UI 迁移与适配层设计                                  | Implemented                      | AI     | v2.1.0         |
| [0074](./docs/rfc/completed/0074-tauri-adapter-concept.md)                 | Tauri adapter concept and env detection              | Draft                            | AI     | v2.1.0         |
| [0075](./docs/rfc/completed/0075-tauri-flat-legacy-api-layer.md)           | Flat legacy API layer (window.api shape)             | Draft                            | AI     | v2.1.0         |
| [0076](./docs/rfc/completed/0076-tauri-path-utilities-rust.md)             | Path utilities in Rust (1:1 from Node, zero Node)    | Draft                            | AI     | v2.1.0         |
| [0077](./docs/rfc/completed/0077-tauri-get-photasa-config.md)              | get_photasa_config command                           | Draft                            | AI     | v2.1.0         |
| [0078](./docs/rfc/completed/0078-tauri-add-to-photo-list.md)               | add_to_photo_list command                            | Draft                            | AI     | v2.1.0         |
| [0079](./docs/rfc/completed/0079-tauri-remove-from-photo-list.md)          | remove_from_photo_list command                       | Draft                            | AI     | v2.1.0         |
| [0080](./docs/rfc/completed/0080-tauri-reset-photasa-config.md)            | reset_photasa_config command                         | Draft                            | AI     | v2.1.0         |
| [0081](./docs/rfc/completed/0081-tauri-fix-photasa-config.md)              | fix_photasa_config command                           | Draft                            | AI     | v2.1.0         |
| [0082](./docs/rfc/completed/0082-tauri-watch-start-stop-commands.md)       | Watch start/stop commands                            | Draft                            | AI     | v2.1.0         |
| [0083](./docs/rfc/completed/0083-tauri-watch-event-contract.md)            | Watch event contract                                 | Draft                            | AI     | v2.1.0         |
| [0084](./docs/rfc/completed/0084-tauri-choose-directory.md)                | choose_directory command                             | Draft                            | AI     | v2.1.0         |
| [0085](./docs/rfc/completed/0085-tauri-get-directory.md)                   | get_directory command                                | Draft                            | AI     | v2.1.0         |
| [0086](./docs/rfc/completed/0086-tauri-sub-folders.md)                     | sub_folders command                                  | Draft                            | AI     | v2.1.0         |
| [0087](./docs/rfc/completed/0087-tauri-check-photasa-config-folder.md)     | check_photasa_config (folder validation) command     | Draft                            | AI     | v2.1.0         |
| [0088](./docs/rfc/completed/0088-tauri-log-viewer-open.md)                 | Log viewer open/state command                        | Draft                            | AI     | v2.1.0         |
| [0089](./docs/rfc/completed/0089-tauri-log-stream-events.md)               | Log stream events                                    | Draft                            | AI     | v2.1.0         |
| [0090](./docs/rfc/completed/0090-tauri-update-service.md)                  | Update service                                       | Draft                            | AI     | v2.1.0         |
| [0091](./docs/rfc/completed/0091-tauri-platform-is-mac.md)                 | Platform / isMac / get_platform                      | Draft                            | AI     | v2.1.0         |
| [0092](./docs/rfc/completed/0092-tauri-menu-api.md)                        | Menu (applySystemMenu, onMenuAction)                 | Draft                            | AI     | v2.1.0         |
| [0093](./docs/rfc/completed/0093-tauri-import-photos-legacy.md)            | importPhotos legacy copy flow                        | Draft                            | AI     | v2.1.0         |
| [0094](./docs/rfc/completed/0094-tauri-choose-directories-multi.md)        | choose_directories（单/多选目录）                    | Draft                            | AI     | v2.1.0         |
| [0095](./docs/rfc/completed/0095-tauri-get-path-root.md)                   | get_path_root                                        | Draft                            | AI     | v2.1.0         |
| [0096](./docs/rfc/completed/0096-tauri-import-pause-resume.md)             | pause_import / resume_import                         | Draft                            | AI     | v2.1.0         |
| [0097](./docs/rfc/0097-tauri-legacy-api-deferred-surface.md)               | legacy-api 与 Electron 1:1 跟踪                      | ✅ Implemented（Photasa Active） | AI     | v2.1.0         |
| [0098](./docs/rfc/0098-main-module-extraction-to-packages.md)              | src/main 模块提取为 packages（Electron-only）        | ⏸️ Deferred                      | AI     | v2.1.0         |
| [0101](./docs/rfc/completed/0101-tauri-startup-splash.md)                  | Tauri 启动 Splash                                    | Implemented                      | AI     | v2.1.0         |
| [0102](./docs/rfc/completed/0102-tauri-thumbnail-raw-fallback.md)          | 缩略图 RAW 回退策略                                  | Implemented                      | AI     | v2.1.0         |
| [0103](./docs/rfc/completed/0103-tauri-native-deps-build-strategy.md)      | 原生依赖构建策略                                     | Implemented                      | AI     | v2.1.0         |
| [0104](./docs/rfc/0104-tauri-execute-import-date-folder.md)                | execute_import date-based folder organization        | ✅ Implemented                   | AI     | v2.1.0         |
| [0105](./docs/rfc/0105-tauri-scan-incremental-cache.md)                    | Scan incremental cache (.photasa-folder.json)        | ✅ Implemented                   | AI     | v2.1.0         |
| [0106](./docs/rfc/0106-tauri-update-periodic-check.md)                     | Updater background periodic check                    | ✅ Implemented                   | AI     | v2.1.0         |
| [0107](./docs/rfc/0107-tauri-wenchang-preferences-storage.md)              | Wenchang preferences storage                         | ✅ Implemented                   | AI     | v2.1.0         |
| [0111](./docs/rfc/0111-tauri-scan-notify-status-bridge.md)                 | Scan notify:status Rust bridge                       | 📋 Draft                         | AI     | v2.1.0         |
| [0112](./docs/rfc/0112-tauri-extract-metadata-golden-parity.md)            | extract_metadata golden parity                       | ✅ Implemented                   | AI     | v2.1.0         |
| [0114](./docs/rfc/0114-tauri-get-directory-os-paths.md)                    | get_directory OS 路径 + scan_directories FileGroup[] | ✅ Implemented                   | AI     | v2.1.0         |
| [0115](./docs/rfc/0115-tauri-webview-local-image-asset-protocol.md)        | WebView 本地图片 asset 协议（非 file://）            | ✅ Implemented                   | AI     | v2.1.0         |

> **说明**：**Photasa sprint 只看上一节「Photasa Active RFCs」。** 本表含 v2.0 Legacy 与历史快照；Tauri 0074–0107 在 [ROADMAP.md](./ROADMAP.md) 已标 Implemented 的，以实现为准。

## Implemented RFCs（归档索引）

| RFC                                                                                             | Title                                                    | Author | Implemented In | Notes                                                                                           |
| ----------------------------------------------------------------------------------------------- | -------------------------------------------------------- | ------ | -------------- | ----------------------------------------------------------------------------------------------- |
| [0001](./docs/rfc/completed/0001-import-wizard-system.md)                                       | Import Wizard System                                     | 李鹏   | v2.0.0         | Complete import wizard with multi-step flow                                                     |
| [0002](./docs/rfc/completed/0002-headless-ui-components.md)                                     | Headless UI Components for Picasa Vue                    | 李鹏   | v2.0.0         | 48 BaseUI components implemented, Ant Design fully removed, ~2.25MB bundle size reduction       |
| [0003](./docs/rfc/completed/0003-unify-watch-to-scan-queue.md)                                  | Unify File Watch Events to Scan Queue                    | 李鹏   | v2.0.0         | Persistent file operation queue with event deduplication                                        |
| [0005](./docs/rfc/completed/0005-local-ai-file-preview.md)                                      | 本地AI文件预览功能                                       | 李鹏   | v2.0.0         | 支持AI、PSD等设计文件的本地预览功能                                                             |
| [0006](./docs/rfc/completed/0006-photo-detail-drawer-decoupling.md)                             | Photo Detail Drawer Decoupling from Ant Design           | 李鹏   | v2.0.0         | Successfully replaced Ant Design drawer with custom BaseDrawer component                        |
| [0007](./docs/rfc/completed/0007-folder-scan-cache-optimization.md)                             | Folder Scan Cache Optimization                           | 李鹏   | v2.0.0         | Intelligent incremental scanning and cleanup mechanisms                                         |
| [0009](./docs/rfc/completed/0009-video-thumbnail-orientation.md)                                | Video Thumbnail Orientation Support                      | 李鹏   | v2.0.0         | Enhanced video thumbnail generation with rotation metadata support                              |
| [0011](./docs/rfc/completed/0011-imagelist-file-count-display.md)                               | ImageList File Count Display                             | 李鹏   | v2.0.0         | 在ImageList头部显示图片和视频文件计数，支持大数字格式化和响应式设计                             |
| [0013](./docs/rfc/completed/0013-default-folder-selection.md)                                   | 默认文件夹选择功能                                       | 李鹏   | v2.0.0         | 应用启动时自动选择默认文件夹，重启后恢复用户上次选择的文件夹                                    |
| [0015](./docs/rfc/completed/0015-intelligent-scan-optimization.md)                              | 验证智能扫描策略的子文件夹发现功能                       | 李鹏   | v2.0.0         | 验证并修复智能扫描策略，确认子文件夹发现功能正常工作                                            |
| [0016](./docs/rfc/completed/0016-basetree-component-implementation.md)                          | BaseTree Component Implementation                        | 李鹏   | v2.0.0         | 实现BaseTree组件替代ant-design-vue的a-tree，支持虚拟滚动和100% API兼容性                        |
| [0017](./docs/rfc/completed/0017-production-log-viewer.md)                                      | Production Log Viewer System                             | 李鹏   | v2.0.0         | 按需激活的生产环境日志查看器，零性能影响，支持主进程和Worker线程日志实时显示                    |
| [0019](./docs/rfc/completed/0019-auto-update-system.md)                                         | Auto-Update System - Client Implementation               | 李鹏   | v2.0.0         | 客户端自动更新系统实现，采用electron-updater方案，支持安全的preload集成                         |
| [0024](./docs/rfc/completed/0024-log-viewer-resizable-panel.md)                                 | 日志查看器可调整大小面板增强                             | 李鹏   | v2.0.0         | 为日志查看器添加可调整大小面板功能，提升可用性和改善日志内容可见性                              |
| [0026](./docs/rfc/completed/0026-file-type-indicator.md)                                        | 文件类型指示器                                           | 李鹏   | v2.0.0         | 图片列表添加文件类型视觉指示器，提升用户识别效率和交互体验                                      |
| [0027](./docs/rfc/completed/0027-wasm-memory-management-optimization.md)                        | WASM内存管理优化与HEIF解码错误处理                       | 李鹏   | v2.0.0         | 优化WASM HEIF解码器内存管理机制，增强错误处理，提升大型HEIF图像处理稳定性                       |
| [0028](./docs/rfc/completed/0028-ffmpeg-binary-packaging-fix.md)                                | FFmpeg Binary Packaging Fix                              | 李鹏   | v2.0.0         | 修复打包后ffmpeg二进制文件访问问题，确保生产环境视频处理功能正常工作                            |
| [0029](./docs/rfc/completed/0029-process-based-thumbnail-architecture.md)                       | 基于进程的缩略图架构                                     | 李鹏   | v2.0.0         | 进程池混合架构，隔离重型任务，有效控制内存，提升多核性能，增强稳定性                            |
| [0030](./docs/rfc/completed/0030-scan-status-reporting-fix.md)                                  | 扫描状态报告修复                                         | 李鹏   | v2.0.0         | 修复扫描过程中的状态报告问题，确保UI状态栏正确显示扫描进度和完成状态                            |
| [0031](./docs/rfc/completed/0031-maliang-image-processing-engine.md)                            | Ma-Liang 统一图像处理引擎                                | 李鹏   | v2.0.0         | 创建统一图像处理引擎，整合FFmpeg、Sharp、WASM-HEIF和Photon库，支持BMP和MPEG/MPG格式             |
| [0035](./docs/rfc/completed/0035-five-engine-orchestration-architecture.md)                     | 天枢·顺风耳·千里眼·司簿·马良五引擎编排架构               | 李鹏   | v2.0.0         | 建立五大核心引擎协同系统，通过太乙服务层桥接和YAML工作流元数据驱动，实现完整链路                |
| [0036](./docs/rfc/completed/0036-wenchang-preference-integration.md)                            | 偏好设置启动加载和保存机制                               | 李鹏   | v2.0.0         | 完整的偏好设置双向通信机制，启动加载、智能合并、实时保存，391测试通过                           |
| [0040](./docs/rfc/completed/0040-removepath-functionality-fix.md)                               | RemovePath功能修复 - 天界人界数据同步完整实现            | 李鹏   | v2.0.0         | 天界人界数据同步完整实现，修复UI更新问题，后续被RFC 0041进一步优化                              |
| [0041](./docs/rfc/completed/0041-preference-architecture-refactor-business-logic-separation.md) | 偏好架构重构 - 业务逻辑与存储层分离                      | 李鹏   | v2.0.0         | 应用Linus"好品味"原则，业务逻辑从WenchangEngine分离到FangXuanLing，架构更清晰易维护             |
| [0042](./docs/rfc/completed/0042-scanning-folder-migration.md)                                  | scanningFolder四步渐进式迁移（Step 1已完成）             | AI     | v2.0.0         | Step 1完成：ScanningStore创建（Accessor+Builder架构），后续步骤拆分为RFC 0046/0047/0048         |
| [0045](./docs/rfc/completed/0045-builtin-array-operations.md)                                   | Builtin数组操作增强                                      | AI     | v2.0.0         | 新增arrayAppend/arrayCount/arrayFilter方法，消除数据嵌套，38测试通过，100%覆盖率                |
| [0046](./docs/rfc/completed/0046-scanning-queue-persistence.md)                                 | 扫描队列持久化 - 千里眼scanning.json管理                 | AI     | v2.0.0         | 千里眼引擎持久化队列到~/.photasa/scan/scanning.json，工作流架构，完整验证报告                   |
| [0047](./docs/rfc/completed/0047-foldertree-persistence-initialization.md)                      | folderTree持久化与初始化 - 魏征appState管理              | AI     | v2.0.0         | 三条数据流汇聚魏征，司命引擎持久化，Store Automation自动同步，核心功能100%完成                  |
| [0048](./docs/rfc/completed/0048-scan-orchestration-business-logic-migration.md)                | 扫描编排业务逻辑迁移 - 职责自洽架构                      | AI     | v2.0.0         | Store SSOT + 状态机制 + 立即清理，删除AppHelper.ts (306行)，App.vue减少~180行，已通过测试验证   |
| [0055](./docs/rfc/completed/0055-taiyi-workflow-summary-deprecated.md)                          | 太乙工作流总结（deprecated）                             | AI     | v2.0.0         | 已迁出 Active；归档说明见文件头                                                                 |
| [0057](./docs/rfc/completed/0057-yushinan-scan-progress-display.md)                             | 虞世南扫描进度展示服务 - 统一findPhotoService到qizou流程 | AI     | v2.0.0         | 统一findPhotoService到qizou流程，创建虞世南服务，消除双重监听反模式，所有Vue组件遵循服务模式    |
| [0099](./docs/rfc/completed/0099-tauri-window-reload.md)                                        | window_reload（Tauri）                                   | AI     | v2.1.0         | `reload_window` + `legacy-api.reloadWindow`；系统菜单仅 `key` 时在长孙无忌按 `view-reload` 分发 |
| [0100](./docs/rfc/completed/0100-tauri-single-instance.md)                                      | 单实例管理（Tauri）                                      | AI     | v2.1.0         | `tauri-plugin-single-instance`；macOS `Reopen` 时 `restore_main_window`                         |
| [0101](./docs/rfc/completed/0101-tauri-startup-splash.md)                                       | 启动 Splash（Tauri）                                     | AI     | v2.1.0         | 双窗 + `close_splashscreen` + `public/splash.html` + `App.vue` invoke                           |
| [0102](./docs/rfc/completed/0102-tauri-thumbnail-raw-fallback.md)                               | RAW 缩略图占位（Tauri）                                  | AI     | v2.1.0         | `make_raw_placeholder_thumbnail` + `ThumbnailResponse.fallback`                                 |
| [0103](./docs/rfc/completed/0103-tauri-native-deps-build-strategy.md)                           | 原生依赖构建策略（Tauri）                                | AI     | v2.1.0         | `ffmpeg-next` build+zlib；`libheif-rs` embedded-libheif；见 `AGENTS.md`                         |

## Rejected RFCs

| RFC | Title | Rejection Reason | Date |
| --- | ----- | ---------------- | ---- |
| -   | -     | -                | -    |

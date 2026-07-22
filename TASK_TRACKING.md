# TASK_TRACKING.md

当前活跃任务和 RFC 实现进度。不重复 ROADMAP.md 中的战略规划；本文件只跟踪**具体实现任务**的当前状态。

**Photasa 黄金规则：** [ROADMAP.md](./ROADMAP.md) → Golden rule — Rust 重写后端；legacy TypeScript 仅作行为规格，禁止复制 TS 到 Tauri。

**Active RFC 规则：** 凡标为 **Photasa Active** 的 RFC，实现目标必须是 **`apps/photasa/src-tauri` / `crates/` 中的 Rust**；不得把 `@photasa/*` Node 包或 legacy main 抽包当作 Photasa 交付路径。

---

## Phase 5 – 1:1 Parity Gaps（2026-04）

以下 5 个任务来自 legacy vs Tauri 全面对比分析。每项对应一个 RFC，优先级见下表。

| 任务                        | RFC                                                                                | 优先级    | 状态                                           | 阻断 CI？                           |
| --------------------------- | ---------------------------------------------------------------------------------- | --------- | ---------------------------------------------- | ----------------------------------- |
| 单实例管理                  | [0100](./docs/rfc/completed/0100-tauri-single-instance.md)                         | 🔴 High   | Done                                           | 否（UX 问题）                       |
| 原生依赖构建策略            | [0103](./docs/rfc/completed/0103-tauri-native-deps-build-strategy.md)              | 🔴 High   | Done                                           | 否（embedded-libheif；FFmpeg 仍重） |
| window_reload 命令          | [0099](./docs/rfc/completed/0099-tauri-window-reload.md)                           | 🟡 Medium | Done                                           | 否                                  |
| RAW 缩略图回退              | [0102](./docs/rfc/completed/0102-tauri-thumbnail-raw-fallback.md)                  | 🟢 Low    | Done                                           | 否                                  |
| 启动 Splash 屏幕            | [0101](./docs/rfc/completed/0101-tauri-startup-splash.md)                          | 🟢 Low    | Done                                           | 否                                  |
| 应用偏好（文昌）落盘        | [0107](./.spec/rfc/completed/0107-tauri-wenchang-preferences-storage.md)           | 🔴 High   | Done（0147 直连 IPC；2026-07-21 手测通过）     | 否                                  |
| 缩略图 EXIF/旋转修复        | [0146](./.spec/rfc/completed/0146-tauri-thumbnail-orientation-aspect-ratio.md)     | 🔴 High   | Done                                           | 否                                  |
| macOS 标题栏与拖动          | [0152](./.spec/rfc/completed/0152-tauri-macos-custom-titlebar-overlay-and-drag.md) | 🔴 High   | Done（Tauri 2.0 窗口 Overlay 及拖拽权限）      | 否                                  |
| 重建 Tauri PR 流水线        | [0151](./.spec/rfc/completed/0151-tauri-cicd-redesign.md)                          | 🔴 High   | Done（三平台编译矩阵及复合 Action）            | 否                                  |
| zouwu workspace 物理移除    | [0153](./.spec/rfc/completed/0153-tauri-zouwu-workspace-removal.md)                | 🔴 High   | Done（废弃 crate 及代码物理删除）              | 否                                  |
| legacy-api / utils/api 退役 | [0154](./.spec/rfc/0154-tauri-legacy-api-retirement.md)                            | 🔴 High   | Draft（贞观人物 + 袁天罡；**非** ipc/\* 旁路） | 否                                  |

### RFC 0153 — zouwu workspace 物理移除 ✅ Done

**目标**：0139/0140 逻辑退场后，从 Photasa Tauri 与 Rust workspace 删除 `zouwu-core`、`zouwu-builtin`、`TianshuService`、死 adapter、`tianshu_command` IPC、`tianshu.adapter.ts`。

- [x] Phase A：`rg` 确认无生产 `tianshu_command` / `sendFuluToTianshu` 调用
- [x] Phase B：删 `services/tianshu.rs`、`adapters/`、`main.rs` 天枢初始化与 IPC
- [x] Phase B：根/workspace `Cargo.toml` 移除 zouwu crate；删 `crates/zouwu-*`
- [x] Phase C：删 `tianshu.adapter.ts`；`main.ts` 移除 `waitUntilReady`；清理 `yuantiangang` 符箓死路径
- [x] Phase D：`cargo test --workspace` 208 passed；vitest 825 passed

### RFC 0151 — 重建 Tauri PR 流水线 ✅ Done

**目标**：删除 contract reference `build-matrix.yml`，为 Photasa (Tauri + Rust) 从零重建三平台（macOS/Windows/Linux）矩阵编译及配套 lint/测试 PR 流水线。

- [x] `.github/workflows/build-matrix.yml`：删除 legacy 构建流水线
- [x] `.github/actions/setup-photasa-toolchain/action.yml`：设计复合 action 封装 checkout, apt-get, rust-toolchain, pnpm, node 核心准备步骤
- [x] `.github/workflows/photasa-build.yml`：配置三平台 `strategy.matrix`，集成 `pnpm tauri build --debug` 快速 debug 编译校验
- [x] `.github/workflows/photasa-build.yml`：集成 `cargo test`, `cargo clippy`, eslint, vitest 配套检查项

### RFC 0152 — macOS 标题栏与拖动 ✅ Done

**目标**：实现 macOS 平台下自定义窗口标题栏的 Overlay 融合、拖拽支持，并解决按钮点击拦截及重影问题。

- [x] `tauri.conf.json`：配置 `"titleBarStyle": "Overlay"`, `"hiddenTitle": true`, `"decorations": true`
- [x] `default.json` capability：向安全沙箱注册 `"core:window:allow-start-dragging"` 拖动权限
- [x] `TitlebarMac.vue`：引入绝对定位 `z-index: 0` 的 `.titlebar-drag-handle` 拖动背景层
- [x] `TitlebarMac.vue`：使用绝对居中对齐 `left: 50%; transform: translateX(-50%)`，保持 macOS 设计均衡
- [x] `TitlebarMac.vue`：对 `.titlebar-content` 应用 `pointer-events: none` 穿透，对 `.setting-header` 应用 `pointer-events: auto` 保障按钮可点击
- [x] `TitlebarMac.vue` / `TitlebarWinLinux.vue`：清理 CSS `-webkit-app-region` 规则，改用 Tauri 原生 `data-tauri-drag-region`
- [x] 手测：窗口双标题重影消失，自定义标题绝对居中，空白区域和标题支持完美拖拽，且 settings 等功能按钮完全可点。

### RFC 0107 — 应用偏好（文昌）落盘 ✅ Done

**目标**：Tauri 侧与 legacy-api 等价：应用级偏好落盘 `~/.photasa/preferences/preferences.json`，并自动同步到 Renderer store。

- [x] workspace crate：`crates/photasa-preference`
- [x] `ConfigAdapter` → `"config"`（folder-level `.photasa.json`）
- [x] [0147](./.spec/rfc/completed/0147-tauri-wenchang-preferences-retirement.md)：删 `PreferencesAdapter`；`preferences_get` / `preferences_update` 直连 IPC
- [x] `yuantiangang.ts`：`PREFERENCE_ZHAOLING_MATTERS` → `invoke`
- [x] Rust 单测：`cargo test -p photasa-preference` → 5 passed
- [x] **手测 E2E（2026-07-21）**：主题/语言/缩略图/路径 → 磁盘 + store 同步确认

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

| 任务                        | RFC                                                                    | 优先级    | 状态    | 说明                                                                |
| --------------------------- | ---------------------------------------------------------------------- | --------- | ------- | ------------------------------------------------------------------- |
| execute_import 日期目录组织 | [0104](./.spec/rfc/completed/0104-tauri-execute-import-date-folder.md) | 🔴 High   | Done    | `import_date_util` + `execute_import` 日期子目录与相对 `targetPath` |
| 扫描增量缓存                | [0105](./.spec/rfc/completed/0105-tauri-scan-incremental-cache.md)     | 🔴 High   | ✅ Done | `scan_cache` + `scan_runner`；progress total 对齐 legacy-api        |
| 更新定时检查                | [0106](./.spec/rfc/completed/0106-tauri-update-periodic-check.md)      | 🟡 Medium | ✅ Done | `update_periodic.rs` Tokio 后台循环                                 |

### RFC 0104 — execute_import 日期目录组织

**目标**：导入执行时按文件拍摄日期生成 `{year}/{YYYYMMDD}/` 子目录，与 legacy-api 行为 1:1 一致。

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
- [x] `scan_adapter.rs` 的 `scanPaths` 使用 async `run_directory_scan`
- [x] 单元测试：`scan_cache` + `scan_runner` routing（2026-06-06）

### RFC 0106 — 更新定时检查

**目标**：app 启动后 5 秒自动检查一次，并按配置的 `checkInterval` 小时循环检查。

- [x] `main.rs` setup 中 `spawn_periodic_update_checker` 后台任务
- [x] 初始延迟 5 秒 + 启动时始终检查（对齐 legacy-api）
- [x] 循环读取 `UpdateState.auto_config.enabled` / `check_interval`，禁用时跳过检查但保持循环
- [x] `perform_check_for_updates` 供命令与后台共用
- [x] `RunEvent::ExitRequested` 取消后台任务
- [x] `get_app_version` 已在 `platform.rs` 注册
- [x] 单元测试：`check_interval_secs`（2026-06-06）

---

## Phase 7 – Rust Parity Closure（2026-06）

**父跟踪 RFC：[0097](./.spec/rfc/completed/0097-tauri-legacy-api-deferred-surface.md)**。全部交付物为 Rust；legacy TypeScript 仅作契约对照。

| 任务                              | RFC                                                                            | 优先级    | 状态                                                                                          | 说明                                                                           |
| --------------------------------- | ------------------------------------------------------------------------------ | --------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| 扫描 `notify:status`              | [0111](./.spec/rfc/completed/0111-tauri-scan-notify-status-bridge.md)          | 🔴 High   | ✅ Done                                                                                       | `notify_source_from_scan_report` + `scan_runner` 双 emit                       |
| 元数据 golden 对拍                | [0112](./.spec/rfc/completed/0112-tauri-extract-metadata-golden-parity.md)     | 🔴 High   | ✅ Done                                                                                       | fixtures + golden 测试 + EXIF tag-number 修复                                  |
| 更新运维 + 偏好同步               | [0113](./.spec/rfc/completed/0113-tauri-updater-production-and-prefs-sync.md)  | 🟡 Medium | ✅ Done（release 生产阻断缺口见 [0155](./.spec/rfc/0155-tauri-release-pipeline-as-built.md)） | `update_config.rs` + `UPDATER.md` + `system.autoUpdate`                        |
| legacy-api 小项                   | [0114](./.spec/rfc/completed/0114-tauri-get-directory-os-paths.md)             | 🟡 Medium | ✅ Done                                                                                       | `get_directory` OS 路径；`scan_directories` FileGroup+filters                  |
| 废弃 WASM 命令                    | 0114                                                                           | 🟢 Low    | ✅ Done                                                                                       | 已删除 `load_wasm_module` / `call_wasm_function` + `wasm.rs`；无 wasmtime 依赖 |
| WebView 本地图片 asset 协议       | [0115](./.spec/rfc/completed/0115-tauri-webview-local-image-asset-protocol.md) | 🔴 High   | ✅ Done                                                                                       | `convertFileSrc` + CSP/assetProtocol；修复 file:// 不可加载                    |
| `.photasa.json` 缩略图路径 parity | [0116](./.spec/rfc/completed/0116-tauri-photasa-config-thumbnail-parity.md)    | 🔴 High   | ✅ Done                                                                                       | contract reference `toRelativeThumbnailPath`；fix legacy stubs + folder race   |
| 扫描流水线 legacy-api 契约        | [0117](./.spec/rfc/completed/0117-tauri-scan-pipeline-parity.md)               | 🔴 High   | ✅ Done                                                                                       | SKIP-only 递归 + SKIP progress `(N,N)` 已修；52 scan 测试通过                  |

**建议执行顺序：** ~~0111 → 0112 → 0113 → 0114~~ ✅ **Phase 7 全部完成。** 0097 已标 ✅ Implemented。0115 为图库显示 hotfix（2026-06-06）。**0116** 修复 config/thumbnail/rescan 契约（2026-06-06 ✅）。**0117** 扫描流水线对齐 legacy-api（2026-06-06 ✅，含 SKIP-only 递归 + SKIP progress 修复）。

### RFC 0117 — 扫描流水线 legacy-api 契约

**目标**：`scan_runner.rs` 按 contract reference `@photasa/scan` **行为契约**补回 SKIP/FULL 策略、文件级门控、续扫、子目录递归与批量缓存写入。

- [x] `scan_strategy.rs`：`decide_scan_strategy` / `should_process_file` / `should_scan_one_level` / `compute_folder_hash`（精确决策表 + 单测）
- [x] `scan_runner.rs`：策略驱动编排（SKIP / FULL fresh / FULL resume / fallback）
- [x] `scan_runner.rs`：SKIP 路径 `restore_cached_files` + **仅 SKIP** 子目录递归（`should_recurse_subdirs`）
- [x] 串行 await `photasa_thumbnail::create_thumbnail`（与 legacy-api `concatMap` 一致；0134 后 async API）；`should_process_file` 门控
- [x] `IncrementalCacheManager` 批量写入（20/50/200 + 5s）；progress `currentFile` 契约修正；内存计数
- [x] 统一 process→record 顺序；去掉 50ms sleep（同步写）
- [x] `scan_cleanup.rs`：`extended_cleanup`（7 天 GC）+ 单测（**已移植但无 live caller，未接线**）
- [x] **BUG①**：FULL 不递归子目录；`current` 不递归 — `should_recurse_subdirs` + 3 单测
- [x] **BUG②**：SKIP progress `(idx+1, N)` → `(N,N)` — `restore_cached_files` + 映射单测
- [x] `complete.paths` 恒 `[]`（contract parity）
- [x] `cargo test scan_`（**52 passed**）+ `cargo build -p photasa`
- [ ] **集成测试**：`app.emit` 副作用序列仍需 Tauri harness（可选后续）

### RFC 0116 — `.photasa.json` thumbnail parity

- [x] `photasa_config.rs`：`fix_config_sync` + `add_photo_to_folder_list` 对齐 legacy-api
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

- [x] `crates/photasa-scan/src/notify.rs` — `build_scan_notify_payload` + unit tests
- [x] `scan_runner.rs` — progress / complete / error 双 emit
- [x] **2026-07-20**：`notify_source_from_scan_report` 从 `ScanReport` 派生 notify（RFC 0136 路由层）；`Directory` 不产出 notify

### RFC 0136 — 持久化队列扫描流水线（✅ Implemented — 2026-07-21）

**已完成**：

- [x] 千里眼一层目录/文件分流 + `ScanReport` IPC 类型
- [x] Tauri 组合根 file pipeline（thumb + `.photasa.json`）
- [x] 扫描队列持久化（0144 `ScanQueueRepository`）
- [x] `scan_directory_discovered` → 尉迟恭 `add_scan_task` + 魏征 `add_paths`（方案 A）
- [x] 删尉迟恭 `SCAN_SUBFOLDERS` / `scan_task_added` 路由 / 魏征 reconcile 多入口
- [x] `joinFolderSegment` + `sanitizeFolderTree`；`buildFolderKey` 禁止 `mergePath`
- [x] 袁天罡 `executeZhaoling` 静态 `invoke`（并发队列持久化）
- [x] 测试：`folder-tree.test.ts`、`rescan-folder-tree.test.ts`、`router.test.ts`、`scanning-queue-integration.test.ts`

### RFC 0112 — extract_metadata golden

- [x] fixtures + golden JSON（`tests/fixtures/metadata/`）
- [x] Nikon/Canon/Sony EXIF + sample/corrupt video
- [x] 缺文件 / 损坏容器回退；EXIF 按 tag number + Double 解析

### RFC 0113 — updater 生产 + 偏好

- [x] `main.rs` setup：从 `preferences.json` 灌 `UpdateState`（`update_config.rs`）
- [x] 文档化 `tauri.conf.json` pubkey/endpoints（`apps/photasa/src-tauri/UPDATER.md`）
- [x] 单测：preferences 影响 periodic checker
- [x] `photasa-preference`（原 `wenchang-preferences`）：`system.autoUpdate` 字段

### RFC 0097 / 0114 — 剩余 Rust 收口

- [x] **`get_directory`**：`desktop`/`documents`/`home` 映射 OS 路径（contract reference `app.getPath`），非空 `DirectoryStore` 优先
- [x] **`scan_directories`**：返回 `FileGroup[]` + 可选 `filters`（非 flat `string[]`）
- [x] **WASM 清理**：删除 stub 命令与 `wasm.rs`；**禁止** wasmtime / WASM 过渡方案（见 [ROADMAP.md](./ROADMAP.md) → Golden rule）
- [x] **RAW 占位扩展名**：`photasa-thumbnail::placeholder` 位图字体（0102 迭代，0134 后归 crate）
- [x] **`picasa:engine-status`**：`engine_status.rs` — setup 里程碑发射（`initializing` / `ready` / `error`）
- [x] **Splash 主题同步**：`splash_bridge.rs` — `splash:theme-changed` + `WindowEvent::ThemeChanged`

---

## 已完成（截至 2026-04-05）

所有 Phase 1–4 RFC（0074–0097）均已实现。详见 [ROADMAP.md](./ROADMAP.md)（**RFC 仓库索引** + Current state）与本文件下文 **Active / Implemented** 全表。

核心服务对等状态：

| 服务        | contract reference                       | Rust/Tauri                                             | 状态                               |
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

以下 RFC **允许**作为 Photasa 当前/下一 sprint 的实现依据。后端交付物必须是 Rust；legacy TypeScript 仅作契约对照。全量对拍见 [ROADMAP.md](./ROADMAP.md) → **contract reference → Rust parity audit（2026-06）**。

| RFC                                                                            | Title                                                    | Status                            | Rust 交付                                                                           |
| ------------------------------------------------------------------------------ | -------------------------------------------------------- | --------------------------------- | ----------------------------------------------------------------------------------- |
| [0097](./.spec/rfc/completed/0097-tauri-legacy-api-deferred-surface.md)        | legacy-api 与 legacy-api 1:1 跟踪（**父 RFC**）          | ✅ Implemented                    | Phase 7（0111–0114）全部完成                                                        |
| [0111](./.spec/rfc/completed/0111-tauri-scan-notify-status-bridge.md)          | 扫描 `notify:status` 桥                                  | ✅ Implemented                    | `notify_source_from_scan_report` + `scan_runner`                                    |
| [0112](./.spec/rfc/completed/0112-tauri-extract-metadata-golden-parity.md)     | `extract_metadata` golden                                | ✅ Implemented                    | fixtures + golden 测试                                                              |
| [0113](./.spec/rfc/completed/0113-tauri-updater-production-and-prefs-sync.md)  | updater 生产 + 偏好同步                                  | ✅ Implemented（阻断缺口见 0155） | `update_config.rs` + `UPDATER.md`                                                   |
| [0114](./.spec/rfc/completed/0114-tauri-get-directory-os-paths.md)             | `get_directory` OS 路径 + `scan_directories` FileGroup[] | ✅ Implemented                    | `directory.rs` + `import_file_groups.rs` + `import_scan_directories.rs`             |
| [0115](./.spec/rfc/completed/0115-tauri-webview-local-image-asset-protocol.md) | WebView 本地图片 asset 协议                              | ✅ Implemented                    | `media-url.ts` + CSP/assetProtocol + `path.rs`                                      |
| [0118](./.spec/rfc/completed/0118-tauri-import-background-ui.md)               | 导入后台 UI（G1–G9,G13–G14）                             | ✅ Implemented                    | Vue session + chip；T2 user-signed                                                  |
| [0119](./.spec/rfc/completed/0119-tauri-import-checksum.md)                    | checksum 诚实                                            | ✅ Implemented                    | Omit unknown checksum; no fake null                                                 |
| [0120](./.spec/rfc/completed/0120-tauri-import-quit-recovery.md)               | 退出恢复（G11）                                          | ✅ Implemented                    | active marker + JSONL copied-file journal；startup cleanup/keep                     |
| [0121](./.spec/rfc/completed/0121-tauri-import-settings-prefs.md)              | Settings 导入（G12）                                     | ✅ Implemented                    | Import tab + persisted defaults；wizard reads defaults                              |
| [0122](./.spec/rfc/rejected/0122-tauri-legacy-importphotos-background-ux.md)   | Legacy importPhotos UX（G10）                            | ❌ Rejected                       | Legacy stays wrapper/event bridge；no second UI surface                             |
| [0123](./.spec/rfc/completed/0123-tauri-import-duplicate-count.md)             | duplicateCount 诚实                                      | ✅ Implemented                    | Existing target-name collisions counted                                             |
| [0124](./.spec/rfc/completed/0124-tauri-import-resume-return-shape.md)         | resume 返回形状                                          | ✅ Implemented                    | Tauri returns `{ importId }`; final result via `import:complete`                    |
| [0125](./.spec/rfc/completed/0125-tauri-import-paused-progress-emit.md)        | paused progress emit                                     | ✅ Implemented                    | pause/resume emit status; cancel payload fields complete                            |
| [0126](./.spec/rfc/rejected/0126-legacy-import-background-ux-parity.md)        | contract reference UX                                    | ❌ Rejected                       | deferred parity is not Photasa Active                                               |
| [0127](./.spec/rfc/completed/0127-tauri-import-error-payload-shape.md)         | `import:error` payload 形状（`[object Object]`）         | ✅ Implemented                    | Store normalizes Rust `{ message, importId }`                                       |
| [0128](./.spec/rfc/completed/0128-tauri-import-progress-import-id.md)          | `import:progress` 缺 `importId`                          | ✅ Implemented                    | Rust progress JSON + frontend filter (2026-07-18)                                   |
| [0129](./.spec/rfc/completed/0129-tauri-import-progress-throttle.md)           | `import:progress` 无节流                                 | ✅ Implemented                    | Initial + first + every 25 files + final                                            |
| [0130](./.spec/rfc/completed/0130-tauri-import-legacy-copy-dedup.md)           | `import_legacy.rs` wrapper + legacy 复制逻辑去重         | ✅ Implemented                    | `legacy_loop` 在 `photasa-import`；command 只做事件桥（2026-07-18）                 |
| [0131](./.spec/rfc/completed/0131-tauri-photasa-import-crate.md)               | `photasa-import` 独立 crate                              | ✅ Implemented                    | 算法零 Tauri；`cargo test -p photasa-import` **45 passed**（2026-07-18）            |
| [0134](./.spec/rfc/completed/0134-tauri-photasa-thumbnail-crate.md)            | `photasa-thumbnail` 独立 crate                           | ✅ Implemented                    | async image/libheif/ffmpeg 解码零 Tauri；`cargo test -p photasa-thumbnail` 6 passed |
| [0132](./.spec/rfc/completed/0132-tauri-photasa-scan-crate.md)                 | `photasa-types` + `photasa-scan` 独立 crate              | ✅ Implemented                    | shared DTO；strategy/cache/media/notify/cleanup 零 Tauri；32 scan tests             |
| [0133](./.spec/rfc/completed/0133-tauri-photasa-watch-crate.md)                | `photasa-watch` 独立 crate（queue 算法，零 Tauri）       | ✅ Implemented                    | `cargo test -p photasa-watch` **7 passed**；Tauri sink→UI queue（2026-07-18）       |
| [0135](./.spec/rfc/completed/0135-tauri-watch-ui-contract-fix.md)              | watch UI 契约修复（legacy-api→WatchState）               | ✅ Implemented                    | camelCase `isFile`；`watch-event.ts`；Vitest 6 + cargo watch 2（2026-07-18）        |
| [0136](./.spec/rfc/completed/0136-tauri-scan-runtime-contract.md)              | 持久化队列扫描流水线                                     | ✅ Implemented                    | folder tree 单路径 + 幂等 + 千里眼一层发现（2026-07-21）                            |

## Photasa UI RFC drafts（非 Active）

| RFC                                                                            | Title                                         | Status         | Scope                                                                                                          |
| ------------------------------------------------------------------------------ | --------------------------------------------- | -------------- | -------------------------------------------------------------------------------------------------------------- |
| [0137](./.spec/rfc/completed/0137-tauri-zhenguan-direct-ipc-migration.md)      | 贞观直连 Tauri IPC 迁移                       | ✅ Implemented | 袁天罡唯一 IPC 边界；`IntentToFuluMapping` 空表；`legacy-api` 仅兼容层                                         |
| [0139](./.spec/rfc/completed/0139-tauri-zouwu-retirement-plan.md)              | zouwu 逐域退场排期                            | ✅ Implemented | 8 域全部退出 zouwu 生产路径；物理移除见 [0153](./.spec/rfc/completed/0153-tauri-zouwu-workspace-removal.md) ✅ |
| [0140](./.spec/rfc/completed/0140-tauri-zouwu-adapter-to-command-migration.md) | zouwu Adapter→command 迁移模式                | ✅ Implemented | 6 步模式；8 域验证表；`IntentToFuluMapping` 空表守卫                                                           |
| [0147](./.spec/rfc/completed/0147-tauri-wenchang-preferences-retirement.md)    | preference 贞观 + 退 zouwu                    | ✅ Implemented | `preferences_get`/`preferences_update`；袁天罡启奏；删 adapter                                                 |
| [0148](./.spec/rfc/completed/0148-tauri-rebuild-thumbnail-ui-contract.md)      | 单张重建缩略图 UI 契约                        | ✅ Implemented | `create_thumbnail` 直连；`rebuiltThumbnailSrcByKey`；非 Rescan（2026-07-21）                                   |
| [0149](./.spec/rfc/completed/0149-tauri-ui-adapter-post-closure.md)            | 0073 关闭后 UI 适配层剩余项                   | ✅ Implemented | R3–R5 ✅；贞观 services 零 window.api；legacy-api → 0137                                                       |
| [0150](./.spec/rfc/completed/0150-tauri-shell-menu-zouwu-retirement.md)        | shell/menu 退出 zouwu                         | ✅ Implemented | executeZhaoling 直连 apply_system_menu / open_external / show_in_folder                                        |
| [0153](./.spec/rfc/completed/0153-tauri-zouwu-workspace-removal.md)            | zouwu workspace 物理移除                      | ✅ Implemented | 删 zouwu crates/TianshuService/adapters/tianshu.adapter.ts；vitest 825                                         |
| [0154](./.spec/rfc/0154-tauri-legacy-api-retirement.md)                        | legacy-api / utils/api 退役                   | ⏳ Draft       | 0149 R1/R2；组件走贞观人物；袁天罡唯一 invoke/listen；**拒绝 ipc/\* 旁路**                                     |
| [0155](./.spec/rfc/0155-tauri-release-pipeline-as-built.md)                    | Release/updater 流水线如实记录 + 生产缺口修复 | ⏳ Draft       | `createUpdaterArtifacts`/`pubkey` 阻断 updater；取代 0113/0151 中 `photasa-release.yml` 描述                   |

**已归档**：[0137](./.spec/rfc/completed/0137-tauri-zhenguan-direct-ipc-migration.md) 贞观直连 IPC ✅ / [0138](./.spec/rfc/completed/0138-tauri-photasa-config-crate.md) `photasa-config` crate ✅ / [0139](./.spec/rfc/completed/0139-tauri-zouwu-retirement-plan.md) zouwu 全域退场 ✅ / [0140](./.spec/rfc/completed/0140-tauri-zouwu-adapter-to-command-migration.md) zouwu→command 迁移模式 ✅ / [0141](./.spec/rfc/completed/0141-tauri-photasa-media-crate.md) `photasa-media` crate ✅ / [0142](./.spec/rfc/completed/0142-tauri-zhenguan-config-commands-personification.md) 文件夹配置命令魏征接管 ✅ / [0143](./.spec/rfc/completed/0143-tauri-zhenguan-scanning-personification.md) 扫描队列命令贞观对齐 ✅ / [0144](./.spec/rfc/completed/0144-tauri-scan-queue-persistence-alignment.md) 扫描队列持久化并发锁+脱离zouwu ✅ / [0145](./.spec/rfc/completed/0145-tauri-siming-adapter-retirement.md) folder tree 持久化 `photosa-folder-tree` ✅ / [0147](./.spec/rfc/completed/0147-tauri-wenchang-preferences-retirement.md) preference 整域退出 zouwu ✅ / [0148](./.spec/rfc/completed/0148-tauri-rebuild-thumbnail-ui-contract.md) 单张重建缩略图 UI ✅ / [0149](./.spec/rfc/completed/0149-tauri-ui-adapter-post-closure.md) 0073 后适配层跟踪 ✅ / [0150](./.spec/rfc/completed/0150-tauri-shell-menu-zouwu-retirement.md) shell/menu 直连 invoke ✅。

**Gap/T3 铁律：** 一事一 RFC = **一域** 一事。config/media 族：**… / 0145 folder-tree ✅ / 0147 preference ✅ / …**

### RFC 0148 — 单张重建缩略图 UI（✅ Implemented — 2026-07-21）

- [x] 明确契约：`create_thumbnail(always:true)` 直连，非 Rescan / 非贞观
- [x] `requestThumbnail` 目标路径取自 `photo.thumbnail`（`image.thumbnail`）
- [x] `rebuiltThumbnailSrcByKey` + `thumbnailDisplaySrc`（修复 computed `card` 不刷新）
- [x] `image-prefetch` 保留 `?t=` 查询串
- [x] 测试：`ImageListHelper.test.ts`、`image-prefetch.test.ts`

### RFC 0147 — preference 贞观 + 退 zouwu（✅ 已完成，归档 `completed/`）

- [x] **删** `preferences_adapter.rs` + registry
- [x] **`commands/preferences.rs`**：`preferences_get` / `preferences_update`（功能名，非 `wenchang_*`）
- [x] **`yuantiangang.ts`**：`PREFERENCE_ZHAOLING_MATTERS` + 内联 `invoke` — **禁止** bridge 文件
- [x] **`preferences-delta.ts`**（纯函数，invoke 前剥离 `path` 协调字段）
- [x] **`intent.ts`** 清 preference → zouwu 映射
- [x] 贞观流转：褚遂良奏折；房玄龄 matter-sync；**袁天罡**启奏 `add_path_completed` / `remove_path_completed`
- [x] 褚遂良 `approved` 门控；`App.vue` → `chuSuiLiang.addPath`；尉迟恭 cleanup 改日志
- [x] `event-routing.yml`：`when.from: "袁天罡"`
- [x] 验证：`cargo test -p photasa -p photasa-preference` 78 passed；vitest preference/yuantiangang/router 通过

### RFC 0145 — `photasa-folder-tree`（✅ 已完成，归档 `completed/`）

- [x] `crates/photasa-folder-tree`：`FolderTreeStore` 读写 `~/.photasa/appState/photasa.json`
- [x] 删 `siming_adapter.rs`；`tianshu.rs` 零 `SimingAdapter` 注册
- [x] `commands/siming.rs` 直连 crate，零 `zouwu_core`
- [x] `yuantiangang/siming-bridge.ts` + `executeSimingZhaoling`（唯一 TS 路径）
- [x] `intent.ts` 移除 `UPDATE_FOLDER_TREE`/`RESTORE_APP_STATE` zouwu 映射
- [x] matter-sync `propertyPath: folderTree` 对齐 `{ folderTree, persisted }` 响应
- [x] 验证：`cargo test -p photasa-folder-tree -p photasa` 78 passed；`vitest` siming-bridge + store-sync-utils RFC 0145 用例通过

### RFC 0141 — `photasa-media`（✅ 已完成，归档 `completed/`）

- [x] `crates/photasa-media`：`is_image_file`/`is_video_file`/`classify_media`，权威扩展名表（`IMAGE_EXTS`/`HEIC_EXTS`/`RAW_EXTS`/`VIDEO_EXTS`）
- [x] `crates/photasa-types/src/media_type.rs`：`MediaType` enum 定义（`photasa-media` re-export，符合 0141 crate 边界原则）
- [x] `apps/photasa/src-tauri/src/commands/path.rs`：三个 `#[tauri::command]` 已改调 `photasa_media::*`
- [x] `crates/photasa-import/src/path_filter.rs`：已切换依赖 `photasa_media`，纯转发
- [x] `crates/photasa-thumbnail/src/thumbnail.rs`：已切换依赖 `photasa_media::classify_media` + `MediaType`
- [x] `crates/photasa-scan/src/media.rs`：`Cargo.toml` 依赖从 `photasa-import` 换成 `photasa-media`，`cargo tree -p photasa-scan` 验证不含 `photasa-import`
- [x] `apps/photasa/src/api/watch-event.ts`：`IMAGE_EXTS` 补齐 `dng`/`raf`/`orf`，对齐权威表（2026-07-20）
- [x] 验证证据：`cargo test -p photasa-scan -p photasa-import -p photasa-media` → 80 passed；`cargo test -p photasa` → 74 passed, 3 ignored；`vitest run src/api/__tests__/watch-event.test.ts` → 11 passed；`eslint` 零错误

### RFC 0138 — `photasa-config`（✅ 已完成，归档 `completed/`）

crate 落地、`config_adapter.rs` 已删、`services/tianshu.rs` 零 `ConfigAdapter` 注册、renderer 调用链经魏征（`weizheng.ts`）trace 确认（见 0142）。验证：`cargo test -p photasa-config` 9 passed，`cargo clippy` 零警告。

**Phase 5–6** Done。禁 **0098** 作 Photasa 路径。

---

## Legacy / contract reference backlog（非 Photasa Active）

v2.0 contract reference RFC（Draft / In Progress）**不算** Photasa 活跃项。若要在 Photasa 交付同等能力，必须 **新建或引用已有 Tauri Rust RFC**（如 0105 替代 contract reference 扫描缓存），**不得**直接推进下表作为 Tauri 路径。

| RFC                                                                                                          | Title                        | Status      | 说明                                      |
| ------------------------------------------------------------------------------------------------------------ | ---------------------------- | ----------- | ----------------------------------------- |
| [0098](./docs/rfc/0098-main-module-extraction-to-packages.md)                                                | main → `@photasa/*` packages | ⏸️ Deferred | **deferred**；Phase 2 冻结；非 Photasa    |
| [0004](./docs/rfc/0004-ai-file-preview-service.md) … [0061](./docs/rfc/0061-zouwu-workflow-visualization.md) | （v2.0 能力草案）            | Draft / 🔨  | Legacy contract reference；见下表全量索引 |

---

## Active RFCs（全量历史索引 — 含 Legacy）

路径相对仓库根。状态与正文头部不一致时，以 RFC 文件内 **Status** 为准并回写本表。

| RFC                                                                            | Title                                                | Status                                    | Author | Target Release |
| ------------------------------------------------------------------------------ | ---------------------------------------------------- | ----------------------------------------- | ------ | -------------- |
| [0004](./docs/rfc/0004-ai-file-preview-service.md)                             | AI文件在线预览服务                                   | Draft                                     | 李鹏   | v2.0.0         |
| [0008](./docs/rfc/0008-scan-strategy-optimization.md)                          | 扫描策略优化                                         | Draft                                     | 李鹏   | v2.0.0         |
| [0010](./docs/rfc/0010-folder-statistics-display.md)                           | 文件夹树节点统计信息显示                             | Draft                                     | 李鹏   | v2.0.0         |
| [0012](./docs/rfc/0012-unified-path-handling-architecture.md)                  | 统一路径处理架构重构                                 | Draft                                     | 李鹏   | v2.0.0         |
| [0014](./docs/rfc/0014-file-scan-folder-tree-update.md)                        | 文件扫描时文件夹树更新优化                           | Draft                                     | 李鹏   | v2.0.0         |
| [0018](./docs/rfc/0018-scanning-folder-priority-sorting.md)                    | 扫描文件夹优先级排序优化                             | Draft                                     | 李鹏   | v2.0.0         |
| [0020](./docs/rfc/0020-auto-update-server.md)                                  | Auto-Update System - Server Implementation           | Draft                                     | 李鹏   | v2.0.0         |
| [0021](./docs/rfc/0021-playwright-e2e-testing-architecture-enhancement.md)     | Playwright E2E Testing Architecture Enhancement      | Draft                                     | 李鹏   | v2.0.0         |
| [0022](./docs/rfc/0022-test-stabilization-issues-and-solutions.md)             | Test Stabilization Issues and Solutions              | Draft                                     | 李鹏   | v2.0.0         |
| [0023](./docs/rfc/0023-startup-performance-optimization.md)                    | Startup Performance Optimization                     | Draft                                     | 李鹏   | v2.0.0         |
| [0025](./docs/rfc/0025-tree-auto-focus-on-expand.md)                           | 树组件自动聚焦展开优化                               | Draft                                     | 李鹏   | v2.0.0         |
| [0029](./docs/rfc/0029-scan-skip-strategy-completion-fix.md)                   | 扫描跳过策略完成修复                                 | Draft                                     | 李鹏   | v2.0.0         |
| [0032](./docs/rfc/0032-qianliyan-scan-engine.md)                               | 千里眼扫描引擎 (含scan-service迁移)                  | 🔨 In Progress                            | 李鹏   | v2.0.0         |
| [0033](./docs/rfc/0033-shunfenger-watch-engine.md)                             | 顺风耳监听引擎                                       | Draft                                     | 李鹏   | v2.0.0         |
| [0034](./docs/rfc/0034-linglong-vision-engine.md)                              | 玲珑视觉引擎                                         | Draft                                     | 李鹏   | v2.0.0         |
| [0037](./docs/rfc/0037-zouwu-workflow-dsl.md)                                  | 驺吾(Zouwu)工作流DSL                                 | Draft                                     | 李鹏   | v2.0.0         |
| [0039](./docs/rfc/0039-tianshu-workflow-syntax-specification.md)               | 天枢工作流语法规范                                   | Draft                                     | 李鹏   | v2.0.0         |
| [0043](./docs/rfc/0043-useqinqiong-access-pattern.md)                          | useQinQiong()访问模式 - appState统一访问             | Draft                                     | AI     | v2.0.0         |
| [0049](./docs/rfc/0049-correct-e2e-testing-architecture.md)                    | 正确的E2E测试架构设计                                | Draft                                     | AI     | v2.0.0         |
| [0050](./docs/rfc/0050-taiyi-workflow-adapter-engine.md)                       | 太乙 - 工作流适配器与执行引擎                        | Draft                                     | AI     | v2.0.0         |
| [0056](./docs/rfc/0056-yuchigong-code-quality-improvements.md)                 | 尉迟恭代码质量改进                                   | Draft                                     | AI     | v2.0.0         |
| [0058](./docs/rfc/0058-zhangsunwuji-menu-service.md)                           | 长孙无忌菜单服务 - 统一菜单管理到qizou流程           | 🔨 In Progress                            | AI     | v2.0.0         |
| [0061](./docs/rfc/0061-zouwu-workflow-visualization.md)                        | 驺吾工作流可视化 (Workflow Visualization)            | Draft                                     | AI     | v2.0.0         |
| [0067](./.spec/rfc/completed/0067-tauri-app-photasa.md)                        | 创建 Tauri 应用 Photasa - 总体架构与迁移策略         | Implemented（总体索引，2026-07-21 归档）  | AI     | v2.1.0         |
| [0068](./.spec/rfc/completed/0068-tauri-scan-service-migration.md)             | 扫描服务迁移到 Tauri                                 | Implemented                               | AI     | v2.1.0         |
| [0069](./.spec/rfc/completed/0069-tauri-thumbnail-service-migration.md)        | 缩略图服务迁移到 Tauri                               | Implemented（RAW 占位见 0102）            | AI     | v2.1.0         |
| [0070](./.spec/rfc/completed/0070-tauri-import-service-migration.md)           | 导入服务迁移到 Tauri                                 | Implemented（细项对拍见 0097）            | AI     | v2.1.0         |
| [0071](./.spec/rfc/0071-tauri-config-service-migration.md)                     | 配置服务迁移到 Tauri                                 | Implemented                               | AI     | v2.1.0         |
| [0072](./.spec/rfc/completed/0072-tauri-tianshu-service-migration.md)          | 天枢服务迁移到 Tauri                                 | Implemented                               | AI     | v2.1.0         |
| [0073](./.spec/rfc/completed/0073-tauri-ui-migration-adapter.md)               | UI 迁移与适配层设计                                  | ✅ Closed（2026-07-21；余项 0149）        | AI     | v2.1.0         |
| [0074](./docs/rfc/completed/0074-tauri-adapter-concept.md)                     | Tauri adapter concept and env detection              | Draft                                     | AI     | v2.1.0         |
| [0075](./docs/rfc/completed/0075-tauri-flat-legacy-api-layer.md)               | Flat legacy API layer (window.api shape)             | Draft                                     | AI     | v2.1.0         |
| [0076](./docs/rfc/completed/0076-tauri-path-utilities-rust.md)                 | Path utilities in Rust (1:1 from Node, zero Node)    | Draft                                     | AI     | v2.1.0         |
| [0077](./docs/rfc/completed/0077-tauri-get-photasa-config.md)                  | get_photasa_config command                           | Draft                                     | AI     | v2.1.0         |
| [0078](./docs/rfc/completed/0078-tauri-add-to-photo-list.md)                   | add_to_photo_list command                            | Draft                                     | AI     | v2.1.0         |
| [0079](./docs/rfc/completed/0079-tauri-remove-from-photo-list.md)              | remove_from_photo_list command                       | Draft                                     | AI     | v2.1.0         |
| [0080](./docs/rfc/completed/0080-tauri-reset-photasa-config.md)                | reset_photasa_config command                         | Draft                                     | AI     | v2.1.0         |
| [0081](./docs/rfc/completed/0081-tauri-fix-photasa-config.md)                  | fix_photasa_config command                           | Draft                                     | AI     | v2.1.0         |
| [0082](./docs/rfc/completed/0082-tauri-watch-start-stop-commands.md)           | Watch start/stop commands                            | Draft                                     | AI     | v2.1.0         |
| [0083](./docs/rfc/completed/0083-tauri-watch-event-contract.md)                | Watch event contract                                 | Draft                                     | AI     | v2.1.0         |
| [0084](./docs/rfc/completed/0084-tauri-choose-directory.md)                    | choose_directory command                             | Draft                                     | AI     | v2.1.0         |
| [0085](./docs/rfc/completed/0085-tauri-get-directory.md)                       | get_directory command                                | Draft                                     | AI     | v2.1.0         |
| [0086](./docs/rfc/completed/0086-tauri-sub-folders.md)                         | sub_folders command                                  | Draft                                     | AI     | v2.1.0         |
| [0087](./docs/rfc/completed/0087-tauri-check-photasa-config-folder.md)         | check_photasa_config (folder validation) command     | Draft                                     | AI     | v2.1.0         |
| [0088](./docs/rfc/completed/0088-tauri-log-viewer-open.md)                     | Log viewer open/state command                        | Draft                                     | AI     | v2.1.0         |
| [0089](./docs/rfc/completed/0089-tauri-log-stream-events.md)                   | Log stream events                                    | Draft                                     | AI     | v2.1.0         |
| [0090](./docs/rfc/completed/0090-tauri-update-service.md)                      | Update service                                       | Draft                                     | AI     | v2.1.0         |
| [0091](./docs/rfc/completed/0091-tauri-platform-is-mac.md)                     | Platform / isMac / get_platform                      | Draft                                     | AI     | v2.1.0         |
| [0092](./docs/rfc/completed/0092-tauri-menu-api.md)                            | Menu (applySystemMenu, onMenuAction)                 | Draft                                     | AI     | v2.1.0         |
| [0093](./docs/rfc/completed/0093-tauri-import-photos-legacy.md)                | importPhotos legacy copy flow                        | Draft                                     | AI     | v2.1.0         |
| [0094](./docs/rfc/completed/0094-tauri-choose-directories-multi.md)            | choose_directories（单/多选目录）                    | Draft                                     | AI     | v2.1.0         |
| [0095](./docs/rfc/completed/0095-tauri-get-path-root.md)                       | get_path_root                                        | Draft                                     | AI     | v2.1.0         |
| [0096](./docs/rfc/completed/0096-tauri-import-pause-resume.md)                 | pause_import / resume_import                         | Draft                                     | AI     | v2.1.0         |
| [0097](./.spec/rfc/completed/0097-tauri-legacy-api-deferred-surface.md)        | legacy-api 与 legacy-api 1:1 跟踪                    | ✅ Implemented（Photasa Active）          | AI     | v2.1.0         |
| [0098](./docs/rfc/0098-main-module-extraction-to-packages.md)                  | src/main 模块提取为 packages（deferred）             | ⏸️ Deferred                               | AI     | v2.1.0         |
| [0101](./docs/rfc/completed/0101-tauri-startup-splash.md)                      | Tauri 启动 Splash                                    | Implemented                               | AI     | v2.1.0         |
| [0102](./docs/rfc/completed/0102-tauri-thumbnail-raw-fallback.md)              | 缩略图 RAW 回退策略                                  | Implemented                               | AI     | v2.1.0         |
| [0103](./docs/rfc/completed/0103-tauri-native-deps-build-strategy.md)          | 原生依赖构建策略                                     | Implemented                               | AI     | v2.1.0         |
| [0104](./.spec/rfc/completed/0104-tauri-execute-import-date-folder.md)         | execute_import date-based folder organization        | ✅ Implemented                            | AI     | v2.1.0         |
| [0105](./.spec/rfc/completed/0105-tauri-scan-incremental-cache.md)             | Scan incremental cache (.photasa-folder.json)        | ✅ Implemented                            | AI     | v2.1.0         |
| [0106](./.spec/rfc/completed/0106-tauri-update-periodic-check.md)              | Updater background periodic check                    | ✅ Implemented                            | AI     | v2.1.0         |
| [0107](./.spec/rfc/completed/0107-tauri-wenchang-preferences-storage.md)       | Wenchang preferences storage                         | ✅ Implemented（0147 直连 IPC；手测通过） | AI     | v2.1.0         |
| [0111](./.spec/rfc/completed/0111-tauri-scan-notify-status-bridge.md)          | Scan notify:status Rust bridge                       | ✅ Implemented                            | AI     | v2.1.0         |
| [0112](./.spec/rfc/completed/0112-tauri-extract-metadata-golden-parity.md)     | extract_metadata golden parity                       | ✅ Implemented                            | AI     | v2.1.0         |
| [0114](./.spec/rfc/completed/0114-tauri-get-directory-os-paths.md)             | get_directory OS 路径 + scan_directories FileGroup[] | ✅ Implemented                            | AI     | v2.1.0         |
| [0115](./.spec/rfc/completed/0115-tauri-webview-local-image-asset-protocol.md) | WebView 本地图片 asset 协议（非 file://）            | ✅ Implemented                            | AI     | v2.1.0         |

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
| [0019](./docs/rfc/completed/0019-auto-update-system.md)                                         | Auto-Update System - Client Implementation               | 李鹏   | v2.0.0         | 客户端自动更新系统实现，采用legacy auto-updater方案，支持安全的preload集成                      |
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

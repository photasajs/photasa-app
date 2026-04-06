# TASK_TRACKING.md

当前活跃任务和 RFC 实现进度。不重复 ROADMAP.md 中的战略规划；本文件只跟踪**具体实现任务**的当前状态。

---

## Phase 5 – 1:1 Parity Gaps（2026-04）

以下 5 个任务来自 Electron vs Tauri 全面对比分析。每项对应一个 RFC，优先级见下表。

| 任务 | RFC | 优先级 | 状态 | 阻断 CI？ |
|------|-----|--------|------|----------|
| 单实例管理 | [0100](./docs/rfc/completed/0100-tauri-single-instance.md) | 🔴 High | Done | 否（UX 问题） |
| 原生依赖构建策略 | [0103](./docs/rfc/completed/0103-tauri-native-deps-build-strategy.md) | 🔴 High | Done | 否（embedded-libheif；FFmpeg 仍重） |
| window_reload 命令 | [0099](./docs/rfc/completed/0099-tauri-window-reload.md) | 🟡 Medium | Done | 否 |
| RAW 缩略图回退 | [0102](./docs/rfc/completed/0102-tauri-thumbnail-raw-fallback.md) | 🟢 Low | Done | 否 |
| 启动 Splash 屏幕 | [0101](./docs/rfc/completed/0101-tauri-startup-splash.md) | 🟢 Low | Done | 否 |

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
- [ ] 前端：收到 `fallback: true` 时显示格式标签（可选）

### RFC 0101 — 启动 Splash 屏幕

**目标**：冷启动时显示 Splash 窗口，主窗口就绪后过渡。

- [x] `tauri.conf.json`：`splash` + `main`（`visible: false`）
- [x] `commands/window.rs`：`close_splashscreen`
- [x] `main.rs`：注册 `close_splashscreen`
- [x] `apps/photasa/public/splash.html`：轻量 Splash UI
- [x] `App.vue`：`initializeApp` 的 `finally` 中 `invoke("close_splashscreen")`

---

## RFC 0097 — extract_metadata 对拍清单（持续）

状态：🚧 Partial

- [ ] 视频：边界标签逐项对拍（与 Electron `ffprobe` JSON 输出比较）
- [ ] 图片：MakerNote 字段（Nikon/Canon/Sony 私有 EXIF）与 Electron 展示级对比
- [ ] `updater` 生产端点：配置真实 `pubkey` 和 `endpoints`（`tauri.conf.json`）

---

## 已完成（截至 2026-04-05）

所有 Phase 1–4 RFC（0074–0097）均已实现。详见 [ROADMAP.md](./ROADMAP.md)（**RFC 仓库索引** + Current state）与本文件下文 **Active / Implemented** 全表。

核心服务对等状态：

| 服务 | Electron | Rust/Tauri | 状态 |
|------|----------|------------|------|
| 扫描 | `scan-service.ts` + `scan-worker.ts` | `stubs.rs::scan_photos` (walkdir) | ✅ |
| 缩略图 | `thumbnail-service.ts` (MaLiang) | `thumbnail.rs` (image/libheif/ffmpeg) | ✅（RAW 占位 RFC 0102） |
| 导入执行 | `import-service.ts` | `import_execute.rs` | ✅ |
| 导入预览 | `import-service.ts` | `import_preview.rs` | ✅ |
| 导入历史 | `ImportHistoryManager` | `import_session_store.rs` | ✅ |
| 遗留导入 | `preload/legacy.ts` RxJS 流 | `import_legacy.rs` | ✅ |
| 元数据提取 | `import-worker` + MaLiang EXIF | `extract_metadata.rs` + `ffmpeg-next` | ✅ (MakerNote 待) |
| 配置 | `config-service.ts` + `config-worker.ts` | `config.rs` | ✅ |
| 文件监视 | `watch-service.ts` (chokidar) | `watch.rs` (notify) + `watch_scan_queue.rs` | ✅ |
| 目录操作 | `directory-service.ts` | `directory.rs` | ✅ |
| 窗口控制 | `window-service.ts` | `window.rs` | ✅（含 reload，RFC 0099） |
| Shell | `shell-service.ts` | `shell.rs` | ✅ |
| 菜单 | `menu-service.ts` | `menu.rs` | ✅ |
| 日志查看器 | `log-viewer-service.ts` | `log_viewer.rs` + `log_toggle_shortcut.rs` | ✅ |
| 自动更新 | `update-service.ts` | `update.rs` | ✅ (端点待配置) |
| 平台检测 | `platform.ts` | `platform.rs` | ✅ |
| 路径工具 | `@shared/path-util` | `path.rs` | ✅ |
| 单实例 | `single-instance-manager.ts` | `tauri-plugin-single-instance` + `RunEvent::Reopen` | ✅ RFC 0100 |
| Splash 屏幕 | `splash-window.ts` | `tauri.conf` 双窗 + `close_splashscreen` | ✅ RFC 0101 |

---

## Active RFCs（全量索引）

路径相对仓库根。状态与正文头部不一致时，以 RFC 文件内 **Status** 为准并回写本表。

| RFC | Title | Status | Author | Target Release |
|-----|-------|--------|--------|----------------|
| [0004](./docs/rfc/0004-ai-file-preview-service.md) | AI文件在线预览服务 | Draft | 李鹏 | v2.0.0 |
| [0008](./docs/rfc/0008-scan-strategy-optimization.md) | 扫描策略优化 | Draft | 李鹏 | v2.0.0 |
| [0010](./docs/rfc/0010-folder-statistics-display.md) | 文件夹树节点统计信息显示 | Draft | 李鹏 | v2.0.0 |
| [0012](./docs/rfc/0012-unified-path-handling-architecture.md) | 统一路径处理架构重构 | Draft | 李鹏 | v2.0.0 |
| [0014](./docs/rfc/0014-file-scan-folder-tree-update.md) | 文件扫描时文件夹树更新优化 | Draft | 李鹏 | v2.0.0 |
| [0018](./docs/rfc/0018-scanning-folder-priority-sorting.md) | 扫描文件夹优先级排序优化 | Draft | 李鹏 | v2.0.0 |
| [0020](./docs/rfc/0020-auto-update-server.md) | Auto-Update System - Server Implementation | Draft | 李鹏 | v2.0.0 |
| [0021](./docs/rfc/0021-playwright-e2e-testing-architecture-enhancement.md) | Playwright E2E Testing Architecture Enhancement | Draft | 李鹏 | v2.0.0 |
| [0022](./docs/rfc/0022-test-stabilization-issues-and-solutions.md) | Test Stabilization Issues and Solutions | Draft | 李鹏 | v2.0.0 |
| [0023](./docs/rfc/0023-startup-performance-optimization.md) | Startup Performance Optimization | Draft | 李鹏 | v2.0.0 |
| [0025](./docs/rfc/0025-tree-auto-focus-on-expand.md) | 树组件自动聚焦展开优化 | Draft | 李鹏 | v2.0.0 |
| [0029](./docs/rfc/0029-scan-skip-strategy-completion-fix.md) | 扫描跳过策略完成修复 | Draft | 李鹏 | v2.0.0 |
| [0032](./docs/rfc/0032-qianliyan-scan-engine.md) | 千里眼扫描引擎 (含scan-service迁移) | 🔨 In Progress | 李鹏 | v2.0.0 |
| [0033](./docs/rfc/0033-shunfenger-watch-engine.md) | 顺风耳监听引擎 | Draft | 李鹏 | v2.0.0 |
| [0034](./docs/rfc/0034-linglong-vision-engine.md) | 玲珑视觉引擎 | Draft | 李鹏 | v2.0.0 |
| [0037](./docs/rfc/0037-zouwu-workflow-dsl.md) | 驺吾(Zouwu)工作流DSL | Draft | 李鹏 | v2.0.0 |
| [0039](./docs/rfc/0039-tianshu-workflow-syntax-specification.md) | 天枢工作流语法规范 | Draft | 李鹏 | v2.0.0 |
| [0043](./docs/rfc/0043-useqinqiong-access-pattern.md) | useQinQiong()访问模式 - appState统一访问 | Draft | AI | v2.0.0 |
| [0049](./docs/rfc/0049-correct-e2e-testing-architecture.md) | 正确的E2E测试架构设计 | Draft | AI | v2.0.0 |
| [0050](./docs/rfc/0050-taiyi-workflow-adapter-engine.md) | 太乙 - 工作流适配器与执行引擎 | Draft | AI | v2.0.0 |
| [0056](./docs/rfc/0056-yuchigong-code-quality-improvements.md) | 尉迟恭代码质量改进 | Draft | AI | v2.0.0 |
| [0058](./docs/rfc/0058-zhangsunwuji-menu-service.md) | 长孙无忌菜单服务 - 统一菜单管理到qizou流程 | 🔨 In Progress | AI | v2.0.0 |
| [0061](./docs/rfc/0061-zouwu-workflow-visualization.md) | 驺吾工作流可视化 (Workflow Visualization) | Draft | AI | v2.0.0 |
| [0067](./docs/rfc/0067-tauri-app-photasa.md) | 创建 Tauri 应用 Photasa - 总体架构与迁移策略 | Implemented（总体索引） | AI | v2.1.0 |
| [0068](./docs/rfc/0068-tauri-scan-service-migration.md) | 扫描服务迁移到 Tauri | Implemented | AI | v2.1.0 |
| [0069](./docs/rfc/0069-tauri-thumbnail-service-migration.md) | 缩略图服务迁移到 Tauri | Implemented（RAW 占位见 0102） | AI | v2.1.0 |
| [0070](./docs/rfc/0070-tauri-import-service-migration.md) | 导入服务迁移到 Tauri | Implemented（细项对拍见 0097） | AI | v2.1.0 |
| [0071](./docs/rfc/0071-tauri-config-service-migration.md) | 配置服务迁移到 Tauri | Implemented | AI | v2.1.0 |
| [0072](./docs/rfc/0072-tauri-tianshu-service-migration.md) | 天枢服务迁移到 Tauri | Implemented | AI | v2.1.0 |
| [0073](./docs/rfc/0073-tauri-ui-migration-adapter.md) | UI 迁移与适配层设计 | Implemented | AI | v2.1.0 |
| [0074](./docs/rfc/completed/0074-tauri-adapter-concept.md) | Tauri adapter concept and env detection | Draft | AI | v2.1.0 |
| [0075](./docs/rfc/completed/0075-tauri-flat-legacy-api-layer.md) | Flat legacy API layer (window.api shape) | Draft | AI | v2.1.0 |
| [0076](./docs/rfc/completed/0076-tauri-path-utilities-rust.md) | Path utilities in Rust (1:1 from Node, zero Node) | Draft | AI | v2.1.0 |
| [0077](./docs/rfc/completed/0077-tauri-get-photasa-config.md) | get_photasa_config command | Draft | AI | v2.1.0 |
| [0078](./docs/rfc/completed/0078-tauri-add-to-photo-list.md) | add_to_photo_list command | Draft | AI | v2.1.0 |
| [0079](./docs/rfc/completed/0079-tauri-remove-from-photo-list.md) | remove_from_photo_list command | Draft | AI | v2.1.0 |
| [0080](./docs/rfc/completed/0080-tauri-reset-photasa-config.md) | reset_photasa_config command | Draft | AI | v2.1.0 |
| [0081](./docs/rfc/completed/0081-tauri-fix-photasa-config.md) | fix_photasa_config command | Draft | AI | v2.1.0 |
| [0082](./docs/rfc/completed/0082-tauri-watch-start-stop-commands.md) | Watch start/stop commands | Draft | AI | v2.1.0 |
| [0083](./docs/rfc/completed/0083-tauri-watch-event-contract.md) | Watch event contract | Draft | AI | v2.1.0 |
| [0084](./docs/rfc/completed/0084-tauri-choose-directory.md) | choose_directory command | Draft | AI | v2.1.0 |
| [0085](./docs/rfc/completed/0085-tauri-get-directory.md) | get_directory command | Draft | AI | v2.1.0 |
| [0086](./docs/rfc/completed/0086-tauri-sub-folders.md) | sub_folders command | Draft | AI | v2.1.0 |
| [0087](./docs/rfc/completed/0087-tauri-check-photasa-config-folder.md) | check_photasa_config (folder validation) command | Draft | AI | v2.1.0 |
| [0088](./docs/rfc/completed/0088-tauri-log-viewer-open.md) | Log viewer open/state command | Draft | AI | v2.1.0 |
| [0089](./docs/rfc/completed/0089-tauri-log-stream-events.md) | Log stream events | Draft | AI | v2.1.0 |
| [0090](./docs/rfc/completed/0090-tauri-update-service.md) | Update service | Draft | AI | v2.1.0 |
| [0091](./docs/rfc/completed/0091-tauri-platform-is-mac.md) | Platform / isMac / get_platform | Draft | AI | v2.1.0 |
| [0092](./docs/rfc/completed/0092-tauri-menu-api.md) | Menu (applySystemMenu, onMenuAction) | Draft | AI | v2.1.0 |
| [0093](./docs/rfc/completed/0093-tauri-import-photos-legacy.md) | importPhotos legacy copy flow | Draft | AI | v2.1.0 |
| [0094](./docs/rfc/completed/0094-tauri-choose-directories-multi.md) | choose_directories（单/多选目录） | Draft | AI | v2.1.0 |
| [0095](./docs/rfc/completed/0095-tauri-get-path-root.md) | get_path_root | Draft | AI | v2.1.0 |
| [0096](./docs/rfc/completed/0096-tauri-import-pause-resume.md) | pause_import / resume_import | Draft | AI | v2.1.0 |
| [0097](./docs/rfc/0097-tauri-legacy-api-deferred-surface.md) | legacy-api 与 Electron 1:1 跟踪 | 🚧 Partial | AI | v2.1.0 |
| [0098](./docs/rfc/0098-main-module-extraction-to-packages.md) | src/main 模块提取为 packages | Implemented | AI | v2.1.0 |
| [0101](./docs/rfc/completed/0101-tauri-startup-splash.md) | Tauri 启动 Splash | Implemented | AI | v2.1.0 |
| [0102](./docs/rfc/completed/0102-tauri-thumbnail-raw-fallback.md) | 缩略图 RAW 回退策略 | Implemented | AI | v2.1.0 |
| [0103](./docs/rfc/completed/0103-tauri-native-deps-build-strategy.md) | 原生依赖构建策略 | Implemented | AI | v2.1.0 |

> **说明**：上表「Draft」多为历史索引快照；Tauri 0074–0096 等在 [ROADMAP.md](./ROADMAP.md) **Tauri small RFCs** 表中已标为 Implemented 的，以实现为准。

## Implemented RFCs（归档索引）

| RFC | Title | Author | Implemented In | Notes |
|-----|-------|--------|----------------|-------|
| [0001](./docs/rfc/completed/0001-import-wizard-system.md) | Import Wizard System | 李鹏 | v2.0.0 | Complete import wizard with multi-step flow |
| [0002](./docs/rfc/completed/0002-headless-ui-components.md) | Headless UI Components for Picasa Vue | 李鹏 | v2.0.0 | 48 BaseUI components implemented, Ant Design fully removed, ~2.25MB bundle size reduction |
| [0003](./docs/rfc/completed/0003-unify-watch-to-scan-queue.md) | Unify File Watch Events to Scan Queue | 李鹏 | v2.0.0 | Persistent file operation queue with event deduplication |
| [0005](./docs/rfc/completed/0005-local-ai-file-preview.md) | 本地AI文件预览功能 | 李鹏 | v2.0.0 | 支持AI、PSD等设计文件的本地预览功能 |
| [0006](./docs/rfc/completed/0006-photo-detail-drawer-decoupling.md) | Photo Detail Drawer Decoupling from Ant Design | 李鹏 | v2.0.0 | Successfully replaced Ant Design drawer with custom BaseDrawer component |
| [0007](./docs/rfc/completed/0007-folder-scan-cache-optimization.md) | Folder Scan Cache Optimization | 李鹏 | v2.0.0 | Intelligent incremental scanning and cleanup mechanisms |
| [0009](./docs/rfc/completed/0009-video-thumbnail-orientation.md) | Video Thumbnail Orientation Support | 李鹏 | v2.0.0 | Enhanced video thumbnail generation with rotation metadata support |
| [0011](./docs/rfc/completed/0011-imagelist-file-count-display.md) | ImageList File Count Display | 李鹏 | v2.0.0 | 在ImageList头部显示图片和视频文件计数，支持大数字格式化和响应式设计 |
| [0013](./docs/rfc/completed/0013-default-folder-selection.md) | 默认文件夹选择功能 | 李鹏 | v2.0.0 | 应用启动时自动选择默认文件夹，重启后恢复用户上次选择的文件夹 |
| [0015](./docs/rfc/completed/0015-intelligent-scan-optimization.md) | 验证智能扫描策略的子文件夹发现功能 | 李鹏 | v2.0.0 | 验证并修复智能扫描策略，确认子文件夹发现功能正常工作 |
| [0016](./docs/rfc/completed/0016-basetree-component-implementation.md) | BaseTree Component Implementation | 李鹏 | v2.0.0 | 实现BaseTree组件替代ant-design-vue的a-tree，支持虚拟滚动和100% API兼容性 |
| [0017](./docs/rfc/completed/0017-production-log-viewer.md) | Production Log Viewer System | 李鹏 | v2.0.0 | 按需激活的生产环境日志查看器，零性能影响，支持主进程和Worker线程日志实时显示 |
| [0019](./docs/rfc/completed/0019-auto-update-system.md) | Auto-Update System - Client Implementation | 李鹏 | v2.0.0 | 客户端自动更新系统实现，采用electron-updater方案，支持安全的preload集成 |
| [0024](./docs/rfc/completed/0024-log-viewer-resizable-panel.md) | 日志查看器可调整大小面板增强 | 李鹏 | v2.0.0 | 为日志查看器添加可调整大小面板功能，提升可用性和改善日志内容可见性 |
| [0026](./docs/rfc/completed/0026-file-type-indicator.md) | 文件类型指示器 | 李鹏 | v2.0.0 | 图片列表添加文件类型视觉指示器，提升用户识别效率和交互体验 |
| [0027](./docs/rfc/completed/0027-wasm-memory-management-optimization.md) | WASM内存管理优化与HEIF解码错误处理 | 李鹏 | v2.0.0 | 优化WASM HEIF解码器内存管理机制，增强错误处理，提升大型HEIF图像处理稳定性 |
| [0028](./docs/rfc/completed/0028-ffmpeg-binary-packaging-fix.md) | FFmpeg Binary Packaging Fix | 李鹏 | v2.0.0 | 修复打包后ffmpeg二进制文件访问问题，确保生产环境视频处理功能正常工作 |
| [0029](./docs/rfc/completed/0029-process-based-thumbnail-architecture.md) | 基于进程的缩略图架构 | 李鹏 | v2.0.0 | 进程池混合架构，隔离重型任务，有效控制内存，提升多核性能，增强稳定性 |
| [0030](./docs/rfc/completed/0030-scan-status-reporting-fix.md) | 扫描状态报告修复 | 李鹏 | v2.0.0 | 修复扫描过程中的状态报告问题，确保UI状态栏正确显示扫描进度和完成状态 |
| [0031](./docs/rfc/completed/0031-maliang-image-processing-engine.md) | Ma-Liang 统一图像处理引擎 | 李鹏 | v2.0.0 | 创建统一图像处理引擎，整合FFmpeg、Sharp、WASM-HEIF和Photon库，支持BMP和MPEG/MPG格式 |
| [0035](./docs/rfc/completed/0035-five-engine-orchestration-architecture.md) | 天枢·顺风耳·千里眼·司簿·马良五引擎编排架构 | 李鹏 | v2.0.0 | 建立五大核心引擎协同系统，通过太乙服务层桥接和YAML工作流元数据驱动，实现完整链路 |
| [0036](./docs/rfc/completed/0036-wenchang-preference-integration.md) | 偏好设置启动加载和保存机制 | 李鹏 | v2.0.0 | 完整的偏好设置双向通信机制，启动加载、智能合并、实时保存，391测试通过 |
| [0040](./docs/rfc/completed/0040-removepath-functionality-fix.md) | RemovePath功能修复 - 天界人界数据同步完整实现 | 李鹏 | v2.0.0 | 天界人界数据同步完整实现，修复UI更新问题，后续被RFC 0041进一步优化 |
| [0041](./docs/rfc/completed/0041-preference-architecture-refactor-business-logic-separation.md) | 偏好架构重构 - 业务逻辑与存储层分离 | 李鹏 | v2.0.0 | 应用Linus"好品味"原则，业务逻辑从WenchangEngine分离到FangXuanLing，架构更清晰易维护 |
| [0042](./docs/rfc/completed/0042-scanning-folder-migration.md) | scanningFolder四步渐进式迁移（Step 1已完成） | AI | v2.0.0 | Step 1完成：ScanningStore创建（Accessor+Builder架构），后续步骤拆分为RFC 0046/0047/0048 |
| [0045](./docs/rfc/completed/0045-builtin-array-operations.md) | Builtin数组操作增强 | AI | v2.0.0 | 新增arrayAppend/arrayCount/arrayFilter方法，消除数据嵌套，38测试通过，100%覆盖率 |
| [0046](./docs/rfc/completed/0046-scanning-queue-persistence.md) | 扫描队列持久化 - 千里眼scanning.json管理 | AI | v2.0.0 | 千里眼引擎持久化队列到~/.photasa/scan/scanning.json，工作流架构，完整验证报告 |
| [0047](./docs/rfc/completed/0047-foldertree-persistence-initialization.md) | folderTree持久化与初始化 - 魏征appState管理 | AI | v2.0.0 | 三条数据流汇聚魏征，司命引擎持久化，Store Automation自动同步，核心功能100%完成 |
| [0048](./docs/rfc/completed/0048-scan-orchestration-business-logic-migration.md) | 扫描编排业务逻辑迁移 - 职责自洽架构 | AI | v2.0.0 | Store SSOT + 状态机制 + 立即清理，删除AppHelper.ts (306行)，App.vue减少~180行，已通过测试验证 |
| [0055](./docs/rfc/completed/0055-taiyi-workflow-summary-deprecated.md) | 太乙工作流总结（deprecated） | AI | v2.0.0 | 已迁出 Active；归档说明见文件头 |
| [0057](./docs/rfc/completed/0057-yushinan-scan-progress-display.md) | 虞世南扫描进度展示服务 - 统一findPhotoService到qizou流程 | AI | v2.0.0 | 统一findPhotoService到qizou流程，创建虞世南服务，消除双重监听反模式，所有Vue组件遵循服务模式 |
| [0099](./docs/rfc/completed/0099-tauri-window-reload.md) | window_reload（Tauri） | AI | v2.1.0 | `reload_window` + `legacy-api.reloadWindow`；系统菜单仅 `key` 时在长孙无忌按 `view-reload` 分发 |
| [0100](./docs/rfc/completed/0100-tauri-single-instance.md) | 单实例管理（Tauri） | AI | v2.1.0 | `tauri-plugin-single-instance`；macOS `Reopen` 时 `restore_main_window` |
| [0101](./docs/rfc/completed/0101-tauri-startup-splash.md) | 启动 Splash（Tauri） | AI | v2.1.0 | 双窗 + `close_splashscreen` + `public/splash.html` + `App.vue` invoke |
| [0102](./docs/rfc/completed/0102-tauri-thumbnail-raw-fallback.md) | RAW 缩略图占位（Tauri） | AI | v2.1.0 | `make_raw_placeholder_thumbnail` + `ThumbnailResponse.fallback` |
| [0103](./docs/rfc/completed/0103-tauri-native-deps-build-strategy.md) | 原生依赖构建策略（Tauri） | AI | v2.1.0 | `ffmpeg-next` build+zlib；`libheif-rs` embedded-libheif；见 `AGENTS.md` |

## Rejected RFCs

| RFC | Title | Rejection Reason | Date |
|-----|-------|------------------|------|
| - | - | - | - |

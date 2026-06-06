# ROADMAP

High-level plans and “what’s next” live here. Do not duplicate this as random new `.md` files elsewhere.

---

## Goal: Tauri + full Rust backend + Vue frontend

- **Runtime**: Tauri only (no Electron in target). Vue for frontend.
- **Backend**: 100% Rust. **1:1 mapping** from current Node/Electron main and preload logic to Rust; **no Node usage** in Tauri backend.
- **Frontend–backend boundary**: **Adapter concept**. Vue (and shared `utils/api`) talk to the backend only through an adapter layer. The adapter hides whether the backend is Electron or Tauri and how it is invoked (IPC vs `invoke`). All backend capabilities are exposed as a single, stable surface (e.g. flat `window.api`) implemented behind the adapter.

### Golden rule: Rust rewrite, not TypeScript copy

Canonical policy: [`docs/rfc/TAURI_RUST_REWRITE_POLICY.md`](docs/rfc/TAURI_RUST_REWRITE_POLICY.md). **All Photasa/Tauri RFCs must comply.**

| Do | Don't |
|----|-------|
| Implement backend in Rust (`src-tauri`, `crates/`) | Import Node packages (`@photasa/scan`, `@photasa/import`, …) from Tauri |
| Use Electron/TS as **behavior spec** (IPC, events, on-disk JSON) | Port, mirror, or line-copy TypeScript into Rust or shared TS for Tauri |
| Verify **1:1 parity** via contracts and golden tests | Treat RFC 0098 (Electron package extraction) as the Photasa backend path |

- **Vue UI** may be reused from `apps/desktop` renderer; **backend** is always a Rust rewrite.
- **RFC 0098** is Electron-only maintenance; Phase 2 does not substitute Tauri work (e.g. RFC 0105 scan cache in Rust).

---

## RFC policy: one RFC, one thing

RFCs must be **focused on a single concern** (one feature, one migration target, one interface). Do **not** write large, catch-all RFCs that mix architecture, multiple services, and implementation details.

- **Good**: One RFC for "Tauri adapter concept," one for "flat legacy API layer," one for "path utilities in Rust," one for "config content-level commands in Rust."
- **Bad**: One RFC that describes adapter + legacy API + path + config + scan + thumbnail in one document.

Existing 0067–0073 remain as high-level or per-service docs; new or split work should use **small RFCs** (0074+) with one topic each. See [Rust RFC process](https://rust-lang.github.io/rfcs/0002-rfc-process.html) and [Vue RFCs](https://github.com/vuejs/rfcs): one substantial change per RFC.

---

## RFC 仓库索引（canonical）

RFC 索引与流程说明**以本节与根目录 [`TASK_TRACKING.md`](./TASK_TRACKING.md) 为准**；规范正文在 `docs/rfc/*.md` 与 `docs/rfc/completed/*.md`，**不再维护** `docs/rfc/README.md`。

**历史说明：** v2.0 Electron RFC（如扫描缓存、导入向导）描述 legacy Node 栈。Photasa/Tauri 等价能力按 [TAURI_RUST_REWRITE_POLICY.md](docs/rfc/TAURI_RUST_REWRITE_POLICY.md) **在 Rust 中重写**，不以复制 TS 或共享 `@photasa/*` 后端包为实现路径。RFC 0098 仅服务 Electron 维护。

### 统计（维护时随新增 RFC 更新）

| 指标 | 数量（基准日 2026-04-05） |
|------|---------------------------|
| RFC 正文 `.md`（含 `completed/`，不含 `README.md`） | 102 |
| 已归档于 `docs/rfc/completed/` | 60 |

Draft / In Progress 等细分以 [`TASK_TRACKING.md`](./TASK_TRACKING.md) 中 **Active RFCs** 表为准。

### By version（概览）

- **v2.0.0**：Electron / 主线能力（Implemented 与待办见 `TASK_TRACKING.md`）。
- **v2.1.0（Tauri migration）**：0067–0073 架构概览 + 下表 **0074+ 一事一 RFC**。

### Tauri 迁移 RFC 系列（架构与服务）

- **主 RFC**：[RFC 0067](docs/rfc/0067-tauri-app-photasa.md) — Photasa 总体架构与迁移策略  
- **已完成（服务层）**：[0073](docs/rfc/0073-tauri-ui-migration-adapter.md) UI/适配层；[0068](docs/rfc/0068-tauri-scan-service-migration.md) 扫描；[0069](docs/rfc/0069-tauri-thumbnail-service-migration.md) 缩略图；[0070](docs/rfc/0070-tauri-import-service-migration.md) 导入（Rust 执行流已落地；与 Electron 细粒度对拍见 [0097](docs/rfc/0097-tauri-legacy-api-deferred-surface.md)）；[0071](docs/rfc/0071-tauri-config-service-migration.md) 配置；[0072](docs/rfc/0072-tauri-tianshu-service-migration.md) 天枢

**建议实施顺序**：0073（UI+适配）→ 0071 → 0068 → 0069 → 0070 → 0072。

### Tauri small RFCs（0074+）：一事一表

| RFC | Topic | Status |
|-----|-------|--------|
| [0074](docs/rfc/completed/0074-tauri-adapter-concept.md) | Tauri adapter concept and env detection | ✅ Implemented |
| [0075](docs/rfc/completed/0075-tauri-flat-legacy-api-layer.md) | Flat legacy API layer (window.api shape) | ✅ Implemented |
| [0076](docs/rfc/completed/0076-tauri-path-utilities-rust.md) | Path utilities in Rust (1:1 from Node, zero Node) | ✅ Implemented |
| [0077](docs/rfc/completed/0077-tauri-get-photasa-config.md) | get_photasa_config command | ✅ Implemented |
| [0078](docs/rfc/completed/0078-tauri-add-to-photo-list.md) | add_to_photo_list command | ✅ Implemented |
| [0079](docs/rfc/completed/0079-tauri-remove-from-photo-list.md) | remove_from_photo_list command | ✅ Implemented |
| [0080](docs/rfc/completed/0080-tauri-reset-photasa-config.md) | reset_photasa_config command | ✅ Implemented |
| [0081](docs/rfc/completed/0081-tauri-fix-photasa-config.md) | fix_photasa_config command | ✅ Implemented |
| [0082](docs/rfc/completed/0082-tauri-watch-start-stop-commands.md) | Watch start/stop commands | ✅ Implemented |
| [0083](docs/rfc/completed/0083-tauri-watch-event-contract.md) | Watch event contract (same names as Electron) | ✅ Implemented |
| [0084](docs/rfc/completed/0084-tauri-choose-directory.md) | choose_directory command | ✅ Implemented |
| [0085](docs/rfc/completed/0085-tauri-get-directory.md) | get_directory command | ✅ Implemented |
| [0086](docs/rfc/completed/0086-tauri-sub-folders.md) | sub_folders command | ✅ Implemented |
| [0087](docs/rfc/completed/0087-tauri-check-photasa-config-folder.md) | check_photasa_config (folder validation) command | ✅ Implemented |
| [0088](docs/rfc/completed/0088-tauri-log-viewer-open.md) | Log viewer open/state command | ✅ Implemented（Photasa：`log_viewer_open` / `log_viewer_close`） |
| [0089](docs/rfc/completed/0089-tauri-log-stream-events.md) | Log stream events (same contract as Electron) | ✅ Implemented（Photasa：`log:entry` 桥接） |
| [0090](docs/rfc/completed/0090-tauri-update-service.md) | Update service (checkForUpdates) | ✅ Implemented（生产端点待配置） |
| [0091](docs/rfc/completed/0091-tauri-platform-is-mac.md) | Platform / isMac / get_platform | ✅ Implemented |
| [0092](docs/rfc/completed/0092-tauri-menu-api.md) | Menu (applySystemMenu, onMenuAction) | ✅ Implemented |
| [0093](docs/rfc/completed/0093-tauri-import-photos-legacy.md) | importPhotos legacy copy flow | ✅ Implemented |
| [0094](docs/rfc/completed/0094-tauri-choose-directories-multi.md) | choose_directories（单/多选目录） | ✅ Implemented |
| [0095](docs/rfc/completed/0095-tauri-get-path-root.md) | get_path_root（api-path getRoot） | ✅ Implemented |
| [0096](docs/rfc/completed/0096-tauri-import-pause-resume.md) | pause_import / resume_import | ✅ Implemented |
| [0097](docs/rfc/0097-tauri-legacy-api-deferred-surface.md) | legacy-api 与 Electron 1:1 跟踪 | 🚧 Partial |
| [0098](docs/rfc/0098-main-module-extraction-to-packages.md) | src/main 模块提取为 packages（**Electron-only**；非 Photasa 路径） | ⚠️ Partial（Phase 1 ✅；Phase 2 冻结，见 RFC 正文） |
| [0099](docs/rfc/completed/0099-tauri-window-reload.md) | window_reload（对齐 Electron reload） | ✅ Implemented |
| [0100](docs/rfc/completed/0100-tauri-single-instance.md) | 单实例（对齐 Electron） | ✅ Implemented |
| [0101](docs/rfc/completed/0101-tauri-startup-splash.md) | 启动 Splash 屏幕 | ✅ Implemented |
| [0102](docs/rfc/completed/0102-tauri-thumbnail-raw-fallback.md) | 缩略图 RAW 回退策略 | ✅ Implemented |
| [0103](docs/rfc/completed/0103-tauri-native-deps-build-strategy.md) | 原生依赖构建策略（libheif + ffmpeg-next） | ✅ Implemented |
| [0104](docs/rfc/0104-tauri-execute-import-date-folder.md) | execute_import date-based folder organization | ✅ Implemented |
| [0105](docs/rfc/0105-tauri-scan-incremental-cache.md) | Scan incremental cache (.photasa-folder.json) | 📋 Draft |
| [0106](docs/rfc/0106-tauri-update-periodic-check.md) | Updater background periodic check timer | 📋 Draft |
| [0107](docs/rfc/0107-tauri-wenchang-preferences-storage.md) | Wenchang preferences storage parity (Tauri) | ✅ Implemented |

### RFC 流程（摘要）

1. **Creation**：`docs/rfc/NNNN-feature-name.md`，取下一可用编号，提 PR。  
2. **Review**：Draft → Under Review → Accepted → Implemented（或 Rejected / Withdrawn）。  
3. **Tracking**：RFC 与实现 PR 互链；偏差写在 RFC 正文。

### RFC 模板（最小字段）

```markdown
# RFC NNNN: Feature Name
- **Start Date**: YYYY-MM-DD
- **RFC PR**: (empty)
- **Implementation Issue**: (empty)
## Implementation principle (Photasa / Tauri — if applicable)
> Link [TAURI_RUST_REWRITE_POLICY.md](docs/rfc/TAURI_RUST_REWRITE_POLICY.md). Rust rewrite; TS/Electron = spec only.
## Summary
## Motivation
## Detailed Design
## Drawbacks
## Alternatives
## Unresolved Questions
```

### 何时写 / 不写 RFC

**应写**：重大功能、破坏性变更、核心架构、明显性能/安全取舍。**可不写**：小 bugfix、纯文档、无用户影响的内部重构、仅升级依赖。

### 生命周期

`Draft → Under Review → Accepted → Implementation → Implemented`；旁路：`Rejected`、`Withdrawn`。

### Contributing（摘要）

作者：先查既有 RFC 与代码 → 讨论 → 按模板撰写 → PR → 迭代 → 推动实现。评审者：读全文、提问、评估长期影响并保持建设性。

### 工具与渊源

Markdown 与链接检查；状态可用 PR label / 看板。流程参考 [Rust RFCs](https://github.com/rust-lang/rfcs)、[Vue RFCs](https://github.com/vuejs/rfcs)、[React RFCs](https://github.com/reactjs/rfcs)。

---

## Tauri migration: RFC index and phases

**Architecture / overview (fat RFCs, kept as-is):** 0067 (overall), 0068 scan, 0069 thumbnail, 0070 import, 0071 config, 0072 tianshu, 0073 UI/adapter.

**One-RFC-one-thing（0074–0103）：** 逐条状态见上文 **RFC 仓库索引 → Tauri small RFCs（0074+）** 表；阶段总览如下。

| Phase | RFCs | What |
|-------|------|------|
| **Phase 1 – Infra** | (done) | Photasa app, window/shell/config file-level, WASM, stubs. |
| **Phase 2 – UI runnable** | **0074**, **0075**, **0091** | Adapter concept (0074), flat legacy API layer (0075), platform/isMac (0091). Legacy-api stubs every `window.api.xxx`; real impl can follow in Phase 3/4. |
| **Phase 3a – Path & config content** | **0076**, **0077–0081** | Path utilities in Rust (0076). Config content: get_photasa_config (0077), add_to_photo_list (0078), remove_from_photo_list (0079), reset_photasa_config (0080), fix_photasa_config (0081). |
| **Phase 3b – Directory & watch** | **0084–0087**, **0082–0083** | choose_directory (0084), get_directory (0085), sub_folders (0086), check_photasa_config folder (0087). Watch start/stop (0082), watch event contract (0083). |
| **Phase 3c – Services** | **0068**, **0069**, **0070**, **0093**, **0072** | Scan (0068), thumbnail (0069), import executeImport (0070), importPhotos legacy (0093), tianshu (0072). |
| **Phase 4 – Cleanup & rest** | **0088–0089**, **0090**, **0092** | Log viewer open (0088), log stream (0089), update service (0090), menu (0092). Path/log/update tests, docs. |
| **Phase 5 – 1:1 Parity gaps** | **0101–0103**（0099–0100 ✅，0101–0103 ✅） | window_reload (0099 ✅), single-instance (0100 ✅), startup splash (0101 ✅), RAW thumbnail fallback (0102 ✅), native deps build strategy (0103 ✅)。 |
| **Phase 6 – Deep code parity** | **0104–0106** | execute_import date-folder organization (0104), scan incremental cache .photasa-folder.json (0105), update periodic check timer (0106). |

**Current state**

- Done: Phase 1. **Phase 2 (flat legacy API):** Implemented per **RFC 0075** in `apps/photasa/src/api/legacy-api.ts`; `window.api` is now flat (same shape as `legacy.ts`), delegated to nested adapter or Tauri invoke, stubs for unimplemented commands. `adapter.ts` injects `createLegacyApi()` so `npm run tauri dev` no longer hits `window.api.xxx` undefined.
- **2026-03 增量：**RFC **0094** `choose_directories`、**0095** `get_path_root`、**0096** 导入暂停/恢复已接 `legacy-api`。
- **Phase 4（日志 / 更新）：** Rust：`log_viewer_open` / `log_viewer_close`、全局 `log` 桥接发射 `log:entry`；`check_for_updates` / `download_update` / `install_update` / `get_update_status` / `update_auto_update_config` 与 `picasa:update-*` 事件；`tauri-plugin-updater` + `capabilities` `updater:default`。前端：`legacy-api` 已 `invoke` + `listen` 对齐 Electron 同名事件。
- **RFC 0092 扩展：** 已用 `tauri-plugin-global-shortcut` 注册与 Electron 相同的日志查看器全局快捷键（macOS `cmd+shift+alt+KeyL` / 其他 `ctrl+shift+alt+KeyL`），按下时发射 `log:toggle-viewer`；系统菜单仍为 macOS `apply_system_menu`（既有实现）。
- **RFC 0097（Tauri 导入表面）：** `previewImport` → `preview_import`；`extractMetadata` → `extract_metadata`（读盘 + 栅格图 `image_dimensions`）；`execute_import` 完成后写入内存 `ImportSessionStore`（历史 + 可撤销 `fileList`），`getImportHistory` / `getImportDetails` / `getImportProgress`、`preview_undo_import` / `undo_import_execute` 已接 `legacy-api`。`tauri-import-stubs` 仅保留测试等占位。**余量：** 导入历史已落盘至应用数据目录 `import_history_v1.json`（Rust `ImportSessionStore`，原子写入）；`extract_metadata`：图片 EXIF（`kamadak-exif`，含 `cameraInfo`：**lens / iso / focalLength / aperture / shutterSpeed** 等标准标签）、视频 **`ffmpeg-next`（`build`+`build-zlib`，静态 FFmpeg，不依赖系统 ffmpeg）**（时长/编码/分辨率/容器时间/GPS/旋转）、可选 `computeMd5`；与 Electron 的细标签与回退行为仍待对拍；**预览**已与 Electron `import-worker` 预览链 **1:1**（每组 `extract_metadata_request`、`processFileGroup` 式合并、`determineGroupTargetDate`/`generateDatePath`、`targetPath`/`targetStructure`/`statistics`、`estimatedDuration`）；`updater` 密钥与端点待配置。
- **Watch / 扫描队列（对齐 Electron `WatchService`）：** `notify` 回调在发射既有 `picasa:file-*` 事件的同时，经 `commands/watch_scan_queue.rs` 的 `ScanQueueCoalescer` 合并去重与防抖后发射 `picasa:add-to-scan-queue`（载荷为与 `createFileOperation` 同形的 JSON 数组）；`start_file_watch` 配置可选 `thumbnail_size`（默认 150）；`stop_file_watch` 清空待合并项。
- **Next step:** `extract_metadata` 视频与 Electron **逐项对拍**（边界标签、错误回退）；静态图 EXIF 与 MakerNote 细字段；**0093** `importPhotos` 核心已对齐（Rust `copy_with_unique_name` 单测、`legacy-api` 桥接 + `created`→`Date` Vitest；见 RFC 0093）；配置真实 `updater.pubkey` 与 `endpoints`。`extract_metadata` 已含：图片 EXIF（含扩展 `cameraInfo`）、视频 `ffmpeg-next` 静态构建（时长/编码/分辨率/容器时间/GPS/旋转）、可选 MD5；**Rust 单测**已覆盖缺文件、MD5、非媒体 `other`、最小 JPEG、`fileType` 提示（`extract_metadata.rs`），以及视频侧与 ffprobe/Electron 同构的旋转/宽高/日期优先级/GPS（`extract_metadata_video.rs`）。
- **Phase 5 – 1:1 Parity gaps（2026-04）：** **RFC 0099** `reload_window`。**RFC 0100** 单实例 + macOS `RunEvent::Reopen`。**RFC 0101** 双窗 Splash + `close_splashscreen` + `public/splash.html`。**RFC 0102** RAW → JPEG 占位 + `ThumbnailResponse.fallback`。**RFC 0103** 文档与 `Cargo.toml` 对齐：`ffmpeg-next` 静态构建；`libheif-rs` 使用 **`embedded-libheif`**（非系统 libheif）。**余量：** Splash 进度/状态事件（Electron `updateProgress` 等价）、RAW 占位图上的扩展名绘制、`otool`/`ldd` 验证可纳入 CI 可选步骤。
- **Phase 6 – Deep code parity（2026-04）：** **RFC 0104** ✅：`commands/import_date_util.rs` 与预览共用 `generate_date_path_utc` / `determine_group_target_utc` / `extract_metadata` 链；`execute_import` 写入 `<targetPath>/{year}/{YYYYMMDD}/`，`imported_files[].targetPath` 为相对路径 `{year}/{YYYYMMDD}/filename`。**RFC 0105** `scan_photos` 仍缺 `.photasa-folder.json` 增量缓存。**RFC 0106** `update.rs` 仍缺后台 Tokio 定时检查。

---

## How to prove the work (验证清单)

按项目规范：**声称通过必须给出证据**，不能无依据说“测试通过”或“构建成功”。以下命令跑完并贴出完整输出，即视为证明。

1. **Rust 后端**
   - `cd apps/photasa/src-tauri && cargo build`  
   - 成功：无 `error:`；仅有 `warning` 可接受。若报 `failed to open icon .../icons/32x32.png`，需在 `src-tauri/icons/` 补全 tauri.conf.json 中声明的图标或改配置。

2. **前端构建（Vite）**
   - `pnpm run build:photasa` 或 `pnpm --filter @photasa/photasa run build`  
   - 成功：输出含 `built in ...` 或生成 `dist/`。若因仓库内其他问题失败（如 .yml 被当 JS、log4js 在 browser 下 externalized），需单独修后再验。

3. **Tauri 全量构建**
   - `cd apps/photasa && pnpm run tauri:build`  
   - 成功：产出可执行包。同样依赖图标等资源就绪。

4. **Lint（若该子项目配置了）**
   - 从仓库根执行 `pnpm run lint`（对所有有 lint 的包）或 `pnpm --filter @photasa/photasa run lint`（若存在）；或对改动的 TS 文件跑 eslint，并贴出零 error 的输出。

5. **单元测试（若有）**
   - `pnpm run test` 或项目内 `pnpm test`；贴出通过数量与覆盖率（若要求 100%）。

**结论**：只有上述命令实际执行且输出符合“成功”描述时，才能说“工作已验证”。

---

## Change summary (Tauri/RFC 本轮)

规划与规范：ROADMAP 本身（含 **RFC 仓库索引**）+ [`TASK_TRACKING.md`](./TASK_TRACKING.md)（Active/Implemented 全表）。  
新增 RFC：0074–0093 共 20 个（一事一 RFC）；删除 4 个 fat RFC（0077/0078/0079/0080 旧版）。  
Photasa 前端：`apps/photasa/src/api/legacy-api.ts` 新增，`adapter.ts` 改为注入 createLegacyApi()。  
Rust 后端（子代理）：commands/platform.rs, path.rs, directory.rs, watch.rs，config 内容级扩展，main.rs 注册，Cargo.toml 依赖，legacy-api 部分 stub 改为 invoke。

---

## Image processing support plan (Tauri)

Electron today: **Ma-Liang** in `thumbnail-handler.ts` with brushes: **SharpBrush** (JPEG/PNG/WebP/TIFF/GIF/AVIF), **BmpBrush** (Jimp+Sharp), **HeicBrush** (WASM, preview+thumbnail in one decode), **FfmpegBrush** (video), **FallbackBrush**. Single entry point: `createThumbnail` → `shouldUseMaLiang` → `maLiang.paint()`.

**Tauri strategy (phased):**

| Phase | Format / area | Approach |
|-------|----------------|----------|
| 1 | Common images (JPEG, PNG, WebP, GIF, etc.) | Rust `image` crate (and/or `imageproc`) in thumbnail service; one “brush” module. |
| 2 | Video thumbnails | Keep **FFmpeg** binary, call via Rust (e.g. `std::process::Command` or existing FFI). No Node. |
| 3 | HEIC/HEIF | **Option A**: Rust `libheif`/heif-rs bindings. **Option B**: Keep existing **WASM** decoder in Tauri (load same WASM from Rust). **Option C** (transition): Tauri invokes a small Node helper only for HEIC until A or B is ready. Prefer A or B for long term. |
| 4 | BMP / other edge cases | Rust `image` or dedicated decoder; or short-term fallback to “placeholder” icon. |
| 5 | Preview + thumbnail in one go (HEIC) | If HEIC uses WASM: reuse same decode for preview + thumbnail like HeicBrush. If heif-rs: decode once, then produce both outputs in Rust. |

**Principles:**
- One **thumbnail command** entry point in Tauri; internal “brush”/strategy per format (mirror Ma-Liang conceptually).
- No new ad-hoc RFC for image processing; **RFC 0069** is the place for this plan and any updates.
- Transition: stub can return “unsupported” for HEIC/BMP until the chosen phase is implemented; common images and video (FFmpeg) first.

---

## Deep analysis: implementation source and gaps

### 1. Where each legacy API runs (Electron) and which RFC (Tauri)

| API | Electron | Tauri (RFC) |
|-----|----------|-------------|
| **Window** (minimize, maximize, …) | Preload → main window service. | Tauri window + adapter (0074/0075). |
| **Path** (normalizePath, mergePath, toFileName, …) | Preload/main: Node `path` + path-util. | **0076** Rust path commands or pure TS + get_separator. |
| **getPhotasaConfig(folder)** | Preload: readConfig + parseConfig (Node fs). | **0077** get_photasa_config. |
| **addToPhotoList(photoPath)** | Preload → main add-config; preload file-config. | **0078** add_to_photo_list. |
| **removeFromPhotoList(photoPath)** | Preload file-config: read, splice, write. | **0079** remove_from_photo_list. |
| **resetPhotasaConfig(folder)** | Preload: photoList = [], write. | **0080** reset_photasa_config. |
| **fixPhotasaConfig(folder)** | Preload: normalize photoList, write. | **0081** fix_photasa_config. |
| **scanSubfolders** | Preload: `picasa:sub-folders`. | **0086** sub_folders. |
| **checkPhotasaConfig** (folder) | Preload: `picasa:check-photasa-config`. | **0087** check_photasa_config (folder validation). |
| **scanPhotos(scan)** | Preload: scan-photos + find-photo listener. | **0068** scan service; same event shape. |
| **createThumbnail / removeThumbnail** | Preload: create-thumbnail, remove-thumbnail. | **0069** thumbnail service. |
| **chooseDirectory** | Preload: choose-directory + selected-directory. | **0084** choose_directory. |
| **getDirectory(name)** | Preload: `picasa:get-directory`. | **0085** get_directory. |
| **startWatching / stopWatching** | Preload: start-file-watch, stop-file-watch; main emits file-add, file-change, … | **0082** start/stop commands, **0083** event contract (same names). |
| **importPhotos(folders, target, cb)** | Preload: RxJS + Node fs scan/copy. | **0093** importPhotos legacy in Rust. |
| **executeImport(config)** | Main: import-service. | **0070** import service. |
| **Log** (viewerOpen, onEntry) | Main: log-viewer-service. | **0088** log viewer open, **0089** log stream events. |
| **Update** (checkForUpdates) | Main: update-service. | **0090** update service. |
| **applySystemMenu / onMenuAction** | Main: menu service. | **0092** menu (Tauri menu API). |
| **isMac** | Preload: process.platform. | **0091** get_platform / platform. |

The **flat legacy-api layer** (0075) invokes the above Rust commands when in Tauri; stub any not yet implemented.

### 2. Config: two paths in Electron → Tauri RFCs

- **File-level** (already in photasa): query_config, add_config, remove_config. Overview: **0071**.
- **Content-level** (one RFC per command): **0077** get_photasa_config, **0078** add_to_photo_list, **0079** remove_from_photo_list, **0080** reset_photasa_config, **0081** fix_photasa_config. All implemented in Rust; flat legacy-api (0075) invokes them.

### 3. Path: Node everywhere

`@shared/path-util` and preload `path-helper` use Node `path` (join, dirname, basename, sep, resolve, relative, isAbsolute) and in places `fs` (isDirectory, isFile). In Tauri:

- **Option A**: One Rust module that exposes `normalize_path`, `merge_path`, `to_file_name`, `to_dir_name`, `get_separator`, `is_file_under_folder`, `is_hidden_file`, `resolve_path`, `relative_path`, etc. Frontend legacy-api calls invoke for each. High fidelity, many round-trips unless we batch.
- **Option B**: Pure TS path in renderer: implement the same logic with a **single** separator (from Tauri at startup, e.g. `invoke("get_separator")` or from `navigator.platform`). No Node; works in Tauri webview. Risk: Windows vs POSIX edge cases (e.g. file://, UNC) must match current behavior.
- **Option C**: Hybrid: separator + resolve/normalize (file://) in Rust (one call for “normalize this path”); the rest in TS using that separator.

Recommendation: **Option C** or **B** for Phase 2 (fewer commands, faster UI); add Rust path commands only where TS cannot match behavior (e.g. normalizePath with file:// on Windows).

### 4. Two import flows → RFCs

- **importPhotos(folders, target, callback)** – legacy. **RFC 0093**: implement in Rust (scan, filter, copy, progress); flat legacy-api (0075) invokes it.
- **executeImport(config)** – full import UI. **RFC 0070** (service overview). Both surfaces in legacy-api.

### 5. Watch event names

**RFC 0083** defines the contract: same channel names and payload as Electron (`picasa:file-add`, `picasa:file-change`, etc.). Implementation (0082) must emit these so frontend listeners work unchanged.

### 6. HEIC in Tauri: WASM vs libheif

- **WASM**: Photasa already uses wasmtime (for tianshu). The existing HEIC decoder is likely a WASM module (from @photasa/maliang or similar). So we could **load the same WASM from Rust** via wasmtime, pass buffer in, get decoded image out. No rewrite of HEIC logic; same binary. Need to verify: where is the HEIC WASM built and how is it loaded in Node (worker/main)? Then mirror in Rust.
- **heif-rs / libheif**: Native Rust bindings; one less dependency on WASM toolchain. Risk: heif-rs maturity and platform binaries (libheif on Windows/Mac/Linux). Prefer validating heif-rs on all targets before committing.
- **Transition**: Stub HEIC as “unsupported” until either WASM load in Rust or heif-rs is proven; common images + video (FFmpeg) first.

### 7. Dependency order (by RFC)

1. **0075** Flat legacy-api – First. Every `window.api.xxx` defined (stub or real). Unblocks UI.
2. **0074** Adapter concept, **0091** platform – So legacy-api can branch (Tauri vs Electron) and expose isMac/get_platform.
3. **0076** Path – Rust path commands or pure TS + get_separator; many APIs depend on path. Can be Phase 2 (TS + separator) or Phase 3a (full Rust).
4. **0077–0081** Config content – Required before scan/UI can use getPhotasaConfig, addToPhotoList, etc. Implement after or with 0076.
5. **0084–0087** Directory/dialog – choose_directory, get_directory, sub_folders, check_photasa_config. Can run in parallel with config content.
6. **0082–0083** Watch – start/stop (0082), event contract (0083). Can stub in legacy-api until Phase 4.
7. **0068** Scan – After path + config content. **0069** Thumbnail – After path. **0070** Import, **0093** importPhotos legacy – After or stub. **0072** Tianshu – Last (most complex); can stay stub.
8. **0088–0089** Log, **0090** Update, **0092** Menu – Phase 4; stub in legacy-api until then.

**Order summary:** 0075 → 0074, 0091 → 0076 → 0077–0081, 0084–0087 → 0068, 0069, 0070, 0093 → 0072 → 0082–0083, 0088–0089, 0090, 0092.

### 8. Risks and mitigations

| Risk | Mitigation |
|------|------------|
| Path edge cases (file://, UNC, Windows drive) | Implement normalizePath in Rust (one command), rest in TS with separator; add tests for file:// and Windows paths. |
| Config content and file-level out of sync | Single Rust config module that handles both “create/query paths” and “read/modify photoList”; one source of truth. |
| importPhotos and executeImport both used | Keep both in legacy-api; implement importPhotos in Rust as “simple copy + events” or alias to a subset of executeImport. |
| Watch event name mismatch | Use exact `WatchServiceEvent` channel names in Tauri emit. |
| HEIC blocking thumbnail for many users | Phase HEIC (stub or optional); ship common images + video first. |
| getAppPath / app paths in Tauri | Tauri has different app path API; expose e.g. `resource_dir`, `app_data_dir` and map in legacy-api where needed. |

### 9. Summary for implementers

- **Phase 2:** **RFC 0075** – Flat `legacy-api.ts` with every `window.api` method from `legacy.ts`; Tauri branch invokes Rust or stubs. **0074** adapter concept, **0091** platform (get_platform / isMac) so legacy-api can detect env. Path: prefer pure TS in renderer + get_separator (0091 or 0076) to unblock quickly.
- **Phase 3a:** **0076** path (Rust or TS), **0077–0081** config content (five commands). Phase 3b: **0084–0087** directory/dialog, **0082–0083** watch. Phase 3c: **0068** scan, **0069** thumbnail, **0070** import, **0093** importPhotos legacy, **0072** tianshu.
- **Phase 4:** **0088–0089** log viewer, **0090** update, **0092** menu; tests and docs.
- **Image processing:** RFC **0069** (phased plan); HEIC via WASM-in-Rust or heif-rs; FFmpeg for video; Rust `image` for common formats.

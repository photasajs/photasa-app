# ROADMAP

High-level plans and “what’s next” live here. Do not duplicate this as random new `.md` files elsewhere.

---

## Goal: Tauri + full Rust backend + Vue frontend

- **Runtime**: Tauri only (no Electron in target). Vue for frontend.
- **Backend**: 100% Rust. **1:1 mapping** from current Node/Electron main and preload logic to Rust; **no Node usage** in Tauri backend.
- **Frontend–backend boundary**: **Adapter concept**. Vue (and shared `utils/api`) talk to the backend only through an adapter layer. The adapter hides whether the backend is Electron or Tauri and how it is invoked (IPC vs `invoke`). All backend capabilities are exposed as a single, stable surface (e.g. flat `window.api`) implemented behind the adapter.

---

## RFC policy: one RFC, one thing

RFCs must be **focused on a single concern** (one feature, one migration target, one interface). Do **not** write large, catch-all RFCs that mix architecture, multiple services, and implementation details.

- **Good**: One RFC for "Tauri adapter concept," one for "flat legacy API layer," one for "path utilities in Rust," one for "config content-level commands in Rust."
- **Bad**: One RFC that describes adapter + legacy API + path + config + scan + thumbnail in one document.

Existing 0067–0073 remain as high-level or per-service docs; new or split work should use **small RFCs** (0074+) with one topic each. See [Rust RFC process](https://rust-lang.github.io/rfcs/0002-rfc-process.html) and [Vue RFCs](https://github.com/vuejs/rfcs): one substantial change per RFC.

---

## Tauri migration: RFC index and phases

**Architecture / overview (fat RFCs, kept as-is):** 0067 (overall), 0068 scan, 0069 thumbnail, 0070 import, 0071 config, 0072 tianshu, 0073 UI/adapter.

**One-RFC-one-thing (0074–0093):** Each item below has a dedicated RFC. See `docs/rfc/README.md` for the full table.

| Phase | RFCs | What |
|-------|------|------|
| **Phase 1 – Infra** | (done) | Photasa app, window/shell/config file-level, WASM, stubs. |
| **Phase 2 – UI runnable** | **0074**, **0075**, **0091** | Adapter concept (0074), flat legacy API layer (0075), platform/isMac (0091). Legacy-api stubs every `window.api.xxx`; real impl can follow in Phase 3/4. |
| **Phase 3a – Path & config content** | **0076**, **0077–0081** | Path utilities in Rust (0076). Config content: get_photasa_config (0077), add_to_photo_list (0078), remove_from_photo_list (0079), reset_photasa_config (0080), fix_photasa_config (0081). |
| **Phase 3b – Directory & watch** | **0084–0087**, **0082–0083** | choose_directory (0084), get_directory (0085), sub_folders (0086), check_photasa_config folder (0087). Watch start/stop (0082), watch event contract (0083). |
| **Phase 3c – Services** | **0068**, **0069**, **0070**, **0093**, **0072** | Scan (0068), thumbnail (0069), import executeImport (0070), importPhotos legacy (0093), tianshu (0072). |
| **Phase 4 – Cleanup & rest** | **0088–0089**, **0090**, **0092** | Log viewer open (0088), log stream (0089), update service (0090), menu (0092). Path/log/update tests, docs. |

**Current state**

- Done: Phase 1. **Phase 2 (flat legacy API):** Implemented per **RFC 0075** in `apps/photasa/src/api/legacy-api.ts`; `window.api` is now flat (same shape as `legacy.ts`), delegated to nested adapter or Tauri invoke, stubs for unimplemented commands. `adapter.ts` injects `createLegacyApi()` so `npm run tauri dev` no longer hits `window.api.xxx` undefined.
- **2026-03 增量：**RFC **0094** `choose_directories`、**0095** `get_path_root`、**0096** 导入暂停/恢复已接 `legacy-api`。
- **Phase 4（日志 / 更新）：** Rust：`log_viewer_open` / `log_viewer_close`、全局 `log` 桥接发射 `log:entry`；`check_for_updates` / `download_update` / `install_update` / `get_update_status` / `update_auto_update_config` 与 `picasa:update-*` 事件；`tauri-plugin-updater` + `capabilities` `updater:default`。前端：`legacy-api` 已 `invoke` + `listen` 对齐 Electron 同名事件。
- **RFC 0092 扩展：** 已用 `tauri-plugin-global-shortcut` 注册与 Electron 相同的日志查看器全局快捷键（macOS `cmd+shift+alt+KeyL` / 其他 `ctrl+shift+alt+KeyL`），按下时发射 `log:toggle-viewer`；系统菜单仍为 macOS `apply_system_menu`（既有实现）。
- **RFC 0097（Tauri 导入表面）：** `previewImport` → `preview_import`；`extractMetadata` → `extract_metadata`（读盘 + 栅格图 `image_dimensions`）；`execute_import` 完成后写入内存 `ImportSessionStore`（历史 + 可撤销 `fileList`），`getImportHistory` / `getImportDetails` / `getImportProgress`、`preview_undo_import` / `undo_import_execute` 已接 `legacy-api`。`tauri-import-stubs` 仅保留测试等占位。**余量：** 导入历史已落盘至应用数据目录 `import_history_v1.json`（Rust `ImportSessionStore`，原子写入）；`extract_metadata`：图片 EXIF（`kamadak-exif`）、视频 **`ffmpeg-next`（`build`+`build-zlib`，静态 FFmpeg，不依赖系统 ffmpeg）**（时长/编码/分辨率/容器时间/GPS/旋转）、可选 `computeMd5`；与 Electron 的细标签与回退行为仍待对拍；预览 `targetStructure` 粗粒度；`updater` 密钥与端点待配置。
- **Watch / 扫描队列（对齐 Electron `WatchService`）：** `notify` 回调在发射既有 `picasa:file-*` 事件的同时，经 `commands/watch_scan_queue.rs` 的 `ScanQueueCoalescer` 合并去重与防抖后发射 `picasa:add-to-scan-queue`（载荷为与 `createFileOperation` 同形的 JSON 数组）；`start_file_watch` 配置可选 `thumbnail_size`（默认 150）；`stop_file_watch` 清空待合并项。
- **Next step:** `extract_metadata` 视频与 Electron **逐项对拍**（边界标签、错误回退）；静态图 EXIF 细字段（镜头、ISO 等）；预览 `targetStructure` 细化；**0093** `importPhotos` 与 Electron 1:1 核查；配置真实 `updater.pubkey` 与 `endpoints`。`extract_metadata` 已含：图片 EXIF、视频 `ffmpeg-next` 静态构建（时长/编码/分辨率/容器时间/GPS/旋转）、可选 MD5。

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

规划与规范：ROADMAP 本身 + `docs/rfc/README.md`（One RFC one thing、0074–0093 表、统计）。  
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

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

### Active RFCs must target Rust (Photasa)

**Only Rust-targeting RFCs may be Active for Photasa.** See [`TASK_TRACKING.md`](./TASK_TRACKING.md) → **Photasa Active RFCs**.

| Photasa Active | Not Photasa Active |
|----------------|-------------------|
| **[0097](docs/rfc/0097-tauri-legacy-api-deferred-surface.md)** — close gaps via **Rust commands** | **[0098](docs/rfc/0098-main-module-extraction-to-packages.md)** — **Deferred** (Electron `@photasa/*` packages) |
| Future Tauri RFCs (`0110+`) with Rust implementation in `src-tauri` / `crates/` | v2.0 Electron Draft RFCs (0004–0061) — **legacy backlog** unless superseded by a Rust RFC |
| Completed **0074–0107** (maintenance fixes still Rust-only) | Any RFC whose primary deliverable is Node/TS backend for Photasa |

New Photasa features: **new Tauri RFC + Rust impl** — never activate Electron-only RFCs as the migration path.

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

Draft / In Progress 等细分以 [`TASK_TRACKING.md`](./TASK_TRACKING.md) 中 **Photasa Active RFCs** 与 **Legacy backlog** 为准。

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
| [0097](docs/rfc/0097-tauri-legacy-api-deferred-surface.md) | legacy-api 与 Electron 1:1 跟踪 | ✅ Implemented（Phase 7 全部完成） |
| [0098](docs/rfc/0098-main-module-extraction-to-packages.md) | src/main 模块提取为 packages（**Electron-only**） | ⏸️ Deferred（非 Photasa Active；Phase 2 冻结） |
| [0099](docs/rfc/completed/0099-tauri-window-reload.md) | window_reload（对齐 Electron reload） | ✅ Implemented |
| [0100](docs/rfc/completed/0100-tauri-single-instance.md) | 单实例（对齐 Electron） | ✅ Implemented |
| [0101](docs/rfc/completed/0101-tauri-startup-splash.md) | 启动 Splash 屏幕 | ✅ Implemented |
| [0102](docs/rfc/completed/0102-tauri-thumbnail-raw-fallback.md) | 缩略图 RAW 回退策略 | ✅ Implemented |
| [0103](docs/rfc/completed/0103-tauri-native-deps-build-strategy.md) | 原生依赖构建策略（libheif + ffmpeg-next） | ✅ Implemented |
| [0104](docs/rfc/0104-tauri-execute-import-date-folder.md) | execute_import date-based folder organization | ✅ Implemented |
| [0105](docs/rfc/0105-tauri-scan-incremental-cache.md) | Scan incremental cache (.photasa-folder.json) | ✅ Implemented |
| [0106](docs/rfc/0106-tauri-update-periodic-check.md) | Updater background periodic check timer | ✅ Implemented |
| [0107](docs/rfc/0107-tauri-wenchang-preferences-storage.md) | Wenchang preferences storage parity (Tauri) | ✅ Implemented |
| [0111](docs/rfc/0111-tauri-scan-notify-status-bridge.md) | Scan `notify:status` Rust bridge (0057) | ✅ Implemented |
| [0112](docs/rfc/0112-tauri-extract-metadata-golden-parity.md) | extract_metadata golden parity + MakerNote | ✅ Implemented |
| [0113](docs/rfc/0113-tauri-updater-production-and-prefs-sync.md) | Updater production config + prefs → UpdateState | ✅ Implemented |
| [0114](docs/rfc/0114-tauri-get-directory-os-paths.md) | get_directory OS paths + scan_directories FileGroup[] | ✅ Implemented |
| [0115](docs/rfc/0115-tauri-webview-local-image-asset-protocol.md) | WebView 本地图片（asset 协议，非 file://） | ✅ Implemented |
| [0116](docs/rfc/0116-tauri-photasa-config-thumbnail-parity.md) | `.photasa.json` 缩略图路径 Electron 契约 + rescan/切换文件夹修复 | ✅ Implemented |
| [0117](docs/rfc/0117-tauri-scan-pipeline-parity.md) | 扫描流水线 Electron 契约：策略决策 + 文件级门控 + 串行缩略图 + 子目录递归（SKIP-only）| ✅ Implemented |
| [0118](.spec/rfc/0118-tauri-import-background-ui.md) | 导入进度后台 UI（G1–G9,G13–G14） | 🔨 In Progress（**P2**） |
| [0119](.spec/rfc/0119-tauri-import-checksum.md) | Import `checksum` 字段诚实 | ⏳ Draft（**P3**） |
| [0120](.spec/rfc/0120-tauri-import-quit-recovery.md) | 导入中退出/崩溃恢复（G11） | ⏸️ Deferred |
| [0121](.spec/rfc/0121-tauri-import-settings-prefs.md) | Settings 导入默认项（G12） | ⏸️ Deferred |
| [0122](.spec/rfc/0122-tauri-legacy-importphotos-background-ux.md) | 遗留 importPhotos 后台 UX（G10） | ⏸️ Deferred |
| [0123](.spec/rfc/0123-tauri-import-duplicate-count.md) | Import `duplicateCount` 诚实 | ⏳ Draft（**P3**） |
| [0124](.spec/rfc/0124-tauri-import-resume-return-shape.md) | `resumeImport` 返回形状 | ⏳ Draft（**P3**） |
| [0125](.spec/rfc/0125-tauri-import-paused-progress-emit.md) | pause 时 emit `status: paused` + cancelled payload 字段 | ⏳ Draft（**P3d**） |
| [0126](.spec/rfc/0126-electron-import-background-ux-parity.md) | Electron desktop 同款后台 UX | ⏸️ Deferred |
| [0127](.spec/rfc/0127-tauri-import-error-payload-shape.md) | `import:error` payload 形状（`[object Object]`） | ⏳ Draft（**P3e**） |
| [0128](.spec/rfc/0128-tauri-import-progress-import-id.md) | `import:progress` 缺 `importId` | ✅ Implemented |
| [0129](.spec/rfc/0129-tauri-import-progress-throttle.md) | `import:progress` 无节流 | ⏳ Draft（**P3g**） |
| [0130](.spec/rfc/0130-tauri-import-legacy-copy-dedup.md) | `import_legacy.rs` 复制逻辑去重 | ⏳ Draft（**P4**，cleanup） |
| [0131](.spec/rfc/0131-tauri-photasa-import-crate.md) | `photasa-import` 独立 crate（算法可测、零 Tauri） | ✅ Implemented |

### Photasa next priorities（2026-07）

**迁移** [0097](.spec/rfc/0097-tauri-legacy-api-deferred-surface.md) ✅。政策：[TAURI_RUST_REWRITE_POLICY.md](.spec/rfc/TAURI_RUST_REWRITE_POLICY.md)。

**铁律：** Gap / T3 残留 → **一事一 RFC**。禁止 mono「contract polish」袋。

| 优先级 | 项 | RFC |
|--------|-----|-----|
| **P1** | 迁移验收 | **0097** ✅ |
| **P2** | 后台导入 UI | **0118** |
| **P3a** | checksum | **0119** |
| **P3b** | duplicateCount | **0123** |
| **P3c** | resume 返回形状 | **0124** |
| **P3d** | paused progress emit + cancelled payload 字段 | **0125** |
| **P3e** | `import:error` payload 形状（`[object Object]`） | **0127** |
| **P3f** | `import:progress` 缺 `importId` | **0128** ✅ |
| **P3g** | `import:progress` 无节流 | **0129** |
| **P4** | `import_legacy.rs` 复制逻辑去重（cleanup） | **0130** |
| **P0-infra** | `photasa-import` crate 拆分（可测性） | **0131** ✅ |
| — | Quit 恢复 | **0120** ⏸️ |
| — | Settings 导入 | **0121** ⏸️ |
| — | Legacy importPhotos UX | **0122** ⏸️ |
| — | Electron desktop UX | **0126** ⏸️ |

**编号：** **0108–0110 不回填**；**0118–0131** 已登记。

---

### P1 — Plan & test plan（迁移收官验收）

**Goal:** Prove Rust import/migration claim is true. **No new feature.** No TS backend.

| Step | Action | Pass |
|------|--------|------|
| P1.1 | `cd apps/photasa/src-tauri && cargo test`（至少含 `import_` / `extract_metadata` / `scan_` 相关） | 全绿；贴输出为证据 |
| P1.2 | Manual Photasa：向导选源→目标→预览→执行→完成 | 文件落到 `{target}/{year}/{YYYYMMDD}/`；进度事件正常 |
| P1.3 | Pause / Resume / Cancel 各一次 | 行为符合 0096（文件边界） |
| P1.4 | Import History → Undo 一条 | 目标文件删除/清理符合预期 |
| P1.5 | Settings smoke：`UpdateSettings` 改 autoUpdate 开关 | `updateAutoUpdateConfig` 无报错（0113）；**无** Import 设置页属预期 |
| P1.6 | Confirm docs：ROADMAP 无「0112/0113 未完成」假缺口 | 已修正则勾选 |

**P1 fail =** cargo 红、或向导无法完成导入。  
**P1 不测 =** 0118 dismiss、checksum 字段。

---

### P2 — Plan & test plan（摘要；细节以 0118 为准）

**Goal:** Dismiss progress modal; Rust continues; chip + re-open; Cancel still cancels.

| Phase | Work |
|-------|------|
| A | Active-import session store + app-level listeners |
| B | Modal: dismiss ≠ cancel; keep `importId` on close |
| C | App chip + re-open without second `executeImport` |
| D | Block concurrent second import; i18n; mark 0118 ✅ |

**Tests:** RFC 0118 → **T1** Vitest（dismiss/cancel/re-open）+ **T2** manual（后台拷贝、再开、pause、cancel、完成）。  
**Settings:** no hook / no new panel for 0118.

---

### P3 — Plan & test plan（**一事一 RFC**）

| RFC | One thing | Tests (when started) |
|-----|-----------|----------------------|
| **[0119](.spec/rfc/0119-tauri-import-checksum.md)** | checksum | Rust: hash or field absent |
| **[0123](.spec/rfc/0123-tauri-import-duplicate-count.md)** | duplicateCount | Rust: count or omit |
| **[0124](.spec/rfc/0124-tauri-import-resume-return-shape.md)** | resume return | Vitest adapter |
| **[0125](.spec/rfc/0125-tauri-import-paused-progress-emit.md)** | paused emit | Listen assert status |

**Deferred (also one each):** [0120](.spec/rfc/0120-tauri-import-quit-recovery.md) · [0121](.spec/rfc/0121-tauri-import-settings-prefs.md) · [0122](.spec/rfc/0122-tauri-legacy-importphotos-background-ux.md) · [0126](.spec/rfc/0126-electron-import-background-ux-parity.md).

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
| **Phase 1 – Infra** | (done) | Photasa app, window/shell/config file-level, stubs. |
| **Phase 2 – UI runnable** | **0074**, **0075**, **0091** | Adapter concept (0074), flat legacy API layer (0075), platform/isMac (0091). Legacy-api stubs every `window.api.xxx`; real impl can follow in Phase 3/4. |
| **Phase 3a – Path & config content** | **0076**, **0077–0081** | Path utilities in Rust (0076). Config content: get_photasa_config (0077), add_to_photo_list (0078), remove_from_photo_list (0079), reset_photasa_config (0080), fix_photasa_config (0081). |
| **Phase 3b – Directory & watch** | **0084–0087**, **0082–0083** | choose_directory (0084), get_directory (0085), sub_folders (0086), check_photasa_config folder (0087). Watch start/stop (0082), watch event contract (0083). |
| **Phase 3c – Services** | **0068**, **0069**, **0070**, **0093**, **0072** | Scan (0068), thumbnail (0069), import executeImport (0070), importPhotos legacy (0093), tianshu (0072). |
| **Phase 4 – Cleanup & rest** | **0088–0089**, **0090**, **0092** | Log viewer open (0088), log stream (0089), update service (0090), menu (0092). Path/log/update tests, docs. |
| **Phase 5 – 1:1 Parity gaps** | **0101–0103**（0099–0100 ✅，0101–0103 ✅） | window_reload (0099 ✅), single-instance (0100 ✅), startup splash (0101 ✅), RAW thumbnail fallback (0102 ✅), native deps build strategy (0103 ✅)。 |
| **Phase 6 – Deep code parity** | **0104–0106** | execute_import date-folder organization (0104), scan incremental cache .photasa-folder.json (0105), update periodic check timer (0106). |
| **Phase 7 – Rust parity closure** | **0111–0114**（+ **0115–0117** 同阶段收口） | scan notify:status (0111), extract_metadata golden (0112), updater ops + prefs sync (0113), get_directory + scan_directories + WASM cleanup (0114), asset protocol (0115), photasa-config thumbnail (0116), scan pipeline parity (0117). Parent tracker: **0097** ✅ |
| **Phase 8 – Import UX（非迁移）** | **0118**（🔨） | 导入进度后台化 UI：关模态不 cancel、可再开接回。**P2**；Rust 内核已在 Phase 3c/6/7。 |

**Current state**

- Done: Phase 1. **Phase 2 (flat legacy API):** Implemented per **RFC 0075** in `apps/photasa/src/api/legacy-api.ts`; `window.api` is now flat (same shape as `legacy.ts`), delegated to nested adapter or Tauri invoke, stubs for unimplemented commands. `adapter.ts` injects `createLegacyApi()` so `npm run tauri dev` no longer hits `window.api.xxx` undefined.
- **2026-03 增量：**RFC **0094** `choose_directories`、**0095** `get_path_root`、**0096** 导入暂停/恢复已接 `legacy-api`。
- **Phase 4（日志 / 更新）：** Rust：`log_viewer_open` / `log_viewer_close`、全局 `log` 桥接发射 `log:entry`；`check_for_updates` / `download_update` / `install_update` / `get_update_status` / `update_auto_update_config` 与 `picasa:update-*` 事件；`tauri-plugin-updater` + `capabilities` `updater:default`。前端：`legacy-api` 已 `invoke` + `listen` 对齐 Electron 同名事件。
- **RFC 0092 扩展：** 已用 `tauri-plugin-global-shortcut` 注册与 Electron 相同的日志查看器全局快捷键（macOS `cmd+shift+alt+KeyL` / 其他 `ctrl+shift+alt+KeyL`），按下时发射 `log:toggle-viewer`；系统菜单仍为 macOS `apply_system_menu`（既有实现）。
- **RFC 0097（迁移跟踪）：** ✅ Implemented。导入表面已 Rust：`preview_import` / `execute_import` / history·undo / `extract_metadata`（0112 golden）/ 日期目录（0104）/ pause·resume（0096）。`tauri-import-stubs` = 前端兜底形状 only，**不是**未接入后端。导入历史落盘 `import_history_v1.json`。Updater 接线见 **0113** + `UPDATER.md`（生产密钥走 CI/运维，不进仓库）。
- **Watch / 扫描队列（对齐 Electron `WatchService`）：** `notify` 回调在发射既有 `picasa:file-*` 事件的同时，经 `commands/watch_scan_queue.rs` 的 `ScanQueueCoalescer` 合并去重与防抖后发射 `picasa:add-to-scan-queue`（载荷为与 `createFileOperation` 同形的 JSON 数组）；`start_file_watch` 配置可选 `thumbnail_size`（默认 150）；`stop_file_watch` 清空待合并项。
- **Next step（以「Photasa next priorities」为准）：** **P2** **0118**；**P3a–g** **0119 / 0123 / 0124 / 0125 / 0127 / 0128 / 0129**；**P4** **0130**（`import_legacy` → `photasa-import`）。
- **Phase 5 – 1:1 Parity gaps（2026-04）：** … Splash / RAW / engine-status 已收口；`otool`/`ldd` 可选 CI。
- **Phase 6 – Deep code parity（2026-04）：** **RFC 0104** ✅ … **RFC 0105** ✅ … **RFC 0106** ✅ …
- **Phase 8 – Import UX（2026-07）：** **0118** 🔨 — **P2 UX**（非 Rust 迁移）；正文：`.spec/rfc/0118-tauri-import-background-ui.md`。T1 Vitest 已绿；T2 待手动签收。
- **0131 – photasa-import crate（2026-07）：** ✅ — `crates/photasa-import`（零 Tauri）；Tauri 薄包装；`cargo test -p photasa-import` **36 passed**。

---

## Electron → Rust parity audit（2026-06）

**规则：** [TAURI_RUST_REWRITE_POLICY.md](docs/rfc/TAURI_RUST_REWRITE_POLICY.md) — 后端 **仅 Rust**；Electron/TS **仅作契约对照**。跟踪 RFC：**[0097](docs/rfc/0097-tauri-legacy-api-deferred-surface.md)**（Photasa Active）。

### 总结

| 类别 | 数量 | 说明 |
|------|------|------|
| ✅ **已在 Rust 重写** | ~98% flat `window.api` + 天枢/文昌 | legacy-api Tauri 分支无 stub；Phase 7 完成 |
| 🚧 **可选 polish（非迁移）** | 见 **Photasa next priorities** | **P2** 0118；**P3a–g** 0119/0123/0124/0125/0127/0128/0129；**P4** 0130；Deferred 0120–0122/0126 |
| ❌ **未重写 / 已清理** | 0 项 | WASM 占位已删除（0114） |
| ⛔ **不得作为 Photasa 路径** | Electron-only | `@photasa/*` 抽包（0098）、preload 本地 fs、Ma-Liang Node |

### ✅ 已在 Rust 重写（按 Electron 能力域）

| 能力域 | Electron 入口 | Rust 交付 | RFC |
|--------|-----------------|-----------|-----|
| 窗口 | `window:*` | `commands/window.rs` | 0074/0075, 0099 |
| 路径 | preload path-helper | `commands/path.rs` | 0076 |
| 配置内容 | file-config + worker | `commands/config.rs` | 0077–0081 |
| 目录/对话框 | directory-service | `commands/directory.rs` | 0084–0087, 0094 |
| 扫描 | scan-service + worker | `scan_runner` + `scan_cache` | 0068, **0105** |
| 监视 | watch-service | `watch.rs` + `watch_scan_queue.rs` | 0082–0083 |
| 缩略图 | Ma-Liang worker | `thumbnail.rs`（image + libheif + ffmpeg-next + RAW 扩展名占位） | 0069, 0102, 0103 |
| 导入（增强） | import-service + worker | `import_*` + `import_date_util` | 0070, 0104, 0096 |
| 遗留导入 | preload RxJS+fs | `import_photos_legacy` | 0093 |
| 元数据 | import worker / preload EXIF | `extract_metadata*.rs` | 0097（主干） |
| 日志 | log-viewer-service | `log_viewer.rs` + `log:entry` | 0088–0089 |
| 更新 | update-service | `update.rs` + `update_periodic.rs` | 0090, **0106** |
| 菜单/Shell | menu + shell | `menu.rs`, `shell.rs`, 天枢 shell 工作流 | 0092, 0058 |
| 平台 | `process.platform` | `platform.rs` | 0091 |
| 天枢/偏好 | tianshu + wenchang | `TianshuService` + `wenchang-preferences` | 0072, **0107** |
| 启动/Splash/单实例 | splash + single-instance | 双窗 + `close_splashscreen` + plugin | 0100, 0101 |

### 🚧 可选 polish（不阻断 0097）

| 缺口 | Electron 行为 | 当前 Tauri | 状态 |
|------|---------------|------------|------|
| RAW 占位扩展名 | FallbackBrush SVG 标签 | ✅ `thumbnail_placeholder.rs` 位图字体 | **0102 迭代完成** |
| Splash 主题 | `setTheme` + OS `nativeTheme` | ✅ `splash_bridge.rs` — 启动 + `ThemeChanged` | **完成** |
| 配置 worker 健康 | `picasa:engine-status` | ✅ `engine_status.rs` — Rust 里程碑探针 | **完成** |

### ❌ 未重写 / 已清理的占位

| 项 | 说明 | 状态 |
|----|------|------|
| `load_wasm_module` / `call_wasm_function` | 废弃空命令 | ✅ 已从 `main.rs` 移除（**0114**） |
| `@photasa/*` 作为 Tauri 后端 | 0098 Electron 包 | **禁止**；扫描缓存已在 **0105 Rust** |

### ⛔ 不算 Photasa 缺口（Electron-only，勿激活）

- **RFC 0098** — `@photasa/scan|import|config-core` 抽包（Deferred）
- **v2.0 Draft RFC**（0032 千里眼引擎等）— legacy Node 架构描述；Photasa 用 **0068/0105 Rust**
- **preload 纯本地**（splitPath/joinPath 等）— 允许 **Vue 纯 TS**（非后端）；或已由 **0076** 覆盖 invoke 路径

### Phase 7 – Rust parity closure（✅ 全部完成）

| RFC | 标题 | 状态 |
|-----|------|------|
| **[0111](docs/rfc/0111-tauri-scan-notify-status-bridge.md)** | 扫描 `notify:status` Rust 桥 | ✅ Implemented |
| **[0112](docs/rfc/0112-tauri-extract-metadata-golden-parity.md)** | `extract_metadata` golden 对拍 | ✅ Implemented |
| **[0113](docs/rfc/0113-tauri-updater-production-and-prefs-sync.md)** | updater 生产配置 + 启动同步 `UpdateState` | ✅ Implemented |
| **[0114](docs/rfc/0114-tauri-get-directory-os-paths.md)** | `get_directory` OS 路径 + `scan_directories` FileGroup[] + WASM 清理 | ✅ Implemented |
| **[0115](docs/rfc/0115-tauri-webview-local-image-asset-protocol.md)** | WebView 本地图片：`convertFileSrc` + assetProtocol + CSP（修复 file:// 不可加载） | ✅ Implemented |

**0097** Phase 7 全部落地 → 标 ✅ Implemented。

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

Electron today: **Ma-Liang** (Node/Sharp/WASM). **Photasa: Rust-only** per [TAURI_RUST_REWRITE_POLICY.md](docs/rfc/TAURI_RUST_REWRITE_POLICY.md).

| Format / area | Tauri approach | RFC |
|---------------|----------------|-----|
| JPEG/PNG/WebP/GIF/TIFF/AVIF | Rust `image` + `thumbnail.rs` | 0069, 0102 |
| HEIC/HEIF | **`libheif-rs` + `embedded-libheif`** | 0103 |
| Video | **`ffmpeg-next` static build** | 0103, 0069 |
| RAW | JPEG 占位 + `fallback: true` | 0102 |

**禁止：** Tauri 加载 Ma-Liang WASM、Node helper、或 `@photasa/maliang` 作为解码路径。

---

## Deep analysis: implementation source and gaps

> **2026-06 更新：** 实施顺序与缺口以本节上文 **Electron → Rust parity audit** 为准。以下内容保留作历史对照。

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

### 6. HEIC in Tauri

**已决策（RFC 0103）：** `libheif-rs` + **`embedded-libheif`**。禁止 WASM-in-Rust 或 Node 过渡方案。

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
- **Image processing:** RFC **0069** / **0103** — Rust `image`, **`libheif-rs` + embedded-libheif**, **`ffmpeg-next` static build**. **No WASM.**

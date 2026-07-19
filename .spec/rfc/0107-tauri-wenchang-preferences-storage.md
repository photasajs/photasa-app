# RFC 0107 – Tauri Wenchang: application preferences storage parity

**Status**: 🔨 In Progress — Rust crate + adapters done; **production packaging broken** (see 2026-07-18 finding below)  
**Created**: 2026-04-06  
**Area**: Tauri / Preferences / Tianshu

## Implementation checklist（补记，原文档缺失）

- [x] `crates/wenchang-preferences` workspace crate（`cargo test -p wenchang-preferences` → 5 passed）
- [x] `config_adapter.rs::name()` → `"config"`（folder-level `.photasa.json`）
- [x] `preferences_adapter.rs::name()` → `"wenchang"`
- [x] `TianshuService` 注册 `PreferencesAdapter` + `ConfigAdapter`（`services/tianshu.rs:142-144`）
- [x] 11 个 workflow action 全部实现（非 stub）：`getCurrentSnapshot`/`updatePreferences`/`resetToDefaults`/`exportPreferences`/`importPreferences`/`getHistory`/`restoreRevision`/`validate`/`sanitize`/`emitEvent`/`formatResponse`
- [x] 前端真实调用（非孤立代码）：`yuantiangang/intent.ts`、`fangxuanling/store-automation/store-sync-utils.ts`

**验证证据（2026-07-18 复核，非仅信任 Status 字段）**：`cargo test -p wenchang-preferences` 5 passed；`config_adapter.rs`/`preferences_adapter.rs` 的 `name()` 直接读源码确认；11 个 action 逐一 grep 确认非 stub（有真实 match arm body）；`yuantiangang/intent.ts` 中 `THEME_CHANGE`/`LANGUAGE_CHANGE`/`ADD_PATH` 等真实 UI matter 映射到 `update_preferences`/`get_preferences`（非仅测试文件引用）。

**⚠️ 未验证（静态代码分析范围之外）**：未实际运行 app 手动触发 preference 变更；未确认磁盘写入端到端生效需人工：改主题/语言/缩略图尺寸 → 确认磁盘文件更新 + Renderer store 同步。

## 🔴 2026-07-18 复核发现：生产环境工作流打包缺失（真实 bug，非文档滞后）

**完整链路已 trace 确认（非仅 grep 命中）**：

1. `updateTheme()`（`ThemeSettings.vue` 等真实 UI 组件）→ Zouzhe → `update_preferences.zouwu` workflow
2. workflow 内部：`validate` → `sanitize`（产出 `ui.theme` 等字段）→ `updatePreferences`（Rust 落盘）→ `getCurrentSnapshot`（取回完整 `UserPreferences`）→ `formatResponse` 组装为 `{success, data: {updated, snapshot}}`
3. 前端 `extractSnapshotFromResponse` 用 `peelPreferenceSyncPayload` 剥出 `snapshot`，再按 `matter-sync.yml` 的 `propertyPath: "ui.theme"` 提取 → 写回 `preferences` store

**这条链路本身设计正确**——`preferences_adapter.rs::updatePreferences` 单独看响应里没有 `ui.theme`（只有 `{result:{revision}, success}`）看似是 bug，但那只是 workflow 中间一步；`format_response` 步骤才是真正吐给前端的最终响应，形状匹配。**之前一度怀疑此处是 bug，已排除。**

**真正的 bug**：`apps/photasa/src-tauri/tauri.conf.json:79` `"resources": []` —— **空数组，生产构建不打包任何 `workflows/` 文件**。

`resolve_workflows_dir()`（`services/tianshu.rs:280-298`）逻辑：

1. 先查 `resource_dir/workflows` 是否存在（生产路径）
2. 不存在则回退到**源码路径** `apps/desktop/src/main/engines/tianshu/workflows`（开发路径，硬编码相对路径找 monorepo 源码树）

生产安装包**没有 monorepo 源码树**，回退路径在生产环境下也不存在 → **`TianshuEngine` 在生产构建中加载不到任何 `.zouwu` workflow 文件** → 不只是 preference 功能，**所有依赖 Tianshu workflow 的功能在生产环境下全部失效**（scan queue、appState 同步、folder tree 等，凡是 `matter-sync.yml` 列出的 matter 全部涉及）。

RFC 0107 原文本身已经预见此风险（"Bundling workflows in production is a separate packaging concern; dev path already points to Electron workflows" / "tracked separately if needed"）——但从未真正开新 RFC 跟踪或修复。

**修复方向（未实施，留给专门 RFC）**：

- `tauri.conf.json` 的 `bundle.resources` 加入 workflow 目录，构建时把 `.zouwu` 文件拷进 `resource_dir/workflows`
- 或构建脚本把 workflow 文件复制到 `apps/photasa/src-tauri/resources/workflows/` 再声明为 resource

**验证证据**：`cargo test -p photasa tianshu` → 3 passed（仅覆盖数据结构/查找逻辑，不覆盖生产打包路径——包路径问题本质是构建期集成问题，非单测可捕获）。

---

## Implementation principle (Photasa / Tauri)

> **Rust rewrite, not TypeScript copy.** Policy: [ROADMAP.md](../../ROADMAP.md).

- Electron/Node code is a **behavioral specification** only—not a library for Photasa.
- Implement in `apps/photasa/src-tauri` and `crates/`; **do not** import `@photasa/scan`, `@photasa/import`, or other Node packages from Tauri.
- **1:1 parity** = same IPC/events/on-disk formats; **not** porting TypeScript source.

## Summary

Electron stores **application-level preferences** via the **Wenchang engine** and exposes them to the Renderer through Tianshu workflows (`get_preferences`, `update_preferences`, etc).  
Tauri currently mis-registers a folder-level `.photasa.json` adapter as `service: "wenchang"`, so preference workflows cannot execute.

This RFC introduces a **dedicated Rust workspace crate** for Wenchang preferences, plus a Tauri adapter named `wenchang` that provides the same workflow actions as Electron.

---

## Motivation / Problem

We need 1:1 parity for:

- **Storage location**: `~/.photasa/preferences/preferences.json`
- **Workflow surface**: `service: "wenchang"` actions used by preference workflows
- **UI sync**: `get_preferences` / `update_preferences` outputs must satisfy Renderer store automation (`matter-sync.yml` → `preferences` store)

Current Tauri state:

- `apps/photasa/src-tauri/src/adapters/config_adapter.rs` is named `"wenchang"` but only reads/writes per-folder `.photasa.json`.
- Preference workflows from Electron (`apps/desktop/src/main/engines/tianshu/workflows/preference/*.zouwu`) require Wenchang-specific actions (e.g. `validate`, `sanitize`, `updatePreferences`, `getHistory`, etc).

---

## Goals

1. **Correct responsibility split**
    - `.photasa.json` (folder-level) is no longer implemented under adapter name `"wenchang"`.
    - `"wenchang"` is reserved for application-level preferences.

2. **Dedicated crate**
    - Implement preferences persistence in a new Rust workspace crate under `crates/`.
    - Keep Tauri adapter as a thin boundary layer.

3. **Workflow parity**
    - Implement the minimal action surface needed by Electron preference workflows:
        - `getCurrentSnapshot`
        - `updatePreferences`
        - `resetToDefaults`
        - `exportPreferences`
        - `importPreferences`
        - `getHistory`
        - `restoreRevision`
        - `validate`
        - `sanitize`
        - `emitEvent`
        - `formatResponse`

---

## Non-goals

- Re-implementing all Electron-side UI flows for preference export/import dialogs.
- Adding YAML/TOML preferences formats. Storage is JSON to match Electron.

---

## Detailed design

### Storage layout

Default directory:

```
~/.photasa/preferences/
  preferences.json
  history.json
  revisions/
    00000001.json
    00000002.json
    ...
```

### Data model

Align with `packages/@photasa/wenchang/src/types/index.ts`:

- `UserPreferences` includes `revision` and `lastModified`
- `PreferenceDelta` is a partial update object `{ ui?, display?, scanning?, performance? }`

### Tauri adapter registration

- `ConfigAdapter` renamed to `"config"` (folder-level `.photasa.json`).
- New `PreferencesAdapter` uses `"wenchang"` and connects to the new crate.

### Workflow directory

Tauri dev mode uses Electron workflows at:

`apps/desktop/src/main/engines/tianshu/workflows`

Production builds must bundle `workflows/` into `resource_dir/workflows` (tracked separately if needed).

---

## Testing strategy

- Rust unit tests in the new crate:
    - default initialization (no file) → defaults written
    - apply delta → revision increments, deep merge works, `preferences.json` persists
    - history + revisions files updated
    - restoreRevision loads previous snapshot
- Tauri compile proof:
    - `cargo test -p wenchang-preferences`
    - `cargo build -p photasa`
- Optional manual validation:
    - Renderer triggers `get_preferences` and sees preferences store replaced via `matter-sync.yml`
    - Update theme/language/thumbnailSize triggers `update_preferences` and persists to `~/.photasa/preferences/preferences.json`

---

## Risks

- If workflow action shapes differ, store automation may not sync; mitigate by matching Electron workflow expectations precisely.
- Bundling workflows in production is a separate packaging concern; dev path already points to Electron workflows.

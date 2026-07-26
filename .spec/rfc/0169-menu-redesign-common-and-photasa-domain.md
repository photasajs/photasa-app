# RFC 0169 – 菜单重设计：通用菜单 + Photasa 领域菜单

## Implementation principle (Photasa / Tauri)

> **Rust rewrite, not TypeScript copy.** Policy: [ROADMAP.md](../../ROADMAP.md).

**Status**: 🟢 Approved（用户已确认全部改动清单，待实施）
**Created**: 2026-07-25
**Area**: Tauri / macOS System Menu / UI
**Related**: RFC 0058（菜单管理统一到 qizou 流程）、RFC 0092（Tauri v2 Menu API 系统菜单）、RFC 0149/0150（shell + menu 直连例外）

---

## Problem

现状审查发现菜单设计存在多处结构性缺口：

1. **`window-maximize`/`window-close` 点击后无实际反应**——`zhangsunwuji.ts::handleMenuAction` 落到"其他菜单项：根据 key 分发"分支，只 `logger.warn` 占位，从未实现。
2. **`role_to_predefined`（`menu.rs`）里 `"close"` 被错误映射到 `PredefinedMenuItem::quit`**——如果 `window-close` 未来被赋予 `role: "close"`，点击会退出整个 App 而非关闭窗口，这是潜伏的正确性 bug（当前未触发是因为 `window-close` 目前没有 `role`，走的是无 role 分支，但该分支同样没实现）。
3. **`UPDATE_MENU`/`OPEN_EXTERNAL`/`OPEN_IN_FINDER` 三个 zouzhe matter 绕过标准 Zouzhe → 房玄龄 → 天枢工作流链路，在 `yuantiangang.ts::executeZhaoling` 内直连 `invoke`**（注释自称"RFC 0149/0150"），但从未有明文规则定义"什么场景允许直连"，只是既成事实。
4. **菜单每次更新都全量重建**——`setMenuDisabled`（单个菜单项禁用状态切换）目前发送整个 `menus` 数组给 `apply_system_menu`，导致 `Menu::new` 从零重建整棵菜单树，粒度过粗。
5. **`Edit` 菜单完全缺失**——`menu.rs::role_to_predefined` 已经实现了 `cut/copy/paste/undo/redo/selectAll` 到 `PredefinedMenuItem` 的映射，但 `menu-data.ts::SystemMenus` 没有任何菜单项引用它们，是死代码分支。
6. **Photasa 作为 photo management 应用，菜单栏没有任何领域相关操作入口**——Import Photos、Add Library Folder、Scan Queue 只能通过应用内 UI 按钮触发（`App.vue` 的 `handleOpenImportPhotos`/`chooseDirectories`+`chuSuiLiang.addPath`/`handleOpenScanList`），OS 菜单栏完全没有暴露，不符合桌面应用惯例（对比 macOS Photos.app 的 `File → Import`）。

## 排查结论：Report Issue 功能状态

**已确认端到端正常工作，本次不改动**：

- 菜单 `help-report-issue`（无 role）→ `handleMenuAction` 显式分支 → `openReportIssueDialog()`（`services/report-issue-dialog.ts`）
- App.vue `onMounted` 时 `registerReportIssueDialogOpener(handleOpenReportIssue)` 注册开启函数，`onUnmounted` 时 `clearReportIssueDialogOpener()` 清理
- 打开 `ReportIssueDialog.vue` → 提交调用 `api/report-issue.ts::submitReportIssue` → POST 到 `PHOTASA_ME_ISSUES_URL`，携带 `platform`/`locale`/`appVersion` 元数据 → 返回 GitHub issue number + htmlUrl

这条链路是当前菜单系统里**唯一**完整实现了"非 role、非 url"分支的功能，本次新增的 File/Edit/Window 处理沿用同一模式（`handleMenuAction` 显式 key 分支）。

## 设计：菜单结构拆分为「通用」与「Photasa 领域」两类

### A. 通用菜单（标准桌面应用惯例，全部 role，零业务逻辑）

| 菜单                | 说明                                                                                                               |
| ------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `app`（macOS only） | About / **Preferences…（新增，Cmd+,）** / Services / Hide / Hide Others / Unhide / Quit                            |
| `edit`（**新增**）  | Cut / Copy / Paste / Select All / Undo / Redo —— 全部 `role`，激活 `role_to_predefined` 中已实现但从未被引用的映射 |
| `view`              | Reload / Force Reload / Toggle DevTools / Reset-In-Out Zoom / Toggle Fullscreen —— 不变                            |
| `window`            | Minimize / Maximize / Close —— **本次修复 Close 的 role 错误映射，Maximize/Close 补齐实际处理**                    |
| `help`              | Learn More / Report Issue / About —— 不变                                                                          |

### B. Photasa 领域菜单（photo management 专属操作，全部复用现有 handler，零新业务逻辑）

参照 macOS 惯例（Photos.app 用 `File → Import`），新增 `File` 菜单而非独立的 `Photo` 菜单：

| Key               | 动作               | 快捷键      | 复用的现有实现                                                                                          |
| ----------------- | ------------------ | ----------- | ------------------------------------------------------------------------------------------------------- |
| `file-import`     | Import Photos      | Cmd+I       | `App.vue::handleOpenImportPhotos`（已实现，弹出 `ImportPhotos.vue` 向导）                               |
| `file-add-folder` | Add Library Folder | Cmd+Shift+O | `zhangSunWuJi.chooseDirectories(false)` + `chuSuiLiang.addPath`（`initializeApp` 中已有的添加路径逻辑） |
| `file-scan-queue` | Scan Queue         | 无          | `App.vue::handleOpenScanList`（已实现，弹出扫描队列面板）                                               |

`File` 菜单在 `Edit` 之前、`View` 之后按 macOS 惯例排列（`App / File / Edit / View / Window / Help`）。

## Zouzhe 直连例外规则（明文化）

**规则**：凡满足以下全部条件的 matter，允许在 `yuantiangang.ts::executeZhaoling` 内集中直连 `invoke`，不经过标准 Zouzhe → 房玄龄 → 天枢工作流链路：

1. 不需要持久化（不写 Store、不写 `~/.photasa/` 配置）
2. 不需要跨部门协调（不触发多个服务的连锁反应）
3. 是一次性 side effect（打开外部链接、显示文件、应用菜单变更、控制窗口状态）

现有 `UPDATE_MENU`/`OPEN_EXTERNAL`/`OPEN_IN_FINDER` 符合规则，追加 `WINDOW_MAXIMIZE`/`WINDOW_CLOSE`（新 matter，见下方 IPC 设计）到同一分类，全部集中在 `yuantiangang.ts` 第 1031 行附近的同一个 if 块，不新开分支入口。`ZOUZHE_MATTERS` 常量定义处（`fang-xuan-ling.interface.ts`）统一加注释标注「直连例外」。

## 增量菜单更新（替代全量重建）

- `menu.rs` 新增 `MenuState { menu: Mutex<Option<Menu<Wry>>> }`，在 `apply_system_menu` 首次构建后缓存 `Menu` 句柄到 Tauri managed state。
- 新增 Tauri command `update_menu_item(app, key: String, disabled: Option<bool>, label: Option<String>)`：在缓存的 `Menu` 句柄上按 id 查找 `MenuItem`（需要递归遍历 submenu，因为 Tauri Menu API 没有全局按 id 查找），调用其 `set_enabled`/`set_text`，不重建整棵树。
- `setMenuDisabled`（前端 `zhangsunwuji.ts`）：content 从 `{ menus: 全量数组 }` 改为 `{ key, disabled }`；对应 `yuantiangang.ts` 分支 invoke 改为调用 `update_menu_item` 而非 `apply_system_menu`。
- `refreshMenus`（语言切换，所有 label 同时变化）：语义上确实是全量替换，**保留**调用 `apply_system_menu` 全量重建，不改。

## Window 控制的具体实现

- `role_to_predefined` 修复：`"close"` 从 `"quit" | "close"` 分支中拆出，单独返回 `None`（不再映射到 `PredefinedMenuItem::quit`）。
- `window-maximize`/`window-close` 保持无 `role`（因为 maximize 需要 toggle 状态判断，close 没有对应 predefined item），继续走 `handleMenuAction` 显式 key 分支。
- 新增两个直连 matter：`WINDOW_MAXIMIZE_TOGGLE`、`WINDOW_CLOSE`，在 `yuantiangang.ts` 内 invoke 已存在的 Tauri command：
    - `window-close` → `invoke("close_window")`（`window.rs:54` 已实现）
    - `window-maximize` → 先 `invoke("is_maximized")`（`window.rs:60` 已实现）判断当前状态，再调用 `invoke("maximize_window")`（`window.rs:42`）或 `invoke("unmaximize_window")`（`window.rs:48`），实现 toggle 语义

无需新增 Rust 窗口控制命令，`window.rs` 里 `minimize_window`/`maximize_window`/`unmaximize_window`/`close_window`/`is_maximized` 均已实现，只是从未被菜单点击触达。

## 改动清单

**Rust**

1. `menu.rs::role_to_predefined`：拆分 `close`/`quit` 映射
2. `menu.rs`：新增 `MenuState` + `update_menu_item` command，`main.rs` 注册新 command 与新 managed state

**menu-data.ts** 3. 新增 `edit` 菜单（cut/copy/paste/undo/redo/selectAll，全 role）4. 新增 `file` 菜单（file-import Cmd+I / file-add-folder Cmd+Shift+O / file-scan-queue 无快捷键）5. `app` 菜单插入 `app.preferences`（Cmd+,，位置在 about 与 services 之间）6. 确认 `window-maximize`/`window-close` 保持无 role

**menu-keys.ts**：新增 `MENU_KEY_FILE_IMPORT`、`MENU_KEY_FILE_ADD_FOLDER`、`MENU_KEY_FILE_SCAN_QUEUE`、`MENU_KEY_APP_PREFERENCES`、`MENU_KEY_WINDOW_MAXIMIZE`、`MENU_KEY_WINDOW_CLOSE`

**zhangsunwuji.ts / App.vue** 7. `handleMenuAction` 补 6 个 key 分支，全部调用已存在函数/命令：

- `app.preferences` → `handleOpenPreference`（App.vue 已有）
- `file-import` → `handleOpenImportPhotos`（App.vue 已有）
- `file-add-folder` → `chooseDirectories` + `chuSuiLiang.addPath`（复用 `initializeApp` 逻辑）
- `file-scan-queue` → `handleOpenScanList`（App.vue 已有）
- `window-maximize` → 新增直连 matter，toggle maximize/unmaximize
- `window-close` → 新增直连 matter，`close_window`

8. `setMenuDisabled` 改造：content 从全量 `menus` 改为 `{ key, disabled }`，走新 `update_menu_item` command

**fang-xuan-ling.interface.ts** 9. `ZOUZHE_MATTERS` 新增 `WINDOW_MAXIMIZE_TOGGLE`、`WINDOW_CLOSE`，与 `UPDATE_MENU`/`OPEN_EXTERNAL`/`OPEN_IN_FINDER` 归入同一「直连例外」注释分类

## Non-goals

- 不改 Windows/Linux 菜单支持范围——`menu.rs` 继续保持仅 macOS 实现（`#[cfg(target_os = "macos")]`），维持现状，未来是否扩展平台是独立决策
- 不改 Report Issue 功能——已核实端到端正常工作
- 不新增业务逻辑——所有新 handler 只是把已存在的函数/命令接到菜单点击上
- `Photo`（单张照片操作，如旋转/删除/收藏）级别的领域菜单不在本次范围内——当前应用没有这类菜单驱动的单照片操作，需求出现时另开 RFC

## Acceptance

1. 点击 Window → Maximize：窗口在最大化/还原之间正确 toggle（验证 `is_maximized` 判断 + 对应 command 调用）
2. 点击 Window → Close：关闭当前窗口，不退出整个 App（验证 `role_to_predefined` 修复生效，且行为与 `role: "quit"` 明显不同）
3. 点击 Edit → Cut/Copy/Paste/Undo/Redo/Select All：在文本输入框内验证原生行为生效
4. 点击 File → Import Photos / Add Library Folder / Scan Queue：三个入口分别正确弹出对应已有 UI（导入向导 / 目录选择对话框 / 扫描队列面板）
5. 语言切换后 File/Edit/Window 新菜单项的 label 正确国际化（复用 `cloneMenus` 的 `t()` 翻译机制，无需额外适配）
6. `setMenuDisabled` 触发后，验证只有目标菜单项状态变化，不触发整个 `Menu` 树重建（可通过日志或 Rust 侧计数验证 `apply_system_menu` 调用次数不因 disabled 切换而增加）
7. 全部改动通过 `npx eslint`（前端）+ `cargo clippy --workspace --all-targets -- -D warnings`（Rust）零警告

## References

- `apps/photasa/src-tauri/src/commands/menu.rs`
- `apps/photasa/src-tauri/src/commands/window.rs`
- `apps/photasa/src/components/common/menu-data.ts`
- `apps/photasa/src/services/zhangsunwuji/zhangsunwuji.ts`
- `apps/photasa/src/services/yuantiangang/yuantiangang.ts`
- `apps/photasa/src/interfaces/fang-xuan-ling.interface.ts`
- `apps/photasa/src/constants/menu-keys.ts`
- `apps/photasa/src/App.vue`

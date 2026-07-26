# RFC 0170 – macOS 系统菜单 Help 子菜单空白（muda 0.17.1 上游问题）

## Implementation principle (Photasa / Tauri)

> **Rust rewrite, not TypeScript copy.** Policy: [ROADMAP.md](../../ROADMAP.md).

**Status**: ✅ Resolved（muda 0.17.2 修复特殊菜单注册；Photasa 启动 IPC 时序修复见 RFC 0171）
**Created**: 2026-07-25
**Updated**: 2026-07-26
**Area**: Tauri / macOS System Menu
**Related**: RFC 0169（菜单重设计）、RFC 0171（原生 Help 菜单）

---

## Problem

macOS 系统菜单栏的 `Help` 子菜单点开后完全空白（不含任何自定义项：Report Issue / Learn More / About，甚至不含 AppKit 自带的 Spotlight 搜索框）。同一套构建逻辑（`build_submenu`）对 `File`/`Edit`/`View`/`Window` 均正常渲染，只有 `Help` 异常。

## 排查过程（真实踩坑记录）

### 假设 1：`set_as_help_menu_for_nsapp()` 导致的显式注册冲突

`menu.rs` 曾包含 `configure_macos_special_submenus`，在 `set_menu` 之后显式调用 `submenu.set_as_help_menu_for_nsapp()`。移除该调用后，`Window` 子菜单恢复正常（其对应的 `set_as_windows_menu_for_nsapp()` 调用一并移除），但 **Help 依旧空白**。说明这不是唯一根因。

### 假设 2：AppKit 按标题文字 "Help" 自动接管（不需要显式注册）

追查到 Tauri 官方 Issue [tauri-apps/tauri#9371](https://github.com/tauri-apps/tauri/issues/9371)，贡献者 `pewsheen` 明确指出：

> Adding a menu named "Help" without setting it helpMenu will also add the spotlight box into it

即 macOS 会**按子菜单标题文字自动识别** Help 菜单并接管其内容，无论是否调用 `set_as_help_menu_for_nsapp`。据此尝试改用 `tauri::menu::HELP_SUBMENU_ID`（Tauri/muda 提供的官方 id 常量）注册 Help 子菜单，并配合 `main.rs` 调用 `enable_macos_default_menu(false)`（禁用 Tauri 自带默认菜单，避免其自带的空 Help 子菜单抢先注册到 `NSApp.helpMenu`）。

**结果：仍然空白。** 且额外引入了新问题（见下方"实施中的连带事故"）。

### 当时结论（后被 muda 0.17.2 与运行时证据修正）

继续查证时找到两个直接相关的上游 Issue；它们描述的是 `muda 0.17.1` 及更早版本的真实缺陷，后续已由 muda PR #335 修复：

1. **[tauri-apps/muda#263](https://github.com/tauri-apps/muda/issues/263)** ——`set_as_help_menu_for_nsapp` / `set_as_windows_menu_for_nsapp` 在 macOS 上均失效。维护者 `kasper9n` 在评论中确认：调用 `NSApplication::setHelpMenu` 后 `NSApplication::helpMenu()` 确实返回了菜单对象，但显示效果依旧不对，且尝试了三种变通方案均未成功（更早/更晚调用 `setHelpMenu`、调用 `NSMenu::setTitle`、改用原生 `NSMenuItem` 而非子类化）。**Issue 已关闭，无解决方案。**

2. **[tauri-apps/muda#301](https://github.com/tauri-apps/muda/issues/301)**（"Window and Help menu are not working on MacOS"）—— 报告者复现代码与本仓库场景**完全一致**：一个名为 `report-issue` 的自定义 `MenuItem` 放进 Help 子菜单，无法正常显示。报告中明确写道：

    > also does not work when setting with `tauri::menu::HELP_SUBMENU_ID`

    即官方 id 常量方案本身已被验证无效，与本次实测结果吻合。Tauri 维护者 `FabianLars` 将其标记为 muda#263 的重复问题关闭，**同样无解决方案**。

## 实施中的连带事故（记录以防复发）

尝试 `HELP_SUBMENU_ID` 方案时，在 `main.rs` 加入了 `builder.enable_macos_default_menu(false)`。该调用会让 Tauri **完全不设置任何启动期默认菜单**，而本应用的自定义菜单是异步构建的（前端 `onMounted` → zouzhe 往返 → `invoke("apply_system_menu")`）。一旦这次异步调用延迟或失败，应用在这段时间窗口内**没有任何菜单栏**（不止 Help 为空，而是整个菜单栏消失）。已确认移除该调用即可恢复（Tauri 默认菜单作为兜底，直到自定义菜单替换它）。

**教训**：`enable_macos_default_menu(false)` 只有在自定义菜单是**同步、启动期必然成功**构建时才安全使用；本应用的菜单构建路径是异步 IPC 往返，不满足这个前提，不应使用该开关。

## 根因最终确认与修复（2026-07-26）

`Cargo.lock` 确认 muda 已固定在 0.17.2（通过 `tauri` crate 传递依赖，无需改 `Cargo.toml`）。查证 muda 0.17.2 changelog：

> `372d367`（PR #335）Fix `Submenu::set_as_help_menu_for_nsapp` and `Submenu::set_as_windows_menu_for_nsapp` not working and macOS wouldn't recognize and add default menu items to them.

即 muda#263 / muda#301 描述的特殊菜单注册 bug 已在 0.17.2 修复。Photasa 需要：

- `menu.rs::submenu_native_id`：`help` 映射回 `HELP_SUBMENU_ID`；`window` 仍映射 `WINDOW_SUBMENU_ID`。
- `menu.rs::build_and_set_menu`：调用 `AppHandle::set_menu`；Tauri 2.10.3 的 `init_app_menu` 根据 `HELP_SUBMENU_ID` 取回 Help 子菜单并调用 `.set_as_help_menu_for_nsapp()`，应用代码无需重复注册。
- `main.rs`：`enable_macos_default_menu(false)` 保持移除状态（RFC 0170 记录的连带事故教训不变，与本次修复无关）。
- `App.vue`：`zhangSunWuJi.refreshMenus(t)` 必须位于主题、遥测、扫描等异步启动任务之前。

第二阶段“Search 存在、Report Issue 不存在”的应用根因不是 AppKit 标题覆盖，而是 `apply_system_menu` **根本没有执行**。诊断日志在两套 Rust workaround 中均未出现；把 `refreshMenus` 移到第一个无关 `await` 之前后，Rust 立即收到 6 组菜单及完整 Help 项：

```text
["app", "file", "edit", "view", "window", "help"]
["help-report-issue", "help-separator-1", "help-learn-more", "help-about"]
```

此前尝试的“非保留标题挂载”和“注册空 Help 后再 append”都修改了未执行路径，不能证明 AppKit 行为，已删除。最终保留标准 Tauri/muda 构建路径。用户实机确认 Search 与 Report Issue 同时显示。

## 应用内旁路方案（已实施，绕开系统菜单本身）

标题栏（`TitlebarMac.vue` / `TitlebarWinLinux.vue`）Report Issue 入口继续保留为二级入口。系统 Help 已恢复，不再依赖该旁路兜底。

## Non-goals

- 不为已修复的 `muda 0.17.1` 问题保留 Objective-C、改标题或二阶段 append workaround。
- 不在 RFC 0170 扩展 Help 产品条目；后续内容归 RFC 0171。

## References

- [tauri-apps/tauri#9371](https://github.com/tauri-apps/tauri/issues/9371) — Help Menu on MacOS is empty
- [tauri-apps/tauri#13605](https://github.com/tauri-apps/tauri/issues/13605) — Window and Help menu are not working on MacOS（含 `chrox` 的 workaround 补丁）
- [tauri-apps/muda#263](https://github.com/tauri-apps/muda/issues/263) — `set_as_help_menu_for_nsapp` and `set_as_windows_menu_for_nsapp` are broken on macOS
- [tauri-apps/muda#301](https://github.com/tauri-apps/muda/issues/301) — 与本仓库场景完全一致的复现报告
- [tauri-apps/muda#335](https://github.com/tauri-apps/muda/pull/335) — 0.17.2 特殊菜单注册修复
- `apps/photasa/src-tauri/src/commands/menu.rs`
- `apps/photasa/src-tauri/src/main.rs`
- `apps/photasa/src/services/report-issue-dialog.ts`
- `apps/photasa/src/components/TitlebarMac.vue`
- `apps/photasa/src/components/TitlebarWinLinux.vue`

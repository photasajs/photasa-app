# RFC 0170 – macOS 系统菜单 Help 子菜单空白（上游未修复问题）

## Implementation principle (Photasa / Tauri)

> **Rust rewrite, not TypeScript copy.** Policy: [ROADMAP.md](../../ROADMAP.md).

**Status**: 🟡 Mitigated（应用内已加旁路入口，系统菜单 Help 子菜单本身未修复，取决于上游）
**Created**: 2026-07-25
**Area**: Tauri / macOS System Menu
**Related**: RFC 0169（菜单重设计）

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

### 结论：确认为上游未修复的已知 bug，非本仓库代码问题

继续查证，找到两个直接相关的上游 Issue，均已关闭但**均未实际修复**：

1. **[tauri-apps/muda#263](https://github.com/tauri-apps/muda/issues/263)** ——`set_as_help_menu_for_nsapp` / `set_as_windows_menu_for_nsapp` 在 macOS 上均失效。维护者 `kasper9n` 在评论中确认：调用 `NSApplication::setHelpMenu` 后 `NSApplication::helpMenu()` 确实返回了菜单对象，但显示效果依旧不对，且尝试了三种变通方案均未成功（更早/更晚调用 `setHelpMenu`、调用 `NSMenu::setTitle`、改用原生 `NSMenuItem` 而非子类化）。**Issue 已关闭，无解决方案。**

2. **[tauri-apps/muda#301](https://github.com/tauri-apps/muda/issues/301)**（"Window and Help menu are not working on MacOS"）—— 报告者复现代码与本仓库场景**完全一致**：一个名为 `report-issue` 的自定义 `MenuItem` 放进 Help 子菜单，无法正常显示。报告中明确写道：

    > also does not work when setting with `tauri::menu::HELP_SUBMENU_ID`

    即官方 id 常量方案本身已被验证无效，与本次实测结果吻合。Tauri 维护者 `FabianLars` 将其标记为 muda#263 的重复问题关闭，**同样无解决方案**。

## 实施中的连带事故（记录以防复发）

尝试 `HELP_SUBMENU_ID` 方案时，在 `main.rs` 加入了 `builder.enable_macos_default_menu(false)`。该调用会让 Tauri **完全不设置任何启动期默认菜单**，而本应用的自定义菜单是异步构建的（前端 `onMounted` → zouzhe 往返 → `invoke("apply_system_menu")`）。一旦这次异步调用延迟或失败，应用在这段时间窗口内**没有任何菜单栏**（不止 Help 为空，而是整个菜单栏消失）。已确认移除该调用即可恢复（Tauri 默认菜单作为兜底，直到自定义菜单替换它）。

**教训**：`enable_macos_default_menu(false)` 只有在自定义菜单是**同步、启动期必然成功**构建时才安全使用；本应用的菜单构建路径是异步 IPC 往返，不满足这个前提，不应使用该开关。

## 当前代码状态

- `menu.rs::submenu_native_id`：`window` 仍映射到 `WINDOW_SUBMENU_ID`（已验证正常渲染：Minimize/Zoom/Close Window 均可见）；`help` 改回普通业务 key（`"help"`），不使用 `HELP_SUBMENU_ID`。
- `main.rs`：`enable_macos_default_menu(false)` 已移除，恢复 Tauri 默认菜单兜底。
- 净效果：Help 子菜单退回到与 File/Edit 一致的"普通子菜单"渲染路径——**这仍然可能空白**，因为假设 2（AppKit 按标题文字 "Help" 自动接管）不依赖 id，只依赖标题文字，尚未针对"普通子菜单 + 标题不叫 Help"的组合做实测验证。

## 应用内旁路方案（已实施，绕开系统菜单本身）

鉴于系统菜单 Help 子菜单的可靠性完全取决于未修复的上游 bug，在标题栏（`TitlebarMac.vue` / `TitlebarWinLinux.vue`）右上角图标区新增 Report Issue 入口（复用已有 `services/report-issue-dialog.ts::openReportIssueDialog`，与系统菜单走同一个对话框，同一套已验证工作正常的提交链路），作为不依赖系统菜单是否渲染成功的稳定入口。系统菜单 Help 子菜单本身保持现状（可能空白），不作为唯一入口。

## Non-goals

- 未修复上游 `muda`/AppKit 的 Help 菜单自动接管 bug——无法在应用层完全修复，需等待上游或改用更底层的 workaround（见下方候选方向）。
- 未验证"改变 Help 子菜单标题文字（不叫 'Help'）是否能绕过 AppKit 的自动识别"这一假设——本次未做该实验，留给下次排查。
- 未采用 `chrox` 在 tauri-apps/tauri#13605 评论中的 workaround（`set_menu` 后显式 `menu.remove()` 掉 AppKit 自动注入的 Help 项，再 `append` 全新子菜单）——该方案理论上可能绕过问题，但涉及在应用启动后对已生效的 `NSMenu` 做二次外科手术式修改，风险及维护成本较高，本次评估后未采用，留作候选方向。

## 候选后续方向（未实施，供下次决策）

1. **验证非 "Help" 标题文字是否绕开自动识别**——最小改动，风险低，但可能需要放弃"看起来像标准 macOS Help 菜单"这个视觉预期。
2. **`chrox` 的 remove+append workaround**——见上方 Non-goals，若方向 1 验证无效再考虑。
3. **完全放弃系统菜单 Help 子菜单**，只保留应用内标题栏按钮（本次已实施的旁路）作为唯一入口，系统菜单栏不再包含 Help 顶级菜单——最彻底但改变了菜单结构，需要重新走 RFC 0169 的用户确认流程。

## References

- [tauri-apps/tauri#9371](https://github.com/tauri-apps/tauri/issues/9371) — Help Menu on MacOS is empty
- [tauri-apps/tauri#13605](https://github.com/tauri-apps/tauri/issues/13605) — Window and Help menu are not working on MacOS（含 `chrox` 的 workaround 补丁）
- [tauri-apps/muda#263](https://github.com/tauri-apps/muda/issues/263) — `set_as_help_menu_for_nsapp` and `set_as_windows_menu_for_nsapp` are broken on macOS
- [tauri-apps/muda#301](https://github.com/tauri-apps/muda/issues/301) — 与本仓库场景完全一致的复现报告
- `apps/photasa/src-tauri/src/commands/menu.rs`
- `apps/photasa/src-tauri/src/main.rs`
- `apps/photasa/src/services/report-issue-dialog.ts`
- `apps/photasa/src/components/TitlebarMac.vue`
- `apps/photasa/src/components/TitlebarWinLinux.vue`

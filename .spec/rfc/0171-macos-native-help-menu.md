# RFC 0171 – macOS 原生 Help 菜单（Orca 级体验）

## Implementation principle (Photasa / Tauri)

> **Rust rewrite, not TypeScript copy.** Policy: [ROADMAP.md](../../ROADMAP.md).

**Status**: ✅ Implemented（muda 0.17.2 + HELP_SUBMENU_ID + 完整 Help 菜单项）
**Created**: 2026-07-25
**Updated**: 2026-07-26
**Area**: Tauri / macOS System Menu / Help
**Related**: RFC 0169（菜单重设计）、RFC 0170（Help 子菜单空白上游问题）、RFC 0152（标题栏拖拽契约）

---

## Problem

用户期望 macOS 系统菜单栏 **Help** 与原生桌面应用（参考 Orca）一致：

```
Help ▾
  🔍 Search                    ← AppKit 自带 Help 搜索框
  ─────────────────
  Report Issue…                ← 自定义项（Orca 为 Report Crash…）
  ─────────────────
  Explore Photasa              ← 产品主页 / 官网
  Getting Started with Photasa ← 入门文档
```

**当前 Photasa 实际表现**：

- `Cargo.lock` 固定 `muda 0.17.2`，用户截图确认 AppKit Search 恢复。
- `help` 使用 Tauri `HELP_SUBMENU_ID`；`AppHandle::set_menu` 内部完成 AppKit Help 注册。
- `Report Issue` 菜单数据、稳定 key、事件分发及现有 `ReportIssueDialog` 链路均已存在。
- 启动时 `refreshMenus` 曾位于无关主题异步初始化之后，导致 `apply_system_menu` 未执行；系统只显示默认 Search。
- 标题栏 Report Issue 图标（RFC 0170 旁路）继续保留为二级入口。

本 RFC 目标：在 **不破坏 RFC 0152 标题栏拖拽**、**不回归 RFC 0169 其余菜单** 的前提下，交付可用的 macOS Help 菜单。

---

## 目标 UX（Photasa 映射）

| 参考（Orca）              | Photasa 项                     | 行为                                                          | 快捷键 |
| ------------------------- | ------------------------------ | ------------------------------------------------------------- | ------ |
| Search                    | （系统提供，无独立 menu key）  | AppKit `NSHelpManager` 搜索；不自行实现搜索 UI                | —      |
| Report Crash…             | Report Issue…                  | `openReportIssueDialog()`（已有链路）                         | —      |
| —                         | separator                      | —                                                             | —      |
| Explore Orca              | Explore Photasa                | `OPEN_EXTERNAL` → `https://photasa.me`                        | —      |
| Getting Started with Orca | Getting Started with Photasa   | `OPEN_EXTERNAL` → `https://photasa.me/docs`（或最终文档 URL） | —      |
| —                         | About Photasa（可选，保留 F1） | 偏好设置 About 页 / 现有 `help-about`                         | F1     |

**Win/Linux**：不强制 AppKit Search 框；`TitlebarMenuBar` + `menu-data.ts` Help 子菜单保持扁平列表（Report Issue / Explore / Getting Started / About），与 macOS **条目语义一致**，不要求视觉 1:1。

**标题栏图标**：RFC 0170 旁路 **保留** 作为二级入口，不作为本 RFC 的删除项。

---

## 技术基线（继承 RFC 0170）

1. `muda 0.17.1` 的 macOS 特殊菜单注册存在上游 bug。
2. `muda 0.17.2` 已修复 `set_as_help_menu_for_nsapp` / `set_as_windows_menu_for_nsapp` 解析错误 `NSMenu` 实例的问题。
3. Tauri 2.10.3 的 `init_app_menu` 会查找 `HELP_SUBMENU_ID`，并自动调用 `set_as_help_menu_for_nsapp()`。
4. Photasa 通用 `build_submenu` 将业务 key `help` 映射为 `HELP_SUBMENU_ID`；不需要改标题、Objective-C 或二阶段 append。
5. `refreshMenus` 必须在主题、遥测、扫描等无关异步启动任务之前触发。
6. `enable_macos_default_menu(false)` 仍禁止使用：Photasa 菜单经异步 IPC 构建，禁用默认菜单会制造启动期整栏空窗。

结论：RFC 0171 以 **`muda 0.17.2 + HELP_SUBMENU_ID + AppHandle::set_menu + 启动 IPC 先于无关 await`** 为唯一实现基线。

## Root cause

问题分为两层：

1. `muda 0.17.1` 的 Help/Window 特殊菜单注册错误，导致 AppKit 默认项缺失；升级 0.17.2 后 Search 恢复。
2. Photasa 自定义项仍缺失，因为 `App.vue::onMounted` 在 `refreshMenus(t)` 前等待主题初始化。Rust `apply_system_menu` 入口诊断没有任何输出，证明两套 Rust workaround 修改的是未执行路径。

将 `refreshMenus(t)` 移到 `onMounted` 首段后，Rust 收到 6 个顶层菜单和完整 Help 项，标准 `set_menu` 路径直接生效。用户实机确认 Report Issue 可见。

---

## 方案对比

### 方案 A：沿用通用菜单数据和 Tauri 原生注册（采用）

**原理**：前端菜单数据提供 Report Issue 等业务项；启动时立即发送菜单 IPC；Rust 通用构建器使用 `HELP_SUBMENU_ID` 创建 Help；Tauri 在 `set_menu` 时完成 AppKit 注册。

**风险**：未来升级 Tauri/muda 时可能回归，需锁定版本并保留契约测试。

**收益**：无重复菜单树、无 Objective-C 私有装配、保留现有 i18n 和 Win/Linux 语义。

### 方案 B：Rust 独占 Help 菜单结构（拒绝）

**原理**：Rust 直接创建 Help 和全部业务项，再向前端发送点击事件。

**风险**：与 `menu-data.ts` 形成双份数据源；国际化刷新和跨平台菜单容易分叉。

**收益**：启动期构建更早，但当前问题已由 muda 0.17.2 解决，没有足够收益。

### 方案 C：Objective-C `remove + append` workaround（废弃）

仅适用于上游未修复版本。`muda 0.17.2` 已消除根因，继续保留此方案只会增加 AppKit/Tauri 升级耦合。

---

## 实施计划

### Phase 0 — 上游基线（完成）

- [x] `Cargo.lock` 固定 `muda 0.17.2`。
- [x] `help` 映射为 `HELP_SUBMENU_ID`。
- [x] 用户实机确认 AppKit Search 恢复。
- [x] 禁止恢复 `enable_macos_default_menu(false)`。
- [x] 截图确认 0.17.2 恢复 AppKit Search。

### Phase 1 — Report Issue（完成）

- [x] `menu-data.ts`：Help 首项使用 `help-report-issue`。
- [x] `menu-keys.ts`：定义稳定常量 `MENU_KEY_HELP_REPORT_ISSUE`。
- [x] `zhangsunwuji.ts::handleMenuAction`：调用 `openReportIssueDialog()`。
- [x] `App.vue`：注册现有 `ReportIssueDialog` opener。
- [x] `menu.rs`：使用标准 `HELP_SUBMENU_ID` + `AppHandle::set_menu`。
- [x] `App.vue`：菜单 IPC 移到首个无关 `await` 之前。
- [x] 删除非保留标题和二阶段 append 两套无证据 workaround。
- [x] 自动化覆盖菜单数据、IPC key、动作分发、对话框 opener。
- [x] macOS 实机确认 Help 同时显示 Search 与 Report Issue。

### Phase 2 — Explore / Getting Started（完成）

- [x] 菜单 key 常量：`help-explore-photasa`、`help-getting-started`。
- [x] `menu-data.ts`：补齐 Explore、Getting Started 和最终 URL。
- [x] i18n：补齐菜单文案；Report Issue 标签统一为带省略号「…」。
- [x] Win/Linux `TitlebarMenuBar` 语义对齐（共享 `menu-data.ts`）。

---

## 文件触点（预期）

| 文件                                                     | 变更                          |
| -------------------------------------------------------- | ----------------------------- |
| `Cargo.lock`                                             | 固定 `muda 0.17.2`            |
| `apps/photasa/src-tauri/src/commands/menu.rs`            | 标准 `HELP_SUBMENU_ID` 注册   |
| `apps/photasa/src/App.vue`                               | 菜单 IPC 先于无关异步启动任务 |
| `apps/photasa/src/components/common/menu-data.ts`        | Help 项结构                   |
| `apps/photasa/src/constants/menu-keys.ts`                | 新 key                        |
| `apps/photasa/src/services/zhangsunwuji/zhangsunwuji.ts` | 新 action                     |
| `apps/photasa/src/locales/*.json`                        | 文案                          |
| `apps/photasa/src/components/titlebar-platform.guard.ts` | `muda 0.17.2` 原生 Help 契约  |

**不改动**：`TitlebarMac.vue` 拖拽层结构（RFC 0152）；不在 macOS 标题栏内嵌 `TitlebarMenuBar`。

---

## Acceptance

### macOS（必须）

1. 点击菜单栏 **Help**，子菜单顶部出现 **Search** 输入框（与 Orca 截图同类）。
2. Search 下方可见 **Report Issue…**，点击打开现有 `ReportIssueDialog` 并成功提交。
3. 可见 **Explore Photasa**、**Getting Started with Photasa**，分别打开正确 HTTPS URL。
4. File / Edit / Window 菜单无回归；标题栏空白区域可拖拽窗口（RFC 0152）。
5. 冷启动后 3 秒内 Help 可用（无不菜单栏空窗期）。

**2026-07-26 验收**：用户实机确认 Search 与 Report Issue 同时可见；Explore / Getting Started / About 菜单项与 Orca 结构对齐；Phase 1–2 通过。

### Win/Linux（应该）

1. Help 子菜单含相同业务项（可无 Search）。
2. 标题栏 Report Issue 图标仍可用。

### 自动化

```bash
pnpm --filter @photasa/photasa run test:regression:titlebar
cargo test -p photasa menu::
pnpm --filter @photasa/photasa run test:unit -- src/services/zhangsunwuji
```

---

## Non-goals

- 不自建 Help 全文搜索引擎（使用 AppKit Search 或文档站搜索）。
- 不再实现仅供 `muda 0.17.1` 使用的 AppKit `remove + append` workaround。
- 不在本 RFC 内重做 RFC 0169 全量菜单设计。

---

## References

- 用户参考截图：Orca Help 菜单（Search + Report Crash + Explore + Getting Started）
- [RFC 0170](./0170-macos-help-menu-empty-upstream-bug.md)
- [RFC 0169](./0169-menu-redesign-common-and-photasa-domain.md)
- [tauri-apps/tauri#9371](https://github.com/tauri-apps/tauri/issues/9371)
- [tauri-apps/tauri#13605](https://github.com/tauri-apps/tauri/issues/13605)
- [tauri-apps/muda#263](https://github.com/tauri-apps/muda/issues/263)
- [tauri-apps/muda#335](https://github.com/tauri-apps/muda/pull/335)
- `apps/photasa/src-tauri/src/commands/menu.rs`
- `apps/photasa/src/components/common/menu-data.ts`

# RFC 0171 – macOS 原生 Help 菜单（Orca 级体验）

## Implementation principle (Photasa / Tauri)

> **Rust rewrite, not TypeScript copy.** Policy: [ROADMAP.md](../../ROADMAP.md).

**Status**: ⏳ Draft（待 spike + 实现）
**Created**: 2026-07-25
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

**当前 Photasa 实际表现**（RFC 0170 已记录）：

- Help 顶级菜单存在，但点开后**子菜单空白**（无 Search、无 Report Issue、无 Learn More、无 About）。
- File / Edit / View / Window 同级菜单均正常；仅 Help 异常。
- 标题栏 Report Issue 图标（RFC 0170 旁路）可用，但**不能替代**用户预期的系统 Help 菜单体验。

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

## 根因摘要（继承 RFC 0170，不重复长篇排查）

1. **AppKit 对标题为 "Help" 的子菜单有特殊处理**（自动注入 Search、可能清空/覆盖 muda 构建的自定义项）— [tauri#9371](https://github.com/tauri-apps/tauri/issues/9371)。
2. **`HELP_SUBMENU_ID` / `set_as_help_menu_for_nsapp()` 在 muda 层已知失效** — [muda#263](https://github.com/tauri-apps/muda/issues/263)、[muda#301](https://github.com/tauri-apps/muda/issues/301)。
3. **Photasa 菜单异步构建**（`onMounted` → zouzhe → `apply_system_menu`）与 `enable_macos_default_menu(false)` 不兼容；禁用默认菜单会导致启动窗口期**整栏菜单消失**。
4. **通用 `build_submenu` 路径**对 Help 与 File 无差别处理，未针对 AppKit Help 语义做专用构建。

结论：**不能**继续在通用子菜单构建器上微调 id/role 期望 magically 出现 Orca 式 Help；需要 **专用 macOS Help 构建路径**（Rust 侧）。

---

## 方案对比

### 方案 A：专用 Rust `build_macos_help_menu` + AppKit 二次装配（推荐）

**原理**：`apply_system_menu` 在 macOS 上对 `key == "help"` 走独立函数；其余菜单仍用现有 `build_submenu`。构建完成后，通过 `objc2` / `cocoa`（或 Tauri 已暴露的 raw menu handle）执行 **chrox workaround**（[tauri#13605](https://github.com/tauri-apps/tauri/issues/13605) 评论）：`set_menu` 后定位 Help 项 → `remove` AppKit 注入的空壳 → `append` 含自定义 `NSMenuItem` 的完整子菜单 → `NSApp.setHelpMenu`。

**步骤**：

1. `menu.rs` 新增 `#[cfg(target_os = "macos")] fn build_and_attach_help_menu(...)`。
2. Help 子菜单项顺序：Report Issue → separator → Explore → Getting Started → （可选 About）。
3. Search 框：**不手动添加**；依赖正确注册 `NSApp.helpMenu` 后由 AppKit 注入（与 Orca 一致）。
4. 菜单事件仍走现有 Tauri `on_menu_event` + 前端 `handleMenuAction`（key 不变）。
5. 新增 Rust 集成测试（macOS CI 或 `#[cfg(test)]` 仅断言构建不 panic）；Vitest 保留 `help-report-issue` 在 `menu-data.ts` 的契约断言。

**风险**：objc 代码与 Tauri 版本升级耦合；需严格 `#[cfg(target_os = "macos")]` 隔离。

**收益**：最接近用户截图；Search + 自定义项可同时存在。

### 方案 B：同步默认 Help 壳 + 异步填充项

**原理**：在 `main.rs` `setup` 钩子中 **同步** 注册最小 Help 子菜单（仅 Report Issue），保证 `NSApp.helpMenu` 尽早有效；前端 `apply_system_menu` 后续 **增量** `update_menu_item` / 专用 `patch_help_menu` 追加 Explore / Getting Started，避免整树重建。

**风险**：仍可能与 AppKit 自动 Help 合并冲突；两阶段时序难测；若填充失败用户看到残缺 Help。

**收益**：改动面小于方案 A 的 objc 手术；可快速 spike。

### 方案 C：放弃系统 Help 标题，改用「Support」顶级菜单

**原理**：`menu-data.ts` 将 `label` 改为非 `"Help"` 字符串（如 `Support`），绕开 AppKit Help 识别。

**风险**：**失去** Orca 式 Search 框；不符合用户明确期望；与 macOS HIG 不一致。

**收益**：实现最简单；RFC 0170 候选 #1。

**结论**：仅作 fallback，**不推荐**作为终态。

### 推荐

**方案 A 为主，方案 B 作为 spike 验证时序**；方案 C 仅在 A/B 均失败时由产品决策启用。

---

## 实施计划

### Phase 0 — Spike（1–2 天）

- [ ] 最小 Tauri macOS 分支：仅 Help 菜单 + Report Issue 一项，验证 Search 框是否出现。
- [ ] 验证 chrox `remove` + `append` 在 Photasa `apply_system_menu` 之后是否稳定。
- [ ] 记录失败日志到 RFC 0170「候选方向」交叉链接。

### Phase 1 — Rust Help 专用构建（核心）

- [ ] `menu.rs`：`apply_system_menu` 分支 `help` → `build_macos_help_menu`。
- [ ] 禁止对 Help 使用 `HELP_SUBMENU_ID`（RFC 0170 + titlebar guard 已固化）。
- [ ] 菜单 key 常量：`help-explore-photasa`、`help-getting-started`（`menu-keys.ts` + `menu-data.ts`）。
- [ ] `zhangsunwuji.ts::handleMenuAction`：`help-getting-started` → `OPEN_EXTERNAL`。
- [ ] i18n：14 locale 增加 `menu.help.explorePhotasa`、`menu.help.gettingStarted`；Report Issue 标签统一为带省略号「…」。

### Phase 2 — 契约与防回归

- [ ] 更新 `titlebar-platform.guard.ts`：断言存在 `build_macos_help_menu`（或等价符号），且 **禁止** 恢复 `enable_macos_default_menu(false)`。
- [ ] `menu.rs` 单元测试：Help payload 含新 key。
- [ ] macOS 手测清单（见 Acceptance）。

### Phase 3 — Win/Linux 对齐（非阻塞 macOS）

- [ ] `menu-data.ts` Help 项与 macOS 语义对齐（无 Search）。
- [ ] `TitlebarMenuBar` 手测 Help 下拉。

---

## 文件触点（预期）

| 文件                                                     | 变更                                                      |
| -------------------------------------------------------- | --------------------------------------------------------- |
| `apps/photasa/src-tauri/src/commands/menu.rs`            | 专用 Help 构建 + AppKit attach                            |
| `apps/photasa/src-tauri/Cargo.toml`                      | 若需 `objc2-app-kit` 等（评估 Tauri 内置 re-export 优先） |
| `apps/photasa/src/components/common/menu-data.ts`        | Help 项结构                                               |
| `apps/photasa/src/constants/menu-keys.ts`                | 新 key                                                    |
| `apps/photasa/src/services/zhangsunwuji/zhangsunwuji.ts` | 新 action                                                 |
| `apps/photasa/src/locales/*.json`                        | 文案                                                      |
| `apps/photasa/src/components/titlebar-platform.guard.ts` | Help 契约更新                                             |

**不改动**：`TitlebarMac.vue` 拖拽层结构（RFC 0152）；不在 macOS 标题栏内嵌 `TitlebarMenuBar`。

---

## Acceptance

### macOS（必须）

1. 点击菜单栏 **Help**，子菜单顶部出现 **Search** 输入框（与 Orca 截图同类）。
2. Search 下方可见 **Report Issue…**，点击打开现有 `ReportIssueDialog` 并成功提交。
3. 可见 **Explore Photasa**、**Getting Started with Photasa**，分别打开正确 HTTPS URL。
4. File / Edit / Window 菜单无回归；标题栏空白区域可拖拽窗口（RFC 0152）。
5. 冷启动后 3 秒内 Help 可用（无不菜单栏空窗期）。

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
- 不修复 muda 上游根本 bug（可向 tauri-apps 提交最小复现）。
- 不在本 RFC 内重做 RFC 0169 全量菜单设计。

---

## References

- 用户参考截图：Orca Help 菜单（Search + Report Crash + Explore + Getting Started）
- [RFC 0170](./0170-macos-help-menu-empty-upstream-bug.md)
- [RFC 0169](./0169-menu-redesign-common-and-photasa-domain.md)
- [tauri-apps/tauri#9371](https://github.com/tauri-apps/tauri/issues/9371)
- [tauri-apps/tauri#13605](https://github.com/tauri-apps/tauri/issues/13605)
- [tauri-apps/muda#263](https://github.com/tauri-apps/muda/issues/263)
- `apps/photasa/src-tauri/src/commands/menu.rs`
- `apps/photasa/src/components/common/menu-data.ts`

# RFC 0150: shell / menu 域退出 zouwu（贞观直连 Rust）

- **Start Date**: 2026-07-21
- **Status**: ✅ Implemented（2026-07-21）
- **Priority**: P2
- **Area**: Photasa / Tauri / 贞观 / zouwu 退场
- **Parent tracker**: [0149](./0149-tauri-ui-adapter-post-closure.md) ✅
- **Depends on**: [0139](./0139-tauri-zouwu-retirement-plan.md)、[0140](./0140-tauri-zouwu-adapter-to-command-migration.md)、[0137](./0137-tauri-zhenguan-direct-ipc-migration.md)

## Summary

[RFC 0149](./0149-tauri-ui-adapter-post-closure.md) 核实：**shell** 与 **menu** 在 Tauri 侧仍经 zouwu workflow + `TaibaijinxingAdapter`，未像 scan/preference/folder-tree 一样由袁天罡 `executeZhaoling` 直连 `invoke`。

本 RFC 将 **open external / open in finder / apply system menu** 迁出 zouwu，与 0147 preference、0145 folder-tree 模式一致。

## 现状（2026-07-21 读源码）

| 能力        | contract reference `.zouwu`        | Photasa 路径                                                        | Rust 实现                        |
| ----------- | ---------------------------------- | ------------------------------------------------------------------- | -------------------------------- |
| 打开外链    | `shell/shell_open_external.zouwu`  | `intent.ts` → `shell_openExternal` → zouwu → `TaibaijinxingAdapter` | adapter 内 `ShellExt::open`      |
| Finder 显示 | `shell/shell_open_in_finder.zouwu` | `intent.ts` → `shell_openInFinder` → zouwu → `TaibaijinxingAdapter` | adapter 内 `reveal_item_in_dir`  |
| 应用菜单    | `menu/menu_apply.zouwu`            | `intent.ts` → `menu_apply` → zouwu → `TaibaijinxingAdapter`         | `commands/menu.rs` `apply_menus` |

**已就绪、可复用：**

- `apps/photasa/src-tauri/src/adapters/taibaijinxing_adapter.rs` — 真实逻辑已在 Rust
- `apps/photasa/src-tauri/src/commands/menu.rs` — `apply_system_menu` command 已存在（`legacy-api` 亦调用）
- `engine_status` — 已由 `commands/engine_status.rs` 原生 emit，**不依赖** `engine/engine_status_check.zouwu`（R5 可标无 zouwu 运行时依赖）

## 目标架构

```text
长孙无忌 / 百姓 qizou
→ 李世民 routing
→ 袁天罡 executeZhaoling（新增 shell/menu command 分支，不经 tianshuAdapter.processCommand）
→ invoke("open_external" | "open_in_finder" | "apply_system_menu")
```

菜单点击 **上报** 已在 0149 切片 1 改为袁天罡直连 `listen("picasa:menu-action")`；本 RFC 覆盖 **下发**（apply menu）与 **shell 动作**。

## 实施步骤

1. 在 `tauri-command-names.ts` 增加 `SHELL_COMMANDS` / `MENU_COMMANDS` 常量。
2. `yuantiangang.ts::executeZhaoling` 拦截 `OPEN_EXTERNAL`、`OPEN_IN_FINDER`、`UPDATE_MENU`（及现有 zouwu intent 等价 matter），直接 `invoke`。
3. 从 `intent.ts` 移除 `shell_openExternal`、`shell_openInFinder`、`menu_apply` 映射。
4. Rust：将 `TaibaijinxingAdapter` 逻辑提取为 `#[tauri::command]`（或复用现有 `apply_system_menu` + 新增 open 命令），adapter 可删或留空壳至 0139 收尾。
5. Vitest：`yuantiangang-ipc.test.ts` 覆盖三条 invoke 路径。
6. 确认无 workflow 加载失败时 shell/menu 仍可用（降低对 `resolve_workflows_dir` 的硬依赖）。

## 验收

- [x] `OPEN_IN_FINDER` / `OPEN_EXTERNAL` / `UPDATE_MENU` 零 `tianshuAdapter.processCommand` 调用
- [x] `intent.ts` 无 shell/menu zouwu intent
- [x] `yuantiangang-ipc.test.ts` 覆盖三条 invoke 路径
- [x] 0149 R3、R4 可勾选完成

## 非目标

- 删除整个 `TianshuService` / 全部 `.zouwu`（属 0139 总排期）
- 改动 The removed desktop tree

# RFC 0139: zouwu/Tianshu workflow 引擎在 Tauri 侧逐域退场计划

- **Start Date**: 2026-07-19
- **Status**: ✅ Implemented（2026-07-21）— 全部生产域已退出 zouwu；`zouwu-core` crate 移除另开 RFC
- **Priority**: P2
- **Area**: Photasa / Tauri / Tianshu / zouwu
- **Depends on**: [0138](./0138-tauri-photasa-config-crate.md)（第一个退场域，已完成，验证退场模式可行）
- **迁移模式**: [0140](./0140-tauri-zouwu-adapter-to-command-migration.md)
- **Path**: `.spec/rfc/completed/0139-tauri-zouwu-retirement-plan.md`

## Decision

zouwu（`zouwu-core`/`zouwu-builtin`，contract reference `TaiyiEngine`/`.zouwu` workflow 的 Rust 移植）在 Tauri 架构下不再有存在理由，逐域退场，改为 Tauri `#[tauri::command]` 直调 + 具体 crate。**Adapter 层本身与 zouwu 一并退场**。

**2026-07-21 结论**：贞观全部生产 matter 已由袁天罡 `executeZhaoling` 直连 invoke；`IntentToFuluMapping` 空表。`TianshuService` / `zouwu-core` 仍驻留代码库但**无生产流量**，crate /workspace 移除需另开 RFC。

## 域退场终表（源码核实 2026-07-21）

| 域            | `.zouwu` 文件      | Tauri 退场 RFC | 状态                                                  |
| ------------- | ------------------ | -------------- | ----------------------------------------------------- |
| config        | 0（仅 adapter）    | 0138 / 0142    | ✅ `photasa-config` + 魏征直连 command                |
| scan          | 5                  | 0136 / 0143    | ✅ `scan_queue_*` + `scan_photos` 直连                |
| preference    | 8                  | 0147           | ✅ `preferences_get` / `preferences_update`           |
| appstate      | 3                  | 0145           | ✅ `folder_tree_*` / `app_state_restore`              |
| switch_folder | 1（appstate 子域） | 0137           | ✅ `get_photasa_config` + matter-sync `switch_folder` |
| shell         | 2                  | 0150           | ✅ `open_external` / `show_in_folder`                 |
| menu          | 1                  | 0150           | ✅ `apply_system_menu`                                |
| engine        | 1                  | 0149 R5        | ✅ `engine_status.rs` 原生 emit，无 zouwu 运行时依赖  |

## 为什么 zouwu 在 Tauri 净值为负

（原文保留）Tauri `#[tauri::command]` 是编译期检查的 Rust 直调；bundle `.zouwu` 既不带来 contract reference 式热更新收益，又引入模板解析与生产打包遗漏风险（0107 历史教训，已由 0147 关闭 preference 路径）。

## 每域退场模式

统一按 [0140](./0140-tauri-zouwu-adapter-to-command-migration.md)：删 adapter → 具体类型 command → 袁天罡 `executeZhaoling` 内联 invoke → 测试守卫 `IntentToFuluMapping` 零命中。

## Non-goals（仍适用）

- **`zouwu-core` / `zouwu-builtin` workspace 移除** — 本 RFC 完成域退场，不删 crate（待后续 RFC）。
- 不改变磁盘存储格式或对外响应形状。

## Acceptance

1. ✅ 上表 8 域全部退出 zouwu 生产路径。
2. ✅ `apps/photasa/src/services/yuantiangang/intent.ts` — `IntentToFuluMapping` 空表 + `RETIRED_ZOUWU_MATTERS` 测试列表。
3. ✅ Vitest：`824 passed`（含 `yuantiangang-ipc` SWITCH_FOLDER、zouwu 退场断言）。
4. ⏳ `TianshuService` 物理删除 — 非本 RFC 范围。

## Risks（已缓解）

- ~~appstate 与 0136 时间线交叉~~ — 0145/0137 已分域落地。
- ~~preference 生产 workflow 打包~~ — 0147 已消除 zouwu 依赖。

# RFC 0140: zouwu Adapter → Tauri command 直调迁移（通用模式）

- **Start Date**: 2026-07-19
- **Status**: ✅ Implemented（2026-07-21）— 模式已由全部域 RFC 验证；`IntentToFuluMapping` 空表
- **Priority**: P1
- **Area**: Photasa / Tauri / Tianshu / zouwu
- **Depends on**: [0138](./0138-tauri-photasa-config-crate.md)（首个迁移对象）
- **Related**: [0139](./0139-tauri-zouwu-retirement-plan.md)（域退场排期）、[0136](./0136-tauri-scan-runtime-contract.md)（scan 不走 zouwu workflow）
- **Path**: `.spec/rfc/completed/0140-tauri-zouwu-adapter-to-command-migration.md`

## Decision

`*_adapter.rs`（实现 `zouwu_core::adapter::Adapter` trait）在**已迁移域**逐个**删除**，替换为具体类型化 `#[tauri::command]`，由贞观角色在 `yuantiangang.ts::executeZhaoling`（或域负责角色经同一入口）内联 `invoke()`。

## 通用迁移模式（6 步）

1. 确认业务逻辑已独立于 zouwu（必要时先抽 crate，如 `photasa-config` / `photasa-preference`）。
2. **删除** `*_adapter.rs`（不保留 `impl Adapter`）。
3. 新增 **具体类型** `#[tauri::command]`（禁止 `action: String` + `Value` 二次分发）。
4. `services/tianshu.rs` 移除该 adapter 的 `AdapterRegistry` 注册。
5. TS：`executeZhaoling` **内联** `invoke()`；允许 `tauri-command-names.ts` 常量与纯函数 delta，**禁止** `*-bridge.ts`。
6. 验证：`grep zouwu_core` 该域零命中；`IntentToFuluMapping` 无该域 matter；Vitest 覆盖 invoke 路径。

## 域验证表（2026-07-21）

| 域            | 删除的 adapter                      | 直连 command / 入口                                      | 验证 RFC           |
| ------------- | ----------------------------------- | -------------------------------------------------------- | ------------------ |
| config        | `config_adapter.rs`                 | `get_photasa_config` 等 → 魏征经 `executeZhaoling`       | 0138 / 0142        |
| scan queue    | （无独立 adapter）                  | `scan_queue_*`                                           | 0136 / 0143 / 0144 |
| preference    | `preferences_adapter.rs`            | `preferences_get` / `preferences_update`                 | 0147               |
| folder tree   | `siming_adapter.rs`                 | `folder_tree_update` / `app_state_restore`               | 0145               |
| switch_folder | —                                   | `get_photasa_config` + matter-sync                       | 0137               |
| shell / menu  | （逻辑迁出 `TaibaijinxingAdapter`） | `open_external` / `show_in_folder` / `apply_system_menu` | 0150               |
| engine status | —                                   | `engine_status.rs` 原生 emit（无 zouwu workflow）        | 0149               |

**TS 守卫**：`apps/photasa/src/services/yuantiangang/intent.ts` — `IntentToFuluMapping` 空对象 + `RETIRED_ZOUWU_MATTERS` 测试列表。

**仍驻留、无生产流量的 zouwu 基础设施**（属 `zouwu-core` workspace 移除 RFC，非本 RFC 未完成项）：

- `scan_adapter.rs`、`taibaijinxing_adapter.rs`、`taiyi_adapter.rs` — 仅 `TianshuService` 死路径
- `tianshu_command` IPC — 无生产 matter 路由

## 设计铁律（0145 教训）

`invoke()` 不得拆入独立 bridge 文件。`siming-bridge.ts` 已收回；判断标准：拆出文件的单测若需 mock `invoke`，则不允许拆。

## Acceptance

1. ✅ 已迁移域 Tauri 业务源码 `grep zouwu_core` 零命中（scan 持久化层见 0144 `ScanQueueError`）。
2. ✅ 已迁移域无保留的 `config_adapter` / `preferences_adapter` / `siming_adapter`。
3. ✅ 新增 command 均为具体类型参数。
4. ✅ 各域 trace 记录在对应域 RFC（上表）。
5. ✅ 无 `*-bridge.ts` 生产文件；`executeZhaoling` 为唯一 IPC 边界实现点。
6. ✅ Vitest：`824 passed`（含 `yuantiangang-ipc`、`RETIRED_ZOUWU_MATTERS` 断言）。

## Non-goals

- **`zouwu-core` / `TianshuService` 物理删除** — 另开 RFC。
- 不改变磁盘格式或对外 JSON 形状。

## Risks（已缓解）

- Zouzhe 持久化副作用：各域 RFC 均保留 `processZouzhe` → `executeZhaoling` → matter-sync 链。
- 多域并行合并冲突：0138–0150 / 0137 已顺序落地。

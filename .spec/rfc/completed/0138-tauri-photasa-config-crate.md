# RFC 0138: `photasa-config` crate — folder-level `.photasa.json`，退出 zouwu

- **Start Date**: 2026-07-19
- **Last updated**: 2026-07-20
- **Status**: ✅ Implemented
- **Priority**: P1
- **Area**: Photasa / Rust crates / Config
- **Depends on**: [0132](./0132-tauri-photasa-scan-crate.md)（crate 抽取模式参照）、[0141](./0141-tauri-photasa-media-crate.md)（已完成，`is_video`/`is_image` 判定权威来源，本 crate 不自行维护扩展名表）
- **Blocks**: [0136](./0136-tauri-scan-runtime-contract.md)（扫描发现媒体文件写入 `.photasa.json` 依赖本 crate 的 `add_photo_to_folder_list`）、[0139](../0139-tauri-zouwu-retirement-plan.md)（zouwu 退场顺序计划第一项）
- **Adapter 迁移模式**: [0140](../0140-tauri-zouwu-adapter-to-command-migration.md)（`config_adapter.rs` 删除+改 command 的具体步骤和验收标准以 0140 为准，本 RFC 只声明"要做"，不重复定义"怎么做"）
- **Path**: `.spec/rfc/completed/0138-tauri-photasa-config-crate.md`

## Decision

新建 workspace crate `crates/photasa-config`，承接 folder-level `.photasa.json` 读写逻辑（当前分散在 `apps/photasa/src-tauri/src/commands/photasa_config.rs` + `adapters/config_adapter.rs`）。`ConfigAdapter` 改为直调新 crate 的 Rust 函数，不再经 zouwu workflow（当前 `config` adapter 本身走 zouwu-core `Adapter` trait，但没有对应 `.zouwu` workflow 文件驱动它——只是 adapter 注册在 zouwu 的 `AdapterRegistry` 下；本 RFC 把它整个搬出 zouwu 注册体系，改成 Tauri command 直调）。

## 背景

现状（已读源码确认）：

- `apps/photasa/src-tauri/src/commands/photasa_config.rs`（404 行，含 9 个单元测试）：纯逻辑，`PhotasaConfigData`/`PhotoEntry` 结构体、`read_config_sync`/`write_config_sync`/`fix_config_sync`/`add_photo_to_folder_list`/`remove_photo_from_folder_list`，全部同步 `std::fs`。依赖 `super::path::{is_video_file, to_file_name}`（`commands/path.rs`，需要一并抽取或提供等价实现）。
- `apps/photasa/src-tauri/src/adapters/config_adapter.rs`（152 行）：`ConfigAdapter` 实现 `zouwu_core::adapter::Adapter` trait，`name()` 返回 `"config"`，5 个 action（`getCurrentSnapshot`/`getSnapshot`/`updateConfig`/`resetConfig`/`fixConfig`），内部直接调用 `photasa_config` 模块函数（`fixConfig` 用 `spawn_blocking` 包同步函数）。
- 这是 zouwu 五个仍在用的域之一（scan/preference/appstate/shell/menu/engine 中的 config 严格说不算独立域，是被 preference 一起注册，见 `services/tianshu.rs` adapter 注册列表）。

对齐上一轮结论（0136 讨论中确认）：zouwu 的价值在 Electron 的 preload 隔离 + 跨 engine 编排，Tauri 里 Rust command 已经是同进程直调，不需要这层。`.photasa.json` 逻辑本身已经是纯函数、无跨 engine 依赖，是退出 zouwu 成本最低的第一块——没有 workflow YAML 文件依赖（zero `.zouwu` files reference `config`），只是 adapter 注册用了 zouwu 的 trait，去掉即可。

## Goals

1. `crates/photasa-config`：零 Tauri 依赖，独立 `cargo test`。
    - 迁入 `PhotasaConfigData`/`PhotoEntry`、`read_config_sync`/`write_config_sync`/`fix_config_sync`/`add_photo_to_folder_list`/`remove_photo_from_folder_list`/`parse_photo_list`/`config_to_json_value`/`parse_config_value`/`to_relative_thumbnail_path`/`shorten_thumbnail_relative_path`。
    - 迁入全部 9 个现有单元测试，保持断言不变（不允许"修测试适配代码"，必须先证明行为一致）。
    - `is_video_file` 依赖：不在本 crate 复制扩展名表，直接 `use photasa_media::is_video_file`（0141 已完成）。`to_file_name` 是几行纯字符串操作（basename 提取），无判定表分叉风险，crate 内部本地实现即可，不需要抽取。
2. `apps/photasa/src-tauri/src/adapters/config_adapter.rs` 的删除与 `#[tauri::command]` 迁移，按 0140 定义的通用模式执行（不在本 RFC 重复展开步骤）。
3. `photasa-config` crate 必须支持 0136 的文件流水线场景：扫描发现媒体文件 → `add_photo_to_folder_list` 写入 `.photasa.json`——这是本 crate 对外的核心能力之一，不只是 folder-config 页面的 CRUD 后端。crate 签名统一为纯 Rust 类型进出（`&str`/`PhotasaConfigData`/`Result<_, String>`），不掺 `Value`/JSON——与 0141 的签名原则一致。0136 的 Tauri 组合根和未来的 `#[tauri::command]` 都只是直接调用同一套函数，不需要两种签名，JSON 序列化只在真正的 IPC 边界（`#[tauri::command]` 入口本身）发生。

## Non-goals

- 不动 `preferences_adapter.rs`（wenchang，应用级 preferences，已有独立 crate `photasa-preference`，2026-07-19 由 `wenchang-preferences` 改名；退出 zouwu 是 0139 单独排期——但同样的"删 adapter，改 command"原则适用，届时一并处理）。
- 不在本 RFC 内退场 zouwu crate 本体（`zouwu-core`/`zouwu-builtin`）——其他域仍依赖，见 0139。
- 不改变 `.photasa.json` 磁盘格式或字段语义。

## Testing strategy

- `cargo test -p photasa-config`：9 个迁入测试 + 迁移前后行为对比（尤其 `read_config_sync_does_not_rewrite_disk` 这类反直觉断言，必须保持）。
- `cargo test -p photasa`：确认 `config_adapter.rs` 改造后 `cargo build -p photasa` 通过，且现有集成测试（如有）不回归。
- Renderer 侧调用链需要人工确认（trace 代码，非跑 app）：改动前后 `getCurrentSnapshot`/`updateConfig`/`resetConfig`/`fixConfig` 四个 action 的请求/响应形状必须逐字节一致，否则 Store 同步会静默失败。

## Acceptance（2026-07-20 验证）

1. ✅ `photasa-config` crate 存在，`cargo test -p photasa-config` 9 passed，无 `any`/无 warning。
2. ✅ `apps/photasa/src-tauri/src/adapters/config_adapter.rs` 文件不存在。
3. ✅ `commands/config.rs`（`get_photasa_config`/`add_to_photo_list`/`remove_from_photo_list`/`reset_photasa_config`/`fix_photasa_config`）零 `zouwu_core` 引用；无 Rust 端"袁天罡模块"——TS 侧袁天罡（`yuantiangang.ts`）直接 `invoke()` 这些 command。
4. ✅ `services/tianshu.rs`/`main.rs` 零 `ConfigAdapter` 命中。
5. ✅ Renderer 调用链已 trace 并记录在 [0142](../completed/0142-tauri-zhenguan-config-commands-personification.md)（`FolderList.vue` → 魏征 `weizheng.ts` → `processZouzhe` → `executeZhaoling` 直连 → 上述 5 个 command）。
6. ✅ `cargo clippy -p photasa-config -- -D warnings` 零警告。

## Risks

- 0138 依赖 0141 先落地——如果实现时图省事跳过 0141、在 `photasa-config` 里现写一份 `is_video` 判定，会制造第四份分叉表（0141 已记录三份分叉、这将是第四份），必须按顺序先做 0141。
- Renderer 调用链如果目前是"越过 Tianshu 直接命中 config adapter"（不经 zouwu workflow），退出难度低；如果实际上有隐藏的 `.zouwu` 文件间接引用 `config` service（未 grep 到但可能通过其他 adapter 组合调用），需要在动手前再次确认零引用，不能只信任本 RFC 的初步 grep 结果。

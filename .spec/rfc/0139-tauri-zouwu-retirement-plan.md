# RFC 0139: zouwu/Tianshu workflow 引擎在 Tauri 侧逐域退场计划

- **Start Date**: 2026-07-19
- **Status**: Draft（分析/排期，不含代码改动）——**scan/preference/config 三域已读源码核实，appstate/shell/menu/engine 三域 adapter 名称/实际耦合尚未查证，下方"排期顺序"对这三域只是占位猜测，不是确定排期**
- **Priority**: P2
- **Area**: Photasa / Tauri / Tianshu / zouwu
- **Depends on**: [0138](./completed/0138-tauri-photasa-config-crate.md)（第一个退场域，已完成，验证退场模式可行）
- **迁移模式**: [0140](./0140-tauri-zouwu-adapter-to-command-migration.md)（每域退场时"删 adapter 改 command"的具体步骤和验收标准，本 RFC 只排期，不重复定义步骤）
- **Path**: `.spec/rfc/0139-tauri-zouwu-retirement-plan.md`

## Decision

zouwu（`zouwu-core`/`zouwu-builtin`，Electron `TaiyiEngine`/`.zouwu` workflow 的 Rust 移植）在 Tauri 架构下不再有存在理由，逐域退场，改为 Tauri `#[tauri::command]` 直调 + 具体 crate。**Adapter 层本身（`*_adapter.rs` 实现 `zouwu_core::adapter::Adapter` trait）与 zouwu 一并退场**，不是保留 adapter 只换实现。

## 为什么

zouwu 解决的是 Electron 特有问题：renderer 被 preload 隔离，不能直调 main 进程 TS 对象，只能走 IPC；`TaiyiEngine` 管一堆异构 engine，zouwu 是给这些跨 engine 调用的声明式编排层（YAML 写步骤依赖，运行时 `{{steps.xxx}}` 模板插值）。

Tauri 里这个问题不存在：

- `#[tauri::command]` 本身是 Rust 函数，Rust 调 Rust 是编译期检查的直接函数调用，不需要运行时编排层。
- "改 YAML 不用重新编译"这条 Electron 场景下的价值在 Tauri 不成立——YAML 要打包进 `resources` 才能被读到（当前没打包，见 RFC 0107 记录的真实生产 bug：`tauri.conf.json` `resources: []`，打包后整个 Tianshu 引擎在生产环境加载不到任何 `.zouwu` 文件），改 YAML 照样要重新打包发版，跟改 Rust 代码没有本质区别，只是多了一层运行时字符串模板解析——这层解析本身在 RFC 0048 postmortem 里已经真实引发过一次故障（数组模板变量解析失败，魏征根节点判定失败那次）。
- Rust 类型系统在编译期做的校验比 zouwu 的运行时 `output_schema` 校验更强。

结论：zouwu 在 Tauri 里净值为负——复制了一层 Electron 专属问题的解法，Tauri 根本没有对应问题，换来的是模板解析风险 + 打包遗漏风险（preference 域已经真实踩坑），没有对应收益。

## 现状盘点（已读源码确认）

`apps/desktop/src/main/engines/tianshu/workflows/` 下 6 个域、20 个 `.zouwu` 文件：

| 域         | 文件数 | Tauri 侧 Adapter                                                              | 状态                                                  |
| ---------- | ------ | ----------------------------------------------------------------------------- | ----------------------------------------------------- |
| scan       | 5      | 无独立 adapter，走 `YuChiGong`/`FangXuanLing` 持久化路径                      | 已在 RFC 0136 决定退出 zouwu，直调 Rust command       |
| preference | 8      | `preferences_adapter.rs`（`name() == "wenchang"`）                            | 待退场，见下                                          |
| appstate   | 3      | ~~`siming_adapter.rs`~~ → **0145 ✅** `photasa-folder-tree` + `siming-bridge` | ✅ 已退场（`update_folder_tree`/`restore_app_state`） |
| shell      | 2      | 未查                                                                          | 待排查                                                |
| menu       | 1      | 未查                                                                          | 待排查                                                |
| engine     | 1      | 未查                                                                          | 待排查                                                |

`config`（folder-level `.photasa.json`）严格说不是这 6 个域之一——它没有对应 `.zouwu` 文件，`ConfigAdapter` 只是注册进了 zouwu 的 `AdapterRegistry`，本身没有 workflow YAML 驱动。这是退出成本最低的第一块，已单独立项为 RFC 0138。

## 排期顺序

**已核实、可排期的两项**：

1. ✅ **0138 — `photasa-config`**（folder-level `.photasa.json`，已完成）：零 `.zouwu` 文件依赖，只是 adapter 注册用了 zouwu trait，退出成本最低，验证了 0140"退场模式"可行——`config_adapter.rs` 已删，5 个 command 直连，renderer 侧改归魏征（0142）。
2. **preference**（`photasa-preference`，已改名/已有独立 crate，见 RFC 0107）：8 个 workflow 文件，逻辑已经在 Rust crate 里，退场主要是删 `preferences_adapter.rs`、把 8 个 workflow 步骤翻成 Rust 函数、renderer 侧改调新 command。这是当前"跑不好"的域（RFC 0107 记录的生产打包 bug 亲身证实），优先级仅次于 0138。

**未核实、仅占位猜测（不是排期承诺）**：

3. ✅ **appstate**（3 个 workflow 文件）：[RFC 0145](./completed/0145-tauri-siming-adapter-retirement.md) 已删 `SimingAdapter`，`photasa-folder-tree` crate + `siming-bridge` 单路径；`switch_current_folder` 仍待后续域 RFC。
4. shell / menu / engine（各 1-2 个文件）：未读源码确认，"影响面小"是基于文件数量的猜测，不是读过代码的结论。

在补齐 appstate/shell/menu/engine 的真实盘点信息之前，第 3、4 项不构成可执行的排期，只是待办清单。

## 每域退场怎么做

统一按 0140 定义的通用迁移模式（crate 抽取 → 删 adapter → 具体类型 command → 移除 registry 注册 → trace TS 调用链改直调 → 验证）执行，本 RFC 不重复定义步骤。唯一域特有的额外问题：该域是否有 workflow 内部编排的多步骤逻辑（如 preference 的 `validate→sanitize→update→snapshot→emit→format`）——多步骤需要在 Rust 里保留同样的执行顺序和错误处理，不能简化掉中间校验步骤，这点 0140 的通用步骤未覆盖，逐域迁移时需各自确认。

## Non-goals

- 本 RFC 不改代码，只排期和记录退场理由。
- 不涉及 `zouwu-core`/`zouwu-builtin` crate 本体删除的时间点——最后一个域退场完成后才能删 crate，届时另开 RFC 处理 workspace 移除。
- 不改变任何域的磁盘存储格式或对外响应形状（改造必须保持行为一致，逐域用该域自己的 RFC 记录验证证据）。

## Risks

- appstate 域（一旦补齐盘点、确认真与 0136 相关）与 0136（scan 持久化+folder tree）时间线交叉，顺序处理不当可能导致两个 RFC 同时改同一批文件，产生合并冲突或行为不一致窗口——具体风险评估要等盘点补齐后才能做实。

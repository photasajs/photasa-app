# RFC 0140: zouwu Adapter → Tauri command 直调迁移（通用模式）

- **Start Date**: 2026-07-19
- **Status**: Draft（分析/模式定义，不含代码改动）
- **Priority**: P1
- **Area**: Photasa / Tauri / Tianshu / zouwu
- **Depends on**: [0138](./completed/0138-tauri-photasa-config-crate.md)（`photasa-config` crate，第一个迁移对象，已完成）
- **Related**: [0139](./0139-tauri-zouwu-retirement-plan.md)（域退场排期）、[0136](./completed/0136-tauri-scan-runtime-contract.md)（scan 已决定不走 zouwu，本 RFC 定义的是通用迁移模式，不含 scan）
- **Path**: `.spec/rfc/0140-tauri-zouwu-adapter-to-command-migration.md`

## Decision

`*_adapter.rs`（实现 `zouwu_core::adapter::Adapter` trait 的 Tauri 侧文件）逐个**删除**，不是"改造保留"。原因：这层存在的唯一理由是满足 zouwu 的 `Adapter` trait 契约——`fn name() -> &str` + `async fn execute(action: &str, input: Value, ctx: &ExecutionContext) -> Result<Value, AdapterError>`，`Value` 进 `Value` 出、靠字符串 `action` 分发，是专为 `.zouwu` workflow YAML 声明式调用设计的泛型接口。一旦某个域不再走 zouwu workflow，这套接口没有存在理由，应替换为若干具体类型化的 `#[tauri::command]`，由 TS 侧对应服务（袁天罡或其他直连 Rust 的角色）直接 `invoke()`。

## 为什么现在做（而不是留着 adapter 只换内部实现）

如果只换 adapter 内部实现（不删文件、不改签名），会保留：

- `Value`/`action: &str` 这层类型擦除——本该在编译期检查的参数类型，退化成运行时 JSON 字段访问 + `unwrap_or`/`ok_or_else` 手写校验（`config_adapter.rs` 现状即如此，见 0138 引用的源码）。
- `AdapterRegistry` 注册这层间接——`services/tianshu.rs` 仍需维护一份"字符串 service 名 → adapter 实例"的映射，即使调用方已经不再经过 zouwu workflow 触发。
- 一个不清楚该文件为何存在的后来者，容易把新逻辑继续按 adapter 模式写（因为看着像既有约定），导致退场不彻底、两种模式并存更难维护。

删除是唯一能让"不再使用 zouwu"这件事在代码里可验证的做法：`grep zouwu_core` 在该域应该零命中。

## 通用迁移模式（每个域套用同一套步骤）

1. **确认该域业务逻辑是否已独立于 zouwu**。如果混在 adapter 的 `execute()` match 分支里，先抽成独立 crate 或模块内纯函数（参照 0132/0133/0138 的 crate 抽取先例）。
2. **删除 `*_adapter.rs`**，不保留任何 `impl Adapter for XxxAdapter` 代码。
3. **新增对应 `#[tauri::command]`**，一个 zouwu action 对应一个具体类型化 command（不是一个大 command 接 `action: String` 参数模拟原来的分发——那只是把 adapter 换了个壳，没有解决类型擦除问题）。
4. **`services/tianshu.rs` 移除该 adapter 的 `AdapterRegistry` 注册**。
5. **TS 侧调用方（trace 出实际是谁——袁天罡或其他角色）改为直接 `invoke("command_name", …)`**，不再经 Zouzhe→Tianshu→zouwu AdapterRegistry 路由。必须先读代码确认当前调用链，不能假设。**`invoke()` 调用点必须写在该角色的主文件本体里（如 `yuantiangang.ts::executeZhaoling` 内联），不得拆成独立的 `executeXxxZhaoling(command, context)` 转发函数放进单独"bridge"文件**——0145 曾短暂引入 `siming-bridge.ts` 又收回，教训见该 RFC"设计铁律"节：拆出去的中间转发层跟 adapter 类型擦除层是同一种反模式换皮，即使参数是具体类型也不例外。允许拆分的仅限纯函数（无 IPC/无副作用的数据转换）和纯常量（command 名字符串表）——判断标准：拆出去的文件单测是否需要 mock `invoke`/Tauri 运行时，需要则不允许拆。
6. **验证**：`grep zouwu_core` 该域源码零命中；新旧响应形状逐字段比对一致（前端 store-sync 依赖响应形状，见 RFC 0107 记录的 preference 链路教训）；`grep -rn "^export async function execute.*Zhaoling"` 该域调用方源码零命中（确认没有转发函数残留）。

## 首个迁移对象：`ConfigAdapter`（已验证，对应 0138/0142）

`config_adapter.rs` 是当前唯一没有对应 `.zouwu` workflow 文件、只是注册进 `AdapterRegistry` 的 adapter（其余 5 域——scan/preference/appstate/shell/menu/engine——都有真实 `.zouwu` 文件驱动，退场顺序见 0139）。5 个 action（`getCurrentSnapshot`/`getSnapshot`/`updateConfig`/`resetConfig`/`fixConfig`）已迁移为对应 `#[tauri::command]`，直调 0138 交付的 `photasa-config` crate。

TS 侧调用链已 trace 确认（0142）：不是袁天罡直接归口，而是**魏征**（`WeiZhengService`，`.photasa.json` 解析结果属于 `appState`，归魏征的 `appState` 监管职责；褚遂良只管应用级 `preferences.json`）→ `processZouzhe` → `executeZhaoling` 直连 `invoke()`。验证了本 RFC 定义的模式可行：Rust 端零 zouwu 依赖，TS 端由业务语义决定的角色直连，不强制假设是袁天罡。

## Non-goals

- 本 RFC 不改代码，只定义迁移模式和验证标准，供 0138 及后续每个域迁移时引用。
- 不改变任何域的磁盘存储格式、对外响应 JSON 形状——迁移是"调用路径"的改变，不是"行为"的改变。
- scan 域的 zouwu 退出已经在 0136 单独定案（Rust 侧从来没有 scan adapter 需要删——尉迟恭/房玄龄本来就没接入 zouwu），不重复纳入本 RFC。

## Acceptance

1. 迁移完成的域，其 Tauri 侧源码 `grep zouwu_core` 零命中。
2. 迁移完成的域，不存在保留但改了实现的 `*_adapter.rs`——文件本身不存在。
3. 新增的每个 `#[tauri::command]` 参数是具体类型（`String`/`bool`/自定义 struct），不是 `Value` + `action: String` 的二次分发。
4. TS 侧调用链 trace 记录在对应域的迁移 RFC 里（谁调用、旧路径、新路径），不是"看起来应该没问题"。**验证手段而非只读几个文件就当作 trace 完成**：迁移前先 `grep -rn` 该域旧 matter/action 字符串（如 `"getCurrentSnapshot"`、`service: "config"` 之类）在整个 renderer 源码里的命中列表，作为"必须全部改掉"的清单；迁移后重跑同一 grep，必须零命中（或命中位置全部确认是注释/历史记录，不是活代码）。清单和迁移后复查结果都要记录在对应域的 RFC 里。
5. **无 bridge 文件**：`invoke()` 直连调用点在角色主文件本体内联，不存在独立的 `*-bridge.ts`/`executeXxxZhaoling` 转发函数文件。

## Risks

- 如果某个 TS 调用方实际上依赖 Zouzhe 系统的持久化副作用（房玄龄自动 Store 同步，见 CLAUDE.md 双通信系统），单纯改成 `invoke()` 直调会丢失这个副作用——需要在每个域迁移时确认该域是否依赖 Zouzhe 的自动同步机制，不能一刀切当作纯查询式调用处理。
- 多个域并行迁移可能与其他在途 RFC（如 0136/appstate 域时间线交叉，见 0139 Risks）产生合并冲突。

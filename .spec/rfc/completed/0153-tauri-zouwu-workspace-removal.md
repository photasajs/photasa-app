# RFC 0153: zouwu-core / TianshuService workspace 物理移除

- **Start Date**: 2026-07-21
- **Status**: ✅ Implemented（2026-07-21）
- **Priority**: P1
- **Area**: Photasa / Tauri / Rust workspace / zouwu
- **Depends on**: [0139](./completed/0139-tauri-zouwu-retirement-plan.md)（域逻辑退场 ✅）、[0140](./completed/0140-tauri-zouwu-adapter-to-command-migration.md)（adapter→command 模式 ✅）
- **Related**: [0072](./completed/0072-tauri-tianshu-service-migration.md)（历史：TianshuService 迁入 Tauri）、[0137](./completed/0137-tauri-zhenguan-direct-ipc-migration.md)（贞观唯一 IPC 边界）
- **Path**: `.spec/rfc/completed/0153-tauri-zouwu-workspace-removal.md`

## Decision

0139/0140 已完成**逻辑退场**（8 域生产路径零 zouwu workflow；`IntentToFuluMapping` 空表）。本 RFC 做**物理删除**：从 Photasa Tauri 二进制与 workspace 中移除 `zouwu-core`、`zouwu-builtin`、`TianshuService`、剩余 `*_adapter.rs`、`tianshu_command` IPC，以及前端 `tianshu.adapter.ts` 死路径。

**不触碰** The removed desktop tree 的 `@zouwu-wf/workflow`（TS 包，独立生命周期）。

## 背景（2026-07-21 源码核实）

| 残留物            | 路径                                                                       | 生产流量                                                                        |
| ----------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `TianshuService`  | `apps/photasa/src-tauri/src/services/tianshu.rs`                           | 无（启动时初始化，无 matter 路由）                                              |
| 死 adapter        | `adapters/scan_adapter.rs`、`taiyi_adapter.rs`、`taibaijinxing_adapter.rs` | 无                                                                              |
| IPC               | `main.rs`：`tianshu_command`、`tianshu_status`                             | 无生产 matter                                                                   |
| workspace crate   | `crates/zouwu-core`、`crates/zouwu-builtin`                                | 仅 `photasa` 依赖                                                               |
| TS 适配器         | `apps/photasa/src/api/tianshu.adapter.ts`                                  | 仅 `yuantiangang.sendFuluToTianshu` 失败路径；`main.ts` 启动 `waitUntilReady()` |
| workflow 目录解析 | `resolve_workflows_dir` → `legacy-api contract/.../workflows`（dev）       | 0107 已否决 bundle workflows 进 Tauri                                           |

## Goals

1. **删 Rust 死代码**：`services/tianshu.rs`、`adapters/` 模块、`main.rs` 中 `TianshuService` 初始化与 `tianshu_command` / `tianshu_status` 注册。
2. **删 workspace crate**：根 `Cargo.toml` 与 `apps/photasa/src-tauri/Cargo.toml` 移除 `zouwu-core`、`zouwu-builtin`；删除 `crates/zouwu-core/`、`crates/zouwu-builtin/` 目录（含测试）。
3. **删 TS 死路径**：`tianshu.adapter.ts`；`adapter.ts` 中 `tianshu` 导出；`main.ts` 中 `waitUntilReady()`；`yuantiangang.ts` 中 `sendFuluToTianshu` / `convertFuluToUICommand` 改为明确失败（或删除整条符箓路径，保留 `executeZhaoling` 直连 invoke）。
4. **验证零残留**：`rg zouwu_core|zouwu-core|zouwu-builtin|TianshuService|tianshu_command` 在 `apps/photasa` 零命中（注释/归档 RFC 除外）。

## Implementation plan（建议顺序）

### Phase A — 确认无生产调用

1. `rg sendFuluToTianshu|tianshu_command|tianshuAdapter` → 仅测试与死路径。
2. `cargo test -p photasa` + `vitest` 全绿（基线）。

### Phase B — Rust 删除

3. 删 `apps/photasa/src-tauri/src/adapters/`（`mod.rs` + 三个 adapter）。
4. 删 `apps/photasa/src-tauri/src/services/tianshu.rs`；`services/mod.rs` 移除 re-export。
5. `main.rs`：移除 `TianshuService` state slot、setup 中 async 初始化、`tianshu_command` / `tianshu_status` handler 与 `tianshu_command_tests`。
6. `Cargo.toml`（根 + photasa）：移除 `zouwu-core`、`zouwu-builtin` workspace 成员与依赖。
7. 删 `crates/zouwu-core/`、`crates/zouwu-builtin/`。

### Phase C — TS 删除

8. 删 `apps/photasa/src/api/tianshu.adapter.ts` 及专属测试。
9. `adapter.ts`：移除 `tianshuAdapter` import/export。
10. `main.ts`：移除 `tianshuAdapter.waitUntilReady()` 块。
11. `yuantiangang.ts`：移除 `sendFuluToTianshu` 链；未映射 matter 在 `executeZhaoling` 早抛（与 `intent.ts` `RETIRED_ZOUWU_MATTERS` 一致）。
12. 更新 `yuantiangang-ipc.test.ts`、`yuan-tian-gang.test.ts` 等 mock。

### Phase D — 验证

13. `cargo build -p photasa`、`cargo test --workspace`（无 zouwu crate）。
14. `pnpm --filter @photasa/photasa exec vitest run`（或项目等价命令）。
15. `rg zouwu` 在 `apps/photasa/src-tauri` 与 `apps/photasa/src` 零生产命中。

## Acceptance

1. ✅ `crates/zouwu-core`、`crates/zouwu-builtin` 目录不存在；根 `Cargo.toml` workspace members 无二者。
2. ✅ `apps/photasa/src-tauri` 无 `zouwu_core` import；无 `TianshuService`、无 `adapters/` 模块。
3. ✅ `tianshu_command` / `tianshu_status` IPC 已注销。
4. ✅ `tianshu.adapter.ts` 已删；`main.ts` 启动不再等待天枢就绪。
5. ✅ `IntentToFuluMapping` 仍为空；未支持 matter 返回明确错误（`yuantiangang-ipc` 新增 RFC 0153 断言）。
6. ✅ `cargo test --workspace` **208 passed**；Photasa vitest **825 passed**。

## Non-goals

- **不删** The removed desktop tree 的 `@zouwu-wf/workflow` / workflow YAML（Legacy 参考实现）。
- **不删** `docs/rfc/0037-zouwu-workflow-dsl.md` 等历史文档。
- **`legacy-api.ts` 逐 capability 退役** — 独立跟踪（0097 后续项），非本 RFC。
- **不迁移** workflow 可视化 / CLI 到 Rust。

## Risks

| 风险                                 | 缓解                                                 |
| ------------------------------------ | ---------------------------------------------------- |
| 遗漏隐藏 `invoke("tianshu_command")` | Phase A `rg` + vitest IPC 测试                       |
| 删除后启动变慢/变快需回归            | 移除 `waitUntilReady` 应缩短冷启动；手测 splash→主窗 |
| workspace 其他 crate 间接依赖 zouwu  | `cargo tree -i zouwu-core` 实施前确认仅 photasa      |

## 与 0139/0140 关系

- **0139**：域 matter 不再走 zouwu workflow ✅
- **0140**：adapter 迁移模式与验证表 ✅
- **0153**：上述 RFC 的 **Non-goals** 项 — 物理拆除基础设施

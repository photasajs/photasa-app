# RFC 0144: 扫描队列持久化对齐贞观/0048/0136 设计

- **Start Date**: 2026-07-20
- **Last updated**: 2026-07-20
- **Status**: ✅ Implemented
- **Priority**: P1
- **Area**: Photasa / Tauri scan queue / persistence
- **Depends on**: [0048](./0048-scan-orchestration-business-logic-migration.md)（Store SSOT + 状态机权威设计）、[0136](../0136-tauri-scan-runtime-contract.md)（当前扫描队列契约）
- **Path**: `.spec/rfc/completed/0144-tauri-scan-queue-persistence-alignment.md`

## Decision

`apps/photasa/src-tauri/src/utils/scan_queue_storage.rs`（RFC 0136/0143 落地的扫描队列持久化）当前实现与 0048 权威设计的两条硬性规则不一致：并发写无保护、错误类型仍耦合 zouwu。修正这两点，不改变已确认工作的部分（Tauri command 直连、TS 侧 processing→pending 崩溃恢复）。

## 背景

0136/0143 已经把扫描队列持久化从 zouwu workflow 迁移为直连 Tauri command（`scan_queue_get`/`scan_queue_add_actions`/`scan_queue_remove_action`/`scan_queue_update_action_status`，`apps/photasa/src/services/yuantiangang/scan-queue-bridge.ts` → `invoke()`），这部分符合 0136 line 103 "房玄龄持久化路径不经 zouwu/Tianshu workflow" 的要求，已验证不需要重做。

`scan_queue_storage.rs` 内部实现读入完整核实，发现两处与 0048/0136 权威设计不一致：

### 1. 并发写无保护（真实竞态，非理论风险）

`add_scan_actions`/`remove_scan_action`/`update_scan_action_status` 三个函数均为 `restore_queue_items()`（读全量 JSON）→ 内存修改 → `persist_queue_items()`（写全量 JSON），中间没有文件锁或内存互斥。0136 的调度设计本身会产生并发写请求：父任务标记完成（`update_scan_action_status`）与子目录请求入队（`add_scan_actions`）在"子目录持久化并加入同一 PQueue，不等待子目录扫描"这条规则下几乎同时发生（`0136` line 79-87 调度步骤）。两个并发 `invoke()` 之间若发生 `restore→persist` 交叉，后写入者会用自己读到的旧快照覆盖先写入者的更新，丢失队列项。

### 2. 错误类型仍耦合 zouwu

`scan_queue_storage.rs:6` `use zouwu_core::adapter::AdapterError;`——0136/0139/0140 的既定方向是扫描域完全退出 zouwu（包括类型依赖，不只是 workflow 调用路径）。当前实现虽然不再触发任何 `.zouwu` workflow 执行，但错误类型仍从 `zouwu_core` 借用，属于依赖方向违规（`photasa-scan`/scan 相关 Tauri 模块不应 `use zouwu_core::*`，参照 0140 Acceptance 第 1 条"grep zouwu_core 零命中"标准）。

### 状态机校验缺失（较低优先级，一并记录）

`update_scan_action_status`（`scan_queue_storage.rs:136-160`）接受任意字符串作为新状态，无合法状态转移校验（0048/0136 定义的状态机是 `pending → processing → [delete]` 或 `→ failed`，无 `completed` 态）。当前实现依赖调用方（TS 侧尉迟恭）自觉传对值，Rust 侧无防护。TS 侧 `yuchigong.ts` 的 `initializeScanningQueue`/状态恢复逻辑已经正确实现（`processing → pending` 崩溃恢复，见该文件 1044-1197 行），这条不是全链路问题，只是 Rust 存储层单独看没有兜底。

## Goals

1. 并发写保护：`scan_queue_storage.rs` 的 restore/modify/persist 三步操作需要在同一临界区内完成（进程内 `Mutex`/`RwLock` 保护磁盘路径级读写，或改为单一 actor/task 串行处理所有队列写请求）。设计需明确排除的场景：两个 `invoke()` 并发调用 `add_scan_actions`/`update_scan_action_status`/`remove_scan_action` 中任意两个，不得发生更新丢失。
2. 移除 `use zouwu_core::adapter::AdapterError`，改用扫描域自己的错误类型（或 `photasa-scan`/`photasa-types` 里已有的错误类型，需先确认是否已有可复用类型，不新造重复的错误枚举）。
3. （可选，视范围决定是否本 RFC 处理）`update_scan_action_status` 增加状态转移合法性校验，拒绝非 `pending`/`processing`/`failed` 之外的状态值。

## Non-goals

- 不改变已确认工作的部分：Tauri command 直连路径（`scan-queue-bridge.ts`）、TS 侧崩溃恢复逻辑（`yuchigong.ts::initializeScanningQueue`）。
- 不改变磁盘存储格式（`~/.photasa/scan/scanning.json` 的 JSON 结构）。
- 不在本 RFC 讨论是否要把 `scanning.json` 换成更适合并发写的存储（如 sqlite）——先在现有 JSON 文件模型内加锁，若锁竞争成为实测瓶颈再另开 RFC。

## Testing strategy

- 并发写保护需要真实并发测试：两个 tokio task 同时调用 `add_scan_actions`（不同 path）与 `update_scan_action_status`（另一 path），断言两次写入结果都保留，不丢失任一项。现有 `scan_queue_storage.rs` 测试模块（162-281 行）全部是顺序调用，未覆盖并发场景，需新增。
- `cargo clippy -p photasa`（或该模块所在 crate）确认零 `zouwu_core` 引用后 `grep -rn "zouwu_core" apps/photasa/src-tauri/src/utils/scan_queue_storage.rs` 零命中。

## Acceptance

1. ✅ 并发调用 `add_scan_actions`/`remove_scan_action`/`update_scan_action_status` 任意组合，不发生更新丢失。实现为 `ScanQueueRepository`（`utils/scan_queue_repository.rs`）：`Mutex<Vec<Value>>` 内存 SSOT + 单写者临界区（`mutate()`）+ tmp-write-then-rename 原子落盘。并发测试 `concurrent_add_preserves_both_items`/`concurrent_add_and_update_both_preserved`（`tokio::join!` 真并发）验证通过。
2. ✅ 新增 `utils/scan_queue_error.rs::ScanQueueError`，零 `zouwu_core` 依赖，替代原 `AdapterError`。`scan_queue_storage.rs`/`scan_queue_repository.rs`/`scan_queue_error.rs` 三个持久化核心文件 `grep zouwu_core` 零命中（`scan_adapter.rs` 因需实现 `zouwu_core::adapter::Adapter` trait 仍有引用，属 0139/0140 adapter 退场范畴，不在本 RFC 目标内）。
3. ✅ 状态校验已做（原列为可选项，实际一并完成）：`VALID_STATUSES = ["pending", "processing", "failed"]` 白名单，非法状态（如 `"completed"`）触发 `ScanQueueError::InvalidStatus`，测试 `rejects_invalid_status` 验证。

**验证证据（2026-07-20）**：`cargo test -p photasa` 74 passed, 3 ignored；`cargo test -p photasa-scan -p photasa-import -p photasa-media` 80 passed。

## Risks

- 加锁方式如果选错（例如粗粒度全局锁跨越整个 Tauri 应用生命周期），可能引入新的性能瓶颈或死锁风险——需要评估锁粒度（按扫描队列文件路径级即可，不需要应用级全局锁）。
- 错误类型迁移如果找不到已有可复用类型，新增类型定义的位置需要决定（`photasa-scan`/`photasa-types`/该模块本地），避免重复造第二份错误枚举。

# RFC 0145: 司命 folder tree 持久化退出 zouwu 双轨制

- **Start Date**: 2026-07-20
- **Last updated**: 2026-07-21
- **Status**: ✅ Implemented
- **Priority**: P1
- **Area**: Photasa / Tauri / folder tree persistence
- **Depends on**: [0136](./0136-tauri-scan-runtime-contract.md)、[0107](./0107-tauri-wenchang-preferences-storage.md)、[0140](./0140-tauri-zouwu-adapter-to-command-migration.md)
- **Path**: `.spec/rfc/completed/0145-tauri-siming-adapter-retirement.md`

## Decision

删除 Tauri 侧 `SimingAdapter` 与 `AdapterRegistry` 注册；`siming_update_folder_tree` / `siming_restore_app_state` 直连 `photasa-folder-tree` crate（零 `zouwu_core`）；`invoke()` 直接写在 `yuantiangang.ts::executeZhaoling` 内部——**不设中间转发文件（"bridge"）**。逻辑拆分只允许拆纯函数/常量（无 IPC、无副作用），拆不允许拆调用点本身。

## 实现摘要

| 项         | 结果                                                                                                                                                                                                                                                |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Rust crate | `crates/photasa-folder-tree`（`FolderTreeStore`，读写 `~/.photasa/appState/photasa.json`）                                                                                                                                                          |
| 删除       | `adapters/siming_adapter.rs`、`utils/app_state_store.rs`                                                                                                                                                                                            |
| Commands   | `apps/photasa/src-tauri/src/commands/siming.rs` — 零 `zouwu_core`                                                                                                                                                                                   |
| TS         | `yuantiangang.ts::executeZhaoling` 内直接 `invoke(FOLDER_TREE_COMMANDS.*)`（2026-07-21 修正：曾短暂拆过 `siming-bridge.ts` 转发文件，已收回主文件，仅保留 `folder-tree-payload.ts::extractFolderTreeFromContext` 这类纯函数辅助，见下方"设计铁律"） |
| Registry   | `services/tianshu.rs` 不含 `SimingAdapter`                                                                                                                                                                                                          |
| Intent     | `intent.ts` 移除 `UPDATE_FOLDER_TREE`/`RESTORE_APP_STATE` zouwu 映射（防 fall-through）                                                                                                                                                             |

## 设计铁律：袁天罡直连不设 bridge 文件（2026-07-21 追加）

**规则**：`executeZhaoling` 内所有直连 Tauri command 的 `invoke()` 调用必须写在 `yuantiangang.ts` 本体里，不得拆成独立的 `executeXxxZhaoling(command, context)` 转发函数放进单独文件（如曾经的 `siming-bridge.ts`/`scan-queue-bridge.ts`）。

**允许拆分的**：纯函数（无 IPC、无副作用的数据转换，如 `folder-tree-payload.ts::extractFolderTreeFromContext`）、纯常量（command 名字符串表，如 `tauri-command-names.ts`）。判断标准：拆出去的文件如果单元测试不需要 mock `invoke`/Tauri 运行时，就是允许的；如果需要 mock，说明拆的是调用逻辑本身，不允许。

**理由**：`executeZhaoling` 是袁天罡"人界↔天界边界，直连 Rust command"这一职责的唯一实现点（0136 Golden Rule 表格）。把 `invoke()` 调用拆进独立 bridge 文件，等于在袁天罡之外又造了一层新的转发层——这正是 0140 要退场的"adapter 类型擦除中间层"模式换了个名字重新出现，即使参数是具体类型、不再有 `Value`+`action:String` 分发，只要是"另一个文件转发 invoke 调用"，架构性质就没变。本次退场（`siming-bridge.ts` → 收回主文件）是这条规则第一次被违反又被修正的实例，记录在此防止未来（0139 排期的 preference/shell/menu/engine 域退场）重蹈覆辙。

**命名**：crate 跟功能走（`photasa-folder-tree`，同 `photasa-scan` 不用千里眼）；Tauri command 保留 `siming_*`（贞观 IPC 历史名）。

**matter-sync**：`update_folder_tree` 的 `propertyPath: folderTree` 对齐 command 返回 `{ folderTree, persisted }`（非 `data.tree`）。

## Acceptance

1. ✅ `siming_adapter.rs` 不存在
2. ✅ `services/tianshu.rs` 的 `AdapterRegistry` 不含 `SimingAdapter`
3. ✅ `siming.rs` 两个 command 零 `zouwu_core` 依赖
4. ✅ `yuantiangang.ts::executeZhaoling` 内对 `UPDATE_FOLDER_TREE`/`RESTORE_APP_STATE` 直接 `invoke()`，无中间转发文件，仅单路径
5. ✅ matter-sync 能从 `data.folderTree` 投影 Pinia（`store-sync-utils` 单测）

**验证证据（2026-07-21）**：

```bash
test ! -f apps/photasa/src-tauri/src/adapters/siming_adapter.rs
! grep -q SimingAdapter apps/photasa/src-tauri/src/services/tianshu.rs
! grep -q zouwu_core apps/photasa/src-tauri/src/commands/siming.rs
cargo test -p photasa-folder-tree -p photasa # 78 passed, 3 ignored
pnpm --filter @photasa/photasa exec vitest run \
 src/services/yuantiangang/__tests__/siming-bridge.test.ts \
 src/services/fangxuanling/store-automation/__tests__/store-sync-utils.test.ts
```

## Non-goals

- 不改变 `photasa.json` 磁盘格式
- 不处理 `switch_current_folder`（仍走 zouwu workflow，留 0139）
- The removed desktop tree 的 `SimingAdapter.ts` 不在本 RFC 范围

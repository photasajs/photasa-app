# RFC 0145: 司命 folder tree 持久化退出 zouwu 双轨制

- **Start Date**: 2026-07-20
- **Last updated**: 2026-07-21
- **Status**: ✅ Implemented
- **Priority**: P1
- **Area**: Photasa / Tauri / folder tree persistence
- **Depends on**: [0136](../0136-tauri-scan-runtime-contract.md)、[0107](../0107-tauri-wenchang-preferences-storage.md)、[0140](../0140-tauri-zouwu-adapter-to-command-migration.md)
- **Path**: `.spec/rfc/completed/0145-tauri-siming-adapter-retirement.md`

## Decision

删除 Tauri 侧 `SimingAdapter` 与 `AdapterRegistry` 注册；`siming_update_folder_tree` / `siming_restore_app_state` 直连 `photasa-folder-tree` crate（零 `zouwu_core`）；袁天罡 `siming-bridge.ts` 为 Photasa 唯一 TS 路径。

## 实现摘要

| 项         | 结果                                                                                       |
| ---------- | ------------------------------------------------------------------------------------------ |
| Rust crate | `crates/photasa-folder-tree`（`FolderTreeStore`，读写 `~/.photasa/appState/photasa.json`） |
| 删除       | `adapters/siming_adapter.rs`、`utils/app_state_store.rs`                                   |
| Commands   | `apps/photasa/src-tauri/src/commands/siming.rs` — 零 `zouwu_core`                          |
| TS         | `yuantiangang/siming-bridge.ts` + `executeSimingZhaoling`（无 `isTauri()` 双轨）           |
| Registry   | `services/tianshu.rs` 不含 `SimingAdapter`                                                 |
| Intent     | `intent.ts` 移除 `UPDATE_FOLDER_TREE`/`RESTORE_APP_STATE` zouwu 映射（防 fall-through）    |

**命名**：crate 跟功能走（`photasa-folder-tree`，同 `photasa-scan` 不用千里眼）；Tauri command 保留 `siming_*`（贞观 IPC 历史名）。

**matter-sync**：`update_folder_tree` 的 `propertyPath: folderTree` 对齐 command 返回 `{ folderTree, persisted }`（非 `data.tree`）。

## Acceptance

1. ✅ `siming_adapter.rs` 不存在
2. ✅ `services/tianshu.rs` 的 `AdapterRegistry` 不含 `SimingAdapter`
3. ✅ `siming.rs` 两个 command 零 `zouwu_core` 依赖
4. ✅ `yuantiangang.ts` 对 `UPDATE_FOLDER_TREE`/`RESTORE_APP_STATE` 仅 `siming-bridge` 单路径
5. ✅ matter-sync 能从 `data.folderTree` 投影 Pinia（`store-sync-utils` 单测）

**验证证据（2026-07-21）**：

```bash
test ! -f apps/photasa/src-tauri/src/adapters/siming_adapter.rs
! grep -q SimingAdapter apps/photasa/src-tauri/src/services/tianshu.rs
! grep -q zouwu_core apps/photasa/src-tauri/src/commands/siming.rs
cargo test -p photasa-folder-tree -p photasa   # 78 passed, 3 ignored
pnpm --filter @photasa/photasa exec vitest run \
  src/services/yuantiangang/__tests__/siming-bridge.test.ts \
  src/services/fangxuanling/store-automation/__tests__/store-sync-utils.test.ts
```

## Non-goals

- 不改变 `photasa.json` 磁盘格式
- 不处理 `switch_current_folder`（仍走 zouwu workflow，留 0139）
- Electron `apps/desktop` 的 `SimingAdapter.ts` 不在本 RFC 范围

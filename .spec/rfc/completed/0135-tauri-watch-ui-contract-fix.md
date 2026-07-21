# RFC 0135: Tauri watch — `legacy-api.ts` `startWatching` UI contract fix

- **Start Date**: 2026-07-18
- **Last updated**: 2026-07-19
- **Status**: ✅ Implemented（2026-07-18；自动化测绿 + 100% coverage；手动四类冒烟建议签收）
- **Priority**: P1d
- **Area**: Photasa / Frontend / Watch UI contract
- **Depends on**: [0082](./0082-tauri-watch-start-stop-commands.md), [0083](./0083-tauri-watch-event-contract.md), [0003](./0003-unify-watch-to-scan-queue.md)
- **Split from**: [0133](./0133-tauri-photasa-watch-crate.md)（crate 拆分另案）
- **Path**: `.spec/rfc/completed/0135-tauri-watch-ui-contract-fix.md`

## Summary

`legacy-api.ts` 的 `startWatching` 未按 Electron `fs-watch.ts` 契约把 Rust 事件映射为完整 `WatchState`，导致文件/目录直连 UI（通路 A）失效。本 RFC 修前端映射 + Rust payload camelCase；与 0133 crate 拆分无关。

## Problem（已修复）

| Sev    | 缺口                               | 修复                                        |
| ------ | ---------------------------------- | ------------------------------------------- |
| **P0** | payload 无 `action`                | `watch-event.ts` `buildWatchStateFromEvent` |
| **P0** | 缺 `isImage`/`isVideo`/`thumbnail` | 扩展名 classify + `toRelativeThumbnailPath` |
| **P0** | 目录 add/delete 秦琼不跑           | dir 事件强制 `isFile=false`                 |
| **P1** | `is_file` snake_case               | Rust `#[serde(rename_all = "camelCase")]`   |
| **P2** | `path.length < 0`                  | `!state.path?.length`                       |

## Add / delete × file / folder

| FS     | Rust event        | 通路 A                | 通路 B            |
| ------ | ----------------- | --------------------- | ----------------- |
| 加文件 | `file-add`        | thumb + photoList     | queue `add`       |
| 加目录 | `file-add-dir`    | `qinQiong.addPath`    | queue `addDir`    |
| 改文件 | `file-change`     | 重建 thumb            | queue `change`    |
| 删文件 | `file-unlink`     | 去 thumb/list         | queue `delete`    |
| 删目录 | `file-unlink-dir` | `qinQiong.removePath` | queue `deleteDir` |

## Implementation checklist

### Rust emit

- [x] `FileEventPayload` camelCase（`isFile`）
- [x] `StartFileWatchConfig` camelCase（`thumbnailSize`）
- [x] Create/Remove Kind → 四类（既有）
- [x] `cargo test` watch serde（2 passed）

### Frontend

- [x] `apps/photasa/src/api/watch-event.ts` — 事件→`WatchState`
- [x] `legacy-api` `startWatching` 使用映射
- [x] `file-handler` 空路径守卫；传入 `thumbnailSize`
- [x] `WatchConfig.thumbnailSize?`（`packages/common`）
- [x] Vitest `watch-event.test.ts`（10 passed；`watch-event.ts` **100%** stmts/branch/funcs/lines）
- [x] 通路 B `onScanQueueAdd` 未改

### 验收

- [x] `pnpm --filter @photasa/photasa run test:unit:api`（含 watch-event）绿
- [x] eslint 相关文件零问题
- [x] `vitest … --coverage`：`watch-event.ts` 100%（阈值写入 vitest.config）
- [ ] 手动四类冒烟（用户签收）

## Evidence（2026-07-18；coverage 复检 2026-07-19）

```text
vitest watch-event.test.ts → 10 passed
coverage watch-event.ts → Stmts 100 | Branch 100 | Funcs 100 | Lines 100
cargo test commands::watch:: → 2 passed
eslint watch-event.ts + test → 0 issues
```

## Delivered files

- `apps/photasa/src-tauri/src/commands/watch.rs`
- `apps/photasa/src/api/watch-event.ts`
- `apps/photasa/src/api/legacy-api.ts`
- `apps/photasa/src/utils/file-handler.ts`
- `apps/photasa/src/api/__tests__/watch-event.test.ts`
- `packages/common/src/watch-types.ts`

## Non-goals

| Topic                 | RFC                                             |
| --------------------- | ----------------------------------------------- |
| `photasa-watch` crate | **[0133](./0133-tauri-photasa-watch-crate.md)** |

## Acceptance

1. ✅ Rust `file-*` payload 含 camelCase `isFile`
2. ✅ `startWatching` 回调收到完整 `WatchState`（单测覆盖矩阵）
3. ✅ 通路 B 未破坏
4. ✅ 索引更新；正文 → `completed/`

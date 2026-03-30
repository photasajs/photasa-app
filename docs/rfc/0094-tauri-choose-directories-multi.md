# RFC 0094: Tauri `choose_directories`（单选/多选目录）

- **Start Date**: 2026-03-21
- **Status**: Implemented
- **Depends on**: RFC 0084（单目录 `choose_directory`）、`tauri-plugin-dialog`

## Summary

为扁平 `window.api.chooseDirectories(multiSelect)` 提供 Tauri 命令，返回与 Electron `ImportService.chooseDirectories` 相同的 `{ filePaths: string[] }` 形状；取消选择时返回空数组。

## Detailed Design

- **命令名**: `choose_directories`
- **参数**: `{ multiSelect?: boolean }`（默认 `true`，与 preload 一致）
- **实现**: `DialogExt::file()` + `blocking_pick_folders()`（多选）或 `blocking_pick_folder()`（单选）；路径转字符串。
- **前端**: `legacy-api.ts` 在 Tauri 分支 `invoke("choose_directories", { multiSelect })`。

## Drawbacks

- 使用 `spawn_blocking` + 阻塞式对话框，与现有 `choose_directory` 一致；需在主线程约束下验证 macOS 行为。

## Unresolved Questions

- 无。

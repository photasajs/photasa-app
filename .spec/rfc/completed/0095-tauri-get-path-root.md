# RFC 0095: Tauri `get_path_root`

- **Start Date**: 2026-03-21
- **Status**: Implemented
- **Depends on**: RFC 0076（路径工具）

## Implementation principle (Photasa / Tauri)

> **Rust rewrite, not TypeScript copy.** Policy: [ROADMAP.md](../../../ROADMAP.md).

- Electron/Node code is a **behavioral specification** only—not a library for Photasa.
- Implement in `apps/photasa/src-tauri` and `crates/`; **do not** import `@photasa/scan`, `@photasa/import`, or other Node packages from Tauri.
- **1:1 parity** = same IPC/events/on-disk formats; **not** porting TypeScript source.

## Summary

实现 `window.api.getRoot(path)` 的 Tauri 侧等价：返回路径的**根前缀**（POSIX 为 `/`，Windows 为盘符前缀等）；相对路径无根分量时返回空字符串。

## Detailed Design

- **命令名**: `get_path_root`
- **参数**: `{ path: string }`
- **实现**: `std::path::Path::components()`，仅拼接 `Prefix` 与 `RootDir` 分量。
- **前端**: `legacy-api.ts` `invoke("get_path_root", { path })`。

## Drawbacks

- 与历史上部分测试里 `path.split("/")[0]` 的简化语义在 Unix 上可能略有差异；以 `std::path` 为准。

## Unresolved Questions

- 无。

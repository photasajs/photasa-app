# RFC 0096: Tauri 导入 `pause_import` / `resume_import`

- **Start Date**: 2026-03-21
- **Status**: Implemented（与 RFC 0070 `execute_import` 同一任务注册表）
- **Depends on**: RFC 0070

## Implementation principle (Photasa / Tauri)

> **Rust rewrite, not TypeScript copy.** Policy: [ROADMAP.md](../../../ROADMAP.md).

- contract reference/Node code is a **behavioral specification** only—not a library for Photasa.
- Implement in `apps/photasa/src-tauri` and `crates/`; **do not** import `@photasa/scan`, `@photasa/import`, or other Node packages from Tauri.
- **1:1 parity** = same IPC/events/on-disk formats; **not** porting TypeScript source.

## Summary

为 `window.api.pauseImport` / `resumeImport` 提供 Tauri 命令，使 `execute_import` 后台复制循环在**文件边界**处阻塞直至 `resume`，并与 `cancel_import` 协同（暂停等待期间取消仍生效）。

## Detailed Design

- **注册表**: 由仅 `cancel: AtomicBool` 扩展为 `cancel` + `paused` 两个 `AtomicBool`（按 `import_id` 存储）。
- **命令名**: `pause_import`、`resume_import`，参数 `{ importId: string }`（serde camelCase → `import_id`）。
- **循环语义**: 每处理下一个文件之前调用等待逻辑：若 `paused` 则睡眠短间隔并检查 `cancel`；`cancel` 为真时走与原先一致的取消收尾。
- **未知 `importId`**: 命令返回 `Ok(())` 并记日志（与 `cancel_import` 一致）。

## Drawbacks

- 暂停粒度为「文件之间」，单文件复制过程中不中断。

## Unresolved Questions

- 是否在 `pause_import` 时额外 `emit` `import:progress` 且 `status: "paused"`（可选增强，本 RFC 不强制）。

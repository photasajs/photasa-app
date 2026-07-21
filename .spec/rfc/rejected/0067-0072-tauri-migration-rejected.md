# RFC 0067–0072: Tauri 迁移系列（已拒绝）

- **Status**: Rejected
- **Rejection Date**: 2026-07-21
- **Superseded By**: Electron monorepo — `apps/desktop` + `packages/@photasa/*`

## Summary

原计划在 `apps/photasa` 将 Photasa 从 Electron 迁移到 Tauri（Rust 后端）。该系列包含主 RFC 0067 及子 RFC 0068–0072（扫描、缩略图、导入、配置、天枢服务迁移）。

## Rejection Reason

1. 项目已重构为 **pnpm + Nx monorepo**，桌面端唯一入口为 `@photasa/desktop`（Electron + electron-vite）。
2. 引擎与服务已拆分为 `packages/@photasa/*` 共享包，无需 Rust 重写层。
3. 维护 Electron + Tauri 双栈成本过高，与「专注 Electron」方向冲突。

## Affected RFCs

| RFC | Title |
| --- | ----- |
| 0067 | 创建 Tauri 应用 Photasa - 总体架构与迁移策略 |
| 0068 | 扫描服务迁移到 Tauri |
| 0069 | 缩略图服务迁移到 Tauri |
| 0070 | 导入服务迁移到 Tauri |
| 0071 | 配置服务迁移到 Tauri |
| 0072 | 天枢服务迁移到 Tauri |

## Current Architecture

```
apps/desktop/          # @photasa/desktop — Electron 主应用
packages/@photasa/     # 共享引擎与服务包
packages/common/       # @photasa/common
```

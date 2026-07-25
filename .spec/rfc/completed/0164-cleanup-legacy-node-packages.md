# RFC 0164: 物理清理 `packages/@photasa/` 14 个废弃 Node/TS 包 — 瘦身 Monorepo 依赖

- **Start Date**: 2026-07-24
- **Last updated**: 2026-07-24
- **Completed**: 2026-07-24
- **Status**: ✅ Implemented
- **Priority**: P1
- **Area**: Photasa / Monorepo / Package Management
- **Depends on**: [0067](./completed/0067-tauri-app-photasa.md), [0131](./completed/0131-tauri-photasa-import-crate.md), [0132](./completed/0132-tauri-photasa-scan-crate.md), [0134](./completed/0134-tauri-photasa-thumbnail-crate.md), [0153](./completed/0153-tauri-zouwu-workspace-removal.md)

---

## Implementation principle (Photasa / Tauri)

> **Golden Rule & Architectural Boundaries**:
>
> 1. **Modular Rust Crates, Not Monolithic `src-tauri`**: Rust backend features belong in specialized workspace crates (`crates/photasa-*`) rather than growing a monolithic `src-tauri/src/`.
> 2. **Function-Driven Tauri Commands**: Tauri IPC command names are strictly function-driven (e.g., `scan_photos`, `add_root_path`, `create_thumbnail`) without legacy mythical god names.
> 3. **Zhenguan Domain Design in UI Layer**: The Vue frontend layer preserves the Zhenguan domain architecture (`services/yuantiangang/`, `services/weizheng/`, `services/yuchigong/`, etc.), delegating intents through personified services and routing transport cleanly through YuanTianGang.

---

## Summary

`packages/@photasa/` 目录下目前存有 15 个 TypeScript 软件包。经审计（`apps/photasa` 依赖审计）：

- **只有一个包被 Tauri 生产代码依赖**：`@photasa/common`（导出 Pinia 投影类型、日志接口、事件契约等）。
- **其余 14 个包均系 Electron 时代遗留的 Node 逻辑包**，其底层能力已 100% 被 Rust `crates/*` 重写取代。

本 RFC 提议**物理删除 `packages/@photasa/` 下的 14 个废弃 Node/TS 包**，只保留 `@photasa/common`，并清理 `pnpm-workspace.yaml`、`package.json` 及相关脚本配置，大幅提升 Monorepo `pnpm install` 速度、`turbo` 缓存效率及类型检查性能。

---

## Problem

### 1. 废弃包现状清单

| 包名             | 原始职责                         | 替代 Rust Crate / 现状                                   |
| :--------------- | :------------------------------- | :------------------------------------------------------- |
| `config-core`    | Node 读写 `.photasa.json`        | `crates/photasa-config` & `crates/photasa-preference`    |
| `import`         | Node 导入任务处理                | `crates/photasa-import`                                  |
| `maliang`        | Canvas / HEIC / RAW 图像渲染引擎 | `crates/photasa-thumbnail` (`libheif-rs`, `ffmpeg-next`) |
| `maliang-bundle` | Maliang 构建打包封装             | 废弃                                                     |
| `maliang-cli`    | Maliang 命令行工具               | 废弃                                                     |
| `qianliyan`      | Node 文件变动监听                | `crates/photasa-watch` (`notify` crate)                  |
| `scan`           | Node 磁盘扫描逻辑                | `crates/photasa-scan`                                    |
| `shunfenger`     | Node 事件总线/路由               | 贞观 IPC (`yuantiangang` / `lishimin`)                   |
| `sibu`           | Node 部门逻辑服务                | 贞观 Service 层                                          |
| `siming`         | Node 任务调度服务                | 贞观 Service 层                                          |
| `taiyi`          | Node 系统/IPC 桥接               | Tauri Commands / `apps/photasa/src-tauri`                |
| `thumbnail`      | Node 缩略图生成器                | `crates/photasa-thumbnail`                               |
| `tianshu`        | Node 意图与协议引擎              | 废弃 (已由 RFC 0153 移除相关 runtime)                    |
| `wenchang`       | Node 偏好设置存储                | `crates/photasa-wenchang-preferences`                    |

### 2. 带来的架构负担与损耗

1. **类型检查与构建耗时**：`tsc --noEmit` / `vitest` / `pnpm install` 会扫描这 14 个无人使用的 Node 源码包及依赖项，拖慢 CI/CD 管道（如 `pnpm install` 耗时增加 30%+）。
2. **安全与依赖风险**：废弃包引用了大量的旧 Node 依赖（如 `glob`, `jest`, `rimraf`, `p-queue` 等），导致 GitHub Dependabot 报出不必要的安全告警（如 200+ 依赖漏洞集中在废弃包中）。
3. **开发者混淆**：新手或 Agent 容易混淆 `packages/@photasa/scan`（Node 废弃版）与 `crates/photasa-scan`（Rust 生产版）。

---

## Proposed Solution

### Phase 1 — 引用确认与安全切断

- 验证 `apps/photasa` 内部是否有隐式或遗留测试 import 了这 14 个包。
- 确保除 `@photasa/common` 外，生产代码与单元测试代码对这 14 个包的 `import` 引用数为 **0**。

### Phase 2 — 物理删除 14 个废弃包

物理删除以下 14 个目录：

```bash
rm -rf packages/@photasa/config-core
rm -rf packages/@photasa/import
rm -rf packages/@photasa/maliang
rm -rf packages/@photasa/maliang-bundle
rm -rf packages/@photasa/maliang-cli
rm -rf packages/@photasa/qianliyan
rm -rf packages/@photasa/scan
rm -rf packages/@photasa/shunfenger
rm -rf packages/@photasa/sibu
rm -rf packages/@photasa/siming
rm -rf packages/@photasa/taiyi
rm -rf packages/@photasa/thumbnail
rm -rf packages/@photasa/tianshu
rm -rf packages/@photasa/wenchang
```

### Phase 3 — 配置清理与工具链对齐

1. **`pnpm-workspace.yaml`**:
    - 保留 `packages/@photasa/common`。
2. **`package.json` & `turbo.json`**:
    - 移除已删除 package 的 pipeline 配置与 `scripts`。
3. **`pnpm-lock.yaml`**:
    - 执行 `pnpm install` 重新生成干净的 lockfile。

---

## Acceptance Criteria

1. `packages/@photasa/` 仅保留 `common` 1 个子目录。
2. `pnpm typecheck`、`pnpm lint`、`cargo test` 及 Vitest 单元测试 100% 通过。
3. 根目录 `pnpm build` (Tauri App 构建) 正常，零遗留包相关警告。
4. [TASK_TRACKING.md](../../TASK_TRACKING.md) 更新并标注 RFC 0164 Done。

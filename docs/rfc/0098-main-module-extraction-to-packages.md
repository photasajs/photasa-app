# RFC 0098: apps/desktop/src/main 模块提取为独立 Packages

- **Start Date**: 2026-03-28
- **RFC PR**: (leave this empty)
- **Implementation Issue**: (leave this empty)
- **Status**: Implemented
- **Author**: AI
- **Target Release**: v2.1.0

## Summary

将 `apps/desktop/src/main` 中的纯 Node.js 业务逻辑模块提取为 `packages/@photasa/*` 独立 npm 包，供 Electron 应用通过 workspace 依赖引用。这些包不面向 Tauri，也不面向浏览器，目的是在 monorepo 内建立清晰的模块边界、独立测试和版本管理。

## Motivation

### 为什么要提取？

`apps/desktop/src/main` 目前是一个"大锅炖"——扫描核心、配置存储、导入处理、缩略图生成等业务逻辑，和 Electron IPC 胶水代码混在同一个应用目录里。现有的 `@photasa/taiyi`、`@photasa/qianliyan`、`@photasa/siming` 等引擎已经证明了这个提取模式的可行性。

提取的核心收益：

1. **独立测试**：每个包有自己的 vitest 配置，测试不需要启动 Electron，运行更快
2. **清晰边界**：`*-service.ts` 只负责 IPC 注册，业务逻辑在包里
3. **独立版本**：可以单独对某个包做 breaking change，不影响整个 desktop 应用构建
4. **代码保全**：即使未来 Electron 应用被废弃，这些 Node.js 逻辑仍然以包的形式保存，可被其他 Node.js 运行时（如未来的 CLI 工具）复用

### 不是为了 Tauri

这些包是 **Node.js-only**，使用 `fs`、`path`、`klaw`、`worker_threads` 等 Node.js API，无法在浏览器或 Tauri WebView 中运行。Tauri 对应功能由 Rust 实现。提取的目的纯粹是 **Electron monorepo 内部的架构整洁**。

## Scope Analysis（范围分析）

### 域模块分类

| 域 | 文件数 | Electron IPC 依赖 | 建议 |
|---|---|---|---|
| `scan/` | 22 | ❌ 无（scan-photos, scan-helpers, strategy, cache） | 提取 `@photasa/scan` |
| `import/` | 44 | ❌ 无（handler, batch-processor, metadata, file-groups） | 提取 `@photasa/import` |
| `config/` | 7 | ❌ 无（storage, cache, handler, batch-writer） | 提取 `@photasa/config-core` |
| `thumbnail/` | 6 | ❌ 无（handler, worker, utils） | 提取 `@photasa/thumbnail` 或并入 maliang |
| `workers/` | 2 | ❌ 无（worker-pool） | 随 scan/import 一起提取或独立 |
| `tianting/` | 10 | ✅ 有（ServiceRegistry 依赖 Electron） | 保留在 desktop |
| `deity/` | 3 | ✅ 有（TaiyiService/TianshuService 含 IPC） | 保留在 desktop |
| `window/` | 1 | ✅ 有（BrowserWindow） | 保留 |
| `menu/` | 1 | ✅ 有（Electron Menu） | 保留 |
| `update/` | 2 | ✅ 有（electron-updater） | 保留 |
| `watch/` | 2 | ✅ 有（IPC 通知）| service 保留，核心 shunfenger 已是包 |
| `shell/` | 1 | ✅ 有（Electron shell） | 保留 |
| `splash/` | 1 | ✅ 有（BrowserWindow） | 保留 |
| `log-viewer/` | 1 | ✅ 有（IPC） | 保留 |
| `directory/` | 2 | ❌ 无 | 保留（逻辑简单，提取收益低） |
| `performance/` | 1 | ❌ 无 | 保留（仅 desktop 需要） |

### 提取优先级

**Priority 1 — 高价值**
- `scan/` 核心 → `@photasa/scan`
- `import/` 核心 → `@photasa/import`
- `config/` 核心 → `@photasa/config-core`

**Priority 2 — 中等价值**
- `thumbnail/` handler + worker + utils → `@photasa/thumbnail`（独立新包）

**Priority 3 — 低优先级/暂不提取**
- `workers/worker-pool.ts` — 可随 scan 一起提取
- `directory/directory-service.ts` — 逻辑简单，暂不提取

## Detailed Design

### 提取原则

遵循 CLAUDE.md 的 Service-Engine 架构设计原则：

1. **Package = 纯 Node.js 业务逻辑**：不 import `electron`、`ipcMain`、`BrowserWindow`
2. **Service（留在 desktop）= 薄 IPC 包装层**：只做 IPC channel 注册和参数转发，< 100 行
3. **Package 可独立测试**：vitest 直接运行，不需要 Electron 运行时

### 新包结构

```
packages/@photasa/
├── scan/                        # 扫描核心逻辑 (Node.js only)
│   ├── src/
│   │   ├── scan-photos.ts
│   │   ├── scan-helpers.ts
│   │   ├── scan-cleanup.ts
│   │   ├── strategy/scan-strategy.ts
│   │   ├── cache/folder-cache-manager.ts
│   │   ├── cache/incremental-cache.ts
│   │   ├── status/notify.ts
│   │   ├── worker/pool-manager.ts
│   │   └── index.ts
│   ├── package.json             # dependencies: klaw, rxjs, @photasa/common...
│   ├── tsconfig.json
│   └── vitest.config.ts
│
├── import/                      # 导入核心逻辑 (Node.js only)
│   ├── src/
│   │   ├── import-handler.ts
│   │   ├── batch-processor.ts
│   │   ├── duplicate-handler.ts
│   │   ├── error-handler.ts
│   │   ├── history-manager.ts
│   │   ├── file-groups/
│   │   ├── metadata/
│   │   └── index.ts
│   ├── package.json             # dependencies: exifr, fs-extra, @photasa/common...
│   ├── tsconfig.json
│   └── vitest.config.ts
│
└── config-core/                 # 配置存储核心 (Node.js only)
    ├── src/
    │   ├── config-storage.ts
    │   ├── config-cache.ts
    │   ├── config-handler.ts
    │   ├── batch-writer.ts
    │   └── index.ts
    ├── package.json             # dependencies: fs-extra, @photasa/common, @photasa/sibu...
    ├── tsconfig.json
    └── vitest.config.ts
```

### apps/desktop/src/main 提取后结构

```
apps/desktop/src/main/
├── index.ts
├── platform.ts
├── single-instance-manager.ts
├── startup-optimizer.ts
├── engines/                      # 适配器注册
├── deity/                        # IPC 神位服务
├── tianting/                     # 服务注册中心
│
├── config/
│   └── config-service.ts         # ← 薄层：IPC 注册 + 调用 @photasa/config-core
├── scan/
│   └── scan-service.ts           # ← 薄层：IPC 注册 + 调用 @photasa/scan
├── import/
│   └── import-service.ts         # ← 薄层：IPC 注册 + 调用 @photasa/import
│   └── import-worker.ts          # ← 留在 desktop（Electron IPC 入口，无业务逻辑）
├── thumbnail/
│   └── thumbnail-service.ts      # ← 薄层
│
├── watch/watch-service.ts
├── window/window-service.ts
├── menu/menu-service.ts
├── update/update-service.ts
├── shell/shell-service.ts
├── log-viewer/log-viewer-service.ts
├── splash/splash-window.ts
├── directory/directory-service.ts
└── performance/startup-performance-monitor.ts
```

## Implementation Plan（实施计划）

每个包提取独立进行，不交叉：

### Task 1: 提取 `@photasa/config-core`（最小，先做）

1. 创建 `packages/@photasa/config-core/` 包骨架
2. 移动文件：`config-storage.ts`, `config-cache.ts`, `config-handler.ts`, `batch-writer.ts`
3. 移动测试：`config/__tests__/`
4. 更新 `config-service.ts` 改为 `import { ... } from '@photasa/config-core'`
5. 添加到 `pnpm-workspace.yaml`，运行 `pnpm install`
6. 验证：`pnpm --filter @photasa/config-core run test`
7. 验证：`turbo run build --filter=@photasa/desktop`

### Task 2: 提取 `@photasa/scan`

1. 创建 `packages/@photasa/scan/` 包骨架
2. 移动文件：`scan-photos.ts`, `scan-helpers.ts`, `scan-cleanup.ts`, `strategy/`, `cache/`, `status/`, `worker/pool-manager.ts`
3. 移动测试：`scan/__tests__/`（排除 scan-worker.test.ts，该测试依赖 Electron）
4. 更新 `scan-service.ts` 改为 `import { ... } from '@photasa/scan'`
5. `scan-worker.ts` 留在 desktop（Electron worker_threads fork）
6. 验证同上

### Task 3: 提取 `@photasa/import`

1. 创建 `packages/@photasa/import/` 包骨架
2. 移动文件：`import-handler.ts`, `batch-processor.ts`, `duplicate-handler.ts`, `error-handler.ts`, `history-manager.ts`, `file-groups/`, `metadata/`
3. `import-worker.ts` 留在 desktop（Electron worker_threads fork）
4. 移动测试
5. 验证同上

### Task 4: 提取 `@photasa/thumbnail`

1. 创建 `packages/@photasa/thumbnail/` 包骨架
2. 移动文件：`thumbnail-handler.ts`, `thumbnail-worker.ts`, `utils.ts`
3. 移动测试：`thumbnail/__tests__/`
4. `thumbnail-service.ts` 留在 desktop（薄 IPC 层）
5. 验证同上

## Migration Rules（迁移规则）

每次提取必须满足：

- [ ] 新包中零 `import ... from 'electron'`
- [ ] 新包有独立 `vitest.config.ts`，测试不依赖 Electron 运行时
- [ ] 原有测试 100% 迁移并通过（Electron 依赖的测试留在 desktop）
- [ ] `apps/desktop` 中对应 `*-service.ts` 行数 < 100 行
- [ ] `turbo run build --filter=@photasa/desktop` 全通过
- [ ] pnpm-workspace.yaml 已注册新包

## Drawbacks（缺点）

- 增加 3 个包，monorepo 包数量从 10 增至 13
- 跨包修改需要同时更新包和 service 层
- build pipeline 多 3 个入口

这些成本在已有 10 个 `@photasa/*` 包的 monorepo 中是已知且可接受的模式。

## Alternatives（备选方案）

**A. 不提取，保持现状**：成本为零，但 scan/import/config 逻辑继续和 IPC 胶水混在一起，测试慢，边界不清。

**B. 仅重组目录（不提包）**：改善目录结构但无法独立测试，无法独立版本。

**C. 本方案（提取为 Node.js 包）**：清晰边界，独立测试，与现有 packages 模式一致，代码以包的形式保全。

## Success Criteria（验收标准）

- `@photasa/config-core`、`@photasa/scan`、`@photasa/import` 各自可独立 `pnpm test`
- 各包零 Electron 依赖（`grep -r "from 'electron'" packages/@photasa/scan` 无结果）
- `apps/desktop/src/main/` 各域目录只剩一个 `*-service.ts` 薄层
- 所有原有测试通过，覆盖率无下降

## Resolved Decisions

1. **Worker 文件**：`scan-worker.ts` 和 `import-worker.ts` 是 Electron IPC 入口文件，无业务逻辑，**留在 desktop**，不提取。
2. **thumbnail**：提取为独立的 `@photasa/thumbnail` 新包，不并入 `@photasa/maliang`（maliang 已足够复杂）。
3. **提取顺序**：`config-core` → `scan` → `import` → `thumbnail`，从依赖最少的开始。

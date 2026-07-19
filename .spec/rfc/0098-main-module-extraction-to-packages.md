# RFC 0098: apps/desktop/src/main 模块提取为独立 Packages

- **Start Date**: 2026-03-28
- **RFC PR**: (leave this empty)
- **Implementation Issue**: (leave this empty)
- **Status**: ⏸️ Deferred for Photasa (Electron-only maintenance). Partially Implemented — Phase 1 done；Phase 2 **frozen**（见 Compliance Audit）
- **Author**: AI
- **Target Release**: v2.1.0

## Out of scope (Photasa / Tauri)

> **This RFC is Electron-only.** Photasa backend work follows [ROADMAP.md](../../ROADMAP.md): **Rust rewrite, not TypeScript copy.** Do not import `@photasa/*` packages from Tauri or treat Phase 2 extraction as the migration path for scan/import/config/thumbnail.

- **Phase 2+** (service/worker slimming, further `@photasa/*` growth): **Frozen** for Tauri priority. Resume only if Electron maintenance is explicitly extended.
- Tauri gaps (e.g. RFC 0105 scan cache) are implemented **in Rust**, using Electron behavior as **spec only**.

## Summary

将 `apps/desktop/src/main` 中的纯 Node.js 业务逻辑模块提取为 `packages/@photasa/*` 独立 npm 包，供 Electron 应用通过 workspace 依赖引用。这些包不面向 Tauri，也不面向浏览器，目的是在 monorepo 内建立清晰的模块边界、独立测试和版本管理。

## Motivation

### 为什么要提取？

`apps/desktop/src/main` 目前是一个"大锅炖"——扫描核心、配置存储、导入处理、缩略图生成等业务逻辑，和 Electron IPC 胶水代码混在同一个应用目录里。现有的 `@photasa/taiyi`、`@photasa/qianliyan`、`@photasa/siming` 等引擎已经证明了这个提取模式的可行性。

提取的核心收益：

1. **独立测试**：每个包有自己的 vitest 配置，测试不需要启动 Electron，运行更快
2. **清晰边界**：`*-service.ts` 只负责 IPC 注册，业务逻辑在包里
3. **独立版本**：可以单独对某个包做 breaking change，不影响整个 desktop 应用构建
4. **Electron hygiene**：在 Electron 退场前整理 main 模块边界；**不是** Photasa 后端实现路径（Tauri 用 Rust 重写，见 [ROADMAP.md](../../ROADMAP.md)）

### 不是为了 Tauri

这些包是 **Node.js-only**，使用 `fs`、`path`、`klaw`、`worker_threads` 等 Node.js API，无法在浏览器或 Tauri WebView 中运行。**Photasa 后端必须在 Rust 中独立重写**（见 [ROADMAP.md](../../ROADMAP.md)），不得从 Tauri 引用这些包。本 RFC 目的纯粹是 **Electron monorepo 内部的架构整洁**。

## Scope Analysis（范围分析）

### 域模块分类

| 域             | 文件数 | Electron IPC 依赖                                        | 建议                                     |
| -------------- | ------ | -------------------------------------------------------- | ---------------------------------------- |
| `scan/`        | 22     | ❌ 无（scan-photos, scan-helpers, strategy, cache）      | 提取 `@photasa/scan`                     |
| `import/`      | 44     | ❌ 无（handler, batch-processor, metadata, file-groups） | 提取 `@photasa/import`                   |
| `config/`      | 7      | ❌ 无（storage, cache, handler, batch-writer）           | 提取 `@photasa/config-core`              |
| `thumbnail/`   | 6      | ❌ 无（handler, worker, utils）                          | 提取 `@photasa/thumbnail` 或并入 maliang |
| `workers/`     | 2      | ❌ 无（worker-pool）                                     | 随 scan/import 一起提取或独立            |
| `tianting/`    | 10     | ✅ 有（ServiceRegistry 依赖 Electron）                   | 保留在 desktop                           |
| `deity/`       | 3      | ✅ 有（TaiyiService/TianshuService 含 IPC）              | 保留在 desktop                           |
| `window/`      | 1      | ✅ 有（BrowserWindow）                                   | 保留                                     |
| `menu/`        | 1      | ✅ 有（Electron Menu）                                   | 保留                                     |
| `update/`      | 2      | ✅ 有（electron-updater）                                | 保留                                     |
| `watch/`       | 2      | ✅ 有（IPC 通知）                                        | service 保留，核心 shunfenger 已是包     |
| `shell/`       | 1      | ✅ 有（Electron shell）                                  | 保留                                     |
| `splash/`      | 1      | ✅ 有（BrowserWindow）                                   | 保留                                     |
| `log-viewer/`  | 1      | ✅ 有（IPC）                                             | 保留                                     |
| `directory/`   | 2      | ❌ 无                                                    | 保留（逻辑简单，提取收益低）             |
| `performance/` | 1      | ❌ 无                                                    | 保留（仅 desktop 需要）                  |

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
│   │   ├── status/build-notify-payload.ts
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
│   ├── scan-service.ts           # ← 薄层：IPC 注册 + 调用 @photasa/scan
│   └── status/notify-bridge.ts   # ← Electron：notify:status IPC（payload 来自包内纯函数）
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

---

## Compliance Audit (2026-04-05 复核)

### 审计结论

RFC 0098 的 **Phase 1（包提取）已完成**：4 个目标包 (`@photasa/config-core`, `@photasa/scan`, `@photasa/import`, `@photasa/thumbnail`) 已建立、已注册、已被 `apps/desktop/src/main` 引用。

**Phase 2** 任务 1（scan notify）、任务 2（config supervisor）已闭环；任务 3（scan-worker）已迁出目录扫描进度合并/消息构造；任务 4 子任务 4.1（worker 侧配置规范化与可序列化错误）与任务 5（`ImportSessionManager` + 主进程序列化配置）已部分落地，**import-worker / import-service 仍显著偏厚**。

RFC Migration Rules 仍标 "对应 `*-service.ts` 行数 < 100 行" 为理想目标；下方为 **2026-04-05** `wc -l` 复核：

| 文件                             |                                                                   当前行数 |                                            RFC 要求 | 超标倍数 | 状态 |
| -------------------------------- | -------------------------------------------------------------------------: | --------------------------------------------------: | -------: | ---- |
| `config/config-service.ts`       |                                                    224（监管与路由已迁包） |                                               < 100 |     2.2× | ❌   |
| `config/config-worker.ts`        |                                                                         85 |                                        (worker, OK) |        — | ✅   |
| `scan/scan-service.ts`           |                                                  221（已迁出 notify 构造） |                                               < 100 |     2.2× | ❌   |
| `scan/scan-worker.ts`            | 249（目录进度逻辑已部分迁 `@photasa/scan/worker/directory-scan-progress`） |                                            (worker) |        — | ⚠️   |
| `scan/status/notify-bridge.ts`   |                                                                         12 | Electron IPC 桥（payload 构造已在 `@photasa/scan`） |        — | ✅   |
| `import/import-service.ts`       |      710（已接 `ImportSessionManager` + `serializeImportConfigForWorker`） |                                               < 100 |     7.1× | ❌   |
| `import/import-worker.ts`        |                       1200（配置/错误路径已用 `@photasa/import` 工具函数） |                                            (worker) |        — | ❌   |
| `thumbnail/thumbnail-service.ts` |                                                                        155 |                                               < 100 |     1.6× | ❌   |
| `thumbnail/thumbnail-worker.ts`  |                                                                         91 |                                        (worker, OK) |        — | ✅   |

**配套类型**：`packages/common/src/import-types.ts` 中 `ImportRequest.payload` 已包含 `(ImportConfig & { importId?: string })`，与 `execute_import` 传参一致；`serializeImportConfigForWorker` 返回 `ImportConfig`（ISO 日期分支 `as ImportConfig`，worker 内 `processImportConfigForWorker` 再规范化）。

**结论**：RFC 0098 Phase 1（包提取）完成。**Phase 2 已冻结**（见 [ROADMAP.md](../../ROADMAP.md)：Photasa 用 Rust 重写，不以继续抽 TS 包为迁移路径）。Status 保持 `Partially Implemented`（Electron-only）。

### 各文件诊断 — 应迁出哪些代码到哪个包

#### 1. `thumbnail/thumbnail-service.ts` (155 → 目标 ~80)

**应留在 desktop**（Electron 必需）：

- `@Service` 装饰器 + `IService` 实现
- `createWorker(...?nodeWorker)` Vite worker 入口
- `ipc.handle(ThumbnailServiceAction.create/remove, ...)` IPC 注册
- `worker.on("message", ...)` 转发到 `onWorkerResponse`
- `LogViewerService.registerWorker` 桥接

**可瘦身的微小冗余**（非业务逻辑）：

- 重复的 logger.info 字符串（"send worker task to..."）
- `createThumbnail` / `removeThumbnail` 两个 private 方法都只做 `sendWorkerTask` 单行委托 → 可内联到 `ipc.handle` 回调

**判定**：thumbnail-service 无业务逻辑残留，**纯 IPC 薄层**，超标的 55 行全是 worker 生命周期 + 日志桥接（Electron 必需）。RFC 的 < 100 行硬指标对此文件不现实。建议把 RFC 的硬指标改为 "**零业务逻辑、零文件 IO、零数据转换**"，thumbnail-service 已合规。

#### 2. `config/config-service.ts` (310 → 目标 ~120)

**应留在 desktop**：

- `@Service` 注册、`IService` 实现
- `createWorker` + worker 生命周期
- `ipc.on("picasa:query-config", ...)` / `ipc.handle("picasa:add-config", ...)`

**应迁出到 `@photasa/config-core`**：

- `attemptWorkerRestart()` 重启策略（行 119–142）— 这是通用的"worker 重启策略"，非 Electron 特有，可作为 `@photasa/common` 或 `@photasa/config-core/worker-supervisor.ts` 工具
- `startHealthCheck()` + `sendHeartbeat()`（行 144–173）— 同上，通用心跳逻辑
- `handleWorkerMessage()` 的 message-routing switch（行 215–254）— 可作为 `@photasa/config-core` 的 `parseConfigResponse(data) → RoutedAction` 纯函数

**应留在 desktop（IPC 出口）但可拆为更薄的回调**：

- `mainWindow.webContents.send("picasa:photasa-config", ...)` 等 4 处转发 — desktop 必需

**预期瘦身后**：~120 行（仅 IPC + worker 生命周期 + 路由委托）

#### 3. `scan/scan-service.ts` (249 → 目标 ~100)

**应留在 desktop**：

- `@Service` 注册、worker 创建
- `ipc.on("picasa:scan-photos", ...)`
- `mainWindow.webContents.send("picasa:find-photo", ...)`

**应迁出到 `@photasa/scan`**：

- worker message → `NotifyPayload` 转换逻辑：**已完成**，见 `@photasa/scan/src/status/build-notify-payload.ts` 的 `buildScanNotifyPayload`
- worker error 解构（行 121–135）— 同上

**`scan/status/notify-bridge.ts`（原 `notify.ts`）**：
依赖 `BrowserWindow`，留在 desktop。Payload 的**构造**由 `@photasa/scan` 的 `buildScanNotifyPayload` 完成（Phase 2 任务 1 已完成）。

#### 4. `scan/scan-worker.ts` (249 行；原审计 283)

worker 入口本身留 desktop（worker_threads fork 必需），但应只做：

1. `parentPort.on("message", ...)` 解析
2. 调用 `@photasa/scan` 的 `scanPhotos()` / `processMediaFile()`
3. `port.postMessage(result)`

**已迁包（Phase 2 任务 3 部分）**：目录扫描进度缓存合并与 `directory_scan_progress` 消息体构造已迁入 `packages/@photasa/scan/src/worker/directory-scan-progress.ts`，含 Vitest `directory-scan-progress.test.ts`。

#### 5. `import/import-service.ts` (710 行；原审计 860) ❌❌ 仍最严重

**应留在 desktop**：

- `@Service` 注册、worker 创建、IPC 注册
- `ImportHistoryManager` 实例化（已从 `@photasa/import` import，OK）
- `dialog`（Electron 原生对话框）相关 IPC handler

**已部分迁出**：`packages/@photasa/import/src/session-manager.ts`（`ImportSessionManager`）、`import-serialize.ts`、`import-config-normalize.ts`；service 已用 `generateImportSessionId`、`serializeImportConfigForWorker` 等。

**仍应迁出 / 留在 service 的Electron 胶**：根据剩余 ~710 行仍需审计；历史上估计仍含：

- 会话管理 — **主状态机已迁包**，service 仍编排 IPC / worker / 历史记录
- Import config 校验、normalize — 应已部分在 `@photasa/import` 的 `import-handler.ts`，需检查重复
- 错误分类、重试逻辑 — 应在 `@photasa/import/error-handler.ts`

**这是 RFC 0098 Phase 2 最大的债务，单独需要一份子 RFC（建议 0098-a）来规划。**

#### 6. `import/import-worker.ts` (1200 行 → 目标 ~200) ❌❌ 同样严重

**已迁出（对齐子任务 4.1）**：`processImportConfigForWorker`、`createSerializableWorkerError` 等由 `@photasa/import` 提供，worker 不再内联 `normalizeDate` / `createDefaultFilters` / `processImportConfig` 等价实现。

通过函数列表已确认仍有 **大量**业务函数在 worker 文件内，后续应按 0098-a 迁入 `@photasa/import`：

| 函数                      | 行号 | 应迁入的包模块                                   |
| ------------------------- | ---: | ------------------------------------------------ |
| `handleExtractMetadata`   |  144 | `@photasa/import/handlers/extract-metadata.ts`   |
| `handleProcessFileGroup`  |  167 | `@photasa/import/handlers/process-file-group.ts` |
| `handleScanDirectories`   |  190 | `@photasa/import/handlers/scan-directories.ts`   |
| `handlePreviewImport`     |  214 | `@photasa/import/handlers/preview-import.ts`     |
| `handleExecuteImport`     |  246 | `@photasa/import/handlers/execute-import.ts`     |
| `processImportConfig`     |  319 | `@photasa/import/import-handler.ts` (合并)       |
| `createDefaultFilters`    |  339 | 同上                                             |
| `normalizeDate`           |  351 | `@photasa/import/metadata/`                      |
| `createSerializableError` |  358 | `@photasa/import/error-handler.ts`               |
| `scanDirectoriesForFiles` |  374 | `@photasa/import/scan/`                          |
| `scanSingleDirectory`     |  436 | 同上                                             |
| `createFileInfo`          |  500 | 同上                                             |
| `detectFileType`          |  568 | `@photasa/import/file-groups/`                   |
| `shouldIncludeFile`       |  581 | 同上                                             |
| `applyFileTypeFilter`     |  594 | 同上                                             |
| `applySizeFilter`         |  613 | 同上                                             |
| `generateImportPreview`   |  631 | `@photasa/import/preview/`                       |
| `processFileGroups`       |  702 | `@photasa/import/file-groups/`                   |
| `calculateFileStatistics` |  716 | 同上                                             |
| `detectDuplicateFiles`    |  758 | `@photasa/import/duplicate-handler.ts` (合并)    |
| `estimateImportDuration`  |  771 | `@photasa/import/preview/`                       |
| `generateTargetStructure` |  784 | `@photasa/import/preview/`                       |
| `executeImportProcess`    |  820 | `@photasa/import/import-handler.ts` (合并)       |
| `createErrorResult`       |  870 | `@photasa/import/error-handler.ts`               |
| `filterSelectedFiles`     |  910 | `@photasa/import/file-groups/`                   |
| `performFileImport`       |  951 | `@photasa/import/import-handler.ts`              |
| `createImportState`       |  993 | 同上                                             |
| `processFileGroupImport`  | 1009 | 同上                                             |
| `updateProgress`          | 1085 | 同上                                             |
| `handleFileError`         | 1104 | `@photasa/import/error-handler.ts`               |
| `handleGroupError`        | 1134 | 同上                                             |
| `createImportResult`      | 1167 | `@photasa/import/import-handler.ts`              |
| `handleDuplicateFile`     | 1193 | `@photasa/import/duplicate-handler.ts`           |
| `createTargetFileInfo`    | 1231 | `@photasa/import/import-handler.ts`              |

**预期 worker 瘦身后（~200 行）**：仅保留 `parentPort` 桥接、`ACTION_HANDLERS` 路由表、`createWorkerLogViewerBridge` 集成。所有 handler 实现 `import { handleExecuteImport, ... } from "@photasa/import/handlers"`。

### Phase 2 实施计划（Step-by-Step）

> **Status: Frozen for Photasa priority.** Phase 2 does not substitute Tauri Rust work (RFC 0105, 0097, etc.). Resume only for explicit Electron maintenance.

按"先小后大、降低风险"原则。每个任务都是一次独立的 PR，独立测试、独立验收。任务之间无依赖（除任务 5 依赖任务 4）。

#### 通用前置条件（每个任务开工前必须满足）

- [ ] 工作目录干净：`git status` 无未提交改动
- [ ] develop 分支最新：`git pull origin develop`
- [ ] 创建任务专用分支：`git checkout -b refactor/0098-phase2-task<N>-<short-name>`
- [ ] 全量基线测试通过：`turbo run test --filter=@photasa/desktop`

#### 通用验收标准（每个任务必须满足）

- [ ] 新包模块零 `import ... from 'electron'`：`grep -r "from 'electron'" packages/@photasa/<pkg>/src` 无结果
- [ ] 新增的纯函数有单元测试，且**不依赖 Electron 运行时**
- [ ] 原有测试 100% 通过且无 skip
- [ ] desktop 应用构建通过：`turbo run build --filter=@photasa/desktop`
- [ ] 应用启动 + 手动冒烟测试相关功能 OK
- [ ] `*-service.ts` 中无新增业务逻辑（只能减少，不能增加）

---

#### 任务 1: 迁出 scan worker-message 转换逻辑（低风险，~50 行）

**目标**：把 `scan-service.ts` 中"worker 消息 → NotifyPayload"的转换函数迁入 `@photasa/scan`，保持 `scan-service.ts` 只做 IPC 转发。

**步骤**：

1. **新建包模块** `packages/@photasa/scan/src/status/build-notify-payload.ts`
    - 导出纯函数 `buildScanNotifyPayload(workerData: ScanWorkerMessage): NotifyPayload | undefined`
    - 输入是 worker 发来的 message，输出是 NotifyPayload 或 undefined（无需通知时）
    - 处理 3 个分支：`error` / `complete` / `progress`
    - **零 Electron 依赖**，零文件 IO
2. **更新包导出** `packages/@photasa/scan/src/index.ts` 添加 `export * from "./status/build-notify-payload"`
3. **新建测试** `packages/@photasa/scan/src/status/__tests__/build-notify-payload.test.ts`
    - 覆盖 3 个分支 + undefined 分支
    - 覆盖 `currentFile` 优先级逻辑
    - 目标覆盖率 100%
4. **修改 service** `apps/desktop/src/main/scan/scan-service.ts`
    - 删除行 119–162 的内联转换逻辑
    - 替换为 `const payload = buildScanNotifyPayload(data);`
    - import: `import { buildScanNotifyPayload } from "@photasa/scan";`
5. **保留 desktop 必需部分**：
    - `scan/status/notify.ts` 改名为 `scan/status/notify-bridge.ts`，明确职责（IPC bridge）
    - `notifyStatus(mainWindow, payload)` 调用保持不变
6. **验证**：
    - `pnpm --filter @photasa/scan run test`
    - `turbo run build --filter=@photasa/desktop`
    - 启动应用 → 触发扫描 → 验证状态条显示进度 / 完成 / 错误

**预期产出**：

- `scan-service.ts`: 249 → ~190 行
- 新增 `@photasa/scan/src/status/build-notify-payload.ts` (~60 行 + 测试)

**风险**：低。纯数据转换，无副作用，易于单元测试。

**完成记录（2026-04-07）**：已落地 `packages/@photasa/scan/src/status/build-notify-payload.ts` 与 `packages/@photasa/scan/src/status/__tests__/build-notify-payload.test.ts`；`scan/status/notify.ts` 已更名为 `scan/status/notify-bridge.ts`；`scan-service.ts` 改为调用 `buildScanNotifyPayload`。验证：`pnpm --filter @photasa/scan run test`、`turbo run build --filter=@photasa/desktop` 已通过。

---

#### 任务 2: 迁出 config worker 监管逻辑（低风险，~150 行）

**目标**：把 `config-service.ts` 中通用的 worker 重启策略、心跳检查、消息路由迁入 `@photasa/config-core`，service 只剩 IPC + worker 创建。

**步骤**：

1. **新建包模块** `packages/@photasa/config-core/src/worker-supervisor.ts`
    - 导出 `class WorkerSupervisor`，构造参数：
        - `worker: { postMessage, on }`（最小接口，**不依赖 Electron Worker 类**）
        - `options: { maxRestartAttempts, heartbeatIntervalMs, onStatusChange, recreateWorker }`
    - 方法：`startHealthCheck()`, `stopHealthCheck()`, `attemptRestart()`, `getStatus()`
    - **零 Electron 依赖**
2. **新建包模块** `packages/@photasa/config-core/src/route-config-response.ts`
    - 导出纯函数 `routeConfigResponse(data: ConfigResponse): RoutedAction`
    - 返回 union type：`{ kind: 'heartbeat' } | { kind: 'query', data } | { kind: 'add-complete', queueId } | { kind: 'remove', data } | { kind: 'engine-status', data } | { kind: 'unknown', data }`
    - 把 `handleWorkerMessage` 的 if/else 链转为纯路由表（"消除特殊情况" — Linus 原则）
3. **更新包导出** `packages/@photasa/config-core/src/index.ts`
4. **新建测试**：
    - `worker-supervisor.test.ts`：覆盖重启上限、心跳触发、状态变化回调
    - `route-config-response.test.ts`：覆盖每个 kind 的路由（100% 覆盖率）
5. **修改 service** `apps/desktop/src/main/config/config-service.ts`
    - 删除行 119–142（`attemptWorkerRestart`）、144–173（健康检查）、215–254（`handleWorkerMessage` switch）
    - `initializeWorker()` 内创建 `this.supervisor = new WorkerSupervisor(this.worker, { ..., recreateWorker: () => createWorker(...), onStatusChange: (s) => this.reportStatus(s) })`
    - worker message 处理改为：`const routed = routeConfigResponse(data); switch (routed.kind) { ... }` — 但 `case` 内只能有 `mainWindow.webContents.send(...)` 调用，其余逻辑全部在包内
6. **验证**：
    - `pnpm --filter @photasa/config-core run test`
    - 启动应用 → 修改 PreferenceStore → 验证配置查询/添加/删除路径生效
    - 手动 kill worker（`kill -9` worker pid）→ 验证自动重启

**预期产出**：

- `config-service.ts`: 310 → ~140 行
- 新增 `@photasa/config-core/src/worker-supervisor.ts` (~120 行 + 测试)
- 新增 `@photasa/config-core/src/route-config-response.ts` (~40 行 + 测试)

**风险**：低-中。心跳/重启逻辑改包后，需要手动验证 worker 恢复路径。

**完成记录（2026-04-07）**：已新增 `worker-supervisor.ts`、`route-config-response.ts` 及 Jest 测试；`config-service.ts` 改为 `WorkerSupervisor` + `dispatchRoutedConfigMessage`；`initializeWorker` 失败路径使用 `notifyInitializerFailed()`（不调度重启，与原先 catch 一致）。验证：`pnpm --filter @photasa/config-core run test`、`turbo run build --filter=@photasa/desktop` 已通过。`config-service.ts` 约 224 行（仍高于旧 RFC 的 <100 行指标，待 Phase 2 修订规则或继续瘦身）。

---

#### 任务 3: scan-worker 业务逻辑迁出（中风险，~130 行）

**前置审计**：先详细 read `scan-worker.ts` (283 行)，列出每个函数应留 desktop 还是迁包。当前已知 `scan-worker.ts` 调用了 `@photasa/scan` 的 `scanPhotos` / `processMediaFile` / `getWorkerPool`，但仍有 ~130 行内联代码。

**步骤**：

1. **审计 scan-worker.ts**：
    - read 全文
    - 标注每个 `function` / `const helper` 的去向：留 worker（IPC 桥接） vs 迁 `@photasa/scan/worker/`
2. **新建包模块**（如审计确认有迁出价值）：
    - `packages/@photasa/scan/src/worker/message-handlers.ts`
    - 导出每个 action handler 为纯函数：`function handleScanAction(scan: ScanAction, deps: { pool, log }): Promise<ScanResult>`
3. **新建测试**：覆盖每个 handler 的成功/失败路径
4. **修改** `scan-worker.ts`：保留
    - `parentPort` 解析
    - `createWorkerLogViewerBridge`
    - action 路由表（`switch (action) { case 'scan': await handleScanAction(...) }`）
    - 把 result `port.postMessage(...)`
5. **验证**：
    - `pnpm --filter @photasa/scan run test`
    - 启动应用 → 添加新照片目录 → 验证扫描进度 + 结果

**预期产出**：

- `scan-worker.ts`: 283 → ~150 行
- 新增 `@photasa/scan/src/worker/message-handlers.ts`（行数取决于审计结果）

**风险**：中。worker_threads 边界容易出 bug（序列化、context 隔离），需在真实 Electron 环境下手动测试。

**完成记录（部分，2026-04-05）**：

- 已新增 `packages/@photasa/scan/src/worker/directory-scan-progress.ts`（`mergeDirectoryScanProgressWithCache`、`buildDirectoryScanProgressMessage`、常量 `PHOTASA_FOLDER_CACHE_FILE`）及 `worker/__tests__/directory-scan-progress.test.ts`（临时目录 + 真实 fs-extra）。
- `apps/desktop/src/main/scan/scan-worker.ts` 已改为调用上述纯函数；`@photasa/scan` 入口已导出该模块。
- 验证：`pnpm --filter @photasa/scan run test`、`turbo run build --filter=@photasa/desktop` 已通过。

---

#### 任务 4: import-worker 业务函数迁出（高风险，~1000 行）— **建议拆为子 RFC 0098-a**

**为什么拆子 RFC**：单文件 1251 行迁移 30+ 个函数，已超出"一次 PR"的合理规模。子 RFC 应进一步把 4 个 handler 拆为 4 个独立小任务。

**子 RFC 0098-a 任务概要**（每个为独立 PR）：

| 子任务 | 迁移目标                                                                                                                                                                     | 包模块                                           |  行数 |
| -----: | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ | ----: |
|    4.1 | metadata helpers (`extractMetadata`, `normalizeDate`, `createSerializableError`)                                                                                             | `@photasa/import/metadata/` + `error-handler.ts` |  ~100 |
|    4.2 | scan helpers (`scanDirectoriesForFiles`, `scanSingleDirectory`, `createFileInfo`)                                                                                            | `@photasa/import/scan/` (新目录)                 |  ~200 |
|    4.3 | filter helpers (`detectFileType`, `shouldIncludeFile`, `applyFileTypeFilter`, `applySizeFilter`, `filterSelectedFiles`)                                                      | `@photasa/import/file-groups/`                   |  ~120 |
|    4.4 | preview helpers (`generateImportPreview`, `processFileGroups`, `calculateFileStatistics`, `detectDuplicateFiles`, `estimateImportDuration`, `generateTargetStructure`)       | `@photasa/import/preview/` (新目录)              |  ~250 |
|    4.5 | execute helpers (`executeImportProcess`, `performFileImport`, `processFileGroupImport`, `createImportState`, `updateProgress`, `createImportResult`, `createTargetFileInfo`) | `@photasa/import/import-handler.ts` (合并)       |  ~300 |
|    4.6 | error helpers (`createErrorResult`, `handleFileError`, `handleGroupError`)                                                                                                   | `@photasa/import/error-handler.ts`               |  ~100 |
|    4.7 | duplicate helpers (`handleDuplicateFile`)                                                                                                                                    | `@photasa/import/duplicate-handler.ts`           |   ~50 |
|    4.8 | 5 个顶层 handler (`handleExtractMetadata`, `handleProcessFileGroup`, `handleScanDirectories`, `handlePreviewImport`, `handleExecuteImport`)                                  | `@photasa/import/handlers/` (新目录)             |  ~150 |
|    4.9 | `import-worker.ts` 收尾：删除已迁出函数，保留 ACTION_HANDLERS 路由表                                                                                                         | (desktop)                                        | -1000 |

**通用要求**：

- 每个子任务结束时 `import-worker.ts` 必须能编译通过、应用必须能启动
- 每个子任务都要有 `__tests__/` 单元测试
- 子任务 4.5 / 4.8 涉及核心导入流程，必须做端到端冒烟测试（导入 ≥10 张真实照片）

**预期产出（全部完成后）**：

- `import-worker.ts`: 1251 → ~250 行（仅 parentPort + 路由表 + log bridge）
- `@photasa/import` 新增约 8 个模块 + 完整测试

**风险**：高。导入功能是核心用户路径，bug 直接破坏用户数据。每个子任务都需端到端验证。

**完成记录（子任务 4.1 部分，2026-04-05）**：已新增 `import-config-normalize.ts`、`import-serialize.ts`；`import-worker.ts` 使用 `processImportConfigForWorker` 与 `createSerializableWorkerError`；Vitest：`import-config-normalize.test.ts`。其余子任务 4.2–4.9 未做。

---

#### 任务 5: import-service 会话状态机迁出（高风险，~700 行）— **原表述为依赖任务 4 全部完成；已与 4.1 交叉落地会话与序列化**

**前置条件**：任务 4 完成，`@photasa/import` 已具备纯函数业务层。

**目标**：把 `import-service.ts` 中的 `activeSessions`、`progressCallbacks` 状态机迁入 `@photasa/import/session-manager.ts`，service 只剩 IPC + worker 桥接 + Electron `dialog` 调用。

**步骤**：

1. **审计 import-service.ts** (860 行)：
    - 列出每个方法的依赖（`mainWindow`, `dialog`, `app` → 留 desktop；其他 → 迁包）
    - 识别会话状态机的边界
2. **新建包模块** `packages/@photasa/import/src/session-manager.ts`
    - 导出 `class ImportSessionManager`
    - 管理 `activeSessions: Map<string, ImportSession>` + `progressCallbacks: Map<string, ...>`
    - 方法：`createSession`, `updateProgress`, `completeSession`, `cancelSession`, `getSession`
    - 通过回调注入"发送 worker 任务"的能力（不直接依赖 Electron worker）
3. **新建测试**：覆盖完整会话生命周期 + 边界（重复 sessionId、cancel after complete、callback 异常）
4. **修改 service**：
    - `this.sessionManager = new ImportSessionManager({ sendWorkerTask: (req) => sendWorkerTask(this.worker, ...) })`
    - 删除内联状态管理代码
    - 保留：`@Service` 装饰器、worker 创建、`ipc.handle` IPC 注册、`dialog.showOpenDialog` 调用
5. **验证**：
    - `pnpm --filter @photasa/import run test`
    - 端到端：导入照片 → 进度更新 → 完成；中途取消导入；并发多个会话

**预期产出**：

- `import-service.ts`: 860 → ~200 行
- 新增 `@photasa/import/src/session-manager.ts` (~400 行 + 测试)

**风险**：高。状态机迁出可能引入并发 bug，必须在真实 Electron 环境下测试取消、并发、错误恢复路径。

**完成记录（部分，2026-04-05）**：已新增 `packages/@photasa/import/src/session-manager.ts` 与 `session-manager.test.ts`；`import-service.ts` 使用 `ImportSessionManager`、`generateImportSessionId`、`serializeImportConfigForWorker`；`pnpm --filter @photasa/import run test`、`turbo run build --filter=@photasa/desktop` 已通过。service 仍 ~710 行（IPC、历史、对话框、多路径分支未瘦）

---

### 任务依赖关系与排期

```
任务 1 (scan notify)         ─┐
任务 2 (config supervisor)   ─┼─ 可并行，无依赖
任务 3 (scan-worker)         ─┘

任务 4 (import-worker, 8 子任务) ── 必须串行完成 (4.1 → 4.9)
                                       │
                                       ▼
任务 5 (import-service)               依赖任务 4 完成
```

**建议执行顺序（历史；Phase 2 已冻结）**：

1. 任务 1 → PR → merge（已完成）
2. 任务 2 → PR → merge（已完成）
3. 任务 3 → PR → merge（部分完成）
4. ~~任务 4 / 5~~ — **不继续**，除非明确延长 Electron 维护期
5. **Photasa 扫描/导入缺口** → 在 Rust 实现（如 RFC 0105），Electron TS 仅作规格

**关闭条件（修订）**：

- Phase 1：`Implemented`（Electron 包已提取）✅
- Phase 2：`Frozen` — 不再作为 ROADMAP 活跃项；**不得**替代 Tauri Rust RFC

### Migration Rules 修订建议

原 RFC 的硬性指标 "`*-service.ts` 行数 < 100 行" 在实践中不现实——`@Service` 装饰器、worker 生命周期、LogViewerService 桥接、IPC channel 注册本身就需要 ~80 行。建议改为**质量约束**：

- [ ] `*-service.ts` 中**零业务逻辑**：无文件 IO、无数据转换、无算法、无状态机
- [ ] `*-service.ts` 仅包含：装饰器声明、worker 创建、IPC 注册、worker→IPC 转发
- [ ] `*-worker.ts` 仅包含：parentPort 桥接、action 路由表、调用 `@photasa/<domain>` 函数
- [ ] 对应 `@photasa/<domain>` 包的 `__tests__/` 测试不依赖 Electron 运行时

### 当前状态修正

`Status: Partially Implemented` — Phase 1 ✅；Phase 2 **Frozen**（Photasa 优先 Rust 重写，见 [ROADMAP.md](../../ROADMAP.md)）。

完整 Phase 2 Implemented 的判定（**仅当恢复 Electron 维护时**）：上表 Phase 2 任务 1–5 全部完成，且新 Migration Rules 全部满足。

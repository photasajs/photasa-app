# RFC 0154: 退役 `legacy-api` / `utils/api` — 回归贞观 IPC 边界

- **Start Date**: 2026-07-21
- **Last updated**: 2026-07-21
- **Status**: Draft（Photasa UI RFC，**非 Active**；Rust 命令面 [0097](./completed/0097-tauri-legacy-api-deferred-surface.md) ✅）
- **Priority**: P1
- **Area**: Photasa / Vue / 贞观之治 / IPC 边界
- **Parent**: [0149](./completed/0149-tauri-ui-adapter-post-closure.md) R1 + R2
- **Depends on**: [0137](./completed/0137-tauri-zhenguan-direct-ipc-migration.md)、[0136](./completed/0136-tauri-scan-runtime-contract.md)、[0150](./completed/0150-tauri-shell-menu-zouwu-retirement.md)、[0153](./completed/0153-tauri-zouwu-workspace-removal.md)

## Implementation principle (Photasa / Tauri)

> Policy: [ROADMAP.md](../../ROADMAP.md) Golden rule — Rust 后端已齐；本 RFC **只改 Renderer 边界**，不新增 Node 包。按项目规则，纯 Renderer RFC 不标记为 Photasa Active。

**本 RFC 的第一性原理是 [0137](./completed/0137-tauri-zhenguan-direct-ipc-migration.md) 已写明的决策，不是另起炉灶。**

## Summary

贞观服务层（0137 ✅）与 zouwu 移除（0153 ✅）之后，生产代码里仍有一条 **反贞观** 的旁路：

```text
❌ 当前（错误 — 组件级假 preload）

Vue / stores / utils
  → utils/api.ts
    → getPhotasaApi()
      → window.api
        → legacy-api.ts
          → *.adapter.ts
            → invoke / listen
```

这条链 **同时违反** 0137 三条铁律：

| 铁律                           | 违反点                                                                      |
| ------------------------------ | --------------------------------------------------------------------------- |
| 2. 组件不得直调 Rust           | `utils/api` 对组件暴露 `invoke` 语义扁平 API                                |
| 3. 仅袁天罡可 import Tauri IPC | `legacy-api.ts`、`import-session.ts`、`*.adapter.ts` 多处 `invoke`/`listen` |
| 人物职责                       | 扫描/导入/监视/缩略图 **绕过** 尉迟恭、房玄龄路由，由「api 工具层」代行     |

**0137 说贞观人物已零 `window.api`，但 0149 R1 仍开着：** 组件与 `utils/*` **仍经 `utils/api.ts`** — 等于 **换壳的 legacy IPC**。

```text
✅ 目标（0137 原文）

UI 意图
  → 百姓上书 / use人物() / 启奏（跨部门）
  → 李世民 / 房玄龄（路由或奏折持久化）
  → 袁天罡（唯一 invoke + listen）
  → Rust command / Tauri event

Rust event
  → 袁天罡
  → 启奏 / 圣旨
  → 目标人物 → Pinia 投影（只读）
```

**禁止** 用 `apps/photasa/src/ipc/*.ts` 域模块作为组件的新入口 — 那只是把 `utils/api` 改名，**仍不是贞观**。

## Problem

### 仍在生产的反模式文件

| 文件                               | 问题                                                               |
| ---------------------------------- | ------------------------------------------------------------------ |
| `api/adapter.ts`                   | `window.api = createLegacyApi()` 全局污染                          |
| `api/legacy-api.ts`                | ~1000 行 Electron 扁平形状 + 内嵌 invoke                           |
| `ipc/api-access.ts`                | `getPhotasaApi()` 鼓励旁路                                         |
| `utils/api.ts`                     | 组件事实上的 IPC 门面（424 行）                                    |
| `utils/scan-folder.ts`             | `scanPhotos` / `createThumbnailTask` 直调 utils/api                |
| `utils/file-handler.ts`            | `startWatching` / 缩略图 / photo list 直调 utils/api               |
| `stores/import-session.ts`         | **直接** `listen` from `@tauri-apps/api/event`（0137 规则 3 违规） |
| `composables/useUpdateListener.ts` | `getPhotasaApi()` 更新事件                                         |
| `api/*.adapter.ts`                 | 第二套嵌套 IPC（仅 legacy-api 消费，应并入袁天罡后删除）           |

### `utils/api.ts` 生产调用方（须迁出，不得迁到 `ipc/*`）

| 调用方                                 | 能力                                    | 目标人物 / 路径                                               |
| -------------------------------------- | --------------------------------------- | ------------------------------------------------------------- |
| `App.vue`                              | watch、recoverable import、getDirectory | 秦琼 + 房玄龄奏折；目录 → 魏征/褚遂良                         |
| `scan-folder.ts`                       | scan、thumbnail、addToPhotoList         | **尉迟恭** 队列 + 袁天罡 `scan_photos`；缩略图见下表          |
| `file-handler.ts`                      | watch 回调内 thumbnail、photo list      | 秦琼协调 → 魏征；I/O 经袁天罡                                 |
| `ImportPhotos.vue`                     | chooseDirectories、preview              | 百姓上书或 **房玄龄** accessor + 袁天罡 preview               |
| `ImportProgressModal.vue`              | execute/cancel/pause/resume             | `import-session` store ← **仅**袁天罡事件，store 不 listen    |
| `ImportHistory.vue`                    | history、undo                           | 房玄龄 Zouzhe 或 dedicated accessor                           |
| `ImageList.vue` / `ImageListHelper.ts` | metadata、thumbnail                     | 网格只读：投影 + 袁天罡 `create_thumbnail`（0148 契约经人物） |
| `settings/*.vue`                       | chooseDirectory                         | 长孙无忌 / 褚遂良 / 百姓上书                                  |
| `stores/preference.ts`                 | checkPhotasaConfig                      | 魏征 `useWeiZheng()` 或 Zouzhe                                |

## Goals

1. **零**生产路径：`window.api`、`legacy-api.ts`、`getPhotasaApi()`、`utils/api.ts`。
2. **零**袁天罡外的业务 `invoke` / `listen`；静态与动态 import 都受门禁。`convertFileSrc`、纯 runtime 检测等非业务 IPC 能力按显式白名单保留。
3. 每个原 `utils/api` 能力映射到 **已有人物** 或 **奏折/启奏**；仅当无归属时才在 RFC 修订中提议新人物（默认不新增）。
4. `*.adapter.ts` 的业务 transport 逻辑迁入 `YuanTianGangService` 私有 transport 子模块后删除 adapter 目录；不得向 UI 导出 transport。

## Non-Goals

- 重写 Rust（0097 ✅）。
- 恢复 Electron / contract reference。
- 新建 `ipc/foo.ts` 给 Vue `import`（**明确拒绝**）。
- 一次性删掉所有 Pinia store；store 可作 **人物投影**，但不得持有 IPC。

## Alternatives

### 方案 A — 贞观人物 + 袁天罡（推荐）

按能力把 `utils/api` 调用改为 `useYuChiGong()` / `useWeiZheng()` / 百姓上书 / 房玄龄 accessor；所有 `invoke`/`listen` 收拢到 `yuantiangang.ts`。

- **优点**：与 0136/0137/0143 一致；职责清晰；可逐 PR 迁移。
- **风险**：`YuanTianGangService` 膨胀 → 用 **私有** `transport/` 子模块（**不** export 给组件）。

### 方案 B — `ipc/*` 域模块替代 `utils/api`

组件 `import { executeImport } from '@/ipc/import'`。

- **优点**：改动面直观。
- **缺点**：**不是贞观**；组件仍直调 Rust 契约；与 0137 规则 2 冲突；人物层空心化。
- **结论**：**拒绝**。

**自动决策：方案 A。**

## Proposed Solution

### 架构分层（迁移后）

```text
┌─────────────────────────────────────────────────────────┐
│ Vue 组件 / composable                                    │
│  - useYuChiGong / useWeiZheng / useZhangSunWuJi / …      │
│  - 百姓上书 EventNames.BAIXING_SHANGSHU（简单意图）        │
│  - store 只读投影（scanningQueue、importSession、…）       │
└───────────────────────────┬─────────────────────────────┘
                            │ 意图 / 奏折 / 启奏
┌───────────────────────────▼─────────────────────────────┐
│ 李世民 / 房玄龄 / 各部门人物                              │
└───────────────────────────┬─────────────────────────────┘
                            │ 需 Rust I/O 时
┌───────────────────────────▼─────────────────────────────┐
│ YuanTianGangService（唯一业务 invoke / listen 消费者）     │
│  可选内部：services/yuantiangang/transport/*.ts（私有）   │
└───────────────────────────┬─────────────────────────────┘
                            │ invoke / listen
┌───────────────────────────▼─────────────────────────────┐
│ Rust commands / events（已有）                             │
└─────────────────────────────────────────────────────────┘
```

### 能力 → 人物映射表（验收依据）

| 域                   | 原 `utils/api` / legacy                  | 目标                                                                                                                   |
| -------------------- | ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| 扫描命令             | `scanPhotos`                             | 尉迟恭入队 → 袁天罡 `scan_photos`（0143 ✅ 模式；删 `scan-folder` 直调）                                               |
| 扫描队列 UI          | `cleanupScanQueue`                       | `useYuChiGong().scanningQueue`                                                                                         |
| 文件监视             | `startWatching` / `stopWatching`         | 袁天罡 `start_file_watch` + 事件 → 启奏 `WATCH_SCAN_QUEUE_ADD` → 尉迟恭（0133/0136）                                   |
| 监视副作用           | `file-handler` thumbnail/photo list      | 秦琼 → 魏征树更新；缩略图/列表经袁天罡，**不**在 handler 里调 api                                                      |
| 文件夹配置           | `getPhotasaConfig`、`addToPhotoList`、…  | 魏征 / 房玄龄 Zouzhe（袁天罡已有 invoke 分支）                                                                         |
| 目录对话框           | `chooseDirectory(s)`                     | 长孙无忌或褚遂良服务方法 → 袁天罡 `choose_directory*`                                                                  |
| 导入 preview/execute | `previewImport`、`executeImport`         | import composable 只调用房玄龄 accessor → 袁天罡；**禁止** composable/store 直达 transport 或直接 listen               |
| 导入事件             | `onImportProgress`、…                    | 袁天罡 `listen('import:*')` → 回调 / 启奏 → `import-session` store 订阅人物事件                                        |
| 导入历史/undo        | `getImportHistory`、`undoImport`         | 房玄龄 Zouzhe + 袁天罡 invoke                                                                                          |
| 缩略图               | `createThumbnail`                        | 组件 → 网格 composable → 魏征图库 accessor → 袁天罡 `create_thumbnail`（0148）；`vue-concurrency` task 留在 composable |
| 元数据               | `getFileMetadata`                        | 组件 → 网格 composable → 魏征图库 accessor → 袁天罡 `extract_metadata`                                                 |
| Shell                | `openExternal`、…                        | 已完成：长孙无忌 / 百姓上书 → 0150                                                                                     |
| 菜单                 | `setupMenu`                              | 删除；长孙无忌 + 袁天罡 `menu:action`（0149）                                                                          |
| 更新                 | `onUpdate*`                              | 袁天罡 listen `picasa:update-*` → `useUpdateListener` 订阅人物                                                         |
| 日志                 | log viewer                               | 袁天罡 `log_viewer_*` + stream 事件                                                                                    |
| 窗口                 | reload、maximize                         | 标题栏组件 → 袁天罡 window commands（0099）                                                                            |
| Splash               | `close_splashscreen`                     | 单一启动协调点 → 袁天罡 window command；保留“首屏初始化结束后关闭”时序，删除 `App.vue` / `main.ts` 双调用              |
| 平台信息             | `isMac` / `get_platform`                 | 袁天罡 platform command；纯 `isTauri` runtime 检测允许留在 `api/env.ts`                                                |
| 默认目录             | `getDirectory`                           | `folderSelectionService` → 褚遂良/长孙无忌 → 袁天罡                                                                    |
| 路径运算             | `relativePath`、`resolvePath`、`getRoot` | 能本地纯函数化者并入 `sync-path.ts`；必须读 OS/Rust 者经负责人物 → 袁天罡，禁止继续走 `api-path → getPhotasaApi`       |
| WebView URL          | `convertFileSrc` / `isTauri`             | 保留 `media-url.ts` 非业务 IPC 白名单；不得为了“唯一 import”塞进袁天罡                                                 |

### Phase 0 — 真实基线 + 门禁

- [x] 2026-07-22 生产基线已按“定义 / 消费者 / 注释”分开盘点，不再用子串命中冒充零引用：
    - `window.api`：`api/adapter.ts` 仍有 **1 处真实赋值** `(window as any).api = createLegacyApi()`。
    - `getPhotasaApi`：定义仍在 `ipc/api-access.ts`；生产消费者包括 `App.vue`、`LogConsole.vue`、`TitlebarWinLinux.vue`、`UpdateSettings.vue`、`useUpdateListener.ts`、`folderSelectionService.ts`、`api-path.ts`、`utils/api.ts`。
    - `@renderer/utils/api` 精确生产 import：**11 文件**（原清单不变）。
    - 袁天罡外 `@tauri-apps/api`：仍有 adapter、legacy、`App.vue`、`main.ts`、`import-session.ts`、`env.ts`、`media-url.ts` 等；其中 `env.ts` / `media-url.ts` 含允许的非业务 IPC 能力。
- [ ] ESLint AST 门禁同时覆盖 `ImportDeclaration` 与 `ImportExpression`：
    - 禁止新增 `@renderer/utils/api`、`@renderer/api/legacy-api`、`@renderer/ipc/api-access`。
    - 袁天罡 transport 外禁止导入/动态导入业务 `invoke`、`listen`，并禁止以 `@tauri-apps/plugin-*` 绕过。
    - 非业务 IPC 白名单仅含经审查的 `api/env.ts` runtime 检测与 `utils/media-url.ts` `convertFileSrc`。
- [ ] Vitest 配置同时纳入 `src/**/*.test.ts` 与 `src/**/*.spec.ts`；“全绿”不得排除现有 spec。

### Phase 1 — 止血

- [ ] 删除 `adapter.ts` 的 `window.api = createLegacyApi()`
- [ ] 标记 `getPhotasaApi` / `utils/api` `@deprecated`（迁移完成前临时保留）
- [ ] **禁止新增** `utils/api` 调用（lint）

### Phase 2 — 按域迁贞观（每域一 PR，顺序建议）

| 切片                | 工作                                                                                   | 删除                                        |
| ------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------- |
| 2a 扫描             | `scan-folder.ts` → 尉迟恭 + 袁天罡；`App.vue` 删 `scanPhotosTask` 直链 api             | `scanPhotos` from utils/api                 |
| 2b 监视             | `file-handler.ts` → 秦琼/袁天罡；`App.vue` watch 经人物启动                            | `startWatching`/`stopWatching`              |
| 2c 配置             | `preference.ts` checkPhotasaConfig → 魏征                                              | config 类 api 方法                          |
| 2d 导入             | `import-session` 去掉直 `listen`；袁天罡转发 import 事件；组件改 composable            | import 类 api + modal 直调                  |
| 2e 缩略图/元数据    | `ImageListHelper` composable → 袁天罡                                                  | `createThumbnailTask` export from utils/api |
| 2f 对话框/目录      | settings → 褚遂良/长孙无忌                                                             | `chooseDirectory*`                          |
| 2g 更新/日志/窗口   | `useUpdateListener`、`UpdateSettings`、`LogConsole`、titlebar、`App.vue` 更新动作      | 对应 getPhotasaApi                          |
| 2h 平台/Splash/路径 | `App.vue` / `main.ts` Splash、`App.vue` isMac、`folderSelectionService`、`api-path.ts` | 剩余业务 invoke / getPhotasaApi             |

每切片 0137 证据清单：

1. Inventory 调用方
2. Rust 契约（已有）
3. 人物 API / 启奏路由
4. 袁天罡 transport 实现（可从 `*.adapter.ts` 搬迁）
5. `rg` 该域零 `utils/api`
6. 该域零袁天罡外业务 `invoke` / `listen`
7. `*.test.ts` + `*.spec.ts` 全绿

### Phase 3 — 删尸

- [ ] 删 `legacy-api.ts`、`legacy-preload-access.ts`、`photasa-flat-api.ts`、`ipc/api-access.ts`
- [ ] 删 `utils/api.ts`
- [ ] 删 `api/adapter.ts`、`api/*.adapter.ts`（逻辑已在 `yuantiangang/transport/`）
- [ ] 删 `legacy-api-*.test.ts` 或改为测袁天罡 transport

### Phase 4 — 文档

- [ ] [0149](./completed/0149-tauri-ui-adapter-post-closure.md) R1/R2 ✅
- [ ] `ROADMAP.md` 前端边界改为「贞观 + 袁天罡」
- [ ] `README.md` 去掉 legacy-api compat 表述

## 袁天罡膨胀控制

`yuantiangang.ts` 已大。迁移时：

- 新增 `services/yuantiangang/transport/`（**private**，仅 `YuanTianGangService` import）
- 按域拆分：`watch-transport.ts`、`import-transport.ts`、`thumbnail-transport.ts` …
- **不**创建 `ipc/` 或 `api/` 对 UI 导出
- 单元测试测 transport 纯函数 + `yuantiangang-ipc.test.ts` 集成

## Testing Strategy

- 每切片：`pnpm --filter @photasa/photasa run test:unit` + `typecheck` + `lint`
- 精确 import 门禁：`@renderer/utils/api`、`@renderer/api/legacy-api`、`@renderer/ipc/api-access` 生产代码 → **0**；不以注释或 `api-path` 子串命中代替 AST 结果。
- 全量盘点 `rg -n '@tauri-apps/(api|plugin-)' apps/photasa/src --glob '!**/__tests__/**'`；除显式非业务 IPC 白名单外，仅 `services/yuantiangang/**` 可消费业务 `invoke` / `listen`。
- 导入事件契约测试：监听必须先于 execute invoke；`importId` 返回前的 progress / complete / error 必须缓冲，claim 后按序冲刷；重复订阅和卸载不得丢事件或重复投影。
- 扫描 transport 测试：迁移后仅保留一套 `scan_photos` invoke 与 `picasa:find-photo` listener，禁止 legacy adapter 与袁天罡双监听。
- 手测：导入向导、监视入队、缩略图网格、偏好目录、更新、窗口

## Risks

| 风险                    | 缓解                                                     |
| ----------------------- | -------------------------------------------------------- |
| 误建 `ipc/*` 新旁路     | RFC 明确拒绝；code review + eslint                       |
| import-session 事件竞态 | 袁天罡单点 listen + 0118 单飞语义不变                    |
| 人物 API 膨胀           | composable 薄包装；重逻辑仍在人物/房玄龄                 |
| 门禁假绿                | AST lint 覆盖静态/动态 import；Vitest 同时纳入 test/spec |
| 扫描双 transport/listen | 切片内选择袁天罡实现；删除 legacy adapter 后再验收零重复 |

## Acceptance

- [ ] 0137 Golden Rules 2–3 对 **全 Renderer** 成立（不仅 services/）
- [ ] 零 `utils/api`、`legacy-api`、`window.api`
- [ ] 仅 `yuantiangang/**`（及测试 mock）消费业务 `invoke` / `listen`；`env.ts` / `media-url.ts` 仅保留批准的非业务 IPC 白名单
- [ ] [0149](./completed/0149-tauri-ui-adapter-post-closure.md) R1 + R2 关闭
- [ ] Vitest `*.test.ts` + `*.spec.ts` 全绿
- [ ] 导入早到事件/单飞语义与扫描单 transport 语义均有回归测试
- [ ] Splash 只关闭一次，且仍在首屏初始化完成后关闭

## Implementation checklist（开工时 → TASK_TRACKING）

1. Phase 0 真实基线 + ESLint/Vitest 门禁
2. Phase 1 停 `window.api` 注入
3. Phase 2a–2h 贞观切片（**禁止** `ipc/*` 公共模块）
4. Phase 3 删除 legacy 层
5. Phase 4 文档收口

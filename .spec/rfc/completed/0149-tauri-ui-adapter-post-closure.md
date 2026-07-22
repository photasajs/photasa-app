# RFC 0149: 0073 关闭后 UI 适配层剩余项跟踪

- **Start Date**: 2026-07-21
- **Status**: ✅ Implemented（2026-07-21）— 跟踪职责已关闭；R3/R4/R5 完成，R1 Renderer 全边界与 R2 `legacy-api` 退役转交 **0154**
- **Priority**: P2
- **Area**: Photasa / UI / `legacy-api` / 贞观 IPC
- **Closes**: [0073](./0073-tauri-ui-migration-adapter.md)（0073 目标已达成，本 RFC 只跟踪后续清理）
- **Depends on**: 0073 ✅、0075 ✅、0097 ✅、[0137](./0137-tauri-zhenguan-direct-ipc-migration.md)、[0139](./0139-tauri-zouwu-retirement-plan.md)、[0150](./0150-tauri-shell-menu-zouwu-retirement.md) ✅
- **Follow-up**: [0154](../0154-tauri-legacy-api-retirement.md)（R1 Renderer 全边界 + R2）

## Summary

[RFC 0073](./0073-tauri-ui-migration-adapter.md) 的交付物已完成：

- `apps/photasa/src/api/*` 嵌套 adapter（window / shell / scan / thumbnail / import / config / tianshu）
- [RFC 0075](./0075-tauri-flat-legacy-api-layer.md) 扁平 `legacy-api.ts` + `adapter.ts` 注入 `window.api`
- Renderer UI 已在 `apps/photasa` 运行；Tauri 路径下 `legacy-api` 方法多数已 `invoke` 真实 Rust 命令（对拍见 [0097](./0097-tauri-legacy-api-deferred-surface.md)）

**本 RFC 不重复 0073 设计**，只列 **0073 关闭后仍开放的工程项**，每项由既有或新建子 RFC 落地。

## 不在范围

| 项                       | 原因                                      |
| ------------------------ | ----------------------------------------- |
| The removed desktop tree | 维护模式；非 Photasa Active               |
| 0098 `@photasa/*` 抽包   | deferred，Deferred                        |
| 新增 `window.api` 能力   | 禁止；新功能走贞观 + Rust command（0137） |

## 进度（2026-07-21）

### 切片 1 — 贞观服务脱离 `window.api`（R1 部分）

- [x] `yuantiangang.ts`：`picasa:menu-action` 改 `listen()` 直连，不再经 `legacy-api.onMenuAction`（0137 / 0149）
- [x] `zhangsunwuji.ts`：`openInFinder` 用 `webviewMediaUrlToAbsolutePath` + `canonicalFolderPath`，零 `window.api`
- [x] Vitest：`yuantiangang-ipc.test.ts` 断言 menu 事件直连

### 切片 2 — shell/menu 退出 zouwu（R3、R4）→ [0150](./0150-tauri-shell-menu-zouwu-retirement.md) ✅

- [x] `executeZhaoling` 直连 `apply_system_menu` / `open_external` / `show_in_folder`
- [x] `intent.ts` 移除 `menu_apply` / `shell_open*` 映射
- [x] Vitest：三条 invoke 路径

| 域         | `.zouwu` 文件                                 | Photasa 运行时                      | 结论                                                                   |
| ---------- | --------------------------------------------- | ----------------------------------- | ---------------------------------------------------------------------- |
| **shell**  | `shell_open_external`、`shell_open_in_finder` | ~~zouwu → TaibaijinxingAdapter~~    | ✅ **[0150](./0150-tauri-shell-menu-zouwu-retirement.md)** 直连 invoke |
| **menu**   | `menu_apply`                                  | 上报直连；下发 ~~zouwu~~            | ✅ **0150**                                                            |
| **engine** | `engine_status_check`                         | 启动由 `engine_status.rs` 原生 emit | **无 zouwu 运行时依赖**（R5 ✅）                                       |

无独立 `shell_adapter.rs` / `menu_adapter.rs` — 逻辑集中在 `taibaijinxing_adapter.rs` + `commands/menu.rs`。

## 剩余项清单

| ID  | 主题                               | 现状                                         | 负责 RFC                   | 验收                                                          |
| --- | ---------------------------------- | -------------------------------------------- | -------------------------- | ------------------------------------------------------------- |
| R1  | **Renderer 全边界禁止 legacy IPC** | 贞观 service 已完成；组件仍经 `utils/api.ts` | **0154**                   | 全 Renderer 组件只递 intent；袁天罡独占业务 invoke/listen     |
| R2  | **`legacy-api.ts` 退役**           | 兼容层仍全局注入                             | **0154**（按能力切片删除） | 无生产调用路径依赖 `window.api`；文件可删或仅测试桩           |
| R3  | **zouwu `shell` 域**               | ~~zouwu~~                                    | **0150** ✅                | `open_external` / `show_in_folder` 直连                       |
| R4  | **zouwu `menu` 域**                | ~~zouwu 下发~~                               | **0150** ✅                | `apply_system_menu` 直连                                      |
| R5  | **zouwu `engine` 域**              | `engine_status.rs` 原生                      | —                          | ✅ 无 zouwu 残留（2026-07-21 核实）                           |
| R6  | **天枢生产打包**                   | 0107 已知 workflow 资源未进 bundle           | **0107**                   | 生产构建可加载所需配置；与 UI 适配无关但阻塞部分偏好/菜单路径 |

## 建议顺序

1. **0137** — 贞观 service IPC 已完成（与 0142–0144 已做域对齐）
2. **0150** + **0139** — shell/menu zouwu 退场（R3、R4）
3. **0154 / R1–R2** — 全 Renderer 按能力迁移；零生产调用后删除兼容层
4. **0107** — 若生产菜单/偏好仍异常，优先于 R2

## 验收（本 RFC 关闭条件）

- [x] 0137 标 ✅ Implemented（贞观 service 范围）；Renderer 全边界与 `legacy-api` 全量退役转交 **0154**
- [x] 0139 表中 shell / menu / engine：R3/R4 经 **0150** ✅；R5 engine 无 zouwu 残留
- [x] `apps/photasa/src/services/**` 贞观人物零 `window.api`（测试 mock 除外）
- [x] `legacy-api.ts` 删除未在本 RFC 实施，剩余成果已明确转交后继 **0154**；不阻塞 0149 跟踪职责关闭

**0149 跟踪职责已完成**；`legacy-api` 删除不归本 RFC 阻塞。

## 参考代码（0073 已交付）

| 路径                                 | 说明                                  |
| ------------------------------------ | ------------------------------------- |
| `apps/photasa/src/api/adapter.ts`    | 嵌套 adapter 导出 + `window.api` 注入 |
| `apps/photasa/src/api/legacy-api.ts` | 扁平兼容层（待 0154 退役）            |
| `apps/photasa/src/api/*.adapter.ts`  | 分域 invoke 封装                      |

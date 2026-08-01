# RFC 0168 – 导入目标文件夹未纳入文件监视范围

## Implementation principle (Photasa / Tauri)

> **Rust rewrite, not TypeScript copy.** Policy: [ROADMAP.md](../../ROADMAP.md).

**Status**: 🔴 Blocked / Unresolved（根因已坐实，修复方案未选定）
**Created**: 2026-07-25
**Last updated**: 2026-07-26
**Area**: Tauri / Watch / Import（**边界问题**，非子系统合并）
**Related**: RFC 0003, 0082, 0083, 0133, 0135, 0136, 0137, 0154

---

## 铁律：Import 与 Watch 分离

**Import 就是 import。Watch 就是 watch。禁止在 import 完成路径里打补丁来「修 watch」。**

| 禁止                                                                           | 原因                          |
| ------------------------------------------------------------------------------ | ----------------------------- |
| `import_execute.rs` 完成后调用 `restartWatching` / `addPath` / 注入 scan queue | 把 import 耦合成 watch 启动器 |
| 导入完成回调里 `emit` 伪 watch 事件                                            | 绕过真实 fsevents 管线        |
| 改 `App.vue` / `main.ts` 启动阻塞来「顺便」修 watch                            | 与本案无关，已造成回归        |

合法边界：

- **Import**：选 `targetPath`、复制/移动文件、发 `import:*` 事件。
- **Watch**：只监视 `preferenceStore.scanning.paths`；由秦琼 → 房玄龄 → 袁天罡 `start_file_watch` 启动；文件系统变化经 `photasa-watch` coalescer → `picasa:add-to-scan-queue` 入队（RFC 0154 后主路径）。
- **交叉点仅限 UX/偏好**：用户若要把某目录纳入监视，走 **图库根目录**（`chuSuiLiang.addPath` / 偏好设置），由既有 `paths` 变更触发 `restartWatching`——不是 import 子系统去调 watch。

---

## Problem

用户报告：导入照片后，期望新文件自动被 watch 感知并入库扫描，但实际没有生效。

常见误判：「watch 从未启动」。代码调查表明需先区分 **(A) watch 未 start** 与 **(B) watch 已 start 但监视范围不含导入目标**（见下文「Watch 启动门控」）。

---

## 根因（已坐实，代码路径追踪 2026-07-25 / 复核 2026-07-26）

**结论：`targetPath`（导入目标）与 `preferenceStore.scanning.paths`（图库根目录 / 监视列表）是两套独立机制，import 流程不通知 watch。**

### 路径 1：Watch 监视列表来源

- `apps/photasa/src/App.vue` — `storeToRefs(preferenceStore)` → `paths`（`scanning.paths`）
- **首次启动**：`initializeApp()`（`onMounted` 内，主题加载之后）在 `paths.length > 0` 时 `await qinQiong.startWatching(paths, thumbnailSize)`（约 167–168 行）
- **后续变更**：`watchArray(paths, …)` **无 `immediate`**（约 340–346 行）— 仅在 `paths` **变更后** `restartWatching`，不负责冷启动
- `apps/photasa/src/services/qinqiong/qinqiong.ts:62-89` — `startWatching`/`restartWatching` 经房玄龄 `START_FILE_WATCH` 奏折 → 袁天罡 `invoke("start_file_watch", { config })`，全量 `paths`，无增量 `add_path`
- `apps/photasa/src-tauri/src/commands/watch.rs` — 每次 `start_file_watch` 销毁旧 watcher、重建；`recursive: true` 注册 `paths` 中每一项

### 路径 2：导入目标来源

- `apps/photasa/src/components/ImportPhotos.vue` — `selectTargetDirectory` → 任意目录写入 `stepData.targetPath`
- `apps/photasa/src/utils/import-wizard-helpers.ts:91` — 默认 `defaultPaths[0]`，**允许改选库外目录**
- `apps/photasa/src-tauri/src/commands/import_execute.rs` — 仅处理 `targetPath` 复制/移动；**零 watch 调用**（设计如此，非遗漏）

### 两者在代码上从未连接

`targetPath` 确定后：

1. 不写回 `preferenceStore.scanning.paths`
2. 不由 import 触发 `startWatching` / `restartWatching`
3. Rust `start_file_watch` 不会为 import 单独追加路径

---

## Watch 启动门控（与 import 无关）

以下情况 **watch 按设计不会 start**（易被误认为「watch 坏了」）：

| 条件                                 | 代码行为                                                             |
| ------------------------------------ | -------------------------------------------------------------------- |
| `paths.length === 0`                 | `initializeApp` 跳过 `startWatching`，打开偏好（`App.vue` ~169–171） |
| 首次启动用户取消选文件夹             | `addPath` 未执行，`paths` 仍空                                       |
| `invoke("start_file_watch")` 失败    | `startWatching` throw → catch 开偏好，**无重试**                     |
| `onMounted` 未执行到 `initializeApp` | 主题等前置 `await` 挂起则 watch 永不 start                           |

`paths` 来源：`main.ts` 在 `mount` 前 `initializeDepartments()` → `GET_PREFERENCES` 用 Rust 磁盘快照 **replace** 整个 preferences store（`matter-sync.yml` `get_preferences`）。

**可观测性缺口**：Rust 成功 start 后 `emit("picasa:file-ready")`（`watch.rs:185`），前端 **无任何 listener**——无法从 UI 确认 watch 已 active。

---

## 事件管线（RFC 0154 后，验收须以此为准）

0133/0135 描述的「通路 A → `file-handler`」已在 **RFC 0154 Phase 2b 删除**。

| 事件            | 0154 后生产路径                                                                                                         |
| --------------- | ----------------------------------------------------------------------------------------------------------------------- |
| 文件 add/change | Rust coalescer → `picasa:add-to-scan-queue` → 袁天罡 → `watch_scan_queue_add` → 尉迟恭 `schedule_watch_file_operations` |
| 目录 add        | 另：`picasa:file-add-dir` → 袁天罡 → folderTree                                                                         |
| 删除            | `picasa:file-unlink*` → 袁天罡 → 秦琼清理                                                                               |

**验收不应再以「前端是否收到 `picasa:file-add`」为唯一标准**；应观测 `picasa:add-to-scan-queue` 或扫描队列入队。

其他已知风险（watch 子系统内，非 import）：

- macOS `CreateKind::Any` 时 `Path::is_file()` 不可靠（`watch.rs` ~103–113）— 可能影响场景 1
- 袁天罡 `listen('picasa:add-to-scan-queue')` 失败仅 `warn`，无重试 — 通路 B 全死而 Rust watcher 仍在

---

## 实际影响（两种场景）

1. **场景 1 — 导入目标在已监视根下**（`targetPath` 等于某个 `paths[i]` 或其子路径）  
   `recursive: true` 下 OS 级监视**应**感知新文件。**RFC 尚未实测**（见 Acceptance）。若仍无反应，查 watch 启动门控或 `watch.rs` macOS 分类，**不是** import 未调 watch。

2. **场景 2 — 导入目标在库外**（`targetPath` 不在任何 `paths` 前缀下）  
   Watcher **从未注册该路径**。这是 **结构性缺口**：watch 在跑也看不到该目录。修复须在 **paths / watch 范围** 或 **导入向导 UX**，禁止 import 完成钩子里补 watch。

---

## Non-goals

- 不在 `import_execute` / import 完成回调里启动或重启 watch
- 不改 `main.ts` / `App.vue` 启动同步逻辑来「修 watch」
- 不把「watch 未 start」与「监视范围不含 target」混为一谈而不做 Acceptance #1
- 本 RFC 文档阶段不实施代码；修复方案选定后再开实现 PR

---

## 候选修复方向

### ❌ 已拒绝

| 方案                                                              | 说明                                 |
| ----------------------------------------------------------------- | ------------------------------------ |
| **B：导入完成后 `restartWatching` / `addPath` / 注入 scan queue** | 违反 Import/Watch 分离；用户明确拒绝 |

### 待选（均不耦合 import 完成路径）

| 方案                                           | 范围             | 说明                                                                                                                                                     |
| ---------------------------------------------- | ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A：导入向导 UX 校验**                        | 前端 Import 向导 | `targetPath` 不在任何 `paths` 前缀下时 **阻止导入**，提示用户先在偏好中添加图库根目录（`chuSuiLiang.addPath`）。改的是**选路规则**，不是 import 调 watch |
| **C：`watch.rs` 动态 `add_watch_path`**        | 仅 Rust watch    | 运行中追加路径，避免每次全量重建；仍只服务 `paths` 列表变更，不由 import 调用                                                                            |
| **D：watch 可观测性**                          | 袁天罡或调试层   | listen `picasa:file-ready` / 日志，确认 start 成功；不修业务逻辑                                                                                         |
| **E：`watch.rs` macOS `CreateKind::Any` 分类** | 仅 Rust watch    | 场景 1 若实测失败时的候选；与 import 无关                                                                                                                |

推荐决策顺序：**先 Acceptance #1 实测** → 若场景 1 通过、仅场景 2 失败 → **A（UX）** 或引导用户 `addPath`；若场景 1 也失败 → **E** + 查启动门控 / 通路 B listen。

---

## Acceptance

1. **场景 1 基线**（区分「未 start」vs「路径/事件 bug」）：在已配置的 `paths[0]` 下**手动**新建媒体文件，等待 coalescer 防抖（≥200ms），确认 `picasa:add-to-scan-queue` 或扫描队列入队（及尉迟恭日志）。可选辅助：`picasa:file-add-dir` 对新建子目录。
2. **场景 2 失败基线**：选从未在 `paths` 中的目录作为 `targetPath` 完成导入，确认 **无** 上述队列信号（修复前预期）。
3. **修复后**：场景 2 在用户将目标纳入 `paths`（或向导 A 强制覆盖）后，**同一目录内**后续文件变化可被 watch 感知；场景 1 无回归。
4. **分离约束**：实现 diff 中 **零** `import_execute` → watch / `addPath` / `restartWatching` 调用。

---

## 调查记录

| 日期       | 内容                                                                                      |
| ---------- | ----------------------------------------------------------------------------------------- |
| 2026-07-25 | 初版根因：`targetPath` ≠ `paths`                                                          |
| 2026-07-26 | 代码复核：启动门控、`0154` 事件路径、`file-ready` 无 listener；明确拒绝 import 耦合方案 B |

---

## References

- `apps/photasa/src/App.vue` — `initializeApp`, `watchArray(paths)`
- `apps/photasa/src/main.ts` — `initializeDepartments` before mount
- `apps/photasa/src/services/qinqiong/qinqiong.ts`
- `apps/photasa/src/services/yuantiangang/yuantiangang.ts` — `start_file_watch`, `picasa:add-to-scan-queue` listen
- `apps/photasa/src/services/yuchigong/yuchigong.ts` — `scheduleFileOperationsFromWatch`
- `apps/photasa/src/services/lishimin/event-routing.yml` — `watch_scan_queue_add`
- `apps/photasa/src-tauri/src/commands/watch.rs`
- `apps/photasa/src-tauri/src/commands/import_execute.rs`
- `apps/photasa/src/components/ImportPhotos.vue`
- `apps/photasa/src/utils/import-wizard-helpers.ts`
- `.spec/rfc/completed/0154-tauri-legacy-api-retirement.md` — watch 贞观路径
- `crates/photasa-watch/src/coalescer.rs` — 通路 B 防抖

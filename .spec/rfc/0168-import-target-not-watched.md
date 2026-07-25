# RFC 0168 – 导入目标文件夹未纳入文件监视范围

## Implementation principle (Photasa / Tauri)

> **Rust rewrite, not TypeScript copy.** Policy: [ROADMAP.md](../../ROADMAP.md).

**Status**: 🔴 Blocked / Unresolved（根因已坐实，无修复方案已实施）
**Created**: 2026-07-25
**Area**: Tauri / Watch / Import
**Related**: RFC 0082, 0083, 0133（watch.rs 演进历史）

---

## Problem

用户报告：导入照片后，应有的效果是导入的文件/文件夹自动触发文件监视（watch），但实际没有生效。

## 根因（已坐实，代码路径实测追踪）

**结论：导入目标文件夹与"被监视路径列表"是两套完全独立、互不通知的机制。**

### 路径 1：文件监视的路径来源

- `apps/photasa/src/App.vue:64` — `const { paths, currentFolder } = storeToRefs(preferenceStore)`
- `apps/photasa/src/App.vue:294-300` — `watchArray(paths, () => qinQiong.restartWatching(paths.value, ...), { deep: true })`

即：watch 只在 `preferenceStore.paths`（用户在偏好设置里添加的"图库根目录"列表）发生变化时才重启。

- `apps/photasa/src/services/qinqiong/qinqiong.ts:62-89` — `startWatching`/`restartWatching` 直接把整个 `paths` 数组透传给后端 `start_file_watch`，无增量逻辑。
- `apps/photasa/src-tauri/src/commands/watch.rs:64-` — `start_file_watch` 每次调用都**销毁旧 watcher、重建新 watcher**，用一次性 `for p in &paths { watcher.watch(...) }` 循环注册全部路径。**没有任何函数支持向运行中的 watcher 动态增加单个路径**。

### 路径 2：导入目标文件夹的来源

- `apps/photasa/src/components/ImportPhotos.vue:430-444` — `selectTargetDirectory` 调用 `zhangSunWuJi.chooseDirectories(false)`，让用户**任意**选择一个目标文件夹，写入 `stepData.targetPath`。
- `apps/photasa/src/utils/import-wizard-helpers.ts:91` — 默认值取 `defaultPaths[0]`（第一个图库根目录），但**允许用户改选任意其他目录**，不限于 `preferenceStore.paths` 中已登记的路径。
- `apps/photasa/src-tauri/src/commands/import_execute.rs` — `execute_import` 接收 `targetPath`（`config.targetPath`），执行复制/移动，**全文件搜索 `watch`/`Watch` 关键字零匹配**：导入完成流程完全不触碰 watch 子系统。

### 两者从未连接

`targetPath` 选定后：

1. 不会被写回 `preferenceStore.paths`。
2. 不会触发 `qinQiong.startWatching`/`restartWatching`。
3. 后端 `start_file_watch` 从未被要求"追加"这个新路径。

## 实际影响（两种场景，只有一种是 bug）

1. **导入目标是已监视根目录的子文件夹**（例如目标是 `paths[0]` 本身或其子目录）——`recursive: true` 下 `notify` 的 OS 级递归监视理论上应能自动感知新增文件/子目录，**这种情况下不存在 bug**（未在本次排查中实测复现验证，见下方 Acceptance）。
2. **导入目标是从未加入 `preferenceStore.paths` 的全新目录**（用户在导入向导里临时选了一个库外文件夹）——watcher 完全不知道这个路径存在，新增文件/文件夹**永远不会**被监视到。这是**真实存在的结构性 bug**。

## Non-goals（本 RFC 不做）

- 未实测验证场景 1（子目录场景）是否真的如预期工作——只是基于 `recursive: true` + `notify` 语义的合理推断，未用真实导入操作 + 观察 `picasa:file-add` 事件来交叉验证。
- 未设计具体修复方案的实现细节，仅列出候选方向（见下）。
- 未编写或修改任何代码（本 RFC 为纯文档产出，遵循当前会话的 RFC-only 约束）。

## 候选修复方向（供下次决策，未选定）

1. **方案 A：导入前置校验 + 强制并入 `paths`** —— 若用户选择的 `targetPath` 不在任何已有 `paths` 的前缀路径下，导入向导要求用户先"添加为图库根目录"（复用 `chuSuiLiang.addPath`），确保 watch 覆盖后再允许导入。改动集中在前端向导流程，不改 Rust。
2. **方案 B：导入完成后自动登记新路径** —— `import_execute.rs` 完成回调中，若 `targetPath` 不在已监视范围，主动发起一次 `restartWatching`（等效于把新路径并入 `paths` 并重启 watcher）。需要新增"导入完成 → 通知 watch 子系统"的调用链（可能走 Zouzhe/Qizou 双通信系统中的一个，需按项目约定判断用哪个）。
3. **方案 C：watch.rs 支持动态增量 add_path** —— 新增一个不销毁现有 watcher 的"追加路径"命令，避免每次都全量重建（性能/体验更好，但改动面更大，涉及 `WatchState`/`RecommendedWatcher` 生命周期重构）。

三者不互斥，A 是最小改动的兜底（防止用户导入到未监视目录），B/C 更彻底但代价更高。

## Acceptance（若后续排查或修复，需满足）

1. 实测验证子目录场景（场景 1）：在已监视根目录下手动创建新文件/新文件夹，确认 `picasa:file-add`/`picasa:file-add-dir` 事件正确触发——排除"连子目录场景其实也是 bug"的可能性。
2. 实测复现场景 2（真实 bug）：导入向导选择一个全新的、从未加入 `paths` 的目录，执行一次真实导入，确认 watch 事件确实不触发，作为修复前的失败基线。
3. 修复实施后，场景 2 的复现步骤应产出正确的 watch 事件（`picasa:file-add` 等），且不引入对场景 1 的回归。

## References

- `apps/photasa/src/App.vue`
- `apps/photasa/src/services/qinqiong/qinqiong.ts`
- `apps/photasa/src-tauri/src/commands/watch.rs`
- `apps/photasa/src-tauri/src/commands/import_execute.rs`
- `apps/photasa/src/components/ImportPhotos.vue`
- `apps/photasa/src/utils/import-wizard-helpers.ts`

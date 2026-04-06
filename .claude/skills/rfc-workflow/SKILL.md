---
name: rfc-workflow
description: >-
  Creates and updates RFC documents under docs/rfc; keeps root ROADMAP.md as the single
  source of truth for RFC progress; optionally syncs TASK_TRACKING.md. Conventions live
  in ROADMAP.md + TASK_TRACKING.md (index/tables); naming in ROADMAP RFC section. Use when the user mentions RFC, ROADMAP, roadmap, TASK_TRACKING,
  docs/rfc, implementing or authoring a feature spec, or updating the RFC index table.
---

# RFC 工作流（Skill）

本技能定义 **RFC 文档**、**`ROADMAP.md`**、（可选）**`TASK_TRACKING.md`** 的职责边界与更新时机。与规则 **`.cursor/rules/rfc-agent.mdc`** 配合：用户要求「做 RFC 相关工作」时，代理应读本技能并执行。

**操作顺序与意图映射**见孪生技能 **`rfc-management`**（建议先读管理手册，再读本文件的规范表）。

## 仓库约定（默认布局）

若 **`AGENTS.md`** 另有规定，以其为准。

| 路径 | 用途 |
|------|------|
| 根目录 **`ROADMAP.md`** | **权威进度表**：各 RFC 状态（✅/🔨/⏳）、阶段、备注。**回答「进度」优先认此文件。** |
| `ROADMAP.md`（RFC 流程） | **命名与流程**；**进度与全表**另见根目录 `TASK_TRACKING.md`。 |
| `docs/rfc/NNN-kebab-title.md` | 单个 RFC 规格正文；**依赖**写在各篇元数据与 Dependencies 节。 |
| `docs/rfc/assets/` | RFC 配图、流程图等资源 |
| 根目录 `TASK_TRACKING.md`（可选） | **当前冲刺**：正在实现的 RFC 的检查清单与日期备注 |

## 何时更新什么

### 仅改 RFC 正文（不动路线图）

- 修正笔误、补充技术细节、调整「备选方案 / 风险 / 测试策略」
- RFC 状态仍为 Draft 且**未开始编码**

**动作**：只编辑对应 `docs/rfc/NNN-*.md`，更新元数据里的 **最后更新** 日期。

### 必须同步更新 `ROADMAP.md`

在以下任一情况发生后更新根目录 `ROADMAP.md` 的进度表：

- 决定**开始实现**某 RFC（将 ⏳ 改为 🔨，或新增一行）
- **完成**某 RFC 主要交付（将 🔨 改为 ✅）
- **取消 / 推迟**某 RFC（标记 ❌ 或注明 Deferred）
- **新增** RFC 编号或合并/拆分 RFC（在 **`ROADMAP.md`** 落表，编号/标题/阶段与新建 `NNN-*.md` 一致）

**原则**：**`ROADMAP.md` 是进度真相**；依赖与阶段叙事以各篇 RFC + `ROADMAP` 表为准。

### 必须同步更新 `TASK_TRACKING.md`（仅当仓库维护该文件时）

- **开工**某 RFC：新建 `## RFC-NNN: 标题` 小节，状态 🔨，**开始时间**，从 RFC 的「实施检查清单」复制为可勾选列表（初始多为 `[ ]`）
- **推进实现**：将已完成项改为 `[x]`，在「任务进度」追加带日期的简短记录
- **完工**：状态改为 ✅，勾选全部相关项，最后一条进度写清验证方式（测试命令等）
- **换当前 RFC**：若不再推进上一项，将上一节状态改为 ✅ 或 ⏸️，新开一节

**原则**：`TASK_TRACKING.md` 只保留**近期活跃**的 1～2 个 RFC 细节即可；过久的历史可压缩为一句「已于 YYYY-MM-DD 完成」并删除冗长勾选列表。

## 新建 RFC 步骤

1. 打开根目录 **`ROADMAP.md`**，结合 `docs/rfc/` 下已有 `NNN-*.md`，确定下一 **NNN** 与阶段。
2. 新建 `docs/rfc/NNN-kebab-case-title.md`（命名见 **`ROADMAP.md`** RFC 流程）；同步 **`TASK_TRACKING.md`** 表。
3. 文首元数据：编号、标题、状态（默认 Draft）、阶段、作者、创建日期、最后更新、**依赖**
4. 正文建议章节：Summary、Context / Problem、Goals、Proposed Solution、Implementation Details（含检查清单）、Alternatives、Risks、Testing Strategy、Dependencies。
5. 在 **`ROADMAP.md`** 进度表中**增加一行**（初始 ⏳）。
6. **不要**在尚未开工时把大段检查清单塞进 `TASK_TRACKING.md`；开工时再复制。

## 更新现有 RFC 步骤

1. 修改正文，更新元数据 **最后更新**。
2. 若范围扩大（新接口、新依赖、新阶段）：更新该 RFC 的 **依赖** 与 **阶段**；若影响整体排序或阶段列，**同步 `ROADMAP.md`**。
3. 若该 RFC 正在实现中且存在 **`TASK_TRACKING.md`**：同步检查清单与进度。

## RFC 实现与文档关系

- **实现代码**时：以 RFC 的 Implementation Details / 检查清单为验收参考；完成后 `ROADMAP.md` ✅，`TASK_TRACKING.md`（若有）勾选完成。
- **实现偏离 RFC**：优先更新 RFC「Proposed Solution」记录实际方案，并在 Alternatives 或 Context 中说明原因。

## 快速检查清单（代理自用）

- [ ] 开工/完工/取消/新增 RFC → 已更新 **`ROADMAP.md`**？（**首要**）
- [ ] 改了单篇 `docs/rfc/NNN-*.md` 的阶段或依赖 → **`ROADMAP.md`** 阶段/备注是否仍一致？
- [ ] 正在实现的 RFC 且存在 TASK_TRACKING → 检查清单与进度是否一致？
- [ ] 新增资源 → 是否放入 `docs/rfc/assets/` 并在 RFC 中引用？

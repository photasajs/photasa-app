---
name: rfc-management
description: >-
  RFC lifecycle operations: treat root ROADMAP.md as the single source of truth for
  RFC progress in ROADMAP.md + TASK_TRACKING.md; specs under docs/rfc and docs/rfc/completed; naming in ROADMAP RFC section; optional
  TASK_TRACKING.md for sprint checklists. Use when the user asks to manage RFCs, start or
  finish an RFC, sync roadmap or task tracking, implement according to an RFC, or wants the
  agent to drive work from RFC documents.
---

# RFC 管理（代理操作手册）

本技能说明 **RFC 驱动开发时的接话顺序与自检**。文件职责与更新时机见孪生技能 **`rfc-workflow`**。

## 与 `rfc-workflow` 的分工

| 技能 | 侧重 |
|------|------|
| **rfc-workflow** | 规范：各文件职责、何时更新 ROADMAP / TASK_TRACKING、新建 RFC 步骤 |
| **rfc-management**（本文件） | 执行：用户意图 → 动作序列 → 自检 |

代理遇到 RFC 相关任务时：**先读本文件，再按需打开 `rfc-workflow`**。

## 文件分工（进度以根目录 **`ROADMAP.md`** 为准）

以下路径为常见约定；若仓库不同，在 **`AGENTS.md`** 或 **`ROADMAP.md`** 中查找实际路径并替换。

1. **`ROADMAP.md`（仓库根目录）** — **权威进度表**：✅ 🔨 ⏳ ❌、阶段、备注。
2. **`docs/rfc/NNN-kebab-title.md`** — 各 RFC 规格；**依赖**写在篇内。
3. **`ROADMAP.md`**（RFC 流程/命名）+ **`TASK_TRACKING.md`** — 索引与全表。
4. **`TASK_TRACKING.md`**（可选）— 当前 1～2 个 RFC 的冲刺 `[ ]` 清单与日期。

资源：**`docs/rfc/assets/`**（若存在）。

## 用户意图 → 代理动作（速查）

### A. 「新建 RFC / 加阶段 / 立项」

1. 打开 **`ROADMAP.md`** + 列出 `docs/rfc/*.md`，确定 **NNN** 与阶段。
2. 新建 `docs/rfc/NNN-….md`（命名见 **`ROADMAP.md`** RFC 流程），并更新 **`TASK_TRACKING.md`**。
3. 在 **`ROADMAP.md`** 增加一行，状态 **⏳**。
4. **不要**在未开工时填满 **`TASK_TRACKING.md`** 长清单（若仓库使用该文件）。

### B. 「开工实现某 RFC」

1. 读 **`docs/rfc/NNN-*.md`**、**`ROADMAP.md`**、（若有）**`TASK_TRACKING.md`**。
2. **`ROADMAP.md`**：**⏳ → 🔨**。
3. **`TASK_TRACKING.md`**：新建 `## RFC-NNN`，**开始时间**，从 RFC 检查清单复制为 `[ ]`。

### C. 「推进 / 完工 / 取消」

| 事件 | `ROADMAP.md` | `TASK_TRACKING.md` | RFC 正文 |
|------|--------------|---------------------|----------|
| 推进 | 保持 🔨 | `[x]` + 日期进度 | 可选 **最后更新** |
| 主要交付完成 | **🔨 → ✅** | **✅** + 验证命令 | **最后更新** |
| 取消 / 延期 | **❌ 或 Deferred** | ⏸️ 或 ✅（注明） | 元数据或 Alternatives |
| 范围变大 / 拆 RFC | **先**更 `ROADMAP.md` | 调整清单 | **Proposed Solution**、篇内依赖 |

### D. 「只改文档」

- Draft 未开工：可只改 **`docs/rfc/NNN-*.md`**。**新建 RFC** 仍须在 **`ROADMAP.md`** 登记 **⏳**。
- 实现与规格不一致：优先 **更新 RFC** 正文。

### E. 「按 RFC 实现」

1. Implementation Details +（若有）**`TASK_TRACKING`**。
2. 偏离 RFC → 先改 RFC 再改代码或清单。
3. 做 **会话收尾自检**。

## 会话收尾自检

- [ ] 开工/完工/取消/新增 RFC → **`ROADMAP.md`** 已更新？
- [ ] 改了阶段/依赖 → **`ROADMAP.md`** 与 RFC 元数据一致？
- [ ] （若有）**`TASK_TRACKING.md`** 与本次提交一致？
- [ ] 新图 → **`docs/rfc/assets/`** 并已引用？

## 短提示

**规格**在 `docs/rfc/`，**进度**在根目录 **`ROADMAP.md`**，**冲刺台账**在（可选）**`TASK_TRACKING.md`**。

## 关联

- `.cursor/rules/rfc-agent.mdc`（若存在）
- 仓库 **`AGENTS.md`**（项目级路径与政策）

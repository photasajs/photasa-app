# RFC 0172 – Photasa MCP Server：Claude 协同操作接口

## Implementation principle (Photasa / Tauri)

> **Rust rewrite, not TypeScript copy.** Policy: [ROADMAP.md](../../ROADMAP.md).

**Status**: ⏳ Draft（待用户确认范围与优先级）
**Created**: 2026-07-26
**Area**: Tauri / MCP / Automation
**Related**: RFC 0167（`mcp__tauri__*` 调试桥接，webview JS 执行失败，与本 RFC 目标不同——见下方"与 RFC 0167 的区别"）

---

## Problem

当前 Claude 与 Photasa 唯一的交互方式是 `mcp__tauri__*` 调试桥（RFC 0167），且其 `webview_execute_js`/`read_logs` 两个关键工具已确认在开发模式下失效（"Resolve-ref helper was not available"）。即使修好，这套工具的定位也是**调试/自动化测试**（driver session、DOM snapshot、模拟点击），不是**面向用户价值的协同操作接口**。

用户提出的诉求是不同维度的能力：让 Claude 能像 Cowork（协同办公）一样，通过 MCP 直接对 Photasa 的照片库执行有意义的操作——查库存、找照片、发起扫描、管理标签/相册等，而不是"控制一个网页"。这需要 Photasa **自己作为 MCP Server**，暴露领域能力（domain capabilities），而不是暴露 WebView 控制权。

## 与 RFC 0167 的区别

| 维度            | RFC 0167（现状）                                            | RFC 0172（本提案）                            |
| --------------- | ----------------------------------------------------------- | --------------------------------------------- |
| 定位            | 调试/UI 自动化桥接                                          | 产品级协同操作接口                            |
| 谁是 MCP Server | Claude Code 自带的 `tauri` MCP 插件（第三方，控制 webview） | **Photasa 自己**（Rust 内实现，暴露领域 API） |
| 操作对象        | DOM、JS 执行、点击坐标                                      | 照片、相册、扫描任务、库路径等领域概念        |
| 现状            | 已知失效（webview resolve-ref 问题）                        | 尚未实现                                      |
| 依赖关系        | 无关，两者可并存                                            | 不依赖 RFC 0167 修复                          |

## Photasa 现有能力盘点（从 `src-tauri/src/commands/` 与 `src/services/` 提取）

| 领域      | 现有 Tauri 命令 / 服务                                                                                                   | 说明                           |
| --------- | ------------------------------------------------------------------------------------------------------------------------ | ------------------------------ |
| 导入      | `import_execute.rs`, `import_preview.rs`, `import_scan_directories.rs`, `import_file_groups.rs`, `import_path_filter.rs` | 扫描目录、分组、去重、执行导入 |
| 扫描/监听 | `scan_queue.rs`, `scan_runner.rs`, `watch.rs`, `watch_scan_queue.rs`                                                     | 库路径扫描队列、文件系统监听   |
| 元数据    | `extract_metadata.rs`, `extract_metadata_exif.rs`, `extract_metadata_video.rs`, `metadata_golden.rs`                     | EXIF/视频元数据提取            |
| 缩略图    | `thumbnail.rs`                                                                                                           | 缩略图生成                     |
| 目录结构  | `folder_tree.rs`, `directory.rs`, `path.rs`                                                                              | 库文件夹树、路径管理           |
| 偏好设置  | `preferences.rs`, `config.rs`, `update_config.rs`                                                                        | 用户配置读写                   |
| 应用状态  | `engine_status.rs`, `log_viewer.rs`, `log_toggle_shortcut.rs`                                                            | 引擎状态、日志                 |
| 窗口/系统 | `window.rs`, `shell.rs`, `menu.rs`, `platform.rs`                                                                        | 窗口控制、系统菜单、外部链接   |

这些命令目前只能被前端 Vue 层通过 `invoke()` 调用。要让 Claude 使用，需要一层**新的 MCP Server**，把其中"对协同操作有意义"的子集，翻译成 MCP tools。

## 候选能力分级（从产品视角，供讨论，非最终结论）

### Tier 1 — 只读查询（低风险，价值高，建议优先）

- 列出库路径 / 文件夹树
- 查询扫描/监听状态（队列长度、进行中任务）
- 按条件查找照片（路径、日期范围、EXIF 字段、标签——**取决于是否已有搜索索引**，需先确认 Photasa 当前是否有可查询的照片元数据存储）
- 查看应用配置（只读）

### Tier 2 — 安全动作（中风险，非破坏性，可撤销或幂等）

- 触发一次库路径扫描（复用 `scan_runner.rs`）
- 添加/移除库监听路径（复用 `chusuiliang`/`yuchigong` 已有的 add-path 链路）
- 发起导入（复用 `import_execute.rs`，需要用户已确认的路径与筛选条件，不做"猜测式"导入）
- 修改非破坏性偏好设置（如 UI 语言、缩略图质量）

### Tier 3 — 破坏性/不可逆操作（高风险，需要更强确认机制，本 RFC 建议默认不做）

- 删除照片、清空相册、移除库路径并删除已导入索引
- 覆盖偏好设置中的敏感项（如更换整个库根路径）

**建议**：RFC 先只做 Tier 1（只读），验证 MCP 集成路径可行后再决定 Tier 2 范围；Tier 3 除非用户明确要求，否则不纳入本 RFC 范围（与 CLAUDE.md「零破坏性变更」「Never break userspace」精神一致，也避免 Claude 通过 MCP 误删用户照片库）。

## 待决策：Server 运行形态（RFC 未预设结论，列出选项供选择）

### 选项 A：Photasa 内嵌 MCP Server（Rust，随应用启动）

- 在 `src-tauri` 新增一个 MCP server 模块，Photasa 启动时在本地端口/socket 监听。
- Claude Desktop / Claude Code 的 MCP 配置指向这个本地地址。
- 优点：与应用生命周期一致，天然访问同一份运行时状态（扫描队列、内存缓存），无需跨进程同步。
- 缺点：Photasa 未运行时 Claude 无法连接；需要处理端口冲突/多实例；MCP server 逻辑与桌面应用逻辑耦合在同一进程。

### 选项 B：独立 sidecar 进程

- 单独的 MCP server 二进制，通过现有 IPC（或新增一个本地 HTTP/gRPC 接口）与运行中的 Photasa 通信。
- 优点：解耦；MCP server 可以独立于 Photasa 主进程重启/升级；便于未来支持"Photasa 未启动时也能只读查询已缓存数据"。
- 缺点：需要新增一层进程间通信协议；比选项 A 复杂度高；首次实现成本更大。

### 推荐（初步倾向，非定论）

优先选项 A：复杂度更低，且当前所有候选能力（Tier 1）本身就要求 Photasa 处于运行状态（数据在内存/本地库中），选项 B 的"解耦"优势在这个阶段兑现不了。若未来需要"Photasa 未运行也能查询"，再考虑迁移到 B。

## Non-goals（本 RFC 不涉及）

- 不解决 RFC 0167 的 webview JS 执行失败问题（无关）。
- 不在本 RFC 内实现任何 Tier 3 破坏性操作。
- 不预设 MCP 协议细节（tool schema、认证方式）——留给实施阶段的详细设计，本 RFC 只定范围与形态。
- 不涉及多用户/远程访问场景——假定 Claude 与 Photasa 在同一台机器上。

## Acceptance（RFC 阶段）

1. 用户确认 Tier 1/2/3 的范围划分是否符合预期，或指出遗漏的领域能力。
2. 用户确认选项 A（内嵌）或选项 B（sidecar），或要求先做 Phase 0 spike 再定。
3. 若批准，产出后续实施 RFC（细化 MCP tool schema、鉴权、启动方式），本 RFC 保持"范围定义"层级不做代码改动。

## References

- `apps/photasa/src-tauri/src/commands/`（现有命令清单）
- `apps/photasa/src/services/`（现有服务清单）
- [RFC 0167](./0167-mcp-bridge-webview-js-not-working.md) — 调试桥接现状，与本 RFC 目标不同
- [Model Context Protocol](https://modelcontextprotocol.io/) — MCP 协议规范

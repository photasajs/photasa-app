---
name: tauri-debug-investigate
description: >-
    Debugs and investigates Tauri v2 desktop apps using the hypothesi Tauri MCP server (screenshots, DOM, logs, IPC), Rust backend logs, and cargo checks. Use when debugging Photasa or apps/photasa, investigating invoke failures, IPC/MCP bridge, webview errors, or when the user asks for Tauri debugging, MCP tauri tools, or systematic investigation steps.
---

# Tauri 调试与排查（Photasa）

## 本仓库上下文

- **应用路径**：`apps/photasa`（Vite + Vue + `src-tauri`）。
- **MCP 服务器**：根目录 `.mcp.json` 中 **`tauri`** 条目 → `npx -y @hypothesi/tauri-mcp-server`（自 npm 拉取）。
- **Bridge 插件**：仅在 **debug 构建**启用（`main.rs` 中 `#[cfg(debug_assertions)]` + `tauri_plugin_mcp_bridge`）。
- **必备配置**（缺一则 MCP 常连不上 WebView）：`tauri.conf.json` 里 `app.withGlobalTauri: true`；`src-tauri/capabilities/default.json` 含 `mcp-bridge:default`。
- **验证构建**：`cd apps/photasa/src-tauri && cargo build`（见 `ROADMAP.md`「如何证明工作」）。

## 何时读取本技能

- 用户提到 Tauri 崩溃、白屏、`invoke` 失败、IPC、WebView、MCP、`tauri dev`、Rust 后端日志。
- 需要用 **MCP 工具**做截图、看控制台、跟 IPC、点选元素时。

## 推荐排查顺序

1. **确认改动能编译**：`cargo build`（`src-tauri`），再按需前端 `pnpm --filter @photasa/photasa run build`。
2. **Rust 日志**：需要时设置 `RUST_LOG=debug`（或 `info`）再运行应用，看 **终端**里 `log::` / `tauri` 输出（主进程，天界风格日志见 `CLAUDE.md`）。
3. **MCP 会话**：在已启用 `tauri` MCP 的 Cursor 里，先 **`driver_session`**（`action: start`，默认端口常 **9223**），再 **`webview_screenshot` / `read_logs` / `ipc_monitor`** 等；应用须处于 **`tauri dev` 运行中**。
4. **前端**：WebView 内错误用 MCP `read_logs` 或浏览器 DevTools（若项目有打开方式）；逻辑问题对照 `src/api/legacy-api.ts` 与 `invoke` 名是否与 `main.rs` 注册一致。
5. **下结论前**：对照 `ROADMAP.md` 验证清单；声称修复须附命令输出证据（项目规范）。

## MCP 工具速查（上游包能力）

- **会话**：`driver_session`（start / stop / status）。
- **UI**：`webview_screenshot`、`webview_dom_snapshot`、`webview_interact`、`webview_execute_js`、`webview_wait_for`。
- **IPC**：`ipc_monitor`、`ipc_get_captured`、`ipc_execute_command`、`ipc_get_backend_state`。
- **日志**：`read_logs`。
- **设置**：`get_setup_instructions`（Bridge 插件变更时）。

完整列表以 [MCP Server Tauri 文档](https://hypothesi.github.io/mcp-server-tauri) 为准。

## 常见原因

| 现象             | 检查                                                                                        |
| ---------------- | ------------------------------------------------------------------------------------------- |
| MCP 无法操作界面 | `withGlobalTauri`、`mcp-bridge:default`、应用是否为 **debug** 运行、是否先 `driver_session` |
| `invoke` 报错    | 命令名是否与 `main.rs` 的 `generate_handler!` 一致；capabilities 是否允许对应插件           |
| 仅 release 失败  | release 不含 MCP 插件属预期；换 **dev** 做 MCP 调试                                         |

## 约束

- **不要**在未说明时自动长时间运行 `tauri dev`；可提示用户本地启动后再用 MCP 连接。
- **不要**用 `console.log` 替代主进程 `log`（见 `CLAUDE.md`）。
- 修改 MCP 或 `tauri` 依赖后提醒用户 **重启 Cursor** 以加载 MCP。

## 延伸阅读

- [Getting Started (MCP + Bridge)](https://hypothesi.github.io/mcp-server-tauri/guides/getting-started.html)
- 仓库 `ROADMAP.md` — Tauri 迁移阶段与 RFC 索引

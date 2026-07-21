# Tauri MCP 调试指南

使用 [hypothesi Tauri MCP Server](https://hypothesi.github.io/mcp-server-tauri) 在 Cursor 中调试 **Photasa**（`apps/photasa`）。

## 前提

- **Debug 构建**：`tauri_plugin_mcp_bridge` 仅在 `#[cfg(debug_assertions)]` 启用（见 `src-tauri/src/main.rs`）
- **`tauri.conf.json`**：`app.withGlobalTauri: true`
- **`capabilities/default.json`**：含 `mcp-bridge:default`
- 仓库 `.mcp.json` 已配置 `tauri` MCP 服务器

## 流程

1. 本地启动：`pnpm dev`（保持运行）
2. Cursor MCP：先 `driver_session`（`action: start`，默认端口 **9223**）
3. 常用工具：
    - `webview_screenshot` / `webview_dom_snapshot` — UI
    - `read_logs` — WebView 控制台
    - `ipc_monitor` / `ipc_execute_command` — `invoke` 排查
    - `webview_interact` / `webview_execute_js` — 自动化点击与脚本

## 与 Electron 调试的区别

| 旧（已移除）                     | 现（Tauri）                            |
| -------------------------------- | -------------------------------------- |
| `electron --inspect` 主进程      | Rust：`RUST_LOG` + LLDB / `cargo test` |
| `remote-debugging-port` 渲染进程 | WebView DevTools 或 MCP `read_logs`    |
| `src/main/`、`preload/`          | `src-tauri/`、`crates/`                |

Electron `apps/desktop` 已删除；勿再按 Electron 端口 9229/9222 配置。

## 常见现象

| 现象            | 检查                                                        |
| --------------- | ----------------------------------------------------------- |
| MCP 连不上      | debug 构建、`driver_session` 已 start、重启 Cursor 加载 MCP |
| `invoke` 无响应 | `ipc_monitor` 抓包；对照 `main.rs` 命令注册                 |
| Release 无 MCP  | 预期行为；用 `pnpm dev` 调试                                |

## 延伸阅读

- 仓库技能：`.claude/skills/tauri-debug-investigate/SKILL.md`
- [Getting Started (MCP + Bridge)](https://hypothesi.github.io/mcp-server-tauri/guides/getting-started.html)
- [DEBUG.md](DEBUG.md)

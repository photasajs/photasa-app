# Photasa 调试指南（Tauri）

## 快速开始

```bash
pnpm install
pnpm dev                    # Tauri 开发（Vite + Rust）
pnpm run vite:dev:photasa   # 仅前端，无原生窗口
```

Rust 日志：在运行 `tauri dev` 的终端查看 `log::` 输出；可用 `RUST_LOG=debug pnpm dev`。

## VS Code / Cursor

- **前端**：Vue 组件断点、`apps/photasa/src/`
- **Rust**：在 `apps/photasa/src-tauri/` 或 `crates/` 设断点，用 [CodeLLDB](https://marketplace.visualstudio.com/items?itemName=vadimcn.vscode-lldb) 附加到 `photasa` 进程，或 `cargo test` 调试单测

## WebView 开发者工具

- macOS：`Cmd+Option+I`（若未禁用）
- 或 Tauri MCP：`read_logs`、`webview_dom_snapshot` — 见 [DEBUG_MCP.md](DEBUG_MCP.md)

## 常见问题

### `invoke` 失败

1. 命令名是否与 `main.rs` 的 `generate_handler!` 一致
2. `src-tauri/capabilities/*.json` 是否包含对应权限
3. 前端是否走 `YuanTianGang.executeZhaoling` 或 `legacy-api` 中已注册的命令

### 构建失败

```bash
pnpm install
cd apps/photasa/src-tauri && cargo clean && cargo build
```

原生依赖（libheif、FFmpeg 静态链）见 [RFC 0103](../.spec/rfc/completed/0103-tauri-native-deps-build-strategy.md)。

### 测试

```bash
pnpm --filter @photasa/photasa run test:unit
cargo test --workspace
pnpm run clippy
```

## 目录速查

| 层         | 路径                                   |
| ---------- | -------------------------------------- |
| Vue UI     | `apps/photasa/src/`                    |
| 贞观服务   | `apps/photasa/src/services/`           |
| IPC 兼容   | `apps/photasa/src/api/legacy-api.ts`   |
| Tauri 命令 | `apps/photasa/src-tauri/src/commands/` |
| Rust 算法  | `crates/photasa-*`                     |

## 相关文档

- [Development Guide](DEV_GUIDE.md)
- [MCP 调试](DEBUG_MCP.md)
- [Tauri 调试技能](../.claude/skills/tauri-debug-investigate/SKILL.md)
- [Tauri 官方调试](https://v2.tauri.app/develop/debug/)

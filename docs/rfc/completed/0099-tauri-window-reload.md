# RFC 0099: window_reload command（Tauri）

- **Start Date**: 2026-04-05
- **Status**: Implemented
- **Depends on**: RFC 0073 (UI adapter), RFC 0075 (flat legacy API)

## Implementation principle (Photasa / Tauri)

> **Rust rewrite, not TypeScript copy.** Policy: [../TAURI_RUST_REWRITE_POLICY.md](../TAURI_RUST_REWRITE_POLICY.md).

- Electron/Node code is a **behavioral specification** only—not a library for Photasa.
- Implement in `apps/photasa/src-tauri` and `crates/`; **do not** import `@photasa/scan`, `@photasa/import`, or other Node packages from Tauri.
- **1:1 parity** = same IPC/events/on-disk formats; **not** porting TypeScript source.

## Summary

在 Tauri 中实现 `window_reload` 命令，与 Electron 的 `window:reload` IPC 和菜单 `role: "reload"` 保持 1:1 对齐。

## Motivation

Electron `WindowService` 通过 `removeAllListeners("window:reload")` 管理生命周期，且 `menu-data.ts` 中声明了 `role: "reload"` 和 `role: "forceReload"` 菜单项（Ctrl+R / force reload）。Tauri 侧目前 `window.rs` 没有 reload 命令，`legacy-api.ts` 也没有对应入口。

当用户按 Ctrl+R 或从菜单点击「重新加载」时，在 Tauri 中需要通过 `window.webContents.reload()` 的 Tauri 等价调用来刷新 WebView。

## Detailed Design

### Rust 命令（`commands/window.rs`）

```rust
/// 重新加载 WebView（与 Electron window:reload 对齐）
#[tauri::command]
pub fn reload_window(webview_window: tauri::WebviewWindow) -> Result<(), String> {
    webview_window.reload().map_err(|e| e.to_string())
}
```

### 注册（`main.rs`）

```rust
window::reload_window,
```

### 前端 legacy-api

在 `legacy-api.ts` 的 window 区段：

```ts
reloadWindow: isTauri()
    ? () => ensureInvoke().then((invoke) => invoke("reload_window"))
    : () => Promise.resolve((window as any).electronAPI?.api?.reloadWindow?.()),
```

### 菜单集成

Tauri 侧的 `apply_system_menu` 中，对 `role: "reload"` 的菜单项触发 `reload_window` invoke。

## Drawbacks

Tauri 不直接支持菜单的 `role` 概念；reload 需要通过 `window.eval` 或等价 API 手动触发。

## Alternatives

- 使用 `tauri::WebviewWindow::reload` 方法（若 Tauri v2 提供）代替 `window.eval`。
- 在前端直接通过菜单 action 回调调用 `window.location.reload()`，无需 Rust 命令（如果菜单 action 已经路由到渲染进程，这是最简方案）。

## Implementation Checklist

1. `commands/window.rs`：`reload_window`（`WebviewWindow::reload`）
2. `main.rs`：注册 `reload_window`
3. `legacy-api.ts`：`reloadWindow`
4. `zhangsunwuji` / `menu-keys`：Tauri `picasa:menu-action` 仅含 `key`，对 `view-reload` 显式 `reloadWindow`
5. 验证：Tauri dev 下系统菜单「重新加载」刷新 WebView；Vitest `legacy-api-reload-window.test.ts`

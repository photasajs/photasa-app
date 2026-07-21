# RFC 0101: Tauri 启动 Splash 屏幕

- **Start Date**: 2026-04-05
- **Status**: Implemented
- **Depends on**: RFC 0067 (Tauri overall)

## Implementation principle (Photasa / Tauri)

> **Rust rewrite, not TypeScript copy.** Policy: [ROADMAP.md](../../../ROADMAP.md).

- Electron/Node code is a **behavioral specification** only—not a library for Photasa.
- Implement in `apps/photasa/src-tauri` and `crates/`; **do not** import `@photasa/scan`, `@photasa/import`, or other Node packages from Tauri.
- **1:1 parity** = same IPC/events/on-disk formats; **not** porting TypeScript source.

## Summary

在 Tauri 中实现与 Electron `SplashWindow` 等价的启动画面：应用启动时显示轻量 Splash 窗口（进度 + 状态文字），主窗口就绪后隐藏。

## Motivation

`apps/desktop/src/main/splash/splash-window.ts` 提供：

- 独立的无边框 Splash 窗口（`always_on_top`，`skip_taskbar`）
- `show()` / `hide()` / `updateProgress(n)` / `updateStatus(msg)` / `setTheme(light|dark)` 接口
- 主窗口初始化完成后调用 `hide()` 过渡

这是用户体验的重要组成，Tauri 目前无等价实现；冷启动时用户会看到空白窗口。

## Detailed Design

### 方案：Tauri 多窗口 + Splashscreen 模式

Tauri 官方支持 Splashscreen 模式：主窗口隐藏，Splash 窗口先显示，初始化完成后切换。

### `tauri.conf.json` 变更

```json
{
    "windows": [
        {
            "label": "main",
            "visible": false,
            "title": "Photasa"
        },
        {
            "label": "splash",
            "url": "splash.html",
            "width": 400,
            "height": 240,
            "decorations": false,
            "alwaysOnTop": true,
            "skipTaskbar": true,
            "resizable": false,
            "center": true
        }
    ]
}
```

### Rust 命令

```rust
/// 关闭 Splash 窗口，显示主窗口（初始化完成时调用）
#[tauri::command]
pub fn close_splashscreen(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(splash) = app.get_webview_window("splash") {
        splash.close().map_err(|e| e.to_string())?;
    }
    if let Some(main) = app.get_webview_window("main") {
        main.show().map_err(|e| e.to_string())?;
        main.set_focus().map_err(|e| e.to_string())?;
    }
    Ok(())
}
```

### Splash 前端（`splash.html`）

- 轻量 HTML（无 Vue 框架依赖），显示 Logo + 进度条 + 状态文字
- 通过 Tauri event 接收 `splash:progress` 和 `splash:status` 更新

### 主窗口初始化流程

```
App.vue onMounted → 初始化服务 → invoke("close_splashscreen")
```

### legacy-api 接口（可选）

```ts
splashClose: isTauri()
    ? () => ensureInvoke().then((invoke) => invoke("close_splashscreen"))
    : () => Promise.resolve(),
```

## Drawbacks

- 需要额外的 `splash.html` 静态页面
- 多窗口增加少量初始化复杂度

## Alternatives

- **不实现**：冷启动时白屏，用户体验较差；可作为 v1 临时方案。
- **CSS 遮罩**：在主窗口内用全屏 CSS 遮罩模拟，无需第二窗口；实现简单但效果逊于独立窗口。

## Implementation Checklist

1. `tauri.conf.json`：配置 splash 和 main 两个窗口（main 初始 `visible: false`）
2. `src-tauri/src/commands/window.rs`：添加 `close_splashscreen`
3. `main.rs`：注册 `close_splashscreen`
4. `apps/photasa/public/splash.html`（或 `src/splash/`）：轻量 Splash UI
5. 主窗口 `App.vue`：初始化完成后 invoke `close_splashscreen`
6. 验证：冷启动先显示 Splash，约 1-2 秒后平滑过渡到主窗口

## Implementation（Photasa）

- `apps/photasa/src-tauri/tauri.conf.json`：`main`（`visible: false`）+ `splash`（`url: splash.html`）
- `apps/photasa/public/splash.html`：轻量静态页（标题 + 文案 + CSS 旋转圈）
- `commands/window.rs`：`close_splashscreen`；`main.rs` 已注册
- `apps/photasa/src/App.vue`：`onMounted` 在 `initializeApp()` 的 `finally` 中 `invoke("close_splashscreen")`
- **未做**：Electron 的 `splash:progress` / `splash:status` 事件驱动更新（可按需后续加 `emit`）

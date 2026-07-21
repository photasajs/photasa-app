# RFC 0100: 单实例管理（Tauri single-instance）

- **Start Date**: 2026-04-05
- **Status**: Implemented
- **Depends on**: RFC 0067 (Tauri overall)

## Implementation principle (Photasa / Tauri)

> **Rust rewrite, not TypeScript copy.** Policy: [ROADMAP.md](../../../ROADMAP.md).

- contract reference/Node code is a **behavioral specification** only—not a library for Photasa.
- Implement in `apps/photasa/src-tauri` and `crates/`; **do not** import `@photasa/scan`, `@photasa/import`, or other Node packages from Tauri.
- **1:1 parity** = same IPC/events/on-disk formats; **not** porting TypeScript source.

## Summary

在 Tauri 中实现与 legacy-api `SingleInstanceManager` 1:1 对等的单实例约束：第二个实例启动时聚焦已有窗口并退出，macOS 点击 Dock 图标时若无窗口则新建。

## Motivation

`historical main/single-instance-manager.ts` 通过 `app.requestSingleInstanceLock()` 实现：

- 获取锁成功 → 正常启动，监听 `second-instance` 事件；
- 获取锁失败（已有实例）→ `app.quit()`；
- `second-instance` → `focusOnSecondInstance`（取消最小化 + 聚焦）；
- macOS `activate` → `createWindowOnMacOS`（若无窗口则新建）。

Tauri 目前 `Cargo.toml` 未引入 `tauri-plugin-single-instance`，`main.rs` 也无对应配置，行为未定义（多实例可能同时运行）。

## Detailed Design

### Cargo.toml

```toml
[dependencies]
tauri-plugin-single-instance = "2"
```

### `main.rs`

```rust
use tauri_plugin_single_instance::SingleInstance;

tauri::Builder::default()
 .plugin(
 tauri_plugin_single_instance::init(|app, _argv, _cwd| {
 // 第二个实例启动时：聚焦已有窗口
 if let Some(window) = app.get_webview_window("main") {
 let _ = window.unminimize();
 let _ = window.set_focus();
 }
 })
 )
 // …其余插件与命令…
```

### macOS Dock 点击（`activate` 等价）

Tauri v2 通过 `tauri::RunEvent::Reopen` 处理 macOS Dock 重激活事件：

```rust
.build(tauri::generate_context!())
.expect("error while building tauri application")
.run(|app_handle, event| {
 if let tauri::RunEvent::Reopen { has_visible_windows, .. } = event {
 if !has_visible_windows {
 // 重新创建主窗口（对齐 createWindowOnMacOS）
 // TODO: 封装为 create_main_window(app_handle)
 }
 }
});
```

### Capabilities

`tauri-plugin-single-instance` 不需要额外 capability 声明（进程级，非 IPC）。

## Drawbacks

- `tauri-plugin-single-instance` 在 Linux 下依赖 D-Bus；若目标 Linux 环境无 D-Bus，需 feature flag 降级。
- Windows 下通过 named mutex 实现；无已知风险。

## Alternatives

- 不实现单实例：开发阶段可接受，生产环境不可接受（用户双击图标可能打开多窗口）。
- 自行实现 lockfile：复杂且跨平台不可靠；`tauri-plugin-single-instance` 是官方推荐方案。

## Implementation Checklist

1. `Cargo.toml`：`tauri-plugin-single-instance = "2"`（解析为 2.x，如 2.4.1）
2. `main.rs`：首插件注册 `tauri_plugin_single_instance::init`，回调内 `unminimize` + `show` + `set_focus` 主窗（label `main`）
3. `main.rs`：`build` + `run` 闭包中处理 `RunEvent::Reopen`（仅 macOS），无可见窗时 `restore_main_window`（恢复或 `WebviewWindowBuilder::from_config` 重建）
4. 验证：启动两个 Photasa 实例，第二个自动退出，第一个窗口获得焦点（需本机手测）
5. 验证（macOS）：Dock 点击恢复/重建（需本机手测）

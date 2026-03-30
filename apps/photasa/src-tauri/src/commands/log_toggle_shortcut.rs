//! 日志查看器全局快捷键，与 Electron `LogViewerService.registerGlobalShortcut` 一致（RFC 0092 扩展）
//!
//! macOS: Cmd+Shift+Alt+L；Windows/Linux: Ctrl+Shift+Alt+L

use tauri::{AppHandle, Emitter};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, ShortcutState};

/// 与 `apps/desktop/src/main/log-viewer/log-viewer-service.ts` 中 `globalShortcut.register` 组合一致
const SHORTCUT_MACOS: &str = "cmd+shift+alt+KeyL";
const SHORTCUT_WIN_LINUX: &str = "ctrl+shift+alt+KeyL";

/// 注册全局快捷键并在按下时向渲染进程发射 `log:toggle-viewer`
pub fn register_log_toggle_shortcut(app: &AppHandle) {
    let shortcut = if cfg!(target_os = "macos") {
        SHORTCUT_MACOS
    } else {
        SHORTCUT_WIN_LINUX
    };

    let handle = app.clone();
    match handle.global_shortcut().on_shortcut(shortcut, move |app, _shortcut, event| {
        if event.state == ShortcutState::Pressed {
            if let Err(e) = app.emit("log:toggle-viewer", serde_json::json!({})) {
                log::warn!("🌌 发射 log:toggle-viewer 失败：{e}");
            }
        }
    }) {
        Ok(()) => log::info!("🌌 日志查看器全局快捷键已注册：{shortcut}"),
        Err(e) => log::warn!("🌌 日志查看器全局快捷键注册失败：{e}"),
    }
}

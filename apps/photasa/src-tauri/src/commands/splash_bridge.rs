//! Splash 启动窗事件桥（RFC 0101）— 对齐 Electron `SplashWindow` 的 IPC 契约。

use tauri::{AppHandle, Emitter, Manager, Runtime, Theme, WebviewWindow};

pub const SPLASH_WEBVIEW_LABEL: &str = "splash";
pub const MAIN_WEBVIEW_LABEL: &str = "main";

pub const EVENT_SPLASH_THEME: &str = "splash:theme-changed";
pub const EVENT_SPLASH_STATUS: &str = "splash:status-update";
pub const EVENT_SPLASH_PROGRESS: &str = "splash:progress-update";

/// Tauri `Theme` → Splash 前端 `light` | `dark`。
pub fn theme_payload(theme: Theme) -> &'static str {
    match theme {
        Theme::Dark => "dark",
        Theme::Light => "light",
        // Tauri 未来若扩展枚举，默认浅色以保持可读性
        _ => "light",
    }
}

/// 从已创建的 webview 解析当前系统/应用主题。
pub fn resolve_app_theme<R: Runtime>(app: &AppHandle<R>) -> Theme {
    for label in [SPLASH_WEBVIEW_LABEL, MAIN_WEBVIEW_LABEL] {
        if let Some(w) = app.get_webview_window(label) {
            if let Ok(theme) = w.theme() {
                return theme;
            }
        }
    }
    Theme::Light
}

fn emit_to_splash<R: Runtime, P: serde::Serialize + Clone>(
    splash: &WebviewWindow<R>,
    event: &str,
    payload: P,
) {
    let _ = splash.emit(event, payload);
}

/// 向 Splash 发射指定主题。
pub fn emit_splash_theme<R: Runtime>(app: &AppHandle<R>, theme: Theme) {
    if let Some(splash) = app.get_webview_window(SPLASH_WEBVIEW_LABEL) {
        emit_to_splash(&splash, EVENT_SPLASH_THEME, theme_payload(theme));
    }
}

/// 向 Splash 同步主题（启动时与 `RunEvent::ThemeChanged` 时调用）。
pub fn sync_splash_theme<R: Runtime>(app: &AppHandle<R>) {
    emit_splash_theme(app, resolve_app_theme(app));
}

pub fn emit_splash_status<R: Runtime>(app: &AppHandle<R>, message: impl Into<String>) {
    if let Some(splash) = app.get_webview_window(SPLASH_WEBVIEW_LABEL) {
        emit_to_splash(&splash, EVENT_SPLASH_STATUS, message.into());
    }
}

/// `progress` 为 0–100 表示确定进度；`-1` 表示不确定（与 Electron 一致）。
pub fn emit_splash_progress<R: Runtime>(app: &AppHandle<R>, progress: i32) {
    if let Some(splash) = app.get_webview_window(SPLASH_WEBVIEW_LABEL) {
        emit_to_splash(&splash, EVENT_SPLASH_PROGRESS, progress);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn theme_payload_maps_light_and_dark() {
        assert_eq!(theme_payload(Theme::Light), "light");
        assert_eq!(theme_payload(Theme::Dark), "dark");
    }
}

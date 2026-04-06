use tauri::{AppHandle, Manager, WebviewWindow, Window};

/// Splash 窗口 label，须与 `tauri.conf.json` 中第二窗一致（RFC 0101）
const SPLASH_WEBVIEW_LABEL: &str = "splash";
/// 主窗 label，须与首窗 `label` 或 Tauri 默认 `main` 一致
const MAIN_WEBVIEW_LABEL: &str = "main";

/// 主界面就绪后关闭 Splash 并显示主窗（RFC 0101）
#[tauri::command]
pub fn close_splashscreen(app: AppHandle) -> Result<(), String> {
    if let Some(splash) = app.get_webview_window(SPLASH_WEBVIEW_LABEL) {
        splash.close().map_err(|e| e.to_string())?;
    }
    if let Some(main) = app.get_webview_window(MAIN_WEBVIEW_LABEL) {
        let _ = main.show();
        let _ = main.set_focus();
    }
    Ok(())
}

/// 重新加载主 WebView（RFC 0099，与 Electron window:reload / 菜单「重新加载」对齐）
#[tauri::command]
pub fn reload_window(webview_window: WebviewWindow) -> Result<(), String> {
    webview_window.reload().map_err(|e| e.to_string())
}

/// 最小化窗口
#[tauri::command]
pub fn minimize_window(window: Window) -> Result<(), String> {
    window.minimize().map_err(|e| e.to_string())
}

/// 最大化窗口
#[tauri::command]
pub fn maximize_window(window: Window) -> Result<(), String> {
    window.maximize().map_err(|e| e.to_string())
}

/// 取消最大化窗口
#[tauri::command]
pub fn unmaximize_window(window: Window) -> Result<(), String> {
    window.unmaximize().map_err(|e| e.to_string())
}

/// 关闭窗口
#[tauri::command]
pub fn close_window(window: Window) -> Result<(), String> {
    window.close().map_err(|e| e.to_string())
}

/// 检查窗口是否最大化
#[tauri::command]
pub fn is_maximized(window: Window) -> Result<bool, String> {
    window.is_maximized().map_err(|e| e.to_string())
}

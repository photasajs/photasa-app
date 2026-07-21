/*!
 * Shell 命令
 * 提供系统 Shell 交互功能
 */
use tauri_plugin_shell::ShellExt;

/// 在文件管理器中显示文件
#[tauri::command]
#[allow(deprecated)]
pub async fn show_in_folder(app: tauri::AppHandle, path: String) -> Result<(), String> {
    app.shell()
        .open(path, None)
        .map_err(|e| format!("Failed to show in folder: {e}"))
}

/// 打开外部 URL
#[tauri::command]
#[allow(deprecated)]
pub async fn open_external(app: tauri::AppHandle, url: String) -> Result<(), String> {
    app.shell()
        .open(url, None)
        .map_err(|e| format!("Failed to open external: {e}"))
}

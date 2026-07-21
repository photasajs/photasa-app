/*!
 * 平台检测命令 (RFC 0091)
 * 返回与 Node process.platform 一致的值，供前端 isMac 等使用
 */

/// 返回当前操作系统标识："darwin" | "win32" | "linux"
#[tauri::command]
pub fn get_platform() -> String {
    match std::env::consts::OS {
        "macos" => "darwin".to_string(),
        "windows" => "win32".to_string(),
        "linux" => "linux".to_string(),
        other => other.to_string(),
    }
}

/// 应用版本（与 Cargo 包版本一致，供 legacy-api getAppVersion）
#[tauri::command]
pub fn get_app_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

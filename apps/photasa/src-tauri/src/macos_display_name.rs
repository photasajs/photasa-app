//! macOS Dock / 菜单栏应用名。
//!
//! `tauri dev` 以 `target/debug/photasa` 裸二进制启动时，Dock 优先显示**可执行文件名**（Cargo 包名），
//! 不会读窗口 `title` 或运行时 `productName`。需尽早 `setProcessName`，并在 dev 配置里用 `mainBinaryName`
//! 让 Tauri CLI 把二进制重命名为 `Photasa Dev`。

use serde_json::Value;

/// 在 `main()` 最开头调用（早于 Tauri 初始化），避免 Dock 已缓存 `photasa`。
#[cfg(target_os = "macos")]
pub fn apply_process_display_name_early() {
    if let Some(name) = resolve_display_name() {
        apply_process_display_name(&name);
    }
}

/// `setup` 中再次对齐（配置已完全合并时兜底）。
#[cfg(target_os = "macos")]
pub fn apply_process_display_name(name: &str) {
    if name.is_empty() {
        return;
    }

    use objc2_foundation::{NSProcessInfo, NSString};

    let ns_name = NSString::from_str(name);
    let process_info = NSProcessInfo::processInfo();
    process_info.setProcessName(&ns_name);
}

#[cfg(not(target_os = "macos"))]
pub fn apply_process_display_name_early() {}

#[cfg(not(target_os = "macos"))]
pub fn apply_process_display_name(_name: &str) {}

#[cfg(target_os = "macos")]
fn resolve_display_name() -> Option<String> {
    if let Ok(overlay) = std::env::var("TAURI_CONFIG") {
        if let Ok(value) = serde_json::from_str::<Value>(&overlay) {
            if let Some(name) = value
                .get("productName")
                .and_then(Value::as_str)
                .filter(|s| !s.is_empty())
            {
                return Some(name.to_string());
            }
        }
    }
    None
}

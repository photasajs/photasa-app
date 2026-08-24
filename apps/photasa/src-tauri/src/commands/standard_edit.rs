//! macOS 标准编辑菜单动作：自定义文案 + NSApp 转发到第一响应者

/// 支持的编辑动作（与 menu-data 中 edit-* 项对应）
const SUPPORTED_ACTIONS: &[&str] = &["undo", "redo", "cut", "copy", "paste", "selectAll"];

#[tauri::command]
pub fn dispatch_standard_edit_action(action: String) -> Result<(), String> {
    if !SUPPORTED_ACTIONS.contains(&action.as_str()) {
        return Err(format!("不支持的编辑操作: {action}"));
    }

    #[cfg(target_os = "macos")]
    {
        dispatch_standard_edit_action_macos(&action)
    }

    #[cfg(not(target_os = "macos"))]
    {
        let _ = action;
        Ok(())
    }
}

#[cfg(target_os = "macos")]
fn dispatch_standard_edit_action_macos(action: &str) -> Result<(), String> {
    use objc2::sel;
    use objc2_app_kit::NSApplication;
    use objc2_foundation::MainThreadMarker;

    let selector = match action {
        "undo" => sel!(undo:),
        "redo" => sel!(redo:),
        "cut" => sel!(cut:),
        "copy" => sel!(copy:),
        "paste" => sel!(paste:),
        "selectAll" => sel!(selectAll:),
        _ => return Err(format!("不支持的编辑操作: {action}")),
    };

    let mtm = MainThreadMarker::new().ok_or("编辑菜单动作必须在主线程执行")?;
    let app = NSApplication::sharedApplication(mtm);
    let handled = unsafe { app.sendAction_to_from(selector, None, None) };
    if handled {
        Ok(())
    } else {
        Err(format!("编辑操作无可用目标: {action}"))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_unknown_edit_action() {
        let err = dispatch_standard_edit_action("delete".into()).unwrap_err();
        assert!(err.contains("不支持的编辑操作"));
    }

    #[test]
    #[cfg(not(target_os = "macos"))]
    fn accepts_known_edit_action_on_non_macos() {
        dispatch_standard_edit_action("cut".into()).expect("非 macOS 应为 no-op 成功");
    }
}

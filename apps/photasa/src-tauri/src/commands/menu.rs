/*!
 * 系统菜单命令 (RFC 0092)
 *
 * 在 macOS 上通过 Tauri v2 Menu API 构建应用程序系统菜单，
 * 菜单项点击事件通过 picasa:menu-action 事件推送给前端。
 * Windows/Linux 暂不实现系统菜单（与 Electron 行为一致）。
 */
use serde::{Deserialize, Serialize};
use std::sync::OnceLock;
use tauri::{AppHandle, Emitter};
use tauri::menu::{Menu, MenuItemBuilder, PredefinedMenuItem, Submenu, SubmenuBuilder};

static MENU_LISTENER_REGISTERED: OnceLock<()> = OnceLock::new();

// ============================================================
// 数据类型（与前端 MenuItemData 一致）
// ============================================================

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct MenuItemData {
    pub key: String,
    pub label: String,
    pub shortcut: Option<String>,
    pub disabled: Option<bool>,
    pub role: Option<String>,
    pub url: Option<String>,
    #[serde(rename = "isMacOnly")]
    pub is_mac_only: Option<bool>,
    pub items: Option<Vec<MenuItemData>>,
    #[serde(rename = "type")]
    pub item_type: Option<String>,
}

#[derive(Debug, Serialize, Clone)]
pub struct MenuActionPayload {
    pub key: String,
}

// ============================================================
// apply_system_menu — 构建并设置系统菜单
// ============================================================

/// 接收前端菜单数据，构建 macOS 系统菜单
#[tauri::command]
pub fn apply_system_menu(app: AppHandle, menus: Vec<MenuItemData>) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        build_and_set_menu(&app, menus)?;
    }
    #[cfg(not(target_os = "macos"))]
    {
        // Windows/Linux 暂不设置系统菜单
        let _ = (app, menus);
    }
    Ok(())
}

#[cfg(target_os = "macos")]
fn build_and_set_menu(app: &AppHandle, menus: Vec<MenuItemData>) -> Result<(), String> {
    let menu = Menu::new(app).map_err(|e| e.to_string())?;

    for group in &menus {
        let submenu = build_submenu(app, group)?;
        menu.append(&submenu).map_err(|e| e.to_string())?;
    }

    app.set_menu(menu).map_err(|e| e.to_string())?;

    // 只注册一次菜单事件监听，避免多次调用 apply_system_menu 重复触发
    MENU_LISTENER_REGISTERED.get_or_init(|| {
        let app_handle = app.clone();
        app.on_menu_event(move |_app, event| {
            let _ = app_handle.emit("picasa:menu-action", MenuActionPayload {
                key: event.id().0.clone(),
            });
        });
    });

    Ok(())
}

#[cfg(target_os = "macos")]
fn build_submenu(app: &AppHandle, data: &MenuItemData) -> Result<Submenu<tauri::Wry>, String> {
    let mut builder = SubmenuBuilder::new(app, &data.label);

    if let Some(items) = &data.items {
        for item in items {
            // 跳过 macOnly 项目（在非 macOS 平台）
            if item.is_mac_only == Some(true) {
                #[cfg(not(target_os = "macos"))]
                continue;
            }

            // 分隔线
            if item.item_type.as_deref() == Some("separator") {
                builder = builder.separator();
                continue;
            }

            // role 菜单项（系统预置，如 quit, hide, copy, paste…）
            if let Some(role) = &item.role {
                if let Some(predefined) = role_to_predefined(app, role) {
                    builder = builder.item(&predefined);
                    continue;
                }
            }

            // 子菜单（嵌套）
            if item.items.as_ref().map(|v| !v.is_empty()).unwrap_or(false) {
                let sub = build_submenu(app, item)?;
                builder = builder.item(&sub);
                continue;
            }

            // 普通菜单项
            let mut mb = MenuItemBuilder::with_id(&item.key, &item.label);
            if item.disabled == Some(true) {
                mb = mb.enabled(false);
            }
            if let Some(acc) = &item.shortcut {
                mb = mb.accelerator(acc);
            }
            let mi = mb.build(app).map_err(|e| e.to_string())?;
            builder = builder.item(&mi);
        }
    }

    builder.build().map_err(|e| e.to_string())
}

/// 将 Electron role 字符串映射到 Tauri PredefinedMenuItem
#[cfg(target_os = "macos")]
fn role_to_predefined(app: &AppHandle, role: &str) -> Option<PredefinedMenuItem<tauri::Wry>> {
    match role {
        "quit" | "close" => PredefinedMenuItem::quit(app, None).ok(),
        "hide" => PredefinedMenuItem::hide(app, None).ok(),
        "hideOthers" => PredefinedMenuItem::hide_others(app, None).ok(),
        "unhide" | "showAll" => PredefinedMenuItem::show_all(app, None).ok(),
        "minimize" => PredefinedMenuItem::minimize(app, None).ok(),
        "zoom" | "maximize" => PredefinedMenuItem::maximize(app, None).ok(),
        "cut" => PredefinedMenuItem::cut(app, None).ok(),
        "copy" => PredefinedMenuItem::copy(app, None).ok(),
        "paste" => PredefinedMenuItem::paste(app, None).ok(),
        "selectAll" => PredefinedMenuItem::select_all(app, None).ok(),
        "undo" => PredefinedMenuItem::undo(app, None).ok(),
        "redo" => PredefinedMenuItem::redo(app, None).ok(),
        "separator" => PredefinedMenuItem::separator(app).ok(),
        "about" => PredefinedMenuItem::about(app, None, None).ok(),
        "togglefullscreen" | "fullscreen" => PredefinedMenuItem::fullscreen(app, None).ok(),
        _ => None,
    }
}

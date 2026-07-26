/*!
 * 系统菜单命令 (RFC 0092, 0169)
 *
 * 在 macOS 上通过 Tauri v2 Menu API 构建应用程序系统菜单，
 * 菜单项点击事件通过 picasa:menu-action 事件推送给前端。
 * Windows/Linux 暂不实现系统菜单（与 legacy-api 行为一致）。
 */
use serde::{Deserialize, Serialize};
use tauri::AppHandle;

#[cfg(target_os = "macos")]
use std::sync::{Mutex, OnceLock};
#[cfg(target_os = "macos")]
use tauri::menu::{
    Menu, MenuItem, MenuItemBuilder, MenuItemKind, PredefinedMenuItem, Submenu, SubmenuBuilder,
    HELP_SUBMENU_ID, WINDOW_SUBMENU_ID,
};
#[cfg(target_os = "macos")]
use tauri::Emitter;

#[cfg(target_os = "macos")]
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
    #[serde(rename = "excludeOnMac")]
    pub exclude_on_mac: Option<bool>,
    pub items: Option<Vec<MenuItemData>>,
    #[serde(rename = "type")]
    pub item_type: Option<String>,
}

#[cfg(target_os = "macos")]
#[derive(Debug, Serialize, Clone)]
struct MenuActionPayload {
    pub key: String,
}

/// 缓存已构建的系统菜单，供 `update_menu_item` 增量更新（RFC 0169）
#[cfg(target_os = "macos")]
pub struct MenuState {
    menu: Mutex<Option<Menu<tauri::Wry>>>,
}

#[cfg(target_os = "macos")]
impl MenuState {
    pub fn new() -> Self {
        Self {
            menu: Mutex::new(None),
        }
    }
}

#[cfg(not(target_os = "macos"))]
pub struct MenuState;

#[cfg(not(target_os = "macos"))]
impl MenuState {
    pub fn new() -> Self {
        Self
    }
}

// ============================================================
// apply_system_menu — 构建并设置系统菜单
// ============================================================

/// 接收菜单数据，构建 macOS 系统菜单（供 Tauri 命令与天枢适配器共用）
pub fn apply_menus(
    app: &AppHandle,
    menu_state: &MenuState,
    menus: Vec<MenuItemData>,
) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        build_and_set_menu(app, menu_state, menus)?;
    }
    #[cfg(not(target_os = "macos"))]
    {
        let _ = (app, menu_state, menus);
    }
    Ok(())
}

/// 接收前端菜单数据，构建 macOS 系统菜单
#[tauri::command]
pub fn apply_system_menu(
    app: AppHandle,
    menu_state: tauri::State<'_, MenuState>,
    menus: Vec<MenuItemData>,
) -> Result<(), String> {
    apply_menus(&app, &menu_state, menus)
}

/// 按 id 增量更新单个菜单项（禁用状态 / 文案），不重建整棵菜单树（RFC 0169）
#[tauri::command]
pub fn update_menu_item(
    menu_state: tauri::State<'_, MenuState>,
    key: String,
    disabled: Option<bool>,
    label: Option<String>,
) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        update_menu_item_impl(&menu_state, &key, disabled, label)
    }
    #[cfg(not(target_os = "macos"))]
    {
        let _ = (menu_state, key, disabled, label);
        Ok(())
    }
}

#[cfg(target_os = "macos")]
fn build_and_set_menu(
    app: &AppHandle,
    menu_state: &MenuState,
    menus: Vec<MenuItemData>,
) -> Result<(), String> {
    let menu = Menu::new(app).map_err(|e| e.to_string())?;

    for group in &menus {
        let submenu = build_submenu(app, group)?;
        menu.append(&submenu).map_err(|e| e.to_string())?;
    }

    app.set_menu(menu.clone()).map_err(|e| e.to_string())?;

    let mut guard = menu_state
        .menu
        .lock()
        .map_err(|e| format!("菜单状态锁异常: {e}"))?;
    *guard = Some(menu);

    MENU_LISTENER_REGISTERED.get_or_init(|| {
        let app_handle = app.clone();
        app.on_menu_event(move |_app, event| {
            let _ = app_handle.emit(
                "picasa:menu-action",
                MenuActionPayload {
                    key: event.id().0.clone(),
                },
            );
        });
    });

    Ok(())
}

#[cfg(target_os = "macos")]
fn update_menu_item_impl(
    menu_state: &MenuState,
    key: &str,
    disabled: Option<bool>,
    label: Option<String>,
) -> Result<(), String> {
    let guard = menu_state
        .menu
        .lock()
        .map_err(|e| format!("菜单状态锁异常: {e}"))?;
    let menu = guard
        .as_ref()
        .ok_or_else(|| "系统菜单尚未构建，无法增量更新".to_string())?;

    let item = find_menu_item_by_key(menu, key)
        .ok_or_else(|| format!("未找到菜单项: {key}"))?;

    apply_menu_item_patch(&item, disabled, label.as_deref())
}

#[cfg(target_os = "macos")]
fn find_menu_item_by_key(menu: &Menu<tauri::Wry>, key: &str) -> Option<MenuItemKind<tauri::Wry>> {
    if let Some(item) = menu.get(key) {
        return Some(item);
    }

    for top in menu.items().unwrap_or_default() {
        if let Some(sub) = top.as_submenu() {
            if let Some(found) = find_in_submenu(sub, key) {
                return Some(found);
            }
        }
    }

    None
}

#[cfg(target_os = "macos")]
fn find_in_submenu(sub: &Submenu<tauri::Wry>, key: &str) -> Option<MenuItemKind<tauri::Wry>> {
    if let Some(item) = sub.get(key) {
        return Some(item);
    }

    for child in sub.items().unwrap_or_default() {
        if let Some(nested) = child.as_submenu() {
            if let Some(found) = find_in_submenu(nested, key) {
                return Some(found);
            }
        }
    }

    None
}

#[cfg(target_os = "macos")]
fn apply_menu_item_patch(
    item: &MenuItemKind<tauri::Wry>,
    disabled: Option<bool>,
    label: Option<&str>,
) -> Result<(), String> {
    match item {
        MenuItemKind::MenuItem(mi) => patch_normal_menu_item(mi, disabled, label),
        MenuItemKind::Check(ci) => {
            if let Some(enabled) = disabled.map(|d| !d) {
                ci.set_enabled(enabled).map_err(|e| e.to_string())?;
            }
            if let Some(text) = label {
                ci.set_text(text).map_err(|e| e.to_string())?;
            }
            Ok(())
        }
        MenuItemKind::Icon(ii) => {
            if let Some(enabled) = disabled.map(|d| !d) {
                ii.set_enabled(enabled).map_err(|e| e.to_string())?;
            }
            if let Some(text) = label {
                ii.set_text(text).map_err(|e| e.to_string())?;
            }
            Ok(())
        }
        MenuItemKind::Submenu(_) | MenuItemKind::Predefined(_) => Err(
            "预定义或子菜单项不支持增量更新 disabled/label".to_string(),
        ),
    }
}

#[cfg(target_os = "macos")]
fn patch_normal_menu_item(
    item: &MenuItem<tauri::Wry>,
    disabled: Option<bool>,
    label: Option<&str>,
) -> Result<(), String> {
    if let Some(enabled) = disabled.map(|d| !d) {
        item.set_enabled(enabled).map_err(|e| e.to_string())?;
    }
    if let Some(text) = label {
        item.set_text(text).map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// 前端业务 key → Tauri/muda 原生子菜单 id
///
/// muda 0.17.2 修复 macOS Help/Window 菜单注册到错误 NSMenu 实例的问题。
/// 使用 Tauri 原生 id，让 `AppHandle::set_menu` 在挂载主菜单后注册特殊子菜单。
#[cfg(target_os = "macos")]
fn submenu_native_id(key: &str) -> &str {
    match key {
        "help" => HELP_SUBMENU_ID,
        "window" => WINDOW_SUBMENU_ID,
        _ => key,
    }
}

#[cfg(target_os = "macos")]
fn build_submenu(app: &AppHandle, data: &MenuItemData) -> Result<Submenu<tauri::Wry>, String> {
    let mut builder = SubmenuBuilder::with_id(app, submenu_native_id(&data.key), &data.label);

    if let Some(items) = &data.items {
        for item in items {
            if item.exclude_on_mac == Some(true) {
                #[cfg(target_os = "macos")]
                continue;
            }

            if item.item_type.as_deref() == Some("separator")
                || item.role.as_deref() == Some("separator")
            {
                builder = builder.separator();
                continue;
            }

            if let Some(role) = &item.role {
                if let Some(predefined) = role_to_predefined(app, role) {
                    builder = builder.item(&predefined);
                    continue;
                }
            }

            if item.items.as_ref().map(|v| !v.is_empty()).unwrap_or(false) {
                let submenu = build_submenu(app, item)?;
                builder = builder.item(&submenu);
                continue;
            }

            if item.label.trim().is_empty() {
                return Err(format!(
                    "菜单项 {} 的 label 为空，无法构建系统菜单",
                    item.key
                ));
            }

            let mut menu_item =
                MenuItemBuilder::with_id(&item.key, &item.label).enabled(true);
            if item.disabled == Some(true) {
                menu_item = menu_item.enabled(false);
            }
            if let Some(accelerator) = &item.shortcut {
                menu_item = menu_item.accelerator(accelerator);
            }
            let menu_item = menu_item.build(app).map_err(|e| e.to_string())?;
            builder = builder.item(&menu_item);
        }
    }

    builder.build().map_err(|e| e.to_string())
}

/// 将 contract reference role 字符串映射到 Tauri PredefinedMenuItem
#[cfg(target_os = "macos")]
fn role_to_predefined(app: &AppHandle, role: &str) -> Option<PredefinedMenuItem<tauri::Wry>> {
    match role {
        // RFC 0169: close 不得映射到 quit；窗口关闭走自定义 menu key + close_window
        "quit" => PredefinedMenuItem::quit(app, None).ok(),
        "close" => None,
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
        "services" => PredefinedMenuItem::services(app, None).ok(),
        "togglefullscreen" | "fullscreen" => PredefinedMenuItem::fullscreen(app, None).ok(),
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn menu_item_data_deserializes_from_frontend_json() {
        let item: MenuItemData = serde_json::from_str(
            r#"{"key":"file-import","label":"Import","shortcut":"Cmd+I","isMacOnly":true}"#,
        )
        .unwrap();
        assert_eq!(item.key, "file-import");
        assert_eq!(item.is_mac_only, Some(true));
    }

    #[test]
    fn menu_item_data_deserializes_exclude_on_mac() {
        let item: MenuItemData = serde_json::from_str(
            r#"{"key":"window-close","label":"Close Window","excludeOnMac":true}"#,
        )
        .unwrap();
        assert_eq!(item.exclude_on_mac, Some(true));
    }

    #[test]
    #[cfg(target_os = "macos")]
    fn submenu_native_id_maps_help_and_window_to_tauri_ids() {
        assert_eq!(submenu_native_id("help"), HELP_SUBMENU_ID);
        assert_eq!(submenu_native_id("window"), WINDOW_SUBMENU_ID);
        assert_eq!(submenu_native_id("file"), "file");
    }

    #[test]
    fn help_menu_payload_includes_rfc_0171_items() {
        let menus: Vec<MenuItemData> = serde_json::from_str(
            r#"[
              {
                "key": "help",
                "label": "Help",
                "items": [
                  { "key": "help-report-issue", "label": "Report Issue…" },
                  { "key": "help-explore-photasa", "label": "Explore Photasa", "url": "https://photasa.me" },
                  { "key": "help-getting-started", "label": "Getting Started with Photasa", "url": "https://photasa.me/docs" },
                  { "key": "help-about", "label": "About Photasa", "shortcut": "F1" }
                ]
              }
            ]"#,
        )
        .unwrap();

        let help = menus.first().expect("help menu");
        let keys: Vec<&str> = help
            .items
            .as_ref()
            .expect("help items")
            .iter()
            .map(|item| item.key.as_str())
            .collect();

        assert!(keys.contains(&"help-report-issue"));
        assert!(keys.contains(&"help-explore-photasa"));
        assert!(keys.contains(&"help-getting-started"));
        assert!(keys.contains(&"help-about"));
    }
}

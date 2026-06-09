/*!
 * TaibaijinxingAdapter（太白金星 Adapter）
 *
 * 对齐 Electron `TaibaijinxingAdapter`：系统菜单、打开外部链接、在 Finder 中显示文件。
 * 对应 service: "taibaijinxing"（menu_apply / shell_openExternal / shell_open_in_finder）
 */
use async_trait::async_trait;
use serde_json::{json, Value};
use std::sync::Arc;
use tauri::AppHandle;
use tauri_plugin_shell::ShellExt;

use zouwu_core::adapter::{Adapter, AdapterError};
use zouwu_core::types::ExecutionContext;

use crate::commands::menu::{apply_menus, MenuItemData};

const SERVICE_TAIBAIJINXING: &str = "taibaijinxing";
const ACTION_APPLY_SYSTEM_MENU: &str = "applySystemMenu";
const ACTION_OPEN_EXTERNAL: &str = "openExternal";
const ACTION_OPEN_IN_FINDER: &str = "openInFinder";
const FIELD_MENUS: &str = "menus";
const FIELD_URL: &str = "url";
const FIELD_PATH: &str = "path";

pub struct TaibaijinxingAdapter {
    app_handle: Arc<AppHandle>,
}

impl TaibaijinxingAdapter {
    pub fn new(app_handle: AppHandle) -> Self {
        Self {
            app_handle: Arc::new(app_handle),
        }
    }

    fn parse_menus(input: &Value) -> Result<Vec<MenuItemData>, AdapterError> {
        let menus_value = input
            .get(FIELD_MENUS)
            .ok_or_else(|| AdapterError::InvalidInput("missing menus".to_string()))?;
        serde_json::from_value(menus_value.clone())
            .map_err(|e| AdapterError::Serialization(e.to_string()))
    }

    fn extract_string_field(input: &Value, field: &str) -> Result<String, AdapterError> {
        if let Some(text) = input.as_str() {
            return Ok(text.to_string());
        }
        input
            .get(field)
            .and_then(|v| v.as_str())
            .map(str::to_string)
            .ok_or_else(|| AdapterError::InvalidInput(format!("missing {field}")))
    }
}

#[async_trait]
impl Adapter for TaibaijinxingAdapter {
    fn name(&self) -> &str {
        SERVICE_TAIBAIJINXING
    }

    fn supported_actions(&self) -> &[&str] {
        &[
            ACTION_APPLY_SYSTEM_MENU,
            ACTION_OPEN_EXTERNAL,
            ACTION_OPEN_IN_FINDER,
        ]
    }

    async fn execute(
        &self,
        action: &str,
        input: Value,
        _ctx: &ExecutionContext,
    ) -> Result<Value, AdapterError> {
        match action {
            ACTION_APPLY_SYSTEM_MENU => {
                let menus = Self::parse_menus(&input)?;
                apply_menus(self.app_handle.as_ref(), menus).map_err(AdapterError::Internal)?;
                Ok(json!({
                    "success": true,
                    "message": "菜单已成功设置"
                }))
            }

            ACTION_OPEN_EXTERNAL => {
                let url = Self::extract_string_field(&input, FIELD_URL)?;
                #[allow(deprecated)]
                let open_result = self.app_handle.shell().open(url.clone(), None);
                open_result
                    .map_err(|e| AdapterError::Internal(format!("open external failed: {e}")))?;
                Ok(json!({
                    "success": true,
                    "message": format!("外部链接已打开: {url}")
                }))
            }

            ACTION_OPEN_IN_FINDER => {
                let path = Self::extract_string_field(&input, FIELD_PATH)?;
                #[allow(deprecated)]
                let open_result = self.app_handle.shell().open(path.clone(), None);
                open_result
                    .map_err(|e| AdapterError::Internal(format!("open in finder failed: {e}")))?;
                Ok(json!({
                    "success": true,
                    "message": format!("文件已在 Finder 中显示: {path}")
                }))
            }

            _ => Err(AdapterError::UnsupportedAction(action.to_string())),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_menus_rejects_missing_field() {
        let result = TaibaijinxingAdapter::parse_menus(&json!({}));
        assert!(matches!(result, Err(AdapterError::InvalidInput(_))));
    }

    #[test]
    fn extract_string_field_supports_object_and_scalar() {
        assert_eq!(
            TaibaijinxingAdapter::extract_string_field(
                &json!({ "url": "https://example.com" }),
                FIELD_URL
            )
            .unwrap(),
            "https://example.com"
        );
        assert_eq!(
            TaibaijinxingAdapter::extract_string_field(&json!("/tmp/a.jpg"), FIELD_PATH).unwrap(),
            "/tmp/a.jpg"
        );
    }
}

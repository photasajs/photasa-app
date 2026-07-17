/*!
 * ConfigAdapter（配置 Adapter）
 *
 * 实现文件夹级配置：读取/写入 `.photasa.json`
 *
 * 注意：此 Adapter **不是**“文昌偏好”（应用级 preferences）。
 * 文昌偏好在 Tauri 侧由 `PreferencesAdapter`（service: "wenchang"）负责。
 */
use async_trait::async_trait;
use serde_json::{json, Value};
use std::path::{Path, PathBuf};

use zouwu_core::adapter::{Adapter, AdapterError};
use zouwu_core::types::ExecutionContext;

use crate::commands::photasa_config;

pub struct ConfigAdapter;

impl ConfigAdapter {
    pub fn new() -> Self {
        Self
    }

    fn config_path(folder: &str) -> PathBuf {
        Path::new(folder).join(".photasa.json")
    }

    async fn read_config(folder: &str) -> Result<Value, AdapterError> {
        let path = Self::config_path(folder);
        if !path.exists() {
            return Ok(Value::Null);
        }
        let content = tokio::fs::read_to_string(&path)
            .await
            .map_err(AdapterError::Io)?;
        serde_json::from_str(&content)
            .map_err(|e| AdapterError::Internal(format!("JSON parse error: {e}")))
    }

    async fn write_config(folder: &str, config: &Value) -> Result<(), AdapterError> {
        let path = Self::config_path(folder);
        if let Some(parent) = path.parent() {
            tokio::fs::create_dir_all(parent)
                .await
                .map_err(AdapterError::Io)?;
        }
        let content = serde_json::to_string_pretty(config)
            .map_err(|e| AdapterError::Internal(format!("serialize error: {e}")))?;
        tokio::fs::write(&path, content)
            .await
            .map_err(AdapterError::Io)?;
        Ok(())
    }
}

#[async_trait]
impl Adapter for ConfigAdapter {
    fn name(&self) -> &str {
        "config"
    }

    fn supported_actions(&self) -> &[&str] {
        &[
            "getCurrentSnapshot",
            "getSnapshot",
            "updateConfig",
            "resetConfig",
            "fixConfig",
        ]
    }

    async fn execute(
        &self,
        action: &str,
        input: Value,
        _ctx: &ExecutionContext,
    ) -> Result<Value, AdapterError> {
        match action {
            // 获取当前文件夹配置快照（.photasa.json；service 为 config）
            "getCurrentSnapshot" | "getSnapshot" => {
                let folder = input
                    .get("folder")
                    .and_then(|v| v.as_str())
                    .unwrap_or(".");
                let config = Self::read_config(folder).await?;
                let ts = now_ms();
                Ok(json!({
                    "data": config,
                    "revision": 1,
                    "timestamp": ts,
                    "success": true
                }))
            }

            // 更新配置
            "updateConfig" => {
                let folder = input
                    .get("folder")
                    .and_then(|v| v.as_str())
                    .ok_or_else(|| AdapterError::InvalidInput("missing folder".to_string()))?;
                let data = input
                    .get("data")
                    .ok_or_else(|| AdapterError::InvalidInput("missing data".to_string()))?;
                Self::write_config(folder, data).await?;
                Ok(json!({ "success": true, "timestamp": now_ms() }))
            }

            // 重置配置（清空 photoList）
            "resetConfig" => {
                let folder = input
                    .get("folder")
                    .and_then(|v| v.as_str())
                    .ok_or_else(|| AdapterError::InvalidInput("missing folder".to_string()))?;
                let empty = json!({
                    "version": "1.0",
                    "photoList": [],
                    "lastModified": now_ms()
                });
                Self::write_config(folder, &empty).await?;
                Ok(json!({ "success": true }))
            }

            // 修复配置（Electron fixPhotasaConfig → photasa_config::fix_config_sync）
            "fixConfig" => {
                let folder = input
                    .get("folder")
                    .and_then(|v| v.as_str())
                    .ok_or_else(|| AdapterError::InvalidInput("missing folder".to_string()))?;
                let folder_owned = folder.to_string();
                let config = tokio::task::spawn_blocking(move || {
                    photasa_config::fix_config_sync(&folder_owned)
                })
                .await
                .map_err(|e| AdapterError::Internal(format!("fixConfig task failed: {e}")))?
                .map_err(|e| AdapterError::Internal(e))?;
                Ok(json!({
                    "success": true,
                    "config": photasa_config::config_to_json_value(&config),
                    "timestamp": now_ms()
                }))
            }

            _ => Err(AdapterError::UnsupportedAction(action.to_string())),
        }
    }
}

fn now_ms() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

/*!
 * SimingAdapter（司命 Adapter）
 *
 * 应用状态持久化：~/.photasa/appState/photasa.json
 * 对应 service: "siming"（供 restore_app_state 等 .zouwu 经 taiyi.callEngine 调用）
 */
use async_trait::async_trait;
use serde_json::{json, Value};
use std::path::PathBuf;

use zouwu_core::adapter::{Adapter, AdapterError};
use zouwu_core::types::ExecutionContext;

const APP_STATE_DIR: &str = ".photasa/appState";
const APP_STATE_FILE: &str = "photasa.json";
const ACTION_RESTORE_APP_STATE: &str = "restoreAppState";

pub struct SimingAdapter {
    app_state_path: PathBuf,
}

impl SimingAdapter {
    pub fn new() -> Self {
        Self {
            app_state_path: default_app_state_path(),
        }
    }

    #[cfg(test)]
    pub fn with_app_state_path(path: PathBuf) -> Self {
        Self {
            app_state_path: path,
        }
    }

    async fn restore_app_state(&self) -> Result<Value, AdapterError> {
        match tokio::fs::read_to_string(&self.app_state_path).await {
            Ok(content) => parse_app_state(&content),
            Err(err) if err.kind() == std::io::ErrorKind::NotFound => Ok(default_app_state_value()),
            Err(err) => Err(AdapterError::Io(err)),
        }
    }
}

fn default_app_state_path() -> PathBuf {
    dirs::home_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join(APP_STATE_DIR)
        .join(APP_STATE_FILE)
}

fn default_app_state_value() -> Value {
    json!({
        "version": "1.0",
        "timestamp": chrono::Utc::now().timestamp_millis(),
        "folderTree": [],
        "currentFolder": "",
        "lastOpenedFolder": ""
    })
}

fn parse_app_state(content: &str) -> Result<Value, AdapterError> {
    let parsed: Value =
        serde_json::from_str(content).map_err(|e| AdapterError::Serialization(e.to_string()))?;

    if parsed.get("folderTree").is_none() {
        return Ok(default_app_state_value());
    }

    Ok(json!({
        "version": parsed.get("version").and_then(|v| v.as_str()).unwrap_or("1.0"),
        "timestamp": parsed
            .get("timestamp")
            .and_then(|v| v.as_i64())
            .unwrap_or_else(|| chrono::Utc::now().timestamp_millis()),
        "folderTree": parsed.get("folderTree").cloned().unwrap_or(json!([])),
        "currentFolder": parsed
            .get("currentFolder")
            .and_then(|v| v.as_str())
            .unwrap_or(""),
        "lastOpenedFolder": parsed
            .get("lastOpenedFolder")
            .and_then(|v| v.as_str())
            .unwrap_or(""),
    }))
}

#[async_trait]
impl Adapter for SimingAdapter {
    fn name(&self) -> &str {
        "siming"
    }

    fn supported_actions(&self) -> &[&str] {
        &[ACTION_RESTORE_APP_STATE]
    }

    async fn execute(
        &self,
        action: &str,
        _input: Value,
        _ctx: &ExecutionContext,
    ) -> Result<Value, AdapterError> {
        match action {
            ACTION_RESTORE_APP_STATE => self.restore_app_state().await,
            _ => Err(AdapterError::UnsupportedAction(action.to_string())),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn restore_app_state_returns_default_when_file_missing() {
        let path = std::env::temp_dir().join(format!(
            "photasa-siming-missing-{}.json",
            uuid::Uuid::new_v4()
        ));
        let adapter = SimingAdapter::with_app_state_path(path);
        let state = adapter
            .execute(
                ACTION_RESTORE_APP_STATE,
                json!({}),
                &ExecutionContext::new(json!({})),
            )
            .await
            .unwrap();
        assert!(state.get("folderTree").unwrap().is_array());
    }

    #[tokio::test]
    async fn restore_app_state_reads_persisted_file() {
        let path =
            std::env::temp_dir().join(format!("photasa-siming-read-{}.json", uuid::Uuid::new_v4()));
        let payload = r#"{"version":"1.0","timestamp":1,"folderTree":[{"id":"a"}],"currentFolder":"/tmp","lastOpenedFolder":"/tmp"}"#;
        tokio::fs::write(&path, payload).await.unwrap();
        let adapter = SimingAdapter::with_app_state_path(path);
        let state = adapter
            .execute(
                ACTION_RESTORE_APP_STATE,
                json!({}),
                &ExecutionContext::new(json!({})),
            )
            .await
            .unwrap();
        assert_eq!(state["currentFolder"], "/tmp");
        assert_eq!(state["folderTree"].as_array().unwrap().len(), 1);
    }
}

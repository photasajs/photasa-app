/*!
 * PreferencesAdapter（文昌偏好 Adapter）
 *
 * 对齐 Electron 的 `WenchangAdapter`：
 * - 默认落盘目录：`~/.photasa/preferences/`
 * - 核心文件：`preferences.json`（以及 history/revisions）
 * - 对应 service: "wenchang"（供 preference 相关 .zouwu 工作流调用）
 */
use async_trait::async_trait;
use serde_json::{json, Value};
use std::path::PathBuf;
use std::sync::Arc;
use tokio::sync::RwLock;
use wenchang_preferences::PreferencesStore;

use zouwu_core::adapter::{Adapter, AdapterError};
use zouwu_core::types::ExecutionContext;

const DEFAULT_PREFERENCES_DIR_NAME: &str = ".photasa/preferences";
const INPUT_DELTA_KEY: &str = "delta";
const INPUT_SOURCE_KEY: &str = "source";

pub struct PreferencesAdapter {
    store: Arc<RwLock<PreferencesStore>>,
}

impl PreferencesAdapter {
    pub async fn new() -> Result<Self, AdapterError> {
        let dir = default_preferences_dir();
        let store = PreferencesStore::initialize(dir)
            .await
            .map_err(|e| AdapterError::Internal(format!("preferences init error: {e}")))?;
        Ok(Self {
            store: Arc::new(RwLock::new(store)),
        })
    }
}

#[async_trait]
impl Adapter for PreferencesAdapter {
    fn name(&self) -> &str {
        "wenchang"
    }

    fn supported_actions(&self) -> &[&str] {
        &[
            "getCurrentSnapshot",
            "updatePreferences",
            "resetToDefaults",
            "exportPreferences",
            "importPreferences",
            "getHistory",
            "restoreRevision",
            "validate",
            "sanitize",
            "emitEvent",
            "formatResponse",
        ]
    }

    async fn execute(
        &self,
        action: &str,
        input: Value,
        _ctx: &ExecutionContext,
    ) -> Result<Value, AdapterError> {
        match action {
            "getCurrentSnapshot" => {
                let store = self.store.read().await;
                let snapshot = store.get_current_snapshot();
                Ok(json!({
                    "data": snapshot.data,
                    "revision": snapshot.revision,
                    "timestamp": snapshot.timestamp
                }))
            }

            "updatePreferences" => {
                let delta = input
                    .get(INPUT_DELTA_KEY)
                    .cloned()
                    .ok_or_else(|| AdapterError::InvalidInput("missing delta".to_string()))?;
                let source = input
                    .get(INPUT_SOURCE_KEY)
                    .and_then(|v| v.as_str())
                    .unwrap_or("user_action");
                let mut store = self.store.write().await;
                let new_revision = store.update_preferences(delta, source).await.map_err(|e| {
                    AdapterError::Internal(format!("update preferences error: {e}"))
                })?;
                Ok(json!({ "result": { "revision": new_revision }, "success": true }))
            }

            "resetToDefaults" => {
                let mut store = self.store.write().await;
                let snapshot = store
                    .reset_to_defaults()
                    .await
                    .map_err(|e| AdapterError::Internal(format!("reset preferences error: {e}")))?;
                Ok(json!({ "result": snapshot, "success": true }))
            }

            "exportPreferences" => {
                let store = self.store.read().await;
                let data = store.export_preferences().await.map_err(|e| {
                    AdapterError::Internal(format!("export preferences error: {e}"))
                })?;
                Ok(
                    json!({ "export": { "result": data }, "success": true, "timestamp": now_ms(), "engineName": "wenchang" }),
                )
            }

            "importPreferences" => {
                let data = input
                    .get("data")
                    .cloned()
                    .ok_or_else(|| AdapterError::InvalidInput("missing data".to_string()))?;
                let source = input
                    .get(INPUT_SOURCE_KEY)
                    .and_then(|v| v.as_str())
                    .unwrap_or("import");
                let mut store = self.store.write().await;
                let snapshot = store.import_preferences(data, source).await.map_err(|e| {
                    AdapterError::Internal(format!("import preferences error: {e}"))
                })?;
                Ok(json!({ "result": snapshot, "success": true }))
            }

            "getHistory" => {
                let limit = input.get("limit").and_then(|v| v.as_u64()).unwrap_or(10) as usize;
                let offset = input.get("offset").and_then(|v| v.as_u64()).unwrap_or(0) as usize;
                let store = self.store.read().await;
                let (data, count) = store.get_history(limit, offset);
                Ok(json!({
                    "history": {
                        "result": data,
                        "count": count
                    },
                    "success": true,
                    "timestamp": now_ms(),
                    "engineName": "wenchang"
                }))
            }

            "restoreRevision" => {
                let revision = input
                    .get("revision")
                    .and_then(|v| v.as_u64())
                    .ok_or_else(|| AdapterError::InvalidInput("missing revision".to_string()))?;
                let mut store = self.store.write().await;
                let snapshot = store
                    .restore_revision(revision)
                    .await
                    .map_err(|e| AdapterError::Internal(format!("restore revision error: {e}")))?;
                Ok(json!({ "result": snapshot, "success": true }))
            }

            // Workflow-layer validation/sanitize: keep minimal but deterministic.
            // - validate returns { valid, errors? }
            // - sanitize returns sanitized object directly (not wrapped)
            "validate" => Ok(json!({ "valid": true, "errors": [] })),

            "sanitize" => Ok(input.get("source").cloned().unwrap_or(Value::Null)),

            "emitEvent" => Ok(json!({ "id": format!("evt-{}", now_ms()) })),

            "formatResponse" => Ok(json!({
                "result": {
                    "success": input.get("success").and_then(|v| v.as_bool()).unwrap_or(true),
                    "data": input.get("data").cloned().unwrap_or(Value::Null),
                    "timestamp": input.get("timestamp").cloned().unwrap_or(json!(now_ms())),
                    "source": input.get("source").cloned().unwrap_or(json!("wenchang_engine"))
                }
            })),

            _ => Err(AdapterError::UnsupportedAction(action.to_string())),
        }
    }
}

fn default_preferences_dir() -> PathBuf {
    // macOS/Linux: HOME；Windows：USERPROFILE（与 Electron `~/.photasa` 等价语义）
    let home = std::env::var("HOME")
        .or_else(|_| std::env::var("USERPROFILE"))
        .unwrap_or_else(|_| ".".to_string());
    PathBuf::from(home).join(DEFAULT_PREFERENCES_DIR_NAME)
}

fn now_ms() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

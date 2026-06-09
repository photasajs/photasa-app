/*!
 * ScanAdapter（千里眼 Adapter）
 *
 * 目录扫描：Rust scan_runner + `.photasa-folder.json` 增量缓存，
 * 通过 `picasa:find-photo` 推送 progress/complete 事件。
 * 对应 service: "qianliyan"
 */
use async_trait::async_trait;
use serde_json::{json, Value};
use std::sync::Arc;
use tauri::AppHandle;

use zouwu_core::adapter::{Adapter, AdapterError};
use zouwu_core::types::ExecutionContext;

use crate::commands::scan_runner::run_directory_scan_sync;

pub struct ScanAdapter {
    app_handle: Arc<AppHandle>,
}

impl ScanAdapter {
    pub fn new(app_handle: AppHandle) -> Self {
        Self {
            app_handle: Arc::new(app_handle),
        }
    }
}

#[async_trait]
impl Adapter for ScanAdapter {
    fn name(&self) -> &str {
        "qianliyan"
    }

    fn supported_actions(&self) -> &[&str] {
        &["validatePaths", "scanPaths", "restoreQueue"]
    }

    async fn execute(
        &self,
        action: &str,
        input: Value,
        _ctx: &ExecutionContext,
    ) -> Result<Value, AdapterError> {
        match action {
            "validatePaths" => {
                let paths = extract_paths(&input)?;
                let valid_paths: Vec<String> = paths
                    .into_iter()
                    .filter(|p| std::path::Path::new(p).exists())
                    .collect();
                Ok(json!({
                    "validPaths": valid_paths,
                    "error": null,
                    "success": true
                }))
            }

            "scanPaths" => {
                let paths = extract_paths(&input)?;
                let recursive = input
                    .get("recursive")
                    .and_then(|v| v.as_bool())
                    .unwrap_or(true);
                let request_id = uuid::Uuid::new_v4().to_string();
                let handle = Arc::clone(&self.app_handle);
                let paths_clone = paths.clone();
                let request_id_clone = request_id.clone();

                tokio::spawn(async move {
                    let app = Arc::new((*handle).clone());
                    for base_path in paths_clone {
                        tokio::task::spawn_blocking({
                            let app = Arc::clone(&app);
                            let request_id = request_id_clone.clone();
                            let scan_root = base_path.clone();
                            move || {
                                run_directory_scan_sync(
                                    app,
                                    request_id,
                                    scan_root,
                                    recursive,
                                );
                            }
                        })
                        .await
                        .ok();
                    }
                });

                Ok(json!({
                    "requestId": request_id,
                    "status": "running",
                    "fileCount": 0,
                    "success": true
                }))
            }

            "restoreQueue" => restore_scanning_queue().await,

            _ => Err(AdapterError::UnsupportedAction(action.to_string())),
        }
    }
}

const SCAN_QUEUE_DIR: &str = ".photasa/scan";
const SCAN_QUEUE_FILE: &str = "scanning.json";

async fn restore_scanning_queue() -> Result<Value, AdapterError> {
    let path = dirs::home_dir()
        .unwrap_or_else(|| std::path::PathBuf::from("."))
        .join(SCAN_QUEUE_DIR)
        .join(SCAN_QUEUE_FILE);

    match tokio::fs::read_to_string(&path).await {
        Ok(content) => {
            let parsed: Value = serde_json::from_str(&content)
                .map_err(|e| AdapterError::Serialization(e.to_string()))?;
            let queue = parsed
                .get("queue")
                .and_then(|v| v.as_array())
                .cloned()
                .unwrap_or_default();
            Ok(Value::Array(queue))
        }
        Err(err) if err.kind() == std::io::ErrorKind::NotFound => Ok(Value::Array(vec![])),
        Err(err) => Err(AdapterError::Io(err)),
    }
}

fn extract_paths(input: &Value) -> Result<Vec<String>, AdapterError> {
    input
        .get("paths")
        .and_then(|v| v.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|v| v.as_str().map(String::from))
                .collect()
        })
        .ok_or_else(|| AdapterError::InvalidInput("missing or invalid 'paths' field".to_string()))
}

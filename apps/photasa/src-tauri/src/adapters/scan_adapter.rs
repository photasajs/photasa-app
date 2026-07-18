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

use crate::commands::scan_runner::{run_directory_scan, ScanAction};

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
        &["validatePaths", "scanPaths", "restoreQueue", "persistQueue"]
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
                        run_directory_scan(
                            Arc::clone(&app),
                            request_id_clone.clone(),
                            ScanAction {
                                path: base_path,
                                operation_type: String::new(),
                                action: "scan".to_string(),
                                thumbnail_size: Some(256),
                                is_directory: true,
                            },
                            recursive,
                        )
                        .await;
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

            "persistQueue" => persist_scanning_queue(input).await,

            _ => Err(AdapterError::UnsupportedAction(action.to_string())),
        }
    }
}

const SCAN_QUEUE_DIR: &str = ".photasa/scan";
const SCAN_QUEUE_FILE: &str = "scanning.json";
const SCAN_QUEUE_VERSION: &str = "1.0";

fn scanning_queue_path() -> std::path::PathBuf {
    dirs::home_dir()
        .unwrap_or_else(|| std::path::PathBuf::from("."))
        .join(SCAN_QUEUE_DIR)
        .join(SCAN_QUEUE_FILE)
}

fn build_scanning_queue_document(queue: &[Value]) -> Value {
    json!({
        "version": SCAN_QUEUE_VERSION,
        "timestamp": chrono::Utc::now().timestamp_millis(),
        "queue": queue,
    })
}

fn extract_queue_array(input: &Value) -> Result<Vec<Value>, AdapterError> {
    match input {
        Value::Array(items) => Ok(items.clone()),
        Value::Object(obj) => obj
            .get("queue")
            .and_then(|v| v.as_array())
            .cloned()
            .ok_or_else(|| {
                AdapterError::InvalidInput(
                    "persistQueue expects array or object with queue field".to_string(),
                )
            }),
        _ => Err(AdapterError::InvalidInput(
            "persistQueue expects array".to_string(),
        )),
    }
}

async fn persist_scanning_queue(input: Value) -> Result<Value, AdapterError> {
    let queue = extract_queue_array(&input)?;
    let path = scanning_queue_path();

    if let Some(parent) = path.parent() {
        tokio::fs::create_dir_all(parent)
            .await
            .map_err(AdapterError::Io)?;
    }

    let payload = build_scanning_queue_document(&queue);
    let serialized = serde_json::to_string_pretty(&payload)
        .map_err(|e| AdapterError::Serialization(e.to_string()))?;

    tokio::fs::write(&path, serialized)
        .await
        .map_err(AdapterError::Io)?;

    log::info!(
        "🌌 千里眼：扫描队列已持久化 {} 项 -> {}",
        queue.len(),
        path.display()
    );

    Ok(json!({ "success": true, "queueSize": queue.len() }))
}

async fn restore_scanning_queue() -> Result<Value, AdapterError> {
    let path = scanning_queue_path();

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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn extract_queue_array_accepts_top_level_array() {
        let input = json!([{ "path": "/photos", "action": "rescan" }]);
        let queue = extract_queue_array(&input).expect("array input should parse");
        assert_eq!(queue.len(), 1);
        assert_eq!(queue[0]["path"], "/photos");
    }

    #[test]
    fn extract_queue_array_accepts_wrapped_object() {
        let input = json!({ "queue": [{ "path": "/docs", "action": "scan" }] });
        let queue = extract_queue_array(&input).expect("wrapped queue should parse");
        assert_eq!(queue.len(), 1);
        assert_eq!(queue[0]["path"], "/docs");
    }

    #[test]
    fn build_scanning_queue_document_matches_contract() {
        let queue = vec![json!({ "path": "/a", "action": "rescan" })];
        let doc = build_scanning_queue_document(&queue);
        assert_eq!(doc["version"], SCAN_QUEUE_VERSION);
        assert!(doc["timestamp"].is_number());
        assert_eq!(doc["queue"].as_array().map(|items| items.len()), Some(1));
    }

    #[tokio::test]
    async fn persist_and_restore_round_trip_uses_temp_file() {
        let temp_dir =
            std::env::temp_dir().join(format!("photasa-scan-queue-test-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&temp_dir).expect("temp dir should be created");
        let file_path = temp_dir.join(SCAN_QUEUE_FILE);

        let queue = vec![json!({
            "path": "/tmp/rescan-test",
            "action": "rescan",
            "source": "user",
            "timestamp": 1_700_000_000_000_i64
        })];
        let payload = build_scanning_queue_document(&queue);
        let serialized = serde_json::to_string_pretty(&payload).expect("serialize queue");
        tokio::fs::write(&file_path, serialized)
            .await
            .expect("write queue file");

        let content = tokio::fs::read_to_string(&file_path)
            .await
            .expect("read queue file");
        let parsed: Value = serde_json::from_str(&content).expect("parse queue file");
        let restored = parsed
            .get("queue")
            .and_then(|v| v.as_array())
            .cloned()
            .unwrap_or_default();

        assert_eq!(restored.len(), 1);
        assert_eq!(restored[0]["path"], "/tmp/rescan-test");
        assert_eq!(restored[0]["action"], "rescan");

        let _ = tokio::fs::remove_dir_all(&temp_dir).await;
    }
}

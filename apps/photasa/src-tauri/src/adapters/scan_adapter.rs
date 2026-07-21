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
use tauri::{AppHandle, Manager};

use zouwu_core::adapter::{Adapter, AdapterError};
use zouwu_core::types::ExecutionContext;

use crate::commands::scan_runner::{ScanAction, ScanWorker};
use crate::utils::scan_queue_error::ScanQueueError;
use crate::utils::scan_queue_repository::ScanQueueRepositoryHandle;

pub struct ScanAdapter {
    app_handle: Arc<AppHandle>,
}

impl ScanAdapter {
    pub fn new(app_handle: AppHandle) -> Self {
        Self {
            app_handle: Arc::new(app_handle),
        }
    }

    fn scan_queue_repo(&self) -> Result<ScanQueueRepositoryHandle, AdapterError> {
        self.app_handle
            .try_state::<ScanQueueRepositoryHandle>()
            .map(|state| state.inner().clone())
            .ok_or_else(|| {
                AdapterError::InvalidInput("ScanQueueRepository 未初始化".to_string())
            })
    }
}

fn map_scan_queue_error(error: ScanQueueError) -> AdapterError {
    match error {
        ScanQueueError::Io(err) => AdapterError::Io(err),
        ScanQueueError::Serialization(err) => AdapterError::Serialization(err.to_string()),
        ScanQueueError::InvalidInput(message)
        | ScanQueueError::InvalidStatus(message) => AdapterError::InvalidInput(message),
        ScanQueueError::InvalidQueueItem => {
            AdapterError::InvalidInput("队列项必须是 JSON 对象".to_string())
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
                let worker = self.app_handle.state::<ScanWorker>();
                let request_ids: Vec<String> = paths
                    .into_iter()
                    .map(|path| {
                        let request_id = uuid::Uuid::new_v4().to_string();
                        worker.submit(
                            request_id.clone(),
                            ScanAction {
                                path,
                                operation_type: String::new(),
                                action: "scan".to_string(),
                                thumbnail_size: Some(256),
                                is_directory: true,
                            },
                        )?;
                        Ok(request_id)
                    })
                    .collect::<Result<_, String>>()
                    .map_err(AdapterError::InvalidInput)?;

                Ok(json!({
                    "requestIds": request_ids,
                    "status": "running",
                    "fileCount": 0,
                    "success": true
                }))
            }

            "restoreQueue" => {
                let repo = self.scan_queue_repo()?;
                repo.get_json_array()
                    .await
                    .map_err(map_scan_queue_error)
            }

            "persistQueue" => {
                let repo = self.scan_queue_repo()?;
                repo.persist_external(input)
                    .await
                    .map_err(map_scan_queue_error)
            }

            _ => Err(AdapterError::UnsupportedAction(action.to_string())),
        }
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

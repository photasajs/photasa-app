//! Tauri commands：扫描队列（RFC 0136/0144 — 单写者 Repository）

use crate::utils::scan_queue_error::scan_queue_error_string;
use crate::utils::scan_queue_repository::ScanQueueRepositoryHandle;
use serde_json::Value;
use tauri::State;

#[tauri::command]
pub async fn scan_queue_get(repo: State<'_, ScanQueueRepositoryHandle>) -> Result<Vec<Value>, String> {
    Ok(repo.get().await)
}

#[tauri::command]
pub async fn scan_queue_add_actions(
    repo: State<'_, ScanQueueRepositoryHandle>,
    actions: Vec<Value>,
) -> Result<Vec<Value>, String> {
    repo.add_actions(&actions)
        .await
        .map_err(scan_queue_error_string)
}

#[tauri::command]
pub async fn scan_queue_remove_action(
    repo: State<'_, ScanQueueRepositoryHandle>,
    path: String,
) -> Result<Vec<Value>, String> {
    repo.remove_action(&path)
        .await
        .map_err(scan_queue_error_string)
}

#[tauri::command]
pub async fn scan_queue_update_action_status(
    repo: State<'_, ScanQueueRepositoryHandle>,
    path: String,
    status: String,
    updates: Option<Value>,
) -> Result<Vec<Value>, String> {
    repo.update_action_status(&path, &status, &updates.unwrap_or(Value::Null))
        .await
        .map_err(scan_queue_error_string)
}

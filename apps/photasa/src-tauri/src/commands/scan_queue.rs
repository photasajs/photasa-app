//! Tauri commands：扫描队列（RFC 0136/0144/0162）
//!
//! - `scan_queue_get`：全量恢复（仅启动/显式 GET）
//! - 突变命令：仅返回 `ScanQueueAck`（RFC 0162 — 禁止回传全量 queue）

use crate::utils::scan_queue_ack::ScanQueueAck;
use crate::utils::scan_queue_error::scan_queue_error_string;
use crate::utils::scan_queue_repository::ScanQueueRepositoryHandle;
use serde_json::Value;
use tauri::State;

#[tauri::command]
pub async fn scan_queue_get(repo: State<'_, ScanQueueRepositoryHandle>) -> Result<Vec<Value>, String> {
    repo.get().await.map_err(scan_queue_error_string)
}

#[tauri::command]
pub async fn scan_queue_add_actions(
    repo: State<'_, ScanQueueRepositoryHandle>,
    actions: Vec<Value>,
) -> Result<ScanQueueAck, String> {
    repo.add_actions(&actions)
        .await
        .map_err(scan_queue_error_string)
}

#[tauri::command]
pub async fn scan_queue_remove_action(
    repo: State<'_, ScanQueueRepositoryHandle>,
    path: String,
) -> Result<ScanQueueAck, String> {
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
) -> Result<ScanQueueAck, String> {
    repo.update_action_status(&path, &status, &updates.unwrap_or(Value::Null))
        .await
        .map_err(scan_queue_error_string)
}

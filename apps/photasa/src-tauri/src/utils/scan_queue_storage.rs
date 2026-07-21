//! 扫描队列磁盘格式与纯函数（RFC 0144）
//!
//! 读写由 `scan_queue_repository` 单写者负责；本模块仅保留格式常量与解析辅助。

use crate::utils::scan_queue_error::{ScanQueueError, ScanQueueResult};
use serde_json::{json, Value};

pub const SCAN_QUEUE_DIR: &str = ".photasa/scan";
pub const SCAN_QUEUE_FILE: &str = "scanning.json";
pub const SCAN_QUEUE_VERSION: &str = "1.0";

pub fn scanning_queue_path() -> std::path::PathBuf {
    dirs::home_dir()
        .unwrap_or_else(|| std::path::PathBuf::from("."))
        .join(SCAN_QUEUE_DIR)
        .join(SCAN_QUEUE_FILE)
}

pub fn build_scanning_queue_document(queue: &[Value]) -> Value {
    json!({
        "version": SCAN_QUEUE_VERSION,
        "timestamp": chrono::Utc::now().timestamp_millis(),
        "queue": queue,
    })
}

pub fn extract_queue_array(input: &Value) -> ScanQueueResult<Vec<Value>> {
    match input {
        Value::Array(items) => Ok(items.clone()),
        Value::Object(obj) => obj
            .get("queue")
            .and_then(|v| v.as_array())
            .cloned()
            .ok_or_else(|| ScanQueueError::invalid_input(
                "persistQueue expects array or object with queue field",
            )),
        _ => Err(ScanQueueError::invalid_input(
            "persistQueue expects array",
        )),
    }
}

pub fn action_path(action: &Value) -> Option<&str> {
    action.get("path").and_then(|value| value.as_str())
}

pub fn queue_contains_path(queue: &[Value], path: &str) -> bool {
    queue.iter().any(|item| action_path(item) == Some(path))
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
    fn build_scanning_queue_document_matches_contract() {
        let queue = vec![json!({ "path": "/a", "action": "rescan" })];
        let doc = build_scanning_queue_document(&queue);
        assert_eq!(doc["version"], SCAN_QUEUE_VERSION);
        assert!(doc["timestamp"].is_number());
        assert_eq!(doc["queue"].as_array().map(|items| items.len()), Some(1));
    }
}

//! 扫描队列磁盘格式与纯函数（RFC 0144）
//!
//! 读写由 `scan_queue_repository` 单写者负责；本模块仅保留格式常量与解析辅助。

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

pub fn action_path(action: &Value) -> Option<&str> {
    action.get("path").and_then(|value| value.as_str())
}

pub fn queue_contains_path(queue: &[Value], path: &str) -> bool {
    let clean_path = path.trim_end_matches('/');
    queue.iter().any(|item| {
        action_path(item).map(|p| p.trim_end_matches('/')) == Some(clean_path)
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn build_scanning_queue_document_matches_contract() {
        let queue = vec![json!({ "path": "/a", "action": "rescan" })];
        let doc = build_scanning_queue_document(&queue);
        assert_eq!(doc["version"], SCAN_QUEUE_VERSION);
        assert!(doc["timestamp"].is_number());
        assert_eq!(doc["queue"].as_array().map(|items| items.len()), Some(1));
    }
}

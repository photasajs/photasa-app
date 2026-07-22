//! Photasa watch 队列算法（RFC 0133）— 零 Tauri。
//!
//! FS 事件 → 去重/防抖 → `FileOperation[]`；发射由调用方实现 [`ScanQueueSink`]。

mod coalescer;
mod debounce;
mod dedupe;
mod priority;

pub use coalescer::{ScanQueueCoalescer, ScanQueueSink};
pub use debounce::calculate_debounce_ms;
pub use dedupe::{deduplication_window_ms, should_deduplicate};
pub use priority::event_priority;

use photasa_types::FileOperationType;

/// 将 contract reference / notify 侧 op 字符串解析为 typed enum
pub fn parse_operation_type(op_type: &str) -> Option<FileOperationType> {
 match op_type {
 "add" => Some(FileOperationType::Add),
 "change" => Some(FileOperationType::Change),
 "delete" => Some(FileOperationType::Delete),
 "addDir" => Some(FileOperationType::AddDir),
 "deleteDir" => Some(FileOperationType::DeleteDir),
 _ => None,
 }
}

/// 与 legacy-api `createFileOperation` / 前端 `FileOperation.type` 字符串一致
pub fn operation_type_str(op: FileOperationType) -> &'static str {
 match op {
 FileOperationType::Add => "add",
 FileOperationType::Change => "change",
 FileOperationType::Delete => "delete",
 FileOperationType::AddDir => "addDir",
 FileOperationType::DeleteDir => "deleteDir",
 }
}

/// 与 legacy-api / frontend 约定的扫描队列事件名
pub const EVENT_ADD_TO_SCAN_QUEUE: &str = "picasa:add-to-scan-queue";

#[cfg(test)]
mod tests {
 use super::*;

 #[test]
 fn parse_operation_type_covers_all_known_ops() {
 assert_eq!(parse_operation_type("add"), Some(FileOperationType::Add));
 assert_eq!(parse_operation_type("change"), Some(FileOperationType::Change));
 assert_eq!(parse_operation_type("delete"), Some(FileOperationType::Delete));
 assert_eq!(parse_operation_type("addDir"), Some(FileOperationType::AddDir));
 assert_eq!(
 parse_operation_type("deleteDir"),
 Some(FileOperationType::DeleteDir)
 );
 assert_eq!(parse_operation_type("rename"), None);
 assert_eq!(parse_operation_type(""), None);
 }

 #[test]
 fn operation_type_str_roundtrips_all_variants() {
 let cases = [
 (FileOperationType::Add, "add"),
 (FileOperationType::Change, "change"),
 (FileOperationType::Delete, "delete"),
 (FileOperationType::AddDir, "addDir"),
 (FileOperationType::DeleteDir, "deleteDir"),
 ];
 for (op, s) in cases {
 assert_eq!(operation_type_str(op), s);
 assert_eq!(parse_operation_type(s), Some(op));
 }
 }

 #[test]
 fn scan_queue_event_name_matches_frontend_contract() {
 assert_eq!(EVENT_ADD_TO_SCAN_QUEUE, "picasa:add-to-scan-queue");
 }
}

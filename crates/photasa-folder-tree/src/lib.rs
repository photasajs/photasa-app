//! 侧边栏 folderTree 持久化 — `~/.photasa/appState/photasa.json`
//!
//! 与 legacy-api `@photasa/siming` / `SimingEngine` 契约对齐。
//! 贞观「司命」是此能力的拟人化名，crate 名跟功能走（同 `photasa-scan` 不用千里眼）。

use std::io;
use std::path::PathBuf;

use chrono::Utc;
use serde_json::{json, Value};
use thiserror::Error;

pub const APP_STATE_DIR: &str = ".photasa/appState";
pub const APP_STATE_FILE: &str = "photasa.json";

#[derive(Debug, Error)]
pub enum FolderTreeError {
 #[error("IO 错误: {0}")]
 Io(#[from] io::Error),

 #[error("JSON 序列化错误: {0}")]
 Serialization(#[from] serde_json::Error),

 #[error("无效输入: {0}")]
 InvalidInput(String),
}

pub type FolderTreeResult<T> = Result<T, FolderTreeError>;

impl FolderTreeError {
 pub fn invalid_input(message: impl Into<String>) -> Self {
 Self::InvalidInput(message.into())
 }
}

/// 读写 `photasa.json`（folderTree + currentFolder + lastOpenedFolder）
pub struct FolderTreeStore {
 app_state_path: PathBuf,
}

impl FolderTreeStore {
 pub fn new() -> Self {
 Self {
 app_state_path: default_app_state_path(),
 }
 }

 pub fn with_path(path: PathBuf) -> Self {
 Self {
 app_state_path: path,
 }
 }

 /// 启动恢复：整份 photasa.json（含 folderTree 与导航字段）
 pub fn restore_app_state(&self) -> FolderTreeResult<Value> {
 self.read_app_state()
 }

 pub fn restore_folder_tree(&self) -> FolderTreeResult<Value> {
 let state = self.read_app_state()?;
 Ok(state
 .get("folderTree")
 .cloned()
 .unwrap_or_else(|| json!([])))
 }

 pub fn persist_folder_tree(&self, input: Value) -> FolderTreeResult<Value> {
 let tree = match input {
 Value::Array(items) => Value::Array(items),
 other => {
 return Err(FolderTreeError::invalid_input(format!(
 "persistFolderTree expects array, got {other}"
 )));
 }
 };

 let mut state = self.read_app_state()?;
 let state_obj = state
 .as_object_mut()
 .ok_or_else(|| FolderTreeError::invalid_input("app state must be object"))?;

 state_obj.insert("folderTree".to_string(), tree);
 state_obj.insert(
 "timestamp".to_string(),
 json!(Utc::now().timestamp_millis()),
 );

 self.write_app_state(&state)?;
 Ok(Value::Null)
 }

    fn read_app_state(&self) -> FolderTreeResult<Value> {
        match std::fs::read_to_string(&self.app_state_path) {
            Ok(content) => match parse_app_state(&content) {
                Ok(val) => Ok(val),
                Err(err) => {
                    eprintln!(
                        "⚠️ photasa-folder-tree: read_app_state 遇到损坏的 JSON，自动重置：{:?} - {}",
                        self.app_state_path, err
                    );
                    Ok(default_app_state_value())
                }
            },
            Err(err) if err.kind() == io::ErrorKind::NotFound => Ok(default_app_state_value()),
            Err(err) => Err(FolderTreeError::Io(err)),
        }
    }

 fn write_app_state(&self, state: &Value) -> FolderTreeResult<()> {
 if let Some(parent) = self.app_state_path.parent() {
 std::fs::create_dir_all(parent)?;
 }

 let payload = serde_json::to_string_pretty(state)?;
 std::fs::write(&self.app_state_path, payload)?;
 Ok(())
 }
}

impl Default for FolderTreeStore {
 fn default() -> Self {
 Self::new()
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
 "timestamp": Utc::now().timestamp_millis(),
 "folderTree": [],
 "currentFolder": "",
 "lastOpenedFolder": ""
 })
}

fn parse_app_state(content: &str) -> FolderTreeResult<Value> {
 let parsed: Value = serde_json::from_str(content)?;

 if parsed.get("folderTree").is_none() {
 return Ok(default_app_state_value());
 }

 Ok(json!({
 "version": parsed.get("version").and_then(|v| v.as_str()).unwrap_or("1.0"),
 "timestamp": parsed
 .get("timestamp")
 .and_then(|v| v.as_i64())
 .unwrap_or_else(|| Utc::now().timestamp_millis()),
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

#[cfg(test)]
mod tests {
 use super::*;

 #[test]
 fn restore_app_state_returns_default_when_file_missing() {
 let path = std::env::temp_dir().join(format!(
 "photasa-folder-tree-missing-{}.json",
 uuid::Uuid::new_v4()
 ));
 let store = FolderTreeStore::with_path(path);
 let state = store.restore_app_state().unwrap();
 assert!(state.get("folderTree").unwrap().is_array());
 }

 #[test]
 fn restore_app_state_reads_persisted_file() {
 let path = std::env::temp_dir().join(format!(
 "photasa-folder-tree-read-{}.json",
 uuid::Uuid::new_v4()
 ));
 let payload = r#"{"version":"1.0","timestamp":1,"folderTree":[{"key":"/tmp"}],"currentFolder":"/tmp","lastOpenedFolder":"/tmp"}"#;
 std::fs::write(&path, payload).unwrap();
 let store = FolderTreeStore::with_path(path);
 let state = store.restore_app_state().unwrap();
 assert_eq!(state["currentFolder"], "/tmp");
 assert_eq!(state["folderTree"].as_array().unwrap().len(), 1);
 }

 #[test]
 fn restore_folder_tree_returns_folder_tree_array() {
 let path = std::env::temp_dir().join(format!(
 "photasa-folder-tree-restore-tree-{}.json",
 uuid::Uuid::new_v4()
 ));
 let payload = r#"{"version":"1.0","timestamp":1,"folderTree":[{"key":"/album/sub"}],"currentFolder":"","lastOpenedFolder":""}"#;
 std::fs::write(&path, payload).unwrap();
 let store = FolderTreeStore::with_path(path);
 let tree = store.restore_folder_tree().unwrap();
 assert_eq!(tree.as_array().unwrap().len(), 1);
 assert_eq!(tree[0]["key"], "/album/sub");
 }

 #[test]
 fn persist_folder_tree_writes_folder_tree_to_disk() {
 let path = std::env::temp_dir().join(format!(
 "photasa-folder-tree-persist-tree-{}.json",
 uuid::Uuid::new_v4()
 ));
 let store = FolderTreeStore::with_path(path.clone());
 let new_tree = json!([
 { "key": "/photos", "title": "photos", "children": [
 { "key": "/photos/vacation", "title": "vacation", "children": [] }
 ]}
 ]);

 store.persist_folder_tree(new_tree.clone()).unwrap();

 let restored = store.restore_folder_tree().unwrap();
 assert_eq!(restored, new_tree);

 let full_state = store.restore_app_state().unwrap();
 assert_eq!(full_state["currentFolder"], "");
 }

    #[test]
    fn restore_app_state_falls_back_on_corrupt_json() {
        let path = std::env::temp_dir().join(format!(
            "photasa-folder-tree-corrupt-{}.json",
            uuid::Uuid::new_v4()
        ));
        let corrupt_payload = r#"{"version":"1.0","folderTree":[]} trailing junk at end"#;
        std::fs::write(&path, corrupt_payload).unwrap();
        let store = FolderTreeStore::with_path(path);
        let state = store.restore_app_state().unwrap();
        assert!(state.get("folderTree").unwrap().is_array());
    }

 #[test]
 fn persist_folder_tree_rejects_non_array_input() {
 let path = std::env::temp_dir().join(format!(
 "photasa-folder-tree-persist-invalid-{}.json",
 uuid::Uuid::new_v4()
 ));
 let store = FolderTreeStore::with_path(path);
 let err = store
 .persist_folder_tree(json!({ "key": "/bad" }))
 .unwrap_err();
 assert!(matches!(err, FolderTreeError::InvalidInput(_)));
 }
}

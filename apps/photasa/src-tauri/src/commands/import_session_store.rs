//! 导入会话：进度快照（仅内存）、历史记录与撤销状态 — **历史与 undone 集持久化于应用数据目录 JSON**

use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::{HashMap, HashSet};
use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::Mutex;

const PERSIST_VERSION: u32 = 1;
const HISTORY_FILE_NAME: &str = "import_history_v1.json";

#[derive(Debug, Serialize, Deserialize)]
struct PersistedImportState {
    version: u32,
    history: Vec<Value>,
    undone_ids: Vec<String>,
}

/// 进度仅内存；历史与已撤销 id 与磁盘同步（`app_data_dir/import_history_v1.json`）
pub struct ImportSessionStore {
    inner: Mutex<ImportSessionInner>,
    file: PathBuf,
}

#[derive(Default)]
pub struct ImportSessionInner {
    /// 最新在前
    pub history: Vec<Value>,
    pub progress: HashMap<String, Value>,
    pub undone_ids: HashSet<String>,
}

impl ImportSessionStore {
    /// 从 `app.path().app_data_dir()` 等目录加载已有历史；目录不存在则创建
    pub fn load_or_new(app_data_dir: PathBuf) -> Self {
        let _ = fs::create_dir_all(&app_data_dir);
        let file = app_data_dir.join(HISTORY_FILE_NAME);
        let mut inner = ImportSessionInner::default();

        if file.is_file() {
            match fs::read_to_string(&file) {
                Ok(txt) => match serde_json::from_str::<PersistedImportState>(&txt) {
                    Ok(st) if st.version == PERSIST_VERSION => {
                        inner.history = st.history;
                        inner.undone_ids = st.undone_ids.into_iter().collect();
                        log::info!(
                            "🌌 导入历史典籍已从磁盘载入，条目数 {}",
                            inner.history.len()
                        );
                    }
                    Ok(st) => {
                        log::warn!(
                            "🌌 导入历史文件版本不兼容（{}），忽略",
                            st.version
                        );
                    }
                    Err(e) => {
                        log::warn!("🌌 导入历史 JSON 解析失败，从零开始：{e}");
                    }
                },
                Err(e) => log::warn!("🌌 读取导入历史文件失败：{e}"),
            }
        }

        Self {
            inner: Mutex::new(inner),
            file,
        }
    }

    /// 单元测试：指定状态文件路径
    #[cfg(test)]
    pub fn load_or_new_for_test(state_file: PathBuf) -> Self {
        let mut inner = ImportSessionInner::default();
        if state_file.is_file() {
            if let Ok(txt) = fs::read_to_string(&state_file) {
                if let Ok(st) = serde_json::from_str::<PersistedImportState>(&txt) {
                    if st.version == PERSIST_VERSION {
                        inner.history = st.history;
                        inner.undone_ids = st.undone_ids.into_iter().collect();
                    }
                }
            }
        }
        Self {
            inner: Mutex::new(inner),
            file: state_file,
        }
    }

    fn persist(&self) {
        let snapshot = match self.inner.lock() {
            Ok(g) => PersistedImportState {
                version: PERSIST_VERSION,
                history: g.history.clone(),
                undone_ids: g.undone_ids.iter().cloned().collect(),
            },
            Err(e) => {
                log::warn!("🌌 导入历史落盘失败（锁异常）：{e}");
                return;
            }
        };

        if let Err(e) = write_persisted_atomically(&self.file, &snapshot) {
            log::warn!("🌌 导入历史落盘失败：{e}");
        }
    }

    pub fn set_progress(&self, import_id: &str, payload: Value) {
        if let Ok(mut g) = self.inner.lock() {
            g.progress.insert(import_id.to_string(), payload);
        }
    }

    pub fn remove_progress(&self, import_id: &str) {
        if let Ok(mut g) = self.inner.lock() {
            g.progress.remove(import_id);
        }
    }

    /// 将完成条目插入历史（最新在前）；可选上限防止膨胀；**写入磁盘**
    pub fn push_history(&self, entry: Value, max_entries: usize) {
        const DEFAULT_CAP: usize = 200;
        let cap = if max_entries == 0 {
            DEFAULT_CAP
        } else {
            max_entries
        };
        if let Ok(mut g) = self.inner.lock() {
            g.history.insert(0, entry);
            if g.history.len() > cap {
                g.history.truncate(cap);
            }
        }
        self.persist();
    }

    pub fn get_history(&self, limit: usize) -> Vec<Value> {
        let g = match self.inner.lock() {
            Ok(x) => x,
            Err(_) => return Vec::new(),
        };
        let n = if limit == 0 { 50 } else { limit };
        g.history.iter().take(n).cloned().collect()
    }

    pub fn get_entry(&self, history_id: &str) -> Option<Value> {
        let g = self.inner.lock().ok()?;
        g.history
            .iter()
            .find(|e| entry_id(e) == Some(history_id))
            .cloned()
    }

    pub fn is_undone(&self, history_id: &str) -> bool {
        self.inner
            .lock()
            .map(|g| g.undone_ids.contains(history_id))
            .unwrap_or(true)
    }

    /// 标记已撤销并更新内存中的条目；**写入磁盘**
    pub fn mark_undone(&self, history_id: &str, undo_result: Value) {
        if let Ok(mut g) = self.inner.lock() {
            g.undone_ids.insert(history_id.to_string());
            for e in &mut g.history {
                if entry_id(e) != Some(history_id) {
                    continue;
                }
                if let Some(obj) = e.as_object_mut() {
                    obj.insert("canUndo".to_string(), json!(false));
                    obj.insert("undoResult".to_string(), undo_result.clone());
                }
                break;
            }
        }
        self.persist();
    }
}

fn write_persisted_atomically(path: &Path, state: &PersistedImportState) -> Result<(), String> {
    let dir = path.parent().ok_or_else(|| "导入历史路径无父目录".to_string())?;
    fs::create_dir_all(dir).map_err(|e| e.to_string())?;
    let json = serde_json::to_string_pretty(state).map_err(|e| e.to_string())?;
    let tmp = path.with_extension("json.tmp");
    {
        let mut f = fs::File::create(&tmp).map_err(|e| e.to_string())?;
        f.write_all(json.as_bytes()).map_err(|e| e.to_string())?;
        f.sync_all().map_err(|e| e.to_string())?;
    }
    fs::rename(&tmp, path).map_err(|e| e.to_string())?;
    Ok(())
}

fn entry_id(entry: &Value) -> Option<&str> {
    entry.get("id").and_then(|v| v.as_str())
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HistoryIdArgs {
    pub history_id: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportProgressArgs {
    pub import_id: String,
}

fn preview_undo_payload(store: &ImportSessionStore, history_id: &str) -> Value {
    if store.is_undone(history_id) {
        return json!({
            "historyId": history_id,
            "canUndo": false,
            "reason": "该导入已撤销或不可撤销",
            "filesToDelete": [],
            "directoriesToCleanup": [],
            "potentialIssues": [],
            "estimatedTime": 0,
        });
    }

    let Some(entry) = store.get_entry(history_id) else {
        return json!({
            "historyId": history_id,
            "canUndo": false,
            "reason": "未找到导入历史",
            "filesToDelete": [],
            "directoriesToCleanup": [],
            "potentialIssues": [],
            "estimatedTime": 0,
        });
    };

    let file_list = entry
        .get("fileList")
        .and_then(|v| v.as_array())
        .cloned()
        .unwrap_or_default();

    let mut files_to_delete: Vec<Value> = Vec::new();
    let mut dirs: Vec<String> = Vec::new();
    let mut issues: Vec<Value> = Vec::new();
    let mut can_undo = false;

    for item in &file_list {
        let target = item.get("targetPath").and_then(|v| v.as_str()).unwrap_or("");
        let original = item.get("originalPath").and_then(|v| v.as_str()).unwrap_or("");
        let size = item.get("size").and_then(|v| v.as_u64()).unwrap_or(0);
        let import_time = item
            .get("importTime")
            .and_then(|v| v.as_str())
            .unwrap_or("");

        if target.is_empty() {
            continue;
        }

        let p = Path::new(target);
        if p.is_file() {
            can_undo = true;
            files_to_delete.push(json!({
                "path": target,
                "size": size,
                "originalPath": original,
                "importTime": import_time,
            }));
            if let Some(parent) = p.parent().and_then(|x| x.to_str()) {
                let n = parent.replace('\\', "/");
                if !n.is_empty() && !dirs.contains(&n) {
                    dirs.push(n);
                }
            }
        } else {
            issues.push(json!({
                "file": target,
                "issue": "目标文件不存在，可能已被移动或删除",
                "severity": "warning",
            }));
        }
    }

    let est_secs = (files_to_delete.len() as f64 * 0.02).ceil() as u64;

    json!({
        "historyId": history_id,
        "canUndo": can_undo,
        "reason": if can_undo { "可以撤销：将删除已复制到目标目录的文件" } else { "没有可删除的目标文件" },
        "filesToDelete": files_to_delete,
        "directoriesToCleanup": dirs,
        "potentialIssues": issues,
        "estimatedTime": est_secs,
    })
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HistoryListArgs {
    pub limit: Option<usize>,
}

#[tauri::command]
pub fn get_import_history(
    store: tauri::State<'_, std::sync::Arc<ImportSessionStore>>,
    args: HistoryListArgs,
) -> Result<Vec<Value>, String> {
    Ok(store.get_history(args.limit.unwrap_or(50)))
}

#[tauri::command]
pub fn get_import_details(
    store: tauri::State<'_, std::sync::Arc<ImportSessionStore>>,
    args: HistoryIdArgs,
) -> Result<Option<Value>, String> {
    Ok(store.get_entry(&args.history_id))
}

#[tauri::command]
pub fn get_import_progress(
    store: tauri::State<'_, std::sync::Arc<ImportSessionStore>>,
    args: ImportProgressArgs,
) -> Result<Value, String> {
    let g = store.inner.lock().map_err(|e| e.to_string())?;
    Ok(g
        .progress
        .get(&args.import_id)
        .cloned()
        .unwrap_or_else(|| {
            json!({
                "totalFiles": 0,
                "processedFiles": 0,
                "successfulFiles": 0,
                "skippedFiles": 0,
                "errorFiles": 0,
                "speed": 0,
                "estimatedTimeRemaining": 0,
                "remainingTime": 0,
                "startTime": chrono::Utc::now().to_rfc3339(),
                "errors": [],
                "warnings": [],
                "status": "completed",
            })
        }))
}

/// 撤销预览：检查目标文件是否仍在磁盘上
#[tauri::command]
pub fn preview_undo_import(
    store: tauri::State<'_, std::sync::Arc<ImportSessionStore>>,
    args: HistoryIdArgs,
) -> Result<Value, String> {
    Ok(preview_undo_payload(&store, &args.history_id))
}

/// 执行撤销：删除 fileList 中的目标文件
#[tauri::command]
pub fn undo_import_execute(
    store: tauri::State<'_, std::sync::Arc<ImportSessionStore>>,
    args: HistoryIdArgs,
) -> Result<Value, String> {
    let history_id = args.history_id;
    if store.is_undone(&history_id) {
        return Ok(json!({
            "success": false,
            "deletedFiles": [],
            "errors": [{ "file": "", "error": "该导入已撤销过" }],
            "restoredDirectories": [],
            "undoId": history_id,
            "timestamp": chrono::Utc::now().to_rfc3339(),
        }));
    }

    let preview = preview_undo_payload(&store, &history_id);
    let can = preview.get("canUndo").and_then(|v| v.as_bool()).unwrap_or(false);
    if !can {
        return Ok(json!({
            "success": false,
            "deletedFiles": [],
            "errors": [{ "file": "", "error": "无可撤销文件" }],
            "restoredDirectories": [],
            "undoId": history_id,
            "timestamp": chrono::Utc::now().to_rfc3339(),
        }));
    }

    let files = preview
        .get("filesToDelete")
        .and_then(|v| v.as_array())
        .cloned()
        .unwrap_or_default();

    let mut deleted: Vec<String> = Vec::new();
    let mut errors: Vec<Value> = Vec::new();

    for f in files {
        let path = f.get("path").and_then(|v| v.as_str()).unwrap_or("");
        if path.is_empty() {
            continue;
        }
        match fs::remove_file(path) {
            Ok(()) => deleted.push(path.to_string()),
            Err(e) => errors.push(json!({ "file": path, "error": e.to_string() })),
        }
    }

    let success = errors.is_empty();
    let undo_result = json!({
        "success": success,
        "deletedFiles": deleted,
        "errors": errors,
        "restoredDirectories": [],
        "undoId": format!("undo-{}", uuid::Uuid::new_v4()),
        "timestamp": chrono::Utc::now().to_rfc3339(),
    });

    store.mark_undone(history_id.as_str(), undo_result.clone());

    Ok(undo_result)
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn tmp_history_path() -> PathBuf {
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        std::env::temp_dir().join(format!("photasa_import_hist_{nanos}.json"))
    }

    #[test]
    fn persist_roundtrip_history_and_undone() {
        let path = tmp_history_path();
        let _ = fs::remove_file(&path);

        let store = ImportSessionStore::load_or_new_for_test(path.clone());
        store.push_history(json!({ "id": "h1", "canUndo": true }), 200);
        assert_eq!(
            store
                .get_entry("h1")
                .as_ref()
                .and_then(|e| e.get("id"))
                .and_then(|v| v.as_str()),
            Some("h1"),
        );

        let store2 = ImportSessionStore::load_or_new_for_test(path.clone());
        assert!(store2.get_entry("h1").is_some());

        store2.mark_undone(
            "h1",
            json!({ "success": true, "deletedFiles": [], "errors": [], "undoId": "u1" }),
        );
        assert!(store2.is_undone("h1"));

        let store3 = ImportSessionStore::load_or_new_for_test(path.clone());
        assert!(store3.is_undone("h1"));
        let _ = fs::remove_file(&path);
    }
}

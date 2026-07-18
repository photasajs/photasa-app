//! 导入会话：进度快照（仅内存）、历史记录与撤销状态 — **历史与 undone 集持久化于应用数据目录 JSON**

use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::{HashMap, HashSet};
use std::fs;
use std::io::{BufRead, BufReader, Write};
use std::path::{Path, PathBuf};
use std::sync::Mutex;

const PERSIST_VERSION: u32 = 1;
const HISTORY_FILE_NAME: &str = "import_history_v1.json";
const JOURNAL_DIR_NAME: &str = "import_journals_v1";

#[derive(Debug, Serialize, Deserialize)]
struct PersistedImportState {
    version: u32,
    history: Vec<Value>,
    undone_ids: Vec<String>,
    #[serde(default)]
    active_imports: Vec<Value>,
}

/// 进度仅内存；历史、已撤销 id 与未完成导入标记和磁盘同步（`app_data_dir/import_history_v1.json`）
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
    pub active_imports: HashMap<String, Value>,
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
                        inner.active_imports = active_imports_by_id(st.active_imports);
                        log::info!("导入历史已从磁盘载入，条目数 {}", inner.history.len());
                    }
                    Ok(st) => {
                        log::warn!("导入历史文件版本不兼容（{}），忽略", st.version);
                    }
                    Err(e) => {
                        log::warn!("导入历史 JSON 解析失败，从零开始：{e}");
                    }
                },
                Err(e) => log::warn!("读取导入历史文件失败：{e}"),
            }
        }

        Self {
            inner: Mutex::new(inner),
            file,
        }
    }

    /// 单元测试 / 宿主集成：指定状态文件路径
    pub fn load_or_new_for_test(state_file: PathBuf) -> Self {
        let mut inner = ImportSessionInner::default();
        if state_file.is_file() {
            if let Ok(txt) = fs::read_to_string(&state_file) {
                if let Ok(st) = serde_json::from_str::<PersistedImportState>(&txt) {
                    if st.version == PERSIST_VERSION {
                        inner.history = st.history;
                        inner.undone_ids = st.undone_ids.into_iter().collect();
                        inner.active_imports = active_imports_by_id(st.active_imports);
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
                active_imports: g.active_imports.values().cloned().collect(),
            },
            Err(e) => {
                log::warn!("导入历史落盘失败（锁异常）：{e}");
                return;
            }
        };

        if let Err(e) = write_persisted_atomically(&self.file, &snapshot) {
            log::warn!("导入历史落盘失败：{e}");
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

    /// 读取内存中的进度快照（无则 None）
    pub fn get_progress(&self, import_id: &str) -> Option<Value> {
        let g = self.inner.lock().ok()?;
        g.progress.get(import_id).cloned()
    }

    /// 记录一个正在执行的导入；进程崩溃时该标记会在下次启动变成 recoverable。
    pub fn start_active_import(&self, import_id: &str, payload: Value) {
        let _ = fs::remove_file(self.journal_path(import_id));
        let now = chrono::Utc::now().to_rfc3339();
        let mut entry = match payload {
            Value::Object(map) => Value::Object(map),
            _ => json!({}),
        };
        if let Some(obj) = entry.as_object_mut() {
            obj.insert("id".to_string(), json!(import_id));
            obj.insert("importId".to_string(), json!(import_id));
            obj.entry("status".to_string())
                .or_insert_with(|| json!("running"));
            obj.entry("startedAt".to_string())
                .or_insert_with(|| json!(now.clone()));
            obj.insert("updatedAt".to_string(), json!(now));
        }
        if let Ok(mut g) = self.inner.lock() {
            g.active_imports.insert(import_id.to_string(), entry);
        }
        self.persist();
    }

    pub fn update_active_progress(&self, import_id: &str, progress: Value) {
        let now = chrono::Utc::now().to_rfc3339();
        let status = progress
            .get("status")
            .and_then(Value::as_str)
            .map(active_status_from_progress);
        if let Ok(mut g) = self.inner.lock() {
            let Some(entry) = g.active_imports.get_mut(import_id) else {
                return;
            };
            if let Some(obj) = entry.as_object_mut() {
                obj.insert("progress".to_string(), progress);
                obj.insert("updatedAt".to_string(), json!(now));
                if let Some(status) = status {
                    obj.insert("status".to_string(), json!(status));
                }
            }
        }
        self.persist();
    }

    pub fn add_active_imported_file(&self, import_id: &str, file: Value) {
        if let Ok(mut g) = self.inner.lock() {
            if let Some(entry) = g.active_imports.get_mut(import_id) {
                append_entry_file(entry, file.clone());
            }
        }
        if let Err(e) = self.append_journal_file(import_id, &file) {
            log::warn!("导入恢复 journal 写入失败：{e}");
        }
    }

    pub fn remove_active_import(&self, import_id: &str) {
        if let Ok(mut g) = self.inner.lock() {
            g.active_imports.remove(import_id);
        }
        let _ = fs::remove_file(self.journal_path(import_id));
        self.persist();
    }

    pub fn get_recoverable_imports(&self) -> Vec<Value> {
        let entries: Vec<Value> = self
            .inner
            .lock()
            .map(|g| g.active_imports.values().cloned().collect())
            .unwrap_or_default();

        entries
            .into_iter()
            .map(|entry| self.with_recovery_fields(entry))
            .collect()
    }

    pub fn cleanup_recoverable_import(&self, import_id: &str) -> Value {
        let recoverable = self
            .get_recoverable_imports()
            .into_iter()
            .find(|entry| active_import_id(entry).as_deref() == Some(import_id));

        let Some(entry) = recoverable else {
            return json!({
                "success": false,
                "importId": import_id,
                "deletedFiles": [],
                "errors": [{ "file": "", "error": "未找到可恢复导入" }],
                "timestamp": chrono::Utc::now().to_rfc3339(),
            });
        };

        let import_root = entry
            .get("targetPath")
            .and_then(Value::as_str)
            .unwrap_or("");
        let file_list = entry
            .get("fileList")
            .and_then(Value::as_array)
            .cloned()
            .unwrap_or_default();
        let mut deleted_files = Vec::new();
        let mut errors = Vec::new();

        for file in file_list {
            let target = file.get("targetPath").and_then(Value::as_str).unwrap_or("");
            if target.is_empty() {
                continue;
            }
            let path = resolve_undo_target_file_path(import_root, target);
            if !path.is_file() {
                continue;
            }
            let normalized = path.to_string_lossy().replace('\\', "/");
            match fs::remove_file(&path) {
                Ok(()) => deleted_files.push(normalized),
                Err(e) => errors.push(json!({ "file": normalized, "error": e.to_string() })),
            }
        }

        self.remove_active_import(import_id);
        json!({
            "success": errors.is_empty(),
            "importId": import_id,
            "deletedFiles": deleted_files,
            "errors": errors,
            "timestamp": chrono::Utc::now().to_rfc3339(),
        })
    }

    pub fn keep_recoverable_import(&self, import_id: &str) -> Value {
        let kept_files = self
            .get_recoverable_imports()
            .into_iter()
            .find(|entry| active_import_id(entry).as_deref() == Some(import_id))
            .and_then(|entry| {
                entry
                    .get("fileList")
                    .and_then(Value::as_array)
                    .map(|files| files.len())
            })
            .unwrap_or(0);
        self.remove_active_import(import_id);
        json!({
            "success": true,
            "importId": import_id,
            "keptFiles": kept_files,
            "errors": [],
            "timestamp": chrono::Utc::now().to_rfc3339(),
        })
    }

    /// 将完成条目插入历史（最新在前）；可选上限防止膨胀；**写入磁盘**
    pub fn push_history(&self, entry: Value, max_entries: usize) {
        const DEFAULT_CAP: usize = 200;
        let cap = if max_entries == 0 {
            DEFAULT_CAP
        } else {
            max_entries
        };
        let completed_id = entry_id(&entry).map(ToString::to_string);
        if let Ok(mut g) = self.inner.lock() {
            g.history.insert(0, entry);
            if let Some(id) = completed_id.as_deref() {
                g.active_imports.remove(id);
            }
            if g.history.len() > cap {
                g.history.truncate(cap);
            }
        }
        if let Some(id) = completed_id {
            let _ = fs::remove_file(self.journal_path(&id));
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

    fn journal_path(&self, import_id: &str) -> PathBuf {
        let dir = self
            .file
            .parent()
            .map(|p| p.join(JOURNAL_DIR_NAME))
            .unwrap_or_else(|| PathBuf::from(JOURNAL_DIR_NAME));
        dir.join(format!("{}.jsonl", sanitize_import_id(import_id)))
    }

    fn append_journal_file(&self, import_id: &str, file: &Value) -> Result<(), String> {
        let path = self.journal_path(import_id);
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
        let mut handle = fs::OpenOptions::new()
            .create(true)
            .append(true)
            .open(path)
            .map_err(|e| e.to_string())?;
        let line = serde_json::to_string(file).map_err(|e| e.to_string())?;
        handle
            .write_all(line.as_bytes())
            .map_err(|e| e.to_string())?;
        handle.write_all(b"\n").map_err(|e| e.to_string())?;
        Ok(())
    }

    fn read_journal_files(&self, import_id: &str) -> Vec<Value> {
        let path = self.journal_path(import_id);
        let Ok(file) = fs::File::open(path) else {
            return Vec::new();
        };
        BufReader::new(file)
            .lines()
            .map_while(Result::ok)
            .filter_map(|line| serde_json::from_str::<Value>(&line).ok())
            .collect()
    }

    fn with_recovery_fields(&self, mut entry: Value) -> Value {
        let id = active_import_id(&entry).unwrap_or_default();
        let mut files = self.read_journal_files(&id);
        if files.is_empty() {
            files = entry
                .get("fileList")
                .and_then(Value::as_array)
                .cloned()
                .unwrap_or_default();
        }
        if let Some(obj) = entry.as_object_mut() {
            obj.insert("id".to_string(), json!(id));
            obj.insert("importId".to_string(), json!(id));
            obj.insert("status".to_string(), json!("interrupted"));
            obj.insert("fileList".to_string(), Value::Array(files));
        }
        entry
    }
}

fn write_persisted_atomically(path: &Path, state: &PersistedImportState) -> Result<(), String> {
    let dir = path
        .parent()
        .ok_or_else(|| "导入历史路径无父目录".to_string())?;
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

fn active_imports_by_id(entries: Vec<Value>) -> HashMap<String, Value> {
    entries
        .into_iter()
        .filter_map(|entry| active_import_id(&entry).map(|id| (id, entry)))
        .collect()
}

fn active_import_id(entry: &Value) -> Option<String> {
    entry
        .get("id")
        .or_else(|| entry.get("importId"))
        .and_then(Value::as_str)
        .map(ToString::to_string)
}

fn append_entry_file(entry: &mut Value, file: Value) {
    let Some(obj) = entry.as_object_mut() else {
        return;
    };
    let files = obj
        .entry("fileList".to_string())
        .or_insert_with(|| Value::Array(Vec::new()));
    if let Some(items) = files.as_array_mut() {
        items.push(file);
    }
}

fn active_status_from_progress(status: &str) -> &'static str {
    match status {
        "paused" => "paused",
        _ => "running",
    }
}

fn sanitize_import_id(import_id: &str) -> String {
    import_id
        .chars()
        .map(|c| {
            if c.is_ascii_alphanumeric() || c == '-' || c == '_' {
                c
            } else {
                '_'
            }
        })
        .collect()
}

/// `fileList[].targetPath` 在 RFC 0104 下为相对 `{year}/{YYYYMMDD}/name`；与导入根目录拼成绝对路径
pub fn resolve_undo_target_file_path(import_root: &str, stored_target: &str) -> PathBuf {
    let p = Path::new(stored_target);
    if p.is_absolute() {
        p.to_path_buf()
    } else {
        Path::new(import_root).join(stored_target)
    }
}

/// 撤销预览：检查目标文件是否仍在磁盘上
pub fn preview_undo_payload(store: &ImportSessionStore, history_id: &str) -> Value {
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

    let import_root = entry
        .get("targetPath")
        .and_then(|v| v.as_str())
        .unwrap_or("");

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
        let target = item
            .get("targetPath")
            .and_then(|v| v.as_str())
            .unwrap_or("");
        let original = item
            .get("originalPath")
            .and_then(|v| v.as_str())
            .unwrap_or("");
        let size = item.get("size").and_then(|v| v.as_u64()).unwrap_or(0);
        let import_time = item
            .get("importTime")
            .and_then(|v| v.as_str())
            .unwrap_or("");

        if target.is_empty() {
            continue;
        }

        let abs_pb = resolve_undo_target_file_path(import_root, target);
        let abs_norm = abs_pb.to_string_lossy().replace('\\', "/");
        let p = abs_pb.as_path();
        if p.is_file() {
            can_undo = true;
            files_to_delete.push(json!({
                "path": abs_norm,
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
                "file": abs_norm,
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

    /// RFC 0104：`fileList[].targetPath` 为相对路径时，撤销预览应拼上历史中的 `targetPath` 根
    #[test]
    fn preview_undo_resolves_relative_target_under_import_root() {
        let dir = std::env::temp_dir().join(format!("photasa_undo_rel_{}", uuid::Uuid::new_v4()));
        fs::create_dir_all(dir.join("2024/20240315")).unwrap();
        let file_path = dir.join("2024/20240315/keep.jpg");
        fs::write(&file_path, b"x").unwrap();

        let hist_path = tmp_history_path();
        let _ = fs::remove_file(&hist_path);
        let store = ImportSessionStore::load_or_new_for_test(hist_path.clone());
        store.push_history(
            json!({
                "id": "hid_rel",
                "targetPath": dir.to_string_lossy(),
                "fileList": [{
                    "targetPath": "2024/20240315/keep.jpg",
                    "originalPath": "/src/a.jpg",
                    "size": 1u64,
                    "importTime": "2024-01-01T00:00:00Z",
                }],
            }),
            200,
        );

        let pre = preview_undo_payload(&store, "hid_rel");
        assert_eq!(pre.get("canUndo").and_then(|v| v.as_bool()), Some(true));
        let files = pre.get("filesToDelete").and_then(|v| v.as_array()).unwrap();
        assert_eq!(files.len(), 1);
        let p = files[0].get("path").and_then(|v| v.as_str()).unwrap();
        assert!(Path::new(p).is_file(), "resolved path should exist: {p}");

        let _ = fs::remove_file(&file_path);
        let _ = fs::remove_dir_all(&dir);
        let _ = fs::remove_file(&hist_path);
    }

    #[test]
    fn active_imports_survive_restart_and_cleanup_deletes_copied_files() {
        let dir = std::env::temp_dir().join(format!("photasa_active_{}", uuid::Uuid::new_v4()));
        let target_root = dir.join("imports");
        fs::create_dir_all(target_root.join("2024/20240315")).unwrap();
        let copied_file = target_root.join("2024/20240315/a.jpg");
        fs::write(&copied_file, b"copied").unwrap();

        let hist_path = dir.join("import_history_v1.json");
        let store = ImportSessionStore::load_or_new_for_test(hist_path.clone());
        store.start_active_import(
            "import-1",
            json!({
                "sourcePaths": ["/camera"],
                "targetPath": target_root.to_string_lossy(),
                "totalFiles": 2,
                "config": {
                    "sourcePaths": ["/camera"],
                    "targetPath": target_root.to_string_lossy(),
                    "duplicateStrategy": "rename",
                },
            }),
        );
        store.update_active_progress(
            "import-1",
            json!({ "processedFiles": 1, "status": "processing" }),
        );
        store.add_active_imported_file(
            "import-1",
            json!({
                "originalPath": "/camera/a.jpg",
                "targetPath": "2024/20240315/a.jpg",
                "size": 6,
                "importTime": "2026-07-18T19:00:00Z",
            }),
        );

        let restarted = ImportSessionStore::load_or_new_for_test(hist_path);
        let recoverable = restarted.get_recoverable_imports();
        assert_eq!(recoverable.len(), 1);
        assert_eq!(
            recoverable[0].get("id").and_then(|v| v.as_str()),
            Some("import-1")
        );
        assert_eq!(
            recoverable[0].get("status").and_then(|v| v.as_str()),
            Some("interrupted")
        );

        let cleanup = restarted.cleanup_recoverable_import("import-1");
        assert_eq!(cleanup.get("success").and_then(|v| v.as_bool()), Some(true));
        assert!(!copied_file.exists());
        assert!(restarted.get_recoverable_imports().is_empty());

        let _ = fs::remove_dir_all(&dir);
    }
}

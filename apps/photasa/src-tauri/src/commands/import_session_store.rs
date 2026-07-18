//! 导入会话 Tauri 命令 — 存储实现在 `photasa-import::session`
use photasa_import::session::preview_undo_payload;
use serde::Deserialize;
use serde_json::{json, Value};
use std::fs;
use std::sync::Arc;

pub use photasa_import::session::ImportSessionStore;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HistoryListArgs {
    pub limit: Option<usize>,
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

#[tauri::command]
pub fn get_import_history(
    store: tauri::State<'_, Arc<ImportSessionStore>>,
    args: HistoryListArgs,
) -> Result<Vec<Value>, String> {
    Ok(store.get_history(args.limit.unwrap_or(50)))
}

#[tauri::command]
pub fn get_import_details(
    store: tauri::State<'_, Arc<ImportSessionStore>>,
    args: HistoryIdArgs,
) -> Result<Option<Value>, String> {
    Ok(store.get_entry(&args.history_id))
}

#[tauri::command]
pub fn get_import_progress(
    store: tauri::State<'_, Arc<ImportSessionStore>>,
    args: ImportProgressArgs,
) -> Result<Value, String> {
    Ok(store.get_progress(&args.import_id).unwrap_or_else(|| {
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

#[tauri::command]
pub fn preview_undo_import(
    store: tauri::State<'_, Arc<ImportSessionStore>>,
    args: HistoryIdArgs,
) -> Result<Value, String> {
    Ok(preview_undo_payload(&store, &args.history_id))
}

#[tauri::command]
pub fn undo_import_execute(
    store: tauri::State<'_, Arc<ImportSessionStore>>,
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

/*!
 * Tauri 壳：executeImport / cancel / pause / resume
 * 算法在 `photasa-import::copy_loop`（可 `cargo test -p photasa-import`）
 */
use crate::commands::import_date_util::PhotasaMetadataExtractor;
use log::{info, warn};
use photasa_import::copy_loop::{
    cancelled_progress_json, collect_files, registry_set_cancel, registry_set_paused,
    run_import_file_loop, take_duplicate_strategy, ImportLoopEnd, ImportTaskFlags,
};
use photasa_import::session::ImportSessionStore;
use serde::Deserialize;
use serde_json::{json, Value};
use std::path::Path;
use std::sync::atomic::AtomicBool;
use std::sync::Arc;
use tauri::{Emitter, State, Window};

pub use photasa_import::copy_loop::ImportTaskRegistry;

fn emit_cancelled_progress(
    window: &Window,
    total_files: u32,
    processed: u32,
    successful: u32,
    skipped: u32,
    errors: u32,
    current_file: &str,
) {
    let _ = window.emit(
        "import:progress",
        cancelled_progress_json(total_files, processed, successful, skipped, errors, current_file),
    );
}

/// 暂停/继续：以会话中最后一次快照为底，改 `status` 后重新 emit + 回写会话
/// （不等复制循环下一次 tick，字段与常规 progress 一致，不再是残缺 payload）
fn emit_status_from_snapshot(
    window: &Window,
    sessions: &ImportSessionStore,
    import_id: &str,
    status: &str,
) {
    let Some(Value::Object(mut snapshot)) = sessions.get_progress(import_id) else {
        return;
    };
    snapshot.insert("status".to_string(), Value::String(status.to_string()));
    snapshot.insert("importId".to_string(), Value::String(import_id.to_string()));
    let payload = Value::Object(snapshot);
    let _ = window.emit("import:progress", payload.clone());
    sessions.set_progress(import_id, payload);
}

/// 执行导入：立即返回 import_id，后台复制并 emit 进度事件
#[tauri::command]
pub async fn execute_import(
    window: Window,
    registry: State<'_, Arc<ImportTaskRegistry>>,
    sessions: State<'_, Arc<ImportSessionStore>>,
    config: Value,
) -> Result<String, String> {
    let import_id = uuid::Uuid::new_v4().to_string();
    let cancel_flag = Arc::new(AtomicBool::new(false));
    let paused_flag = Arc::new(AtomicBool::new(false));
    {
        let mut g = registry.0.lock().map_err(|e| e.to_string())?;
        g.insert(
            import_id.clone(),
            ImportTaskFlags {
                cancel: cancel_flag.clone(),
                paused: paused_flag.clone(),
            },
        );
    }

    let target_path = config
        .get("targetPath")
        .and_then(|v| v.as_str())
        .ok_or_else(|| "缺少 targetPath".to_string())?
        .to_string();

    let source_paths: Vec<String> = config
        .get("sourcePaths")
        .and_then(|v| v.as_array())
        .map(|a| {
            a.iter()
                .filter_map(|x| x.as_str().map(|s| s.to_string()))
                .collect()
        })
        .unwrap_or_default();

    let files = collect_files(&config);
    if files.is_empty() {
        let mut g = registry.0.lock().map_err(|e| e.to_string())?;
        g.remove(&import_id);
        return Err("selectedFiles 为空".to_string());
    }

    let strategy = take_duplicate_strategy(&config);
    let import_id_emit = import_id.clone();
    let target_for_result = target_path.clone();
    let src_for_result = source_paths.clone();

    let window_clone = window.clone();
    let registry_spawn = Arc::clone(&*registry);
    let sessions_spawn = Arc::clone(&*sessions);

    tauri::async_runtime::spawn(async move {
        let start_iso = chrono::Utc::now().to_rfc3339();
        let total_files = files.len() as u32;
        let meta = PhotasaMetadataExtractor;

        let sessions_for_cb = sessions_spawn.clone();
        let import_id_for_cb = import_id_emit.clone();
        let window_for_cb = window_clone.clone();

        let loop_result = run_import_file_loop(
            &files,
            Path::new(&target_path),
            strategy,
            &cancel_flag,
            &paused_flag,
            &start_iso,
            &meta,
            |progress_val| {
                let _ = window_for_cb.emit("import:progress", progress_val.clone());
                sessions_for_cb.set_progress(&import_id_for_cb, progress_val);
            },
        );

        match loop_result {
            Err(e) => {
                let _ = window_clone.emit(
                    "import:error",
                    json!({ "message": e, "importId": import_id_emit }),
                );
                let mut g = registry_spawn.0.lock().unwrap();
                g.remove(&import_id_emit);
                sessions_spawn.remove_progress(&import_id_emit);
            }
            Ok(ImportLoopEnd::Cancelled {
                successful,
                skipped,
                errors,
                processed,
                current_file,
            }) => {
                emit_cancelled_progress(
                    &window_clone,
                    total_files,
                    processed,
                    successful,
                    skipped,
                    errors,
                    current_file.as_str(),
                );
                let mut g = registry_spawn.0.lock().unwrap();
                g.remove(&import_id_emit);
                sessions_spawn.remove_progress(&import_id_emit);
                info!("🌌 导入已取消: {}", import_id_emit);
            }
            Ok(ImportLoopEnd::Completed {
                successful,
                skipped,
                errors,
                processed: _,
                total_size,
                imported_files,
                duration_ms,
            }) => {
                let success = errors == 0;
                let result = json!({
                    "success": success,
                    "totalFiles": total_files,
                    "successfulFiles": successful,
                    "skippedFiles": skipped,
                    "errorFiles": errors,
                    "totalSize": total_size,
                    "processedSize": total_size,
                    "importedFiles": imported_files.clone(),
                    "errors": [],
                    "warnings": [],
                    "duration": duration_ms,
                    "importId": import_id_emit,
                    "sourcePaths": src_for_result.clone(),
                    "targetPath": target_for_result.clone(),
                });

                let _ = window_clone.emit("import:complete", result.clone());

                let stats = json!({
                    "totalFiles": total_files,
                    "successfulFiles": successful,
                    "skippedFiles": skipped,
                    "errorFiles": errors,
                    "totalSize": total_size,
                    "duplicateCount": 0,
                });
                let history_entry = json!({
                    "id": import_id_emit,
                    "timestamp": chrono::Utc::now().to_rfc3339(),
                    "sourcePaths": src_for_result,
                    "targetPath": target_for_result,
                    "result": result,
                    "canUndo": !imported_files.is_empty(),
                    "fileList": imported_files,
                    "statistics": stats,
                });
                sessions_spawn.push_history(history_entry, 200);
                sessions_spawn.remove_progress(&import_id_emit);

                let mut g = registry_spawn.0.lock().unwrap();
                g.remove(&import_id_emit);
                info!("🌌 导入完成: {}", import_id_emit);
            }
        }
    });

    Ok(import_id)
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportIdArgs {
    pub import_id: String,
}

#[tauri::command]
pub fn cancel_import(
    registry: State<'_, Arc<ImportTaskRegistry>>,
    args: ImportIdArgs,
) -> Result<(), String> {
    let import_id = args.import_id;
    match registry_set_cancel(&registry, &import_id)? {
        true => {
            info!("🌌 收到取消导入: {}", import_id);
            Ok(())
        }
        false => {
            warn!("🌌 取消导入：未知任务 {}", import_id);
            Ok(())
        }
    }
}

#[tauri::command]
pub fn pause_import(
    window: Window,
    registry: State<'_, Arc<ImportTaskRegistry>>,
    sessions: State<'_, Arc<ImportSessionStore>>,
    args: ImportIdArgs,
) -> Result<(), String> {
    match registry_set_paused(&registry, &args.import_id, true)? {
        true => {
            info!("🌌 收到暂停导入: {}", args.import_id);
            emit_status_from_snapshot(&window, &sessions, &args.import_id, "paused");
        }
        false => warn!("🌌 暂停导入：未知任务 {}", args.import_id),
    }
    Ok(())
}

#[tauri::command]
pub fn resume_import(
    window: Window,
    registry: State<'_, Arc<ImportTaskRegistry>>,
    sessions: State<'_, Arc<ImportSessionStore>>,
    args: ImportIdArgs,
) -> Result<(), String> {
    match registry_set_paused(&registry, &args.import_id, false)? {
        true => {
            info!("🌌 收到恢复导入: {}", args.import_id);
            emit_status_from_snapshot(&window, &sessions, &args.import_id, "processing");
        }
        false => warn!("🌌 恢复导入：未知任务 {}", args.import_id),
    }
    Ok(())
}

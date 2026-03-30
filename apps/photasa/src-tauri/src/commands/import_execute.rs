/*!
 * executeImport / cancelImport / pauseImport / resumeImport（RFC 0070 + 0096）
 * 按前端 `ImportConfig` 的 selectedFiles 复制到 targetPath，发送与 Electron 相近的进度/完成事件。
 */
use crate::commands::import_session_store::ImportSessionStore;
use log::{info, warn};
use serde::Deserialize;
use serde_json::{json, Value};
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;
use std::time::Instant;
use tauri::{Emitter, State, Window};

/// 单任务控制：取消 + 暂停（按 import_id）
pub struct ImportTaskFlags {
    pub cancel: Arc<AtomicBool>,
    pub paused: Arc<AtomicBool>,
}

pub struct ImportTaskRegistry(pub Mutex<HashMap<String, ImportTaskFlags>>);

impl Default for ImportTaskRegistry {
    fn default() -> Self {
        Self(Mutex::new(HashMap::new()))
    }
}

/// 暂停等待期间若取消则返回 false
fn wait_unpaused_or_cancel(cancel: &AtomicBool, paused: &AtomicBool) -> bool {
    loop {
        if cancel.load(Ordering::SeqCst) {
            return false;
        }
        if !paused.load(Ordering::SeqCst) {
            return true;
        }
        thread::sleep(Duration::from_millis(50));
    }
}

fn take_duplicate_strategy(config: &Value) -> &'static str {
    match config.get("duplicateStrategy").and_then(|v| v.as_str()) {
        Some("skip") => "skip",
        Some("overwrite") => "overwrite",
        Some("rename") | None => "rename",
        _ => "rename",
    }
}

fn collect_files(config: &Value) -> Vec<String> {
    if let Some(arr) = config.get("selectedFiles").and_then(|v| v.as_array()) {
        let mut out: Vec<String> = arr
            .iter()
            .filter_map(|x| x.as_str().map(|s| s.to_string()))
            .collect();
        out.sort();
        out.dedup();
        return out;
    }
    Vec::new()
}

fn ensure_parent(path: &Path) -> Result<(), String> {
    if let Some(p) = path.parent() {
        fs::create_dir_all(p).map_err(|e| e.to_string())?;
    }
    Ok(())
}

fn copy_one(src: &Path, target_dir: &Path, strategy: &str) -> Result<(bool, PathBuf), String> {
    let name = src
        .file_name()
        .and_then(|s| s.to_str())
        .ok_or_else(|| "无效源路径".to_string())?;
    let mut dest = target_dir.join(name);
    if dest.exists() {
        match strategy {
            "skip" => return Ok((false, dest)),
            "overwrite" => {}
            _ => {
                let mut count = 1u32;
                let stem = Path::new(name).file_stem().and_then(|s| s.to_str()).unwrap_or("file");
                let ext = Path::new(name)
                    .extension()
                    .and_then(|e| e.to_str())
                    .map(|e| format!(".{e}"))
                    .unwrap_or_default();
                loop {
                    let alt = format!("{stem}_{count}{ext}");
                    dest = target_dir.join(&alt);
                    if !dest.exists() {
                        break;
                    }
                    count += 1;
                }
            }
        }
    }
    ensure_parent(&dest)?;
    fs::copy(src, &dest).map_err(|e| e.to_string())?;
    Ok((true, dest))
}

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
        json!({
            "totalFiles": total_files,
            "processedFiles": processed,
            "successfulFiles": successful,
            "skippedFiles": skipped,
            "errorFiles": errors,
            "currentFile": current_file,
            "status": "cancelled",
            "errors": [],
            "warnings": [],
        }),
    );
}

/// 执行导入：立即返回 import_id，后台复制并 emit `import:progress` / `import:complete` / `import:error`
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
        let started = Instant::now();
        let total_files = files.len() as u32;
        let start_iso = chrono::Utc::now().to_rfc3339();

        let initial_progress = json!({
            "totalFiles": total_files,
            "processedFiles": 0u32,
            "successfulFiles": 0u32,
            "skippedFiles": 0u32,
            "errorFiles": 0u32,
            "speed": 0.0,
            "estimatedTimeRemaining": 0u64,
            "remainingTime": 0u64,
            "currentFile": "",
            "status": "processing",
            "errors": [],
            "warnings": [],
            "startTime": start_iso.clone(),
        });
        let _ = window_clone.emit("import:progress", initial_progress.clone());
        sessions_spawn.set_progress(&import_id_emit, initial_progress);

        if let Err(e) = fs::create_dir_all(Path::new(&target_path)) {
            let _ = window_clone.emit(
                "import:error",
                json!({ "message": format!("创建目标目录失败: {e}"), "importId": import_id_emit }),
            );
            let mut g = registry_spawn.0.lock().unwrap();
            g.remove(&import_id_emit);
            sessions_spawn.remove_progress(&import_id_emit);
            return;
        }

        let target_pb = PathBuf::from(&target_path);
        let mut successful = 0u32;
        let mut skipped = 0u32;
        let mut errors = 0u32;
        let mut processed = 0u32;
        let mut imported_files: Vec<Value> = Vec::new();
        let mut total_size: u64 = 0;

        for src_s in &files {
            if !wait_unpaused_or_cancel(&cancel_flag, &paused_flag) {
                emit_cancelled_progress(
                    &window_clone,
                    total_files,
                    processed,
                    successful,
                    skipped,
                    errors,
                    src_s.as_str(),
                );
                let mut g = registry_spawn.0.lock().unwrap();
                g.remove(&import_id_emit);
                sessions_spawn.remove_progress(&import_id_emit);
                info!("🌌 导入已取消: {}", import_id_emit);
                return;
            }

            if cancel_flag.load(Ordering::SeqCst) {
                emit_cancelled_progress(
                    &window_clone,
                    total_files,
                    processed,
                    successful,
                    skipped,
                    errors,
                    src_s.as_str(),
                );
                let mut g = registry_spawn.0.lock().unwrap();
                g.remove(&import_id_emit);
                sessions_spawn.remove_progress(&import_id_emit);
                info!("🌌 导入已取消: {}", import_id_emit);
                return;
            }

            let src = Path::new(src_s);
            if !src.is_file() {
                errors += 1;
                processed += 1;
                continue;
            }

            match copy_one(src, &target_pb, strategy) {
                Ok((copied, dest)) => {
                    if copied {
                        successful += 1;
                        let dest_s = dest.to_string_lossy().replace('\\', "/");
                        let sz = fs::metadata(&dest).map(|m| m.len()).unwrap_or(0);
                        total_size += sz;
                        let src_norm = src_s.replace('\\', "/");
                        imported_files.push(json!({
                            "originalPath": src_norm,
                            "targetPath": dest_s,
                            "size": sz,
                            "checksum": serde_json::Value::Null,
                            "importTime": chrono::Utc::now().to_rfc3339(),
                        }));
                    } else {
                        skipped += 1;
                    }
                }
                Err(e) => {
                    warn!("🌌 复制失败 {}: {}", src_s, e);
                    errors += 1;
                }
            }
            processed += 1;

            let elapsed = started.elapsed().as_secs_f64().max(0.001);
            let speed = processed as f64 / elapsed;
            let left = total_files.saturating_sub(processed);
            let eta = if speed > 0.01 {
                (left as f64 / speed) as u64
            } else {
                0u64
            };

            let progress_val = json!({
                "totalFiles": total_files,
                "processedFiles": processed,
                "successfulFiles": successful,
                "skippedFiles": skipped,
                "errorFiles": errors,
                "speed": speed,
                "estimatedTimeRemaining": eta,
                "remainingTime": eta,
                "currentFile": src_s,
                "status": "processing",
                "errors": [],
                "warnings": [],
                "startTime": start_iso.clone(),
            });
            let _ = window_clone.emit("import:progress", progress_val.clone());
            sessions_spawn.set_progress(&import_id_emit, progress_val);
        }

        let duration_ms = started.elapsed().as_millis() as u64;
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
    });

    Ok(import_id)
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportIdArgs {
    pub import_id: String,
}

#[tauri::command]
pub fn cancel_import(registry: State<'_, Arc<ImportTaskRegistry>>, args: ImportIdArgs) -> Result<(), String> {
    let import_id = args.import_id;
    let g = registry.0.lock().map_err(|e| e.to_string())?;
    if let Some(flags) = g.get(&import_id) {
        flags.cancel.store(true, Ordering::SeqCst);
        info!("🌌 收到取消导入: {}", import_id);
        Ok(())
    } else {
        warn!("🌌 取消导入：未知任务 {}", import_id);
        Ok(())
    }
}

#[tauri::command]
pub fn pause_import(registry: State<'_, Arc<ImportTaskRegistry>>, args: ImportIdArgs) -> Result<(), String> {
    let g = registry.0.lock().map_err(|e| e.to_string())?;
    if let Some(flags) = g.get(&args.import_id) {
        flags.paused.store(true, Ordering::SeqCst);
        info!("🌌 收到暂停导入: {}", args.import_id);
    } else {
        warn!("🌌 暂停导入：未知任务 {}", args.import_id);
    }
    Ok(())
}

#[tauri::command]
pub fn resume_import(registry: State<'_, Arc<ImportTaskRegistry>>, args: ImportIdArgs) -> Result<(), String> {
    let g = registry.0.lock().map_err(|e| e.to_string())?;
    if let Some(flags) = g.get(&args.import_id) {
        flags.paused.store(false, Ordering::SeqCst);
        info!("🌌 收到恢复导入: {}", args.import_id);
    } else {
        warn!("🌌 恢复导入：未知任务 {}", args.import_id);
    }
    Ok(())
}

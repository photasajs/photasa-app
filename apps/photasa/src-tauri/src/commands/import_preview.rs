/*!
 * RFC 0070：导入预览 — 与 Electron `import-worker` 预览链 **1:1**：
 * 每文件 `extract_metadata`（同 IPC）、`processFileGroup` 级日期/尺寸合并、`determineGroupTargetDate` + `generateDatePath`、
 * `targetPath` 仅为日期相对路径、`targetDir`/`targetFullPath` 为落盘目录结构、`FileStatistics.groupCount` 在纯 single 组时为 0。
 */
use crate::commands::extract_metadata::extract_metadata_request;
use crate::commands::import_date_util::{
    determine_group_target_utc, generate_date_path_utc, merge_extract_into_file_info,
    rfc3339_pair_from_fs_meta,
};
use crate::commands::import_path_filter::{basename_hidden, classify_media, should_ignore_photasa_path};
use log::{info, warn};
use serde_json::{json, Map, Value};
use std::fs;
use std::path::PathBuf;
use std::sync::Arc;
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter};
use walkdir::WalkDir;

/// 与 `legacy-api` / `tauri-import-stubs` 中 `EVENT_IMPORT_PREVIEW_PROGRESS` 一致
pub const IMPORT_PREVIEW_PROGRESS_EVENT: &str = "import:preview-progress";

const PROGRESS_FILE_BATCH: usize = 32;
const PROGRESS_MIN_INTERVAL: Duration = Duration::from_millis(250);
const DISCOVERED_TAIL: usize = 24;

fn base_file_info_preview(
    path_str: &str,
    name: &str,
    size: u64,
    is_image: bool,
    is_video: bool,
    created: &str,
    modified: &str,
) -> Value {
    let ft = if is_image {
        "image"
    } else if is_video {
        "video"
    } else {
        "other"
    };
    json!({
        "file": path_str,
        "path": path_str,
        "name": name,
        "size": size,
        "type": ft,
        "isImage": is_image,
        "isVideo": is_video,
        "targetFileName": name,
        "modifiedTime": modified,
        "createdTime": created,
    })
}

fn finalize_target_paths(fi: &mut Value, target_root: &str, date_path: &str, name: &str) {
    let sep = if target_root.ends_with('/') { "" } else { "/" };
    let target_dir = norm(&format!("{target_root}{sep}{date_path}"));
    let target_full = norm(&format!("{target_dir}/{name}"));
    if let Some(obj) = fi.as_object_mut() {
        obj.insert("targetDir".to_string(), json!(target_dir));
        obj.insert("targetFullPath".to_string(), json!(target_full));
    }
}

/// 与 `import-worker.ts` `estimateImportDuration` 同式（100MB/s + 每文件 0.1s，下限 1）
fn estimate_import_duration_electron_style(total_files: usize, total_size: u64) -> f64 {
    let size_based = (total_size as f64) / (100.0 * 1024.0 * 1024.0);
    let file_based = (total_files as f64) * 0.1;
    (size_based + file_based).max(1.0)
}

/// 与 `import-worker.ts` `generateTargetStructure` 一致：`Map<目标目录绝对路径, 文件名列表>`
fn build_target_structure_map(file_groups: &[Value], target_root: &str) -> Map<String, Value> {
    let mut structure = Map::new();
    let root = target_root.trim_end_matches('/');
    for g in file_groups {
        let Some(main) = g.get("mainFile") else {
            continue;
        };
        let target_dt = determine_group_target_utc(main);
        let date_path = generate_date_path_utc(target_dt);
        let full_dir = norm(&format!("{root}/{date_path}"));
        let names: Vec<String> = g
            .get("files")
            .and_then(|v| v.as_array())
            .map(|arr| {
                arr.iter()
                    .filter_map(|f| f.get("name").and_then(|v| v.as_str()).map(String::from))
                    .collect()
            })
            .unwrap_or_default();
        if names.is_empty() {
            continue;
        }
        let entry = structure.entry(full_dir).or_insert_with(|| json!([]));
        if let Some(arr) = entry.as_array_mut() {
            for n in names {
                arr.push(json!(n));
            }
        }
    }
    structure
}

fn norm(p: &str) -> String {
    p.replace('\\', "/")
}

fn parse_source_paths(config: &Value) -> Result<Vec<String>, String> {
    let arr = config
        .get("sourcePaths")
        .and_then(|v| v.as_array())
        .ok_or_else(|| "sourcePaths 须为非空数组".to_string())?;
    let paths: Vec<String> = arr
        .iter()
        .filter_map(|x| x.as_str().map(|s| s.to_string()))
        .collect();
    if paths.is_empty() {
        return Err("sourcePaths 不能为空".to_string());
    }
    Ok(paths)
}

fn parse_target_path(config: &Value) -> Result<String, String> {
    config
        .get("targetPath")
        .and_then(|v| v.as_str())
        .map(|s| norm(s))
        .ok_or_else(|| "缺少 targetPath".to_string())
}

fn include_subfolders(config: &Value) -> bool {
    config
        .get("filters")
        .and_then(|f| f.get("includeSubfolders"))
        .and_then(|v| v.as_bool())
        .unwrap_or(true)
}

fn emit_preview_progress(
    app: &AppHandle,
    preview_id: &str,
    files_found: usize,
    dirs_scanned: usize,
    current_path: &str,
    discovered_tail: &[Value],
) {
    let progress = json!({
        "stage": "scanning",
        "currentPath": current_path,
        "filesFound": files_found,
        "directoriesScanned": dirs_scanned,
        "message": "扫描源目录…",
        "discoveredFiles": discovered_tail,
    });
    let payload = json!({
        "previewId": preview_id,
        "progress": progress,
        "files": discovered_tail,
    });
    if let Err(e) = app.emit(IMPORT_PREVIEW_PROGRESS_EVENT, payload) {
        warn!("🌌 发射 import:preview-progress 失败：{e}");
    }
}

fn scan_preview_blocking(
    app: Arc<AppHandle>,
    preview_id: String,
    sources: Vec<String>,
    target_root: String,
    recursive: bool,
) -> Result<Value, String> {
    let mut file_groups: Vec<Value> = Vec::new();
    let mut images = 0u64;
    let mut videos = 0u64;
    let mut total_size = 0u64;
    let mut dirs_scanned = 0usize;
    let mut discovered_buf: Vec<Value> = Vec::new();
    let mut last_emit = Instant::now();
    let mut files_found = 0usize;

    for root in sources {
        let base = PathBuf::from(&root);
        if !base.is_dir() {
            warn!("🌌 预览跳过（非目录）: {}", root);
            continue;
        }

        let mut wd = WalkDir::new(&base);
        if !recursive {
            wd = wd.max_depth(1);
        }

        for entry in wd.into_iter().filter_map(|e| e.ok()) {
            let path = entry.path();
            if path.is_dir() {
                dirs_scanned = dirs_scanned.saturating_add(1);
                continue;
            }

            let path_str = norm(&path.to_string_lossy());
            if should_ignore_photasa_path(&path_str) {
                continue;
            }
            if basename_hidden(path) {
                continue;
            }

            let Some((is_image, is_video)) = classify_media(path) else {
                continue;
            };

            let meta = match fs::metadata(path) {
                Ok(m) => m,
                Err(e) => {
                    warn!("🌌 预览读元数据失败 {path_str}: {e}");
                    continue;
                }
            };
            let size = meta.len();
            let name = path
                .file_name()
                .and_then(|s| s.to_str())
                .unwrap_or("")
                .to_string();
            let (created, modified) = rfc3339_pair_from_fs_meta(&meta);

            if is_image {
                images += 1;
            } else {
                videos += 1;
            }
            total_size += size;
            files_found += 1;

            let file_type_hint = if is_image {
                "image"
            } else if is_video {
                "video"
            } else {
                "other"
            };
            let extract_req = json!({
                "filePath": path_str.clone(),
                "fileType": file_type_hint,
            });
            let extracted = extract_metadata_request(&extract_req).unwrap_or_else(|e| {
                warn!("🌌 预览 extract_metadata 失败（回退文件时间） {path_str}: {e}");
                json!({})
            });

            let mut fi = base_file_info_preview(
                &path_str,
                &name,
                size,
                is_image,
                is_video,
                &created,
                &modified,
            );
            merge_extract_into_file_info(&mut fi, &extracted, &created, &modified);
            let target_dt = determine_group_target_utc(&fi);
            let date_path = generate_date_path_utc(target_dt);
            finalize_target_paths(&mut fi, &target_root, &date_path, &name);

            let group = json!({
                "mainFile": fi.clone(),
                "files": [fi.clone()],
                "type": "single",
                "totalSize": size,
                "targetPath": date_path,
            });
            file_groups.push(group);
            discovered_buf.push(fi);

            if discovered_buf.len() > DISCOVERED_TAIL {
                let drain_start = discovered_buf.len() - DISCOVERED_TAIL;
                discovered_buf.drain(0..drain_start);
            }

            let should_emit = files_found % PROGRESS_FILE_BATCH == 0
                || last_emit.elapsed() >= PROGRESS_MIN_INTERVAL;
            if should_emit {
                last_emit = Instant::now();
                emit_preview_progress(
                    app.as_ref(),
                    &preview_id,
                    files_found,
                    dirs_scanned,
                    &path_str,
                    &discovered_buf,
                );
            }
        }
    }

    emit_preview_progress(
        app.as_ref(),
        &preview_id,
        files_found,
        dirs_scanned,
        "",
        &discovered_buf,
    );

    let stats = json!({
        "totalFiles": files_found,
        "imageFiles": images,
        "videoFiles": videos,
        "otherFiles": 0,
        "totalSize": total_size,
        "duplicateCount": 0,
        "groupCount": 0,
    });

    let estimated = estimate_import_duration_electron_style(files_found, total_size);
    let target_structure = build_target_structure_map(&file_groups, &target_root);

    Ok(json!({
        "fileGroups": file_groups,
        "statistics": stats,
        "duplicates": [],
        "estimatedDuration": estimated,
        "targetStructure": target_structure,
    }))
}

#[cfg(test)]
mod target_structure_tests {
    use super::*;

    #[test]
    fn estimate_duration_matches_worker_formula() {
        let e = estimate_import_duration_electron_style(10, 100 * 1024 * 1024);
        let size_based = 100.0 / 100.0;
        let file_based = 1.0;
        assert!((e - (size_based + file_based)).abs() < 0.001);
    }
}

/// 生成导入预览：在阻塞线程中遍历文件系统，避免长时间占用 async 线程
#[tauri::command]
pub async fn preview_import(app: AppHandle, config: Value) -> Result<Value, String> {
    let preview_id = format!("preview_{}", chrono::Utc::now().timestamp_millis());
    let sources = parse_source_paths(&config)?;
    let target_root = parse_target_path(&config)?;
    let recursive = include_subfolders(&config);

    info!(
        "🌌 导入预览开坛 previewId={} 源目录数={}",
        preview_id,
        sources.len()
    );

    let app_arc = Arc::new(app);
    let sid = preview_id.clone();
    tokio::task::spawn_blocking(move || scan_preview_blocking(app_arc, sid, sources, target_root, recursive))
        .await
        .map_err(|e| format!("预览任务异常: {e}"))?
}

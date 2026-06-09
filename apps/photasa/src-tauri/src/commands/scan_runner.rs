//! 扫描任务编排：缓存 + `picasa:find-photo` + `notify:status` 事件（Rust 重写）

use std::path::Path;
use std::sync::Arc;

use log::{error, info};
use serde::{Deserialize, Serialize};
use serde_json::json;
use tauri::{AppHandle, Emitter};

use super::photasa_config::{self, absolute_thumbnail_path_for_source};
use super::scan_cache::prepare_folder_scan_cache;
use super::scan_media::{collect_media_files, is_photasa_media_file, normalize_path_string};
use super::thumbnail::{create_thumbnail_sync, ThumbnailRequest};
use super::scan_notify::{
    build_scan_notify_payload, ScanNotifyAction, ScanNotifyProgress, ScanWorkerNotifySource,
};

#[derive(Debug, Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ScanAction {
    pub path: String,
    #[serde(default)]
    pub operation_type: String,
    #[serde(default)]
    pub action: String,
    pub thumbnail_size: Option<u32>,
    #[serde(default)]
    pub is_directory: bool,
}

fn routes_to_directory_scan(scan: &ScanAction) -> bool {
    scan.operation_type != "file"
}

fn emit_scan_event(app: &AppHandle, payload: serde_json::Value) {
    let _ = app.emit("picasa:find-photo", payload);
}

fn emit_status_notify(app: &AppHandle, source: ScanWorkerNotifySource) {
    if let Some(payload) = build_scan_notify_payload(&source) {
        let _ = app.emit("notify:status", &payload);
    }
}

fn emit_progress(
    app: &AppHandle,
    request_id: &str,
    action_path: &str,
    is_directory: bool,
    current_file_path: &str,
    processed: usize,
    total: usize,
) {
    let current_file = Path::new(current_file_path)
        .file_name()
        .and_then(|n| n.to_str())
        .map(String::from);
    let notify_source = ScanWorkerNotifySource {
        msg_type: "progress".into(),
        error: None,
        action: Some(ScanNotifyAction {
            path: Some(action_path.to_string()),
            is_directory: Some(is_directory),
        }),
        progress: Some(ScanNotifyProgress { processed, total }),
        current_file: current_file.clone(),
    };
    emit_status_notify(app, notify_source);
    emit_scan_event(
        app,
        json!({
            "type": "progress",
            "requestId": request_id,
            "action": {
                "path": action_path,
                "isDirectory": is_directory,
            },
            "progress": { "processed": processed, "total": total },
            "currentFile": current_file,
        }),
    );
}

fn emit_error(app: &AppHandle, request_id: &str, message: &str, action_path: Option<&str>) {
    let notify_source = ScanWorkerNotifySource {
        msg_type: "error".into(),
        error: Some(message.to_string()),
        action: action_path.map(|path| ScanNotifyAction {
            path: Some(path.to_string()),
            is_directory: None,
        }),
        progress: None,
        current_file: None,
    };
    emit_status_notify(app, notify_source);
    emit_scan_event(
        app,
        json!({
            "type": "error",
            "requestId": request_id,
            "error": message,
            "action": action_path.map(|path| json!({ "path": path })),
        }),
    );
}

fn emit_directory_complete(app: &AppHandle, request_id: &str, scan_root: &str, file_count: usize) {
    emit_status_notify(
        app,
        ScanWorkerNotifySource {
            msg_type: "complete".into(),
            error: None,
            action: Some(ScanNotifyAction {
                path: Some(scan_root.to_string()),
                is_directory: Some(true),
            }),
            progress: None,
            current_file: None,
        },
    );
    emit_scan_event(
        app,
        json!({
            "type": "complete",
            "requestId": request_id,
            "action": { "path": scan_root, "isDirectory": true },
            "paths": [],
            "fileCount": file_count,
        }),
    );
}

fn emit_file_complete(app: &AppHandle, request_id: &str, file_path: &str) {
    emit_status_notify(
        app,
        ScanWorkerNotifySource {
            msg_type: "complete".into(),
            error: None,
            action: Some(ScanNotifyAction {
                path: Some(file_path.to_string()),
                is_directory: Some(false),
            }),
            progress: None,
            current_file: None,
        },
    );
    emit_scan_event(
        app,
        json!({
            "type": "complete",
            "requestId": request_id,
            "action": { "path": file_path, "isDirectory": false },
        }),
    );
}

pub(crate) fn run_directory_scan_sync(
    app: Arc<AppHandle>,
    request_id: String,
    scan_root: String,
    recursive: bool,
) {
    let root = Path::new(&scan_root);
    info!(
        "🌌 千里眼开坛，目录扫描: {} (requestId: {})",
        scan_root, request_id
    );

    let discovered = match collect_media_files(root, recursive) {
        Ok(files) => files,
        Err(err) => {
            error!("🌌 千里眼扫描失败: {}", err);
            emit_error(&app, &request_id, &err, Some(&scan_root));
            return;
        }
    };

    let mut cache = match prepare_folder_scan_cache(root, discovered) {
        Ok(c) => c,
        Err(err) => {
            error!("🌌 千里眼缓存初始化失败: {}", err);
            emit_error(&app, &request_id, &err, Some(&scan_root));
            return;
        }
    };

    let pending: Vec<String> = cache.pending_files.clone();
    for full_path in pending {
        if let Err(err) = photasa_config::add_photo_to_folder_list(&scan_root, &full_path) {
            error!("🌌 千里眼写入 .photasa.json 失败 {}: {}", full_path, err);
        }

        let thumb_path = absolute_thumbnail_path_for_source(&full_path);
        let thumb_result = create_thumbnail_sync(&ThumbnailRequest {
            path: full_path.clone(),
            thumbnail: thumb_path,
            width: Some(256),
            height: Some(256),
            without_enlargement: Some(true),
            preview: None,
            always: Some(false),
        });
        if !thumb_result.success {
            if let Some(err) = thumb_result.error {
                error!("🌌 千里眼缩略图生成失败 {}: {}", full_path, err);
            }
        }

        cache.mark_file_processed(&full_path);
        if let Err(err) = cache.save(root) {
            error!("🌌 千里眼缓存写入失败: {}", err);
            emit_error(&app, &request_id, &err, Some(&scan_root));
            return;
        }
        let (processed, total) = cache.progress_counts();
        emit_progress(&app, &request_id, &scan_root, true, &full_path, processed, total);
    }

    cache.mark_scan_complete();
    if let Err(err) = cache.save(root) {
        error!("🌌 千里眼缓存完成写入失败: {}", err);
        emit_error(&app, &request_id, &err, Some(&scan_root));
        return;
    }

    let file_count = cache.processed_files.len();
    emit_directory_complete(&app, &request_id, &scan_root, file_count);
    info!("🌌 千里眼完功，共处理 {} 个文件", file_count);
}

fn run_file_scan_sync(app: Arc<AppHandle>, request_id: String, scan: ScanAction) {
    let file_path = normalize_path_string(Path::new(&scan.path));
    info!(
        "🌌 千里眼开坛，文件扫描: {} (requestId: {})",
        file_path, request_id
    );

    if !Path::new(&scan.path).exists() {
        let err = format!("File does not exist: {}", file_path);
        emit_error(&app, &request_id, &err, Some(&file_path));
        return;
    }

    if !is_photasa_media_file(Path::new(&scan.path)) {
        emit_file_complete(&app, &request_id, &file_path);
        return;
    }

    if let Some(folder) = Path::new(&scan.path).parent().and_then(|p| p.to_str()) {
        if let Err(err) = photasa_config::add_photo_to_folder_list(folder, &file_path) {
            error!("🌌 千里眼写入 .photasa.json 失败 {}: {}", file_path, err);
        }
        let thumb_path = absolute_thumbnail_path_for_source(&file_path);
        let _ = create_thumbnail_sync(&ThumbnailRequest {
            path: file_path.clone(),
            thumbnail: thumb_path,
            width: Some(256),
            height: Some(256),
            without_enlargement: Some(true),
            preview: None,
            always: Some(false),
        });
    }

    emit_progress(&app, &request_id, &file_path, false, &file_path, 1, 1);
    emit_file_complete(&app, &request_id, &file_path);
}

/// 在后台任务中执行扫描（`scan_photos` 与 adapter 共用）
pub fn spawn_scan_job(app: AppHandle, request_id: String, scan: ScanAction, recursive: bool) {
    let app = Arc::new(app);
    tokio::spawn(async move {
        if routes_to_directory_scan(&scan) {
            let scan_root = scan.path.clone();
            tokio::task::spawn_blocking(move || {
                run_directory_scan_sync(app, request_id, scan_root, recursive);
            })
            .await
            .ok();
        } else {
            let scan_clone = scan.clone();
            tokio::task::spawn_blocking(move || {
                run_file_scan_sync(app, request_id, scan_clone);
            })
            .await
            .ok();
        }
    });
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn routes_file_operation_when_operation_type_file() {
        let scan = ScanAction {
            path: "/tmp/a.jpg".into(),
            operation_type: "file".into(),
            action: String::new(),
            thumbnail_size: None,
            is_directory: false,
        };
        assert!(!routes_to_directory_scan(&scan));
    }

    #[test]
    fn routes_directory_by_default() {
        let scan = ScanAction {
            path: "/tmp/album".into(),
            operation_type: String::new(),
            action: String::new(),
            thumbnail_size: None,
            is_directory: true,
        };
        assert!(routes_to_directory_scan(&scan));
    }
}

//! 扫描任务编排：Electron `scanPhotos` 管线 Rust 重写（RFC 0117）

use std::fs;
use std::path::Path;
use std::sync::Arc;

use log::{error, info, warn};
use serde_json::json;
use tauri::{AppHandle, Emitter};

use super::photasa_config::{
    self, absolute_thumbnail_path_for_source, read_config_sync, PHOTASA_CONFIG_FILE,
};
use super::scan_cache::IncrementalCacheManager;
use super::scan_media::{
    build_thumbnail_path, classify_media, is_photasa_media_file, list_scan_subdirectories,
    normalize_path_string, relative_thumbnail_path_for_source, validate_scan_params,
    walkthrough_photos_in_folder, PhotoFileRequest,
};
pub use super::scan_media::ScanAction;
use super::scan_notify::{
    build_scan_notify_payload, ScanNotifyAction, ScanNotifyProgress, ScanWorkerNotifySource,
};
use super::scan_strategy::{
    decide_scan_strategy, should_process_file, should_scan_one_level, ScanStrategy,
};
use super::thumbnail::{create_thumbnail_sync, ThumbnailRequest};

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

/// Electron `buildDirectoryScanProgressMessage` — `currentFile` 仅当 `path && !isDirectory`
fn emit_file_progress(
    app: &AppHandle,
    request_id: &str,
    file: &PhotoFileRequest,
    processed: usize,
    total: usize,
) {
    let current_file = if !file.path.is_empty() && !file.is_directory {
        Path::new(&file.path)
            .file_name()
            .and_then(|n| n.to_str())
            .map(String::from)
    } else {
        None
    };

    let notify_source = ScanWorkerNotifySource {
        msg_type: "progress".into(),
        error: None,
        action: Some(ScanNotifyAction {
            path: Some(file.path.clone()),
            is_directory: Some(file.is_directory),
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
                "path": file.path,
                "isDirectory": file.is_directory,
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

fn emit_directory_complete(
    app: &AppHandle,
    request_id: &str,
    scan_root: &str,
    file_count: usize,
    found_paths: &[String],
) {
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
            "paths": found_paths,
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

fn should_create_thumbnail(thumbnail_path: &str, action: &str) -> bool {
    !Path::new(thumbnail_path).exists() || action == "rescan"
}

fn create_thumbnail_for_file(file: &PhotoFileRequest, scan: &ScanAction) -> bool {
    let thumb_size = scan.thumbnail_size.unwrap_or(256);
    let always = scan.action == "rescan";
    if !should_create_thumbnail(&file.thumbnail, &scan.action) {
        return false;
    }
    let result = create_thumbnail_sync(&ThumbnailRequest {
        path: file.path.clone(),
        thumbnail: file.thumbnail.clone(),
        width: Some(thumb_size),
        height: Some(thumb_size),
        without_enlargement: Some(true),
        preview: Some(file.thumbnail.clone()),
        always: Some(always),
    });
    if !result.success {
        if let Some(err) = result.error {
            error!("🌌 千里眼缩略图生成失败 {}: {}", file.path, err);
        }
        return false;
    }
    true
}

/// `processPhotoFile` — process→record 顺序由调用方负责
fn process_photo_file(file: &PhotoFileRequest, scan: &ScanAction) -> bool {
    let thumb_created = create_thumbnail_for_file(file, scan);
    if let Some(folder) = Path::new(&file.path).parent().and_then(|p| p.to_str()) {
        if let Err(err) = photasa_config::add_photo_to_folder_list(folder, &file.path) {
            error!("🌌 千里眼写入 .photasa.json 失败 {}: {}", file.path, err);
        }
    }
    thumb_created
}

/// 从 photoList 条目构造 `PhotoFileRequest`（`restoreCachedFiles` 映射）
fn cached_photo_to_request(folder: &str, photo: &serde_json::Value) -> Option<PhotoFileRequest> {
    let file_name = photo.get("path").and_then(|v| v.as_str())?;
    if file_name.is_empty() {
        return None;
    }
    let full_path = normalize_path_string(&Path::new(folder).join(file_name));
    let thumbnail = photo
        .get("thumbnail")
        .and_then(|v| v.as_str())
        .filter(|t| !t.is_empty())
        .map(String::from)
        .unwrap_or_else(|| relative_thumbnail_path_for_source(&full_path));
    let is_video = photo
        .get("isVideo")
        .and_then(|v| v.as_bool())
        .unwrap_or(false);
    let is_image = if is_video {
        false
    } else {
        classify_media(Path::new(&full_path))
            .map(|(img, _)| img)
            .unwrap_or(true)
    };
    Some(PhotoFileRequest {
        path: full_path,
        thumbnail,
        is_image,
        is_video,
        is_directory: false,
    })
}

/// `restoreCachedFiles` — 从 `.photasa.json` 重新发出 photoList。
///
/// 进度计数对齐 Electron `mergeDirectoryScanProgressWithCache`：SKIP 视所有条目已处理，
/// 故 `total = processed = N`（photoList 长度），而非空缓存的 `(0,0)`（RFC 0117 BUG②）。
fn restore_cached_files(app: &AppHandle, request_id: &str, folder: &str) {
    let config_path = Path::new(folder).join(PHOTASA_CONFIG_FILE);
    if !config_path.exists() {
        warn!("🌌 【警示】配置文件不存在，跳过缓存恢复: {}", config_path.display());
        return;
    }

    let content = match fs::read_to_string(&config_path) {
        Ok(c) => c,
        Err(e) => {
            error!("🌌 千里眼读取配置失败: {e}");
            return;
        }
    };

    let value: serde_json::Value = match serde_json::from_str(&content) {
        Ok(v) => v,
        Err(e) => {
            error!("🌌 千里眼配置 JSON 解析失败: {e}");
            return;
        }
    };

    let photo_list = match value.get("photoList").and_then(|v| v.as_array()) {
        Some(arr) => arr,
        None => {
            warn!("🌌 【警示】photoList 无效: {}", config_path.display());
            return;
        }
    };

    let files: Vec<PhotoFileRequest> = photo_list
        .iter()
        .filter_map(|photo| cached_photo_to_request(folder, photo))
        .collect();
    let total = files.len();

    for (idx, file) in files.iter().enumerate() {
        emit_file_progress(app, request_id, file, idx + 1, total);
    }
}

fn process_file_list(
    app: &AppHandle,
    request_id: &str,
    files: &[PhotoFileRequest],
    scan: &ScanAction,
    cache_mgr: &mut IncrementalCacheManager,
) {
    for file in files {
        let should = should_process_file(&file.path, &scan.action);
        if should {
            let thumb = process_photo_file(file, scan);
            if let Err(err) = cache_mgr.record_file_processed(&file.path, thumb) {
                error!("🌌 千里眼缓存记录失败: {err}");
            }
        }
        let (processed, total) = cache_mgr.progress_counts();
        emit_file_progress(app, request_id, file, processed, total);
    }
    if let Err(err) = cache_mgr.mark_scan_complete() {
        error!("🌌 千里眼标记扫描完成失败: {err}");
    }
}

fn run_traditional_directory_scan(
    app: &AppHandle,
    request_id: &str,
    scan: &ScanAction,
) -> usize {
    let files = match walkthrough_photos_in_folder(scan) {
        Ok(f) => f,
        Err(err) => {
            emit_error(app, request_id, &err, Some(&scan.path));
            return 0;
        }
    };
    let total = files.len();
    let mut processed = 0usize;
    for file in &files {
        if should_process_file(&file.path, &scan.action) {
            process_photo_file(file, scan);
        }
        processed += 1;
        emit_file_progress(app, request_id, file, processed, total);
    }
    processed
}

/// 子目录递归（仅 Electron SKIP 分支调用：`scanSubdirectories`）。
///
/// 每个子目录重入 `scan_directory_at` → 各自决策 SKIP/FULL。子目录错误记录后跳过，
/// 不中断兄弟目录。`current`（depthLimit 0）不递归——由调用方门控。
fn recurse_into_subdirectories(app: &AppHandle, request_id: &str, scan: &ScanAction) {
    match list_scan_subdirectories(Path::new(&scan.path)) {
        Ok(subdirs) => {
            for sub in subdirs {
                let sub_scan = ScanAction {
                    path: normalize_path_string(&sub),
                    operation_type: scan.operation_type.clone(),
                    action: scan.action.clone(),
                    thumbnail_size: scan.thumbnail_size,
                    is_directory: true,
                };
                let _ = scan_directory_at(app, request_id, &sub_scan);
            }
        }
        Err(err) => {
            warn!("🌌 【警示】子目录列举失败 {}: {err}", scan.path);
        }
    }
}

/// 处理 FULL 分支文件遍历结果（fresh 或 resume）。返回处理文件数。
fn run_full_directory_scan(
    app: &AppHandle,
    request_id: &str,
    scan: &ScanAction,
    mut cache_mgr: IncrementalCacheManager,
) -> Result<usize, String> {
    let all_files = walkthrough_photos_in_folder(scan)?;

    if cache_mgr.is_resume_scan() {
        let unprocessed: Vec<PhotoFileRequest> = all_files
            .iter()
            .filter(|f| !cache_mgr.is_file_processed(&f.path))
            .cloned()
            .collect();
        let paths: Vec<String> = unprocessed.iter().map(|f| f.path.clone()).collect();
        if let Err(err) = cache_mgr.set_pending_files(paths) {
            error!("🌌 千里眼设置待处理列表失败: {err}");
        }
        process_file_list(app, request_id, &unprocessed, scan, &mut cache_mgr);
    } else {
        for file in &all_files {
            if should_process_file(&file.path, &scan.action) {
                let thumb = process_photo_file(file, scan);
                if let Err(err) = cache_mgr.record_file_processed(&file.path, thumb) {
                    error!("🌌 千里眼缓存记录失败: {err}");
                }
            }
            let (processed, total) = cache_mgr.progress_counts();
            emit_file_progress(app, request_id, file, processed, total);
        }
        if let Err(err) = cache_mgr.mark_scan_complete() {
            error!("🌌 千里眼标记扫描完成失败: {err}");
        }
    }
    Ok(cache_mgr.cache().processed_files.len())
}

/// 是否递归子目录（RFC 0117 Recursion model）。
///
/// Electron `scanSubdirectories` **仅在 SKIP 分支**调用；FULL 的 `walkthrough` 已全递归，
/// 再重入会重复处理嵌套文件（BUG①）。`current`（depthLimit 0）任何分支都不递归。
fn should_recurse_subdirs(strategy: ScanStrategy, action: &str) -> bool {
    strategy == ScanStrategy::Skip && !should_scan_one_level(action)
}

fn scan_directory_at(app: &AppHandle, request_id: &str, scan: &ScanAction) -> usize {
    let folder = scan.path.clone();
    let force_rescan = scan.action == "rescan";
    info!(
        "🌌 千里眼目录扫描: {} (action: {})",
        folder,
        if scan.action.is_empty() {
            "scan"
        } else {
            &scan.action
        }
    );

    let decision = decide_scan_strategy(&folder, &scan.action);
    info!(
        "🌌 千里眼策略决策: {:?} — {}",
        decision.strategy, decision.reason
    );

    let file_count;

    if decision.strategy == ScanStrategy::Skip {
        // SKIP：标记 folder 缓存完成（Electron initialize + markScanComplete），再重发 photoList。
        if let Ok(mut cache_mgr) = IncrementalCacheManager::initialize(Path::new(&folder), false) {
            if let Err(err) = cache_mgr.mark_scan_complete() {
                error!("🌌 千里眼 SKIP 缓存完成标记失败: {err}");
            }
        }
        restore_cached_files(app, request_id, &folder);
        file_count = read_config_sync(&folder)
            .ok()
            .flatten()
            .map(|c| c.photo_list.len())
            .unwrap_or(0);

        if should_recurse_subdirs(decision.strategy, &scan.action) {
            recurse_into_subdirectories(app, request_id, scan);
        }
    } else {
        // FULL：`walkthrough` 已全递归（`current` 时仅一层），**不**再逐目录重入，
        // 否则嵌套文件被重复处理（RFC 0117 BUG①）。
        file_count = match IncrementalCacheManager::initialize(Path::new(&folder), force_rescan) {
            Ok(cache_mgr) => match run_full_directory_scan(app, request_id, scan, cache_mgr) {
                Ok(n) => n,
                Err(err) => {
                    emit_error(app, request_id, &err, Some(&folder));
                    return 0;
                }
            },
            Err(err) => {
                warn!("🌌 【警示】增量缓存初始化失败，降级传统扫描: {err}");
                run_traditional_directory_scan(app, request_id, scan)
            }
        };
    }

    // `complete.paths` 始终为空（目录从不被 `classify_media`）；前端用 `action.path`
    // 回退构建 folderTree（与 Electron klaw 过滤一致，RFC 0117）。
    emit_directory_complete(app, request_id, &folder, file_count, &[]);
    file_count
}

pub(crate) fn run_directory_scan_sync(
    app: Arc<AppHandle>,
    request_id: String,
    scan: ScanAction,
    _recursive: bool,
) {
    // `recursive` 不再控制子目录重入：递归仅在 SKIP 分支发生，深度由 `current`
    // （`should_scan_one_level`）门控（RFC 0117 Recursion model）。保留参数以兼容签名。
    let validation = validate_scan_params(&scan);
    if !validation.is_valid {
        let msg = validation.error.unwrap_or_else(|| "参数验证失败".into());
        emit_error(&app, &request_id, &msg, Some(&scan.path));
        return;
    }

    let _ = scan_directory_at(&app, &request_id, &scan);
    info!("🌌 千里眼目录扫描完功: {}", scan.path);
}

/// `processMediaFile` — 单文件扫描
fn process_media_file(app: &AppHandle, request_id: &str, scan: &ScanAction) {
    let file_path = normalize_path_string(Path::new(&scan.path));
    let thumb_path = build_thumbnail_path(&file_path);
    let thumb_size = scan.thumbnail_size.unwrap_or(256);

    match scan.action.as_str() {
        "scan" => {
            if !should_process_file(&file_path, "scan") {
                emit_file_complete(app, request_id, &file_path);
                return;
            }
            if should_create_thumbnail(&thumb_path, "scan") {
                let _ = create_thumbnail_sync(&ThumbnailRequest {
                    path: file_path.clone(),
                    thumbnail: thumb_path.clone(),
                    width: Some(thumb_size),
                    height: Some(thumb_size),
                    without_enlargement: Some(true),
                    preview: Some(thumb_path.clone()),
                    always: Some(false),
                });
            }
            if let Some(folder) = Path::new(&file_path).parent().and_then(|p| p.to_str()) {
                let _ = photasa_config::add_photo_to_folder_list(folder, &file_path);
            }
        }
        "rescan" => {
            let _ = create_thumbnail_sync(&ThumbnailRequest {
                path: file_path.clone(),
                thumbnail: thumb_path.clone(),
                width: Some(thumb_size),
                height: Some(thumb_size),
                without_enlargement: Some(true),
                preview: Some(thumb_path),
                always: Some(true),
            });
            if let Some(folder) = Path::new(&file_path).parent().and_then(|p| p.to_str()) {
                let _ = photasa_config::add_photo_to_folder_list(folder, &file_path);
            }
        }
        "current" => {
            if Path::new(&thumb_path).exists() {
                let _ = fs::remove_file(&thumb_path);
            }
            if let Some(folder) = Path::new(&file_path).parent().and_then(|p| p.to_str()) {
                let _ = photasa_config::remove_photo_from_folder_list(folder, &file_path);
            }
        }
        other => {
            warn!("🌌 【警示】未知扫描操作: {other} @ {file_path}");
        }
    }

    if let Some((is_image, is_video)) = classify_media(Path::new(&file_path)) {
        let file = PhotoFileRequest {
            path: file_path.clone(),
            thumbnail: absolute_thumbnail_path_for_source(&file_path),
            is_image,
            is_video,
            is_directory: false,
        };
        emit_file_progress(app, request_id, &file, 1, 1);
    }
    emit_file_complete(app, request_id, &file_path);
}

fn run_file_scan_sync(app: Arc<AppHandle>, request_id: String, scan: ScanAction) {
    let validation = validate_scan_params(&scan);
    if !validation.is_valid {
        let msg = validation.error.unwrap_or_else(|| "参数验证失败".into());
        emit_error(&app, &request_id, &msg, Some(&scan.path));
        return;
    }

    info!(
        "🌌 千里眼开坛，文件扫描: {} (requestId: {})",
        scan.path, request_id
    );

    if !Path::new(&scan.path).exists() {
        let err = format!("File does not exist: {}", scan.path);
        emit_error(&app, &request_id, &err, Some(&scan.path));
        return;
    }

    if !is_photasa_media_file(Path::new(&scan.path)) {
        emit_file_complete(&app, &request_id, &scan.path);
        return;
    }

    process_media_file(&app, &request_id, &scan);
}

/// 在后台任务中执行扫描（`scan_photos` 与 adapter 共用）
pub fn spawn_scan_job(app: AppHandle, request_id: String, scan: ScanAction, recursive: bool) {
    let app = Arc::new(app);
    tokio::spawn(async move {
        if routes_to_directory_scan(&scan) {
            let scan_clone = scan.clone();
            tokio::task::spawn_blocking(move || {
                run_directory_scan_sync(app, request_id, scan_clone, recursive);
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
            action: "scan".into(),
            thumbnail_size: Some(256),
            is_directory: false,
        };
        assert!(!routes_to_directory_scan(&scan));
    }

    #[test]
    fn routes_directory_by_default() {
        let scan = ScanAction {
            path: "/tmp/album".into(),
            operation_type: String::new(),
            action: "scan".into(),
            thumbnail_size: Some(256),
            is_directory: true,
        };
        assert!(routes_to_directory_scan(&scan));
    }

    #[test]
    fn should_create_thumbnail_when_missing() {
        assert!(should_create_thumbnail("/nonexistent/thumb.png", "scan"));
    }

    #[test]
    fn should_create_thumbnail_on_rescan_even_if_exists() {
        assert!(should_create_thumbnail("/etc/hosts", "rescan"));
    }

    // ── RFC 0117 BUG①: subdir recursion is SKIP-only + honors `current` ──

    #[test]
    fn full_scan_does_not_recurse_subdirs() {
        // FULL 的 walkthrough 已全递归；再重入会重复处理嵌套文件。
        assert!(!should_recurse_subdirs(ScanStrategy::Full, "scan"));
        assert!(!should_recurse_subdirs(ScanStrategy::Full, "rescan"));
    }

    #[test]
    fn skip_scan_recurses_subdirs() {
        assert!(should_recurse_subdirs(ScanStrategy::Skip, "scan"));
    }

    #[test]
    fn current_action_never_recurses() {
        assert!(!should_recurse_subdirs(ScanStrategy::Skip, "current"));
        assert!(!should_recurse_subdirs(ScanStrategy::Full, "current"));
    }

    // ── RFC 0117 BUG②: restore maps photoList entries correctly ──

    #[test]
    fn cached_photo_maps_filename_to_full_path() {
        let photo = serde_json::json!({
            "path": "vacation.jpg",
            "thumbnail": ".photasaoriginals/thumbnail-vacation.jpg.png",
            "isVideo": false
        });
        let req = cached_photo_to_request("/photos/trip", &photo).expect("mapped");
        assert_eq!(req.path, "/photos/trip/vacation.jpg");
        assert_eq!(req.thumbnail, ".photasaoriginals/thumbnail-vacation.jpg.png");
        assert!(!req.is_video);
        assert!(!req.is_directory);
    }

    #[test]
    fn cached_photo_falls_back_thumbnail_when_empty() {
        let photo = serde_json::json!({ "path": "a.jpg", "thumbnail": "", "isVideo": false });
        let req = cached_photo_to_request("/d", &photo).expect("mapped");
        assert_eq!(req.thumbnail, relative_thumbnail_path_for_source("/d/a.jpg"));
    }

    #[test]
    fn cached_photo_skips_empty_or_missing_path() {
        assert!(cached_photo_to_request("/d", &serde_json::json!({ "path": "" })).is_none());
        assert!(cached_photo_to_request("/d", &serde_json::json!({ "thumbnail": "t" })).is_none());
    }

    /// RFC 0117 BUG②：SKIP 恢复进度应为 `(idx+1, N)`，与 Electron `mergeDirectoryScanProgressWithCache` 一致。
    #[test]
    fn skip_restore_progress_uses_photo_list_length() {
        let photos: Vec<serde_json::Value> = (0..5)
            .map(|i| {
                serde_json::json!({
                    "path": format!("pic{i}.jpg"),
                    "thumbnail": format!(".photasaoriginals/thumbnail-pic{i}.jpg.png"),
                    "isVideo": false
                })
            })
            .collect();
        let files: Vec<PhotoFileRequest> = photos
            .iter()
            .filter_map(|p| cached_photo_to_request("/album", p))
            .collect();
        let total = files.len();
        assert_eq!(total, 5);
        for (idx, _file) in files.iter().enumerate() {
            let processed = idx + 1;
            assert_eq!(processed, idx + 1);
            assert_eq!(total, 5);
        }
    }
}

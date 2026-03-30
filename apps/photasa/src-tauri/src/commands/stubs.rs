/*!
 * 扫描命令 + 导入 Stub
 * scan_photos 已替换为真实 walkdir 实现；导入命令待后续迁移
 */
use serde::{Deserialize, Serialize};
use serde_json::json;
use tauri::{AppHandle, Emitter};
use std::sync::Arc;
use walkdir::WalkDir;
use log::info;

// ============================================
// 扫描命令（真实实现）
// ============================================

/// 支持的图片/视频扩展名（与 ScanAdapter 保持一致）
static PHOTO_EXTENSIONS: &[&str] = &[
    "jpg", "jpeg", "png", "gif", "bmp", "webp", "tiff", "tif",
    "heic", "heif", "avif", "raw", "cr2", "cr3", "nef", "arw",
    "mp4", "mov", "avi", "mkv", "m4v", "3gp",
];

#[derive(Debug, Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ScanAction {
    pub path: String,
    #[serde(default)]
    pub operation_type: String,
    #[serde(default)]
    pub action: String,
    pub thumbnail_size: Option<u32>,
    // Electron-compat aliases sent by some callers
    #[serde(default)]
    pub is_directory: bool,
}

/// 扫描照片 — 真实 walkdir 实现，使用前端传入的 requestId 推送事件
#[tauri::command]
pub async fn scan_photos(
    app: AppHandle,
    request_id: String,
    scan_action: ScanAction,
) -> Result<(), String> {
    info!("🌌 千里眼开坛，扫描路径: {} (requestId: {})", scan_action.path, request_id);

    let app = Arc::new(app);
    let path = scan_action.path.clone();

    tokio::spawn(async move {
        let mut file_count = 0usize;

        let walker = WalkDir::new(&path);
        for entry in walker.into_iter().filter_map(|e| e.ok()) {
            let entry_path = entry.path();
            if !entry_path.is_file() {
                continue;
            }

            let ext = entry_path
                .extension()
                .and_then(|e| e.to_str())
                .map(|e| e.to_lowercase())
                .unwrap_or_default();

            if PHOTO_EXTENSIONS.contains(&ext.as_str()) {
                file_count += 1;
                let path_str = entry_path.to_string_lossy().replace('\\', "/");

                let _ = app.emit(
                    "picasa:find-photo",
                    json!({
                        "type": "found",
                        "requestId": request_id,
                        "path": path_str
                    }),
                );
            }
        }

        // 扫描完成
        let _ = app.emit(
            "picasa:find-photo",
            json!({
                "type": "complete",
                "requestId": request_id,
                "paths": [],
                "fileCount": file_count
            }),
        );

        info!("🌌 千里眼完功，共发现 {} 个文件", file_count);
    });

    Ok(())
}

// ============================================
// 导入：execute/cancel 已迁移至 import_execute.rs
// ============================================

/// 扫描目录 — 真实 walkdir 实现，返回所有媒体文件路径
#[tauri::command]
pub async fn scan_directories(paths: Vec<String>) -> Result<Vec<String>, String> {
    info!("🌌 千里眼扫目录，共 {} 个路径", paths.len());

    let mut found: Vec<String> = Vec::new();

    for base in &paths {
        for entry in WalkDir::new(base).into_iter().filter_map(|e| e.ok()) {
            let p = entry.path();
            if !p.is_file() {
                continue;
            }
            let ext = p
                .extension()
                .and_then(|e| e.to_str())
                .map(|e| e.to_lowercase())
                .unwrap_or_default();
            if PHOTO_EXTENSIONS.contains(&ext.as_str()) {
                found.push(p.to_string_lossy().replace('\\', "/"));
            }
        }
    }

    info!("🌌 千里眼扫目录完成，共 {} 个文件", found.len());
    Ok(found)
}

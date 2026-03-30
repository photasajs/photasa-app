/*!
 * ScanAdapter（千里眼 Adapter）
 *
 * 实现文件夹扫描：walkdir 递归扫描，发现文件后通过 AppHandle
 * emit "picasa:find-photo" 事件推送给前端。
 * 对应 service: "qianliyan"
 */
use async_trait::async_trait;
use serde_json::{json, Value};
use std::sync::Arc;
use tauri::Emitter;
use walkdir::WalkDir;

use zouwu_core::adapter::{Adapter, AdapterError};
use zouwu_core::types::ExecutionContext;

/// 支持的图片和视频扩展名
static PHOTO_EXTENSIONS: &[&str] = &[
    "jpg", "jpeg", "png", "gif", "bmp", "webp", "tiff", "tif",
    "heic", "heif", "avif", "raw", "cr2", "cr3", "nef", "arw",
    "mp4", "mov", "avi", "mkv", "m4v", "3gp",
];

pub struct ScanAdapter {
    app_handle: Arc<tauri::AppHandle>,
}

impl ScanAdapter {
    pub fn new(app_handle: tauri::AppHandle) -> Self {
        Self {
            app_handle: Arc::new(app_handle),
        }
    }
}

#[async_trait]
impl Adapter for ScanAdapter {
    fn name(&self) -> &str {
        "qianliyan"
    }

    fn supported_actions(&self) -> &[&str] {
        &["validatePaths", "scanPaths"]
    }

    async fn execute(
        &self,
        action: &str,
        input: Value,
        _ctx: &ExecutionContext,
    ) -> Result<Value, AdapterError> {
        match action {
            // 验证路径是否存在
            "validatePaths" => {
                let paths = extract_paths(&input)?;
                let valid_paths: Vec<String> = paths
                    .into_iter()
                    .filter(|p| std::path::Path::new(p).exists())
                    .collect();
                Ok(json!({
                    "validPaths": valid_paths,
                    "error": null,
                    "success": true
                }))
            }

            // 扫描路径，发现照片后推送事件
            "scanPaths" => {
                let paths = extract_paths(&input)?;
                let recursive = input
                    .get("recursive")
                    .and_then(|v| v.as_bool())
                    .unwrap_or(true);
                let request_id = uuid::Uuid::new_v4().to_string();
                let handle = Arc::clone(&self.app_handle);

                let paths_clone = paths.clone();
                let request_id_clone = request_id.clone();

                // 在后台任务中扫描，不阻塞工作流执行
                tokio::spawn(async move {
                    let mut file_count = 0usize;

                    for base_path in &paths_clone {
                        let walker = if recursive {
                            WalkDir::new(base_path)
                        } else {
                            WalkDir::new(base_path).max_depth(1)
                        };

                        for entry in walker.into_iter().filter_map(|e| e.ok()) {
                            let path = entry.path();
                            if !path.is_file() {
                                continue;
                            }

                            let ext = path
                                .extension()
                                .and_then(|e| e.to_str())
                                .map(|e| e.to_lowercase())
                                .unwrap_or_default();

                            if PHOTO_EXTENSIONS.contains(&ext.as_str()) {
                                file_count += 1;
                                let path_str = path.to_string_lossy().replace('\\', "/");

                                // 推送单个文件发现事件
                                let _ = handle.emit(
                                    "picasa:find-photo",
                                    json!({
                                        "type": "found",
                                        "requestId": request_id_clone,
                                        "path": path_str
                                    }),
                                );
                            }
                        }
                    }

                    // 推送完成事件
                    let _ = handle.emit(
                        "picasa:find-photo",
                        json!({
                            "type": "complete",
                            "requestId": request_id_clone,
                            "paths": [],
                            "fileCount": file_count
                        }),
                    );
                });

                Ok(json!({
                    "requestId": request_id,
                    "status": "running",
                    "fileCount": 0,
                    "success": true
                }))
            }

            _ => Err(AdapterError::UnsupportedAction(action.to_string())),
        }
    }
}

fn extract_paths(input: &Value) -> Result<Vec<String>, AdapterError> {
    input
        .get("paths")
        .and_then(|v| v.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|v| v.as_str().map(String::from))
                .collect()
        })
        .ok_or_else(|| AdapterError::InvalidInput("missing or invalid 'paths' field".to_string()))
}

//! 扫描媒体路径判定与目录遍历（Rust 实现，行为规格参考 Electron / RFC 0105）

use std::path::{Path, PathBuf};
use walkdir::WalkDir;

/// 与 Tauri ScanAdapter / legacy scan-worker 一致的扩展名表
pub static PHOTO_EXTENSIONS: &[&str] = &[
    "jpg", "jpeg", "png", "gif", "bmp", "webp", "tiff", "tif", "heic", "heif", "avif", "raw",
    "cr2", "cr3", "nef", "arw", "mp4", "mov", "avi", "mkv", "m4v", "3gp",
];

/// 统一路径分隔符为 `/`（与前端及缓存 JSON 一致）
pub fn normalize_path_string(path: &Path) -> String {
    path.to_string_lossy().replace('\\', "/")
}

fn extension_lower(path: &Path) -> String {
    path.extension()
        .and_then(|e| e.to_str())
        .map(|e| e.to_lowercase())
        .unwrap_or_default()
}

/// 是否为 Photasa 支持的媒体文件（对应 Electron `isPhotasaMediaFile`）
pub fn is_photasa_media_file(path: &Path) -> bool {
    if !path.is_file() {
        return false;
    }
    PHOTO_EXTENSIONS.contains(&extension_lower(path).as_str())
}

/// 递归收集目录下所有媒体文件的规范化绝对路径
pub fn collect_media_files(root: &Path, recursive: bool) -> Result<Vec<String>, String> {
    if !root.exists() {
        return Err(format!("Directory does not exist: {}", normalize_path_string(root)));
    }
    if !root.is_dir() {
        return Err(format!("Not a directory: {}", normalize_path_string(root)));
    }

    let walker = if recursive {
        WalkDir::new(root)
    } else {
        WalkDir::new(root).max_depth(1)
    };

    let mut files: Vec<String> = Vec::new();
    for entry in walker.into_iter().filter_map(|e| e.ok()) {
        let path = entry.path();
        if is_photasa_media_file(path) {
            files.push(normalize_path_string(path));
        }
    }
    files.sort();
    Ok(files)
}

/// 缓存文件名
pub const PHOTASA_FOLDER_CACHE_FILE: &str = ".photasa-folder.json";

pub fn folder_cache_path(folder: &Path) -> PathBuf {
    folder.join(PHOTASA_FOLDER_CACHE_FILE)
}

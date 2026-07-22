//! 扫描媒体路径判定与目录遍历（Rust 实现，行为规格参考 contract reference / RFC 0105 / 0117）

use std::fs;
use std::path::{Path, PathBuf};
use walkdir::WalkDir;

pub use photasa_media::classify_media_flags as classify_media;
use photasa_media::{basename_hidden, should_ignore_photasa_path};
use photasa_types::{PhotoFileRequest, ScanAction, ScanParamValidation};

pub const PHOTASA_ORIGINALS_DIR: &str = ".photasaoriginals";

/// 统一路径分隔符为 `/`（与前端及缓存 JSON 一致）
pub fn normalize_path_string(path: &Path) -> String {
 path.to_string_lossy().replace('\\', "/")
}

/// 是否为 Photasa 支持的媒体文件（对应 contract reference `isPhotasaMediaFile`）
pub fn is_photasa_media_file(path: &Path) -> bool {
 if !path.is_file() {
 return false;
 }
 if !path_allowed(path) {
 return false;
 }
 classify_media(path).is_some()
}

/// 递归收集目录下所有媒体文件的规范化绝对路径（遗留 discovery；RFC 0117 使用 `walkthrough_photos_in_folder`）
#[allow(dead_code)]
pub fn collect_media_files(root: &Path, recursive: bool) -> Result<Vec<String>, String> {
 if !root.exists() {
 return Err(format!(
 "Directory does not exist: {}",
 normalize_path_string(root)
 ));
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

/// contract reference `buildThumbnailPath` — 绝对路径
pub fn build_thumbnail_path(photo_path: &str) -> String {
 absolute_thumbnail_path_for_source(photo_path)
}

pub fn to_relative_thumbnail_path(photo_path: &str) -> String {
 let file_name = Path::new(photo_path)
 .file_name()
 .and_then(|n| n.to_str())
 .unwrap_or(photo_path);
 format!("{}/thumbnail-{}.png", PHOTASA_ORIGINALS_DIR, file_name)
}

pub fn absolute_thumbnail_path_for_source(source_path: &str) -> String {
 let dir = Path::new(source_path)
 .parent()
 .unwrap_or_else(|| Path::new("."));
 normalize_path_string(&dir.join(to_relative_thumbnail_path(source_path)))
}

fn path_allowed(item_path: &Path) -> bool {
 let normalized = normalize_path_string(item_path);
 !should_ignore_photasa_path(&normalized) && !basename_hidden(item_path)
}

/// `walkthroughPhotosInFolder` — 收集媒体文件列表
pub fn walkthrough_photos_in_folder(scan: &ScanAction) -> Result<Vec<PhotoFileRequest>, String> {
 let root = Path::new(&scan.path);
 if !root.exists() {
 return Err(format!("Path does not exist: {}", scan.path));
 }

 let meta = fs::metadata(root).map_err(|e| e.to_string())?;
 let is_directory = meta.is_dir();
 let is_file = meta.is_file();

 let single_file =
 scan.operation_type == "file" || (is_file && scan.operation_type != "directory");

 if single_file {
 if !path_allowed(root) {
 return Ok(Vec::new());
 }
 if let Some((is_image, is_video)) = classify_media(root) {
 return Ok(vec![PhotoFileRequest {
 path: normalize_path_string(root),
 thumbnail: build_thumbnail_path(&normalize_path_string(root)),
 is_image,
 is_video,
 is_directory: false,
 }]);
 }
 return Ok(Vec::new());
 }

 if !is_directory {
 return Err(format!("Expected directory but got file: {}", scan.path));
 }

 let walker = WalkDir::new(root).max_depth(1);

 let mut out = Vec::new();
 for entry in walker
 .into_iter()
 .filter_entry(|e| path_allowed(e.path()))
 .flatten()
 {
 let path = entry.path();
 if path == root {
 continue;
 }

 if path.is_dir() {
 out.push(PhotoFileRequest {
 path: normalize_path_string(path),
 thumbnail: String::new(),
 is_image: false,
 is_video: false,
 is_directory: true,
 });
 } else if path.is_file() {
 if let Some((is_image, is_video)) = classify_media(path) {
 out.push(PhotoFileRequest {
 path: normalize_path_string(path),
 thumbnail: build_thumbnail_path(&normalize_path_string(path)),
 is_image,
 is_video,
 is_directory: false,
 });
 }
 }
 }
 out.sort_by(|a, b| a.path.cmp(&b.path));
 Ok(out)
}

/// 列出可扫描的子目录（`scanSubdirectories` 过滤规则）
pub fn list_scan_subdirectories(folder: &Path) -> Result<Vec<PathBuf>, String> {
 if !folder.is_dir() {
 return Ok(Vec::new());
 }
 let mut subdirs = Vec::new();
 for entry in fs::read_dir(folder).map_err(|e| e.to_string())?.flatten() {
 let path = entry.path();
 if !path.is_dir() {
 continue;
 }
 let name = entry.file_name();
 let name_str = name.to_string_lossy();
 if should_ignore_photasa_path(&name_str) || basename_hidden(&path) {
 continue;
 }
 subdirs.push(path);
 }
 subdirs.sort();
 Ok(subdirs)
}

pub fn validate_scan_params(scan: &ScanAction) -> ScanParamValidation {
 if scan.path.is_empty() {
 return ScanParamValidation {
 is_valid: false,
 error: Some("扫描路径不能为空".into()),
 };
 }
 if scan.action.is_empty() {
 return ScanParamValidation {
 is_valid: false,
 error: Some("扫描动作不能为空".into()),
 };
 }
 let thumb = scan.thumbnail_size.unwrap_or(256);
 if thumb == 0 {
 return ScanParamValidation {
 is_valid: false,
 error: Some("缩略图尺寸必须大于0".into()),
 };
 }
 let path = Path::new(&scan.path);
 if !path.exists() {
 return ScanParamValidation {
 is_valid: false,
 error: Some(format!("路径不存在: {}", scan.path)),
 };
 }
 if let Ok(meta) = fs::metadata(path) {
 if scan.operation_type == "file" && !meta.is_file() {
 return ScanParamValidation {
 is_valid: false,
 error: Some(format!("期望文件但得到目录: {}", scan.path)),
 };
 }
 if scan.operation_type == "directory" && !meta.is_dir() {
 return ScanParamValidation {
 is_valid: false,
 error: Some(format!("期望目录但得到文件: {}", scan.path)),
 };
 }
 } else {
 return ScanParamValidation {
 is_valid: false,
 error: Some(format!("路径不存在或无法访问: {}", scan.path)),
 };
 }
 ScanParamValidation {
 is_valid: true,
 error: None,
 }
}

/// 相对缩略图路径（用于 restore 回退）
pub fn relative_thumbnail_path_for_source(source_path: &str) -> String {
 to_relative_thumbnail_path(source_path)
}

#[cfg(test)]
mod walkthrough_tests {
 use super::*;

 fn temp(name: &str) -> PathBuf {
 let dir =
 std::env::temp_dir().join(format!("photasa-walk-{name}-{}", uuid::Uuid::new_v4()));
 fs::create_dir_all(&dir).unwrap();
 dir
 }

 #[test]
 fn validate_scan_params_rejects_empty_path() {
 let scan = ScanAction {
 path: String::new(),
 operation_type: String::new(),
 action: "scan".into(),
 thumbnail_size: Some(256),
 is_directory: true,
 };
 assert!(!validate_scan_params(&scan).is_valid);
 }

 #[test]
 fn walkthrough_single_file() {
 let dir = temp("single");
 let file = dir.join("a.jpg");
 fs::write(&file, b"x").unwrap();
 let scan = ScanAction {
 path: file.to_string_lossy().into_owned(),
 operation_type: "file".into(),
 action: "scan".into(),
 thumbnail_size: Some(256),
 is_directory: false,
 };
 let files = walkthrough_photos_in_folder(&scan).unwrap();
 assert_eq!(files.len(), 1);
 assert!(!files[0].is_directory);
 }

 /// 文件夹扫描仅一级：产出当前层直属文件报告与直属子文件夹目录报告（RFC 0136）。
 #[test]
 fn walkthrough_scan_top_level_media_and_subdirs() {
 let root = temp("nested-full");
 fs::write(root.join("top.jpg"), b"x").unwrap();
 let sub = root.join("sub");
 fs::create_dir_all(&sub).unwrap();
 fs::write(sub.join("nested.jpg"), b"y").unwrap();

 let scan = ScanAction {
 path: root.to_string_lossy().into_owned(),
 operation_type: String::new(),
 action: "scan".into(),
 thumbnail_size: Some(256),
 is_directory: true,
 };
 let files = walkthrough_photos_in_folder(&scan).unwrap();
 assert_eq!(files.len(), 2);
 assert!(files.iter().any(|f| f.is_directory && f.path.ends_with("sub")));
 assert!(files.iter().any(|f| !f.is_directory && f.path.ends_with("top.jpg")));
 // 不包含深层嵌套文件 nested.jpg
 assert!(!files.iter().any(|f| f.path.ends_with("nested.jpg")));
 }

 /// RFC 0117 / RFC 0136：仅当前层，包含直属子目录与直属文件。
 #[test]
 fn walkthrough_current_only_top_level() {
 let root = temp("nested-current");
 fs::write(root.join("top.jpg"), b"x").unwrap();
 let sub = root.join("sub");
 fs::create_dir_all(&sub).unwrap();
 fs::write(sub.join("nested.jpg"), b"y").unwrap();

 let scan = ScanAction {
 path: root.to_string_lossy().into_owned(),
 operation_type: String::new(),
 action: "current".into(),
 thumbnail_size: Some(256),
 is_directory: true,
 };
 let files = walkthrough_photos_in_folder(&scan).unwrap();
 assert_eq!(files.len(), 2);
 assert!(files.iter().any(|f| f.is_directory && f.path.ends_with("sub")));
 assert!(files.iter().any(|f| !f.is_directory && f.path.ends_with("top.jpg")));
 }
}

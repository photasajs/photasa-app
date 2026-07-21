//! 扫描源目录并返回 `FileGroup[]`（RFC 0097 — 对齐 legacy-api `import-worker` scan_directories）

use crate::commands::extract_metadata::extract_metadata_request;
use crate::commands::import_date_util::{merge_extract_into_file_info, rfc3339_pair_from_fs_meta};
use crate::commands::import_file_groups::detect_enhanced_file_groups;
use crate::commands::import_path_filter::{
 basename_hidden, classify_media, should_ignore_photasa_path,
};
use log::{info, warn};
use serde::Deserialize;
use serde_json::{json, Value};
use std::fs;
use std::path::{Path, PathBuf};
use walkdir::WalkDir;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScanDirectoriesArgs {
 pub paths: Vec<String>,
 #[serde(default)]
 pub filters: Option<Value>,
}

fn include_subfolders(filters: &Option<Value>) -> bool {
 filters
 .as_ref()
 .and_then(|f| f.get("includeSubfolders"))
 .and_then(|v| v.as_bool())
 .unwrap_or(true)
}

fn apply_file_type_filter(
 _path: &Path,
 filters: &Option<Value>,
 is_image: bool,
 is_video: bool,
) -> bool {
 let Some(f) = filters else {
 return true;
 };
 let Some(types) = f.get("fileTypes").and_then(|v| v.as_array()) else {
 return true;
 };
 if types.is_empty() {
 return true;
 }
 let has_all = types.iter().any(|t| t.as_str() == Some("all"));
 if has_all {
 return true;
 }
 let want_image = types.iter().any(|t| t.as_str() == Some("image"));
 let want_video = types.iter().any(|t| t.as_str() == Some("video"));
 (want_image && is_image) || (want_video && is_video)
}

fn apply_size_filter(path: &Path, filters: &Option<Value>) -> bool {
 let Some(f) = filters else {
 return true;
 };
 let range = match f.get("sizeRange") {
 Some(r) => r,
 None => return true,
 };
 let min = range.get("min").and_then(|v| v.as_u64()).unwrap_or(0);
 let max = range
 .get("max")
 .and_then(|v| v.as_u64())
 .unwrap_or(u64::MAX);
 let Ok(meta) = fs::metadata(path) else {
 return false;
 };
 let size = meta.len();
 size >= min && size <= max
}

fn should_include_file(
 path: &Path,
 filters: &Option<Value>,
 is_image: bool,
 is_video: bool,
) -> bool {
 let path_str = path.to_string_lossy();
 if basename_hidden(path) || should_ignore_photasa_path(&path_str) {
 return false;
 }
 apply_file_type_filter(path, filters, is_image, is_video) && apply_size_filter(path, filters)
}

fn base_file_info_scan(
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
 "dateSource": "file_created",
 "modifiedTime": modified,
 "createdTime": created,
 "target": "",
 "targetDir": "",
 "targetFileName": "",
 "targetFullPath": "",
 })
}

fn create_file_info(path: &Path, filters: &Option<Value>) -> Option<Value> {
 let (is_image, is_video) = classify_media(path)?;
 if !should_include_file(path, filters, is_image, is_video) {
 return None;
 }
 let meta = fs::metadata(path).ok()?;
 let size = meta.len();
 let path_str = path.to_string_lossy().replace('\\', "/");
 let name = path
 .file_name()
 .and_then(|s| s.to_str())
 .unwrap_or("")
 .to_string();
 let (created, modified) = rfc3339_pair_from_fs_meta(&meta);

 let file_type_hint = if is_image { "image" } else { "video" };
 let extract_req = json!({
 "filePath": path_str,
 "fileType": file_type_hint,
 });
 let extracted = extract_metadata_request(&extract_req).unwrap_or_else(|e| {
 warn!("🌌 scan_directories extract_metadata 失败（回退文件时间） {path_str}: {e}");
 json!({})
 });

 let mut fi = base_file_info_scan(
 &path_str, &name, size, is_image, is_video, &created, &modified,
 );
 merge_extract_into_file_info(&mut fi, &extracted, &created, &modified);
 Some(fi)
}

fn scan_single_directory(dir: &Path, filters: &Option<Value>, recursive: bool) -> Vec<Value> {
 let mut files = Vec::new();
 if !dir.is_dir() {
 return files;
 }

 let mut walker = WalkDir::new(dir);
 if !recursive {
 walker = walker.max_depth(1);
 }

 for entry in walker.into_iter().filter_map(|e| e.ok()) {
 let path = entry.path();
 if path.is_dir() {
 continue;
 }
 if let Some(fi) = create_file_info(path, filters) {
 files.push(fi);
 }
 }
 files
}

/// 扫描多个源目录，返回 `FileGroup[]` JSON（camelCase）
pub fn scan_directories_for_file_groups(
 paths: &[String],
 filters: &Option<Value>,
) -> Result<Vec<Value>, String> {
 let recursive = include_subfolders(filters);
 let mut all_files: Vec<Value> = Vec::new();

 for dir_path in paths {
 let dir = PathBuf::from(dir_path);
 if !dir.exists() {
 warn!("🌌 扫描跳过（路径不存在）: {dir_path}");
 continue;
 }
 let batch = scan_single_directory(&dir, filters, recursive);
 all_files.extend(batch);
 }

 Ok(detect_enhanced_file_groups(&all_files))
}

/// Tauri 命令：扫描目录 → FileGroup[]
#[tauri::command]
pub async fn scan_directories(args: ScanDirectoriesArgs) -> Result<Vec<Value>, String> {
 info!("🌌 千里眼扫目录，共 {} 个路径", args.paths.len());
 let groups = scan_directories_for_file_groups(&args.paths, &args.filters)?;
 info!("🌌 千里眼扫目录完成，共 {} 个文件组", groups.len());
 Ok(groups)
}

#[cfg(test)]
mod tests {
 use super::*;
 use std::io::Write;

 fn write_temp_file(dir: &Path, name: &str, content: &[u8]) -> PathBuf {
 let p = dir.join(name);
 let mut f = std::fs::File::create(&p).unwrap();
 f.write_all(content).unwrap();
 p
 }

 #[test]
 fn include_subfolders_defaults_true() {
 assert!(include_subfolders(&None));
 }

 #[test]
 fn apply_file_type_filter_image_only() {
 let filters = Some(json!({ "fileTypes": ["image"] }));
 let p = Path::new("/x/a.jpg");
 assert!(apply_file_type_filter(p, &filters, true, false));
 assert!(!apply_file_type_filter(p, &filters, false, true));
 }

 #[test]
 fn scan_returns_file_groups_not_flat_paths() {
 let dir = std::env::temp_dir().join(format!("photasa-scan-dir-{}", uuid::Uuid::new_v4()));
 std::fs::create_dir_all(&dir).unwrap();
 write_temp_file(&dir, "photo.jpg", b"\xff\xd8\xff");
 write_temp_file(&dir, "photo.xmp", b"<x/>");

 let groups =
 scan_directories_for_file_groups(&[dir.to_string_lossy().into_owned()], &None).unwrap();
 assert!(!groups.is_empty());
 assert!(groups[0].get("mainFile").is_some());
 assert!(groups[0].get("files").is_some());

 let _ = std::fs::remove_dir_all(dir);
 }
}

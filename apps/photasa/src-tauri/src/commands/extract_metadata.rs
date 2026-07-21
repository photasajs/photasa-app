//! 单文件元数据（对齐 `@photasa/common` 的 `FileMetadata` / `extractMetadata` IPC）

use super::extract_metadata_exif::enrich_from_exif;
use super::extract_metadata_video::enrich_from_ffprobe;
use crate::commands::import_path_filter::classify_media;
use chrono::{DateTime, Utc};
use md5::{Digest, Md5};
use serde::Deserialize;
use serde_json::{json, Value};
use std::fs::File;
use std::io::Read;
use std::path::Path;

fn system_time_to_rfc3339(st: std::time::SystemTime) -> String {
 let dt: DateTime<Utc> = st.into();
 dt.to_rfc3339()
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExtractMetadataArgs {
 pub request: Value,
}

/// 与 `#[tauri::command] extract_metadata` 相同逻辑，供 `preview_import` 等内部路径复用（1:1 contract reference `extractMetadata`）
pub(crate) fn extract_metadata_request(request: &Value) -> Result<Value, String> {
 let file_path = request
 .get("filePath")
 .and_then(|v| v.as_str())
 .ok_or_else(|| "缺少 filePath".to_string())?
 .to_string();

 let path_ref = Path::new(&file_path);
 let name = path_ref
 .file_name()
 .and_then(|s| s.to_str())
 .unwrap_or("")
 .to_string();

 let meta = std::fs::metadata(&file_path).map_err(|e| e.to_string())?;

 let modified_st = meta.modified().map_err(|e| e.to_string())?;
 let created_st = meta.created().unwrap_or(modified_st);

 let modified_rfc = system_time_to_rfc3339(modified_st);
 let created_rfc = system_time_to_rfc3339(created_st);

 let (is_image, is_video) = classify_media(path_ref).unwrap_or((false, false));
 let type_hint = request.get("fileType").and_then(|v| v.as_str());
 let file_type = if type_hint == Some("image") {
 "image"
 } else if type_hint == Some("video") {
 "video"
 } else if type_hint == Some("ai") {
 "other"
 } else if is_image {
 "image"
 } else if is_video {
 "video"
 } else {
 "other"
 };

 let ext = path_ref
 .extension()
 .and_then(|e| e.to_str())
 .map(|e| e.to_lowercase())
 .unwrap_or_default();

 let mut out = json!({
 "path": file_path,
 "name": name,
 "size": meta.len(),
 "type": file_type,
 "modifiedTime": modified_rfc,
 "createdTime": created_rfc,
 "dateSource": "file_modified",
 "format": ext,
 });

 if file_type == "image" {
 if let Ok((w, h)) = image::image_dimensions(path_ref) {
 if let Some(m) = out.as_object_mut() {
 m.insert("width".to_string(), json!(w));
 m.insert("height".to_string(), json!(h));
 }
 }
 // JPEG/TIFF/HEIF/PNG/WebP 等：由 `kamadak-exif` 读容器内 EXIF（无则静默跳过）
 enrich_from_exif(path_ref, &mut out);
 }

 if file_type == "video" {
 enrich_from_ffprobe(path_ref, &mut out);
 }

 if request
 .get("computeMd5")
 .and_then(|v| v.as_bool())
 .unwrap_or(false)
 {
 if let Ok(hex) = md5_hex_file(path_ref) {
 if let Some(m) = out.as_object_mut() {
 match m.get_mut("rawMetadata") {
 Some(Value::Object(rm)) => {
 rm.insert("md5".to_string(), Value::String(hex));
 }
 _ => {
 m.insert("rawMetadata".to_string(), json!({ "md5": hex }));
 }
 }
 }
 }
 }

 Ok(out)
}

/// 从本地文件构造 `FileMetadata` 形状 JSON（时间字段为 RFC3339 字符串，供前端 `new Date()`）
#[tauri::command]
pub fn extract_metadata(args: ExtractMetadataArgs) -> Result<Value, String> {
 extract_metadata_request(&args.request)
}

fn md5_hex_file(path: &Path) -> Result<String, std::io::Error> {
 let mut file = File::open(path)?;
 let mut hasher = Md5::new();
 let mut buf = [0u8; 8192];
 loop {
 let n = file.read(&mut buf)?;
 if n == 0 {
 break;
 }
 hasher.update(&buf[..n]);
 }
 Ok(format!("{:x}", hasher.finalize()))
}

#[cfg(test)]
mod tests {
 use super::*;
 use uuid::Uuid;

 #[test]
 fn extract_metadata_errors_on_missing_file() {
 assert!(extract_metadata_request(&json!({
 "filePath": "/nonexistent/photasa_extract_metadata_test_path"
 }))
 .is_err());
 }

 #[test]
 fn extract_metadata_includes_md5_when_requested() {
 let dir = std::env::temp_dir();
 let path = dir.join("photasa_extract_md5_test.txt");
 std::fs::write(&path, b"hello").unwrap();
 let v = extract_metadata_request(&json!({
 "filePath": path.to_string_lossy(),
 "computeMd5": true
 }))
 .unwrap();
 let rm = v
 .get("rawMetadata")
 .and_then(|x| x.as_object())
 .expect("rawMetadata");
 assert_eq!(
 rm.get("md5").and_then(|x| x.as_str()),
 Some("5d41402abc4b2a76b9719d911017c592")
 );
 let _ = std::fs::remove_file(&path);
 }

 /// RFC 0097：`classify_media` 非媒体扩展名 → `type: other`（与 `@photasa/import` 回落为 other 一致）
 #[test]
 fn extract_metadata_plain_txt_is_other() {
 let path = std::env::temp_dir().join(format!("photasa-meta-txt-{}.txt", Uuid::new_v4()));
 std::fs::write(&path, b"hello").unwrap();
 let v = extract_metadata_request(&json!({ "filePath": path.to_string_lossy() })).unwrap();
 assert_eq!(v.get("type").and_then(|x| x.as_str()), Some("other"));
 assert_eq!(v.get("format").and_then(|x| x.as_str()), Some("txt"));
 assert_eq!(
 v.get("path").and_then(|x| x.as_str()),
 Some(path.to_string_lossy().as_ref())
 );
 let _ = std::fs::remove_file(&path);
 }

 /// 最小 JPEG：无 EXIF，仍应判为 image（与 reference implementation按扩展名 + 图型分支一致）
 #[test]
 fn extract_metadata_minimal_jpeg_is_image() {
 let path = std::env::temp_dir().join(format!("photasa-meta-jpg-{}.jpg", Uuid::new_v4()));
 std::fs::write(&path, [0xff, 0xd8, 0xff, 0xd9]).unwrap();
 let v = extract_metadata_request(&json!({ "filePath": path.to_string_lossy() })).unwrap();
 assert_eq!(v.get("type").and_then(|x| x.as_str()), Some("image"));
 assert_eq!(v.get("format").and_then(|x| x.as_str()), Some("jpg"));
 let _ = std::fs::remove_file(&path);
 }

 /// 请求体 `fileType: image` 应覆盖无扩展名/错误扩展名的路由（对齐 MetadataRequest.fileType）
 #[test]
 fn extract_metadata_file_type_hint_image_overrides_unknown_ext() {
 let path = std::env::temp_dir().join(format!("photasa-meta-hint-{}.bin", Uuid::new_v4()));
 std::fs::write(&path, [0xff, 0xd8, 0xff, 0xd9]).unwrap();
 let v = extract_metadata_request(&json!({
 "filePath": path.to_string_lossy(),
 "fileType": "image"
 }))
 .unwrap();
 assert_eq!(v.get("type").and_then(|x| x.as_str()), Some("image"));
 let _ = std::fs::remove_file(&path);
 }
}

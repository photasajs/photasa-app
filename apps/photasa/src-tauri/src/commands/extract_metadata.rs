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

/// 从本地文件构造 `FileMetadata` 形状 JSON（时间字段为 RFC3339 字符串，供前端 `new Date()`）
#[tauri::command]
pub fn extract_metadata(args: ExtractMetadataArgs) -> Result<Value, String> {
    let request = &args.request;
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
            out.as_object_mut().map(|m| {
                m.insert("width".to_string(), json!(w));
                m.insert("height".to_string(), json!(h));
            });
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
            match out.as_object_mut() {
                Some(m) => match m.get_mut("rawMetadata") {
                    Some(Value::Object(rm)) => {
                        rm.insert("md5".to_string(), Value::String(hex));
                    }
                    _ => {
                        m.insert(
                            "rawMetadata".to_string(),
                            json!({ "md5": hex }),
                        );
                    }
                },
                None => {}
            }
        }
    }

    Ok(out)
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

    #[test]
    fn extract_metadata_errors_on_missing_file() {
        let args = ExtractMetadataArgs {
            request: json!({ "filePath": "/nonexistent/photasa_extract_metadata_test_path" }),
        };
        assert!(extract_metadata(args).is_err());
    }

    #[test]
    fn extract_metadata_includes_md5_when_requested() {
        let dir = std::env::temp_dir();
        let path = dir.join("photasa_extract_md5_test.txt");
        std::fs::write(&path, b"hello").unwrap();
        let args = ExtractMetadataArgs {
            request: json!({
                "filePath": path.to_string_lossy(),
                "computeMd5": true
            }),
        };
        let v = extract_metadata(args).unwrap();
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
}

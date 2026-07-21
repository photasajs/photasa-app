//! 导入日期子路径 — 算法在 `photasa-import`；本文件提供 Tauri 侧元数据提取适配
use photasa_import::date::MetadataExtractor;
use photasa_import::path_filter::classify_media;
use serde_json::{json, Value};
use std::path::Path;

pub use photasa_import::date::{
    date_subpath_for_import_source, determine_group_target_utc, generate_date_path_utc,
    merge_extract_into_file_info, rfc3339_pair_from_fs_meta,
};

use crate::commands::extract_metadata::extract_metadata_request;

/// 宿主实现：走本进程 `extract_metadata_request`（含 HEIC/FFmpeg）
pub struct PhotasaMetadataExtractor;

impl MetadataExtractor for PhotasaMetadataExtractor {
    fn extract_json(&self, path: &Path) -> Value {
        let path_str = path.to_string_lossy().replace('\\', "/");
        let (is_image, is_video) = classify_media(path).unwrap_or((false, false));
        let file_type_hint = if is_image {
            "image"
        } else if is_video {
            "video"
        } else {
            "other"
        };
        let extract_req = json!({
            "filePath": path_str,
            "fileType": file_type_hint,
        });
        extract_metadata_request(&extract_req).unwrap_or_else(|_| json!({}))
    }
}

/// 兼容旧调用：默认用 Photasa 元数据提取器
#[allow(dead_code)]
pub(crate) fn date_subpath_for_import_source_default(src: &Path) -> String {
    date_subpath_for_import_source(src, &PhotasaMetadataExtractor)
}

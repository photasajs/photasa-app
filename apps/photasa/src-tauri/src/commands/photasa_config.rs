/*!
 * `.photasa.json` 读写 — 与 Electron / `@photasa/config-core` 契约对齐
 *
 * `photoList` 元素为 `{ path, thumbnail, isVideo, history? }`，`path` 为文件名（非绝对路径）。
 */
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::HashSet;
use std::path::{Path, PathBuf};

use super::path::{is_video_file, to_file_name};

pub const PHOTASA_ORIGINALS_DIR: &str = ".photasaoriginals";
pub const PHOTASA_CONFIG_FILE: &str = ".photasa.json";
const DEFAULT_VERSION: &str = "1.0";

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct PhotoEntry {
    pub path: String,
    pub thumbnail: String,
    pub is_video: bool,
    #[serde(default)]
    pub history: Vec<Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct PhotasaConfigData {
    #[serde(default = "default_version")]
    pub version: String,
    #[serde(default)]
    pub photo_list: Vec<PhotoEntry>,
    #[serde(default)]
    pub last_modified: i64,
}

fn default_version() -> String {
    DEFAULT_VERSION.to_string()
}

impl PhotasaConfigData {
    pub fn empty() -> Self {
        Self {
            version: DEFAULT_VERSION.to_string(),
            photo_list: Vec::new(),
            last_modified: 0,
        }
    }
}

pub fn config_path_for_folder(folder: &str) -> PathBuf {
    Path::new(folder).join(PHOTASA_CONFIG_FILE)
}

/// 缩略图相对路径：`.photasaoriginals/thumbnail-{fileName}.png`
pub fn to_relative_thumbnail_path(photo_path: &str) -> String {
    let file_name = to_file_name(photo_path.to_string());
    format!(
        "{}/{}{}.png",
        PHOTASA_ORIGINALS_DIR,
        "thumbnail-",
        file_name
    )
}

fn now_millis() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

fn normalize_photo_file_name(path_or_name: &str) -> String {
    let name = Path::new(path_or_name)
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or(path_or_name);
    name.replace('\\', "/")
}

/// 解析 `photoList` 数组：兼容 Electron 对象项与历史 Rust 字符串项
pub fn parse_photo_list(value: Option<&Value>) -> Vec<PhotoEntry> {
    let Some(array) = value.and_then(|v| v.as_array()) else {
        return Vec::new();
    };

    let mut photos = Vec::new();
    let mut seen = HashSet::new();

    for item in array {
        let entry = if let Some(text) = item.as_str() {
            let file_name = normalize_photo_file_name(text);
            PhotoEntry {
                path: file_name.clone(),
                thumbnail: to_relative_thumbnail_path(&file_name),
                is_video: is_video_file(file_name.clone()),
                history: Vec::new(),
            }
        } else if let Ok(mut photo) = serde_json::from_value::<PhotoEntry>(item.clone()) {
            photo.path = normalize_photo_file_name(&photo.path);
            if photo.thumbnail.is_empty() {
                photo.thumbnail = to_relative_thumbnail_path(&photo.path);
            }
            photo
        } else {
            continue;
        };

        if seen.insert(entry.path.clone()) {
            photos.push(entry);
        }
    }

    photos
}

pub fn config_to_json_value(config: &PhotasaConfigData) -> Value {
    json!({
        "version": config.version,
        "photoList": config.photo_list,
        "lastModified": config.last_modified,
    })
}

pub fn parse_config_value(value: &Value) -> PhotasaConfigData {
    PhotasaConfigData {
        version: value
            .get("version")
            .and_then(|v| v.as_str())
            .unwrap_or(DEFAULT_VERSION)
            .to_string(),
        photo_list: parse_photo_list(value.get("photoList").or_else(|| value.get("photo_list"))),
        last_modified: value
            .get("lastModified")
            .or_else(|| value.get("last_modified"))
            .and_then(|v| v.as_i64())
            .unwrap_or(0),
    }
}

pub fn read_config_sync(folder: &str) -> Result<Option<PhotasaConfigData>, String> {
    let path = config_path_for_folder(folder);
    if !path.exists() {
        return Ok(None);
    }
    let content =
        std::fs::read_to_string(&path).map_err(|e| format!("读取配置失败: {e}"))?;
    let value: Value =
        serde_json::from_str(&content).map_err(|e| format!("解析 JSON 失败: {e}"))?;
    Ok(Some(parse_config_value(&value)))
}

pub fn write_config_sync(folder: &str, config: &PhotasaConfigData) -> Result<(), String> {
    let path = config_path_for_folder(folder);
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| format!("创建目录失败: {e}"))?;
    }
    let content = serde_json::to_string_pretty(&config_to_json_value(config))
        .map_err(|e| format!("序列化失败: {e}"))?;
    std::fs::write(&path, content).map_err(|e| format!("写入配置失败: {e}"))?;
    Ok(())
}

/// 源图绝对路径 → 缩略图绝对路径
pub fn absolute_thumbnail_path_for_source(source_path: &str) -> String {
    let dir = Path::new(source_path)
        .parent()
        .unwrap_or_else(|| Path::new("."));
    dir.join(to_relative_thumbnail_path(source_path))
        .to_string_lossy()
        .replace('\\', "/")
}

/// 将一张照片加入文件夹 `.photasa.json`（幂等）
pub fn add_photo_to_folder_list(folder: &str, photo_path: &str) -> Result<PhotasaConfigData, String> {
    let mut config = read_config_sync(folder)?.unwrap_or_else(PhotasaConfigData::empty);
    let file_name = normalize_photo_file_name(photo_path);

    if config.photo_list.iter().any(|p| p.path == file_name) {
        return Ok(config);
    }

    config.photo_list.push(PhotoEntry {
        path: file_name.clone(),
        thumbnail: to_relative_thumbnail_path(photo_path),
        is_video: is_video_file(photo_path.to_string()),
        history: Vec::new(),
    });
    config.last_modified = now_millis();
    write_config_sync(folder, &config)?;
    Ok(config)
}

/// 去重并规范化 `photoList`
pub fn fix_config_sync(folder: &str) -> Result<PhotasaConfigData, String> {
    let Some(mut config) = read_config_sync(folder)? else {
        return Ok(PhotasaConfigData::empty());
    };
    config.photo_list = parse_photo_list(Some(&json!(config.photo_list)));
    config.last_modified = now_millis();
    write_config_sync(folder, &config)?;
    Ok(config)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_photo_list_accepts_electron_objects() {
        let raw = json!([
            {
                "path": "a.jpg",
                "thumbnail": ".photasaoriginals/thumbnail-a.jpg.png",
                "isVideo": false
            }
        ]);
        let list = parse_photo_list(Some(&raw));
        assert_eq!(list.len(), 1);
        assert_eq!(list[0].path, "a.jpg");
    }

    #[test]
    fn parse_photo_list_migrates_legacy_strings() {
        let raw = json!(["/album/b.jpg", "/album/c.mp4"]);
        let list = parse_photo_list(Some(&raw));
        assert_eq!(list.len(), 2);
        assert_eq!(list[0].path, "b.jpg");
        assert!(list[1].is_video);
    }

    #[test]
    fn thumbnail_path_matches_electron_contract() {
        assert_eq!(
            to_relative_thumbnail_path("/tmp/photos/vacation.jpg"),
            ".photasaoriginals/thumbnail-vacation.jpg.png"
        );
    }
}

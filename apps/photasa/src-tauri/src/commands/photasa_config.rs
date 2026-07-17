/*!
 * `.photasa.json` 读写 — 与 Electron / `@photasa/config-core` 契约对齐
 *
 * `photoList` 元素为 `{ path, thumbnail, isVideo, history? }`，`path` 为文件名（非绝对路径）。
 *
 * 行为必须与 `config-storage.ts` 一致：
 * - `readConfig`：原样读取（不做静默迁移）
 * - `addToPhotoList`：新条目用 `toRelativeThumbnailPath`；已有且 `thumbnail` 非空则跳过
 * - `fixPhotasaConfig`：`path` → basename；`thumbnail` → `shortenThumbnailName`
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

/// 缩略图相对路径：`.photasaoriginals/thumbnail-{fileName}.png`（Electron `toRelativeThumbnailPath`）
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

/// Electron `shortenThumbnailName`: `.photasaoriginals/` + basename
pub fn shorten_thumbnail_relative_path(thumbnail: &str) -> String {
    let base = Path::new(thumbnail)
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or(thumbnail);
    format!("{}/{}", PHOTASA_ORIGINALS_DIR, base.replace('\\', "/"))
}

/// 解析 `photoList`：对象项保留磁盘上的 `thumbnail`；仅 legacy 字符串项迁移为对象
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

/// 读取 `.photasa.json`（Electron `readConfig`：不静默改写磁盘）
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

/// Electron `addToPhotoList`
/// 从 photoList 移除照片并写回（Electron `removeFromPhotoList`）
pub fn remove_photo_from_folder_list(folder: &str, photo_path: &str) -> Result<PhotasaConfigData, String> {
    let mut config = read_config_sync(folder)?.unwrap_or_else(PhotasaConfigData::empty);
    let file_name = normalize_photo_file_name(photo_path);
    config.photo_list.retain(|p| p.path != file_name);
    config.last_modified = now_millis();
    write_config_sync(folder, &config)?;
    Ok(config)
}

pub fn add_photo_to_folder_list(folder: &str, photo_path: &str) -> Result<PhotasaConfigData, String> {
    let mut config = read_config_sync(folder)?.unwrap_or_else(PhotasaConfigData::empty);
    let file_name = normalize_photo_file_name(photo_path);
    let thumbnail_name = to_relative_thumbnail_path(photo_path);

    if let Some(existing) = config.photo_list.iter_mut().find(|p| p.path == file_name) {
        if existing.thumbnail.is_empty() {
            existing.thumbnail = thumbnail_name;
            config.last_modified = now_millis();
            write_config_sync(folder, &config)?;
        }
        return Ok(config);
    }

    config.photo_list.push(PhotoEntry {
        path: file_name.clone(),
        thumbnail: thumbnail_name,
        is_video: is_video_file(photo_path.to_string()),
        history: Vec::new(),
    });
    config.last_modified = now_millis();
    write_config_sync(folder, &config)?;
    Ok(config)
}

/// Electron `fixPhotasaConfig`
pub fn fix_config_sync(folder: &str) -> Result<PhotasaConfigData, String> {
    let Some(mut config) = read_config_sync(folder)? else {
        return Ok(PhotasaConfigData::empty());
    };
    for photo in &mut config.photo_list {
        photo.path = normalize_photo_file_name(&photo.path);
        photo.thumbnail = shorten_thumbnail_relative_path(&photo.thumbnail);
    }
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
        assert_eq!(list[0].thumbnail, ".photasaoriginals/thumbnail-a.jpg.png");
    }

    #[test]
    fn parse_photo_list_preserves_stored_thumbnail_on_read() {
        let raw = json!([{
            "path": "20250101_195246097_iOS.heic",
            "thumbnail": ".photasaoriginals/.photasaoriginals/20250101_195246097_iOS.heic.png",
            "isVideo": false
        }]);
        let list = parse_photo_list(Some(&raw));
        assert_eq!(
            list[0].thumbnail,
            ".photasaoriginals/.photasaoriginals/20250101_195246097_iOS.heic.png"
        );
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
    fn shorten_thumbnail_relative_path_matches_electron() {
        assert_eq!(
            shorten_thumbnail_relative_path(
                "/album/.photasaoriginals/thumbnail-vacation.jpg.png"
            ),
            ".photasaoriginals/thumbnail-vacation.jpg.png"
        );
    }

    #[test]
    fn read_config_sync_does_not_rewrite_disk() {
        let dir = std::env::temp_dir().join(format!(
            "photasa-read-config-{}",
            uuid::Uuid::new_v4()
        ));
        std::fs::create_dir_all(&dir).unwrap();
        let folder = dir.to_string_lossy().replace('\\', "/");
        let raw = json!({
            "version": "1.0",
            "photoList": [{
                "path": "20250101_195246097_iOS.heic",
                "thumbnail": ".photasaoriginals/.photasaoriginals/20250101_195246097_iOS.heic.png",
                "isVideo": false
            }],
            "lastModified": 0
        });
        let raw_str = serde_json::to_string_pretty(&raw).unwrap();
        std::fs::write(dir.join(PHOTASA_CONFIG_FILE), &raw_str).unwrap();

        let _loaded = read_config_sync(&folder).unwrap().expect("config");
        let on_disk = std::fs::read_to_string(dir.join(PHOTASA_CONFIG_FILE)).unwrap();
        assert_eq!(on_disk, raw_str);

        let _ = std::fs::remove_dir_all(dir);
    }

    #[test]
    fn fix_config_sync_matches_electron_shorten_only() {
        let dir = std::env::temp_dir().join(format!(
            "photasa-fix-config-{}",
            uuid::Uuid::new_v4()
        ));
        std::fs::create_dir_all(&dir).unwrap();
        let folder = dir.to_string_lossy().replace('\\', "/");
        let raw = json!({
            "version": "1.0",
            "photoList": [{
                "path": "holiday.heic",
                "thumbnail": ".photasaoriginals/.photasaoriginals/holiday.heic.png",
                "isVideo": false
            }],
            "lastModified": 0
        });
        std::fs::write(
            dir.join(PHOTASA_CONFIG_FILE),
            serde_json::to_string_pretty(&raw).unwrap(),
        )
        .unwrap();

        let fixed = fix_config_sync(&folder).unwrap();
        assert_eq!(
            fixed.photo_list[0].thumbnail,
            ".photasaoriginals/holiday.heic.png"
        );

        let _ = std::fs::remove_dir_all(dir);
    }

    #[test]
    fn add_photo_skips_when_thumbnail_already_set() {
        let dir = std::env::temp_dir().join(format!(
            "photasa-add-photo-{}",
            uuid::Uuid::new_v4()
        ));
        std::fs::create_dir_all(&dir).unwrap();
        let folder = dir.to_string_lossy().replace('\\', "/");
        let photo_path = format!("{folder}/holiday.heic");
        std::fs::write(&photo_path, b"x").unwrap();

        let legacy_thumb = ".photasaoriginals/.photasaoriginals/holiday.heic.png";
        let raw = json!({
            "version": "1.0",
            "photoList": [{
                "path": "holiday.heic",
                "thumbnail": legacy_thumb,
                "isVideo": false
            }],
            "lastModified": 0
        });
        std::fs::write(
            dir.join(PHOTASA_CONFIG_FILE),
            serde_json::to_string_pretty(&raw).unwrap(),
        )
        .unwrap();

        let updated = add_photo_to_folder_list(&folder, &photo_path).unwrap();
        assert_eq!(updated.photo_list[0].thumbnail, legacy_thumb);

        let _ = std::fs::remove_dir_all(dir);
    }

    #[test]
    fn add_photo_writes_canonical_thumbnail_for_new_entry() {
        let dir = std::env::temp_dir().join(format!(
            "photasa-add-photo-new-{}",
            uuid::Uuid::new_v4()
        ));
        std::fs::create_dir_all(&dir).unwrap();
        let folder = dir.to_string_lossy().replace('\\', "/");
        let photo_path = format!("{folder}/holiday.heic");
        std::fs::write(&photo_path, b"x").unwrap();

        let updated = add_photo_to_folder_list(&folder, &photo_path).unwrap();
        assert_eq!(
            updated.photo_list[0].thumbnail,
            ".photasaoriginals/thumbnail-holiday.heic.png"
        );

        let _ = std::fs::remove_dir_all(dir);
    }

    #[test]
    fn thumbnail_path_matches_electron_contract() {
        assert_eq!(
            to_relative_thumbnail_path("/tmp/photos/vacation.jpg"),
            ".photasaoriginals/thumbnail-vacation.jpg.png"
        );
    }
}

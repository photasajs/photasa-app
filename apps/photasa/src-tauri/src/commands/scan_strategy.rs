//! 扫描策略决策（Electron `@photasa/scan` / `scan-strategy.ts` 契约）

use std::fs;
use std::path::Path;

use sha2::{Digest, Sha256};

use super::import_path_filter::classify_media;
use super::photasa_config::{self, PHOTASA_CONFIG_FILE};

/// 扫描策略：仅 SKIP / FULL（Electron 无 live INCREMENTAL）
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ScanStrategy {
    Skip,
    Full,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ScanDecision {
    pub strategy: ScanStrategy,
    pub reason: String,
}

/// `shouldScanOneLevel(action) = (action == "current")`
pub fn should_scan_one_level(action: &str) -> bool {
    action == "current"
}

/// 目录顶层媒体文件指纹；无媒体时返回空字符串（与 RFC 0117 测试表一致）
pub fn compute_folder_hash(folder: &Path) -> String {
    if !folder.is_dir() {
        return String::new();
    }

    let mut files: Vec<(String, u64, u128)> = Vec::new();

    let entries = match fs::read_dir(folder) {
        Ok(e) => e,
        Err(_) => return String::new(),
    };

    for entry in entries.flatten() {
        let path = entry.path();
        if !path.is_file() {
            continue;
        }
        if classify_media(&path).is_none() {
            continue;
        }
        let name = path
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("")
            .to_string();
        let meta = match fs::metadata(&path) {
            Ok(m) => m,
            Err(_) => continue,
        };
        let size = meta.len();
        let mtime_ms = meta
            .modified()
            .ok()
            .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
            .map(|d| d.as_millis())
            .unwrap_or(0);
        files.push((name, size, mtime_ms));
    }

    if files.is_empty() {
        return String::new();
    }

    files.sort_by(|a, b| a.0.to_lowercase().cmp(&b.0.to_lowercase()));

    let hash_content: String = files
        .iter()
        .map(|(name, size, mtime)| format!("{name}:{size}:{mtime}"))
        .collect::<Vec<_>>()
        .join("|");

    let digest = Sha256::digest(hash_content.as_bytes());
    format!("{digest:x}")
}

/// 判断单个文件是否需要处理（读 `.photasa.json` photoList）
pub fn should_process_file(file_path: &str, action: &str) -> bool {
    if action == "rescan" {
        return true;
    }

    let path = Path::new(file_path);
    let Some(dir) = path.parent().and_then(|p| p.to_str()) else {
        return true;
    };

    let config_path = Path::new(dir).join(PHOTASA_CONFIG_FILE);
    if !config_path.exists() {
        return true;
    }

    match photasa_config::read_config_sync(dir) {
        Ok(Some(config)) => {
            let file_name = path
                .file_name()
                .and_then(|n| n.to_str())
                .unwrap_or(file_path)
                .replace('\\', "/");
            !config
                .photo_list
                .iter()
                .any(|p| p.path == file_name)
        }
        Ok(None) => true,
        Err(_) => true,
    }
}

/// `decideScanStrategy` — SKIP / FULL only
pub fn decide_scan_strategy(folder: &str, action: &str) -> ScanDecision {
    if action == "rescan" {
        return ScanDecision {
            strategy: ScanStrategy::Full,
            reason: "强制重新扫描".into(),
        };
    }

    let folder_path = Path::new(folder);
    let config_path = folder_path.join(PHOTASA_CONFIG_FILE);

    if !config_path.exists() {
        return ScanDecision {
            strategy: ScanStrategy::Full,
            reason: "配置文件不存在".into(),
        };
    }

    match photasa_config::read_config_sync(folder) {
        Ok(Some(config)) => {
            if config.photo_list.is_empty() {
                let hash = compute_folder_hash(folder_path);
                if !hash.is_empty() {
                    ScanDecision {
                        strategy: ScanStrategy::Full,
                        reason: "配置文件为空但文件夹有照片".into(),
                    }
                } else {
                    ScanDecision {
                        strategy: ScanStrategy::Skip,
                        reason: "配置文件为空且文件夹无照片".into(),
                    }
                }
            } else {
                ScanDecision {
                    strategy: ScanStrategy::Skip,
                    reason: "配置文件存在且有效，无需重新扫描".into(),
                }
            }
        }
        Ok(None) => ScanDecision {
            strategy: ScanStrategy::Full,
            reason: "配置文件不存在".into(),
        },
        Err(_) => ScanDecision {
            strategy: ScanStrategy::Full,
            reason: "配置文件读取失败".into(),
        },
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;

    fn temp_dir(name: &str) -> std::path::PathBuf {
        let dir = std::env::temp_dir().join(format!("photasa-scan-strategy-{name}-{}", uuid::Uuid::new_v4()));
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn should_scan_one_level_current_only() {
        assert!(should_scan_one_level("current"));
        assert!(!should_scan_one_level("scan"));
        assert!(!should_scan_one_level("rescan"));
    }

    #[test]
    fn should_process_file_rescan_always() {
        assert!(should_process_file("/any/path.jpg", "rescan"));
    }

    #[test]
    fn decide_rescan_is_full() {
        let d = decide_scan_strategy("/tmp", "rescan");
        assert_eq!(d.strategy, ScanStrategy::Full);
    }

    #[test]
    fn decide_missing_config_is_full() {
        let dir = temp_dir("missing-config");
        let d = decide_scan_strategy(dir.to_str().unwrap(), "scan");
        assert_eq!(d.strategy, ScanStrategy::Full);
    }

    #[test]
    fn decide_valid_config_is_skip() {
        let dir = temp_dir("valid-config");
        let photo = dir.join("a.jpg");
        fs::File::create(&photo).unwrap();
        let config = serde_json::json!({
            "version": "1.0",
            "photoList": [{ "path": "a.jpg", "thumbnail": ".photasaoriginals/thumbnail-a.jpg.png", "isVideo": false }],
            "lastModified": 0
        });
        fs::write(dir.join(PHOTASA_CONFIG_FILE), serde_json::to_string(&config).unwrap()).unwrap();
        let d = decide_scan_strategy(dir.to_str().unwrap(), "scan");
        assert_eq!(d.strategy, ScanStrategy::Skip);
    }

    #[test]
    fn decide_empty_config_no_media_is_skip() {
        let dir = temp_dir("empty-no-media");
        fs::write(dir.join(PHOTASA_CONFIG_FILE), r#"{"version":"1.0","photoList":[],"lastModified":0}"#)
            .unwrap();
        let d = decide_scan_strategy(dir.to_str().unwrap(), "scan");
        assert_eq!(d.strategy, ScanStrategy::Skip);
    }

    #[test]
    fn decide_empty_config_with_media_is_full() {
        let dir = temp_dir("empty-with-media");
        fs::write(dir.join(PHOTASA_CONFIG_FILE), r#"{"version":"1.0","photoList":[],"lastModified":0}"#)
            .unwrap();
        fs::File::create(dir.join("pic.jpg")).unwrap();
        let d = decide_scan_strategy(dir.to_str().unwrap(), "scan");
        assert_eq!(d.strategy, ScanStrategy::Full);
    }

    #[test]
    fn compute_folder_hash_empty_without_media() {
        let dir = temp_dir("hash-empty");
        assert_eq!(compute_folder_hash(&dir), "");
    }

    #[test]
    fn compute_folder_hash_deterministic_with_media() {
        let dir = temp_dir("hash-media");
        let mut f = fs::File::create(dir.join("b.jpg")).unwrap();
        f.write_all(b"x").unwrap();
        drop(f);
        let mut g = fs::File::create(dir.join("a.jpg")).unwrap();
        g.write_all(b"y").unwrap();
        drop(g);
        let h1 = compute_folder_hash(&dir);
        let h2 = compute_folder_hash(&dir);
        assert!(!h1.is_empty());
        assert_eq!(h1, h2);
    }

    #[test]
    fn should_process_file_in_list_is_false() {
        let dir = temp_dir("in-list");
        let photo = dir.join("x.jpg");
        fs::File::create(&photo).unwrap();
        let config = serde_json::json!({
            "version": "1.0",
            "photoList": [{ "path": "x.jpg", "thumbnail": ".photasaoriginals/thumbnail-x.jpg.png", "isVideo": false }],
            "lastModified": 0
        });
        fs::write(dir.join(PHOTASA_CONFIG_FILE), serde_json::to_string(&config).unwrap()).unwrap();
        assert!(!should_process_file(photo.to_str().unwrap(), "scan"));
    }
}

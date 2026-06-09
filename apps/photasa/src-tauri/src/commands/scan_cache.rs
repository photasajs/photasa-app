//! `.photasa-folder.json` 增量扫描缓存（RFC 0105 — Rust 重写，磁盘格式与 Electron 契约兼容）

use std::fs;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};

use super::scan_media::{folder_cache_path, normalize_path_string};

fn now_millis() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

/// 与 Electron `IncrementalCache` / `FolderCache` 兼容的 JSON 结构
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct FolderScanCache {
    pub version: String,
    pub last_scan: u64,
    pub file_count: usize,
    #[serde(default)]
    pub folder_hash: String,
    #[serde(default)]
    pub scan_completed: bool,
    #[serde(default)]
    pub scan_duration: u64,
    #[serde(default)]
    pub thumbnails_generated: usize,
    #[serde(default)]
    pub errors: Vec<String>,
    #[serde(default = "default_true")]
    pub incremental_supported: bool,
    #[serde(default)]
    pub processed_files: Vec<String>,
    #[serde(default)]
    pub pending_files: Vec<String>,
    #[serde(default)]
    pub last_update: u64,
    #[serde(default)]
    pub in_progress: bool,
    #[serde(default)]
    pub scan_start_time: u64,
    #[serde(default)]
    pub total_files: usize,
    #[serde(default)]
    pub folder_path: String,
}

fn default_true() -> bool {
    true
}

impl FolderScanCache {
    pub fn new_for_discovery(folder: &Path, pending: Vec<String>) -> Self {
        let folder_str = normalize_path_string(folder);
        let now = now_millis();
        Self {
            version: "1.0".to_string(),
            last_scan: now,
            file_count: 0,
            folder_hash: String::new(),
            scan_completed: false,
            scan_duration: 0,
            thumbnails_generated: 0,
            errors: Vec::new(),
            incremental_supported: true,
            processed_files: Vec::new(),
            pending_files: pending,
            last_update: now,
            in_progress: true,
            scan_start_time: now,
            total_files: 0,
            folder_path: folder_str,
        }
    }

    /// `(processed, total)` — 与 Electron `mergeDirectoryScanProgressWithCache` 一致
    pub fn progress_counts(&self) -> (usize, usize) {
        let processed = self.processed_files.len();
        let pending = self.pending_files.len();
        (processed, processed + pending)
    }

    /// 将已处理文件从 pending 移至 processed（processed 存 basename，与 Electron 一致）
    pub fn mark_file_processed(&mut self, full_path: &str) {
        if let Some(pos) = self.pending_files.iter().position(|p| p == full_path) {
            self.pending_files.remove(pos);
        }
        let base = Path::new(full_path)
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or(full_path);
        if !self.processed_files.iter().any(|p| p == base) {
            self.processed_files.push(base.to_string());
        }
        self.file_count = self.processed_files.len();
        self.total_files = self.progress_counts().1;
        self.last_update = now_millis();
    }

    pub fn mark_scan_complete(&mut self) {
        self.in_progress = false;
        self.scan_completed = true;
        self.pending_files.clear();
        self.last_update = now_millis();
    }

    pub fn save(&self, folder: &Path) -> Result<(), String> {
        let path = folder_cache_path(folder);
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
        let content = serde_json::to_string(self).map_err(|e| e.to_string())?;
        let tmp = path.with_extension("json.tmp");
        fs::write(&tmp, content).map_err(|e| e.to_string())?;
        if fs::rename(&tmp, &path).is_err() {
            fs::copy(&tmp, &path).map_err(|e| e.to_string())?;
            let _ = fs::remove_file(&tmp);
        }
        Ok(())
    }

    pub fn load(folder: &Path) -> Option<Self> {
        let path = folder_cache_path(folder);
        let content = fs::read_to_string(path).ok()?;
        serde_json::from_str(&content).ok()
    }

    /// 断点续扫：pending 非空则跳过 discovery
    pub fn can_resume(folder: &Path) -> bool {
        Self::load(folder)
            .map(|c| !c.pending_files.is_empty())
            .unwrap_or(false)
    }
}

/// 准备目录扫描缓存：resume 或全新 discovery
pub fn prepare_folder_scan_cache(
    folder: &Path,
    discovered_files: Vec<String>,
) -> Result<FolderScanCache, String> {
    if FolderScanCache::can_resume(folder) {
        if let Some(mut cache) = FolderScanCache::load(folder) {
            cache.in_progress = true;
            cache.scan_start_time = now_millis();
            cache.save(folder)?;
            return Ok(cache);
        }
    }

    let mut cache = FolderScanCache::new_for_discovery(folder, discovered_files);
    cache.total_files = cache.pending_files.len();
    cache.save(folder)?;
    Ok(cache)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;

    fn temp_scan_dir(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("photasa-scan-cache-{name}-{}", uuid::Uuid::new_v4()));
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn progress_counts_from_processed_and_pending() {
        let mut cache = FolderScanCache::new_for_discovery(Path::new("/photos"), vec![]);
        cache.processed_files = vec!["a.jpg".into(), "b.jpg".into()];
        cache.pending_files = vec!["/photos/c.jpg".into()];
        assert_eq!(cache.progress_counts(), (2, 3));
    }

    #[test]
    fn mark_file_processed_uses_basename_in_processed_files() {
        let mut cache = FolderScanCache::new_for_discovery(Path::new("/photos"), vec![]);
        cache.pending_files = vec!["/photos/sub/a.jpg".into()];
        cache.mark_file_processed("/photos/sub/a.jpg");
        assert_eq!(cache.processed_files, vec!["a.jpg"]);
        assert!(cache.pending_files.is_empty());
    }

    #[test]
    fn save_and_load_roundtrip() {
        let dir = temp_scan_dir("roundtrip");
        let mut cache = FolderScanCache::new_for_discovery(&dir, vec![normalize_path_string(&dir.join("x.jpg"))]);
        cache.pending_files = vec![normalize_path_string(&dir.join("x.jpg"))];
        cache.save(&dir).unwrap();
        assert!(dir.join(crate::commands::scan_media::PHOTASA_FOLDER_CACHE_FILE).exists());
        let loaded = FolderScanCache::load(&dir).unwrap();
        assert_eq!(loaded.pending_files, cache.pending_files);
    }

    #[test]
    fn resume_skips_discovery_when_pending_non_empty() {
        let dir = temp_scan_dir("resume");
        let file = dir.join("pic.jpg");
        let mut f = fs::File::create(&file).unwrap();
        f.write_all(b"x").unwrap();
        drop(f);
        let full = normalize_path_string(&file);

        let cache = FolderScanCache::new_for_discovery(&dir, vec![full.clone()]);
        cache.save(&dir).unwrap();
        assert!(FolderScanCache::can_resume(&dir));

        let resumed = prepare_folder_scan_cache(&dir, vec!["/should/not/use.jpg".into()]).unwrap();
        assert_eq!(resumed.pending_files, vec![full]);
    }
}

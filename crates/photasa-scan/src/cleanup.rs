//! 扫描缓存清理（Electron `extendedCleanup` / `scan-cleanup.ts`）

use std::fs;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use crate::media::PHOTASA_FOLDER_CACHE_FILE;

const DEFAULT_MAX_CACHE_AGE_MS: u64 = 7 * 24 * 60 * 60 * 1000;

#[derive(Debug, Default, Clone)]
pub struct CleanupStats {
    pub cache_files_processed: usize,
    pub invalid_cache_files_removed: usize,
    pub errors: Vec<String>,
}

/// `extendedCleanup` — 默认 7 天过期（应用启动时可调度）
#[allow(dead_code)]
pub fn extended_cleanup(base_path: Option<&str>) -> CleanupStats {
    extended_cleanup_with_age(base_path.unwrap_or(""), DEFAULT_MAX_CACHE_AGE_MS)
}

pub fn extended_cleanup_with_age(base_path: &str, max_age_ms: u64) -> CleanupStats {
    let mut stats = CleanupStats::default();
    let root = Path::new(base_path);
    let search_root = if base_path.is_empty() || !root.exists() {
        std::env::temp_dir()
    } else {
        root.to_path_buf()
    };

    for cache_path in find_cache_files(&search_root) {
        stats.cache_files_processed += 1;
        if should_remove_cache_file(&cache_path, max_age_ms) {
            match fs::remove_file(&cache_path) {
                Ok(()) => stats.invalid_cache_files_removed += 1,
                Err(e) => stats.errors.push(format!("{}: {e}", cache_path.display())),
            }
        }
    }
    stats
}

fn now_millis() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

fn should_remove_cache_file(file: &Path, max_age_ms: u64) -> bool {
    if let Ok(meta) = fs::metadata(file) {
        if let Ok(modified) = meta.modified() {
            let age = modified
                .duration_since(UNIX_EPOCH)
                .map(|d| now_millis().saturating_sub(d.as_millis() as u64))
                .unwrap_or(0);
            if age > max_age_ms {
                return true;
            }
        }
    }

    if let Some(parent) = file.parent() {
        if !parent.exists() {
            return true;
        }
    }

    let content = match fs::read_to_string(file) {
        Ok(c) => c,
        Err(_) => return true,
    };

    let value: serde_json::Value = match serde_json::from_str(&content) {
        Ok(v) => v,
        Err(_) => return true,
    };

    let version = value.get("version").and_then(|v| v.as_str()).unwrap_or("");
    let folder_hash = value
        .get("folderHash")
        .and_then(|v| v.as_str())
        .unwrap_or("");
    version.is_empty() || folder_hash.is_empty()
}

fn find_cache_files(base: &Path) -> Vec<PathBuf> {
    let mut found = Vec::new();
    collect_cache_files(base, &mut found);
    found
}

fn collect_cache_files(dir: &Path, out: &mut Vec<PathBuf>) {
    let entries = match fs::read_dir(dir) {
        Ok(e) => e,
        Err(_) => return,
    };
    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_dir() {
            collect_cache_files(&path, out);
        } else if path
            .file_name()
            .and_then(|n| n.to_str())
            .map(|n| n == PHOTASA_FOLDER_CACHE_FILE)
            .unwrap_or(false)
        {
            out.push(path);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::media::folder_cache_path;
    use std::io::Write;

    fn temp(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!(
            "photasa-scan-cleanup-{name}-{}",
            uuid::Uuid::new_v4()
        ));
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn removes_cache_missing_version() {
        let dir = temp("bad-version");
        let cache = folder_cache_path(&dir);
        fs::write(&cache, r#"{"folderHash":"x"}"#).unwrap();
        let stats = extended_cleanup_with_age(dir.to_str().unwrap(), u64::MAX);
        assert_eq!(stats.invalid_cache_files_removed, 1);
        assert!(!cache.exists());
    }

    #[test]
    fn removes_stale_cache_by_age() {
        use filetime::FileTime;
        use std::time::{Duration, SystemTime};

        let dir = temp("stale");
        let cache = folder_cache_path(&dir);
        let mut f = fs::File::create(&cache).unwrap();
        write!(
            f,
            r#"{{"version":"1.0","folderHash":"abc","processedFiles":[]}}"#
        )
        .unwrap();
        drop(f);
        let eight_days_ago =
            FileTime::from_system_time(SystemTime::now() - Duration::from_secs(8 * 24 * 3600));
        filetime::set_file_mtime(&cache, eight_days_ago).unwrap();
        let stats = extended_cleanup_with_age(dir.to_str().unwrap(), 7 * 24 * 3600 * 1000);
        assert_eq!(stats.invalid_cache_files_removed, 1);
    }
}

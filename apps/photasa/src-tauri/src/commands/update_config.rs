//! 启动时从文昌偏好典籍同步 `system.autoUpdate` → `UpdateState`（RFC 0113）

use log::{info, warn};
use std::path::{Path, PathBuf};
use wenchang_preferences::{AutoUpdatePreferences, UserPreferences};

use super::update::{apply_auto_update_config, AutoUpdateConfigState, UpdateState};

const DEFAULT_PREFERENCES_DIR_NAME: &str = ".photasa/preferences";
const PREFERENCES_FILE_NAME: &str = "preferences.json";

/// 与人界 preference store 默认一致（`enabled: true`）
pub fn default_auto_update_config() -> AutoUpdateConfigState {
    AutoUpdateConfigState::from_preferences(&AutoUpdatePreferences::default())
}

/// `~/.photasa/preferences/`（与 `preferences_adapter` 一致）
pub fn default_preferences_dir() -> PathBuf {
    let home = std::env::var("HOME")
        .or_else(|_| std::env::var("USERPROFILE"))
        .unwrap_or_else(|_| ".".to_string());
    PathBuf::from(home).join(DEFAULT_PREFERENCES_DIR_NAME)
}

pub fn preferences_file_path() -> PathBuf {
    default_preferences_dir().join(PREFERENCES_FILE_NAME)
}

impl AutoUpdateConfigState {
    pub fn from_preferences(prefs: &AutoUpdatePreferences) -> Self {
        Self {
            enabled: prefs.enabled,
            check_interval: prefs.check_interval,
            allow_prerelease: prefs.allow_prerelease,
            auto_install: prefs.auto_install,
        }
    }
}

/// 从已解析的偏好根对象读取 `system.autoUpdate`
pub fn auto_update_from_user_preferences(prefs: &UserPreferences) -> AutoUpdateConfigState {
    AutoUpdateConfigState::from_preferences(&prefs.system.auto_update)
}

/// 同步读取 preferences.json（setup 阶段，不阻塞 async runtime）
pub fn load_auto_update_from_preferences_file() -> AutoUpdateConfigState {
    load_auto_update_from_preferences_path(&preferences_file_path())
}

pub fn load_auto_update_from_preferences_path(path: &Path) -> AutoUpdateConfigState {
    let content = match std::fs::read_to_string(path) {
        Ok(c) => c,
        Err(e) => {
            warn!(
                "🌌 偏好典籍未找到或不可读（{}）：{e}，使用 autoUpdate 默认值",
                path.display()
            );
            return default_auto_update_config();
        }
    };

    let prefs: UserPreferences = match serde_json::from_str(&content) {
        Ok(v) => v,
        Err(e) => {
            warn!("🌌 偏好典籍 JSON 解析失败：{e}，使用 autoUpdate 默认值");
            return default_auto_update_config();
        }
    };

    auto_update_from_user_preferences(&prefs)
}

/// 启动 setup：将偏好中的 autoUpdate 灌入 `UpdateState`
pub fn sync_update_state_from_preferences(state: &UpdateState) -> AutoUpdateConfigState {
    let cfg = load_auto_update_from_preferences_file();
    apply_auto_update_config(state, &cfg);
    info!(
        "🌌 自动更新配置已从偏好同步: enabled={}, checkInterval={}h",
        cfg.enabled, cfg.check_interval
    );
    cfg
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;
    use wenchang_preferences::PreferencesStore;

    fn write_preferences_json(dir: &Path, json: &str) {
        std::fs::create_dir_all(dir).unwrap();
        let path = dir.join(PREFERENCES_FILE_NAME);
        let mut file = std::fs::File::create(path).unwrap();
        file.write_all(json.as_bytes()).unwrap();
    }

    #[test]
    fn default_auto_update_matches_frontend_enabled_true() {
        let cfg = default_auto_update_config();
        assert!(cfg.enabled);
        assert_eq!(cfg.check_interval, 24);
    }

    #[test]
    fn load_auto_update_reads_system_auto_update_from_file() {
        let dir =
            std::env::temp_dir().join(format!("photasa-update-config-{}", uuid::Uuid::new_v4()));
        write_preferences_json(
            &dir,
            r#"{
  "revision": 1,
  "ui": { "theme": "dark", "layout": "grid", "language": "zh-CN", "sidebarWidth": 240, "zoomLevel": 1.0 },
  "display": { "thumbnailSize": 150, "sortOrder": "name", "groupBy": "none", "showHidden": false, "showMetadata": true },
  "scanning": { "autoScan": true, "excludePatterns": [], "concurrency": 4, "watchEnabled": true, "paths": [] },
  "performance": { "maxCacheSize": 1000, "preloadCount": 50, "enableGpuAcceleration": true },
  "system": {
    "autoUpdate": {
      "enabled": false,
      "checkInterval": 6,
      "allowPrerelease": true,
      "autoInstall": true
    }
  },
  "lastModified": 1
}"#,
        );

        let path = dir.join(PREFERENCES_FILE_NAME);
        let cfg = load_auto_update_from_preferences_path(&path);
        assert!(!cfg.enabled);
        assert_eq!(cfg.check_interval, 6);
        assert!(cfg.allow_prerelease);
        assert!(cfg.auto_install);

        let _ = std::fs::remove_dir_all(dir);
    }

    #[test]
    fn sync_update_state_applies_loaded_config_to_state() {
        let dir =
            std::env::temp_dir().join(format!("photasa-update-sync-{}", uuid::Uuid::new_v4()));
        write_preferences_json(
            &dir,
            r#"{
  "revision": 1,
  "ui": { "theme": "dark", "layout": "grid", "language": "zh-CN", "sidebarWidth": 240, "zoomLevel": 1.0 },
  "display": { "thumbnailSize": 150, "sortOrder": "name", "groupBy": "none", "showHidden": false, "showMetadata": true },
  "scanning": { "autoScan": true, "excludePatterns": [], "concurrency": 4, "watchEnabled": true, "paths": [] },
  "performance": { "maxCacheSize": 1000, "preloadCount": 50, "enableGpuAcceleration": true },
  "system": { "autoUpdate": { "enabled": true, "checkInterval": 168, "allowPrerelease": false, "autoInstall": false } },
  "lastModified": 1
}"#,
        );

        let state = UpdateState::default();
        let cfg = load_auto_update_from_preferences_path(&dir.join(PREFERENCES_FILE_NAME));
        apply_auto_update_config(&state, &cfg);

        let applied = state.auto_config.lock().unwrap().clone();
        assert!(applied.enabled);
        assert_eq!(applied.check_interval, 168);

        let _ = std::fs::remove_dir_all(dir);
    }

    #[tokio::test]
    async fn wenchang_store_defaults_include_enabled_auto_update() {
        let dir =
            std::env::temp_dir().join(format!("photasa-wenchang-update-{}", uuid::Uuid::new_v4()));
        let store = PreferencesStore::initialize(&dir).await.unwrap();
        let cfg = auto_update_from_user_preferences(&store.get_current_snapshot().data);
        assert!(cfg.enabled);
        assert_eq!(cfg.check_interval, 24);

        let _ = std::fs::remove_dir_all(dir);
    }
}

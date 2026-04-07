use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::VecDeque;
use std::path::{Path, PathBuf};

#[derive(Debug, thiserror::Error)]
pub enum PreferencesError {
    #[error("io error: {0}")]
    Io(#[from] std::io::Error),
    #[error("json error: {0}")]
    Json(#[from] serde_json::Error),
    #[error("invalid preferences dir: {0}")]
    InvalidDir(String),
    #[error("invalid revision: {0}")]
    InvalidRevision(u64),
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct UserPreferences {
    pub revision: u64,
    pub ui: UiPreferences,
    pub display: DisplayPreferences,
    pub scanning: ScanningPreferences,
    pub performance: PerformancePreferences,
    pub last_modified: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct UiPreferences {
    pub theme: String,
    pub layout: String,
    pub language: String,
    pub sidebar_width: u64,
    pub zoom_level: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct DisplayPreferences {
    pub thumbnail_size: u64,
    pub sort_order: String,
    pub group_by: String,
    pub show_hidden: bool,
    pub show_metadata: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ScanningPreferences {
    pub auto_scan: bool,
    pub exclude_patterns: Vec<String>,
    pub concurrency: u64,
    pub watch_enabled: bool,
    pub paths: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct PerformancePreferences {
    pub max_cache_size: u64,
    pub preload_count: u64,
    pub enable_gpu_acceleration: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct PreferenceSnapshot {
    pub revision: u64,
    pub data: UserPreferences,
    pub timestamp: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct PreferenceDelta {
    pub ui: Option<Value>,
    pub display: Option<Value>,
    pub scanning: Option<Value>,
    pub performance: Option<Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct PreferenceHistory {
    pub revision: u64,
    pub delta: Value,
    pub timestamp: u64,
    pub source: String,
}

const DEFAULT_THEME: &str = "solarized-dark";
const DEFAULT_LAYOUT: &str = "grid";
const DEFAULT_LANGUAGE: &str = "zh-CN";
const DEFAULT_SORT_ORDER: &str = "name";
const DEFAULT_GROUP_BY: &str = "none";

const PREFERENCES_FILE_NAME: &str = "preferences.json";
const HISTORY_FILE_NAME: &str = "history.json";
const REVISIONS_DIR_NAME: &str = "revisions";

pub struct PreferencesStore {
    preferences_file: PathBuf,
    history_file: PathBuf,
    revisions_dir: PathBuf,
    preferences: UserPreferences,
    history: VecDeque<PreferenceHistory>,
    history_limit: usize,
}

impl PreferencesStore {
    pub async fn initialize(preferences_dir: impl Into<PathBuf>) -> Result<Self, PreferencesError> {
        let preferences_dir = preferences_dir.into();
        if preferences_dir.as_os_str().is_empty() {
            return Err(PreferencesError::InvalidDir("empty preferences dir".to_string()));
        }

        tokio::fs::create_dir_all(&preferences_dir).await?;

        let preferences_file = preferences_dir.join(PREFERENCES_FILE_NAME);
        let history_file = preferences_dir.join(HISTORY_FILE_NAME);
        let revisions_dir = preferences_dir.join(REVISIONS_DIR_NAME);
        tokio::fs::create_dir_all(&revisions_dir).await?;

        let now = now_ms();
        let mut store = Self {
            preferences_file,
            history_file,
            revisions_dir,
            preferences: default_preferences(now),
            history: VecDeque::new(),
            history_limit: 10,
        };

        store.load_or_init().await?;
        Ok(store)
    }

    pub fn get_current_snapshot(&self) -> PreferenceSnapshot {
        PreferenceSnapshot {
            revision: self.preferences.revision,
            data: self.preferences.clone(),
            timestamp: now_ms(),
        }
    }

    pub fn get_revision(&self) -> u64 {
        self.preferences.revision
    }

    pub async fn update_preferences(&mut self, delta: Value, source: &str) -> Result<u64, PreferencesError> {
        let next_revision = self.preferences.revision.saturating_add(1).max(1);

        let current_value = serde_json::to_value(&self.preferences)?;
        let merged_value = deep_merge_json(current_value, delta.clone());
        let mut merged: UserPreferences = serde_json::from_value(merged_value)?;

        merged.revision = next_revision;
        merged.last_modified = now_ms();
        self.preferences = merged;

        self.append_history(next_revision, delta, source)?;
        self.persist_all().await?;
        Ok(next_revision)
    }

    pub async fn reset_to_defaults(&mut self) -> Result<PreferenceSnapshot, PreferencesError> {
        let now = now_ms();
        let mut p = default_preferences(now);
        p.revision = self.preferences.revision.saturating_add(1).max(1);
        self.preferences = p;

        self.append_history(self.preferences.revision, serde_json::json!({}), "reset")?;
        self.persist_all().await?;
        Ok(self.get_current_snapshot())
    }

    pub async fn export_preferences(&self) -> Result<Value, PreferencesError> {
        Ok(serde_json::to_value(&self.preferences)?)
    }

    pub async fn import_preferences(&mut self, data: Value, source: &str) -> Result<PreferenceSnapshot, PreferencesError> {
        let mut imported: UserPreferences = serde_json::from_value(data)?;
        imported.revision = self.preferences.revision.saturating_add(1).max(1);
        imported.last_modified = now_ms();
        self.preferences = imported;

        self.append_history(self.preferences.revision, serde_json::json!({}), source)?;
        self.persist_all().await?;
        Ok(self.get_current_snapshot())
    }

    pub fn get_history(&self, limit: usize, offset: usize) -> (Vec<PreferenceHistory>, usize) {
        let total = self.history.len();
        if offset >= total {
            return (vec![], total);
        }
        let end = (offset + limit).min(total);
        let slice = self.history.iter().skip(offset).take(end - offset).cloned().collect();
        (slice, total)
    }

    pub async fn restore_revision(&mut self, revision: u64) -> Result<PreferenceSnapshot, PreferencesError> {
        if revision == 0 {
            return Err(PreferencesError::InvalidRevision(revision));
        }
        let path = self.revision_file_path(revision);
        if !path.exists() {
            return Err(PreferencesError::InvalidRevision(revision));
        }

        let content = tokio::fs::read_to_string(&path).await?;
        let restored: UserPreferences = serde_json::from_str(&content)?;
        self.preferences = restored;

        self.append_history(self.preferences.revision, serde_json::json!({}), "restore")?;
        self.persist_all().await?;
        Ok(self.get_current_snapshot())
    }

    fn revision_file_path(&self, revision: u64) -> PathBuf {
        let file_name = format!("{revision:08}.json");
        self.revisions_dir.join(file_name)
    }

    async fn load_or_init(&mut self) -> Result<(), PreferencesError> {
        if self.preferences_file.exists() {
            let content = tokio::fs::read_to_string(&self.preferences_file).await?;
            self.preferences = serde_json::from_str(&content)?;
        } else {
            self.persist_preferences().await?;
        }

        if self.history_file.exists() {
            let content = tokio::fs::read_to_string(&self.history_file).await?;
            let items: Vec<PreferenceHistory> = serde_json::from_str(&content)?;
            self.history = items.into_iter().collect();
        } else {
            self.persist_history().await?;
        }

        self.persist_revision_snapshot().await?;
        Ok(())
    }

    fn append_history(&mut self, revision: u64, delta: Value, source: &str) -> Result<(), PreferencesError> {
        let entry = PreferenceHistory {
            revision,
            delta,
            timestamp: now_ms(),
            source: source.to_string(),
        };
        self.history.push_front(entry);
        while self.history.len() > self.history_limit {
            self.history.pop_back();
        }
        Ok(())
    }

    async fn persist_all(&self) -> Result<(), PreferencesError> {
        self.persist_preferences().await?;
        self.persist_history().await?;
        self.persist_revision_snapshot().await?;
        Ok(())
    }

    async fn persist_preferences(&self) -> Result<(), PreferencesError> {
        atomic_write_json(&self.preferences_file, &self.preferences).await
    }

    async fn persist_history(&self) -> Result<(), PreferencesError> {
        let items: Vec<PreferenceHistory> = self.history.iter().cloned().collect();
        atomic_write_json(&self.history_file, &items).await
    }

    async fn persist_revision_snapshot(&self) -> Result<(), PreferencesError> {
        let path = self.revision_file_path(self.preferences.revision);
        atomic_write_json(&path, &self.preferences).await
    }
}

fn default_preferences(now: u64) -> UserPreferences {
    UserPreferences {
        revision: 1,
        ui: UiPreferences {
            theme: DEFAULT_THEME.to_string(),
            layout: DEFAULT_LAYOUT.to_string(),
            language: DEFAULT_LANGUAGE.to_string(),
            sidebar_width: 240,
            zoom_level: 1.0,
        },
        display: DisplayPreferences {
            thumbnail_size: 150,
            sort_order: DEFAULT_SORT_ORDER.to_string(),
            group_by: DEFAULT_GROUP_BY.to_string(),
            show_hidden: false,
            show_metadata: true,
        },
        scanning: ScanningPreferences {
            auto_scan: true,
            exclude_patterns: vec!["node_modules".to_string(), ".git".to_string(), "*.tmp".to_string()],
            concurrency: 4,
            watch_enabled: true,
            paths: vec![],
        },
        performance: PerformancePreferences {
            max_cache_size: 1000,
            preload_count: 50,
            enable_gpu_acceleration: true,
        },
        last_modified: now,
    }
}

fn now_ms() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

async fn atomic_write_json<T: Serialize>(path: &Path, value: &T) -> Result<(), PreferencesError> {
    let content = serde_json::to_string_pretty(value)?;
    let tmp = path.with_extension("tmp");
    tokio::fs::write(&tmp, content).await?;
    tokio::fs::rename(&tmp, path).await?;
    Ok(())
}

fn deep_merge_json(target: Value, source: Value) -> Value {
    match (target, source) {
        (Value::Object(mut a), Value::Object(b)) => {
            for (k, v) in b {
                let merged = match a.remove(&k) {
                    Some(existing) => deep_merge_json(existing, v),
                    None => v,
                };
                a.insert(k, merged);
            }
            Value::Object(a)
        }
        (_, other) => other,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_preferences_dir() -> PathBuf {
        std::env::temp_dir().join(format!("wenchang-preferences-{}", uuid::Uuid::new_v4()))
    }

    #[tokio::test]
    async fn initialize_writes_defaults_when_missing() {
        let dir = temp_preferences_dir();
        let store = PreferencesStore::initialize(&dir).await.unwrap();
        let snapshot = store.get_current_snapshot();
        assert_eq!(snapshot.revision, 1);
        assert_eq!(snapshot.data.ui.theme, DEFAULT_THEME);
        assert!(dir.join(PREFERENCES_FILE_NAME).exists());
        assert!(dir.join(HISTORY_FILE_NAME).exists());
        assert!(dir.join(REVISIONS_DIR_NAME).exists());
    }

    #[tokio::test]
    async fn update_preferences_increments_revision_and_persists() {
        let dir = temp_preferences_dir();
        let mut store = PreferencesStore::initialize(&dir).await.unwrap();
        let rev1 = store.get_revision();
        let rev2 = store
            .update_preferences(serde_json::json!({ "ui": { "theme": "dark" } }), "user")
            .await
            .unwrap();
        assert_eq!(rev2, rev1 + 1);
        assert_eq!(store.get_current_snapshot().data.ui.theme, "dark");

        let content = tokio::fs::read_to_string(dir.join(PREFERENCES_FILE_NAME)).await.unwrap();
        let persisted: UserPreferences = serde_json::from_str(&content).unwrap();
        assert_eq!(persisted.ui.theme, "dark");
        assert_eq!(persisted.revision, rev2);
    }

    #[tokio::test]
    async fn restore_revision_loads_snapshot() {
        let dir = temp_preferences_dir();
        let mut store = PreferencesStore::initialize(&dir).await.unwrap();

        let rev2 = store
            .update_preferences(serde_json::json!({ "ui": { "theme": "light" } }), "user")
            .await
            .unwrap();
        let rev3 = store
            .update_preferences(serde_json::json!({ "ui": { "theme": "dark" } }), "user")
            .await
            .unwrap();
        assert!(rev3 > rev2);

        let snap = store.restore_revision(rev2).await.unwrap();
        assert_eq!(snap.data.ui.theme, "light");
        assert_eq!(snap.revision, rev2);
    }
}


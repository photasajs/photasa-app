/*!
 * 应用偏好持久化 Tauri commands（RFC 0147，贞观：功能名 command，无 preferences adapter）
 */
use photasa_preference::PreferencesStore;
use serde_json::{json, Value};
use std::sync::Arc;
use tokio::sync::RwLock;

use super::update_config::default_preferences_dir;

/// 全局偏好存储（setup 时初始化，供 command 共享）
pub struct PreferencesState(pub Arc<RwLock<PreferencesStore>>);

impl PreferencesState {
    pub async fn initialize() -> Result<Self, String> {
        let store = PreferencesStore::initialize(default_preferences_dir())
            .await
            .map_err(|e| format!("preferences init error: {e}"))?;
        Ok(Self(Arc::new(RwLock::new(store))))
    }
}

/// 读取完整偏好快照（matter-sync 用 `snapshot` 或根对象）
#[tauri::command]
pub async fn preferences_get(state: tauri::State<'_, PreferencesState>) -> Result<Value, String> {
    let store = state.0.read().await;
    let snapshot = store.get_current_snapshot();
    Ok(json!(snapshot.data))
}

/// 按 delta 深度合并并落盘，返回 matter-sync 载荷
#[tauri::command]
pub async fn preferences_update(
    state: tauri::State<'_, PreferencesState>,
    delta: Value,
    source: String,
) -> Result<Value, String> {
    let mut store = state.0.write().await;
    let revision = store
        .update_preferences(delta.clone(), &source)
        .await
        .map_err(|e| e.to_string())?;
    let snapshot = store.get_current_snapshot();
    Ok(json!({
        "updated": delta,
        "snapshot": snapshot.data,
        "revision": revision
    }))
}

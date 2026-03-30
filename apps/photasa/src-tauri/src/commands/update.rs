//! 自动更新命令：与 Electron `picasa:*` 更新 IPC 及事件对齐（RFC 0090）

use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::{Arc, Mutex};

use serde::{Deserialize, Serialize};
use serde_json::json;
use tauri::{AppHandle, Emitter, State};
use tauri_plugin_updater::UpdaterExt;

/// 挂起待下载/安装的更新包，以及下载字节缓存
#[derive(Default)]
pub struct UpdateState {
    pub pending: Mutex<Option<tauri_plugin_updater::Update>>,
    pub downloaded: Mutex<Option<Vec<u8>>>,
    pub status: Mutex<String>,
    pub progress: Mutex<f64>,
    pub last_error: Mutex<Option<String>>,
    pub last_version: Mutex<Option<String>>,
    pub auto_config: Mutex<AutoUpdateConfigState>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AutoUpdateConfigState {
    pub enabled: bool,
    pub check_interval: u32,
    pub allow_prerelease: bool,
    pub auto_install: bool,
}

const EVENT_PROGRESS: &str = "picasa:update-progress";
const EVENT_DOWNLOADED: &str = "picasa:update-downloaded";
const EVENT_ERROR: &str = "picasa:update-error";
const EVENT_AVAILABLE: &str = "picasa:update-available";
const EVENT_STATUS_CHANGED: &str = "picasa:update-status-changed";

fn emit_status(
    app: &AppHandle,
    status: &str,
    progress: f64,
    error: Option<String>,
    version: Option<&str>,
) {
    let payload = json!({
        "status": status,
        "progress": progress,
        "error": error,
        "version": version,
    });
    let _ = app.emit(EVENT_STATUS_CHANGED, payload);
}

/// 检查更新（失败时返回 hasUpdate: false，避免打断启动流程）
#[tauri::command]
pub async fn check_for_updates(
    app: AppHandle,
    state: State<'_, UpdateState>,
) -> Result<serde_json::Value, String> {
    *state.status.lock().map_err(|e| e.to_string())? = "checking".to_string();
    emit_status(&app, "checking", 0.0, None, None);

    let updater = match app.updater() {
        Ok(u) => u,
        Err(e) => {
            log::warn!("🌌 更新器不可用：{e}");
            *state.status.lock().map_err(|e| e.to_string())? = "idle".to_string();
            return Ok(json!({ "hasUpdate": false }));
        }
    };

    let update = match updater.check().await {
        Ok(u) => u,
        Err(e) => {
            log::warn!("🌌 检查更新失败：{e}");
            *state.status.lock().map_err(|e| e.to_string())? = "idle".to_string();
            *state.last_error.lock().map_err(|e| e.to_string())? = Some(e.to_string());
            emit_status(&app, "error", 0.0, Some(e.to_string()), None);
            let _ = app.emit("picasa:update-error", e.to_string());
            return Ok(json!({ "hasUpdate": false }));
        }
    };

    let Some(ref update) = update else {
        *state.status.lock().map_err(|e| e.to_string())? = "upToDate".to_string();
        emit_status(&app, "upToDate", 0.0, None, None);
        return Ok(json!({ "hasUpdate": false }));
    };

    let version = update.version.clone();
    *state.last_version.lock().map_err(|e| e.to_string())? = Some(version.clone());
    *state.pending.lock().map_err(|e| e.to_string())? = Some(update.clone());
    *state.status.lock().map_err(|e| e.to_string())? = "idle".to_string();

    let info = json!({ "version": version });
    let _ = app.emit(
        EVENT_AVAILABLE,
        json!({ "version": version, "info": info.clone() }),
    );
    emit_status(&app, "idle", 0.0, None, Some(version.as_str()));

    Ok(json!({
        "hasUpdate": true,
        "version": version,
        "info": info,
    }))
}

/// 下载更新包（不安装）；发射进度与下载完成事件
#[tauri::command]
pub async fn download_update(app: AppHandle, state: State<'_, UpdateState>) -> Result<(), String> {
    let update = {
        let guard = state.pending.lock().map_err(|e| e.to_string())?;
        guard.as_ref().cloned().ok_or_else(|| "请先检查更新".to_string())?
    };

    *state.status.lock().map_err(|e| e.to_string())? = "downloading".to_string();
    emit_status(&app, "downloading", 0.0, None, None);

    let app_handle = app.clone();
    let downloaded = Arc::new(AtomicUsize::new(0));
    let downloaded_cb = downloaded.clone();
    let bytes = update
        .download(
            move |chunk: usize, total: Option<u64>| {
                let prev = downloaded_cb.fetch_add(chunk, Ordering::SeqCst);
                let got = prev + chunk;
                let progress = total
                    .map(|t| (got as f64 / t as f64).min(1.0))
                    .unwrap_or(0.0);
                let _ = app_handle.emit(EVENT_PROGRESS, progress);
                emit_status(&app_handle, "downloading", progress, None, None);
            },
            || {},
        )
        .await
        .map_err(|e| {
            let msg = e.to_string();
            if let Ok(mut g) = state.last_error.lock() {
                *g = Some(msg.clone());
            }
            let _ = app.emit(EVENT_ERROR, msg.clone());
            msg
        })?;

    *state.progress.lock().map_err(|e| e.to_string())? = 1.0;
    *state.downloaded.lock().map_err(|e| e.to_string())? = Some(bytes);
    *state.status.lock().map_err(|e| e.to_string())? = "downloaded".to_string();
    emit_status(&app, "downloaded", 1.0, None, None);
    let _ = app.emit(EVENT_DOWNLOADED, json!({}));
    Ok(())
}

/// 安装已下载的更新并重启
#[tauri::command]
pub fn install_update(app: AppHandle, state: State<'_, UpdateState>) -> Result<(), String> {
    let bytes = state
        .downloaded
        .lock()
        .map_err(|e| e.to_string())?
        .take()
        .ok_or_else(|| "请先下载更新".to_string())?;

    let update = state
        .pending
        .lock()
        .map_err(|e| e.to_string())?
        .take()
        .ok_or_else(|| "更新上下文丢失，请重新检查更新".to_string())?;

    update.install(&bytes).map_err(|e| e.to_string())?;
    *state.status.lock().map_err(|e| e.to_string())? = "idle".to_string();
    app.request_restart();
    Ok(())
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AutoUpdatePatch {
    pub enabled: Option<bool>,
    pub check_interval: Option<u32>,
    pub allow_prerelease: Option<bool>,
    pub auto_install: Option<bool>,
}

/// 更新内存中的自动更新配置（Electron 侧持久化由偏好层处理；此处仅对齐 API）
#[tauri::command]
pub fn update_auto_update_config(
    state: State<'_, UpdateState>,
    patch: serde_json::Value,
) -> Result<bool, String> {
    let patch: AutoUpdatePatch = serde_json::from_value(patch).map_err(|e| e.to_string())?;
    let mut c = state.auto_config.lock().map_err(|e| e.to_string())?;
    if let Some(v) = patch.enabled {
        c.enabled = v;
    }
    if let Some(v) = patch.check_interval {
        c.check_interval = v;
    }
    if let Some(v) = patch.allow_prerelease {
        c.allow_prerelease = v;
    }
    if let Some(v) = patch.auto_install {
        c.auto_install = v;
    }
    Ok(true)
}

/// 获取当前更新状态与进度
#[tauri::command]
pub fn get_update_status(state: State<'_, UpdateState>) -> Result<serde_json::Value, String> {
    let status = state.status.lock().map_err(|e| e.to_string())?.clone();
    let progress = *state.progress.lock().map_err(|e| e.to_string())?;
    let error = state.last_error.lock().map_err(|e| e.to_string())?.clone();
    let version = state.last_version.lock().map_err(|e| e.to_string())?.clone();
    Ok(json!({
        "status": status,
        "progress": progress,
        "error": error,
        "version": version,
    }))
}

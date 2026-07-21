//! 配置引擎健康状态桥 — 对齐 Electron `ConfigService.handleEngineStatus` → `picasa:engine-status`。
//!
//! Tauri 无 Node config worker；在 Rust setup / 天枢就绪等里程碑发射同等事件载荷，供人界预留监听。

use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager, Runtime};

use super::splash_bridge::MAIN_WEBVIEW_LABEL;

pub const EVENT_ENGINE_STATUS: &str = "picasa:engine-status";

/// 与 Electron `engine: "sibu"` 一致（四部典籍 / config worker 预留名）。
pub const ENGINE_SIBU: &str = "sibu";

/// Electron `ConfigResponse` 中 `action: "engine-status"` 的 Rust 子集。
#[derive(Debug, Clone, Serialize)]
pub struct EngineStatusData {
    pub action: &'static str,
    pub status: String,
    pub timestamp: i64,
}

/// 与 Electron `webContents.send("picasa:engine-status", { ... })` 同形。
#[derive(Debug, Clone, Serialize)]
pub struct EngineStatusEvent {
    pub engine: &'static str,
    pub status: String,
    pub timestamp: i64,
    pub data: EngineStatusData,
}

fn now_millis() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

/// 构建与 Electron 对齐的 `picasa:engine-status` 载荷。
pub fn build_engine_status_event(status: impl Into<String>) -> EngineStatusEvent {
    let status = status.into();
    let timestamp = now_millis();
    EngineStatusEvent {
        engine: ENGINE_SIBU,
        status: status.clone(),
        timestamp,
        data: EngineStatusData {
            action: "engine-status",
            status,
            timestamp,
        },
    }
}

/// 向主窗发射 `picasa:engine-status`（主窗未创建时静默跳过）。
pub fn emit_engine_status<R: Runtime>(app: &AppHandle<R>, status: impl Into<String>) {
    let payload = build_engine_status_event(status);
    if let Some(main) = app.get_webview_window(MAIN_WEBVIEW_LABEL) {
        let _ = main.emit(EVENT_ENGINE_STATUS, &payload);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn build_event_matches_electron_shape() {
        let ev = build_engine_status_event("ready");
        assert_eq!(ev.engine, ENGINE_SIBU);
        assert_eq!(ev.status, "ready");
        assert_eq!(ev.data.action, "engine-status");
        assert_eq!(ev.data.status, "ready");
        assert_eq!(ev.timestamp, ev.data.timestamp);

        let json = serde_json::to_value(&ev).expect("serialize");
        assert_eq!(json["engine"], "sibu");
        assert_eq!(json["status"], "ready");
        assert_eq!(json["data"]["action"], "engine-status");
    }
}

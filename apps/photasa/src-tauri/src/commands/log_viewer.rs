//! 日志查看器：与 Electron `log:viewer-open` / `log:entry` 对齐（RFC 0088、0089）

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::OnceLock;

use serde_json::json;
use tauri::{AppHandle, Emitter};

/// 与前端 `@photasa/common` 中 `LogEntry.level` 对齐
const LEVEL_ERROR: &str = "error";
const LEVEL_WARN: &str = "warn";
const LEVEL_INFO: &str = "info";
const LEVEL_DEBUG: &str = "debug";

/// 仅当为 true 时向渲染进程发射 `log:entry`
static LOG_VIEWER_ACTIVE: AtomicBool = AtomicBool::new(false);

/// 用于在 `log` 回调中发射事件（在 `setup` 中注入一次）
static LOG_EMIT_APP: OnceLock<AppHandle> = OnceLock::new();

struct PhotasaLogBridge;

impl log::Log for PhotasaLogBridge {
    fn enabled(&self, _metadata: &log::Metadata) -> bool {
        true
    }

    fn log(&self, record: &log::Record) {
        eprintln!("[{}] {} — {}", record.level(), record.target(), record.args());
        if !LOG_VIEWER_ACTIVE.load(Ordering::SeqCst) {
            return;
        }
        let Some(app) = LOG_EMIT_APP.get() else {
            return;
        };
        let level_str = match record.level() {
            log::Level::Error => LEVEL_ERROR,
            log::Level::Warn => LEVEL_WARN,
            log::Level::Info => LEVEL_INFO,
            log::Level::Debug | log::Level::Trace => LEVEL_DEBUG,
        };
        let payload = json!({
            "timestamp": chrono::Utc::now().to_rfc3339_opts(chrono::SecondsFormat::Millis, true),
            "level": level_str,
            "category": record.target(),
            "message": format!("{}", record.args()),
            "source": "main",
        });
        let _ = app.emit("log:entry", payload);
    }

    fn flush(&self) {}
}

static PHOTASA_LOG_BRIDGE: PhotasaLogBridge = PhotasaLogBridge;

/// 必须在任何 `log::info!` 等调用之前执行；若全局 logger 已被占用则仅记录告警
pub fn init_log_emit_bridge(app: &AppHandle) {
    let _ = LOG_EMIT_APP.set(app.clone());
    match log::set_logger(&PHOTASA_LOG_BRIDGE) {
        Ok(()) => log::set_max_level(log::LevelFilter::Debug),
        Err(e) => eprintln!("⚠️ 未能注册日志查看器桥接（将仍可向 stderr 输出）：{e}"),
    }
}

/// 打开日志查看器：开始转发 `log` 到 `log:entry`
#[tauri::command]
pub fn log_viewer_open() -> serde_json::Value {
    LOG_VIEWER_ACTIVE.store(true, Ordering::SeqCst);
    json!({
        "success": true,
        "message": "[LogViewer] Log viewer activated"
    })
}

/// 关闭日志查看器
#[tauri::command]
pub fn log_viewer_close() -> serde_json::Value {
    LOG_VIEWER_ACTIVE.store(false, Ordering::SeqCst);
    json!({
        "success": true,
        "message": "[LogViewer] Log viewer deactivated"
    })
}

/// 接收渲染进程传回的日志并在主进程打印（用于调试前端错误）
#[tauri::command]
pub fn log_from_renderer(level: String, category: String, message: String) {
    match level.as_str() {
        "error" => log::error!("🌌 [Renderer][{}] {}", category, message),
        "warn" => log::warn!("🌌 [Renderer][{}] {}", category, message),
        "info" => log::info!("🌌 [Renderer][{}] {}", category, message),
        _ => log::debug!("🌌 [Renderer][{}] {}", category, message),
    }
}

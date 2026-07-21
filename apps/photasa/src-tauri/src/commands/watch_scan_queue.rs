//! Tauri 适配：`photasa-watch` coalescer → `picasa:add-to-scan-queue`（RFC 0133）

use photasa_types::FileOperation;
use photasa_watch::{ScanQueueSink, EVENT_ADD_TO_SCAN_QUEUE};
use std::sync::Arc;
use tauri::{AppHandle, Emitter};

pub use photasa_watch::ScanQueueCoalescer;

/// 将合并后的 FileOperation 批次发给前端（通路 B）
pub struct TauriScanQueueSink {
    app: AppHandle,
}

impl TauriScanQueueSink {
    pub fn new(app: AppHandle) -> Arc<Self> {
        Arc::new(Self { app })
    }
}

impl ScanQueueSink for TauriScanQueueSink {
    fn emit_batch(&self, ops: &[FileOperation]) {
        if let Err(e) = self.app.emit(EVENT_ADD_TO_SCAN_QUEUE, ops) {
            log::warn!("🌌 发射 {EVENT_ADD_TO_SCAN_QUEUE} 失败：{e}");
        }
    }
}

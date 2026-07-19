/*!
 * 扫描命令 + 导入 Stub
 * scan_photos 使用 Rust scan_runner（RFC 0105）；导入命令待后续迁移
 */
use log::info;
use tauri::State;

pub use super::scan_runner::{ScanAction, ScanWorker};

// ============================================
// 扫描命令（Rust 实现）
// ============================================

/// 扫描照片 — 增量缓存 + progress 事件（`picasa:find-photo`）
#[tauri::command]
pub async fn scan_photos(
    worker: State<'_, ScanWorker>,
    request_id: String,
    scan_action: ScanAction,
) -> Result<(), String> {
    info!(
        "🌌 千里眼开坛，扫描路径: {} (requestId: {})",
        scan_action.path, request_id
    );
    worker.submit(request_id, scan_action)
}

// ============================================
// 导入：execute/cancel 已迁移至 import_execute.rs；scan 见 import_scan_directories.rs
// ============================================

/*!
 * RFC 0093：旧版 `importPhotos` 的 Tauri wrapper。
 * 旧导入算法在 `photasa-import::legacy_loop`；这里只负责命令入口和事件桥接。
 */
use crate::commands::extract_metadata_exif::legacy_import_target_name;
use log::info;
use photasa_import::legacy_loop::{run_legacy_import, LegacyImportRequest};
use tauri::{AppHandle, Emitter};

/// 发往渲染进程的事件名（与 `legacy-api` 中常量保持一致）
pub const IMPORT_PHOTOS_LEGACY_EVENT: &str = "picasa:import-photos-legacy";

/// 启动旧版导入：立即返回 `session_id`；进度与结果经 `IMPORT_PHOTOS_LEGACY_EVENT` 推送
#[tauri::command]
pub async fn import_photos_legacy(
    app: AppHandle,
    folders: Vec<String>,
    target: String,
) -> Result<String, String> {
    let session_id = uuid::Uuid::new_v4().to_string();
    info!(
        "🌌 旧版导入开坛，session={} 目标={} 源目录数={}",
        session_id,
        target,
        folders.len()
    );

    let app = std::sync::Arc::new(app);
    let sid = session_id.clone();
    let target_root = target.clone();

    tokio::spawn(async move {
        let completed = run_legacy_import(
            LegacyImportRequest {
                session_id: &sid,
                folders: &folders,
                target: &target_root,
            },
            legacy_import_target_name,
            |event| {
                let _ = app.emit(IMPORT_PHOTOS_LEGACY_EVENT, event);
            },
        );

        if completed {
            info!("🌌 旧版导入完功，session={}", sid);
        }
    });

    Ok(session_id)
}

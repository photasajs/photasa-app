/*!
 * RFC 0093：旧版 `importPhotos` 的遍历、过滤、去重复制 **全部在 Rust 内实现**。
 * 不依赖 TypeScript/Node 业务逻辑；前端只 `invoke` + 监听事件并转调回调。
 */
use crate::commands::extract_metadata_exif::legacy_import_target_name;
use crate::commands::import_path_filter::{
    basename_hidden, classify_media, should_ignore_photasa_path,
};
use chrono::{DateTime, Utc};
use filetime::{set_file_times, FileTime};
use log::{info, warn};
use serde::Serialize;
use serde_json::json;
use std::fs;
use std::fs::Metadata;
use std::path::{Path, PathBuf};
use std::time::SystemTime;
use tauri::{AppHandle, Emitter};
use walkdir::WalkDir;

/// 发往渲染进程的事件名（与 `legacy-api` 中常量保持一致）
pub const IMPORT_PHOTOS_LEGACY_EVENT: &str = "picasa:import-photos-legacy";

fn system_time_to_rfc3339(t: SystemTime) -> Option<String> {
    let dt: DateTime<Utc> = t.into();
    Some(dt.to_rfc3339())
}

fn file_created_iso(meta: &std::fs::Metadata) -> Option<String> {
    meta.created()
        .or_else(|_| meta.modified())
        .ok()
        .and_then(system_time_to_rfc3339)
}

/// 复制到目标目录；若重名则 `name_1.ext`、`name_2.ext`…（对齐 Electron `file-helper.copyFile`）
fn copy_with_unique_name(src: &Path, target_dir: &Path, src_meta: &Metadata) -> Result<PathBuf, String> {
    let orig_name = src
        .file_name()
        .and_then(|s| s.to_str())
        .ok_or_else(|| "无效文件名".to_string())?
        .to_string();

    let mut dest = target_dir.join(&orig_name);
    let mut count = 1u32;
    while dest.exists() {
        let p = Path::new(&orig_name);
        let stem = p.file_stem().and_then(|s| s.to_str()).unwrap_or("file");
        let ext = p
            .extension()
            .and_then(|e| e.to_str())
            .map(|e| format!(".{e}"))
            .unwrap_or_default();
        dest = target_dir.join(format!("{stem}_{count}{ext}"));
        count += 1;
    }

    fs::copy(src, &dest).map_err(|e| e.to_string())?;
    // 与 Electron `file-helper.copyFile` 一致：尽量保留源文件的访问/修改时间
    let at = src_meta
        .accessed()
        .unwrap_or_else(|_| src_meta.modified().unwrap_or_else(|_| SystemTime::now()));
    let mt = src_meta.modified().unwrap_or(at);
    if let Err(te) = set_file_times(
        &dest,
        FileTime::from_system_time(at),
        FileTime::from_system_time(mt),
    ) {
        warn!("🌌 未能铭刻文件时日（旧版导入）: {}", te);
    }
    Ok(dest)
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct FileActionJson {
    file: String,
    name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    created: Option<String>,
    is_image: bool,
    is_video: bool,
    target: String,
    target_dir: String,
    target_file_name: String,
    target_full_path: String,
}

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
        let target_path = PathBuf::from(&target_root);
        if let Err(e) = fs::create_dir_all(&target_path) {
            let _ = app.emit(
                IMPORT_PHOTOS_LEGACY_EVENT,
                json!({
                    "sessionId": sid,
                    "type": "error",
                    "error": format!("创建目标目录失败: {e}"),
                    "action": {},
                }),
            );
            return;
        }

        for folder in folders {
            let base = PathBuf::from(&folder);
            if !base.is_dir() {
                warn!("🌌 源跳过（非目录）: {}", folder);
                continue;
            }

            for entry in WalkDir::new(&base).into_iter().filter_map(|e| e.ok()) {
                let path = entry.path();
                if !path.is_file() {
                    continue;
                }

                let path_str = path.to_string_lossy().replace('\\', "/");
                if should_ignore_photasa_path(&path_str) {
                    continue;
                }
                if basename_hidden(path) {
                    continue;
                }

                let Some((is_image, is_video)) = classify_media(path) else {
                    continue;
                };

                let meta = match fs::metadata(path) {
                    Ok(m) => m,
                    Err(e) => {
                        let _ = app.emit(
                            IMPORT_PHOTOS_LEGACY_EVENT,
                            json!({
                                "sessionId": sid,
                                "type": "error",
                                "error": format!("读取元数据失败: {e}"),
                                "action": {},
                            }),
                        );
                        continue;
                    }
                };

                let name = path
                    .file_name()
                    .and_then(|s| s.to_str())
                    .unwrap_or("")
                    .to_string();

                let dest_parent = match legacy_import_target_name(path, is_image, &meta) {
                    Some(rel) => target_path.join(rel),
                    None => target_path.clone(),
                };

                if let Err(e) = fs::create_dir_all(&dest_parent) {
                    let _ = app.emit(
                        IMPORT_PHOTOS_LEGACY_EVENT,
                        json!({
                            "sessionId": sid,
                            "type": "error",
                            "error": format!("创建目标子目录失败: {e}"),
                            "action": {},
                        }),
                    );
                    continue;
                }

                let target_dir_str = dest_parent.to_string_lossy().replace('\\', "/");

                match copy_with_unique_name(path, &dest_parent, &meta) {
                    Ok(dest) => {
                        let dest_s = dest.to_string_lossy().replace('\\', "/");
                        let final_name = dest
                            .file_name()
                            .and_then(|s| s.to_str())
                            .unwrap_or("")
                            .to_string();

                        let done = FileActionJson {
                            file: path_str,
                            name,
                            created: file_created_iso(&meta),
                            is_image,
                            is_video,
                            target: target_root.clone(),
                            target_dir: target_dir_str,
                            target_file_name: final_name,
                            target_full_path: dest_s,
                        };

                        let action_val =
                            serde_json::to_value(&done).unwrap_or_else(|_| json!({}));

                        let _ = app.emit(
                            IMPORT_PHOTOS_LEGACY_EVENT,
                            json!({
                                "sessionId": sid,
                                "type": "next",
                                "error": null,
                                "action": action_val,
                            }),
                        );
                    }
                    Err(e) => {
                        let _ = app.emit(
                            IMPORT_PHOTOS_LEGACY_EVENT,
                            json!({
                                "sessionId": sid,
                                "type": "error",
                                "error": e,
                                "action": {},
                            }),
                        );
                    }
                }
            }
        }

        let _ = app.emit(
            IMPORT_PHOTOS_LEGACY_EVENT,
            json!({
                "sessionId": sid,
                "type": "complete",
                "error": null,
                "action": {},
            }),
        );
        info!("🌌 旧版导入完功，session={}", sid);
    });

    Ok(session_id)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use uuid::Uuid;

    #[test]
    fn copy_with_unique_name_keeps_original_basename_when_free() {
        let tmp = std::env::temp_dir().join(format!("photasa-import-leg-{}", Uuid::new_v4()));
        fs::create_dir_all(&tmp).expect("mkdir tmp");
        let src = tmp.join("photo.txt");
        fs::write(&src, b"x").expect("write src");
        let meta = fs::metadata(&src).expect("meta src");
        let dest_dir = tmp.join("out");
        fs::create_dir_all(&dest_dir).expect("mkdir out");
        let dest = copy_with_unique_name(&src, &dest_dir, &meta).expect("copy");
        assert_eq!(dest.file_name().and_then(|s| s.to_str()), Some("photo.txt"));
        assert!(dest.is_file());
        let _ = fs::remove_dir_all(&tmp);
    }

    #[test]
    fn copy_with_unique_name_appends_suffix_when_name_collides() {
        let tmp = std::env::temp_dir().join(format!("photasa-import-leg-dup-{}", Uuid::new_v4()));
        fs::create_dir_all(&tmp).expect("mkdir tmp");
        let src = tmp.join("dup.jpg");
        fs::write(&src, b"new").expect("write src");
        let meta = fs::metadata(&src).expect("meta src");
        let dest_dir = tmp.join("out2");
        fs::create_dir_all(&dest_dir).expect("mkdir out");
        fs::write(dest_dir.join("dup.jpg"), b"existing").expect("seed collision");
        let dest = copy_with_unique_name(&src, &dest_dir, &meta).expect("copy");
        assert_eq!(dest.file_name().and_then(|s| s.to_str()), Some("dup_1.jpg"));
        assert_eq!(fs::read_to_string(&dest).expect("read dest"), "new");
        let _ = fs::remove_dir_all(&tmp);
    }

    #[test]
    fn copy_with_unique_name_increments_until_free_slot() {
        let tmp = std::env::temp_dir().join(format!("photasa-import-leg-multi-{}", Uuid::new_v4()));
        fs::create_dir_all(&tmp).expect("mkdir tmp");
        let src = tmp.join("x.png");
        fs::write(&src, b"v").expect("write src");
        let meta = fs::metadata(&src).expect("meta src");
        let dest_dir = tmp.join("out3");
        fs::create_dir_all(&dest_dir).expect("mkdir out");
        fs::write(dest_dir.join("x.png"), b"0").expect("x.png");
        fs::write(dest_dir.join("x_1.png"), b"1").expect("x_1.png");
        let dest = copy_with_unique_name(&src, &dest_dir, &meta).expect("copy");
        assert_eq!(dest.file_name().and_then(|s| s.to_str()), Some("x_2.png"));
        let _ = fs::remove_dir_all(&tmp);
    }
}

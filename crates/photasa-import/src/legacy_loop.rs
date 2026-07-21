//! Legacy `importPhotos` loop without Tauri dependencies.

use crate::copy_loop::copy_one;
use crate::path_filter::{basename_hidden, classify_media, should_ignore_photasa_path};
use chrono::{DateTime, Utc};
use filetime::{set_file_times, FileTime};
use log::warn;
use serde::Serialize;
use serde_json::{json, Value};
use std::fs;
use std::fs::Metadata;
use std::path::{Path, PathBuf};
use std::time::SystemTime;
use walkdir::WalkDir;

pub struct LegacyImportRequest<'a> {
    pub session_id: &'a str,
    pub folders: &'a [String],
    pub target: &'a str,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LegacyFileAction {
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

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LegacyImportEvent {
    session_id: String,
    #[serde(rename = "type")]
    kind: &'static str,
    error: Option<String>,
    action: Value,
}

impl LegacyImportEvent {
    fn next(session_id: &str, action: &LegacyFileAction) -> Self {
        Self {
            session_id: session_id.to_string(),
            kind: "next",
            error: None,
            action: serde_json::to_value(action).unwrap_or_else(|_| json!({})),
        }
    }

    fn error(session_id: &str, error: String) -> Self {
        Self {
            session_id: session_id.to_string(),
            kind: "error",
            error: Some(error),
            action: json!({}),
        }
    }

    fn complete(session_id: &str) -> Self {
        Self {
            session_id: session_id.to_string(),
            kind: "complete",
            error: None,
            action: json!({}),
        }
    }
}

fn system_time_to_rfc3339(t: SystemTime) -> String {
    let dt: DateTime<Utc> = t.into();
    dt.to_rfc3339()
}

fn file_created_iso(meta: &Metadata) -> Option<String> {
    meta.created()
        .or_else(|_| meta.modified())
        .ok()
        .map(system_time_to_rfc3339)
}

/// Legacy copy semantics: collision rename via shared import copy code, then preserve source times.
pub fn copy_legacy_file(
    src: &Path,
    target_dir: &Path,
    src_meta: &Metadata,
) -> Result<PathBuf, String> {
    let dest = copy_one(src, target_dir, "rename")?.dest;
    let at = src_meta
        .accessed()
        .unwrap_or_else(|_| src_meta.modified().unwrap_or_else(|_| SystemTime::now()));
    let mt = src_meta.modified().unwrap_or(at);
    if let Err(te) = set_file_times(
        &dest,
        FileTime::from_system_time(at),
        FileTime::from_system_time(mt),
    ) {
        warn!("legacy import could not preserve file times: {}", te);
    }
    Ok(dest)
}

pub fn run_legacy_import<F, E>(
    request: LegacyImportRequest<'_>,
    resolve_target_name: F,
    mut emit: E,
) -> bool
where
    F: Fn(&Path, bool, &Metadata) -> Option<String>,
    E: FnMut(LegacyImportEvent),
{
    let target_path = PathBuf::from(request.target);
    if let Err(e) = fs::create_dir_all(&target_path) {
        emit(LegacyImportEvent::error(
            request.session_id,
            format!("创建目标目录失败: {e}"),
        ));
        return false;
    }

    for folder in request.folders {
        let base = PathBuf::from(folder);
        if !base.is_dir() {
            warn!("legacy import skipped non-directory source: {}", folder);
            continue;
        }

        for entry in WalkDir::new(&base).into_iter().filter_map(|e| e.ok()) {
            let path = entry.path();
            if !path.is_file() {
                continue;
            }

            let path_str = path.to_string_lossy().replace('\\', "/");
            if should_ignore_photasa_path(&path_str) || basename_hidden(path) {
                continue;
            }

            let Some((is_image, is_video)) = classify_media(path) else {
                continue;
            };

            let meta = match fs::metadata(path) {
                Ok(m) => m,
                Err(e) => {
                    emit(LegacyImportEvent::error(
                        request.session_id,
                        format!("读取元数据失败: {e}"),
                    ));
                    continue;
                }
            };

            let name = path
                .file_name()
                .and_then(|s| s.to_str())
                .unwrap_or("")
                .to_string();

            let dest_parent = match resolve_target_name(path, is_image, &meta) {
                Some(rel) => target_path.join(rel),
                None => target_path.clone(),
            };

            if let Err(e) = fs::create_dir_all(&dest_parent) {
                emit(LegacyImportEvent::error(
                    request.session_id,
                    format!("创建目标子目录失败: {e}"),
                ));
                continue;
            }

            let target_dir_str = dest_parent.to_string_lossy().replace('\\', "/");
            match copy_legacy_file(path, &dest_parent, &meta) {
                Ok(dest) => {
                    let dest_s = dest.to_string_lossy().replace('\\', "/");
                    let final_name = dest
                        .file_name()
                        .and_then(|s| s.to_str())
                        .unwrap_or("")
                        .to_string();
                    let done = LegacyFileAction {
                        file: path_str,
                        name,
                        created: file_created_iso(&meta),
                        is_image,
                        is_video,
                        target: request.target.to_string(),
                        target_dir: target_dir_str,
                        target_file_name: final_name,
                        target_full_path: dest_s,
                    };
                    emit(LegacyImportEvent::next(request.session_id, &done));
                }
                Err(e) => emit(LegacyImportEvent::error(request.session_id, e)),
            }
        }
    }

    emit(LegacyImportEvent::complete(request.session_id));
    true
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::Value;
    use uuid::Uuid;

    fn temp_dir(prefix: &str) -> PathBuf {
        std::env::temp_dir().join(format!("{prefix}-{}", Uuid::new_v4()))
    }

    #[test]
    fn copy_legacy_file_keeps_original_basename_when_free() {
        let tmp = temp_dir("photasa-import-leg");
        fs::create_dir_all(&tmp).expect("mkdir tmp");
        let src = tmp.join("photo.txt");
        fs::write(&src, b"x").expect("write src");
        let meta = fs::metadata(&src).expect("meta src");
        let dest_dir = tmp.join("out");
        fs::create_dir_all(&dest_dir).expect("mkdir out");
        let dest = copy_legacy_file(&src, &dest_dir, &meta).expect("copy");
        assert_eq!(dest.file_name().and_then(|s| s.to_str()), Some("photo.txt"));
        assert!(dest.is_file());
        let _ = fs::remove_dir_all(&tmp);
    }

    #[test]
    fn copy_legacy_file_appends_suffix_when_name_collides() {
        let tmp = temp_dir("photasa-import-leg-dup");
        fs::create_dir_all(&tmp).expect("mkdir tmp");
        let src = tmp.join("dup.jpg");
        fs::write(&src, b"new").expect("write src");
        let meta = fs::metadata(&src).expect("meta src");
        let dest_dir = tmp.join("out2");
        fs::create_dir_all(&dest_dir).expect("mkdir out");
        fs::write(dest_dir.join("dup.jpg"), b"existing").expect("seed collision");
        let dest = copy_legacy_file(&src, &dest_dir, &meta).expect("copy");
        assert_eq!(dest.file_name().and_then(|s| s.to_str()), Some("dup_1.jpg"));
        assert_eq!(fs::read_to_string(&dest).expect("read dest"), "new");
        let _ = fs::remove_dir_all(&tmp);
    }

    #[test]
    fn copy_legacy_file_increments_until_free_slot() {
        let tmp = temp_dir("photasa-import-leg-multi");
        fs::create_dir_all(&tmp).expect("mkdir tmp");
        let src = tmp.join("x.png");
        fs::write(&src, b"v").expect("write src");
        let meta = fs::metadata(&src).expect("meta src");
        let dest_dir = tmp.join("out3");
        fs::create_dir_all(&dest_dir).expect("mkdir out");
        fs::write(dest_dir.join("x.png"), b"0").expect("x.png");
        fs::write(dest_dir.join("x_1.png"), b"1").expect("x_1.png");
        let dest = copy_legacy_file(&src, &dest_dir, &meta).expect("copy");
        assert_eq!(dest.file_name().and_then(|s| s.to_str()), Some("x_2.png"));
        let _ = fs::remove_dir_all(&tmp);
    }

    #[test]
    fn run_legacy_import_emits_next_and_complete() {
        let tmp = temp_dir("photasa-import-legacy-loop");
        let src_dir = tmp.join("src");
        let target_dir = tmp.join("target");
        fs::create_dir_all(&src_dir).expect("mkdir src");
        fs::write(src_dir.join("photo.jpg"), b"jpg").expect("write jpg");
        fs::write(src_dir.join(".hidden.jpg"), b"hidden").expect("write hidden");
        fs::write(src_dir.join("note.txt"), b"text").expect("write txt");

        let folders = vec![src_dir.to_string_lossy().to_string()];
        let target = target_dir.to_string_lossy().to_string();
        let mut events: Vec<Value> = Vec::new();

        let completed = run_legacy_import(
            LegacyImportRequest {
                session_id: "session-a",
                folders: &folders,
                target: &target,
            },
            |_, is_image, _| {
                if is_image {
                    Some("2024/20240102".to_string())
                } else {
                    None
                }
            },
            |event| events.push(serde_json::to_value(event).expect("event json")),
        );

        assert!(completed);
        assert_eq!(events.len(), 2);
        assert_eq!(events[0]["sessionId"], "session-a");
        assert_eq!(events[0]["type"], "next");
        assert_eq!(events[0]["error"], Value::Null);
        assert_eq!(events[0]["action"]["targetFileName"], "photo.jpg");
        assert_eq!(events[1]["type"], "complete");
        assert!(target_dir
            .join("2024")
            .join("20240102")
            .join("photo.jpg")
            .is_file());
        assert!(!target_dir.join(".hidden.jpg").exists());

        let _ = fs::remove_dir_all(&tmp);
    }
}

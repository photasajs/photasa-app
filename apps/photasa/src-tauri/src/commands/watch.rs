/*!
 * 文件监视命令 (RFC 0082, 0083, 0133)
 * start_file_watch / stop_file_watch：notify → file-* 事件 + photasa-watch coalescer → scan queue
 */
use crate::commands::watch_scan_queue::{ScanQueueCoalescer, TauriScanQueueSink};
use notify::event::{CreateKind, RemoveKind};
use notify::{EventKind, RecommendedWatcher, RecursiveMode, Watcher};
use photasa_import::path_filter::should_ignore_photasa_path;
use std::path::Path;
use std::sync::Mutex;
use tauri::Emitter;

/// 与前端 WatchServiceEvent 一致的事件名
const FILE_ADD: &str = "picasa:file-add";
const FILE_ADD_DIR: &str = "picasa:file-add-dir";
const FILE_CHANGE: &str = "picasa:file-change";
const FILE_UNLINK: &str = "picasa:file-unlink";
const FILE_UNLINK_DIR: &str = "picasa:file-unlink-dir";
const FILE_ERROR: &str = "picasa:file-error";
const FILE_READY: &str = "picasa:file-ready";

/// 前端期望的 payload 形状：`{ isFile: boolean, path: string }`（RFC 0083 / 0135）
#[derive(Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct FileEventPayload {
    is_file: bool,
    path: String,
}

#[derive(Clone, serde::Serialize)]
struct FileErrorPayload {
    error: String,
}

/// 当前监视器句柄 + 扫描队列合并器
pub struct WatchState {
    watcher: Mutex<Option<RecommendedWatcher>>,
    coalescer: ScanQueueCoalescer,
}

impl WatchState {
    pub fn new() -> Self {
        Self {
            watcher: Mutex::new(None),
            coalescer: ScanQueueCoalescer::new(),
        }
    }
}

/// 启动配置：路径列表与是否递归（与 Electron WatchConfig 对齐）
#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StartFileWatchConfig {
    pub paths: Vec<String>,
    #[serde(default)]
    pub recursive: bool,
    /// 与 `createFileOperation` 的 thumbnailSize 一致，默认 150
    #[serde(default)]
    pub thumbnail_size: Option<u32>,
}

/// 启动文件监视；若已有监视则先停止再创建新的
#[tauri::command]
pub async fn start_file_watch(
    app: tauri::AppHandle,
    config: StartFileWatchConfig,
    state: tauri::State<'_, WatchState>,
) -> Result<(), String> {
    let app_for_closure = app.clone();
    let paths = config.paths.clone();
    let recursive = config.recursive;
    let thumb = config.thumbnail_size.unwrap_or(150);
    state.coalescer.set_thumbnail_size(thumb);
    // fsevents 回调线程无 current runtime；flush 须用主 Tokio handle
    state
        .coalescer
        .set_runtime_handle(tokio::runtime::Handle::current());

    // 先停止已有监视并丢弃待合并的扫描项
    {
        let mut guard = state.watcher.lock().map_err(|e| format!("锁异常: {e}"))?;
        *guard = None;
    }
    state.coalescer.clear_pending();

    let mode = if recursive {
        RecursiveMode::Recursive
    } else {
        RecursiveMode::NonRecursive
    };

    let coalescer = state.coalescer.clone();
    let sink = TauriScanQueueSink::new(app_for_closure.clone());
    let mut watcher =
        notify::recommended_watcher(move |res: Result<notify::Event, notify::Error>| {
            let _ = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| match res {
                Ok(event) => {
                    for path in &event.paths {
                        let path_str = path.to_string_lossy().to_string();
                        if should_ignore_photasa_path(&path_str) {
                            continue;
                        }
                        let is_file = Path::new(path).is_file();
                        let payload = FileEventPayload {
                            is_file,
                            path: path_str.clone(),
                        };
                        match &event.kind {
                            EventKind::Create(create_kind) => {
                                let (event_name, is_file_override, scan_op) = match create_kind {
                                    CreateKind::File => (FILE_ADD, true, "add"),
                                    CreateKind::Folder => (FILE_ADD_DIR, false, "addDir"),
                                    _ => (FILE_ADD, is_file, "add"),
                                };
                                let _ = app_for_closure.emit(
                                    event_name,
                                    FileEventPayload {
                                        is_file: is_file_override,
                                        path: path_str.clone(),
                                    },
                                );
                                coalescer.handle_fs_event(
                                    sink.clone(),
                                    scan_op,
                                    &path_str,
                                    is_file_override,
                                );
                            }
                            EventKind::Modify(_) => {
                                let _ = app_for_closure.emit(FILE_CHANGE, payload);
                                coalescer.handle_fs_event(
                                    sink.clone(),
                                    "change",
                                    &path_str,
                                    is_file,
                                );
                            }
                            EventKind::Remove(remove_kind) => {
                                let (event_name, is_file_override, scan_op) = match remove_kind {
                                    RemoveKind::File => (FILE_UNLINK, true, "delete"),
                                    RemoveKind::Folder => (FILE_UNLINK_DIR, false, "deleteDir"),
                                    _ => (FILE_UNLINK, is_file, "delete"),
                                };
                                let _ = app_for_closure.emit(
                                    event_name,
                                    FileEventPayload {
                                        is_file: is_file_override,
                                        path: path_str.clone(),
                                    },
                                );
                                coalescer.handle_fs_event(
                                    sink.clone(),
                                    scan_op,
                                    &path_str,
                                    is_file_override,
                                );
                            }
                            _ => {}
                        }
                    }
                }
                Err(e) => {
                    let _ = app_for_closure.emit(
                        FILE_ERROR,
                        FileErrorPayload {
                            error: e.to_string(),
                        },
                    );
                }
            }));
        })
        .map_err(|e| format!("创建监视器失败: {e}"))?;

    for p in &paths {
        watcher
            .watch(Path::new(p), mode)
            .map_err(|e| format!("监视路径失败 {p}: {e}"))?;
    }

    {
        let mut guard = state.watcher.lock().map_err(|e| format!("锁异常: {e}"))?;
        *guard = Some(watcher);
    }

    let _ = app.emit(FILE_READY, ());
    Ok(())
}

/// 停止所有文件监视
#[tauri::command]
pub fn stop_file_watch(state: tauri::State<'_, WatchState>) -> Result<(), String> {
    let mut guard = state.watcher.lock().map_err(|e| format!("锁异常: {e}"))?;
    *guard = None;
    state.coalescer.clear_pending();
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn file_event_payload_serializes_camel_case_is_file() {
        let json = serde_json::to_string(&FileEventPayload {
            is_file: true,
            path: "/tmp/a.jpg".into(),
        })
        .unwrap();
        assert!(json.contains("\"isFile\":true"), "got {json}");
        assert!(!json.contains("\"is_file\""), "got {json}");
    }

    #[test]
    fn start_config_accepts_camel_case_thumbnail_size() {
        let cfg: StartFileWatchConfig =
            serde_json::from_str(r#"{"paths":["/a"],"recursive":true,"thumbnailSize":200}"#)
                .unwrap();
        assert_eq!(cfg.thumbnail_size, Some(200));
        assert_eq!(cfg.paths, vec!["/a"]);
    }
}

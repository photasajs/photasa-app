//! 扫描 worker 消息 → 状态条 `notify:status` payload（RFC 0111 / 0057 对拍）
//!
//! 规格参照 `packages/@photasa/scan/src/status/build-notify-payload.ts`；Tauri **不** import TS 包。

use serde::Serialize;

const SCAN_NOTIFY_DOMAIN: &str = "scan";

/// Worker 消息中用于构造 notify 的 action 子集
#[derive(Debug, Clone, Default)]
pub struct ScanNotifyAction {
    pub path: Option<String>,
    /// Electron worker 消息字段；当前 notify payload 未消费，保留对拍结构
    #[allow(dead_code)]
    pub is_directory: Option<bool>,
}

/// Worker progress 字段
#[derive(Debug, Clone, Copy)]
pub struct ScanNotifyProgress {
    pub processed: usize,
    pub total: usize,
}

/// 与 Electron scan-service 转发给 `buildScanNotifyPayload` 的字段子集一致
#[derive(Debug, Clone)]
pub struct ScanWorkerNotifySource {
    pub msg_type: String,
    pub error: Option<String>,
    pub action: Option<ScanNotifyAction>,
    pub progress: Option<ScanNotifyProgress>,
    /// 与 worker 一致：可为文件名或完整路径（由调用方传入）
    pub current_file: Option<String>,
}

/// 渲染进程 `notify:status` 载荷（对齐 `@photasa/common` `NotifyPayload`）
#[derive(Debug, Clone, Serialize, PartialEq)]
pub struct NotifyPayload {
    #[serde(rename = "type")]
    pub notify_type: String,
    pub task: String,
    pub status: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub data: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
    pub timestamp: u64,
}

/// 将 worker 源消息转为 notify payload；无需通知时返回 `None`
pub fn build_scan_notify_payload(source: &ScanWorkerNotifySource) -> Option<NotifyPayload> {
    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0);
    build_scan_notify_payload_at(source, timestamp)
}

/// 可注入时间戳，供单测与 TS golden 对拍
pub fn build_scan_notify_payload_at(
    source: &ScanWorkerNotifySource,
    timestamp: u64,
) -> Option<NotifyPayload> {
    match source.msg_type.as_str() {
        "error" => Some(NotifyPayload {
            notify_type: SCAN_NOTIFY_DOMAIN.to_string(),
            task: source
                .action
                .as_ref()
                .and_then(|a| a.path.clone())
                .unwrap_or_default(),
            status: "error".to_string(),
            error: Some(source.error.clone().unwrap_or_default()),
            data: None,
            timestamp,
        }),
        "complete" => Some(NotifyPayload {
            notify_type: SCAN_NOTIFY_DOMAIN.to_string(),
            task: source
                .action
                .as_ref()
                .and_then(|a| a.path.clone())
                .unwrap_or_default(),
            status: "complete".to_string(),
            data: None,
            error: None,
            timestamp,
        }),
        "progress" => {
            let task_display = source
                .current_file
                .clone()
                .or_else(|| source.action.as_ref().and_then(|a| a.path.clone()))
                .unwrap_or_default();
            Some(NotifyPayload {
                notify_type: SCAN_NOTIFY_DOMAIN.to_string(),
                task: task_display,
                status: "progress".to_string(),
                data: Some(build_progress_data(
                    source.progress.as_ref(),
                    source.current_file.as_deref(),
                )),
                error: None,
                timestamp,
            })
        }
        _ => None,
    }
}

fn build_progress_data(
    progress: Option<&ScanNotifyProgress>,
    current_file: Option<&str>,
) -> serde_json::Value {
    let mut map = serde_json::Map::new();
    if let Some(p) = progress {
        map.insert(
            "processed".into(),
            serde_json::Value::from(p.processed),
        );
        map.insert("total".into(), serde_json::Value::from(p.total));
    }
    if let Some(cf) = current_file {
        map.insert("currentFile".into(), serde_json::Value::String(cf.to_string()));
    }
    serde_json::Value::Object(map)
}

#[cfg(test)]
mod tests {
    use super::*;

    const TS: u64 = 1_773_974_400_000; // 2026-04-07T12:00:00.000Z

    fn at(source: ScanWorkerNotifySource) -> Option<NotifyPayload> {
        build_scan_notify_payload_at(&source, TS)
    }

    #[test]
    fn error_with_error_object_and_action_path() {
        let payload = at(ScanWorkerNotifySource {
            msg_type: "error".into(),
            error: Some("boom".into()),
            action: Some(ScanNotifyAction {
                path: Some("/photos".into()),
                is_directory: Some(true),
            }),
            progress: None,
            current_file: None,
        });
        assert_eq!(
            payload,
            Some(NotifyPayload {
                notify_type: "scan".into(),
                task: "/photos".into(),
                status: "error".into(),
                error: Some("boom".into()),
                data: None,
                timestamp: TS,
            })
        );
    }

    #[test]
    fn error_with_string_and_no_action() {
        let payload = at(ScanWorkerNotifySource {
            msg_type: "error".into(),
            error: Some("Directory does not exist: /x".into()),
            action: None,
            progress: None,
            current_file: None,
        });
        assert_eq!(
            payload,
            Some(NotifyPayload {
                notify_type: "scan".into(),
                task: String::new(),
                status: "error".into(),
                error: Some("Directory does not exist: /x".into()),
                data: None,
                timestamp: TS,
            })
        );
    }

    #[test]
    fn complete_with_path() {
        let payload = at(ScanWorkerNotifySource {
            msg_type: "complete".into(),
            error: None,
            action: Some(ScanNotifyAction {
                path: Some("/album".into()),
                is_directory: Some(true),
            }),
            progress: None,
            current_file: None,
        });
        assert_eq!(
            payload,
            Some(NotifyPayload {
                notify_type: "scan".into(),
                task: "/album".into(),
                status: "complete".into(),
                data: None,
                error: None,
                timestamp: TS,
            })
        );
    }

    #[test]
    fn complete_without_action() {
        let payload = at(ScanWorkerNotifySource {
            msg_type: "complete".into(),
            error: None,
            action: None,
            progress: None,
            current_file: None,
        });
        assert_eq!(
            payload,
            Some(NotifyPayload {
                notify_type: "scan".into(),
                task: String::new(),
                status: "complete".into(),
                data: None,
                error: None,
                timestamp: TS,
            })
        );
    }

    #[test]
    fn progress_prefers_current_file_over_action_path() {
        let payload = at(ScanWorkerNotifySource {
            msg_type: "progress".into(),
            error: None,
            action: Some(ScanNotifyAction {
                path: Some("/root".into()),
                is_directory: Some(true),
            }),
            progress: Some(ScanNotifyProgress {
                processed: 3,
                total: 10,
            }),
            current_file: Some("IMG_001.jpg".into()),
        });
        assert_eq!(
            payload,
            Some(NotifyPayload {
                notify_type: "scan".into(),
                task: "IMG_001.jpg".into(),
                status: "progress".into(),
                data: Some(serde_json::json!({
                    "processed": 3,
                    "total": 10,
                    "currentFile": "IMG_001.jpg",
                })),
                error: None,
                timestamp: TS,
            })
        );
    }

    #[test]
    fn progress_with_action_path_only() {
        let payload = at(ScanWorkerNotifySource {
            msg_type: "progress".into(),
            error: None,
            action: Some(ScanNotifyAction {
                path: Some("/only/path".into()),
                is_directory: Some(false),
            }),
            progress: Some(ScanNotifyProgress {
                processed: 1,
                total: 0,
            }),
            current_file: None,
        });
        assert_eq!(
            payload,
            Some(NotifyPayload {
                notify_type: "scan".into(),
                task: "/only/path".into(),
                status: "progress".into(),
                data: Some(serde_json::json!({
                    "processed": 1,
                    "total": 0,
                })),
                error: None,
                timestamp: TS,
            })
        );
    }

    #[test]
    fn progress_empty_task_when_no_path_or_current_file() {
        let payload = at(ScanWorkerNotifySource {
            msg_type: "progress".into(),
            error: None,
            action: None,
            progress: Some(ScanNotifyProgress {
                processed: 0,
                total: 0,
            }),
            current_file: None,
        });
        assert_eq!(
            payload,
            Some(NotifyPayload {
                notify_type: "scan".into(),
                task: String::new(),
                status: "progress".into(),
                data: Some(serde_json::json!({ "processed": 0, "total": 0 })),
                error: None,
                timestamp: TS,
            })
        );
    }

    #[test]
    fn progress_data_only_current_file_when_no_progress() {
        let payload = at(ScanWorkerNotifySource {
            msg_type: "progress".into(),
            error: None,
            action: None,
            progress: None,
            current_file: Some("a.png".into()),
        })
        .expect("progress notify");
        assert_eq!(
            payload.data,
            Some(serde_json::json!({ "currentFile": "a.png" }))
        );
    }

    #[test]
    fn unknown_type_returns_none() {
        assert!(at(ScanWorkerNotifySource {
            msg_type: "heartbeat".into(),
            error: None,
            action: None,
            progress: None,
            current_file: None,
        })
        .is_none());
    }
}

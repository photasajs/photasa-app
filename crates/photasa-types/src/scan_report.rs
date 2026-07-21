//! 扫描 IPC 契约上报类型（RFC 0136 / RFC 0111）

use serde::{Deserialize, Serialize};
use ts_rs::TS;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, TS)]
#[ts(export, export_to = "../../../packages/@photasa/common/src/gen/scan_file_payload.ts")]
#[serde(rename_all = "camelCase")]
pub struct ScanFilePayload {
    pub path: String,
    pub is_directory: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, TS)]
#[ts(export, export_to = "../../../packages/@photasa/common/src/gen/scan_progress_payload.ts")]
#[serde(rename_all = "camelCase")]
pub struct ScanProgressPayload {
    pub processed: usize,
    pub total: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, TS)]
#[ts(export, export_to = "../../../packages/@photasa/common/src/gen/scan_directory_payload.ts")]
#[serde(rename_all = "camelCase")]
pub struct ScanDirectoryPayload {
    pub path: String,
    pub is_directory: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, TS)]
#[ts(export, export_to = "../../../packages/@photasa/common/src/gen/scan_report.ts")]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum ScanReport {
    #[serde(rename = "file", rename_all = "camelCase")]
    File {
        request_id: String,
        root_path: String,
        file: ScanFilePayload,
        progress: ScanProgressPayload,
    },
    #[serde(rename = "directory", rename_all = "camelCase")]
    Directory {
        request_id: String,
        root_path: String,
        directory: ScanDirectoryPayload,
    },
    #[serde(rename = "complete", rename_all = "camelCase")]
    Complete {
        request_id: String,
        root_path: String,
    },
    #[serde(rename = "error", rename_all = "camelCase")]
    Error {
        request_id: String,
        root_path: String,
        error: String,
    },
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn export_ts_types() {
        use ts_rs::TS;
        ScanFilePayload::export_all().unwrap();
        ScanProgressPayload::export_all().unwrap();
        ScanDirectoryPayload::export_all().unwrap();
        ScanReport::export_all().unwrap();
    }

    #[test]
    fn test_scan_report_serialization() {
        let file_report = ScanReport::File {
            request_id: "req-123".into(),
            root_path: "/photos".into(),
            file: ScanFilePayload {
                path: "/photos/a.jpg".into(),
                is_directory: false,
            },
            progress: ScanProgressPayload {
                processed: 1,
                total: 5,
            },
        };
        let json = serde_json::to_string(&file_report).unwrap();
        assert!(json.contains(r#""type":"file""#));
        assert!(json.contains(r#""requestId":"req-123""#));
        assert!(json.contains(r#""rootPath":"/photos""#));
        assert!(json.contains(r#""isDirectory":false"#));

        let dir_report = ScanReport::Directory {
            request_id: "req-123".into(),
            root_path: "/photos".into(),
            directory: ScanDirectoryPayload {
                path: "/photos/sub".into(),
                is_directory: true,
            },
        };
        let json_dir = serde_json::to_string(&dir_report).unwrap();
        assert!(json_dir.contains(r#""type":"directory""#));
        assert!(json_dir.contains(r#""isDirectory":true"#));
    }
}

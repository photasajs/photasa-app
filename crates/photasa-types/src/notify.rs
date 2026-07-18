use serde::Serialize;

#[derive(Debug, Clone, Default)]
pub struct ScanNotifyAction {
    pub path: Option<String>,
    pub is_directory: Option<bool>,
}

#[derive(Debug, Clone, Copy)]
pub struct ScanNotifyProgress {
    pub processed: usize,
    pub total: usize,
}

#[derive(Debug, Clone)]
pub struct ScanWorkerNotifySource {
    pub msg_type: String,
    pub error: Option<String>,
    pub action: Option<ScanNotifyAction>,
    pub progress: Option<ScanNotifyProgress>,
    pub current_file: Option<String>,
}

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

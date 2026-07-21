use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ScanAction {
    pub path: String,
    #[serde(default)]
    pub operation_type: String,
    #[serde(default)]
    pub action: String,
    pub thumbnail_size: Option<u32>,
    #[serde(default)]
    pub is_directory: bool,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PhotoFileRequest {
    pub path: String,
    pub thumbnail: String,
    pub is_image: bool,
    pub is_video: bool,
    pub is_directory: bool,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ScanParamValidation {
    pub is_valid: bool,
    pub error: Option<String>,
}

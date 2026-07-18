use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, Deserialize, Serialize, PartialEq, Eq, Hash)]
#[serde(rename_all = "camelCase")]
pub enum FileOperationType {
    Add,
    Change,
    Delete,
    AddDir,
    DeleteDir,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct FileOperationMetadata {
    pub thumbnail_size: u32,
    pub is_file: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub original_path: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub file_size: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_modified: Option<u64>,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct FileOperation {
    pub id: String,
    #[serde(rename = "type")]
    pub operation_type: FileOperationType,
    pub path: String,
    pub timestamp: u64,
    pub priority: i64,
    pub retry_count: u32,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub metadata: Option<FileOperationMetadata>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn serializes_common_file_operation_shape() {
        let operation = FileOperation {
            id: "op-1".into(),
            operation_type: FileOperationType::AddDir,
            path: "/photos".into(),
            timestamp: 10,
            priority: 4,
            retry_count: 0,
            metadata: Some(FileOperationMetadata {
                thumbnail_size: 150,
                is_file: false,
                original_path: None,
                file_size: None,
                last_modified: Some(10),
            }),
        };

        let value = serde_json::to_value(operation).expect("serialize operation");
        assert_eq!(value["type"], "addDir");
        assert_eq!(value["retryCount"], 0);
        assert_eq!(value["metadata"]["thumbnailSize"], 150);
        assert_eq!(value["metadata"]["isFile"], false);
        assert_eq!(value["metadata"]["lastModified"], 10);
    }

    #[test]
    fn deserializes_common_file_operation_shape() {
        let raw = serde_json::json!({
            "id": "op-2",
            "type": "change",
            "path": "/photos/a.jpg",
            "timestamp": 20,
            "priority": 2,
            "retryCount": 1,
            "metadata": {
                "thumbnailSize": 256,
                "isFile": true,
                "originalPath": "/old/a.jpg",
                "fileSize": 100,
                "lastModified": 19
            }
        });

        let operation: FileOperation = serde_json::from_value(raw).expect("deserialize operation");
        assert_eq!(operation.operation_type, FileOperationType::Change);
        assert_eq!(operation.retry_count, 1);
        assert_eq!(
            operation.metadata.expect("metadata").original_path,
            Some("/old/a.jpg".into())
        );
    }
}

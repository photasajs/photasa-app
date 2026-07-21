//! 扫描队列错误（RFC 0144：扫描域不依赖 zouwu_core）

use std::io;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum ScanQueueError {
    #[error("IO 错误: {0}")]
    Io(#[from] io::Error),

    #[error("JSON 序列化错误: {0}")]
    Serialization(#[from] serde_json::Error),

    #[error("无效输入: {0}")]
    InvalidInput(String),

    #[error("非法任务状态: {0}")]
    InvalidStatus(String),

    #[error("队列项必须是 JSON 对象")]
    InvalidQueueItem,
}

impl ScanQueueError {
    pub fn invalid_input(message: impl Into<String>) -> Self {
        Self::InvalidInput(message.into())
    }
}

pub type ScanQueueResult<T> = Result<T, ScanQueueError>;

pub fn scan_queue_error_string(error: ScanQueueError) -> String {
    error.to_string()
}

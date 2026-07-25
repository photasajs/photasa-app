//! 扫描队列变更回执：突变命令只返回长度/版本，不传全量 queue（避免 IPC 阻塞 UI）

use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScanQueueAck {
    pub queue_len: usize,
    pub revision: u64,
}

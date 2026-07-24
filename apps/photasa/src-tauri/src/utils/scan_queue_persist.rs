//! 扫描队列防抖落盘：内存 SSOT 立即更新，磁盘写入合并到后台任务（RFC 0144 扩展）

use crate::utils::scan_queue_error::ScanQueueResult;
use crate::utils::scan_queue_storage::build_scanning_queue_document;
use serde_json::Value;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::{Mutex, Notify};

/// 默认防抖：批量目录发现时避免每条入队都重写 2000+ 项 JSON
pub const DEFAULT_PERSIST_DEBOUNCE: Duration = Duration::from_millis(300);

/// 合并多次 `schedule` 为一次原子写盘
pub struct PersistCoalescer {
    path: PathBuf,
    debounce: Duration,
    latest: Mutex<Option<Vec<Value>>>,
    notify: Notify,
    worker_started: AtomicBool,
    flushing: Mutex<()>,
}

impl PersistCoalescer {
    pub fn new(path: PathBuf, debounce: Duration) -> Arc<Self> {
        Arc::new(Self {
            path,
            debounce,
            latest: Mutex::new(None),
            notify: Notify::new(),
            worker_started: AtomicBool::new(false),
            flushing: Mutex::new(()),
        })
    }

    fn ensure_worker(self: &Arc<Self>) {
        if self
            .worker_started
            .compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst)
            .is_err()
        {
            return;
        }
        let coalescer = Arc::clone(self);
        tokio::spawn(async move {
            coalescer.worker_loop().await;
        });
    }

    /// 排队落盘；不阻塞调用方等待磁盘 I/O
    pub async fn schedule(self: &Arc<Self>, queue: Vec<Value>) {
        {
            let mut guard = self.latest.lock().await;
            *guard = Some(queue);
        }
        self.ensure_worker();
        self.notify.notify_one();
    }

    /// 测试 / 退出前：立即将当前内存快照写入磁盘
    pub async fn flush_now(self: &Arc<Self>, queue: &[Value]) -> ScanQueueResult<()> {
        let _flush_guard = self.flushing.lock().await;
        {
            let mut pending = self.latest.lock().await;
            *pending = None;
        }
        persist_queue_atomic(&self.path, queue).await
    }

    async fn worker_loop(self: Arc<Self>) {
        loop {
            self.notify.notified().await;

            while tokio::time::timeout(self.debounce, self.notify.notified())
                .await
                .is_ok()
            {}

            let snapshot = {
                let mut guard = self.latest.lock().await;
                guard.take()
            };

            let Some(queue) = snapshot else {
                continue;
            };

            let _flush_guard = self.flushing.lock().await;
            if let Err(error) = persist_queue_atomic(&self.path, &queue).await {
                log::error!("🌌 千里眼：扫描队列落盘失败 {} — {error}", self.path.display());
                let mut guard = self.latest.lock().await;
                if guard.is_none() {
                    *guard = Some(queue);
                }
                self.notify.notify_one();
            }
        }
    }
}

/// tmp 写入 + rename；紧凑 JSON（无 pretty）以降低 CPU/体积
pub async fn persist_queue_atomic(path: &Path, queue: &[Value]) -> ScanQueueResult<()> {
    if let Some(parent) = path.parent() {
        tokio::fs::create_dir_all(parent).await?;
    }

    let tmp_path = path.with_extension("json.tmp");
    let payload = build_scanning_queue_document(queue);
    let serialized = serde_json::to_string(&payload)?;
    tokio::fs::write(&tmp_path, serialized).await?;
    tokio::fs::rename(&tmp_path, path).await?;

    log::debug!(
        "🌌 千里眼：扫描队列已持久化 {} 项 -> {}",
        queue.len(),
        path.display()
    );
    Ok(())
}

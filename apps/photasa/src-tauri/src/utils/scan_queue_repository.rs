//! 扫描队列单写者仓库（RFC 0144）
//!
//! 内存 SSOT + `Mutex` 串行 mutation + 防抖异步落盘；突变 IPC 仅返回 `ScanQueueAck`（不传全量 queue）。

use crate::utils::scan_queue_ack::ScanQueueAck;
use crate::utils::scan_queue_error::{ScanQueueError, ScanQueueResult};
use crate::utils::scan_queue_persist::{PersistCoalescer, DEFAULT_PERSIST_DEBOUNCE};
use crate::utils::scan_queue_storage::{action_path, queue_contains_path, scanning_queue_path};
use serde_json::Value;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::Mutex;

const VALID_STATUSES: &[&str] = &["pending", "processing", "failed"];

pub type ScanQueueRepositoryHandle = Arc<ScanQueueRepository>;

/// 进程内唯一扫描队列写入口
pub struct ScanQueueRepository {
    inner: Mutex<Vec<Value>>,
    path: PathBuf,
    disk_load_failed: Mutex<bool>,
    coalescer: Arc<PersistCoalescer>,
    revision: AtomicU64,
}

impl ScanQueueRepository {
    pub fn empty_at(path: PathBuf) -> Self {
        Self::empty_at_with_debounce(path, DEFAULT_PERSIST_DEBOUNCE)
    }

    pub fn empty_at_with_debounce(path: PathBuf, debounce: Duration) -> Self {
        Self {
            inner: Mutex::new(Vec::new()),
            path: path.clone(),
            disk_load_failed: Mutex::new(true),
            coalescer: PersistCoalescer::new(path, debounce),
            revision: AtomicU64::new(0),
        }
    }

    pub fn load_default() -> ScanQueueResult<Self> {
        Self::load_at(scanning_queue_path())
    }

    pub fn load_at(path: PathBuf) -> ScanQueueResult<Self> {
        Self::load_at_with_debounce(path, DEFAULT_PERSIST_DEBOUNCE)
    }

    pub fn load_at_with_debounce(path: PathBuf, debounce: Duration) -> ScanQueueResult<Self> {
        let queue = load_queue_from_disk(&path)?;
        Ok(Self {
            inner: Mutex::new(queue),
            path: path.clone(),
            disk_load_failed: Mutex::new(false),
            coalescer: PersistCoalescer::new(path, debounce),
            revision: AtomicU64::new(0),
        })
    }

    pub fn queue_path(&self) -> &Path {
        &self.path
    }

    pub async fn get(&self) -> ScanQueueResult<Vec<Value>> {
        self.reload_from_disk_if_needed().await?;
        Ok(self.inner.lock().await.clone())
    }

    pub async fn flush_persist(&self) -> ScanQueueResult<()> {
        let snapshot = self.inner.lock().await.clone();
        self.coalescer.flush_now(&snapshot).await
    }

    async fn reload_from_disk_if_needed(&self) -> ScanQueueResult<()> {
        let needs_reload = *self.disk_load_failed.lock().await;
        if !needs_reload {
            return Ok(());
        }

        match load_queue_from_disk(&self.path) {
            Ok(queue) => {
                let mut guard = self.inner.lock().await;
                *guard = queue;
                *self.disk_load_failed.lock().await = false;
                log::info!(
                    "🌌 千里眼：扫描队列已从磁盘恢复 {} 项 -> {}",
                    guard.len(),
                    self.path.display()
                );
                Ok(())
            }
            Err(error) => Err(error),
        }
    }

    pub async fn add_actions(&self, actions: &[Value]) -> ScanQueueResult<ScanQueueAck> {
        self.mutate(|queue| {
            for action in actions {
                let Some(path) = action_path(action) else {
                    continue;
                };
                if queue_contains_path(queue, path) {
                    continue;
                }
                queue.push(action.clone());
            }
            Ok(())
        })
        .await
    }

    pub async fn remove_action(&self, path: &str) -> ScanQueueResult<ScanQueueAck> {
        let clean_path = path.trim_end_matches('/');
        self.mutate(|queue| {
            queue.retain(|item| {
                if let Some(item_p) = action_path(item) {
                    item_p.trim_end_matches('/') != clean_path
                } else {
                    true
                }
            });
            Ok(())
        })
        .await
    }

    pub async fn update_action_status(
        &self,
        path: &str,
        status: &str,
        updates: &Value,
    ) -> ScanQueueResult<ScanQueueAck> {
        if !VALID_STATUSES.contains(&status) {
            return Err(ScanQueueError::InvalidStatus(status.to_string()));
        }

        let clean_path = path.trim_end_matches('/');
        self.mutate(|queue| {
            let index = queue
                .iter()
                .position(|item| action_path(item).map(|p| p.trim_end_matches('/')) == Some(clean_path))
                .ok_or_else(|| ScanQueueError::invalid_input(format!("任务不存在: {path}")))?;

            let mut task = queue[index]
                .as_object()
                .cloned()
                .ok_or(ScanQueueError::InvalidQueueItem)?;
            task.insert("status".to_string(), Value::String(status.to_string()));
            if let Some(patch) = updates.as_object() {
                for (key, value) in patch {
                    task.insert(key.clone(), value.clone());
                }
            }
            queue[index] = Value::Object(task);
            Ok(())
        })
        .await
    }

    async fn mutate<F>(&self, mutate_fn: F) -> ScanQueueResult<ScanQueueAck>
    where
        F: FnOnce(&mut Vec<Value>) -> ScanQueueResult<()>,
    {
        let mut guard = self.inner.lock().await;
        mutate_fn(&mut guard)?;
        let queue_len = guard.len();
        let snapshot = guard.clone();
        drop(guard);

        self.coalescer.schedule(snapshot).await;
        Ok(self.next_ack(queue_len))
    }

    fn next_ack(&self, queue_len: usize) -> ScanQueueAck {
        let revision = self.revision.fetch_add(1, Ordering::SeqCst) + 1;
        ScanQueueAck {
            queue_len,
            revision,
        }
    }
}

fn load_queue_from_disk(path: &Path) -> ScanQueueResult<Vec<Value>> {
    match std::fs::read_to_string(path) {
        Ok(content) => {
            let parsed: Value = serde_json::from_str(&content)?;
            Ok(parsed
                .get("queue")
                .and_then(|v| v.as_array())
                .cloned()
                .unwrap_or_default())
        }
        Err(err) if err.kind() == std::io::ErrorKind::NotFound => Ok(vec![]),
        Err(err) => Err(ScanQueueError::Io(err)),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    use std::time::Duration;
    use uuid::Uuid;

    fn temp_queue_file() -> PathBuf {
        std::env::temp_dir().join(format!(
            "photasa-scan-queue-repo-{}-{}",
            std::process::id(),
            Uuid::new_v4()
        ))
    }

    async fn flush_repo(repo: &ScanQueueRepository) {
        repo.flush_persist().await.expect("flush persist");
    }

    #[tokio::test]
    async fn concurrent_add_preserves_both_items() {
        let path = temp_queue_file();
        let repo = Arc::new(
            ScanQueueRepository::load_at_with_debounce(path.clone(), Duration::ZERO)
                .expect("empty repo"),
        );

        let parent = repo.clone();
        let child = repo.clone();
        let parent_action = json!({
            "path": "/parent",
            "action": "scan",
            "source": "user",
            "status": "pending"
        });
        let child_action = json!({
            "path": "/child",
            "action": "scan",
            "source": "discovered",
            "status": "pending"
        });
        let parent_actions = [parent_action];
        let child_actions = [child_action];
        let (parent_result, child_result) = tokio::join!(
            parent.add_actions(&parent_actions),
            child.add_actions(&child_actions)
        );

        let parent_ack = parent_result.expect("parent add");
        let child_ack = child_result.expect("child add");
        // Ack 反映各次 mutation 完成时的长度；并发下先后不定，但合计应为 1+2
        assert_eq!(parent_ack.queue_len + child_ack.queue_len, 3);
        assert!(
            (parent_ack.queue_len == 1 && child_ack.queue_len == 2)
                || (parent_ack.queue_len == 2 && child_ack.queue_len == 1)
        );
        flush_repo(&repo).await;

        let queue = repo.get().await.expect("get queue");
        assert_eq!(queue.len(), 2);

        let disk = load_queue_from_disk(&path).expect("disk read");
        assert_eq!(disk.len(), 2);

        let _ = tokio::fs::remove_file(&path).await;
    }

    #[tokio::test]
    async fn concurrent_add_and_update_both_preserved() {
        let path = temp_queue_file();
        let repo = Arc::new(
            ScanQueueRepository::load_at_with_debounce(path.clone(), Duration::ZERO)
                .expect("empty repo"),
        );

        repo.add_actions(&[json!({
            "path": "/existing",
            "action": "scan",
            "status": "pending"
        })])
        .await
        .expect("seed");
        flush_repo(&repo).await;

        let updater = repo.clone();
        let adder = repo.clone();
        let updates = json!({ "startedAt": 1_700_000_000_001_i64 });
        let new_actions = [json!({
            "path": "/new-child",
            "action": "scan",
            "status": "pending"
        })];
        let (update_result, add_result) = tokio::join!(
            updater.update_action_status("/existing", "processing", &updates),
            adder.add_actions(&new_actions)
        );

        update_result.expect("update");
        assert_eq!(add_result.expect("add").queue_len, 2);
        flush_repo(&repo).await;

        let queue = repo.get().await.expect("get queue");
        assert_eq!(queue.len(), 2);

        let existing = queue
            .iter()
            .find(|item| action_path(item) == Some("/existing"))
            .expect("existing");
        assert_eq!(existing["status"], "processing");

        let _ = tokio::fs::remove_file(&path).await;
    }

    #[tokio::test]
    async fn rejects_invalid_status() {
        let path = temp_queue_file();
        let repo = ScanQueueRepository::load_at_with_debounce(path.clone(), Duration::ZERO)
            .expect("empty repo");
        repo.add_actions(&[json!({ "path": "/x", "action": "scan", "status": "pending" })])
            .await
            .expect("add");

        let err = repo
            .update_action_status("/x", "completed", &Value::Null)
            .await
            .expect_err("completed invalid");
        assert!(matches!(err, ScanQueueError::InvalidStatus(_)));

        let _ = tokio::fs::remove_file(&path).await;
    }

    #[tokio::test]
    async fn debounced_persist_coalesces_rapid_adds() {
        let path = temp_queue_file();
        let repo = Arc::new(
            ScanQueueRepository::load_at_with_debounce(path.clone(), Duration::from_millis(200))
                .expect("empty repo"),
        );

        for index in 0..20 {
            let ack = repo
                .add_actions(&[json!({
                    "path": format!("/folder-{index}"),
                    "action": "scan",
                    "status": "pending"
                })])
                .await
                .expect("add");
            assert_eq!(ack.queue_len, index + 1);
        }

        flush_repo(&repo).await;
        let disk = load_queue_from_disk(&path).expect("disk");
        assert_eq!(disk.len(), 20);

        let _ = tokio::fs::remove_file(&path).await;
    }

    #[tokio::test]
    async fn mutation_returns_ack_not_full_queue() {
        let path = temp_queue_file();
        let repo = ScanQueueRepository::load_at(path).expect("empty repo");
        let ack = repo
            .add_actions(&[json!({ "path": "/only", "action": "scan", "status": "pending" })])
            .await
            .expect("add");
        assert_eq!(ack.queue_len, 1);
        assert!(ack.revision >= 1);
    }
}

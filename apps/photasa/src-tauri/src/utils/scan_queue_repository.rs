//! 扫描队列单写者仓库（RFC 0144）
//!
//! 内存 SSOT + `Mutex` 串行 mutation + `scanning.json` 原子落盘（非 DB）。

use crate::utils::scan_queue_error::{ScanQueueError, ScanQueueResult};
use crate::utils::scan_queue_storage::{
    action_path, build_scanning_queue_document, extract_queue_array, queue_contains_path,
    scanning_queue_path,
};
use serde_json::Value;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use tokio::sync::Mutex;

const VALID_STATUSES: &[&str] = &["pending", "processing", "failed"];

pub type ScanQueueRepositoryHandle = Arc<ScanQueueRepository>;

/// 进程内唯一扫描队列写入口
pub struct ScanQueueRepository {
    inner: Mutex<Vec<Value>>,
    path: PathBuf,
    /// 启动时磁盘加载失败：GET 前尝试重新加载，避免空内存覆盖已有 scanning.json
    disk_load_failed: Mutex<bool>,
}

impl ScanQueueRepository {
    pub fn empty_at(path: PathBuf) -> Self {
        Self {
            inner: Mutex::new(Vec::new()),
            path,
            disk_load_failed: Mutex::new(true),
        }
    }

    /// 从默认路径 `~/.photasa/scan/scanning.json` 加载
    pub fn load_default() -> ScanQueueResult<Self> {
        Self::load_at(scanning_queue_path())
    }

    pub fn load_at(path: PathBuf) -> ScanQueueResult<Self> {
        let queue = load_queue_from_disk(&path)?;
        Ok(Self {
            inner: Mutex::new(queue),
            path,
            disk_load_failed: Mutex::new(false),
        })
    }

    pub fn queue_path(&self) -> &Path {
        &self.path
    }

    pub async fn get(&self) -> ScanQueueResult<Vec<Value>> {
        self.reload_from_disk_if_needed().await?;
        Ok(self.inner.lock().await.clone())
    }

    /// 启动加载失败时，首次读前从磁盘恢复，避免空内存当 SSOT
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

    /// 对齐 Electron `get_scanning_queue` / `restoreQueue`
    pub async fn get_json_array(&self) -> ScanQueueResult<Value> {
        Ok(Value::Array(self.get().await?))
    }

    /// 对齐 Electron `add_scan_action`
    pub async fn add_actions(&self, actions: &[Value]) -> ScanQueueResult<Vec<Value>> {
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

    /// 对齐 Electron `remove_scan_action`
    pub async fn remove_action(&self, path: &str) -> ScanQueueResult<Vec<Value>> {
        self.mutate(|queue| {
            queue.retain(|item| action_path(item) != Some(path));
            Ok(())
        })
        .await
    }

    /// 对齐 Electron `update_scan_action_status`
    pub async fn update_action_status(
        &self,
        path: &str,
        status: &str,
        updates: &Value,
    ) -> ScanQueueResult<Vec<Value>> {
        if !VALID_STATUSES.contains(&status) {
            return Err(ScanQueueError::InvalidStatus(status.to_string()));
        }

        self.mutate(|queue| {
            let index = queue
                .iter()
                .position(|item| action_path(item) == Some(path))
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

    /// 千里眼 legacy `persistQueue`：整表替换
    pub async fn replace_all(&self, input: Value) -> ScanQueueResult<Vec<Value>> {
        let queue = extract_queue_array(&input)?;
        self.mutate(|current| {
            *current = queue;
            Ok(())
        })
        .await
    }

    /// 千里眼 legacy `persistQueue` 副作用包装
    pub async fn persist_external(&self, input: Value) -> ScanQueueResult<Value> {
        let queue = self.replace_all(input).await?;
        Ok(serde_json::json!({ "success": true, "queueSize": queue.len() }))
    }

    /// 单写者临界区：内存修改 + 原子落盘
    async fn mutate<F>(&self, mutate_fn: F) -> ScanQueueResult<Vec<Value>>
    where
        F: FnOnce(&mut Vec<Value>) -> ScanQueueResult<()>,
    {
        let mut guard = self.inner.lock().await;
        mutate_fn(&mut guard)?;
        persist_queue_atomic(&self.path, &guard).await?;
        Ok(guard.clone())
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

/// tmp 写入 + rename，避免半写损坏 JSON
async fn persist_queue_atomic(path: &Path, queue: &[Value]) -> ScanQueueResult<()> {
    if let Some(parent) = path.parent() {
        tokio::fs::create_dir_all(parent).await?;
    }

    let tmp_path = path.with_extension("json.tmp");
    let payload = build_scanning_queue_document(queue);
    let serialized = serde_json::to_string_pretty(&payload)?;
    tokio::fs::write(&tmp_path, serialized).await?;

    // POSIX rename 原子替换目标文件；先 delete 会在崩溃时丢队列
    tokio::fs::rename(&tmp_path, path).await?;

    log::info!(
        "🌌 千里眼：扫描队列已持久化 {} 项 -> {}",
        queue.len(),
        path.display()
    );
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    use uuid::Uuid;

    fn temp_queue_file() -> PathBuf {
        std::env::temp_dir().join(format!(
            "photasa-scan-queue-repo-{}-{}",
            std::process::id(),
            Uuid::new_v4()
        ))
    }

    #[tokio::test]
    async fn concurrent_add_preserves_both_items() {
        let path = temp_queue_file();
        let repo = Arc::new(ScanQueueRepository::load_at(path.clone()).expect("empty repo"));

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

        parent_result.expect("parent add");
        child_result.expect("child add");

        let queue = repo.get().await.expect("get queue");
        assert_eq!(queue.len(), 2);
        assert!(queue.iter().any(|item| action_path(item) == Some("/parent")));
        assert!(queue.iter().any(|item| action_path(item) == Some("/child")));

        let disk = load_queue_from_disk(&path).expect("disk read");
        assert_eq!(disk.len(), 2);

        let _ = tokio::fs::remove_file(&path).await;
        let _ = tokio::fs::remove_file(path.with_extension("json.tmp")).await;
    }

    #[tokio::test]
    async fn concurrent_add_and_update_both_preserved() {
        let path = temp_queue_file();
        let repo = Arc::new(ScanQueueRepository::load_at(path.clone()).expect("empty repo"));

        repo.add_actions(&[json!({
            "path": "/existing",
            "action": "scan",
            "status": "pending"
        })])
        .await
        .expect("seed");

        let updater = repo.clone();
        let adder = repo.clone();
        let updates = json!({ "startedAt": 1_700_000_000_001_i64 });
        let new_child = json!({
            "path": "/new-child",
            "action": "scan",
            "status": "pending"
        });
        let new_child_actions = [new_child];
        let (update_result, add_result) = tokio::join!(
            updater.update_action_status("/existing", "processing", &updates),
            adder.add_actions(&new_child_actions)
        );

        update_result.expect("update");
        add_result.expect("add");

        let queue = repo.get().await.expect("get queue");
        assert_eq!(queue.len(), 2);

        let existing = queue
            .iter()
            .find(|item| action_path(item) == Some("/existing"))
            .expect("existing");
        assert_eq!(existing["status"], "processing");
        assert!(queue.iter().any(|item| action_path(item) == Some("/new-child")));

        let _ = tokio::fs::remove_file(&path).await;
    }

    #[tokio::test]
    async fn rejects_invalid_status() {
        let path = temp_queue_file();
        let repo = ScanQueueRepository::load_at(path.clone()).expect("empty repo");
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
}

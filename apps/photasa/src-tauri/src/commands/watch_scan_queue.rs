//! 将文件监视事件合并为 `picasa:add-to-scan-queue` 载荷（与 Electron `WatchService` 对齐）

use serde_json::{json, Value};
use std::collections::HashMap;
use std::sync::atomic::{AtomicU32, AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Emitter};
use uuid::Uuid;

/// 与 `packages/common/src/constants.ts` 中 `FileOperationPriorities` 一致
fn event_priority(op_type: &str) -> i64 {
    match op_type {
        "delete" | "deleteDir" => 1,
        "change" => 2,
        "add" => 3,
        "addDir" => 4,
        _ => 5,
    }
}

/// 与 `getDeduplicationWindow` 一致
fn deduplication_window_ms(op_type: &str) -> u64 {
    match op_type {
        "add" => 50,
        "change" => 200,
        "delete" => 100,
        "addDir" => 100,
        "deleteDir" => 100,
        _ => 100,
    }
}

/// 与 `calculateDebounceTime` 一致
fn calculate_debounce_ms(pending_count: usize) -> u64 {
    if pending_count > 1000 {
        50
    } else if pending_count > 100 {
        100
    } else {
        200
    }
}

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

fn generate_operation_id() -> String {
    format!("{}-{}", now_ms(), Uuid::new_v4())
}

fn build_file_operation(
    op_type: &str,
    path: &str,
    is_file: bool,
    thumbnail_size: u32,
) -> Value {
    let t = now_ms();
    json!({
        "id": generate_operation_id(),
        "type": op_type,
        "path": path,
        "timestamp": t,
        "priority": event_priority(op_type),
        "retryCount": 0,
        "metadata": {
            "thumbnailSize": thumbnail_size,
            "isFile": is_file,
            "lastModified": t,
        }
    })
}

fn should_deduplicate(existing_ts: u64, current: u64, window_ms: u64) -> bool {
    current.saturating_sub(existing_ts) < window_ms
}

struct ScanQueueInner {
    pending: Mutex<HashMap<String, Value>>,
    schedule_token: AtomicU64,
    thumbnail_size: AtomicU32,
}

/// 与 `WatchService.pendingEvents` + 防抖调度等价
#[derive(Clone)]
pub struct ScanQueueCoalescer {
    inner: Arc<ScanQueueInner>,
}

impl ScanQueueCoalescer {
    pub fn new() -> Self {
        Self {
            inner: Arc::new(ScanQueueInner {
                pending: Mutex::new(HashMap::new()),
                schedule_token: AtomicU64::new(0),
                thumbnail_size: AtomicU32::new(150),
            }),
        }
    }

    pub fn set_thumbnail_size(&self, size: u32) {
        self.inner.thumbnail_size.store(size, Ordering::SeqCst);
    }

    /// 停止监视时丢弃待合并项并作废已调度的 flush
    pub fn clear_pending(&self) {
        if let Ok(mut g) = self.inner.pending.lock() {
            g.clear();
        }
        self.inner.schedule_token.fetch_add(1, Ordering::SeqCst);
    }

    /// 由 `watch` 回调线程调用：合并去重并调度防抖发射
    pub fn handle_fs_event(&self, app: &AppHandle, op_type: &str, path: &str, is_file: bool) {
        let key = format!("{op_type}:{path}");
        let now = now_ms();
        let window = deduplication_window_ms(op_type);
        let thumb = self.inner.thumbnail_size.load(Ordering::SeqCst);

        {
            let mut guard = match self.inner.pending.lock() {
                Ok(g) => g,
                Err(e) => {
                    log::warn!("🌌 扫描队列锁异常：{e}");
                    return;
                }
            };

            if let Some(existing) = guard.get(&key) {
                if let Some(ts) = existing.get("timestamp").and_then(|v| v.as_u64()) {
                    if should_deduplicate(ts, now, window) {
                        if let Some(obj) = existing.as_object() {
                            let mut updated = obj.clone();
                            updated.insert("timestamp".to_string(), json!(now));
                            if let Some(meta) = updated.get_mut("metadata").and_then(|m| m.as_object_mut()) {
                                meta.insert("lastModified".to_string(), json!(now));
                            }
                            guard.insert(key, Value::Object(updated));
                        }
                        return;
                    }
                }
            }

            let op = build_file_operation(op_type, path, is_file, thumb);
            guard.insert(key, op);
        }

        self.schedule_flush(app.clone());
    }

    fn schedule_flush(&self, app: AppHandle) {
        let my_token = self.inner.schedule_token.fetch_add(1, Ordering::SeqCst) + 1;
        let debounce_ms = {
            let n = self
                .inner
                .pending
                .lock()
                .map(|g| g.len())
                .unwrap_or(0);
            calculate_debounce_ms(n)
        };
        let inner = self.inner.clone();
        tauri::async_runtime::spawn(async move {
            tokio::time::sleep(std::time::Duration::from_millis(debounce_ms)).await;
            if inner.schedule_token.load(Ordering::SeqCst) != my_token {
                return;
            }
            let batch: Vec<Value> = match inner.pending.lock() {
                Ok(mut g) => {
                    let v: Vec<Value> = g.values().cloned().collect();
                    g.clear();
                    v
                }
                Err(_) => return,
            };
            if batch.is_empty() {
                return;
            }
            if let Err(e) = app.emit("picasa:add-to-scan-queue", &batch) {
                log::warn!("🌌 发射 picasa:add-to-scan-queue 失败：{e}");
            }
        });
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn priority_matches_common_constants() {
        assert_eq!(event_priority("delete"), 1);
        assert_eq!(event_priority("deleteDir"), 1);
        assert_eq!(event_priority("change"), 2);
        assert_eq!(event_priority("add"), 3);
        assert_eq!(event_priority("addDir"), 4);
        assert_eq!(event_priority("unknown"), 5);
    }

    #[test]
    fn dedup_window_matches_common() {
        assert_eq!(deduplication_window_ms("add"), 50);
        assert_eq!(deduplication_window_ms("change"), 200);
        assert_eq!(deduplication_window_ms("delete"), 100);
        assert_eq!(deduplication_window_ms("addDir"), 100);
        assert_eq!(deduplication_window_ms("deleteDir"), 100);
        assert_eq!(deduplication_window_ms("other"), 100);
    }

    #[test]
    fn debounce_ms_tiers() {
        assert_eq!(calculate_debounce_ms(2000), 50);
        assert_eq!(calculate_debounce_ms(500), 100);
        assert_eq!(calculate_debounce_ms(50), 200);
    }

    #[test]
    fn should_deduplicate_respects_window() {
        assert!(should_deduplicate(1000, 1005, 200));
        assert!(!should_deduplicate(1000, 1300, 200));
    }
}

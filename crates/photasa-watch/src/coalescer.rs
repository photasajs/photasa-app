//! 扫描队列合并器：pending map + 防抖 flush（对齐 legacy-api `WatchService`）

use crate::debounce::calculate_debounce_ms;
use crate::dedupe::{deduplication_window_ms, should_deduplicate};
use crate::parse_operation_type;
use crate::priority::event_priority_typed;
use photasa_types::{FileOperation, FileOperationMetadata, FileOperationType};
use std::collections::HashMap;
use std::sync::atomic::{AtomicU32, AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{SystemTime, UNIX_EPOCH};
use uuid::Uuid;

/// 由 Tauri（或测试）实现：把合并后的 `FileOperation[]` 交给前端
pub trait ScanQueueSink: Send + Sync {
 fn emit_batch(&self, ops: &[FileOperation]);
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
 op_type: FileOperationType,
 path: &str,
 is_file: bool,
 thumbnail_size: u32,
) -> FileOperation {
 let t = now_ms();
 FileOperation {
 id: generate_operation_id(),
 operation_type: op_type,
 path: path.to_string(),
 timestamp: t,
 priority: event_priority_typed(op_type),
 retry_count: 0,
 metadata: Some(FileOperationMetadata {
 thumbnail_size,
 is_file,
 original_path: None,
 file_size: None,
 last_modified: Some(t),
 }),
 }
}

struct ScanQueueInner {
 pending: Mutex<HashMap<String, FileOperation>>,
 schedule_token: AtomicU64,
 thumbnail_size: AtomicU32,
 /// notify fsevents 回调不在 Tokio worker 上；flush 须经此 handle 调度
 runtime_handle: Mutex<Option<tokio::runtime::Handle>>,
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
 runtime_handle: Mutex::new(None),
 }),
 }
 }

 /// 由 Tauri 命令在启动 watch 时注入（fsevents 线程无 current runtime）
 pub fn set_runtime_handle(&self, handle: tokio::runtime::Handle) {
 if let Ok(mut guard) = self.inner.runtime_handle.lock() {
 *guard = Some(handle);
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

 /// 由 FS 回调线程调用：合并去重并调度防抖发射
 pub fn handle_fs_event(
 &self,
 sink: Arc<dyn ScanQueueSink>,
 op_type: &str,
 path: &str,
 is_file: bool,
 ) {
 let Some(typed) = parse_operation_type(op_type) else {
 log::warn!("🌌 未知 watch op_type，已忽略：{op_type}");
 return;
 };

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

 if let Some(existing) = guard.get_mut(&key) {
 if should_deduplicate(existing.timestamp, now, window) {
 existing.timestamp = now;
 if let Some(meta) = existing.metadata.as_mut() {
 meta.last_modified = Some(now);
 }
 return;
 }
 }

 let op = build_file_operation(typed, path, is_file, thumb);
 guard.insert(key, op);
 }

 self.schedule_flush(sink);
 }

 fn spawn_on_runtime<F>(&self, fut: F)
 where
 F: std::future::Future<Output = ()> + Send + 'static,
 {
 if let Ok(handle) = tokio::runtime::Handle::try_current() {
 handle.spawn(fut);
 return;
 }
 let handle = self
 .inner
 .runtime_handle
 .lock()
 .ok()
 .and_then(|guard| guard.clone());
 if let Some(handle) = handle {
 handle.spawn(fut);
 } else {
 log::error!("🌌 扫描队列：无 Tokio runtime handle，防抖 flush 已丢弃");
 }
 }

 fn schedule_flush(&self, sink: Arc<dyn ScanQueueSink>) {
 let my_token = self.inner.schedule_token.fetch_add(1, Ordering::SeqCst) + 1;
 let debounce_ms = {
 let n = self.inner.pending.lock().map(|g| g.len()).unwrap_or(0);
 calculate_debounce_ms(n)
 };
 let inner = self.inner.clone();
 self.spawn_on_runtime(async move {
 tokio::time::sleep(std::time::Duration::from_millis(debounce_ms)).await;
 if inner.schedule_token.load(Ordering::SeqCst) != my_token {
 return;
 }
 let batch: Vec<FileOperation> = match inner.pending.lock() {
 Ok(mut g) => {
 let v: Vec<FileOperation> = g.values().cloned().collect();
 g.clear();
 v
 }
 Err(_) => return,
 };
 if batch.is_empty() {
 return;
 }
 sink.emit_batch(&batch);
 });
 }
}

impl Default for ScanQueueCoalescer {
 fn default() -> Self {
 Self::new()
 }
}

#[cfg(test)]
mod tests {
 use super::*;
 use std::sync::Mutex;

 struct CollectSink {
 batches: Mutex<Vec<Vec<FileOperation>>>,
 }

 impl CollectSink {
 fn new() -> Self {
 Self {
 batches: Mutex::new(Vec::new()),
 }
 }

 fn batch_count(&self) -> usize {
 self.batches.lock().map(|g| g.len()).unwrap_or(0)
 }

 fn last_types(&self) -> Vec<String> {
 let g = self.batches.lock().unwrap();
 g.last()
 .map(|b| {
 b.iter()
 .map(|op| crate::operation_type_str(op.operation_type).to_string())
 .collect()
 })
 .unwrap_or_default()
 }
 }

 impl ScanQueueSink for CollectSink {
 fn emit_batch(&self, ops: &[FileOperation]) {
 self.batches.lock().unwrap().push(ops.to_vec());
 }
 }

 #[test]
 fn flush_from_non_tokio_thread_uses_injected_handle() {
 std::thread::spawn(|| {
 let rt = tokio::runtime::Builder::new_current_thread()
 .enable_time()
 .build()
 .expect("runtime");
 let sink = Arc::new(CollectSink::new());
 let coalescer = ScanQueueCoalescer::new();
 coalescer.set_runtime_handle(rt.handle().clone());

 let sink_for_thread = sink.clone();
 let coalescer_for_thread = coalescer.clone();
 std::thread::spawn(move || {
 coalescer_for_thread.handle_fs_event(sink_for_thread, "add", "/photos/a.jpg", true);
 })
 .join()
 .expect("thread join");

 rt.block_on(async {
 tokio::time::sleep(std::time::Duration::from_millis(250)).await;
 });

 assert_eq!(sink.batch_count(), 1);
 })
 .join()
 .expect("outer thread join");
 }

 #[tokio::test]
 async fn flush_emits_typed_batch_after_debounce() {
 let sink = Arc::new(CollectSink::new());
 let coalescer = ScanQueueCoalescer::new();
 coalescer.handle_fs_event(sink.clone(), "add", "/photos/a.jpg", true);
 coalescer.handle_fs_event(sink.clone(), "addDir", "/photos/album", false);

 tokio::time::sleep(std::time::Duration::from_millis(250)).await;

 assert_eq!(sink.batch_count(), 1);
 let types = sink.last_types();
 assert!(types.contains(&"add".to_string()));
 assert!(types.contains(&"addDir".to_string()));

 let batch = sink.batches.lock().unwrap()[0].clone();
 let add = batch
 .iter()
 .find(|o| o.operation_type == FileOperationType::Add)
 .expect("add op");
 let meta = add.metadata.as_ref().expect("metadata");
 assert!(meta.is_file);
 assert_eq!(meta.thumbnail_size, 150);
 let json = serde_json::to_value(add).unwrap();
 assert_eq!(json["type"], "add");
 assert_eq!(json["metadata"]["isFile"], true);
 assert_eq!(json["metadata"]["thumbnailSize"], 150);
 }

 #[tokio::test]
 async fn clear_pending_cancels_scheduled_flush() {
 let sink = Arc::new(CollectSink::new());
 let coalescer = ScanQueueCoalescer::new();
 coalescer.handle_fs_event(sink.clone(), "delete", "/photos/a.jpg", true);
 coalescer.clear_pending();
 tokio::time::sleep(std::time::Duration::from_millis(250)).await;
 assert_eq!(sink.batch_count(), 0);
 }

 #[tokio::test]
 async fn dedupe_within_window_updates_timestamp_only() {
 let sink = Arc::new(CollectSink::new());
 let coalescer = ScanQueueCoalescer::new();
 coalescer.handle_fs_event(sink.clone(), "change", "/photos/a.jpg", true);
 coalescer.handle_fs_event(sink.clone(), "change", "/photos/a.jpg", true);
 tokio::time::sleep(std::time::Duration::from_millis(250)).await;
 assert_eq!(sink.batch_count(), 1);
 assert_eq!(sink.batches.lock().unwrap()[0].len(), 1);
 }

 #[tokio::test]
 async fn set_thumbnail_size_applies_to_new_ops() {
 let sink = Arc::new(CollectSink::new());
 let coalescer = ScanQueueCoalescer::default();
 coalescer.set_thumbnail_size(256);
 coalescer.handle_fs_event(sink.clone(), "deleteDir", "/photos/album", false);
 tokio::time::sleep(std::time::Duration::from_millis(250)).await;
 assert_eq!(sink.batch_count(), 1);
 let op = &sink.batches.lock().unwrap()[0][0];
 assert_eq!(op.operation_type, FileOperationType::DeleteDir);
 assert_eq!(op.metadata.as_ref().unwrap().thumbnail_size, 256);
 assert!(!op.metadata.as_ref().unwrap().is_file);
 }

 #[tokio::test]
 async fn unknown_op_type_is_ignored() {
 let sink = Arc::new(CollectSink::new());
 let coalescer = ScanQueueCoalescer::new();
 coalescer.handle_fs_event(sink.clone(), "rename", "/photos/a.jpg", true);
 tokio::time::sleep(std::time::Duration::from_millis(200)).await;
 assert_eq!(sink.batch_count(), 0);
 }

 #[tokio::test]
 async fn flush_with_empty_pending_emits_nothing() {
 let sink = Arc::new(CollectSink::new());
 let coalescer = ScanQueueCoalescer::new();
 coalescer.handle_fs_event(sink.clone(), "add", "/photos/a.jpg", true);
 // 保留 schedule_token，仅清空 pending → flush 醒来走 empty-batch 早退
 {
 let mut g = coalescer.inner.pending.lock().unwrap();
 g.clear();
 }
 tokio::time::sleep(std::time::Duration::from_millis(300)).await;
 assert_eq!(sink.batch_count(), 0);
 }

 #[tokio::test]
 async fn schedule_flush_after_poison_uses_zero_debounce_count() {
 let sink = Arc::new(CollectSink::new());
 let coalescer = ScanQueueCoalescer::new();
 let _ = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
 let _g = coalescer.inner.pending.lock().unwrap();
 panic!("intentional poison for debounce len");
 }));
 // pending.lock() Err → unwrap_or(0)；flush 侧再走 Err return
 coalescer.schedule_flush(sink.clone());
 tokio::time::sleep(std::time::Duration::from_millis(300)).await;
 assert_eq!(sink.batch_count(), 0);
 }

 #[tokio::test]
 async fn dedupe_outside_window_inserts_replacement() {
 let sink = Arc::new(CollectSink::new());
 let coalescer = ScanQueueCoalescer::new();
 {
 let mut g = coalescer.inner.pending.lock().unwrap();
 g.insert(
 "add:/photos/a.jpg".into(),
 FileOperation {
 id: "old".into(),
 operation_type: FileOperationType::Add,
 path: "/photos/a.jpg".into(),
 // 远早于当前时间，强制走「窗外」替换分支
 timestamp: 1,
 priority: 3,
 retry_count: 0,
 metadata: None,
 },
 );
 }
 coalescer.handle_fs_event(sink.clone(), "add", "/photos/a.jpg", true);
 tokio::time::sleep(std::time::Duration::from_millis(250)).await;
 assert_eq!(sink.batch_count(), 1);
 let op = &sink.batches.lock().unwrap()[0][0];
 assert_ne!(op.id, "old");
 assert!(op.metadata.is_some());
 }

 #[tokio::test]
 async fn dedupe_updates_when_metadata_missing() {
 let sink = Arc::new(CollectSink::new());
 let coalescer = ScanQueueCoalescer::new();
 let now = now_ms();
 {
 let mut g = coalescer.inner.pending.lock().unwrap();
 g.insert(
 "change:/photos/a.jpg".into(),
 FileOperation {
 id: "meta-less".into(),
 operation_type: FileOperationType::Change,
 path: "/photos/a.jpg".into(),
 timestamp: now,
 priority: 2,
 retry_count: 0,
 metadata: None,
 },
 );
 }
 coalescer.handle_fs_event(sink.clone(), "change", "/photos/a.jpg", true);
 // 窗内去重：仍只有一条，且 id 保持（未重新 build）
 {
 let g = coalescer.inner.pending.lock().unwrap();
 let op = g.get("change:/photos/a.jpg").expect("pending");
 assert_eq!(op.id, "meta-less");
 assert!(op.metadata.is_none());
 }
 coalescer.clear_pending();
 tokio::time::sleep(std::time::Duration::from_millis(200)).await;
 assert_eq!(sink.batch_count(), 0);
 }

 #[test]
 fn poisoned_pending_lock_skips_handle_and_clear() {
 let coalescer = ScanQueueCoalescer::new();
 let _ = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
 let _g = coalescer.inner.pending.lock().unwrap();
 panic!("intentional poison");
 }));
 let sink = Arc::new(CollectSink::new());
 coalescer.handle_fs_event(sink.clone(), "add", "/photos/a.jpg", true);
 assert_eq!(sink.batch_count(), 0);
 // clear_pending 在锁毒时跳过 clear，但仍推进 schedule_token
 coalescer.clear_pending();
 }

 #[tokio::test]
 async fn poisoned_lock_during_flush_skips_emit() {
 let sink = Arc::new(CollectSink::new());
 let coalescer = ScanQueueCoalescer::new();
 coalescer.handle_fs_event(sink.clone(), "add", "/photos/a.jpg", true);
 // 在 debounce 醒来前毒化锁 → schedule_flush Err 分支
 let _ = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
 let _g = coalescer.inner.pending.lock().unwrap();
 panic!("intentional poison before flush");
 }));
 tokio::time::sleep(std::time::Duration::from_millis(250)).await;
 assert_eq!(sink.batch_count(), 0);
 }
}

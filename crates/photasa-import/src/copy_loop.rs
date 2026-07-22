/*!
 * 导入复制循环纯算法：策略、暂停/取消、进度 JSON（无 Tauri Window）。
 */
use crate::date::{
 date_subpath_for_import_source, join_date_subpath, relative_target_path_for_import,
 MetadataExtractor,
};
use log::warn;
use serde_json::{json, Value};
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::{Duration, Instant};

const PROGRESS_EMIT_EVERY_FILES: u32 = 25;

/// 单任务控制：取消 + 暂停（按 import_id）
pub struct ImportTaskFlags {
 pub cancel: Arc<AtomicBool>,
 pub paused: Arc<AtomicBool>,
}

pub struct CopyOneResult {
 pub copied: bool,
 pub dest: PathBuf,
 pub duplicate: bool,
}

pub struct CancelledProgress<'a> {
 pub import_id: &'a str,
 pub total_files: u32,
 pub processed: u32,
 pub successful: u32,
 pub skipped: u32,
 pub errors: u32,
 pub current_file: &'a str,
 pub speed: f64,
 pub start_time: &'a str,
}

pub struct ImportLoopRequest<'a, M: MetadataExtractor> {
 pub import_id: &'a str,
 pub files: &'a [String],
 pub target_path: &'a Path,
 pub strategy: &'a str,
 pub cancel: &'a AtomicBool,
 pub paused: &'a AtomicBool,
 pub start_iso: &'a str,
 pub meta: &'a M,
}

pub struct ImportTaskRegistry(pub Mutex<HashMap<String, ImportTaskFlags>>);

impl Default for ImportTaskRegistry {
 fn default() -> Self {
 Self(Mutex::new(HashMap::new()))
 }
}

/// 暂停等待期间若取消则返回 false
pub fn wait_unpaused_or_cancel(cancel: &AtomicBool, paused: &AtomicBool) -> bool {
 loop {
 if cancel.load(Ordering::SeqCst) {
 return false;
 }
 if !paused.load(Ordering::SeqCst) {
 return true;
 }
 thread::sleep(Duration::from_millis(50));
 }
}

pub fn take_duplicate_strategy(config: &Value) -> &'static str {
 match config.get("duplicateStrategy").and_then(|v| v.as_str()) {
 Some("skip") => "skip",
 Some("overwrite") => "overwrite",
 Some("rename") | None => "rename",
 _ => "rename",
 }
}

pub fn collect_files(config: &Value) -> Vec<String> {
 if let Some(arr) = config.get("selectedFiles").and_then(|v| v.as_array()) {
 let mut out: Vec<String> = arr
 .iter()
 .filter_map(|x| x.as_str().map(|s| s.to_string()))
 .collect();
 out.sort();
 out.dedup();
 return out;
 }
 Vec::new()
}

pub fn ensure_parent(path: &Path) -> Result<(), String> {
 if let Some(p) = path.parent() {
 fs::create_dir_all(p).map_err(|e| e.to_string())?;
 }
 Ok(())
}

/// 目标目录内为 `file_name` 找空闲路径；重名则 `stem_1.ext`、`stem_2.ext`…
/// （与 legacy-api `file-helper.copyFile` / 旧版 importPhotos 冲突改名一致）
pub fn unique_dest_path(target_dir: &Path, file_name: &str) -> PathBuf {
 let mut dest = target_dir.join(file_name);
 if !dest.exists() {
 return dest;
 }
 let stem = Path::new(file_name)
 .file_stem()
 .and_then(|s| s.to_str())
 .unwrap_or("file");
 let ext = Path::new(file_name)
 .extension()
 .and_then(|e| e.to_str())
 .map(|e| format!(".{e}"))
 .unwrap_or_default();
 let mut count = 1u32;
 loop {
 dest = target_dir.join(format!("{stem}_{count}{ext}"));
 if !dest.exists() {
 return dest;
 }
 count += 1;
 }
}

/// 复制单文件；skip 时 `copied=false`，`duplicate=true` 表示命中既有目标名。
pub fn copy_one(src: &Path, target_dir: &Path, strategy: &str) -> Result<CopyOneResult, String> {
 let name = src
 .file_name()
 .and_then(|s| s.to_str())
 .ok_or_else(|| "无效源路径".to_string())?;
 let original_dest = target_dir.join(name);
 let duplicate = original_dest.exists();
 let dest = if duplicate {
 match strategy {
 "skip" => {
 return Ok(CopyOneResult {
 copied: false,
 dest: original_dest,
 duplicate: true,
 });
 }
 "overwrite" => original_dest,
 _ => unique_dest_path(target_dir, name),
 }
 } else {
 original_dest
 };
 ensure_parent(&dest)?;
 fs::copy(src, &dest).map_err(|e| e.to_string())?;
 Ok(CopyOneResult {
 copied: true,
 dest,
 duplicate,
 })
}

pub fn cancelled_progress_json(progress: CancelledProgress<'_>) -> Value {
 json!({
 "importId": progress.import_id,
 "totalFiles": progress.total_files,
 "processedFiles": progress.processed,
 "successfulFiles": progress.successful,
 "skippedFiles": progress.skipped,
 "errorFiles": progress.errors,
 "speed": progress.speed,
 "estimatedTimeRemaining": 0u64,
 "remainingTime": 0u64,
 "currentFile": progress.current_file,
 "status": "cancelled",
 "errors": [],
 "warnings": [],
 "startTime": progress.start_time,
 })
}

fn should_emit_progress(processed: u32, total_files: u32, last_emit_processed: u32) -> bool {
 processed == 1
 || processed == total_files
 || processed.saturating_sub(last_emit_processed) >= PROGRESS_EMIT_EVERY_FILES
}

/// 复制循环结果（无 Window）
#[derive(Debug, Clone)]
pub enum ImportLoopEnd {
 Completed {
 successful: u32,
 skipped: u32,
 errors: u32,
 processed: u32,
 total_size: u64,
 duplicate_count: u32,
 imported_files: Vec<Value>,
 duration_ms: u64,
 },
 Cancelled {
 successful: u32,
 skipped: u32,
 errors: u32,
 processed: u32,
 current_file: String,
 },
}

/// 纯算法：按文件边界尊重 pause/cancel；通过 `on_progress` 回调进度 JSON
pub fn run_import_file_loop<M: MetadataExtractor>(
 request: ImportLoopRequest<'_, M>,
 mut on_progress: impl FnMut(Value),
 mut on_imported_file: impl FnMut(Value),
) -> Result<ImportLoopEnd, String> {
 fs::create_dir_all(request.target_path).map_err(|e| format!("创建目标目录失败: {e}"))?;

 let started = Instant::now();
 let total_files = request.files.len() as u32;
 let target_pb = request.target_path.to_path_buf();
 let mut successful = 0u32;
 let mut skipped = 0u32;
 let mut errors = 0u32;
 let mut processed = 0u32;
 let mut duplicate_count = 0u32;
 let mut imported_files: Vec<Value> = Vec::new();
 let mut total_size: u64 = 0;
 let mut last_emit_processed = 0u32;

 let initial_progress = json!({
 "importId": request.import_id,
 "totalFiles": total_files,
 "processedFiles": 0u32,
 "successfulFiles": 0u32,
 "skippedFiles": 0u32,
 "errorFiles": 0u32,
 "speed": 0.0,
 "estimatedTimeRemaining": 0u64,
 "remainingTime": 0u64,
 "currentFile": "",
 "status": "processing",
 "errors": [],
 "warnings": [],
 "startTime": request.start_iso,
 });
 on_progress(initial_progress);

 for src_s in request.files {
 if !wait_unpaused_or_cancel(request.cancel, request.paused) {
 return Ok(ImportLoopEnd::Cancelled {
 successful,
 skipped,
 errors,
 processed,
 current_file: src_s.clone(),
 });
 }

 if request.cancel.load(Ordering::SeqCst) {
 return Ok(ImportLoopEnd::Cancelled {
 successful,
 skipped,
 errors,
 processed,
 current_file: src_s.clone(),
 });
 }

 let src = Path::new(src_s);
 if !src.is_file() {
 errors += 1;
 processed += 1;
 continue;
 }

 let date_sub = date_subpath_for_import_source(src, request.meta);
 let target_dir = join_date_subpath(&target_pb, &date_sub);

 match copy_one(src, &target_dir, request.strategy) {
 Ok(copy) => {
 if copy.duplicate {
 duplicate_count += 1;
 }
 if copy.copied {
 successful += 1;
 let sz = fs::metadata(&copy.dest).map(|m| m.len()).unwrap_or(0);
 total_size += sz;
 let src_norm = src_s.replace('\\', "/");
 let dest_name = copy.dest.file_name().and_then(|s| s.to_str()).unwrap_or("");
 let target_rel = relative_target_path_for_import(&date_sub, dest_name);
 let imported = json!({
 "originalPath": src_norm,
 "targetPath": target_rel,
 "size": sz,
 "importTime": chrono::Utc::now().to_rfc3339(),
 });
 on_imported_file(imported.clone());
 imported_files.push(imported);
 } else {
 skipped += 1;
 }
 }
 Err(e) => {
 warn!("复制失败 {}: {}", src_s, e);
 errors += 1;
 }
 }
 processed += 1;

 let elapsed = started.elapsed().as_secs_f64().max(0.001);
 let speed = processed as f64 / elapsed;
 let left = total_files.saturating_sub(processed);
 let eta = if speed > 0.01 {
 (left as f64 / speed) as u64
 } else {
 0u64
 };

 if should_emit_progress(processed, total_files, last_emit_processed) {
 last_emit_processed = processed;
 on_progress(json!({
 "importId": request.import_id,
 "totalFiles": total_files,
 "processedFiles": processed,
 "successfulFiles": successful,
 "skippedFiles": skipped,
 "errorFiles": errors,
 "speed": speed,
 "estimatedTimeRemaining": eta,
 "remainingTime": eta,
 "currentFile": src_s,
 "status": "processing",
 "errors": [],
 "warnings": [],
 "startTime": request.start_iso,
 }));
 }
 }

 Ok(ImportLoopEnd::Completed {
 successful,
 skipped,
 errors,
 processed,
 total_size,
 duplicate_count,
 imported_files,
 duration_ms: started.elapsed().as_millis() as u64,
 })
}

/// 在 registry 上设置 cancel；未知 id 返回 Ok(false)
pub fn registry_set_cancel(registry: &ImportTaskRegistry, import_id: &str) -> Result<bool, String> {
 let g = registry.0.lock().map_err(|e| e.to_string())?;
 if let Some(flags) = g.get(import_id) {
 flags.cancel.store(true, Ordering::SeqCst);
 Ok(true)
 } else {
 Ok(false)
 }
}

pub fn registry_set_paused(
 registry: &ImportTaskRegistry,
 import_id: &str,
 paused: bool,
) -> Result<bool, String> {
 let g = registry.0.lock().map_err(|e| e.to_string())?;
 if let Some(flags) = g.get(import_id) {
 flags.paused.store(paused, Ordering::SeqCst);
 Ok(true)
 } else {
 Ok(false)
 }
}

#[cfg(test)]
mod tests {
 use super::*;
 use crate::date::EmptyMetadata;
 use std::io::Write;
 use std::sync::atomic::AtomicUsize;

 fn temp_dir(label: &str) -> PathBuf {
 let d =
 std::env::temp_dir().join(format!("photasa-imp-exec-{label}-{}", uuid::Uuid::new_v4()));
 fs::create_dir_all(&d).unwrap();
 d
 }

 fn write_file(path: &Path, bytes: &[u8]) {
 if let Some(p) = path.parent() {
 fs::create_dir_all(p).unwrap();
 }
 let mut f = fs::File::create(path).unwrap();
 f.write_all(bytes).unwrap();
 }

 fn run_loop(
 import_id: &str,
 files: &[String],
 target_path: &Path,
 strategy: &str,
 cancel: &AtomicBool,
 paused: &AtomicBool,
 start_iso: &str,
 meta: &EmptyMetadata,
 on_progress: impl FnMut(Value),
 ) -> Result<ImportLoopEnd, String> {
 run_import_file_loop(
 ImportLoopRequest {
 import_id,
 files,
 target_path,
 strategy,
 cancel,
 paused,
 start_iso,
 meta,
 },
 on_progress,
 |_| {},
 )
 }

 #[test]
 fn take_duplicate_strategy_variants() {
 assert_eq!(
 take_duplicate_strategy(&json!({"duplicateStrategy": "skip"})),
 "skip"
 );
 assert_eq!(
 take_duplicate_strategy(&json!({"duplicateStrategy": "overwrite"})),
 "overwrite"
 );
 assert_eq!(
 take_duplicate_strategy(&json!({"duplicateStrategy": "rename"})),
 "rename"
 );
 assert_eq!(take_duplicate_strategy(&json!({})), "rename");
 assert_eq!(
 take_duplicate_strategy(&json!({"duplicateStrategy": "weird"})),
 "rename"
 );
 }

 #[test]
 fn collect_files_sorts_dedups_and_filters() {
 let cfg = json!({
 "selectedFiles": ["/b.jpg", "/a.jpg", "/b.jpg", 1, null]
 });
 assert_eq!(
 collect_files(&cfg),
 vec!["/a.jpg".to_string(), "/b.jpg".to_string()]
 );
 assert!(collect_files(&json!({})).is_empty());
 assert!(collect_files(&json!({"selectedFiles": []})).is_empty());
 }

 #[test]
 fn ensure_parent_creates_nested() {
 let root = temp_dir("parent");
 let nested = root.join("a").join("b").join("c.txt");
 ensure_parent(&nested).unwrap();
 assert!(nested.parent().unwrap().is_dir());
 let _ = fs::remove_dir_all(&root);
 }

 #[test]
 fn unique_dest_path_free_and_collision() {
 let root = temp_dir("unique");
 let free = unique_dest_path(&root, "a.jpg");
 assert_eq!(free, root.join("a.jpg"));
 write_file(&root.join("a.jpg"), b"1");
 assert_eq!(unique_dest_path(&root, "a.jpg"), root.join("a_1.jpg"));
 write_file(&root.join("a_1.jpg"), b"2");
 assert_eq!(unique_dest_path(&root, "a.jpg"), root.join("a_2.jpg"));
 let _ = fs::remove_dir_all(&root);
 }

 #[test]
 fn copy_one_skip_overwrite_rename() {
 let root = temp_dir("copy");
 let src = root.join("src.jpg");
 write_file(&src, b"AAA");
 let dest_dir = root.join("out");
 fs::create_dir_all(&dest_dir).unwrap();

 let first = copy_one(&src, &dest_dir, "rename").unwrap();
 assert!(first.copied);
 assert!(!first.duplicate);
 let p1 = first.dest;
 assert_eq!(p1, dest_dir.join("src.jpg"));
 assert_eq!(fs::read(&p1).unwrap(), b"AAA");

 write_file(&src, b"BBB");
 let skipped = copy_one(&src, &dest_dir, "skip").unwrap();
 assert!(!skipped.copied);
 assert!(skipped.duplicate);
 assert_eq!(fs::read(dest_dir.join("src.jpg")).unwrap(), b"AAA");

 let overwritten = copy_one(&src, &dest_dir, "overwrite").unwrap();
 assert!(overwritten.copied);
 assert!(overwritten.duplicate);
 assert_eq!(fs::read(dest_dir.join("src.jpg")).unwrap(), b"BBB");

 write_file(&src, b"CCC");
 let renamed = copy_one(&src, &dest_dir, "rename").unwrap();
 assert!(renamed.copied);
 assert!(renamed.duplicate);
 let p_r = renamed.dest;
 assert_eq!(p_r, dest_dir.join("src_1.jpg"));
 assert_eq!(fs::read(&p_r).unwrap(), b"CCC");

 let _ = fs::remove_dir_all(&root);
 }

 #[test]
 fn copy_one_rename_increments_when_alt_exists() {
 let root = temp_dir("rename2");
 let src = root.join("x.png");
 write_file(&src, b"1");
 let dest_dir = root.join("d");
 fs::create_dir_all(&dest_dir).unwrap();
 write_file(&dest_dir.join("x.png"), b"0");
 write_file(&dest_dir.join("x_1.png"), b"0");
 let copy = copy_one(&src, &dest_dir, "rename").unwrap();
 assert!(copy.copied);
 assert!(copy.duplicate);
 assert_eq!(copy.dest, dest_dir.join("x_2.png"));
 let _ = fs::remove_dir_all(&root);
 }

 #[test]
 fn wait_unpaused_returns_immediately_when_not_paused() {
 let cancel = AtomicBool::new(false);
 let paused = AtomicBool::new(false);
 assert!(wait_unpaused_or_cancel(&cancel, &paused));
 }

 #[test]
 fn wait_unpaused_false_when_cancel_while_paused() {
 let cancel = Arc::new(AtomicBool::new(false));
 let paused = Arc::new(AtomicBool::new(true));
 let c2 = cancel.clone();
 thread::spawn(move || {
 thread::sleep(Duration::from_millis(80));
 c2.store(true, Ordering::SeqCst);
 });
 assert!(!wait_unpaused_or_cancel(&cancel, &paused));
 }

 #[test]
 fn wait_unpaused_true_after_resume() {
 let cancel = AtomicBool::new(false);
 let paused = Arc::new(AtomicBool::new(true));
 let p2 = paused.clone();
 thread::spawn(move || {
 thread::sleep(Duration::from_millis(80));
 p2.store(false, Ordering::SeqCst);
 });
 assert!(wait_unpaused_or_cancel(&cancel, &paused));
 }

 #[test]
 fn cancelled_progress_json_shape() {
 let v = cancelled_progress_json(CancelledProgress {
 import_id: "id-1",
 total_files: 3,
 processed: 1,
 successful: 1,
 skipped: 0,
 errors: 0,
 current_file: "/a.jpg",
 speed: 2.5,
 start_time: "t0",
 });
 assert_eq!(v["status"], "cancelled");
 assert_eq!(v["importId"], "id-1");
 assert_eq!(v["totalFiles"], 3);
 assert_eq!(v["currentFile"], "/a.jpg");
 assert_eq!(v["speed"], 2.5);
 assert_eq!(v["estimatedTimeRemaining"], 0);
 assert_eq!(v["remainingTime"], 0);
 assert_eq!(v["startTime"], "t0");
 }

 #[test]
 fn registry_cancel_pause_resume() {
 let registry = ImportTaskRegistry::default();
 let cancel = Arc::new(AtomicBool::new(false));
 let paused = Arc::new(AtomicBool::new(false));
 {
 let mut g = registry.0.lock().unwrap();
 g.insert(
 "id-1".into(),
 ImportTaskFlags {
 cancel: cancel.clone(),
 paused: paused.clone(),
 },
 );
 }
 assert!(registry_set_paused(&registry, "id-1", true).unwrap());
 assert!(paused.load(Ordering::SeqCst));
 assert!(registry_set_paused(&registry, "id-1", false).unwrap());
 assert!(!paused.load(Ordering::SeqCst));
 assert!(registry_set_cancel(&registry, "id-1").unwrap());
 assert!(cancel.load(Ordering::SeqCst));
 assert!(!registry_set_cancel(&registry, "missing").unwrap());
 assert!(!registry_set_paused(&registry, "missing", true).unwrap());
 }

 #[test]
 fn run_import_file_loop_copies_and_skips_missing() {
 let root = temp_dir("loop");
 let src_dir = root.join("src");
 let dst = root.join("dst");
 fs::create_dir_all(&src_dir).unwrap();
 let f1 = src_dir.join("a.jpg");
 write_file(&f1, b"hello");
 let missing = src_dir.join("gone.jpg").to_string_lossy().to_string();
 let files = vec![f1.to_string_lossy().to_string(), missing];
 let cancel = AtomicBool::new(false);
 let paused = AtomicBool::new(false);
 let progress_count = AtomicUsize::new(0);
 let meta = EmptyMetadata;

 let end = run_loop(
 "id-1",
 &files,
 &dst,
 "rename",
 &cancel,
 &paused,
 "2024-01-01T00:00:00Z",
 &meta,
 |_| {
 progress_count.fetch_add(1, Ordering::SeqCst);
 },
 )
 .unwrap();

 match end {
 ImportLoopEnd::Completed {
 successful,
 errors,
 skipped,
 processed,
 duplicate_count,
 imported_files,
 ..
 } => {
 assert_eq!(successful, 1);
 assert_eq!(errors, 1);
 assert_eq!(skipped, 0);
 assert_eq!(processed, 2);
 assert_eq!(duplicate_count, 0);
 assert!(!imported_files[0]
 .as_object()
 .unwrap()
 .contains_key("checksum"));
 }
 ImportLoopEnd::Cancelled { .. } => panic!("expected completed"),
 }
 assert!(progress_count.load(Ordering::SeqCst) >= 2);
 let _ = fs::remove_dir_all(&root);
 }

 #[test]
 fn run_import_file_loop_reports_each_copied_file() {
 let root = temp_dir("copied-callback");
 let src_dir = root.join("src");
 let dst = root.join("dst");
 fs::create_dir_all(&src_dir).unwrap();
 let f1 = src_dir.join("a.jpg");
 let f2 = src_dir.join("b.jpg");
 write_file(&f1, b"a");
 write_file(&f2, b"b");
 let files = vec![
 f1.to_string_lossy().to_string(),
 f2.to_string_lossy().to_string(),
 ];
 let cancel = AtomicBool::new(false);
 let paused = AtomicBool::new(false);
 let meta = EmptyMetadata;
 let mut copied = Vec::new();

 let end = run_import_file_loop(
 ImportLoopRequest {
 import_id: "id-cb",
 files: &files,
 target_path: &dst,
 strategy: "rename",
 cancel: &cancel,
 paused: &paused,
 start_iso: "2024-01-01T00:00:00Z",
 meta: &meta,
 },
 |_| {},
 |file| copied.push(file),
 )
 .unwrap();

 assert!(matches!(
 end,
 ImportLoopEnd::Completed { successful: 2, .. }
 ));
 assert_eq!(copied.len(), 2);
 let f1_norm = f1.to_string_lossy().replace('\\', "/");
 assert_eq!(
 copied[0].get("originalPath").and_then(Value::as_str),
 Some(f1_norm.as_str())
 );
 assert!(copied[0]
 .get("targetPath")
 .and_then(Value::as_str)
 .unwrap_or("")
 .ends_with("a.jpg"));
 let _ = fs::remove_dir_all(&root);
 }

 #[test]
 fn run_import_file_loop_skip_duplicate() {
 let root = temp_dir("skip");
 let src = root.join("s.jpg");
 write_file(&src, b"X");
 let dst = root.join("dst");
 let cancel = AtomicBool::new(false);
 let paused = AtomicBool::new(false);
 let files = vec![src.to_string_lossy().to_string()];
 let meta = EmptyMetadata;

 let end1 = run_loop(
 "id-1",
 &files,
 &dst,
 "rename",
 &cancel,
 &paused,
 "t0",
 &meta,
 |_| {},
 )
 .unwrap();
 assert!(matches!(
 end1,
 ImportLoopEnd::Completed { successful: 1, .. }
 ));

 let end2 = run_loop(
 "id-2",
 &files,
 &dst,
 "skip",
 &cancel,
 &paused,
 "t1",
 &meta,
 |_| {},
 )
 .unwrap();
 match end2 {
 ImportLoopEnd::Completed {
 successful,
 skipped,
 duplicate_count,
 ..
 } => {
 assert_eq!(successful, 0);
 assert_eq!(skipped, 1);
 assert_eq!(duplicate_count, 1);
 }
 _ => panic!("expected completed"),
 }
 let _ = fs::remove_dir_all(&root);
 }

 #[test]
 fn run_import_file_loop_counts_rename_duplicate() {
 let root = temp_dir("rename-duplicate");
 let src = root.join("s.jpg");
 write_file(&src, b"X");
 let dst = root.join("dst");
 let cancel = AtomicBool::new(false);
 let paused = AtomicBool::new(false);
 let files = vec![src.to_string_lossy().to_string()];
 let meta = EmptyMetadata;

 let _ = run_loop(
 "id-1",
 &files,
 &dst,
 "rename",
 &cancel,
 &paused,
 "t0",
 &meta,
 |_| {},
 )
 .unwrap();
 let end = run_loop(
 "id-2",
 &files,
 &dst,
 "rename",
 &cancel,
 &paused,
 "t1",
 &meta,
 |_| {},
 )
 .unwrap();

 match end {
 ImportLoopEnd::Completed {
 successful,
 duplicate_count,
 imported_files,
 ..
 } => {
 assert_eq!(successful, 1);
 assert_eq!(duplicate_count, 1);
 assert!(imported_files[0]["targetPath"]
 .as_str()
 .unwrap()
 .ends_with("/s_1.jpg"));
 assert!(!imported_files[0]
 .as_object()
 .unwrap()
 .contains_key("checksum"));
 }
 _ => panic!("expected completed"),
 }
 let _ = fs::remove_dir_all(&root);
 }

 #[test]
 fn run_import_file_loop_throttles_progress_but_emits_final() {
 let root = temp_dir("throttle");
 let src_dir = root.join("src");
 let dst = root.join("dst");
 fs::create_dir_all(&src_dir).unwrap();
 let mut files = Vec::new();
 for i in 0..80 {
 let p = src_dir.join(format!("{i}.jpg"));
 write_file(&p, b"x");
 files.push(p.to_string_lossy().to_string());
 }
 let cancel = AtomicBool::new(false);
 let paused = AtomicBool::new(false);
 let meta = EmptyMetadata;
 let mut emitted = Vec::new();

 let end = run_loop(
 "id-1",
 &files,
 &dst,
 "rename",
 &cancel,
 &paused,
 "t",
 &meta,
 |payload| emitted.push(payload),
 )
 .unwrap();

 assert!(matches!(
 end,
 ImportLoopEnd::Completed { processed: 80, .. }
 ));
 assert!(emitted.len() < files.len());
 assert_eq!(emitted.first().unwrap()["processedFiles"], 0);
 assert_eq!(emitted.last().unwrap()["processedFiles"], 80);
 let _ = fs::remove_dir_all(&root);
 }

 #[test]
 fn copy_one_errs_when_target_dir_is_a_file() {
 let root = temp_dir("baddir");
 let src = root.join("s.jpg");
 write_file(&src, b"y");
 let blocker = root.join("not-a-dir");
 write_file(&blocker, b"x");
 assert!(copy_one(&src, &blocker, "rename").is_err());
 let _ = fs::remove_dir_all(&root);
 }

 #[test]
 fn run_import_file_loop_counts_copy_errors() {
 let root = temp_dir("copyerr");
 let src = root.join("s.jpg");
 write_file(&src, b"y");
 let dst = root.join("dst");
 fs::create_dir_all(&dst).unwrap();
 let dir_as_src = root.join("folder.jpg");
 fs::create_dir_all(&dir_as_src).unwrap();
 let cancel = AtomicBool::new(false);
 let paused = AtomicBool::new(false);
 let meta = EmptyMetadata;
 let end = run_loop(
 "id-1",
 &[dir_as_src.to_string_lossy().to_string()],
 &dst,
 "rename",
 &cancel,
 &paused,
 "t",
 &meta,
 |_| {},
 )
 .unwrap();
 match end {
 ImportLoopEnd::Completed {
 errors, successful, ..
 } => {
 assert_eq!(errors, 1);
 assert_eq!(successful, 0);
 }
 _ => panic!("expected completed"),
 }
 let _ = fs::remove_dir_all(&root);
 }

 #[test]
 fn copy_one_invalid_source_name_errs() {
 let root = temp_dir("badname");
 let dest_dir = root.join("out");
 fs::create_dir_all(&dest_dir).unwrap();
 let err = copy_one(Path::new(""), &dest_dir, "rename");
 assert!(err.is_err());
 let _ = fs::remove_dir_all(&root);
 }

 #[test]
 fn run_import_file_loop_errs_when_target_uncreatable() {
 let cancel = AtomicBool::new(false);
 let paused = AtomicBool::new(false);
 let meta = EmptyMetadata;
 let r = run_loop(
 "id-1",
 &["/tmp/nope.jpg".to_string()],
 Path::new("/dev/null/photasa-cannot-create"),
 "rename",
 &cancel,
 &paused,
 "t",
 &meta,
 |_| {},
 );
 assert!(r.is_err());
 }

 #[test]
 fn run_import_file_loop_cancel_before_first_file() {
 let root = temp_dir("pre-cancel");
 let src = root.join("a.jpg");
 write_file(&src, b"z");
 let dst = root.join("dst");
 let cancel = AtomicBool::new(true);
 let paused = AtomicBool::new(false);
 let meta = EmptyMetadata;
 let end = run_loop(
 "id-1",
 &[src.to_string_lossy().to_string()],
 &dst,
 "rename",
 &cancel,
 &paused,
 "t",
 &meta,
 |_| {},
 )
 .unwrap();
 assert!(matches!(end, ImportLoopEnd::Cancelled { processed: 0, .. }));
 let _ = fs::remove_dir_all(&root);
 }

 #[test]
 fn run_import_file_loop_cancels_when_flag_set_midway() {
 let root = temp_dir("cancel");
 let src_dir = root.join("src");
 fs::create_dir_all(&src_dir).unwrap();
 let mut files = Vec::new();
 for i in 0..5 {
 let p = src_dir.join(format!("{i}.jpg"));
 write_file(&p, b"x");
 files.push(p.to_string_lossy().to_string());
 }
 let dst = root.join("dst");
 let cancel = Arc::new(AtomicBool::new(false));
 let paused = AtomicBool::new(false);
 let cancel_cb = cancel.clone();
 let calls = AtomicUsize::new(0);
 let meta = EmptyMetadata;

 let end = run_loop(
 "id-1",
 &files,
 &dst,
 "rename",
 &cancel,
 &paused,
 "t",
 &meta,
 |_| {
 let n = calls.fetch_add(1, Ordering::SeqCst);
 if n >= 1 {
 cancel_cb.store(true, Ordering::SeqCst);
 }
 },
 )
 .unwrap();

 assert!(matches!(end, ImportLoopEnd::Cancelled { .. }));
 let _ = fs::remove_dir_all(&root);
 }
}

/*!
 * 导入日期子路径（RFC 0104）：与 `import_preview` / contract reference `generateDatePath` 共用同一套 UTC 日期解析与 `{year}/{YYYYMMDD}` 格式。
 */
use chrono::{DateTime, Datelike, Utc};
use serde_json::{json, Value};
use std::path::{Path, PathBuf};
use std::time::SystemTime;

/// 由宿主提供的元数据提取（如 Tauri `extract_metadata`）；默认 `EmptyMetadata` 返回空对象。
pub trait MetadataExtractor: Send + Sync {
 fn extract_json(&self, path: &Path) -> Value;
}

/// 无 EXIF/媒体元数据时的占位实现，仅依赖文件系统时间。
pub struct EmptyMetadata;

impl MetadataExtractor for EmptyMetadata {
 fn extract_json(&self, _: &Path) -> Value {
 json!({})
 }
}

/// 与 `@photasa/maliang` `generateDatePath` 一致：`{year}/{year}{MM}{DD}`（例 `2021/20210515`）
pub fn generate_date_path_utc(dt: DateTime<Utc>) -> String {
 let d = dt.date_naive();
 let y = d.year();
 let m = d.month();
 let day = d.day();
 format!("{}/{}{m:02}{day:02}", y, y)
}

/// 与 `@photasa/maliang` `isValidVideoDate` 对齐，过滤不可用 `dateTime` 字符串
fn is_plausible_datetime_str(s: &str) -> bool {
 let t = s.trim();
 !t.is_empty()
 && t != "0000-00-00T00:00:00.000000Z"
 && t != "invalid-date"
 && !t.starts_with("1970-01-01T00:00:00")
}

pub fn parse_rfc3339_utc(s: &str) -> Option<DateTime<Utc>> {
 let t = s.trim();
 if t.is_empty() {
 return None;
 }
 DateTime::parse_from_rfc3339(t)
 .ok()
 .map(|d| d.with_timezone(&Utc))
}

/// 与 `@photasa/maliang` `computeFallbackDate` 一致：两时间皆有效取较早
pub fn compute_fallback_date_utc(created_rfc: &str, modified_rfc: &str) -> DateTime<Utc> {
 let c = parse_rfc3339_utc(created_rfc);
 let m = parse_rfc3339_utc(modified_rfc);
 match (c, m) {
 (Some(ct), Some(mt)) => {
 if ct <= mt {
 ct
 } else {
 mt
 }
 }
 (Some(ct), None) => ct,
 (None, Some(mt)) => mt,
 (None, None) => Utc::now(),
 }
}

/// 与 `@photasa/import` `determineGroupTargetDate` 一致（1:1 contract reference 预览分桶日期）
pub fn determine_group_target_utc(main: &Value) -> DateTime<Utc> {
	if let Some(ds) = main.get("dateTime").and_then(|v| v.as_str()) {
		if is_plausible_datetime_str(ds) {
			if let Ok(dt) = DateTime::parse_from_rfc3339(ds) {
				return dt.with_timezone(&Utc);
			}
		}
	}
	let created = main
		.get("createdTime")
		.and_then(|v| v.as_str())
		.unwrap_or("");
	let modified = main
		.get("modifiedTime")
		.and_then(|v| v.as_str())
		.unwrap_or("");
	compute_fallback_date_utc(created, modified)
}

fn system_time_to_rfc3339(t: SystemTime) -> Option<String> {
 let dt: DateTime<Utc> = t.into();
 Some(dt.to_rfc3339())
}

/// 文件 `Metadata` → `(created, modified)` RFC3339，与预览路径一致
pub fn rfc3339_pair_from_fs_meta(meta: &std::fs::Metadata) -> (String, String) {
 let modified = meta
 .modified()
 .ok()
 .and_then(system_time_to_rfc3339)
 .unwrap_or_default();
 let created = meta
 .created()
 .or_else(|_| meta.modified())
 .ok()
 .and_then(system_time_to_rfc3339)
 .unwrap_or_else(|| modified.clone());
 (created, modified)
}

/// 将元数据提取结果并入 `FileInfo` 形状（对齐 `processFileGroup`）
pub fn merge_extract_into_file_info(
 fi: &mut Value,
 meta: &Value,
 created_rfc: &str,
 modified_rfc: &str,
) {
 let Some(obj) = fi.as_object_mut() else {
 return;
 };
 let mut from_meta = false;
 if let Some(dt) = meta.get("dateTime").and_then(|v| v.as_str()) {
 if is_plausible_datetime_str(dt) {
 obj.insert("dateTime".to_string(), json!(dt));
 let ds = meta
 .get("dateSource")
 .and_then(|v| v.as_str())
 .unwrap_or("file_modified");
 obj.insert("dateSource".to_string(), json!(ds));
 from_meta = true;
 }
 }
 if !from_meta {
 if parse_rfc3339_utc(created_rfc).is_some() {
 obj.insert("dateTime".to_string(), json!(created_rfc));
 obj.insert("dateSource".to_string(), json!("file_created"));
 } else if parse_rfc3339_utc(modified_rfc).is_some() {
 obj.insert("dateTime".to_string(), json!(modified_rfc));
 obj.insert("dateSource".to_string(), json!("file_modified"));
 } else {
 let u = compute_fallback_date_utc(created_rfc, modified_rfc);
 obj.insert("dateTime".to_string(), json!(u.to_rfc3339()));
 obj.insert("dateSource".to_string(), json!("file_created"));
 }
 }
 for key in [
 "width",
 "height",
 "duration",
 "codec",
 "resolution",
 "gpsInfo",
 "cameraInfo",
 "format",
 ] {
 if let Some(v) = meta.get(key) {
 if !v.is_null() {
 obj.insert(key.to_string(), v.clone());
 }
 }
 }
}

/// 单文件：元数据提取 + 与预览相同的日期链 → `YYYY/YYYYMMDD` 子路径
pub fn date_subpath_for_import_source(src: &Path, extractor: &impl MetadataExtractor) -> String {
 let path_str = src.to_string_lossy().replace('\\', "/");
 let Ok(fs_meta) = std::fs::metadata(src) else {
 return generate_date_path_utc(Utc::now());
 };
 let (created_rfc, modified_rfc) = rfc3339_pair_from_fs_meta(&fs_meta);
 let mut fi = json!({
 "path": path_str,
 "createdTime": created_rfc,
 "modifiedTime": modified_rfc,
 });
 let extracted = extractor.extract_json(src);
 merge_extract_into_file_info(&mut fi, &extracted, &created_rfc, &modified_rfc);
 let target_dt = determine_group_target_utc(&fi);
 generate_date_path_utc(target_dt)
}

pub fn join_date_subpath(root: &Path, date_subpath: &str) -> PathBuf {
 let mut p = root.to_path_buf();
 for part in date_subpath.split('/') {
 if !part.is_empty() {
 p.push(part);
 }
 }
 p
}

/// `imported_files[].targetPath`：相对 `targetPath` 根，`{year}/{YYYYMMDD}/文件名`
pub fn relative_target_path_for_import(date_subpath: &str, dest_file_name: &str) -> String {
 let sub = date_subpath.trim_matches('/');
 let name = dest_file_name.replace('\\', "/");
 format!("{sub}/{name}")
}

#[cfg(test)]
mod tests {
 use super::*;
 use filetime::{set_file_times, FileTime};
 use std::io::Write;

 #[test]
 fn generate_date_path_matches_maliang_example() {
 let dt = DateTime::parse_from_rfc3339("2021-05-15T10:30:00+00:00")
 .unwrap()
 .with_timezone(&Utc);
 assert_eq!(generate_date_path_utc(dt), "2021/20210515");
 }

 #[test]
 fn determine_group_prefers_metadata_date_time() {
 let main = json!({
 "dateTime": "2020-06-01T12:00:00+00:00",
 "createdTime": "2019-01-01T12:00:00+00:00",
 "modifiedTime": "2021-01-01T12:00:00+00:00",
 });
 let dt = determine_group_target_utc(&main);
 assert_eq!(generate_date_path_utc(dt), "2020/20200601");
 }

 #[test]
 fn compute_fallback_picks_earlier_timestamp() {
 let e = compute_fallback_date_utc("2022-01-02T00:00:00+00:00", "2021-12-31T00:00:00+00:00");
 assert_eq!(e.date_naive().to_string(), "2021-12-31");
 }

 #[test]
 fn determine_group_uses_earlier_fs_time_when_no_exif() {
 let main = json!({
 "createdTime": "2026-07-22T10:00:00+00:00",
 "modifiedTime": "2024-03-15T12:00:00+00:00",
 });
 let dt = determine_group_target_utc(&main);
 assert_eq!(generate_date_path_utc(dt), "2024/20240315");
 }

 /// RFC 0104：无 EXIF 的 JPEG 依文件时间落入对应日期目录
 #[test]
 fn date_subpath_follows_file_mtime_when_no_exif() {
 let dir = std::env::temp_dir().join(format!("photasa-date-sub-{}", uuid::Uuid::new_v4()));
 std::fs::create_dir_all(&dir).unwrap();
 let path = dir.join("shot.jpg");
 let mut f = std::fs::File::create(&path).unwrap();
 f.write_all(&[0xff, 0xd8, 0xff, 0xd9]).unwrap();
 drop(f);

 let fixed = DateTime::parse_from_rfc3339("2024-03-15T12:00:00+00:00")
 .unwrap()
 .with_timezone(&Utc);
 let ft = FileTime::from_unix_time(fixed.timestamp(), 0);
 set_file_times(&path, ft, ft).unwrap();

 let sub = date_subpath_for_import_source(&path, &EmptyMetadata);
 assert_eq!(sub, "2024/20240315");

 let _ = std::fs::remove_dir_all(&dir);
 }

 #[test]
 fn join_date_subpath_splits_segments() {
 let root = PathBuf::from("photasa_join_root_fixture");
 let p = join_date_subpath(&root, "2024/20240315");
 let mut expected = root.clone();
 expected.push("2024");
 expected.push("20240315");
 assert_eq!(p, expected);
 }

 #[test]
 fn relative_target_path_joins_subpath_and_name() {
 assert_eq!(
 relative_target_path_for_import("2024/20240315", "a.jpg"),
 "2024/20240315/a.jpg"
 );
 }
}

//! RFC 0112：`extract_metadata` golden 对拍 — fixture + 期望 JSON 子集断言
//!
//! Fixture 目录：`tests/fixtures/metadata/`；golden 期望：`tests/fixtures/metadata/golden/*.json`

use serde::Deserialize;
use serde_json::{json, Value};
use std::path::{Path, PathBuf};

use super::extract_metadata::extract_metadata_request;

const FIXTURES_DIR: &str = concat!(env!("CARGO_MANIFEST_DIR"), "/tests/fixtures/metadata");
const GOLDEN_DIR: &str = concat!(
 env!("CARGO_MANIFEST_DIR"),
 "/tests/fixtures/metadata/golden"
);

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct GoldenSpec {
 fixture: String,
 #[serde(default)]
 expect_error: bool,
 #[serde(default)]
 expect: Value,
 #[serde(default)]
 expect_date_time_prefix: Option<String>,
 #[serde(default)]
 expect_keys: Vec<String>,
}

fn fixture_path(name: &str) -> PathBuf {
 Path::new(FIXTURES_DIR).join(name)
}

fn load_golden_spec(file: &str) -> GoldenSpec {
 let path = Path::new(GOLDEN_DIR).join(file);
 let raw = std::fs::read_to_string(&path)
 .unwrap_or_else(|e| panic!("读取 golden 规格 {path:?} 失败: {e}"));
 serde_json::from_str(&raw).unwrap_or_else(|e| panic!("解析 golden 规格 {path:?} 失败: {e}"))
}

/// 递归断言 `actual` 包含 `expected` 中所有键值（子集相等）
fn assert_json_subset(actual: &Value, expected: &Value, path: &str) {
 match (actual, expected) {
 (Value::Object(a), Value::Object(e)) => {
 for (k, ev) in e {
 let key_path = if path.is_empty() {
 k.clone()
 } else {
 format!("{path}.{k}")
 };
 let av = a.get(k).unwrap_or_else(|| panic!("缺少字段 {key_path}"));
 assert_json_subset(av, ev, &key_path);
 }
 }
 (Value::Number(a), Value::Number(e)) => {
 let af = a.as_f64().unwrap_or(f64::NAN);
 let ef = e.as_f64().unwrap_or(f64::NAN);
 assert!(
 (af - ef).abs() < 1e-4,
 "{path}: 数值不匹配 actual={af} expected={ef}"
 );
 }
 _ => assert_eq!(actual, expected, "字段 {path} 子集不匹配"),
 }
}

fn run_golden_spec(spec: &GoldenSpec) {
 let path = fixture_path(&spec.fixture);

 if spec.expect_error {
 assert!(
 !path.exists(),
 "错误用例 fixture 不应存在: {}",
 path.display()
 );
 let result = extract_metadata_request(&json!({ "filePath": path.to_string_lossy() }));
 assert!(result.is_err(), "期望错误但未失败: {}", spec.fixture);
 return;
 }

 assert!(path.exists(), "fixture 不存在: {}", path.display());

 let result = extract_metadata_request(&json!({ "filePath": path.to_string_lossy() }));
 let mut actual = result.unwrap_or_else(|e| panic!("{} 提取失败: {e}", spec.fixture));

 // 路径相关 / volatile 字段不参与 golden 子集
 if let Some(obj) = actual.as_object_mut() {
 obj.remove("path");
 obj.remove("name");
 obj.remove("modifiedTime");
 obj.remove("createdTime");
 obj.remove("size");
 if let Some(dt) = obj.get("dateTime").and_then(|v| v.as_str()) {
 if let Some(prefix) = &spec.expect_date_time_prefix {
 assert!(
 dt.starts_with(prefix),
 "dateTime 前缀不匹配: {dt} 期望前缀 {prefix}"
 );
 }
 obj.remove("dateTime");
 }
 }

 if !spec.expect.is_null()
 && !spec
 .expect
 .as_object()
 .map(|o| o.is_empty())
 .unwrap_or(true)
 {
 assert_json_subset(&actual, &spec.expect, "root");
 }

 for key in &spec.expect_keys {
 assert!(
 actual.get(key).is_some(),
 "{} 缺少期望键 {key}",
 spec.fixture
 );
 }
}

#[cfg(test)]
mod tests {
 use super::*;

 #[test]
 fn golden_minimal_no_exif_jpeg() {
 run_golden_spec(&load_golden_spec("minimal-no-exif.json"));
 }

 #[test]
 fn golden_nikon_exif_sample() {
 run_golden_spec(&load_golden_spec("nikon-exif-sample.json"));
 }

 #[test]
 fn golden_canon_exif_sample() {
 run_golden_spec(&load_golden_spec("canon-exif-sample.json"));
 }

 #[test]
 fn golden_sony_exif_sample() {
 run_golden_spec(&load_golden_spec("sony-exif-sample.json"));
 }

 #[test]
 fn golden_sample_video() {
 run_golden_spec(&load_golden_spec("sample-video.json"));
 }

 #[test]
 fn golden_corrupt_video_fallback() {
 run_golden_spec(&load_golden_spec("corrupt-video.json"));
 }

 #[test]
 fn golden_missing_file_errors() {
 run_golden_spec(&load_golden_spec("missing-file.json"));
 }

 /// 开发用：打印某 fixture 的 Rust 输出，便于从 contract reference 一次性生成 golden JSON
 #[test]
 #[ignore]
 fn dump_fixture_output_for_golden_authoring() {
 let names = [
 "minimal-no-exif.jpg",
 "nikon-exif-sample.jpg",
 "canon-exif-sample.jpg",
 "sony-exif-sample.jpg",
 "sample-video.mp4",
 "corrupt-video.mp4",
 ];
 for name in names {
 let path = fixture_path(name);
 let r = extract_metadata_request(&json!({ "filePath": path.to_string_lossy() }));
 eprintln!(
 "=== {name} ===\n{}\n",
 serde_json::to_string_pretty(&r).unwrap_or_else(|_| format!("ERR: {r:?}"))
 );
 }
 }
}

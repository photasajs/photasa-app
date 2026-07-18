//! 文件组检测 — 对齐 `@photasa/import` `detectEnhancedFileGroups`（RFC 0097）

use serde_json::{json, Value};
use std::collections::{HashMap, HashSet};
use std::path::{Path, PathBuf};

/// 增强关联扩展名（与 `file-groups/detector.ts` ENHANCED_RELATED_EXTENSIONS 一致）
fn enhanced_related_extensions() -> HashMap<&'static str, Vec<&'static str>> {
    HashMap::from([
        ("mp4", vec![".thm", ".lrv", ".srt", ".sub", ".ass", ".vtt"]),
        ("mov", vec![".thm", ".lrv", ".xml", ".fcpxml"]),
        ("avi", vec![".thm", ".idx", ".sub"]),
        ("3gp", vec![".thm", ".srt", ".sub", ".txt"]),
        ("mts", vec![".modd", ".moff"]),
        ("m2ts", vec![".modd", ".moff", ".cpi", ".bup"]),
        ("mkv", vec![".srt", ".sub", ".ass", ".vtt"]),
        ("wmv", vec![".srt", ".sub"]),
        ("cr2", vec![".xmp", ".pp3", ".jpg", ".jpeg"]),
        ("cr3", vec![".xmp", ".pp3", ".jpg", ".jpeg"]),
        ("nef", vec![".xmp", ".pp3", ".jpg", ".jpeg"]),
        ("arw", vec![".xmp", ".pp3", ".jpg", ".jpeg"]),
        ("dng", vec![".xmp", ".pp3"]),
        ("raf", vec![".xmp", ".pp3", ".jpg", ".jpeg"]),
        ("orf", vec![".xmp", ".pp3", ".jpg", ".jpeg"]),
        ("rw2", vec![".xmp", ".pp3", ".jpg", ".jpeg"]),
        ("jpg", vec![".xmp", ".pp3", ".aae"]),
        ("jpeg", vec![".xmp", ".pp3", ".aae"]),
        ("heic", vec![".xmp", ".aae", ".jpg", ".jpeg"]),
        ("heif", vec![".xmp", ".aae", ".jpg", ".jpeg"]),
        ("tiff", vec![".xmp", ".pp3"]),
        ("psd", vec![".xmp"]),
    ])
}

fn file_priority(ext_with_dot: &str) -> i32 {
    match ext_with_dot {
        ".mp4" | ".mov" | ".avi" | ".mkv" | ".wmv" | ".3gp" | ".mts" | ".m2ts" => 1,
        ".cr2" | ".cr3" | ".nef" | ".arw" | ".dng" | ".raf" | ".orf" | ".rw2" => 2,
        ".heic" | ".heif" => 3,
        ".jpg" | ".jpeg" | ".png" | ".tiff" => 4,
        ".xmp" | ".pp3" | ".aae" => 10,
        ".thm" | ".lrv" => 11,
        ".srt" | ".sub" => 12,
        _ => 99,
    }
}

fn stem_and_ext(path: &str) -> (String, String) {
    let p = Path::new(path);
    let stem = p
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("")
        .to_string();
    let ext = p
        .extension()
        .and_then(|s| s.to_str())
        .map(|e| format!(".{}", e.to_lowercase()))
        .unwrap_or_default();
    (stem, ext)
}

fn find_direct_related(
    main: &Value,
    all: &[Value],
    ext_map: &HashMap<&str, Vec<&str>>,
) -> Vec<Value> {
    let main_path = main.get("path").and_then(|v| v.as_str()).unwrap_or("");
    let (base_name, _) = stem_and_ext(main_path);
    let base_dir = Path::new(main_path)
        .parent()
        .map(|p| p.to_string_lossy().into_owned())
        .unwrap_or_default();
    let main_ext = Path::new(main_path)
        .extension()
        .and_then(|s| s.to_str())
        .map(|e| e.to_lowercase())
        .unwrap_or_default();

    let mut related = vec![main.clone()];
    if let Some(exts) = ext_map.get(main_ext.as_str()) {
        for ext in exts {
            let candidate = if base_dir.is_empty() {
                format!("{base_name}{ext}")
            } else {
                PathBuf::from(&base_dir)
                    .join(format!("{base_name}{ext}"))
                    .to_string_lossy()
                    .into_owned()
            };
            if let Some(f) = all
                .iter()
                .find(|x| x.get("path").and_then(|v| v.as_str()) == Some(candidate.as_str()))
            {
                if !related.iter().any(|r| r.get("path") == f.get("path")) {
                    related.push(f.clone());
                }
            }
        }
    }
    related
}

fn push_if_found(all: &[Value], related: &mut Vec<Value>, basename: &str) {
    if let Some(f) = all.iter().find(|x| {
        Path::new(x.get("path").and_then(|v| v.as_str()).unwrap_or(""))
            .file_name()
            .and_then(|s| s.to_str())
            == Some(basename)
    }) {
        if !related.iter().any(|r| r.get("path") == f.get("path")) {
            related.push(f.clone());
        }
    }
}

fn find_special_patterns(main: &Value, all: &[Value], related: &mut Vec<Value>) {
    let main_path = main.get("path").and_then(|v| v.as_str()).unwrap_or("");
    let (base_name, _) = stem_and_ext(main_path);
    let main_ext = Path::new(main_path)
        .extension()
        .and_then(|s| s.to_str())
        .map(|e| e.to_lowercase())
        .unwrap_or_default();

    if base_name.starts_with("GOPR") && main_ext == "mp4" {
        let number = base_name.strip_prefix("GOPR").unwrap_or("");
        for pattern in [
            format!("GP01{number}.LRV"),
            format!("GP02{number}.MP4"),
            format!("GP03{number}.MP4"),
            format!("GOPR{number}.THM"),
        ] {
            push_if_found(all, related, &pattern);
        }
    }

    if base_name.starts_with("DJI_") && main_ext == "mp4" {
        push_if_found(all, related, &format!("{base_name}.SRT"));
    }

    if base_name.starts_with("DSC") && ["arw", "cr2", "nef"].contains(&main_ext.as_str()) {
        push_if_found(all, related, &format!("{base_name}.JPG"));
    }

    if base_name.starts_with("IMG_") && ["cr2", "cr3"].contains(&main_ext.as_str()) {
        push_if_found(all, related, &format!("{base_name}.JPG"));
    }
}

fn group_total_size(files: &[Value]) -> u64 {
    files
        .iter()
        .filter_map(|f| f.get("size").and_then(|v| v.as_u64()))
        .sum()
}

fn find_all_related(main: &Value, all: &[Value], ext_map: &HashMap<&str, Vec<&str>>) -> Value {
    let mut related = find_direct_related(main, all, ext_map);
    find_special_patterns(main, all, &mut related);
    let total = group_total_size(&related);
    let group_type = if related.len() > 1 { "group" } else { "single" };
    json!({
        "mainFile": main,
        "files": related,
        "type": group_type,
        "totalSize": total,
    })
}

/// 增强文件组检测（纯函数，输入/输出为 camelCase JSON FileInfo / FileGroup）
pub fn detect_enhanced_file_groups(files: &[Value]) -> Vec<Value> {
    if files.is_empty() {
        return vec![];
    }
    let ext_map = enhanced_related_extensions();
    let mut sorted: Vec<&Value> = files.iter().collect();
    sorted.sort_by_key(|f| {
        let path = f.get("path").and_then(|v| v.as_str()).unwrap_or("");
        let (_, ext) = stem_and_ext(path);
        file_priority(&ext)
    });

    let mut groups = Vec::new();
    let mut processed: HashSet<String> = HashSet::new();

    for file in sorted {
        let path = file.get("path").and_then(|v| v.as_str()).unwrap_or("");
        if processed.contains(path) {
            continue;
        }
        let group = find_all_related(file, files, &ext_map);
        if let Some(arr) = group.get("files").and_then(|v| v.as_array()) {
            for f in arr {
                if let Some(p) = f.get("path").and_then(|v| v.as_str()) {
                    processed.insert(p.to_string());
                }
            }
        }
        groups.push(group);
    }
    groups
}

/// 两文件是否关联（对齐 `areFilesRelated`；单元测试覆盖，供后续 import 分组复用）
pub fn are_files_related(main_file: &str, candidate_file: &str) -> bool {
    let (main_stem, _) = stem_and_ext(main_file);
    let (cand_stem, cand_ext) = stem_and_ext(candidate_file);
    if main_stem.is_empty() || main_stem != cand_stem {
        return false;
    }
    let main_ext = Path::new(main_file)
        .extension()
        .and_then(|s| s.to_str())
        .map(|e| e.to_lowercase())
        .unwrap_or_default();
    let ext_map = enhanced_related_extensions();
    ext_map
        .get(main_ext.as_str())
        .map(|related| related.iter().any(|e| *e == cand_ext))
        .unwrap_or(false)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn fi(path: &str, size: u64) -> Value {
        let name = Path::new(path).file_name().unwrap().to_str().unwrap();
        json!({
            "path": path,
            "name": name,
            "size": size,
            "type": "image",
            "dateSource": "file_created",
        })
    }

    #[test]
    fn are_files_related_cr2_jpg() {
        assert!(are_files_related("IMG_1234.CR2", "IMG_1234.JPG"));
        assert!(!are_files_related("IMG_1234.CR2", "IMG_1235.JPG"));
    }

    #[test]
    fn detect_groups_raw_and_jpeg() {
        let files = vec![
            fi("/test/IMG_1234.JPG", 1024),
            fi("/test/IMG_1234.CR2", 2048),
            fi("/test/unrelated.png", 512),
        ];
        let groups = detect_enhanced_file_groups(&files);
        assert_eq!(groups.len(), 2);
        let grouped = groups
            .iter()
            .find(|g| g.get("type").and_then(|v| v.as_str()) == Some("group"));
        assert!(grouped.is_some());
        assert_eq!(
            grouped
                .unwrap()
                .get("files")
                .and_then(|v| v.as_array())
                .map(|a| a.len()),
            Some(2)
        );
    }

    #[test]
    fn detect_groups_empty() {
        assert!(detect_enhanced_file_groups(&[]).is_empty());
    }
}

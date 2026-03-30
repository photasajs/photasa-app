/*!
 * 路径工具命令 (RFC 0076)
 * 1:1 替代 Node path / path-util，供 legacy-api 在 Tauri 下 invoke
 */
use std::path::{Component, Path, PathBuf};

/// 返回当前平台路径分隔符
#[tauri::command]
pub fn get_separator() -> String {
    std::path::MAIN_SEPARATOR.to_string()
}

/// 规范化路径：统一分隔符、去除多余斜杠、处理 file:// 前缀
#[tauri::command]
pub fn normalize_path(path: String) -> String {
    let s = path.trim();
    let s = s.strip_prefix("file://").unwrap_or(s);
    let s = s.strip_prefix("file:").unwrap_or(s);
    let p = Path::new(s);
    let normalized = p.components().collect::<PathBuf>();
    normalized.to_string_lossy().replace('\\', "/")
}

/// 合并两段路径（等价 Node path.join）
#[tauri::command]
pub fn merge_path(left: String, right: String) -> String {
    if right.is_empty() {
        return left;
    }
    let p = Path::new(&left).join(&right);
    p.to_string_lossy().to_string()
}

/// 取路径最后一段（文件名，等价 Node path.basename）
#[tauri::command]
pub fn to_file_name(path: String) -> String {
    Path::new(&path)
        .file_name()
        .and_then(|s| s.to_str())
        .unwrap_or("")
        .to_string()
}

/// 取路径除最后一段外的目录部分（等价 Node path.dirname）
#[tauri::command]
pub fn to_dir_name(path: String) -> String {
    Path::new(&path)
        .parent()
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_default()
}

/// 是否为隐藏文件（Unix 点开头；Windows 用 FILE_ATTRIBUTE_HIDDEN）
#[tauri::command]
pub fn is_hidden_file(file_name: String) -> bool {
    let name = Path::new(&file_name).file_name().and_then(|s| s.to_str()).unwrap_or("");
    if name.starts_with('.') {
        return true;
    }
    #[cfg(windows)]
    {
        use std::os::windows::fs::MetadataExt;
        if let Ok(meta) = std::fs::metadata(&file_name) {
            const FILE_ATTRIBUTE_HIDDEN: u32 = 0x2;
            return (meta.file_attributes() & FILE_ATTRIBUTE_HIDDEN) != 0;
        }
    }
    false
}

/// 解析路径为绝对路径（基于当前工作目录）
#[tauri::command]
pub fn resolve_path(path: String) -> Result<String, String> {
    let p = Path::new(&path);
    std::fs::canonicalize(p)
        .or_else(|_| p.canonicalize())
        .map(|pb| pb.to_string_lossy().to_string())
        .map_err(|e| e.to_string())
}

/// 路径根前缀（POSIX `/`、Windows 盘符等；纯相对路径返回空字符串）（RFC 0095）
#[tauri::command]
pub fn get_path_root(path: String) -> String {
    let trimmed = path.trim();
    let p = Path::new(trimmed);
    let mut root = String::new();
    for c in p.components() {
        match c {
            Component::Prefix(prefix) => {
                root.push_str(&prefix.as_os_str().to_string_lossy());
            }
            Component::RootDir => {
                use std::path::MAIN_SEPARATOR;
                if !root.ends_with(MAIN_SEPARATOR) {
                    root.push(MAIN_SEPARATOR);
                }
            }
            _ => break,
        }
    }
    root
}

/// 判断 file 是否位于 folder 之下（路径前缀，规范化后比较）
#[tauri::command]
pub fn is_file_under_folder(file: String, folder: String) -> bool {
    let f = PathBuf::from(&file);
    let d = PathBuf::from(&folder);
    f.starts_with(&d)
}

/// 计算从 from 到 to 的相对路径
#[tauri::command]
pub fn relative_path(from: String, to: String) -> Result<String, String> {
    let from_p = PathBuf::from(&from);
    let to_p = PathBuf::from(&to);
    pathdiff::diff_paths(&to_p, &from_p)
        .and_then(|p| p.to_str().map(String::from))
        .ok_or_else(|| "无法计算相对路径".to_string())
}

// ============================================================
// 文件类型判断（与 Electron is-video / is-image 同行为）
// ============================================================

static VIDEO_EXTS: &[&str] = &[
    "mp4", "mov", "avi", "mkv", "m4v", "3gp", "wmv", "flv", "webm", "mpg", "mpeg",
    "m2v", "mts", "m2ts", "ts", "vob", "rmvb", "rm",
];

static IMAGE_EXTS: &[&str] = &[
    "jpg", "jpeg", "png", "gif", "bmp", "webp", "tiff", "tif",
    "heic", "heif", "avif", "raw", "cr2", "cr3", "nef", "arw",
    "svg", "ico", "psd",
];

fn ext_lower(path: &str) -> String {
    Path::new(path)
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| e.to_lowercase())
        .unwrap_or_default()
}

/// 判断路径是否为视频文件（按扩展名）
#[tauri::command]
pub fn is_video_file(path: String) -> bool {
    let ext = ext_lower(&path);
    VIDEO_EXTS.contains(&ext.as_str())
}

/// 判断路径是否为图片文件（按扩展名）
#[tauri::command]
pub fn is_image_file(path: String) -> bool {
    let ext = ext_lower(&path);
    IMAGE_EXTS.contains(&ext.as_str())
}

/// 返回文件类型字符串："image" | "video" | "unknown"
#[tauri::command]
pub fn get_image_type(path: String) -> String {
    let ext = ext_lower(&path);
    if IMAGE_EXTS.contains(&ext.as_str()) {
        "image".to_string()
    } else if VIDEO_EXTS.contains(&ext.as_str()) {
        "video".to_string()
    } else {
        "unknown".to_string()
    }
}

/// 将本地文件路径转换为 file:// URL
#[tauri::command]
pub fn file_url_from_path(path: String) -> String {
    let p = Path::new(&path);
    // 统一正斜杠（Windows 兼容）
    let normalized = p.to_string_lossy().replace('\\', "/");
    if normalized.starts_with('/') {
        format!("file://{normalized}")
    } else {
        // Windows 盘符：C:/foo → file:///C:/foo
        format!("file:///{normalized}")
    }
}

#[derive(serde::Serialize)]
pub struct FileMetadata {
    pub path: String,
    pub size: u64,
    pub modified: u64, // Unix ms
    pub created: u64,  // Unix ms
    pub is_file: bool,
    pub is_dir: bool,
}

/// 读取文件元数据（大小、修改时间等）
#[tauri::command]
pub fn get_file_metadata(path: String) -> Result<FileMetadata, String> {
    let meta = std::fs::metadata(&path).map_err(|e| e.to_string())?;

    let modified = meta
        .modified()
        .ok()
        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0);

    let created = meta
        .created()
        .ok()
        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0);

    Ok(FileMetadata {
        path,
        size: meta.len(),
        modified,
        created,
        is_file: meta.is_file(),
        is_dir: meta.is_dir(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn get_path_root_abs_posix() {
        assert_eq!(get_path_root("/a/b/c".into()), "/");
    }

    #[test]
    fn get_path_root_relative() {
        assert_eq!(get_path_root("foo/bar".into()), "");
    }
}

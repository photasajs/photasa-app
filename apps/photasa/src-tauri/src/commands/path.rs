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
    let name = Path::new(&file_name)
        .file_name()
        .and_then(|s| s.to_str())
        .unwrap_or("");
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

/// 判断路径是否为视频文件（按扩展名）
#[tauri::command]
pub fn is_video_file(path: String) -> bool {
    photasa_media::is_video_file(&path)
}

/// 判断路径是否为图片文件（按扩展名）
#[tauri::command]
pub fn is_image_file(path: String) -> bool {
    photasa_media::is_image_file(&path)
}

/// 返回文件类型字符串："image" | "video" | "unknown"
#[tauri::command]
pub fn get_image_type(path: String) -> String {
    if photasa_media::is_image_file(&path) {
        "image".to_string()
    } else if photasa_media::is_video_file(&path) {
        "video".to_string()
    } else {
        "unknown".to_string()
    }
}

/// 将本地路径转为 WebView 可加载 URL（Tauri asset 协议，非 file://）
#[tauri::command]
pub fn file_url_from_path(path: String) -> String {
    let normalized = normalize_path(path);
    let encoded = encode_uri_component(&normalized);
    #[cfg(any(windows, target_os = "android"))]
    {
        format!("http://asset.localhost/{encoded}")
    }
    #[cfg(not(any(windows, target_os = "android")))]
    {
        format!("asset://localhost/{encoded}")
    }
}

/// 与 JS `encodeURIComponent` 一致，整段路径编码（含 `/`）
fn encode_uri_component(input: &str) -> String {
    let mut out = String::with_capacity(input.len());
    for byte in input.bytes() {
        match byte {
            b'A'..=b'Z'
            | b'a'..=b'z'
            | b'0'..=b'9'
            | b'-'
            | b'_'
            | b'.'
            | b'!'
            | b'~'
            | b'*'
            | b'\''
            | b'('
            | b')' => {
                out.push(byte as char);
            }
            _ => {
                out.push('%');
                out.push(char::from(b"0123456789ABCDEF"[(byte >> 4) as usize]));
                out.push(char::from(b"0123456789ABCDEF"[(byte & 0xf) as usize]));
            }
        }
    }
    out
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

    #[test]
    fn file_url_from_path_uses_asset_protocol_not_file_scheme() {
        let url = file_url_from_path("/Volumes/SUCAI/a b.jpg".into());
        assert!(!url.starts_with("file:"));
        #[cfg(not(any(windows, target_os = "android")))]
        assert!(url.starts_with("asset://localhost/"));
        let decoded = url.split('/').next_back().unwrap_or("");
        assert_eq!(
            percent_decode(decoded),
            "/Volumes/SUCAI/a b.jpg".to_string()
        );
    }

    fn percent_decode(input: &str) -> String {
        let mut out = String::new();
        let bytes = input.as_bytes();
        let mut i = 0;
        while i < bytes.len() {
            if bytes[i] == b'%' && i + 2 < bytes.len() {
                let hex = &input[i + 1..i + 3];
                if let Ok(v) = u8::from_str_radix(hex, 16) {
                    out.push(v as char);
                    i += 3;
                    continue;
                }
            }
            out.push(bytes[i] as char);
            i += 1;
        }
        out
    }
}

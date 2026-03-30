//! 导入与预览共用的路径过滤（扩展名、Photasa 忽略规则、隐藏文件）

use std::path::Path;

/// 与 Electron `is-image` / `preload` 侧扩展名策略一致
pub const IMAGE_EXTS: &[&str] = &[
    "jpg", "jpeg", "png", "gif", "bmp", "webp", "tiff", "tif", "heic", "heif", "avif", "raw",
    "cr2", "cr3", "nef", "arw", "svg", "ico", "psd",
];

/// 与 preload 视频扩展名策略一致
pub const VIDEO_EXTS: &[&str] = &[
    "mp4", "mov", "avi", "mkv", "m4v", "3gp", "wmv", "flv", "webm", "mpg", "mpeg", "m2v", "mts",
    "m2ts", "ts", "vob", "rmvb", "rm",
];

pub fn ext_lower(path: &Path) -> String {
    path.extension()
        .and_then(|e| e.to_str())
        .map(|e| e.to_lowercase())
        .unwrap_or_default()
}

/// 是否为本流程处理的图片或视频（互斥：通常只有一个为 true）
pub fn classify_media(path: &Path) -> Option<(bool, bool)> {
    let ext = ext_lower(path);
    if ext.is_empty() {
        return None;
    }
    let is_img = IMAGE_EXTS.contains(&ext.as_str());
    let is_vid = VIDEO_EXTS.contains(&ext.as_str());
    if is_img || is_vid {
        Some((is_img, is_vid))
    } else {
        None
    }
}

/// 与 `packages/common` 中 `shouldIgnorePhotasaPath` 字符串规则一致
pub fn should_ignore_photasa_path(path: &str) -> bool {
    path.contains(".photasaoriginals")
        || path.contains(".picasaoriginals")
        || path.contains(".photasaoriginal")
        || path.contains(".picasaoriginal")
        || path.contains(".photasa.json")
        || path.contains(".AppleDouble")
}

/// 与 Node `path.basename` + 点开头 规则一致（隐藏文件跳过）
pub fn basename_hidden(path: &Path) -> bool {
    path.file_name()
        .and_then(|s| s.to_str())
        .map(|n| n.starts_with('.'))
        .unwrap_or(false)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    #[test]
    fn classify_media_jpeg_is_image() {
        let p = PathBuf::from("/tmp/a.JPEG");
        assert_eq!(classify_media(&p), Some((true, false)));
    }

    #[test]
    fn classify_media_mp4_is_video() {
        let p = PathBuf::from("C:\\x\\b.MP4");
        assert_eq!(classify_media(&p), Some((false, true)));
    }

    #[test]
    fn classify_media_txt_is_none() {
        let p = PathBuf::from("/a/b.txt");
        assert_eq!(classify_media(&p), None);
    }

    #[test]
    fn should_ignore_matches_common_photasa_paths() {
        assert!(should_ignore_photasa_path("/p/.photasaoriginals/x.jpg"));
        assert!(should_ignore_photasa_path("/p/.AppleDouble/foo"));
        assert!(!should_ignore_photasa_path("/photos/vacation/img.jpg"));
    }
}

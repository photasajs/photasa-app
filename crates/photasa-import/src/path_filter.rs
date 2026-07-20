//! 导入与预览共用的路径过滤（扩展名、Photasa 忽略规则、隐藏文件）

use std::path::Path;

pub use photasa_media::{IMAGE_EXTS, VIDEO_EXTS};
use photasa_media::{is_image_file, is_video_file};

pub fn ext_lower(path: &Path) -> String {
    path.extension()
        .and_then(|e| e.to_str())
        .map(|e| e.to_lowercase())
        .unwrap_or_default()
}

/// 是否为本流程处理的图片或视频（互斥：通常只有一个为 true）
pub fn classify_media(path: &Path) -> Option<(bool, bool)> {
    let path_str = path.to_string_lossy();
    let is_img = is_image_file(&path_str);
    let is_vid = is_video_file(&path_str);
    if is_img || is_vid {
        Some((is_img, is_vid))
    } else {
        None
    }
}

/// 与 `packages/common` 中 `shouldIgnorePhotasaPath` 规则一致（忽略 photasa/picasa 内部文件、配置、缓存及 OS 垃圾文件）
pub fn should_ignore_photasa_path(path: &str) -> bool {
    let lower = path.to_lowercase();
    lower.contains(".photasa")
        || lower.contains(".picasa")
        || lower.contains("picasa.ini")
        || lower.contains(".appledouble")
        || lower.contains(".ds_store")
        || lower.contains("thumbs.db")
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
        assert!(should_ignore_photasa_path("/p/.photasa-folder.json"));
        assert!(should_ignore_photasa_path("/p/.photasa_config.json"));
        assert!(should_ignore_photasa_path("/p/Picasa.ini"));
        assert!(should_ignore_photasa_path("/p/.AppleDouble/foo"));
        assert!(should_ignore_photasa_path("/p/.DS_Store"));
        assert!(should_ignore_photasa_path("/p/Thumbs.db"));
        assert!(!should_ignore_photasa_path("/photos/vacation/img.jpg"));
    }

    #[test]
    fn basename_hidden_detects_dotfiles() {
        assert!(basename_hidden(Path::new("/a/.secret.jpg")));
        assert!(!basename_hidden(Path::new("/a/visible.jpg")));
        assert!(basename_hidden(Path::new(".hidden")));
    }

    #[test]
    fn ext_lower_empty_without_extension() {
        assert_eq!(ext_lower(Path::new("/a/b/noext")), "");
        assert_eq!(ext_lower(Path::new("/a/b/c.JPEG")), "jpeg");
    }

    #[test]
    fn classify_media_empty_ext_is_none() {
        assert_eq!(classify_media(Path::new("/tmp/noext")), None);
    }
}

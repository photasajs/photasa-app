use std::path::Path;
pub use photasa_types::MediaType;

pub static IMAGE_EXTS: &[&str] = &[
    "jpg", "jpeg", "png", "gif", "bmp", "webp", "tiff", "tif", "svg", "ico", "psd",
];

pub static HEIC_EXTS: &[&str] = &["heic", "heif", "avif"];

pub static RAW_EXTS: &[&str] = &[
    "raw", "cr2", "cr3", "nef", "arw", "dng", "raf", "orf",
];

pub static VIDEO_EXTS: &[&str] = &[
    "mp4", "mov", "avi", "mkv", "m4v", "3gp", "wmv", "flv", "webm", "mpg", "mpeg", "m2v", "mts",
    "m2ts", "ts", "vob", "rmvb", "rm",
];

fn ext_lower(path: &str) -> String {
    Path::new(path)
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| e.to_lowercase())
        .unwrap_or_default()
}

pub fn is_image_file(path: &str) -> bool {
    let ext = ext_lower(path);
    let ext_str = ext.as_str();
    IMAGE_EXTS.contains(&ext_str) || HEIC_EXTS.contains(&ext_str) || RAW_EXTS.contains(&ext_str)
}

pub fn is_video_file(path: &str) -> bool {
    let ext = ext_lower(path);
    VIDEO_EXTS.contains(&ext.as_str())
}

pub fn classify_media(path: &str) -> MediaType {
    let ext = ext_lower(path);
    let ext_str = ext.as_str();
    if IMAGE_EXTS.contains(&ext_str) {
        MediaType::Image
    } else if HEIC_EXTS.contains(&ext_str) {
        MediaType::Heic
    } else if RAW_EXTS.contains(&ext_str) {
        MediaType::Raw
    } else if VIDEO_EXTS.contains(&ext_str) {
        MediaType::Video
    } else {
        MediaType::Unknown
    }
}

/// 是否为本流程处理的图片或视频（互斥：通常只有一个为 true）
pub fn classify_media_flags(path: &Path) -> Option<(bool, bool)> {
    let path_str = path.to_string_lossy();
    let is_img = is_image_file(&path_str);
    let is_vid = is_video_file(&path_str);
    if is_img || is_vid {
        Some((is_img, is_vid))
    } else {
        None
    }
}

/// 忽略 photasa/picasa 内部文件、配置、缓存及 OS 垃圾文件
pub fn should_ignore_photasa_path(path: &str) -> bool {
    let lower = path.to_lowercase();
    lower.contains(".photasa")
        || lower.contains(".picasa")
        || lower.contains("picasa.ini")
        || lower.contains(".appledouble")
        || lower.contains(".ds_store")
        || lower.contains("thumbs.db")
}

/// 点开头隐藏文件跳过
pub fn basename_hidden(path: &Path) -> bool {
    path.file_name()
        .and_then(|s| s.to_str())
        .map(|n| n.starts_with('.'))
        .unwrap_or(false)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_is_image_file() {
        assert!(is_image_file("test.jpg"));
        assert!(is_image_file("test.HEIC"));
        assert!(is_image_file("test.nef"));
        assert!(is_image_file("test.psd"));
        assert!(!is_image_file("test.mp4"));
    }

    #[test]
    fn test_is_video_file() {
        assert!(is_video_file("test.mp4"));
        assert!(is_video_file("test.MOV"));
        assert!(is_video_file("test.rmvb"));
        assert!(!is_video_file("test.jpg"));
    }

    #[test]
    fn test_classify_media() {
        assert_eq!(classify_media("test.jpg"), MediaType::Image);
        assert_eq!(classify_media("test.heic"), MediaType::Heic);
        assert_eq!(classify_media("test.cr2"), MediaType::Raw);
        assert_eq!(classify_media("test.mp4"), MediaType::Video);
        assert_eq!(classify_media("test.txt"), MediaType::Unknown);
    }
}

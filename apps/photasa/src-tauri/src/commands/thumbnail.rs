/*!
 * 缩略图命令
 *
 * 实现 create_thumbnail / remove_thumbnail，对应 Electron MaLiang 引擎的核心能力：
 * - 图片（JPEG/PNG/WebP/BMP/GIF/TIFF）：用 `image` crate 缩放
 * - HEIC/HEIF/AVIF：用 `libheif-rs` 解码后缩放
 * - 视频：`ffmpeg-next`（libav）约 1s 处截帧并缩放
 * - RAW：暂不支持（需专用解码器）
 * - 删除：直接移除目标文件
 */
use std::path::Path;

use libheif_rs::{ColorSpace, HeifContext, LibHeif, RgbChroma};
use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ThumbnailRequest {
    /// 源文件路径
    pub path: String,
    /// 目标缩略图路径
    pub thumbnail: String,
    pub width: Option<u32>,
    pub height: Option<u32>,
    pub without_enlargement: Option<bool>,
    /// 预览图路径（可选，生成较大尺寸供全屏预览）
    pub preview: Option<String>,
    /// 即使缩略图已存在也强制重新生成
    pub always: Option<bool>,
}

#[derive(Debug, Serialize)]
pub struct ThumbnailResponse {
    pub success: bool,
    pub file: Option<String>,
    pub error: Option<String>,
}

impl ThumbnailResponse {
    fn ok(file: String) -> Self {
        Self { success: true, file: Some(file), error: None }
    }
    fn err(msg: impl Into<String>) -> Self {
        Self { success: false, file: None, error: Some(msg.into()) }
    }
}

// ============================================================
// 扩展名分类
// ============================================================

static VIDEO_EXTS: &[&str] = &[
    "mp4", "mov", "avi", "mkv", "m4v", "3gp", "wmv", "flv", "webm",
    "mpg", "mpeg", "m2v", "mts", "m2ts", "ts",
];

static IMAGE_EXTS: &[&str] = &[
    "jpg", "jpeg", "png", "gif", "bmp", "webp", "tiff", "tif",
];

static HEIC_EXTS: &[&str] = &["heic", "heif", "avif"];
static RAW_EXTS: &[&str] = &["raw", "cr2", "cr3", "nef", "arw", "dng", "raf", "orf"];

fn ext(path: &str) -> String {
    Path::new(path)
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| e.to_lowercase())
        .unwrap_or_default()
}

// ============================================================
// create_thumbnail
// ============================================================

/// 创建缩略图（Tauri command）
#[tauri::command]
pub async fn create_thumbnail(request: ThumbnailRequest) -> ThumbnailResponse {
    let src = &request.path;
    let dst = &request.thumbnail;

    // 若目标已存在且不强制重建，直接返回
    if !request.always.unwrap_or(false) && Path::new(dst).exists() {
        return ThumbnailResponse::ok(dst.clone());
    }

    // 确保目标目录存在
    if let Some(parent) = Path::new(dst).parent() {
        if let Err(e) = std::fs::create_dir_all(parent) {
            return ThumbnailResponse::err(format!("创建目录失败: {e}"));
        }
    }

    let e = ext(src);

    if IMAGE_EXTS.contains(&e.as_str()) {
        // 同步 CPU 密集操作放入 spawn_blocking，不阻塞 Tokio 运行时
        let req = ThumbnailRequest {
            path: request.path.clone(),
            thumbnail: request.thumbnail.clone(),
            width: request.width,
            height: request.height,
            without_enlargement: request.without_enlargement,
            preview: request.preview.clone(),
            always: request.always,
        };
        tokio::task::spawn_blocking(move || make_image_thumbnail(&req.path, &req.thumbnail, &req))
            .await
            .unwrap_or_else(|e| ThumbnailResponse::err(format!("线程异常: {e}")))
    } else if VIDEO_EXTS.contains(&e.as_str()) {
        let src_owned = src.to_string();
        let dst_owned = dst.to_string();
        let w = request.width.unwrap_or(256);
        let h = request.height.unwrap_or(256);
        tokio::task::spawn_blocking(move || {
            make_video_thumbnail_blocking(&src_owned, &dst_owned, w, h)
        })
        .await
        .unwrap_or_else(|e| ThumbnailResponse::err(format!("线程异常: {e}")))
    } else if HEIC_EXTS.contains(&e.as_str()) {
        let req = ThumbnailRequest {
            path: request.path.clone(),
            thumbnail: request.thumbnail.clone(),
            width: request.width,
            height: request.height,
            without_enlargement: request.without_enlargement,
            preview: request.preview.clone(),
            always: request.always,
        };
        tokio::task::spawn_blocking(move || make_heic_thumbnail(&req.path, &req.thumbnail, &req))
            .await
            .unwrap_or_else(|e| ThumbnailResponse::err(format!("线程异常: {e}")))
    } else if RAW_EXTS.contains(&e.as_str()) {
        ThumbnailResponse::err(format!("暂不支持 RAW 格式（{e}）缩略图"))
    } else {
        ThumbnailResponse::err(format!("未知文件类型: {e}"))
    }
}

// ============================================================
// 图片缩略图：image crate
// ============================================================

fn make_image_thumbnail(src: &str, dst: &str, req: &ThumbnailRequest) -> ThumbnailResponse {
    let img = match image::open(src) {
        Ok(i) => i,
        Err(e) => return ThumbnailResponse::err(format!("打开图片失败: {e}")),
    };

    let w = req.width.unwrap_or(256);
    let h = req.height.unwrap_or(256);

    let resized = if req.without_enlargement.unwrap_or(true) {
        // 不放大：只在图片比目标大时才缩小
        let (ow, oh) = (img.width(), img.height());
        if ow <= w && oh <= h {
            img
        } else {
            img.thumbnail(w, h)
        }
    } else {
        img.thumbnail(w, h)
    };

    if let Err(e) = resized.save(dst) {
        return ThumbnailResponse::err(format!("保存缩略图失败: {e}"));
    }

    // 如果有预览图路径，生成较大尺寸
    if let Some(preview_path) = &req.preview {
        if let Some(parent) = Path::new(preview_path).parent() {
            let _ = std::fs::create_dir_all(parent);
        }
        // 预览图使用更大尺寸（1024x1024）
        let preview = image::open(src).ok().map(|i| i.thumbnail(1024, 1024));
        if let Some(p) = preview {
            let _ = p.save(preview_path);
        }
    }

    ThumbnailResponse::ok(dst.to_string())
}

// ============================================================
// HEIC/HEIF/AVIF 缩略图：libheif-rs 解码
// ============================================================

fn make_heic_thumbnail(src: &str, dst: &str, req: &ThumbnailRequest) -> ThumbnailResponse {
    let lib_heif = LibHeif::new();

    let ctx = match HeifContext::read_from_file(src) {
        Ok(c) => c,
        Err(e) => return ThumbnailResponse::err(format!("打开 HEIC 文件失败: {e}")),
    };

    let handle = match ctx.primary_image_handle() {
        Ok(h) => h,
        Err(e) => return ThumbnailResponse::err(format!("获取主图像句柄失败: {e}")),
    };

    let has_alpha = handle.has_alpha_channel();
    let chroma = if has_alpha { RgbChroma::Rgba } else { RgbChroma::Rgb };
    let color_space = ColorSpace::Rgb(chroma);

    let decoded = match lib_heif.decode(&handle, color_space, None) {
        Ok(img) => img,
        Err(e) => return ThumbnailResponse::err(format!("解码 HEIC 失败: {e}")),
    };

    let img_width = decoded.width();
    let img_height = decoded.height();
    let planes = decoded.planes();
    let interleaved = match planes.interleaved {
        Some(p) => p,
        None => return ThumbnailResponse::err("HEIC 解码无交错平面数据".to_string()),
    };

    // 构建 image::DynamicImage
    let dyn_img = if has_alpha {
        let buf = image::RgbaImage::from_raw(img_width, img_height, interleaved.data.to_vec())
            .ok_or("RGBA 缓冲区大小不匹配".to_string());
        match buf {
            Ok(b) => image::DynamicImage::ImageRgba8(b),
            Err(e) => return ThumbnailResponse::err(e),
        }
    } else {
        let buf = image::RgbImage::from_raw(img_width, img_height, interleaved.data.to_vec())
            .ok_or("RGB 缓冲区大小不匹配".to_string());
        match buf {
            Ok(b) => image::DynamicImage::ImageRgb8(b),
            Err(e) => return ThumbnailResponse::err(e),
        }
    };

    // 复用 make_image_thumbnail 的缩放逻辑
    let w = req.width.unwrap_or(256);
    let h = req.height.unwrap_or(256);
    let resized = if req.without_enlargement.unwrap_or(true) {
        if img_width <= w && img_height <= h { dyn_img } else { dyn_img.thumbnail(w, h) }
    } else {
        dyn_img.thumbnail(w, h)
    };

    if let Err(e) = resized.save(dst) {
        return ThumbnailResponse::err(format!("保存 HEIC 缩略图失败: {e}"));
    }

    // 预览图
    if let Some(preview_path) = &req.preview {
        if let Some(parent) = Path::new(preview_path).parent() {
            let _ = std::fs::create_dir_all(parent);
        }
        if let Ok(ctx2) = HeifContext::read_from_file(src) {
            if let Ok(original) = ctx2.primary_image_handle() {
            if let Ok(decoded2) = lib_heif.decode(&original, color_space, None) {
                let planes2 = decoded2.planes();
                if let Some(p2) = planes2.interleaved {
                    let preview_img = if has_alpha {
                        image::RgbaImage::from_raw(decoded2.width(), decoded2.height(), p2.data.to_vec())
                            .map(image::DynamicImage::ImageRgba8)
                    } else {
                        image::RgbImage::from_raw(decoded2.width(), decoded2.height(), p2.data.to_vec())
                            .map(image::DynamicImage::ImageRgb8)
                    };
                    if let Some(pi) = preview_img {
                        let _ = pi.thumbnail(1024, 1024).save(preview_path);
                    }
                }
            }
            } // close primary_image_handle
        } // close HeifContext
    }

    ThumbnailResponse::ok(dst.to_string())
}

// ============================================================
// 视频缩略图：ffmpeg-next（libav）
// ============================================================

fn make_video_thumbnail_blocking(src: &str, dst: &str, max_w: u32, max_h: u32) -> ThumbnailResponse {
    use std::path::Path as StdPath;

    use crate::commands::ffmpeg_next_util::save_video_thumbnail;

    match save_video_thumbnail(StdPath::new(src), StdPath::new(dst), max_w, max_h) {
        Ok(()) => ThumbnailResponse::ok(dst.to_string()),
        Err(e) => ThumbnailResponse::err(e),
    }
}

// ============================================================
// remove_thumbnail
// ============================================================

/// 删除缩略图文件
#[tauri::command]
pub async fn remove_thumbnail(request: ThumbnailRequest) -> ThumbnailResponse {
    let dst = &request.thumbnail;
    if !Path::new(dst).exists() {
        return ThumbnailResponse::ok(dst.clone());
    }
    match std::fs::remove_file(dst) {
        Ok(_) => ThumbnailResponse::ok(dst.clone()),
        Err(e) => ThumbnailResponse::err(format!("删除失败: {e}")),
    }
}

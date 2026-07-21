//! `ffmpeg-next`：进程内 libav（随 `photasa` 静态链接编译的 FFmpeg，不依赖系统安装的 ffmpeg/ffprobe）

use std::path::Path;
use std::sync::Once;

use ffmpeg_next as ff;
use ffmpeg_next::format::Pixel;
use ffmpeg_next::media::Type as MediaType;
use ffmpeg_next::software::scaling::{
    context::Context as ScalingContext, flag::Flags as ScaleFlags,
};
use ffmpeg_next::util::frame::video::Video;

static FFMPEG_INIT: Once = Once::new();

/// 进程内 FFmpeg 全局初始化（幂等）
pub fn ensure_ffmpeg_initialized() {
    FFMPEG_INIT.call_once(|| {
        ff::init().expect("ffmpeg_next::init 失败");
    });
}

/// 与 `force_original_aspect_ratio=decrease` 一致：不放大，按比例落入 `max_w`×`max_h`
fn fit_inside(sw: u32, sh: u32, max_w: u32, max_h: u32) -> (u32, u32) {
    if sw == 0 || sh == 0 {
        return (max_w.max(1), max_h.max(1));
    }
    let scale = (max_w as f64 / sw as f64)
        .min(max_h as f64 / sh as f64)
        .min(1.0);
    let w = ((sw as f64 * scale).round() as u32).max(1);
    let h = ((sh as f64 * scale).round() as u32).max(1);
    (w, h)
}

/// 将 DisplayMatrix side data 转为近似旋转角（度），与 ffprobe JSON 中 `rotation` 语义接近
pub fn rotation_deg_from_display_matrix(data: &[u8]) -> Option<f64> {
    const NEED: usize = 9 * 4;
    if data.len() < NEED {
        return None;
    }
    let mut m = [0i32; 9];
    for i in 0..9 {
        m[i] = i32::from_le_bytes(data[i * 4..i * 4 + 4].try_into().ok()?);
    }
    let theta = (-(m[1] as f64)).atan2(m[0] as f64) * 180.0 / std::f64::consts::PI;
    Some(theta.round())
}

/// 获取视频旋转角度 (0, 90, 180, 270)
pub fn get_video_rotation(ictx: &mut ff::format::context::Input, stream_idx: usize) -> i32 {
    if let Some(stream) = ictx.stream(stream_idx) {
        if let Some(rotate_str) = stream.metadata().get("rotate") {
            if let Ok(deg) = rotate_str.parse::<f64>() {
                let norm = ((deg.round() as i32 % 360) + 360) % 360;
                if norm != 0 {
                    return norm;
                }
            }
        }

        for side_data in stream.side_data() {
            if side_data.kind() == ff::packet::side_data::Type::DisplayMatrix {
                if let Some(deg) = rotation_deg_from_display_matrix(side_data.data()) {
                    let norm = ((deg.round() as i32 % 360) + 360) % 360;
                    if norm != 0 {
                        return norm;
                    }
                }
            }
        }
    }

    if let Some(rotate_str) = ictx.metadata().get("rotate") {
        if let Ok(deg) = rotate_str.parse::<f64>() {
            let norm = ((deg.round() as i32 % 360) + 360) % 360;
            if norm != 0 {
                return norm;
            }
        }
    }

    0
}

/// 约 1s 处截一帧，缩放后写入 `dst`（JPEG，与原先 ffmpeg CLI 行为对齐）
pub fn save_video_thumbnail(src: &Path, dst: &Path, max_w: u32, max_h: u32) -> Result<(), String> {
    ensure_ffmpeg_initialized();

    let mut ictx = ff::format::input(src).map_err(|e| e.to_string())?;
    let input = ictx
        .streams()
        .best(MediaType::Video)
        .ok_or_else(|| "无视频流".to_string())?;
    let video_stream_index = input.index();

    let rotation = get_video_rotation(&mut ictx, video_stream_index);

    let seek_ts = i64::from(ff::ffi::AV_TIME_BASE);
    if ictx.seek(seek_ts, std::ops::RangeFull).is_err() {
        let _ = ictx.seek(0i64, std::ops::RangeFull);
    }

    let stream = ictx
        .stream(video_stream_index)
        .ok_or_else(|| "视频流索引无效".to_string())?;

    let mut decoder = ff::codec::context::Context::from_parameters(stream.parameters())
        .map_err(|e| e.to_string())?
        .decoder()
        .video()
        .map_err(|e| e.to_string())?;

    let (raw_w, raw_h) = (decoder.width(), decoder.height());
    let is_swapped = rotation == 90 || rotation == 270;
    let (eff_w, eff_h) = if is_swapped {
        (raw_h, raw_w)
    } else {
        (raw_w, raw_h)
    };

    let (out_w, out_h) = fit_inside(eff_w, eff_h, max_w, max_h);
    let (target_raw_w, target_raw_h) = if is_swapped {
        (out_h, out_w)
    } else {
        (out_w, out_h)
    };

    let mut scaler = ScalingContext::get(
        decoder.format(),
        raw_w,
        raw_h,
        Pixel::RGB24,
        target_raw_w,
        target_raw_h,
        ScaleFlags::BILINEAR,
    )
    .map_err(|e| e.to_string())?;

    let mut decoded = Video::empty();
    let mut rgb = Video::empty();

    let save_rgb = |frame: &Video| -> Result<(), String> {
        let stride = frame.stride(0);
        let row = target_raw_w as usize * 3;
        let mut packed = Vec::with_capacity(row * target_raw_h as usize);
        for y in 0..target_raw_h as usize {
            let start = y * stride;
            packed.extend_from_slice(&frame.data(0)[start..start + row]);
        }
        let img = image::RgbImage::from_raw(target_raw_w, target_raw_h, packed)
            .ok_or_else(|| "RGB 缓冲区与尺寸不符".to_string())?;

        let final_img = match rotation {
            90 => image::imageops::rotate90(&img),
            180 => image::imageops::rotate180(&img),
            270 => image::imageops::rotate270(&img),
            _ => img,
        };

        final_img.save(dst).map_err(|e| e.to_string())
    };

    for (s, packet) in ictx.packets() {
        if s.index() == video_stream_index {
            decoder.send_packet(&packet).map_err(|e| e.to_string())?;
            if decoder.receive_frame(&mut decoded).is_ok() {
                scaler.run(&decoded, &mut rgb).map_err(|e| e.to_string())?;
                save_rgb(&rgb)?;
                return Ok(());
            }
        }
    }

    decoder.send_eof().map_err(|e| e.to_string())?;
    if decoder.receive_frame(&mut decoded).is_ok() {
        scaler.run(&decoded, &mut rgb).map_err(|e| e.to_string())?;
        save_rgb(&rgb)?;
        return Ok(());
    }

    Err("未能解码出视频帧".to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_fit_inside_portrait_and_landscape() {
        // 横屏视频 (1920x1080) -> 256x144
        assert_eq!(fit_inside(1920, 1080, 256, 256), (256, 144));

        // 竖屏视频 (1080x1920) -> 144x256
        assert_eq!(fit_inside(1080, 1920, 256, 256), (144, 256));

        // 正方形 (1000x1000) -> 256x256
        assert_eq!(fit_inside(1000, 1000, 256, 256), (256, 256));
    }

    #[test]
    fn test_rotation_deg_from_display_matrix() {
        // 90度 DisplayMatrix 样例
        let matrix_90: [i32; 9] = [0, 65536, 0, -65536, 0, 0, 0, 0, 1073741824];
        let mut bytes = Vec::new();
        for val in matrix_90 {
            bytes.extend_from_slice(&val.to_le_bytes());
        }
        let rot = rotation_deg_from_display_matrix(&bytes);
        assert_eq!(rot, Some(-90.0));
    }
}

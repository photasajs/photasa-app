# RFC 0146: Tauri Rust 缩略图 EXIF 方向与宽高比修复

- **RFC编号**: 0146
- **标题**: Tauri Rust 缩略图 EXIF 方向与宽高比修复
- **作者**: Antigravity
- **开始日期**: 2026-07-20
- **状态**: ✅ **Implemented**
- **完成日期**: 2026-07-20
- **类型**: 架构 / Bug修复
- **目标组件**: `crates/photasa-thumbnail` (`apps/photasa`)

---

## 1. 概述 (Overview)

本 RFC 规范了在 Photasa Tauri Rust 后端 (`crates/photasa-thumbnail`) 中对图片 (JPEG, WebP, TIFF, HEIC/AVIF) 的 EXIF Orientation 旋转与视频 (MP4, MOV 等) 的元数据旋转角度 (`rotate` / `Display Matrix`) 的自动识别与自适应旋转矫正，确保生成的缩略图能准确反映真实竖屏 (Portrait) 与横屏 (Landscape) 方向与宽高比。

---

## 2. 问题背景 (Background)

在之前的 Rust 缩略图生成器实现中：

1. **图片/HEIC 缺失 EXIF Orientation 处理**：使用 `image::open` 解码图片或 `libheif-rs` 解码 HEIC 时，未根据 EXIF 0x0112 标签做 90°/180°/270° 旋转与翻转。手机拍摄的竖屏照片（Orientation 6 或 8）生成的缩略图画面为侧卧横屏，且宽高比被错算为横屏。
2. **视频缺失旋转角度处理**：`video.rs` 虽然定义了 `rotation_deg_from_display_matrix`，但未在 `save_video_thumbnail` 中提取 Display Matrix / Metadata `rotate` 标签。竖屏拍摄的视频（如 1080x1920 旋转 90°）生成的缩略图被压缩为 256x144 横屏且没有旋转。

---

## 3. 技术方案 (Technical Design)

### 3.1 EXIF Orientation 自动解析与转换 (`src/exif.rs`)

建立高效的轻量级纯 Rust EXIF Orientation 解析器：

- 支持 JPEG (APP1 `0xFFE1`), TIFF (`II`/`MM`), WebP, RAW 及 HEIC 包含的 EXIF 二进制块。
- 解析 `0x0112` 标签 (Orientation: 1..=8)。
- 映射转换 `image::DynamicImage`：
    - 1: 正常
    - 2: 水平翻转 (`fliph`)
    - 3: 旋转 180° (`rotate180`)
    - 4: 垂直翻转 (`flipv`)
    - 5: 水平翻转 + 旋转 270° (`fliph().rotate270()`)
    - 6: 顺时针旋转 90° (`rotate90`)
    - 7: 水平翻转 + 旋转 90° (`fliph().rotate90()`)
    - 8: 顺时针旋转 270° (`rotate270`)

### 3.2 视频旋转与等比缩放 (`src/video.rs`)

1. **获取旋转角度 `get_video_rotation`**：
    - 检查 Stream Metadata 标签 `rotate`
    - 检查 Stream Side Data `AV_PKT_DATA_DISPLAYMATRIX`
    - 检查 Format Metadata 标签 `rotate`
    - 规范化角度至 `0`, `90`, `180`, `270`
2. **有效宽高计算与缩放**：
    - 若旋转为 `90°` 或 `270°`，有效视频尺寸 `(eff_w, eff_h) = (raw_h, raw_w)`
    - 调用 `fit_inside(eff_w, eff_h, max_w, max_h)` 计算正确的目标缩略图尺寸 `(out_w, out_h)`
    - FFmpeg 缩放器解码出的未旋转帧按 `(out_h, out_w)` 采样，再通过 `imageops::rotate90` / `rotate270` 转置为 `(out_w, out_h)` 竖屏缩略图并落盘。

---

## 4. 实施计划 (Implementation Tasks)

- [x] 创建 `crates/photasa-thumbnail/src/exif.rs` 提供 EXIF orientation 解析与变换函数
- [x] 在 `crates/photasa-thumbnail/src/thumbnail.rs` `make_image_thumbnail` 与 `make_heic_thumbnail` 中应用 `exif::apply_orientation`
- [x] 在 `crates/photasa-thumbnail/src/video.rs` 实现 `get_video_rotation` 并在 `save_video_thumbnail` 中应用旋转与宽高交换
- [x] 编写 Rust 单元测试 `cargo test -p photasa-thumbnail`

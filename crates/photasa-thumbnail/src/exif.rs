/*!
 * EXIF Orientation 解析器
 * 支持从 JPEG, TIFF, WebP, HEIC 等二进制数据或文件中读取 EXIF Orientation 标签 (0x0112)
 */

/// 从文件路径获取 EXIF Orientation (1..=8)
pub fn get_exif_orientation_from_file(path: &str) -> Option<u32> {
    let mut file = std::fs::File::open(path).ok()?;
    use std::io::Read;
    let mut buf = vec![0u8; 65536]; // 64KB is enough for JPEG/TIFF/WebP EXIF headers
    let n = file.read(&mut buf).ok()?;
    get_exif_orientation_from_bytes(&buf[..n])
}

/// 从字节数组中解析 EXIF Orientation (1..=8)
pub fn get_exif_orientation_from_bytes(data: &[u8]) -> Option<u32> {
    if data.len() < 12 {
        return None;
    }

    // 检查 JPEG APP1 marker (0xFFE1)
    if data[0] == 0xFF && data[1] == 0xE1 {
        let app1_len = ((data[2] as usize) << 8) | (data[3] as usize);
        let end = (4 + app1_len).min(data.len());
        if end >= 10 {
            let app1_data = &data[4..end];
            if app1_data.len() >= 6 && &app1_data[..6] == b"Exif\0\0" {
                return parse_tiff_orientation(&app1_data[6..]);
            }
        }
    }

    // 检查是否为 RAW TIFF header ("II" 或 "MM")
    if &data[..2] == b"II" || &data[..2] == b"MM" {
        return parse_tiff_orientation(data);
    }

    // 查找 Exif\0\0 关键字 (针对 WebP / HEIC EXIF block)
    if let Some(pos) = data.windows(6).position(|w| w == b"Exif\0\0") {
        return parse_tiff_orientation(&data[pos + 6..]);
    }

    None
}

fn parse_tiff_orientation(data: &[u8]) -> Option<u32> {
    if data.len() < 8 {
        return None;
    }

    let is_le = match &data[..2] {
        b"II" => true,
        b"MM" => false,
        _ => return None,
    };

    let read_u16 = |buf: &[u8]| -> u16 {
        if is_le {
            u16::from_le_bytes([buf[0], buf[1]])
        } else {
            u16::from_be_bytes([buf[0], buf[1]])
        }
    };

    let read_u32 = |buf: &[u8]| -> u32 {
        if is_le {
            u32::from_le_bytes([buf[0], buf[1], buf[2], buf[3]])
        } else {
            u32::from_be_bytes([buf[0], buf[1], buf[2], buf[3]])
        }
    };

    // 验证 TIFF magic 42 (0x002A)
    if read_u16(&data[2..4]) != 42 {
        return None;
    }

    let ifd_offset = read_u32(&data[4..8]) as usize;
    if ifd_offset + 2 > data.len() {
        return None;
    }

    let num_entries = read_u16(&data[ifd_offset..ifd_offset + 2]) as usize;
    let entries_start = ifd_offset + 2;

    for i in 0..num_entries {
        let entry_offset = entries_start + i * 12;
        if entry_offset + 12 > data.len() {
            break;
        }

        let tag = read_u16(&data[entry_offset..entry_offset + 2]);
        if tag == 0x0112 {
            // Orientation tag
            let val = read_u16(&data[entry_offset + 8..entry_offset + 10]);
            if (1..=8).contains(&val) {
                return Some(val as u32);
            }
        }
    }

    None
}

/// 根据 EXIF Orientation 旋转/翻转 DynamicImage，使其呈现正确方向
pub fn apply_orientation(
    img: image::DynamicImage,
    orientation: u32,
) -> image::DynamicImage {
    match orientation {
        2 => img.fliph(),
        3 => img.rotate180(),
        4 => img.flipv(),
        5 => img.fliph().rotate270(),
        6 => img.rotate90(),
        7 => img.fliph().rotate90(),
        8 => img.rotate270(),
        _ => img,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_apply_orientation() {
        let img = image::DynamicImage::new_rgb8(100, 50); // 横屏 100x50
        assert_eq!(img.width(), 100);
        assert_eq!(img.height(), 50);

        let portrait = apply_orientation(img, 6); // rotate90 CW
        assert_eq!(portrait.width(), 50);
        assert_eq!(portrait.height(), 100);
    }
}

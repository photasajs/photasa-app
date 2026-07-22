//! RAW / 回退缩略图占位渲染（纯 Rust，RFC 0102 扩展名标签迭代）
//!
//! 对齐 legacy-api Ma-Liang `FallbackBrush` 的核心信息：在占位图上居中绘制扩展名（如 `CR2`）。

use std::path::Path;

use image::{ImageBuffer, Rgb, RgbImage};

const GLYPH_W: u32 = 5;
const GLYPH_H: u32 = 7;
const GLYPH_GAP: u32 = 1;

const BG_TOP: Rgb<u8> = Rgb([248, 249, 250]);
const BG_BOTTOM: Rgb<u8> = Rgb([233, 236, 239]);
const BADGE: Rgb<u8> = Rgb([108, 117, 125]);
const TEXT: Rgb<u8> = Rgb([255, 255, 255]);
const BORDER: Rgb<u8> = Rgb([222, 226, 230]);

/// 从源路径提取大写扩展名标签（无点号），缺省为 `RAW`。
pub fn extension_label_from_path(path: &str) -> String {
 Path::new(path)
 .extension()
 .and_then(|e| e.to_str())
 .map(|e| e.to_ascii_uppercase())
 .filter(|e| !e.is_empty())
 .unwrap_or_else(|| "RAW".to_string())
}

/// 生成带扩展名标签的 RGB 占位图（不写盘）。
pub fn render_labeled_placeholder(width: u32, height: u32, label: &str) -> RgbImage {
 let w = width.max(1);
 let h = height.max(1);
 let normalized = normalize_label(label);
 let mut img: RgbImage = ImageBuffer::new(w, h);

 for y in 0..h {
 let t = if h <= 1 {
 0.0
 } else {
 y as f32 / (h - 1) as f32
 };
 let row_color = lerp_rgb(BG_TOP, BG_BOTTOM, t);
 for x in 0..w {
 img.put_pixel(x, y, row_color);
 }
 }

 draw_border(&mut img, w, h);
 draw_centered_label(&mut img, w, h, &normalized);
 img
}

fn normalize_label(label: &str) -> String {
 label
 .chars()
 .filter(|c| c.is_ascii_alphanumeric())
 .take(8)
 .map(|c| c.to_ascii_uppercase())
 .collect::<String>()
}

fn lerp_rgb(a: Rgb<u8>, b: Rgb<u8>, t: f32) -> Rgb<u8> {
 let t = t.clamp(0.0, 1.0);
 Rgb([
 lerp_u8(a.0[0], b.0[0], t),
 lerp_u8(a.0[1], b.0[1], t),
 lerp_u8(a.0[2], b.0[2], t),
 ])
}

fn lerp_u8(a: u8, b: u8, t: f32) -> u8 {
 (a as f32 + (b as f32 - a as f32) * t).round() as u8
}

fn draw_border(img: &mut RgbImage, w: u32, h: u32) {
 if w < 2 || h < 2 {
 return;
 }
 for x in 0..w {
 img.put_pixel(x, 0, BORDER);
 img.put_pixel(x, h - 1, BORDER);
 }
 for y in 0..h {
 img.put_pixel(0, y, BORDER);
 img.put_pixel(w - 1, y, BORDER);
 }
}

fn draw_centered_label(img: &mut RgbImage, w: u32, h: u32, label: &str) {
 if label.is_empty() {
 return;
 }

 let scale = compute_scale(w, h, label.chars().count());
 let text_w = label.chars().count() as u32 * (GLYPH_W + GLYPH_GAP) - GLYPH_GAP;
 let text_h = GLYPH_H;
 let pixel_w = text_w * scale;
 let pixel_h = text_h * scale;

 let badge_pad_x = (scale * 2).max(4);
 let badge_pad_y = (scale * 2).max(4);
 let badge_w = pixel_w + badge_pad_x * 2;
 let badge_h = pixel_h + badge_pad_y * 2;
 let badge_x = w.saturating_sub(badge_w) / 2;
 let badge_y = h.saturating_sub(badge_h) / 2;

 fill_rect(img, badge_x, badge_y, badge_w, badge_h, BADGE);

 let text_x = badge_x + badge_pad_x;
 let text_y = badge_y + badge_pad_y;
 draw_text(img, text_x, text_y, scale, label, TEXT);
}

fn compute_scale(width: u32, height: u32, char_count: usize) -> u32 {
 if char_count == 0 {
 return 1;
 }
 let chars = char_count as u32;
 let base_w = chars * (GLYPH_W + GLYPH_GAP) - GLYPH_GAP;
 let base_h = GLYPH_H;
 let max_w = width.saturating_sub(8).max(1);
 let max_h = height.saturating_sub(8).max(1);
 let scale_w = max_w / base_w.max(1);
 let scale_h = max_h / base_h.max(1);
 scale_w.min(scale_h).clamp(1, 6)
}

fn fill_rect(img: &mut RgbImage, x: u32, y: u32, w: u32, h: u32, color: Rgb<u8>) {
 let (img_w, img_h) = img.dimensions();
 for py in y..y.saturating_add(h).min(img_h) {
 for px in x..x.saturating_add(w).min(img_w) {
 img.put_pixel(px, py, color);
 }
 }
}

fn draw_text(img: &mut RgbImage, x: u32, y: u32, scale: u32, text: &str, color: Rgb<u8>) {
 let mut cursor_x = x;
 for ch in text.chars() {
 if let Some(rows) = glyph_rows(ch) {
 blit_glyph(img, cursor_x, y, scale, &rows, color);
 }
 cursor_x += (GLYPH_W + GLYPH_GAP) * scale;
 }
}

fn blit_glyph(img: &mut RgbImage, x: u32, y: u32, scale: u32, rows: &[u8; 7], color: Rgb<u8>) {
 let (img_w, img_h) = img.dimensions();
 for (row_idx, row) in rows.iter().enumerate() {
 for col in 0..GLYPH_W {
 if (row >> (GLYPH_W - 1 - col)) & 1 == 1 {
 for sy in 0..scale {
 for sx in 0..scale {
 let px = x + col * scale + sx;
 let py = y + row_idx as u32 * scale + sy;
 if px < img_w && py < img_h {
 img.put_pixel(px, py, color);
 }
 }
 }
 }
 }
 }
}

/// 5×7 位图字体（A–Z、0–9）。
fn glyph_rows(ch: char) -> Option<[u8; 7]> {
 match ch {
 '0' => Some([
 0b01110, 0b10001, 0b10011, 0b10101, 0b11001, 0b10001, 0b01110,
 ]),
 '1' => Some([
 0b00100, 0b01100, 0b00100, 0b00100, 0b00100, 0b00100, 0b01110,
 ]),
 '2' => Some([
 0b01110, 0b10001, 0b00001, 0b00110, 0b01000, 0b10000, 0b11111,
 ]),
 '3' => Some([
 0b11110, 0b00001, 0b00001, 0b01110, 0b00001, 0b00001, 0b11110,
 ]),
 '4' => Some([
 0b00010, 0b00110, 0b01010, 0b10010, 0b11111, 0b00010, 0b00010,
 ]),
 '5' => Some([
 0b11111, 0b10000, 0b11110, 0b00001, 0b00001, 0b10001, 0b01110,
 ]),
 '6' => Some([
 0b01110, 0b10000, 0b11110, 0b10001, 0b10001, 0b10001, 0b01110,
 ]),
 '7' => Some([
 0b11111, 0b00001, 0b00010, 0b00100, 0b01000, 0b01000, 0b01000,
 ]),
 '8' => Some([
 0b01110, 0b10001, 0b10001, 0b01110, 0b10001, 0b10001, 0b01110,
 ]),
 '9' => Some([
 0b01110, 0b10001, 0b10001, 0b01111, 0b00001, 0b00010, 0b01100,
 ]),
 'A' => Some([
 0b01110, 0b10001, 0b10001, 0b11111, 0b10001, 0b10001, 0b10001,
 ]),
 'B' => Some([
 0b11110, 0b10001, 0b10001, 0b11110, 0b10001, 0b10001, 0b11110,
 ]),
 'C' => Some([
 0b01110, 0b10001, 0b10000, 0b10000, 0b10000, 0b10001, 0b01110,
 ]),
 'D' => Some([
 0b11100, 0b10010, 0b10001, 0b10001, 0b10001, 0b10010, 0b11100,
 ]),
 'E' => Some([
 0b11111, 0b10000, 0b10000, 0b11110, 0b10000, 0b10000, 0b11111,
 ]),
 'F' => Some([
 0b11111, 0b10000, 0b10000, 0b11110, 0b10000, 0b10000, 0b10000,
 ]),
 'G' => Some([
 0b01110, 0b10001, 0b10000, 0b10111, 0b10001, 0b10001, 0b01111,
 ]),
 'H' => Some([
 0b10001, 0b10001, 0b10001, 0b11111, 0b10001, 0b10001, 0b10001,
 ]),
 'I' => Some([
 0b01110, 0b00100, 0b00100, 0b00100, 0b00100, 0b00100, 0b01110,
 ]),
 'J' => Some([
 0b00111, 0b00010, 0b00010, 0b00010, 0b10010, 0b10010, 0b01100,
 ]),
 'K' => Some([
 0b10001, 0b10010, 0b10100, 0b11000, 0b10100, 0b10010, 0b10001,
 ]),
 'L' => Some([
 0b10000, 0b10000, 0b10000, 0b10000, 0b10000, 0b10000, 0b11111,
 ]),
 'M' => Some([
 0b10001, 0b11011, 0b10101, 0b10101, 0b10001, 0b10001, 0b10001,
 ]),
 'N' => Some([
 0b10001, 0b11001, 0b10101, 0b10011, 0b10001, 0b10001, 0b10001,
 ]),
 'O' => Some([
 0b01110, 0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b01110,
 ]),
 'P' => Some([
 0b11110, 0b10001, 0b10001, 0b11110, 0b10000, 0b10000, 0b10000,
 ]),
 'Q' => Some([
 0b01110, 0b10001, 0b10001, 0b10001, 0b10101, 0b10010, 0b01101,
 ]),
 'R' => Some([
 0b11110, 0b10001, 0b10001, 0b11110, 0b10100, 0b10010, 0b10001,
 ]),
 'S' => Some([
 0b01111, 0b10000, 0b10000, 0b01110, 0b00001, 0b00001, 0b11110,
 ]),
 'T' => Some([
 0b11111, 0b00100, 0b00100, 0b00100, 0b00100, 0b00100, 0b00100,
 ]),
 'U' => Some([
 0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b01110,
 ]),
 'V' => Some([
 0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b01010, 0b00100,
 ]),
 'W' => Some([
 0b10001, 0b10001, 0b10001, 0b10101, 0b10101, 0b11011, 0b10001,
 ]),
 'X' => Some([
 0b10001, 0b10001, 0b01010, 0b00100, 0b01010, 0b10001, 0b10001,
 ]),
 'Y' => Some([
 0b10001, 0b10001, 0b01010, 0b00100, 0b00100, 0b00100, 0b00100,
 ]),
 'Z' => Some([
 0b11111, 0b00001, 0b00010, 0b00100, 0b01000, 0b10000, 0b11111,
 ]),
 _ => None,
 }
}

#[cfg(test)]
mod tests {
 use super::*;

 #[test]
 fn extension_label_from_path_uppercases_and_strips_dot() {
 assert_eq!(extension_label_from_path("/photos/sample.cr2"), "CR2");
 assert_eq!(extension_label_from_path("clip.NEF"), "NEF");
 }

 #[test]
 fn extension_label_defaults_to_raw_when_missing() {
 assert_eq!(extension_label_from_path("/no/ext"), "RAW");
 }

 #[test]
 fn labeled_placeholder_has_non_uniform_pixels() {
 let img = render_labeled_placeholder(64, 48, "CR2");
 let corner = *img.get_pixel(1, 1);
 let mut found_badge = false;
 for pixel in img.pixels() {
 if *pixel == BADGE || *pixel == TEXT {
 found_badge = true;
 break;
 }
 }
 assert!(found_badge, "expected badge/text pixels, corner={corner:?}");
 assert_ne!(corner, BADGE);
 }

 #[test]
 fn normalize_label_filters_non_alnum() {
 assert_eq!(normalize_label(".cr2"), "CR2");
 assert_eq!(normalize_label("cr3-extra"), "CR3EXTRA");
 }
}

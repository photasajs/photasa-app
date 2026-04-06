# RFC 0102: 缩略图 RAW 格式回退策略（Tauri）

- **Start Date**: 2026-04-05
- **Status**: Implemented（方案 A：纯色占位 JPEG；扩展名文字见后续迭代）
- **Depends on**: RFC 0069 (缩略图服务迁移)

## Summary

为 Tauri `thumbnail.rs` 中当前未处理的 RAW 相机格式（CR2/CR3/NEF/ARW/DNG/RAF/ORF 等）定义明确的回退策略，与 Electron MaLiang `FallbackBrush` 行为保持 1:1 对齐。

## Motivation

`thumbnail.rs` 已声明 `static RAW_EXTS` 并对匹配扩展名生成 JPEG 占位图，响应中带 `fallback: true`。Electron MaLiang 的 `FallbackBrush` 可带格式标签；当前 Tauri 占位为纯色块，信息量略少但避免空白格。

RAW 格式是摄影用户的核心格式（Canon CR3、Sony ARW、Nikon NEF 等），缺失回退会导致缩略图区域空白或崩溃。

## Current State（Electron MaLiang）

- `SharpBrush`：JPEG/PNG/WebP/TIFF/GIF/AVIF
- `BmpBrush`：BMP
- `HeicBrush`：HEIC/HEIF
- `FfmpegBrush`：所有视频
- **`FallbackBrush`**：其余格式（含 RAW）→ 生成带格式标签的占位图标

## Detailed Design

### 方案 A（推荐短期）：占位图标回退

对 RAW 格式生成带扩展名文字的纯色占位缩略图（纯 Rust，无外部依赖）：

```rust
// thumbnail.rs 中的 RAW 分支
fn generate_placeholder(ext: &str, dst: &str, width: u32, height: u32) -> ThumbnailResponse {
    // 使用 `image` crate 生成带格式文字的灰色方块
    // 文字渲染：使用 `imageproc` + 内嵌字体，或直接写像素
    // 输出：JPEG 占位图，大小与请求尺寸一致
}
```

触发条件：`RAW_EXTS.contains(&ext.as_str())` 时走 `generate_placeholder`。

### 方案 B（长期）：`rawler` crate 解码

Rust 生态有 `rawler`（rawler.rs）支持主流 RAW 格式解码，提取内嵌 JPEG 预览图，质量接近 dcraw。

```toml
[dependencies]
rawler = "0.x"
```

限制：`rawler` 成熟度待评估，部分相机型号支持不完整。

### 推荐实现路径

1. **立即**：实现方案 A，消除空白缩略图（RAW → 占位图标）
2. **后续**：评估 `rawler`，逐步替换占位为真实预览

### `ThumbnailResponse` 变更

新增 `fallback: bool` 字段，前端可据此展示"格式暂不支持"提示：

```rust
pub struct ThumbnailResponse {
    pub success: bool,
    pub file: Option<String>,
    pub error: Option<String>,
    pub fallback: Option<bool>,  // true = 占位图
}
```

## Drawbacks

- 占位图标信息量有限，无法反映 RAW 内容
- `rawler` 方案引入较重的编译依赖

## Alternatives

- **返回 error**：前端显示通用错误图标（比占位简单，但用户体验差）
- **复用内嵌 JPEG**：部分 RAW 文件内嵌了 JPEG 预览，可用 `kamadak-exif` 或 `rawler` 提取，不全量解码

## Implementation Checklist

### 方案 A（短期）
1. `thumbnail.rs`：添加 `generate_placeholder(ext, dst, w, h)` 纯 Rust 实现
2. `create_thumbnail`：RAW 分支调用 `generate_placeholder`
3. `ThumbnailResponse`：添加 `fallback` 字段
4. `legacy-api.ts`：前端处理 `fallback: true` 时显示格式标签

### 方案 B（长期，独立 PR）
5. `Cargo.toml`：添加 `rawler`
6. `thumbnail.rs`：RAW 分支调用 `rawler` 提取内嵌 JPEG 预览
7. 保留方案 A 作为 `rawler` 失败时的最终回退

## Implementation（Photasa）

- `apps/photasa/src-tauri/src/commands/thumbnail.rs`：`make_raw_placeholder_thumbnail`，`ThumbnailResponse.fallback: Option<bool>`
- `apps/photasa/src/api/thumbnail.adapter.ts`：`ThumbnailResponse.fallback?: boolean`
- 单元测试：`raw_placeholder_writes_file_and_sets_fallback`（`thumbnail.rs`）
- **未做**：`legacy-api` 层专门 UI 提示（可选读取 `fallback` 展示「占位」徽标）

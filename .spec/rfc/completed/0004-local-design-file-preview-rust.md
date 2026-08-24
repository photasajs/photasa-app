# RFC 0004: `design-thumbnail` PSD / AI 本地缩略图 crate

## Implementation principle

> 先交付独立、通用 Rust crate：PSD / AI 输入文件 → 缩略图输出文件。
>
> crate 不属于 Photasa，因此名称不加 `photasa-`。Photasa 集成是后续工作。

文件名保留旧 `preview` slug，避免破坏现有 RFC 链接。

**Status**: ✅ Completed（独立 crate；Photasa 集成未开始）
**Created**: 2024-01
**Rewritten**: 2026-07-26
**Archived**: 2026-07-26
**Related**: [0069](./0069-tauri-thumbnail-service-migration.md)、[0103](./0103-tauri-native-deps-build-strategy.md)、[0173](../0173-photasa-design-thumbnail-integration.md)

---

## Summary

新增 workspace crate：

```text
crates/design-thumbnail
```

唯一职责：

```text
PSD / PDF-compatible AI
  → 解码
  → 等比缩放
  → 编码
  → 写缩略图文件
```

第一阶段只构建和验证 crate。`photasa-thumbnail` 暂不接入。

## Motivation

Photasa 需要 PSD / AI 缩略图，但格式解码能力本身不依赖 Photasa、Tauri、IPC、缓存或 UI。它是可独立测试、可被其他 Rust 程序复用的通用能力。

前次审查错误地把目标理解为“给现有 `photasa-thumbnail` 补两个私有 decoder”。用户随后明确：

```text
目标是独立本地 Rust crate。
crate 自己完成缩略图文件生成。
以后才由 photasa-thumbnail 使用。
```

因此，前次“不建新 crate”决定被本次明确需求取代。

## Goals

1. 建立独立 `design-thumbnail` Rust library crate。
2. PSD merged/composite image 生成缩略图文件。
3. PDF-compatible AI 第 0 页生成缩略图文件。
4. crate 自己完成解码、缩放、编码和写文件。
5. 纯 Rust 默认后端；macOS、Windows、Linux 无系统依赖。
6. 使用真实 PSD / AI 样本做公开 API 端到端测试。
7. 损坏、不支持或伪装格式返回 typed error，不 panic。

## Non-goals

- 本阶段接入 `photasa-thumbnail`。
- Photasa 缓存、placeholder、request/response、IPC、扫描或 UI。
- PSD 图层读取、编辑或 blend 重建。
- Illustrator 原生对象模型或编辑。
- 普通 `.pdf` 文件作为公开支持格式。
- Legacy PostScript / EPS AI。
- PSB。
- metadata。
- preview viewer。
- 云端转换。

---

## Crate boundary

### Name

```toml
[package]
name = "design-thumbnail"
```

Rust import：

```rust
use design_thumbnail::{generate_thumbnail, ThumbnailOptions};
```

禁止依赖：

- `photasa-*`
- Tauri
- Node / TypeScript
- IPC
- Photasa 配置或缓存

### Public API

```rust
use std::path::Path;

pub struct ThumbnailOptions {
    pub max_width: u32,
    pub max_height: u32,
}

pub fn generate_thumbnail(
    source: impl AsRef<Path>,
    destination: impl AsRef<Path>,
    options: ThumbnailOptions,
) -> Result<(), ThumbnailError>;
```

行为：

- source 扩展名决定 PSD / AI decoder。
- decoder 必须验证真实文件结构，不能只信扩展名。
- destination 扩展名决定输出编码格式。
- 首版输出格式为 PNG / JPEG；其他扩展名返回 `Encode`。
- 输出保持宽高比。
- 输出宽高不超过 `max_width` / `max_height`。
- `max_width == 0` 或 `max_height == 0` 返回 `InvalidDimensions`。
- crate 不创建 placeholder；不支持格式返回错误。

### Modules

```text
crates/design-thumbnail/
├── Cargo.toml
├── src/
│   ├── lib.rs
│   ├── psd.rs
│   ├── ai.rs
│   ├── output.rs
│   └── error.rs
└── tests/
    ├── fixtures/
    │   ├── sample.psd
    │   └── sample.ai
    ├── FIXTURES.md
    ├── errors.rs
    └── generate_thumbnail.rs
```

职责：

| 文件        | 职责                                      |
| ----------- | ----------------------------------------- |
| `lib.rs`    | 公共 API、扩展名分发                      |
| `psd.rs`    | PSD composite → `DynamicImage`            |
| `ai.rs`     | PDF-compatible AI page 0 → `DynamicImage` |
| `output.rs` | 等比缩放、目标目录、编码、写文件          |
| `error.rs`  | typed error                               |

不建立 renderer trait。出现第二套真实后端前不抽象。

---

## Decoder decisions

### PSD

首版使用纯 Rust `psd` crate：

```text
read bytes
  → validate 8BPS / version 1
  → decode merged/composite RGBA
  → DynamicImage
```

首版承诺：

- PSD version 1。
- decoder 支持的 RGB / RGBA composite。
- decoder 支持的 raw / RLE compression。
- alpha。

不承诺：

- PSB version 2。
- ZIP / ZIP prediction compression。
- 完整 CMYK / spot color fidelity。
- layer recomposition。

### AI

首版使用纯 Rust `hayro`：

```text
read whole .ai file
  → parse as PDF-compatible document
  → render page 0
  → DynamicImage
```

不切片 `%PDF-` 数据，不修复 xref，不创建临时 PDF。

原因：

- PDF xref 偏移绑定原文件。
- 切片会制造偏移修复特殊情况。
- 整个文件能被 PDF renderer 接受才算支持。

AI 不是 PDF-compatible、无 page 0 或渲染失败：返回 typed error。

### Backend gate

纯 Rust 后端必须通过真实 fixture：

- PSD 样本生成可解码缩略图。
- Illustrator 生成且启用 PDF compatibility 的 AI 样本生成可解码缩略图。

若 `hayro` 无法正确渲染真实 AI 样本：

1. 测试保持失败。
2. 不宣称 AI 支持。
3. RFC 返回 Review，单独评估 bundled PDFium。
4. 公共 API 和模块边界不变。

---

## Error model

```rust
pub enum ThumbnailError {
    InvalidDimensions,
    UnsupportedExtension(String),
    InvalidPsd(String),
    UnsupportedPsd(String),
    InvalidAi(String),
    UnsupportedAi(String),
    Decode(String),
    Encode(String),
    Io(std::io::Error),
}
```

实现可用 `thiserror`，但错误必须保持上述可区分语义。

---

## Test design

### Fixture policy

- 使用真实文件，不 mock parser。
- fixture 小、许可清晰、提交仓库。
- `FIXTURES.md` 记录来源 URL、commit、license、原始文件名和 SHA-256。
- AI fixture 必须由 Illustrator 生成并启用 PDF compatibility；普通 PDF 改扩展名不能充当完整 AI 验收样本。

### End-to-end assertions

公开 API 测试：

```text
generate_thumbnail(source, destination, options)
  → Ok
  → destination exists
  → image::open(destination) succeeds
  → width <= max_width
  → height <= max_height
  → width > 0
  → height > 0
```

错误测试：

- zero width / height。
- unsupported extension。
- corrupt PSD。
- corrupt AI。
- PSB。
- non-PDF-compatible AI。
- unsupported output extension。

不使用逐像素 golden hash。跨平台字体、色彩和 renderer 可能产生合法像素差异。

---

## Implementation plan

### Task 1: Crate contract and RED tests

1. 在 root `Cargo.toml` 增加 `crates/design-thumbnail` workspace member 和 dependency。
2. 创建 crate manifest，只加入 `image`、`thiserror` 和测试所需依赖。
3. 创建空 library target。
4. 添加真实 PSD / AI fixtures 与 `FIXTURES.md`。
5. 写公开 API PSD 端到端测试。
6. 写公开 API AI 端到端测试。
7. 运行 `cargo test -p design-thumbnail`，确认因 API/实现缺失而 RED。

### Task 2: Shared contract and output

1. 定义 `ThumbnailOptions`、`ThumbnailError` 和 `generate_thumbnail` 分发。
2. 写 zero dimensions 和 unsupported extension RED tests。
3. 实现最小输入验证。
4. 写 output resize/save RED tests。
5. 实现等比缩放、目录创建和按目标扩展名保存。
6. 运行测试，确认 shared path GREEN。

### Task 3: PSD

1. 添加固定版本 `psd` dependency。
2. 写 PSD fixture RED test。
3. 实现 `psd.rs` composite decode。
4. 写 corrupt PSD / PSB tests。
5. 运行 crate 全测，确认 PSD GREEN。

### Task 4: AI

1. 添加固定版本 `hayro` dependency。
2. 写真实 PDF-compatible AI fixture RED test。
3. 实现 `ai.rs` whole-file page-0 render。
4. 写 corrupt / non-PDF-compatible AI tests。
5. 运行 crate 全测，确认 AI GREEN；失败则执行 Backend gate，不伪造通过。

### Task 5: Cross-platform and quality

1. `cargo fmt --package design-thumbnail -- --check`。
2. `cargo clippy -p design-thumbnail --all-targets -- -D warnings`。
3. `cargo test -p design-thumbnail`。
4. `cargo check -p design-thumbnail --target x86_64-pc-windows-msvc`。
5. `cargo check -p design-thumbnail --target x86_64-unknown-linux-gnu`。
6. 检查依赖树无系统 PSD/PDF runtime dependency。
7. 更新 RFC 实测结果和已知限制。

---

## Acceptance criteria

- [x] `design-thumbnail` 不依赖任何 `photasa-*` crate。
- [x] 真实 PSD 样本端到端生成缩略图。
- [x] 真实 PDF-compatible AI 样本端到端生成缩略图。
- [x] 输出文件可由 `image` 解码。
- [x] 输出尺寸不超过请求。
- [x] 损坏和不支持输入返回 typed error，不 panic。
- [x] macOS 本机测试通过。
- [x] Windows / Linux target check 通过。
- [x] 无系统安装步骤。
- [x] 本阶段未修改 `photasa-thumbnail` 集成逻辑。

## Implementation result

完成于 2026-07-26：

- 建立 `crates/design-thumbnail`，公开 API 与本 RFC 一致。
- `psd = 0.3.5` 解码 version 1 raw / RLE composite；PSB 与 decoder panic 转为 typed error；ZIP 明确不支持。
- `hayro = 0.7.1` 对完整 PDF-compatible AI 文件渲染第 0 页。
- `image` 仅启用 `png` / `jpeg` feature，避免无关 codec 和系统 runtime。
- 真实 fixtures：PSD 24 KiB；Illustrator CC 2015 PDF-compatible AI 408 KiB；来源、许可、commit 与 SHA-256 见 `tests/FIXTURES.md`。
- 10 个公开 API 测试通过：真实 PSD、真实 AI、PNG / JPEG、尺寸、扩展名、损坏输入、PSB、旧 PostScript AI、输出编码。

验证命令：

```text
cargo fmt --package design-thumbnail -- --check
cargo clippy -p design-thumbnail --all-targets -- -D warnings
cargo test -p design-thumbnail
cargo check -p design-thumbnail --target x86_64-pc-windows-msvc
cargo check -p design-thumbnail --target x86_64-unknown-linux-gnu
cargo tree -p design-thumbnail
```

macOS 本机格式、Clippy、测试通过；Windows MSVC 与 Linux GNU target check 通过。依赖树无 `photasa-*`、Tauri、Node、PDFium、Poppler 或系统 PSD/PDF runtime。

## Alternatives rejected

| 方案                         | 原因                              |
| ---------------------------- | --------------------------------- |
| `photasa-design-thumbnail`   | crate 通用，不属于 Photasa        |
| 直接写进 `photasa-thumbnail` | 违背独立 crate 明确需求           |
| crate 只返回像素             | 目标要求 crate 完成缩略图文件生成 |
| 自写 PSD / PDF parser        | 工作量与目标不匹配                |
| Quick Look                   | 仅 macOS                          |
| 系统 PDFium / Poppler        | Windows/Linux 环境不一致          |
| 云端转换                     | 非本地、非离线                    |

---

**最后更新**: 2026-07-26
**作者**: 李鹏 / AI

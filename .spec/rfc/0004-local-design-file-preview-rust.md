# RFC 0004: 设计文件本地预览（Rust / 全离线）

## Implementation principle (Photasa / Tauri)

> **Rust-first, zero server.** 解码与栅格化在 `crates/` + `src-tauri`；前端只展示缓存路径。Policy: [ROADMAP.md](../../ROADMAP.md)、[TAURI_RUST_REWRITE_POLICY.md](../../docs/rfc/TAURI_RUST_REWRITE_POLICY.md)。

**Status**: ⏳ Draft（Photasa Active）  
**Created**: 2024-01（v2.0 在线服务草案）  
**Supersedes**: 原「AI 文件在线预览服务」云方案（见文末归档）  
**Replaces legacy**: [0005](./completed/0005-local-ai-file-preview.md) 中 Electron/`ag-psd` 路径（Photasa 以本 RFC 为准）  
**Related**: [0005](./completed/0005-local-ai-file-preview.md)、[0069](./completed/0069-tauri-thumbnail-service-migration.md)、[0102](./completed/0102-raw-thumbnail-placeholder.md)、[0103](./completed/0103-tauri-native-deps-build-strategy.md)

---

## Summary

为 Photasa 提供 **Adobe Illustrator (`.ai`)** 及后续设计格式（`.psd` 等）的 **全本地** 缩略图与预览：无上传、无订阅 API、离线可用。

**Phase 1** 聚焦 `.ai`：多数现代文件内嵌 PDF 流 → **PDFium 栅格化第 0 页** → 写入现有 thumbnail 缓存；失败则复用 `render_labeled_placeholder("AI")`。

**非目标**：可编辑图层、Illustrator 原生还原、云端转换、捆绑 Ghostscript（AGPL）。

---

## Background

| 现状 | 问题 |
|------|------|
| `acceptedAiExtensions` 含 `ai`，`FileTypeBadge` 可显示 | Rust 扫描未纳入 `.ai`，无缩略图 |
| `extract_metadata` 对 `fileType: ai` 落 `type: other` | 元数据不完整 |
| RFC 0005（Electron + `ag-psd`）标完成，`.ai` 仍为「待调研」 | Photasa 需 Rust 重写，非 TS 拷贝 |
| 原 RFC 0004 云预览 | 隐私/离线/成本与产品定位冲突 → **废止** |

### `.ai` 文件模型

```
.ai
├── PdfAtStart     — 文件头即 %PDF（常见）
├── PdfEmbedded    — PostScript 头后内嵌 %PDF（Illustrator 默认「PDF 兼容」）
├── LegacyPostScript — 纯 PS/EPS，无 PDF
└── Opaque         — 无 PDF 兼容（仅占位 + 用系统默认应用打开）
```

本地预览 = **视觉扁平稿**，不是 Illustrator 文档模型。

---

## Goals

1. `.ai` 进入扫描与 `create_thumbnail` 管线，图库可见缩略图与灯箱预览。
2. **100% 设备端处理**；文件不离开用户机器。
3. 与 `photasa-thumbnail` / `photasa-media` 分类一致；复用现有 IPC（无新 command）。
4. PDFium 与 FFmpeg、embedded-libheif 同策略：**vendor 进 bundle**，不依赖系统 `poppler` / `gs`。

## Non-goals

- Figma `.fig` / Sketch `.sketch` 在线解析（Phase 3+ 或另开 RFC）。
- 订阅制云端预览（原 0004 云方案，已废止）。
- CMYK/专色与 Illustrator 像素级一致（接受近似）。

---

## Decision

### 方案 A（推荐）：`photasa-design` + PDFium

| 组件 | 职责 |
|------|------|
| `crates/photasa-design` | `sniff` 容器类型、`extract` PDF 切片、`rasterize` page 0 |
| `crates/photasa-thumbnail` | `MediaType::Design` → `make_design_thumbnail` |
| `crates/photasa-media` | `DESIGN_EXTS`、分类 |
| `pdfium-render` + vendored PDFium | 栅格化（BSD，可捆绑） |

**原理**：现代 `.ai` 可读作 PDF 子集；`density` 等价逻辑在 Rust 侧用 DPI→scale 实现。

**风险**：无 PDF 兼容文件只能占位；CMYK 可能色偏。

### 方案 B：MuPDF 统一设计稿

覆盖 EPS/PS + PDF；构建与体积更重。**Phase 2** 可选 feature `design-legacy-ps`，非 Phase 1。

### 方案 C：云端转换（原 0004）

已 **废止** — 见文末归档。

---

## Architecture

```
扫描 path.ai
  → photasa-media::classify_media → MediaType::Design
  → scan_runner → create_thumbnail (existing IPC)
       → spawn_blocking:
            sniff_ai_container(path)
            → PdfAtStart | PdfEmbedded → extract_pdf_bytes → temp or mem
            → rasterize_pdf_page0(dpi) via PDFium
            → image: resize thumb + preview (max ~2048)
            → write ~/.photasa/thumbnails/...webp
            → on failure: render_labeled_placeholder(..., "AI")
  → UI: same media URL as JPEG
```

### Crate layout

```
crates/photasa-design/
  src/
    sniff.rs       # AiContainerKind, find %PDF in header window
    extract.rs     # slice [offset..] to temp file for PDFium
    rasterize.rs   # Pdfium bind (singleton), page 0 → DynamicImage
    error.rs
    lib.rs         # preview_from_path(path, PreviewSizes) -> Result<...>
```

### Detection (pure Rust)

```rust
pub enum AiContainerKind {
    PdfAtStart,
    PdfEmbedded { offset: usize },
    LegacyPostScript,
    Opaque,
}
```

- 读首 64KB（可配置）查找 `b"%PDF-"`。
- `LegacyPostScript`：Phase 1 → 占位；Phase 2 → MuPDF（可选）。

### Rasterization

| 输出 | DPI（相对 72pt） |
|------|------------------|
| Thumbnail | ~96 |
| Preview | ~200 |

缓存键：`path + mtime + size + thumb_px + preview_px`（与现 thumbnail 一致）。

### PDFium bundling

对齐 RFC 0103：

- `apps/photasa/src-tauri/vendor/pdfium/{macos,linux,windows}/`
- `build.rs` 复制到 bundle / `resource_dir`
- CI 缓存预编译包（如 [bblanchon/pdfium-binaries](https://github.com/bblanchon/pdfium-binaries)）或静态链 `PDFIUM_STATIC_LIB_PATH`
- **禁止**默认依赖 Ghostscript / 系统 poppler

---

## Integration checklist

### Rust

- [ ] `photasa-media`: `DESIGN_EXTS = ["ai"]`, `MediaType::Design`
- [ ] `photasa-design` crate + workspace member
- [ ] `photasa-thumbnail`: `make_design_thumbnail`
- [ ] `extract_metadata`: `fileType: ai` → `type: "ai"` + width/height when preview ok
- [ ] `scan_runner` / import path filter：`.ai` 入队

### Frontend（薄层）

- [ ] `folder-tree.ts` / `watch-event.ts` 扩展名含 `ai`
- [ ] 预览组件无变更（已有 `FileTypeBadge`）；失败占位与 RAW 一致

### Tests

- [ ] `photasa-design`: fixture `pdf_compatible.ai`, `legacy_ps.ai`, golden thumb hash
- [ ] `photasa-thumbnail`: design branch integration test
- [ ] CI：三平台 PDFium vendor smoke

---

## Phased rollout

| Phase | 范围 | 覆盖率（估） |
|-------|------|----------------|
| **1** | `.ai` sniff + PDFium + placeholder | ~85–90% 现代文件 |
| **2** | Legacy PS via MuPDF (`design-legacy-ps` feature) | +5–10% |
| **3** | `.psd`（`psd` crate 或 MuPDF），与 0005 PSD 元数据对齐 | 另验收 |

---

## Acceptance criteria

- [ ] 10+ PDF 兼容 `.ai` 样本：缩略图非占位，`openPreview` 正确
- [ ] 无 PDF 样本：占位图 `AI`，不 panic
- [ ] 飞行模式 / 断网：行为与在线一致
- [ ] `pnpm --filter @photasa/photasa run typecheck` + 新 crate 测试通过
- [ ] 产物内无 `gs` / poppler 运行时依赖

---

## Verification

```bash
cargo test -p photasa-design
cargo test -p photasa-thumbnail
pnpm --filter @photasa/photasa run typecheck
```

手动：大 `.ai` 文件夹滚动；Activity Monitor 内存稳定；改缩略图尺寸后重建 thumb。

---

## Alternatives rejected

| 选项 | 原因 |
|------|------|
| Ghostscript / ImageMagick | AGPL；PDF policy 默认禁用；非自包含 |
| 仅 macOS Quick Look | Win/Linux 无 parity |
| `lopdf` 自绘 | 无栅格化 |
| 云端 RFC 0004 原案 | 隐私、离线、运营成本 |

---

## License / compliance

- **PDFium**: Chromium BSD-style，允许捆绑。
- **不**将 Ghostscript 作为默认依赖（AGPL）。

---

## Archived: 在线预览服务（v2.0 草案，已废止）

> **废止日期**: 2026-07-24  
> **原因**: Photasa Tauri 路线要求 Rust 全本地；用户文件不上传；与 [AGENTS.md](../../AGENTS.md) Rust-first 一致。  
> **替代**: 本文档 Phase 1–3。

<details>
<summary>原云架构摘要（只读归档）</summary>

- 客户端上传 → Preview API → 解析器 → CDN 缓存
- 订阅鉴权、24h 临时存储、月成本 $350–950 估算
- 支持 `.ai` / `.psd` / `.sketch` / `.figma` / `.xd`

完整原文见 git 历史 `pending/0004-ai-file-preview-service.md`（2026-07-24 前）。

</details>

---

**最后更新**: 2026-07-24  
**作者**: 李鹏 / AI（2026 修订）

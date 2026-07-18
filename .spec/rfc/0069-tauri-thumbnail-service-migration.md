# RFC 0069: 缩略图服务迁移到 Tauri

- **作者**: AI Assistant
- **状态**: ✅ 已完成（本文档 2026-07-18 重写，对齐实际实现 — 见下方「Rewrite note」）
- **创建日期**: 2025-01-02
- **关联 RFC**: [RFC 0067: 创建 Tauri 应用 Photasa](./0067-tauri-app-photasa.md)
- **延伸（RAW 占位）**: [RFC 0102: RAW 缩略图回退](./completed/0102-tauri-thumbnail-raw-fallback.md)（`ThumbnailResponse.fallback`、无解码器时的 JPEG 占位）
- **被引用（scan crate 拆分）**: [0132](./0132-tauri-photasa-scan-crate.md)（P1b；async `ThumbnailBridge` 消费 0134）
- **后续（crate 拆分）**: [0134](./completed/0134-tauri-photasa-thumbnail-crate.md)（P1a first；thumbnail → async `photasa-thumbnail` crate，✅ Implemented）

## Implementation principle (Photasa / Tauri)

> **Rust rewrite, not TypeScript copy.** Policy: [./TAURI_RUST_REWRITE_POLICY.md](./TAURI_RUST_REWRITE_POLICY.md).

- Electron/Node code is a **behavioral specification** only—not a library for Photasa.
- Implement in `apps/photasa/src-tauri` and `crates/`; **do not** import `@photasa/scan`, `@photasa/import`, or other Node packages from Tauri.
- **1:1 parity** = same IPC/events/on-disk formats; **not** porting TypeScript source.

## Rewrite note（2026-07-18）

本文档原版（2025-01-02）设想了 `services/thumbnail/{thumbnail_service,generator,cache}.rs` 架构，依赖 `image`/`imageproc`/`resize`/`ffmpeg-next` 作为顶层 crate 直接调用。**这套 service 分层从未被构建**——0134 前实际是扁平 `commands/thumbnail.rs` + `commands/thumbnail_placeholder.rs`（RAW 占位，见 0102）；0134 后算法已迁入 `crates/photasa-thumbnail`，app 侧只留 Tauri command 壳。CLAUDE.md 中记载的「马良（MaLiang）神笔工坊」多引擎架构（BmpBrush/HeicBrush/FFmpegBrush/SharpBrush/FallbackBrush）**是 Electron 桌面端**（`packages/@photasa/maliang*`）的设计，**不适用于 Photasa/Tauri**——两者是完全独立的实现，不要混淆。

## 实际架构（Actual, 2026-07-18）

```
crates/photasa-thumbnail/src/
├── thumbnail.rs   — async create_thumbnail/remove_thumbnail + private decode_thumbnail_blocking
├── placeholder.rs — RAW 占位图生成（RFC 0102）
└── video.rs       — ffmpeg-next 视频截帧 helper

apps/photasa/src-tauri/src/commands/
└── thumbnail.rs   — create_thumbnail/remove_thumbnail Tauri command thin shell
```

真实依赖：`image = "0.25"`、`libheif-rs`（HEIC 解码，`embedded-libheif` feature，见 RFC 0103）、`ffmpeg-next`（视频帧提取）。**无** `imageproc`、**无** `resize` 作为独立 crate。

现状异步模式（0134 已落地）：`create_thumbnail`（`#[tauri::command] async fn`）直接 await `photasa_thumbnail::create_thumbnail`；`scan_runner.rs` 也 await 同一 crate API。阻塞解码只在 `photasa-thumbnail` 内部 `spawn_blocking`。

**Scan crate 拆分范围**：`crates/photasa-scan`（0132）无 `image`/`libheif-rs`/`ffmpeg-next` 依赖，只通过 async `ThumbnailBridge` trait 调用，不内联解码逻辑。

**Thumbnail 自身的 crate 拆分**：见 [0134](./completed/0134-tauri-photasa-thumbnail-crate.md)（✅ Implemented，P1a）——本 RFC 描述的算法层（4 个 `make_*` 分发函数 + `placeholder.rs` + `video.rs`）已搬入零-Tauri 的 async `crates/photasa-thumbnail`；`src-tauri` 只留 `create_thumbnail`/`remove_thumbnail` 两个 Tauri command 壳。0132 的 `ThumbnailBridge` 直接依赖 async `photasa-thumbnail`，不再绕 `src-tauri` 转发。

---

## 摘要（原版，2025-01-02，已过时，仅存档）

本文档详细说明如何将 Electron 的缩略图服务迁移到 Tauri Rust 实现。缩略图服务负责生成和管理照片/视频的缩略图，是 Photasa 的核心功能之一。

## 当前架构分析

### Electron 实现结构

```
apps/desktop/src/main/thumbnail/
├── thumbnail-service.ts      # 主服务（IPC 处理、Worker 管理）
├── thumbnail-worker.ts        # Worker 线程实现
├── thumbnail-handler.ts       # 缩略图处理逻辑
└── utils.ts                   # 工具函数
```

### 核心功能

1. **IPC 通信**
    - `picasa:create-thumbnail` - 创建缩略图（`ThumbnailServiceAction.create`，invoke，参数 `ThumbnailRequest`）
    - `picasa:remove-thumbnail` - 删除缩略图（`ThumbnailServiceAction.remove`，invoke）

2. **Worker 线程**
    - 使用 Node.js Worker Threads
    - 处理缩略图生成任务

3. **图像处理引擎**
    - MaLiang 引擎（统一图像处理）
    - 支持多种格式：BMP, HEIC, 视频等
    - 使用 Sharp, FFmpeg, WASM-HEIF 等

4. **缩略图生成**
    - 支持图片和视频
    - 可配置尺寸
    - 缓存管理

## Tauri Rust 迁移计划

### 阶段 1: 基础架构

#### 1.1 创建 Rust 模块结构

```
apps/photasa/src-tauri/src/
├── services/
│   └── thumbnail/
│       ├── mod.rs                    # 模块导出
│       ├── thumbnail_service.rs     # 主服务
│       ├── generator.rs              # 缩略图生成器
│       ├── cache.rs                  # 缓存管理
│       └── types.rs                  # 类型定义
```

#### 1.2 依赖添加

```toml
[dependencies]
# 图像处理
image = "0.24"              # 基础图像处理
imageproc = "0.24"          # 图像处理算法
resize = "0.8"              # 图像缩放

# FFmpeg 绑定（可选，通过 FFI）
ffmpeg-next = "6.0"         # FFmpeg Rust 绑定

# 异步处理
tokio = { version = "1.0", features = ["full"] }

# 文件操作
walkdir = "2.0"
```

### 阶段 2: 类型定义

```rust
// src-tauri/src/services/thumbnail/types.rs

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ThumbnailRequest {
    pub path: String,
    pub thumbnail: String,
    pub width: Option<u32>,
    pub height: Option<u32>,
    pub without_enlargement: bool,
    pub preview: Option<String>,
    pub always: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ThumbnailResponse {
    pub success: bool,
    pub file: Option<String>,
    pub error: Option<String>,
}
```

### 阶段 3: 核心功能实现

#### 3.1 图像处理（替代 Sharp）

```rust
// src-tauri/src/services/thumbnail/generator.rs

use image::{DynamicImage, ImageFormat};
use std::path::Path;
use anyhow::Result;

pub struct ThumbnailGenerator;

impl ThumbnailGenerator {
    /// 生成图片缩略图
    pub async fn generate_image_thumbnail(
        &self,
        source_path: &str,
        output_path: &str,
        width: u32,
        height: u32,
    ) -> Result<()> {
        let img = image::open(source_path)?;
        let thumbnail = img.thumbnail(width, height);
        thumbnail.save(output_path)?;
        Ok(())
    }

    /// 生成视频缩略图（需要 FFmpeg）
    pub async fn generate_video_thumbnail(
        &self,
        source_path: &str,
        output_path: &str,
        width: u32,
        height: u32,
    ) -> Result<()> {
        // 使用 FFmpeg 提取视频帧
        // 实现 FFmpeg 调用逻辑
        todo!("Implement video thumbnail generation")
    }
}
```

#### 3.2 主服务实现

```rust
// src-tauri/src/services/thumbnail/thumbnail_service.rs

use crate::services::thumbnail::generator::ThumbnailGenerator;
use crate::services::thumbnail::types::*;
use tauri::Window;
use tokio::task;

pub struct ThumbnailService {
    generator: ThumbnailGenerator,
}

impl ThumbnailService {
    pub fn new() -> Self {
        Self {
            generator: ThumbnailGenerator,
        }
    }

    /// 创建缩略图
    pub async fn create_thumbnail(
        &self,
        request: ThumbnailRequest,
    ) -> Result<ThumbnailResponse, anyhow::Error> {
        // 检查缩略图是否已存在
        if Path::new(&request.thumbnail).exists() && !request.always {
            return Ok(ThumbnailResponse {
                success: true,
                file: Some(request.thumbnail),
                error: None,
            });
        }

        // 在后台任务中生成缩略图
        let generator = self.generator.clone();
        let request_clone = request.clone();

        task::spawn(async move {
            // 判断文件类型
            if is_image_file(&request_clone.path)? {
                generator.generate_image_thumbnail(
                    &request_clone.path,
                    &request_clone.thumbnail,
                    request_clone.width.unwrap_or(200),
                    request_clone.height.unwrap_or(200),
                ).await?;
            } else if is_video_file(&request_clone.path)? {
                generator.generate_video_thumbnail(
                    &request_clone.path,
                    &request_clone.thumbnail,
                    request_clone.width.unwrap_or(200),
                    request_clone.height.unwrap_or(200),
                ).await?;
            }

            Ok::<(), anyhow::Error>(())
        }).await??;

        Ok(ThumbnailResponse {
            success: true,
            file: Some(request.thumbnail),
            error: None,
        })
    }

    /// 删除缩略图
    pub async fn remove_thumbnail(
        &self,
        request: ThumbnailRequest,
    ) -> Result<ThumbnailResponse, anyhow::Error> {
        if Path::new(&request.thumbnail).exists() {
            fs::remove_file(&request.thumbnail).await?;
        }

        Ok(ThumbnailResponse {
            success: true,
            file: Some(request.thumbnail),
            error: None,
        })
    }
}
```

### 阶段 4: Tauri 命令

```rust
// src-tauri/src/commands/thumbnail.rs

use crate::services::thumbnail::thumbnail_service::ThumbnailService;
use crate::services::thumbnail::types::*;
use tauri::State;
use std::sync::Arc;
use tokio::sync::Mutex;

type ThumbnailServiceState = State<'_, Arc<Mutex<ThumbnailService>>>;

#[tauri::command]
pub async fn create_thumbnail(
    service: ThumbnailServiceState,
    request: ThumbnailRequest,
) -> Result<ThumbnailResponse, String> {
    let service = service.lock().await;
    service
        .create_thumbnail(request)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn remove_thumbnail(
    service: ThumbnailServiceState,
    request: ThumbnailRequest,
) -> Result<ThumbnailResponse, String> {
    let service = service.lock().await;
    service
        .remove_thumbnail(request)
        .await
        .map_err(|e| e.to_string())
}
```

## Image processing support plan (Tauri)

Electron 当前在 `thumbnail-handler.ts` 中通过 **Ma-Liang** 引擎统一处理：SharpBrush（JPEG/PNG/WebP/TIFF/GIF/AVIF）、BmpBrush（Jimp+Sharp）、HeicBrush（WASM，一次解码同时出预览+缩略图）、FfmpegBrush（视频）、FallbackBrush。Tauri 侧采用分阶段、按格式选方案的策略，不新增独立 RFC，以本 RFC 为唯一说明。

| 阶段 | 格式/范围                        | 方案                                                                                                                                                                                     |
| ---- | -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | 常见图片（JPEG/PNG/WebP/GIF 等） | Rust `image`（及可选 `imageproc`）在缩略图服务内实现，单一“画笔”模块。                                                                                                                   |
| 2    | 视频缩略图                       | 保留 **FFmpeg** 二进制，由 Rust 调用（如 `std::process::Command` 或 FFI）。不再依赖 Node。                                                                                               |
| 3    | HEIC/HEIF                        | **A**：Rust `libheif`/heif-rs 绑定；**B**：在 Tauri 中加载现有 **WASM** 解码器；**C**（过渡）：仅 HEIC 暂时通过 Tauri 调用小型 Node 辅助进程，待 A 或 B 就绪后移除。长期以 A 或 B 为主。 |
| 4    | BMP 等边缘格式                   | Rust `image` 或专用解码；或短期返回占位图。                                                                                                                                              |
| 5    | HEIC 预览+缩略图一次解码         | 若采用 WASM：沿用 HeicBrush 模式一次解码多路输出；若采用 heif-rs：一次解码后在 Rust 中生成预览与缩略图。                                                                                 |

**原则**：Tauri 侧保留单一缩略图命令入口，内部按格式分“画笔”/策略，与 Ma-Liang 概念对齐；过渡期可对 HEIC/BMP 返回“不支持”，先保证常见图片与视频（FFmpeg）可用。

## 技术挑战和解决方案

### 1. 图像处理库选择

**问题**：需要替代 Sharp、FFmpeg 等 Node.js 库

**解决方案**（与上表一致）：

- **常见图片**：`image` / `imageproc`
- **视频**：保留 FFmpeg 二进制，Rust 侧调用
- **HEIC**：`heif-rs` 或现有 WASM；过渡期可选 Node 子进程

### 2. 性能优化

**问题**：缩略图生成是 CPU 密集型任务

**解决方案**：

- 使用 `tokio::task::spawn_blocking` 处理 CPU 密集型任务
- 实现任务队列，控制并发数
- 使用缓存避免重复生成

### 3. 格式支持

**问题**：需要支持多种图片和视频格式

**解决方案**：

- 图片：`image-rs` 支持常见格式
- 特殊格式（HEIC、BMP）：通过 FFI 或专用库
- 视频：FFmpeg FFI 调用

## 迁移步骤

### 步骤 1: 基础实现（3-5 天）

- [ ] 创建模块结构
- [ ] 实现基础图片缩略图生成
- [ ] 实现 Tauri 命令接口

### 步骤 2: 格式支持（3-5 天）

- [ ] 添加视频缩略图支持
- [ ] 添加 HEIC 格式支持
- [ ] 添加 BMP 格式支持

### 步骤 3: 优化和测试（2-3 天）

- [ ] 性能优化
- [ ] 缓存管理
- [ ] 错误处理
- [ ] 测试验证

## 预计时间

**总计：2-3 周**

- 基础实现：1 周
- 格式支持：1 周
- 优化测试：1 周

## 注意事项

1. **FFmpeg 依赖**：可能需要保留 FFmpeg 二进制，通过 FFI 调用
2. **性能对比**：需要对比 Rust 实现与 Sharp 的性能
3. **格式兼容性**：确保所有格式都能正确处理
4. **渐进迁移**：可以先实现基础功能，逐步添加格式支持

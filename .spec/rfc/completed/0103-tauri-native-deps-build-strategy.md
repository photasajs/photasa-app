# RFC 0103: 原生依赖构建策略（libheif + ffmpeg-next 静态链接）

- **Start Date**: 2026-04-05
- **Status**: Implemented（文档与 `apps/photasa/src-tauri/Cargo.toml` 对齐）
- **Depends on**: RFC 0069 (缩略图), RFC 0097 (导入元数据)

## Implementation principle (Photasa / Tauri)

> **Rust rewrite, not TypeScript copy.** Policy: [../TAURI_RUST_REWRITE_POLICY.md](../TAURI_RUST_REWRITE_POLICY.md).

- Electron/Node code is a **behavioral specification** only—not a library for Photasa.
- Implement in `apps/photasa/src-tauri` and `crates/`; **do not** import `@photasa/scan`, `@photasa/import`, or other Node packages from Tauri.
- **1:1 parity** = same IPC/events/on-disk formats; **not** porting TypeScript source.

## Summary

记录并规范 Tauri Rust 后端中 `libheif-rs` 和 `ffmpeg-next` 两个重型原生依赖的静态链接策略、CI 构建环境要求和跨平台分发保障。

## Motivation

`thumbnail.rs` 使用 `libheif-rs`（HEIC/HEIF 解码），`extract_metadata.rs` 使用 `ffmpeg-next`（视频元数据探测）。两者均依赖 C/汇编编译器和系统级库。

RFC 0097 已注明"静态链接 FFmpeg，不依赖系统 ffmpeg"，但：
- 未有专门 RFC 记录构建机要求和验证步骤
- `libheif-rs` 的静态链接策略未文档化
- CI（GitHub Actions 等）的环境配置未规范
- 跨平台（macOS / Windows / Linux）差异未明确

缺少这份文档，任何新成员或 CI 环境都可能遇到神秘的链接失败。

## Detailed Design

### ffmpeg-next（用于视频元数据）

**策略：静态链接，通过 `ffmpeg-next` feature `build` + `build-zlib`**

```toml
[dependencies]
ffmpeg-next = { version = "8.1", default-features = false, features = ["build", "build-zlib", "format", "codec", "software-scaling"] }
```

`build` feature 启用 `ffmpeg-sys-next/build`，触发从源码编译 FFmpeg（使用 `ffmpeg-sys-next` 的构建脚本）。

**构建机要求：**

| 平台 | 必要工具 |
|------|---------|
| macOS | Xcode CLT（`xcode-select --install`），`nasm`（`brew install nasm`） |
| Linux | `gcc` / `clang`，`nasm`，`make` |
| Windows | MSVC 2019+（Visual Studio Build Tools），NASM（PATH 中），Perl（`strawberryperl`） |

**CI（GitHub Actions）示例：**

```yaml
- name: Install NASM (macOS)
  if: runner.os == 'macOS'
  run: brew install nasm

- name: Install NASM (Linux)
  if: runner.os == 'Linux'
  run: sudo apt-get install -y nasm

- name: Install NASM (Windows)
  if: runner.os == 'Windows'
  uses: ilammy/setup-nasm@v1
```

**注意：** `ffmpeg-next` 静态构建会显著增加 Cargo build 时间（首次约 5-10 分钟）。启用 `sccache` 或 `Swatinem/rust-cache` 缓解。

### libheif-rs（用于 HEIC/HEIF/AVIF 缩略图）

**策略（当前仓库）：`embedded-libheif` — 由 crate 在构建期编进 libheif，不依赖系统 `libheif` / vcpkg / brew**

```toml
libheif-rs = { version = "2.7.0", features = ["image", "embedded-libheif"] }
```

**构建机要求：** 与编译任意 C/C++ 原生依赖相同（Xcode CLT / MSVC Build Tools / `gcc` 或 `clang`）。**不要求**单独安装系统 `libheif-dev`。

**注意：** `embedded-libheif` 会拉长首次 `cargo build` 时间；CI 建议启用 `Swatinem/rust-cache`（或同类）缓存 `target/`。

**风险：** 体积与编译时间增加；若未来需切换为系统 libheif，应再开 RFC 评估各平台打包策略。

### Cargo 构建标志

```toml
# .cargo/config.toml（仅在需要静态链接时）
[env]
FFMPEG_INCLUDE_DIR = { value = "/opt/homebrew/include", force = false }
```

### 产物验证

构建完成后验证无动态 libavcodec / libheif 依赖：

```bash
# macOS
otool -L apps/photasa/src-tauri/target/release/photasa | grep -E "avcodec|heif"
# Linux
ldd apps/photasa/src-tauri/target/release/photasa | grep -E "avcodec|heif"
```

目标：上述命令无输出（或仅有系统框架，如 `libSystem.B.dylib`）。

## Drawbacks

- 静态链接 FFmpeg 增加 CI 构建时间和最终包体积（约 +20-30 MB）
- Windows 构建链复杂，需专门验证

## Alternatives

- **动态链接 + 打包 FFmpeg 二进制**：RFC 0028 已记录 Electron 侧的 FFmpeg 二进制打包方案；Tauri 侧可类似处理，但需额外的打包配置
- **剥离 FFmpeg 依赖**：仅用 `extract_metadata_exif.rs`（`kamadak-exif`）处理图片，视频元数据改用轻量 MP4 解析（如 `mp4ameta`）；但覆盖范围不如 ffmpeg-next

## Implementation Checklist

1. 在 `AGENTS.md`（或根目录文档）添加构建环境要求说明（NASM、libheif-dev 等）
2. 提供 GitHub Actions workflow 片段，覆盖 macOS / Linux / Windows 三平台
3. `Cargo.toml`：确认 `ffmpeg-next` 使用 `build` + `build-zlib` feature
4. `libheif-rs`：评估 bundled feature 可行性，或记录 vcpkg 配置
5. CI 中添加 `sccache` 或 `Swatinem/rust-cache` 缓存 Rust 构建产物
6. 构建后执行 `otool -L` / `ldd` 验证静态链接
7. 文档：在 `ROADMAP.md` 「验证清单」中补充原生依赖构建步骤

## Implementation（仓库现状）

- `apps/photasa/src-tauri/Cargo.toml`：`ffmpeg-next` 使用 `build` + `build-zlib`；`libheif-rs` 使用 `embedded-libheif`
- `AGENTS.md`：Photasa 小节已写明 FFmpeg 静态链接与构建机要求；libheif 以 **embedded** 为准（勿将「系统 libheif」写为默认前提）
- **CI**：各 workflow 若编译 Photasa，需保证 NASM（FFmpeg 构建）与 C 工具链；具体片段以 `.github/workflows` 为准，本 RFC 上表为参考模板

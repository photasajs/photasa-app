# RFC 0134: Split Photasa thumbnail decode into standalone `photasa-thumbnail` crate

- **Start Date**: 2026-07-18
- **Last updated**: 2026-07-18
- **Status**: ✅ Implemented
- **Priority**: P1a（first；must land before 0132/0133）
- **Area**: Photasa / Rust crates / Thumbnail
- **Depends on**: [0069](../0069-tauri-thumbnail-service-migration.md)（缩略图实际实现，2026-07-18 已重写对齐现状）, [0102](./0102-tauri-thumbnail-raw-fallback.md)（RAW 占位）, [0103](./0103-tauri-native-deps-build-strategy.md)（`libheif-rs` / `ffmpeg-next` 静态链接策略）
- **Related（scan 族）**: [0132](../0132-tauri-photasa-scan-crate.md)（P1b；`ThumbnailBridge` await 本 RFC 的 async thumbnail API）
- **Path**: `.spec/rfc/completed/0134-tauri-photasa-thumbnail-crate.md`

## Implementation principle (Photasa / Tauri)

> **Rust rewrite, not TypeScript copy.** Policy: [../TAURI_RUST_REWRITE_POLICY.md](../TAURI_RUST_REWRITE_POLICY.md).

- 缩略图**解码 API**（图片缩放 / HEIC 解码 / 视频截帧 / RAW 占位）迁入 **`crates/photasa-thumbnail`** — **零 Tauri**。
- **Async always at crate boundary**：crate 对外只暴露 async API；阻塞图片/HEIC/视频解码封在 crate 内部 `tokio::task::spawn_blocking`，调用方不再自己包阻塞工作。
- 与 [0131](./0131-tauri-photasa-import-crate.md)/[0132](../0132-tauri-photasa-scan-crate.md) 同一拆分原则：算法层零 Tauri、可独立 `cargo test`；`src-tauri` 只留 `#[tauri::command]` 壳。

## Scan family order

| Order   | RFC      | Role                                         |
| ------- | -------- | -------------------------------------------- |
| **P1a** | **0134** | `photasa-thumbnail` async decode crate first |
| **P1b** | **0132** | `photasa-scan` depends on thumbnail bridge   |
| **P1c** | **0133** | `photasa-watch` queue crate                  |

## Goal

```bash
cargo test -p photasa-thumbnail
cargo tree -p photasa-thumbnail | grep -i tauri   # must be empty
```

`crates/photasa-thumbnail` 暴露：

- `pub async fn create_thumbnail(request: ThumbnailRequest) -> ThumbnailResponse`
- `pub async fn remove_thumbnail(path: PathBuf) -> Result<(), String>`

`apps/photasa/src-tauri` 保留 `create_thumbnail` / `remove_thumbnail` 两个 `#[tauri::command] async fn` 命令壳，只 `await photasa_thumbnail::*`。

`scan_runner.rs` 的三处缩略图调用点（`create_thumbnail_for_file` + 2× `process_media_file`）已改为直接 `.await photasa_thumbnail::create_thumbnail(...)`。`spawn_scan_job` 不再把扫描入口包进 `spawn_blocking` 只为了调用旧同步缩略图；真正阻塞的图片/HEIC/视频解码由 `photasa-thumbnail` crate 内部 `spawn_blocking` 封装。旧 `create_thumbnail_sync` 不再公开存在。

## Problem

0134 前逻辑分散在 `apps/photasa/src-tauri/src/commands/`：

| File                       | ~LOC | Tauri?                                                                                                                  | Notes                              |
| -------------------------- | ---- | ----------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| `thumbnail.rs`             | ~383 | 部分（`create_thumbnail`/`remove_thumbnail` 是 `#[tauri::command] async fn`；`create_thumbnail_sync` 为内部阻塞实现源） | 图片/HEIC/视频/RAW 分类分发 + 解码 |
| `thumbnail_placeholder.rs` | ~316 | 无（零 Tauri）                                                                                                          | RAW 占位图渲染（RFC 0102）         |
| `ffmpeg_next_util.rs`      | ~123 | 无（零 Tauri）                                                                                                          | 视频截帧（`save_video_thumbnail`） |

真实依赖：`image = "0.25"`、`libheif-rs`（`embedded-libheif` feature）、`ffmpeg-next`（`build` + `build-zlib` feature，见 RFC 0103）。三者均为标准 crate 依赖，构建期原生编译不依赖 `apps/photasa/src-tauri` 这个特定 crate——可原样迁入新 crate 的 `Cargo.toml`（已核实 RFC 0103 无 src-tauri 专属绑定）。

调用方（迁移后必须继续可用）：`apps/photasa/src-tauri/src/main.rs`（注册 `create_thumbnail`/`remove_thumbnail` 命令）、`apps/photasa/src-tauri/src/commands/scan_runner.rs`（0134 已改成 await crate async API）。

## Design criteria（硬门）

1. **Testability first** — 图片缩放 / RAW 占位 / 扩展名分类逻辑在 `-p photasa-thumbnail` 下无需 Window 即可测试。已有测试 `raw_placeholder_writes_file_and_sets_fallback` 迁为 `#[tokio::test]`。
2. **Zero Tauri** in crate `Cargo.toml`（`cargo tree` 验收）。**Async public API only**——公开入口是 `create_thumbnail(...).await` / `remove_thumbnail(...).await`；旧 `create_thumbnail_sync` 只作为迁移源，搬入后改名为私有 `decode_thumbnail_blocking`，由 crate 内部 `spawn_blocking` 调用。
3. **`ThumbnailRequest`/`ThumbnailResponse`** 作为 crate 的公开类型，`serde` 派生不变——`src-tauri` 侧的 `#[tauri::command]` 直接复用这两个类型，不重新定义。
4. **HEIC 双重解码待观察，不在本 RFC 修**：`make_heic_thumbnail` 为生成 preview 而对同一文件调用了第二次 `HeifContext::read_from_file` + `lib_heif.decode`（`thumbnail.rs:288-314`）——原样搬家，不在此 RFC 优化，避免搬家 diff 夹带逻辑改动。
5. **No behavior change** — RFC 0069/0102 契约不变，纯搬家。

## Implemented crate layout

```
crates/photasa-thumbnail/
  Cargo.toml          # image, libheif-rs, ffmpeg-next, tokio(workspace); NO tauri
  src/
    lib.rs
    thumbnail.rs       # ThumbnailRequest / ThumbnailResponse + async API + private decode helper
    video.rs           # from ffmpeg_next_util.rs — save_video_thumbnail
    placeholder.rs     # from thumbnail_placeholder.rs — RAW 占位（RFC 0102）
  tests/
    async_api.rs       # crate boundary regression
```

### What stays in `src-tauri`

| Stay                                                                    | Reason                         |
| ----------------------------------------------------------------------- | ------------------------------ |
| `create_thumbnail` / `remove_thumbnail`（`#[tauri::command] async fn`） | Tauri IPC 边界；只 await crate |
| `main.rs` 命令注册                                                      | Tauri 应用装配                 |

### Dependency graph

```
photasa-thumbnail             (standalone；无 photasa-import / photasa-scan 依赖)
photasa-scan ──► photasa-import + photasa-thumbnail（async ThumbnailBridge，见 0132 设计准则 #6）
photasa (src-tauri) ──► photasa-thumbnail + photasa-scan + photasa-watch(0133) + photasa-import
```

`photasa-scan` 的 `ThumbnailBridge` trait（0132 设计准则 #6）应直接 await `photasa_thumbnail::create_thumbnail`，不必再经 `src-tauri` 转发。

## Alternatives

| Option                                                      | Pros                                                   | Cons                                                                                                |
| ----------------------------------------------------------- | ------------------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| **A. `photasa-thumbnail` async crate（本 RFC）**            | 对齐 async always；scan 可直接 await，无需绕 src-tauri | 多一 crate；`image`/`libheif-rs`/`ffmpeg-next` 编译时间转移到新 crate（总量不变）                   |
| **B. 留 `ThumbnailBridge` 桥接 src-tauri**（0132 当前设计） | 不搬家，改动最小                                       | thumbnail 逻辑仍绑死 Tauri 二进制，无法独立 `cargo test -p photasa-thumbnail`；调用方继续自己管阻塞 |
| **C. 并入 `photasa-scan`**                                  | 少一 crate                                             | 违反一事一 RFC；把重型解码依赖（ffmpeg/libheif）绑进 scan 的 `cargo tree`，拖慢 scan 单测编译       |

**Recommend A.**

## Implementation checklist

- [x] Workspace member `crates/photasa-thumbnail` + root `Cargo.toml` wiring
- [x] Move：`thumbnail.rs`（请求/响应 + 4 个 `make_*` + private blocking helper）/ `thumbnail_placeholder.rs` / `ffmpeg_next_util.rs`（零 Tauri）
- [x] Crate public API：`create_thumbnail(...).await` / `remove_thumbnail(...).await`；阻塞解码只在 crate 内 `spawn_blocking`
- [x] `src-tauri`：`create_thumbnail`/`remove_thumbnail` 改为薄壳，复用 `photasa_thumbnail::{ThumbnailRequest, ThumbnailResponse}`
- [x] `scan_runner.rs`（3 处：`create_thumbnail_for_file` + 2× `process_media_file`）：改为 `.await photasa_thumbnail::create_thumbnail(...)`，不再调用旧 `create_thumbnail_sync`
- [x] 现有 RAW/placeholder 测试迁入 crate；新增 async API 集成测试；`cargo test -p photasa-thumbnail` 绿
- [x] `cargo tree -p photasa-thumbnail` 无 tauri；`cargo check -p photasa` 绿
- [x] `main.rs` 命令注册路径不变（仍为 `commands::thumbnail::{create_thumbnail, remove_thumbnail}`）
- [x] 0132 的依赖声明同步更新（改指向 async `photasa-thumbnail`）
- [x] ROADMAP / TASK_TRACKING → ✅；RFC → `completed/`

## Out of scope

| Topic                                             | Owner                                           |
| ------------------------------------------------- | ----------------------------------------------- |
| HEIC 双重解码优化（preview 复用首次 decode 结果） | 未来独立 RFC（不在本次搬家中夹带）              |
| RAW 真实解码器（当前仅占位图，RFC 0102）          | 未来独立 RFC                                    |
| 缩略图缓存策略变更                                | 未在范围内                                      |
| scan crate 拆分本身                               | **[0132](../0132-tauri-photasa-scan-crate.md)** |

## Risks

| Risk                                                       | Mitigation                                                                                                                                      |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `libheif-rs`/`ffmpeg-next` 在新 crate 编译期原生依赖出问题 | RFC 0103 策略（`embedded-libheif`、`ffmpeg-next build` feature）与具体宿主 crate 无关，风险低；仍需实际 `cargo build -p photasa-thumbnail` 验证 |
| 搬家夹带逻辑改动                                           | 硬门：diff 仅移动代码，不修 HEIC 双重解码等已知可优化点（见设计准则 #4）                                                                        |
| async 改造触及 `scan_runner`                               | 0134 先改 thumbnail await 路径；0132 后续保留 async `ThumbnailBridge`，不再引入 public sync                                                     |
| `ThumbnailBridge`（0132）改依赖时序问题                    | 0134 先行落地，0132 再切依赖；两者可独立验收                                                                                                    |

## Testing strategy

```bash
cargo test -p photasa-thumbnail
cargo tree -p photasa-thumbnail
cargo check -p photasa
```

Coverage gate：**`-p photasa-thumbnail` only**。

2026-07-18 验证：

- `cargo test -p photasa-thumbnail` — 6 passed
- `cargo tree -p photasa-thumbnail` — no `tauri` dependency
- `cargo check -p photasa` — passed
- `cargo clippy -p photasa-thumbnail --all-targets -- -D warnings` — no issues
- `cargo clippy -p photasa --all-targets -- -D warnings` — no issues
- `cargo test -p photasa` — 117 passed, 3 ignored

## Acceptance

1. `crates/photasa-thumbnail` **无** `tauri` 依赖。
2. crate public thumbnail API **只有 async**；阻塞解码 helper 不外泄。
3. `thumbnail.rs`/`placeholder.rs`/`video.rs` 算法部分已迁且 `-p photasa-thumbnail` 绿。
4. Runtime 行为相对迁前不变（RFC 0069/0102 契约不变）。
5. `create_thumbnail`/`remove_thumbnail` Tauri 命令与 `scan_runner.rs` async 调用点仍可用。
6. ROADMAP / TASK_TRACKING ✅；正文进 `completed/`。

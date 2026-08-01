# RFC 0173: PSD / AI 缩略图库与 Photasa 主流程集成

## Implementation principle

> `design-thumbnail` 是参数驱动的通用库：一次调用把一个 PSD / AI 文件写成一个指定边界的缩略图文件。
>
> `photasa-thumbnail` 是 Photasa 策略层：拥有请求、缓存、参数映射、decoder 选择、错误响应和调用时机。
>
> 不新增设计文件领域模型。PSD / AI 对 Photasa 仍是 image；格式差异只影响 decoder 选择。

**Status**: 🔎 Under Review（通用库已完成；Photasa 集成待批准）
**Created**: 2026-07-26
**Updated**: 2026-07-27
**Area**: Rust / `design-thumbnail` / `photasa-media` / `photasa-thumbnail` / `photasa-scan`
**Related**: [0004](./completed/0004-local-design-file-preview-rust.md)、[0134](./completed/0134-tauri-photasa-thumbnail-crate.md)、[0141](./completed/0141-tauri-photasa-media-crate.md)

---

## Summary

RFC 0173 负责从通用缩略图库到 Photasa 主程序的完整交付链：

```text
Phase A（已完成）
PSD / PDF-compatible AI
  → design-thumbnail(source, destination, max_width, max_height)
  → 一个缩略图文件

Phase B（待实现）
directory scan / single-file scan / watched-file scan
  → photasa-scan
  → photasa-media 识别 PSD / AI 为 image
  → photasa-thumbnail 选择 design-thumbnail
  → 按 ThumbnailRequest 参数生成缓存 thumbnail
  → 返回现有 ThumbnailResponse
  → 主程序使用现有 Photo.thumbnail
```

生产 watch 不维护独立格式表。`photasa-watch` 与 YuChiGong 负责把文件变更送入
scan；`photasa-media` 是 directory、single-file 和 watch scan 的共同最终格式 gate。

不修改现有 Tauri command、IPC DTO、Vue UI、缓存路径或 `MediaType`。

## Problem

当前行为有两个真实缺口：

1. PSD 已在 `photasa-media::IMAGE_EXTS` 中，因此会进入图片扫描；但
   `photasa-thumbnail` 将它交给 `image::open`，该 decoder 不支持 PSD，缩略图失败。
2. AI 不在媒体扩展名表中，因此 directory、single-file 和 watch scan 都会在
   `photasa-scan` 的最终格式 gate 被丢弃。

通用 `design-thumbnail` 已经能够：

- 接受 source、destination、max width、max height。
- 解码真实 PSD composite。
- 渲染真实 PDF-compatible AI 第 0 页。
- 根据 destination extension 写入 PNG / JPEG。
- 返回 typed error，不 panic。

缺口不是 decoder，而是 Photasa 分类、参数映射和主流程接入。

## Delivery phases

### Phase A: parameter-driven library（已完成）

RFC 0004 已交付 `design-thumbnail`：

```rust
pub fn generate_thumbnail(
    source: impl AsRef<Path>,
    destination: impl AsRef<Path>,
    options: ThumbnailOptions,
) -> Result<(), ThumbnailError>;
```

库拥有：

- PSD / AI 格式解码。
- 输出缩放、编码和文件写入。
- 输入尺寸校验。
- 通用错误类型。

库不知道：

- `ThumbnailRequest` / `ThumbnailResponse`。
- Photasa 缓存目录。
- scan、watch、IPC 或 UI。
- thumbnail / preview 产品语义。

### Phase B: Photasa integration（本 RFC 待交付）

Photasa 负责：

- 把 PSD / AI 分类为 image。
- 保持 `photasa-media` 为 scan/watch 权威 gate。
- 把 `ThumbnailRequest` 映射为 `ThumbnailOptions`。
- 选择 `design-thumbnail` decoder。
- 保持现有缓存、`always`、响应和 IPC。
- 用真实 PSD / AI 验证主流程输出。

## Goals

1. `.psd` 和 `.ai` 进入 directory、single-file 和 watch scan。
2. `photasa-thumbnail::create_thumbnail` 对 PSD / AI 调用 `design-thumbnail`。
3. 保持现有 `ThumbnailRequest` / `ThumbnailResponse` / IPC。
4. 每个 PSD / AI 请求生成 `request.thumbnail` 指定的一个缩略图。
5. 复用真实 PSD / AI fixtures 做公开 API 和 scan integration 测试。
6. 解码失败返回错误，不生成伪成功 placeholder。
7. 普通 JPEG、HEIC、RAW、video 路径无回归。

## Non-goals

- 新增 `MediaType::Design`。
- 新增 Tauri command、IPC、事件、前端 service 或 UI。
- PSD / AI 全屏 preview 数据流。
- 根据 `ThumbnailRequest.preview` 为 PSD / AI 生成第二个文件。
- PSD 图层、AI 对象模型或编辑。
- Legacy PostScript / EPS AI、PSB、PSD ZIP compression。
- AI / PSD metadata 提取。
- 普通 PDF 支持。
- 修改 `design-thumbnail` 公共 API。
- 修复所有格式现有 preview 语义。

---

## Decision

### 方案 A：design extension 是 image 子集，decoder 单独分发（采用）

在 `photasa-media` 增加：

```rust
pub static DESIGN_EXTS: &[&str] = &["psd", "ai"];
pub fn is_design_file(path: &str) -> bool;
```

`is_image_file` 与 `classify_media` 将 design extension 视为 `MediaType::Image`。
`photasa-thumbnail` 先使用权威 media 分类，再在 Image 分支选择 decoder：

```rust
match photasa_media::classify_media(src) {
    MediaType::Image if photasa_media::is_design_file(src) => {
        make_design_thumbnail(src, dst, request)
    }
    MediaType::Image => make_image_thumbnail(src, dst, request),
    // existing HEIC / RAW / video / unknown branches
}
```

优点：

- 不扩展共享 enum 或序列化契约。
- 分类仍是一级 gate，不允许 decoder helper 绕过媒体分类。
- PSD 不再同时归普通 image decoder 与 design decoder 所有。
- 格式解析只存在于通用库。

### 方案 B：新增 `MediaType::Design`（拒绝）

需要修改共享 enum、serde 契约、扫描 DTO、match 分支和前端 flags。Photasa 没有
独立 design UI 或缓存语义，新 enum 不承载用户行为。

### 方案 C：把 PSD / AI parser 复制进 `photasa-thumbnail`（拒绝）

会复制已完成的通用库。`photasa-thumbnail` 应编排，不应再次拥有 PSD / PDF parser。

---

## Data model

保持：

```rust
pub enum MediaType {
    Image,
    Heic,
    Video,
    Raw,
    Unknown,
}
```

扩展名所有权：

```text
IMAGE_EXTS  = 普通 image decoder 格式
DESIGN_EXTS = psd, ai

is_image_file = IMAGE_EXTS | DESIGN_EXTS | HEIC_EXTS | RAW_EXTS
classify_media(psd | ai) = MediaType::Image
```

PSD 从 `IMAGE_EXTS` 移到 `DESIGN_EXTS`，避免普通 `image::open` 错误接管。
扩展名匹配保持大小写不敏感。

## Production workflow

directory / single-file scan：

```text
scan request
  → photasa-scan::walkthrough_photos_in_folder / is_photasa_media_file
  → photasa-media::classify_media_flags
  → scan_runner
  → photasa-thumbnail::create_thumbnail
  → design-thumbnail::generate_thumbnail
```

watched-file scan：

```text
notify
  → photasa-watch coalescer（格式无关）
  → YuChiGong ScanAction
  → scan_runner
  → photasa-scan::is_photasa_media_file
  → photasa-media
  → photasa-thumbnail
  → design-thumbnail
```

`apps/photasa/src/api/watch-event.ts` 不在当前生产 watch 通路中，不作为 RFC 0173
修复点或验收证据。

## Thumbnail routing and cache

`decode_thumbnail_blocking` 保持现有缓存语义：

```text
thumbnail 已存在且 always != true
  → 直接返回现有 thumbnail

classify_media(source)
  → Image + is_design_file
      → make_design_thumbnail
  → 其他类型
      → 现有 decoder
```

RFC 0173 不改变 cache hit、`always`、目标目录或响应结构。

## Parameter mapping

PSD / AI design 分支固定映射：

```rust
let options = design_thumbnail::ThumbnailOptions {
    max_width: request.width.unwrap_or(256).max(1),
    max_height: request.height.unwrap_or(256).max(1),
};

design_thumbnail::generate_thumbnail(
    &request.path,
    &request.thumbnail,
    options,
)
```

成功：

```rust
ThumbnailResponse::ok(request.thumbnail.clone())
```

约束：

- 一次 Photasa design 请求只调用库一次。
- destination 固定为 `request.thumbnail`。
- `request.preview` 不参与 PSD / AI design 分支；现有其他格式行为不变。
- `request.without_enlargement` 不映射、不参与 PSD / AI design 分支；
  `Some(true)` 与 `Some(false)` 均不属于 RFC 0173 验收语义。
- design 分支首版只承诺输出宽高不超过 max bounds。通用库当前可能放大较小
  PSD，但不会放大 AI；该差异属于已完成库行为，本 RFC 不暗改公共 API。
- 若未来需要全屏 preview，`photasa-thumbnail` 可用独立目标路径和参数再次调用
  同一个库；该产品数据流不属于 RFC 0173。

`photasa-thumbnail` 预建缓存父目录，统一 Photasa 路径错误响应；通用库继续防御性
创建 destination 父目录，保证独立使用能力。两层调用均幂等，不新增第三套目录逻辑。

## Error behavior

`design-thumbnail::ThumbnailError` 转为：

```text
ThumbnailResponse::err("生成设计文件缩略图失败: <typed error>")
```

不生成 placeholder。unsupported / decode 错误不会主动写入成功缓存。

编码或 I/O 失败可能由库留下部分 destination；RFC 0173 不声称事务写入，也不顺手
重构所有 thumbnail decoder 的原子保存。缓存与清理策略保持现状。

---

## File changes

| 文件                                             | 设计变更                                                        |
| ------------------------------------------------ | --------------------------------------------------------------- |
| `crates/photasa-media/src/lib.rs`                | `DESIGN_EXTS`、`is_design_file`；PSD/AI 归类为 image            |
| `crates/photasa-thumbnail/Cargo.toml`            | production 依赖 `design-thumbnail`；测试使用独立 temp directory |
| `crates/photasa-thumbnail/src/thumbnail.rs`      | Image guard + design 参数映射和错误响应                         |
| `crates/photasa-thumbnail/tests/design_files.rs` | 真实 PSD / AI 公开 API 测试                                     |
| `crates/photasa-scan/Cargo.toml`                 | 增加直接 `image` / `tempfile` dev-dependencies                  |
| `crates/photasa-scan/tests/design_files.rs`      | temp album discovery + thumbnail 主流程测试                     |
| `.github/workflows/photasa-build.yml`            | Windows 原生 targeted test / clippy job                         |
| `Cargo.lock`                                     | dependency graph 更新                                           |

明确不修改：

- `crates/design-thumbnail` 已完成实现。
- `apps/photasa/src-tauri/src/commands/thumbnail.rs`。
- `apps/photasa/src-tauri/src/commands/watch.rs`。
- `apps/photasa/src/api/watch-event.ts`。
- `ThumbnailRequest` / `ThumbnailResponse`。
- Vue component、前端 service、IPC。

## Fixture policy

canonical fixtures：

```text
crates/design-thumbnail/tests/fixtures/sample.psd
crates/design-thumbnail/tests/fixtures/sample.ai
```

其他 crate 使用 manifest-relative 路径，不依赖测试工作目录：

```rust
Path::new(env!("CARGO_MANIFEST_DIR"))
    .join("../design-thumbnail/tests/fixtures/sample.psd")
```

scan integration 使用 `tempfile` 创建隔离 album，把 fixtures 复制后再测试。
`image` 必须是 `photasa-scan` 的直接 dev-dependency，不能依赖
`photasa-thumbnail` 的传递依赖。测试不得写 canonical fixture 目录。来源、许可和
SHA-256 继续由
`crates/design-thumbnail/tests/FIXTURES.md` 单点维护。

---

## TDD plan

### Phase 0: Library evidence（已完成）

1. 真实 PSD → PNG / JPEG，输出可解码且受 max bounds 限制。
2. 真实 PDF-compatible AI → PNG / JPEG，输出可解码且受 max bounds 限制。
3. 损坏、unsupported、零尺寸输入返回 typed error，不 panic。

### Phase 1: Public API walking skeleton

1. RED：`photasa_thumbnail::create_thumbnail` 对真实 PSD 返回成功，输出可解码。
2. RED：相同公开 API 对真实 AI 返回成功，输出可解码。
3. 断言 `file == destination`、`fallback == None`、宽高均大于 0 且不超过请求边界。
4. PSD 与 AI 使用非正方形边界，例如 `31 × 47`，证明参数真实透传。

### Phase 2: Media gate and decoder routing

1. RED：PSD / AI 与大写 `.PSD` / `.AI` 均是 design file、image file、
   `MediaType::Image`。
2. RED：temp album 中真实 PSD / AI 均被 `walkthrough_photos_in_folder` 发现，
   `is_image == true`，thumbnail path 指向 `.photasaoriginals`。
3. GREEN：增加 `DESIGN_EXTS`、Image guard、dependency 和参数映射。

### Phase 3: Main-flow integration

1. temp album 复制真实 PSD / AI。
2. 通过 `walkthrough_photos_in_folder` 获取真实 source 和 thumbnail destination。
3. 使用 scan runner 当前契约构造 `ThumbnailRequest`：
   `preview == thumbnail`、`without_enlargement == Some(true)`。
4. 调用公开 `photasa_thumbnail::create_thumbnail`。
5. 断言 `.photasaoriginals/thumbnail-<source-name>.png` 存在、可解码、尺寸受限。

`without_enlargement == Some(true)` 只证明现有请求形状可兼容通过，不证明该字段
影响 PSD / AI 输出。

自动测试覆盖可测试的生产 seams；不把 classifier unit test 冒充端到端。

### Phase 4: Errors, cache and regression

1. 损坏 AI / PSD 返回 `success == false`、`file == None`、稳定错误前缀。
2. `always == false` 命中现有 thumbnail；`always == true` 重新生成。
3. 普通 JPEG 经公开 `create_thumbnail` 保持成功。
4. 现有 HEIC、RAW、video 测试保持通过。
5. design 路径在 `preview == thumbnail` 时不生成第二次，不覆盖请求尺寸。

### Phase 5: Tauri smoke acceptance

在 Photasa dev app watched temp album 中加入真实 PSD / AI：

```text
watch event
  → scan action
  → file report isImage == true
  → .photasaoriginals/thumbnail-<name>.png
  → 输出可解码
```

记录 PSD 和 AI 各一次手工 smoke 结果。自动测试不能替代该运行时验收。

---

## Acceptance criteria

- [x] `design-thumbnail` 真实 PSD / AI 库测试通过。
- [x] `design-thumbnail` typed error 测试通过。
- [ ] `.psd` / `.ai` / `.PSD` / `.AI` 均通过 Photasa image gate。
- [ ] 真实 PSD 经 `photasa-thumbnail::create_thumbnail` 生成可解码缩略图。
- [ ] 真实 PDF-compatible AI 经相同公开 API 生成可解码缩略图。
- [ ] 非正方形 width / height 参数真实映射，输出不超过 max bounds。
- [ ] temp album discovery 找到 PSD / AI 并生成正确 `.photasaoriginals` 路径。
- [ ] temp album 主流程生成两个真实、可解码的 PNG thumbnail。
- [ ] design 路径每次请求只生成 `request.thumbnail`，不生成第二个 preview 文件。
- [ ] 损坏或不支持输入返回失败响应，不 panic、不生成 placeholder。
- [ ] cache hit 与 `always` 行为保持现有契约。
- [ ] JPEG / HEIC / RAW / video 测试无回归。
- [ ] Tauri dev watched-folder PSD / AI smoke 验收通过。
- [ ] 无新 IPC、UI、`MediaType`、placeholder 或系统运行时依赖。
- [ ] macOS 本机测试通过；Windows/Linux 原生 CI runner 通过。

## Verification

本机：

```bash
cargo fmt --package design-thumbnail --package photasa-media --package photasa-thumbnail --package photasa-scan -- --check
cargo clippy -p design-thumbnail -p photasa-media -p photasa-thumbnail -p photasa-scan --all-targets -- -D warnings
cargo test -p design-thumbnail -p photasa-media -p photasa-thumbnail -p photasa-scan
```

Linux：

```text
现有 `.github/workflows/photasa-build.yml` Ubuntu check job 执行 workspace
cargo test 与 clippy，覆盖 RFC 0173 范围。
```

Windows：

```bash
cargo test -p design-thumbnail -p photasa-media -p photasa-thumbnail -p photasa-scan
cargo clippy -p design-thumbnail -p photasa-media -p photasa-thumbnail -p photasa-scan --all-targets -- -D warnings
```

`.github/workflows/photasa-build.yml` 增加独立 `windows-latest` targeted job：

```text
checkout
→ setup-photasa-toolchain
→ setup-photasa-windows-msvc
→ targeted cargo test
→ targeted cargo clippy
```

该 job 不受当前 `PHOTASA_CI_WINDOWS_ENABLED=false` 的 full Tauri build matrix
开关影响。macOS cross-target cargo check 只能作为补充证据，不能代替 Windows
原生 runner。

Tauri smoke：

```text
启动 Photasa dev app
→ watch temp album
→ 分别复制 sample.psd / sample.ai
→ 等待 scan complete
→ 检查 file report 与两个 thumbnail 文件
```

---

## Risks and mitigations

| 风险                                | 处理                                                          |
| ----------------------------------- | ------------------------------------------------------------- |
| AI 并非 PDF-compatible              | 返回 typed failure；不伪造成功                                |
| PSD / AI 被普通 image decoder 接管  | `DESIGN_EXTS` 单独所有 + guarded Image branch                 |
| helper 分类通过但主流程未接通       | 首个 RED 走公开 API；temp album integration + Tauri smoke     |
| fixture 路径依赖 cwd                | `CARGO_MANIFEST_DIR` 定位；运行时复制                         |
| cross-target check 掩盖原生依赖问题 | Windows/Linux 原生 runner 验证                                |
| Windows full build matrix 当前禁用  | 增加不受该开关影响的 targeted test/clippy job                 |
| scan test 偷用传递依赖              | `photasa-scan` 声明直接 `image` / `tempfile` dev-dependencies |
| I/O 失败留下部分文件                | 不宣称事务；保持现有缓存契约，后续统一原子写入另立 RFC        |
| preview 相同路径覆盖请求尺寸        | design 路径只调用库一次                                       |

---

**最后更新**: 2026-07-27
**作者**: 李鹏 / AI

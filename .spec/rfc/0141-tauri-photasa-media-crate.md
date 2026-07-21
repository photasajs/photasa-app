# RFC 0141: `photasa-media` crate — 统一图片/视频扩展名判定

- **Start Date**: 2026-07-19
- **Last updated**: 2026-07-19
- **Status**: 🔨 Implementing（Rust 侧全部切到 `photasa-media`，含 scan/import/thumbnail/path.rs 四处；仅剩前端 `watch-event.ts` 自建表未对齐，缺 `dng`/`raf`/`orf`）
- **Priority**: P1（真实分叉 bug，非仅重复代码）
- **Area**: Photasa / Rust crates / Media type detection
- **Depends on**: `photasa-types`（`MediaType` 在 `crates/photasa-types/src/media_type.rs`）
- **Blocks**: [0138](./0138-tauri-photasa-config-crate.md)（`is_video`/`is_image` 权威来源）
- **Path**: `.spec/rfc/0141-tauri-photasa-media-crate.md`

## crate 边界

- **`photasa-types`**：数据结构 only。`MediaType { Image, Heic, Video, Raw, Unknown }`（无判定方法）。
- **`photasa-media`**：判定算法 + 扩展名表；依赖 `photasa-types::MediaType`；**零 Tauri**。
- 禁止 `photasa-media` 反向定义会被其他 crate 复用的新类型。

## Decision

Workspace crate `crates/photasa-media` 为唯一权威扩展名判定：

- 表：`IMAGE_EXTS` / `HEIC_EXTS` / `RAW_EXTS` / `VIDEO_EXTS`（解码路径三分图类 + 视频）
- API：`is_image_file` / `is_video_file` / `classify_media`（`&str` → 纯 Rust 类型）

`is_image_file` = IMAGE ∪ HEIC ∪ RAW。`classify_media` 区分解码路径，供 `photasa-thumbnail` match。

## 历史分叉（动手前源码证据；已由 WIP 收口 Rust 侧）

迁入前三处 **不一致**（2026-07-19 读源码核对；0141 初稿「thumbnail 完全无 raw」**不成立**）：

| 消费者（迁入前）                | 图片相关                                                                         | 视频                          |
| ------------------------------- | -------------------------------------------------------------------------------- | ----------------------------- |
| `commands/path.rs`              | 单表 IMAGE：含 heic/raw/svg/ico/psd 等 19 项                                     | 含 `vob/rmvb/rm` 共 18 项     |
| `photasa-import/path_filter.rs` | 与 path 同 IMAGE                                                                 | 与 path 同 VIDEO              |
| `photasa-thumbnail`             | `IMAGE`(8) + `HEIC`(heic/heif/avif) + `RAW`(raw/cr2/cr3/nef/arw/**dng/raf/orf**) | **无** `vob/rmvb/rm`（15 项） |

真差异（非「raw 完全没覆盖」）：

1. **thumbnail 有 RAW 分流**（占位图），path/import 把 raw 家族塞进「是图」单 bool。
2. **thumbnail RAW 多 `dng/raf/orf`**；path/import 旧 IMAGE **无**这三项。
3. **`svg/ico/psd`**：path/import 当图；thumbnail 旧逻辑 → `未知文件类型`（不在 IMAGE/HEIC/RAW）。
4. **VIDEO**：path/import 多 `vob/rmvb/rm`；thumbnail 旧表缺这三项。

另有 **第四份**（仍在）：`apps/photasa/src/api/watch-event.ts` 本地 Set（对齐旧 import 单表，**缺 `dng/raf/orf`**）。

## 已拍板的统一表（WIP `photasa-media`）

| 表           | 内容                                               |
| ------------ | -------------------------------------------------- |
| `IMAGE_EXTS` | jpg jpeg png gif bmp webp tiff tif **svg ico psd** |
| `HEIC_EXTS`  | heic heif avif                                     |
| `RAW_EXTS`   | raw cr2 cr3 nef arw **dng raf orf**                |
| `VIDEO_EXTS` | mp4…ts + **vob rmvb rm**（与旧 path 并集）         |

产品含义：

- `svg/ico/psd` → `MediaType::Image` → thumbnail 走 `image` crate（行为相对旧「未知类型」变宽；需回归）。
- `dng/raf/orf` → `is_image` + `Raw` 占位（path/UI 与 thumbnail 对齐）。
- 视频含 `vob/rmvb/rm`（thumbnail 可尝试视频轨）。

## Goals

1. ✅ `crates/photasa-media`：零 Tauri；依赖 `photasa-types::MediaType`。
2. ✅ `path.rs` command 薄封装 `photasa_media::*`（对外签名不变）。
3. ✅ `photasa-import/path_filter.rs` 改用 `photasa_media`。
4. ✅ `photasa-thumbnail` `match classify_media`（删本地四表）。
5. ⬜ `watch-event.ts`：要么与权威表对齐（至少补 `dng/raf/orf`），要么明确 Non-goal「TS 另案 / invoke」并写进 Acceptance。
6. ⬜ ROADMAP / TASK_TRACKING 登记 0141。
7. ⬜ `grep` 验收：`apps/photasa/src-tauri` + `crates` 下静态 `IMAGE_EXTS`/`VIDEO_EXTS` 定义只命中 `photasa-media`（再导出除外）。
8. ✅ `photasa-scan` 已改为直接依赖 `photasa-media`（`Cargo.toml` 替换 `photasa-import` → `photasa-media`，`e4180c1`），不再经 `photasa-import` 中转。`should_ignore_photasa_path`/`basename_hidden`/`classify_media_flags` 权威实现已在 `photasa-media`，`photasa-import` 改为纯转发。`cargo tree -p photasa-scan` 验证不含 `photasa-import`。

## Non-goals

- 不引入 `infer`/`mime_guess` 等内容嗅探。
- 不改 `#[tauri::command]` 对外返回形状（`get_image_type` 仍 `"image"|"video"|"unknown"` 字符串；HEIC/RAW 对外仍归入 image）。
- 不在本 RFC 实现完整 RAW 解码（仍占位 `fallback: true`）。

## Testing / Evidence（2026-07-19）

```text
cargo test -p photasa-media     → 3 passed
cargo test -p photasa-import    → 45 passed
cargo test -p photasa-thumbnail → 5 passed
cargo tree -p photasa-media     → 仅 photasa-types（无 tauri）
```

静态表定义：`crates/photasa-media/src/lib.rs` 唯一；`path_filter` `pub use` 再导出。  
剩余：`apps/photasa/src/api/watch-event.ts` 自建 Set；相对 `is_image` 缺 **dng/raf/orf**。

## Acceptance

1. ✅ `photasa-media` 存在；权威表唯一（Rust crates + src-tauri）。
2. ✅ path / import / thumbnail 删除本地判定表，改依赖 crate。
3. ✅ 历史分叉已记录；统一表内容已拍板（上表）并保留 IMAGE/HEIC/RAW 解码分流。
4. ⬜ `watch-event.ts` 与权威表对齐或文档标明另案。
5. ⬜ ROADMAP 登记；RFC → Implemented / `completed/` 当 4 完成且证据更新。
6. ✅ `photasa-scan` 直接依赖 `photasa-media`，不经 `photasa-import` 中转（`cargo tree -p photasa-scan` 验证不含 `photasa-import`，2026-07-20，`e4180c1`）。

## Risks

- `svg/ico/psd` 现走 `image` 解码：旧路径是硬失败；需确认无 panic（decode err → ThumbnailResponse::err 可接受）。
- `get_image_type` 把 Heic/Raw 折叠为 `"image"`：与旧 path 行为一致；UI 若将来要区分，另开契约。
- TS 表漂移会导致 watch UI `isImage` 与 Rust 缩略图/import 不一致（当前 dng/raf/orf）。

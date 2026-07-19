# RFC 0132: Split Photasa scan into standalone `photasa-scan` crate

- **Start Date**: 2026-07-18
- **Last updated**: 2026-07-18
- **Status**: ✅ Implemented
- **Priority**: P1b（after 0134）
- **Area**: Photasa / Rust crates / Scan
- **Depends on**: [0068](../0068-tauri-scan-service-migration.md), [0069](../0069-tauri-thumbnail-service-migration.md), [0071](../0071-tauri-config-service-migration.md), [0105](../0105-tauri-scan-incremental-cache.md), [0111](../0111-tauri-scan-notify-status-bridge.md), [0116](../0116-tauri-photasa-config-thumbnail-parity.md), [0117](../0117-tauri-scan-pipeline-parity.md), [0131](./0131-tauri-photasa-import-crate.md), [0134](./0134-tauri-photasa-thumbnail-crate.md)
- **Related**: [0133](../0133-tauri-photasa-watch-crate.md)（watch→scan-queue；同属 scan 族，另 crate）
- **Path**: `.spec/rfc/completed/0132-tauri-photasa-scan-crate.md`

## Implementation principle (Photasa / Tauri)

> **Rust rewrite, not TypeScript copy.** Policy: [ROADMAP.md](../../../ROADMAP.md).

- Scan **algorithm** lives in **`crates/photasa-scan`** — **zero Tauri**.
- Shared scan/watch DTOs live in **`crates/photasa-types`** — **zero Tauri**.
- Electron `@photasa/scan` = **behavioral contract only**; do **not** import Node/TS into Tauri.
- Thumbnail decode / FFmpeg / `create_thumbnail_*` moved first to `crates/photasa-thumbnail` ([0134](./0134-tauri-photasa-thumbnail-crate.md)); scan crate exposes async **`ThumbnailBridge`**.
- `.photasa.json` IPC / write commands stay in src-tauri (0071 / 0116); scan crate sees config via **`PhotasaConfigView`** only.

## Scan family（本 RFC 在族中的位置）

| RFC              | 角色                                           |
| ---------------- | ---------------------------------------------- |
| **0068**         | scan 服务入口                                  |
| **0069**         | 缩略图（bridge / thumbnailSize）               |
| **0071**         | `.photasa.json`                                |
| **0116**         | thumb 路径 + rescan config                     |
| **0117**         | 流水线 parity（行为规格）                      |
| **0134**         | → `photasa-thumbnail`（P1a；已落地）           |
| **0132a**        | → `photasa-types`（共享 scan/watch DTO）       |
| **0132**（本篇） | → `photasa-scan`                               |
| **0133**         | → `photasa-watch`（queue 上游，不跑 pipeline） |

**本 RFC 不重做 0116/0117 契约** — 只搬家 + 可测。行为规格仍以 0117 表为准；路径/config 以 0116 + 0071 为准；缩略图实现以 0069 为准。

## Goal

Directory/file scan pipeline (strategy, cache, walk, notify payload builders, cleanup) is a workspace crate testable with:

```bash
cargo test -p photasa-types
cargo test -p photasa-scan
cargo tree -p photasa-scan | grep -i tauri   # must be empty
```

`apps/photasa/src-tauri` keeps thin `spawn_scan_job` / `AppHandle::emit` / `PhotasaConfigView` adapters only. `ThumbnailBridge` awaits `photasa_thumbnail::create_thumbnail`.

## Implementation summary（2026-07-18）

- Added `crates/photasa-types` for shared Rust DTOs: `ScanAction`, `PhotoFileRequest`, scan validation, scan notify payload/source structs, `PhotasaConfigView`, and typed watch queue `FileOperation`.
- Added `crates/photasa-scan` for scan algorithms: `strategy`, `cache`, `media`, `notify`, `cleanup`, and `sink`.
- Moved `scan_strategy.rs`, `scan_cache.rs`, `scan_media.rs`, `scan_notify.rs`, `scan_cleanup.rs` out of `src-tauri`.
- Kept `scan_runner.rs` in `src-tauri` as the Tauri shell: emits events, writes `.photasa.json`, and adapts `read_config_sync` into `PhotasaConfigView`.
- Deleted duplicate scan media extension table; media guard now uses `photasa_import::path_filter::classify_media`.

## Problem

Today scan logic sits under `apps/photasa/src-tauri/src/commands/`:

| File               | ~LOC | Tauri?  | Notes                                                                     |
| ------------------ | ---- | ------- | ------------------------------------------------------------------------- |
| `scan_runner.rs`   | ~713 | **yes** | orchestration + emit + thumbnail                                          |
| `scan_cache.rs`    | ~384 | no      | `.photasa-folder.json` + IncrementalCacheManager                          |
| `scan_media.rs`    | ~348 | no\*    | walk；`photasa_config` helpers；自带 `PHOTO_EXTENSIONS`（与 import 重复） |
| `scan_notify.rs`   | ~348 | no      | `notify:status` builders（0111）                                          |
| `scan_strategy.rs` | ~288 | no\*    | SKIP/FULL；`read_config_sync`（0071/0116）                                |
| `scan_cleanup.rs`  | ~160 | no      | orphan cleanup                                                            |

\*No `tauri` import, but coupled to `commands::photasa_config`.

Call sites that must keep working after move: `adapters/scan_adapter.rs`, `commands/stubs.rs`（re-export `ScanAction` / `spawn_scan_job`）.

## Design criteria（硬门 — 审查锁定）

1. **Testability first** — strategy / cache / notify / walk / cleanup under `-p photasa-scan` without Window.
2. **Zero Tauri** in crate `Cargo.toml`（`cargo tree` 验收）。v1 迁移的 5 个文件（strategy/cache/media/notify/cleanup）**保持现状纯同步**——已核实零 `async fn`，无需为 v1 引入任何异步面。`scan_runner.rs`（唯一有 async 编排需求的文件）**不在 v1 迁移范围**，仍留 `src-tauri`；其内部 `tokio::spawn`/`spawn_blocking` 编排不变。禁止 `tauri::async_runtime`（适用于任何后续把 `scan_runner` 迁入 crate 的 v2 工作）。
3. **Reuse `photasa-import`** for media classify / ignore / hidden — **delete** duplicate `PHOTO_EXTENSIONS` table in media module（统一走 `classify_media`）.
4. **Config：定案 `PhotasaConfigView` trait**（禁止拖整份 `photasa_config` command 进 crate）:
    - Trait 提供 strategy 所需：`has_config` / `photo_list`（或等价只读视图）.
    - src-tauri 用现有 `read_config_sync`（0071）实现.
    - 常量 `PHOTASA_FOLDER_CACHE_FILE` / `PHOTASA_ORIGINALS_DIR` 可进 crate；**不**在 crate 内写 `.photasa.json`.
5. **`ScanEventSink`** — `picasa:find-photo` + `notify:status` JSON；Tauri `app.emit`.
6. **`ThumbnailBridge`** — async trait；直接 await `photasa_thumbnail::create_thumbnail`（0134）。scan crate **不**依赖 `ffmpeg-next` / `libheif`，只依赖 thumbnail crate public API。**v1 无真实调用方**：thumbnail 派发目前只在 `scan_runner.rs`（不在本 RFC v1 迁移范围）内，本次移动的 5 个文件（strategy/cache/media/notify/cleanup）零调用缩略图。`ThumbnailBridge` 是为未来 `scan_runner` 迁入 crate（v2）预置的接口——v1 阶段该 trait 编译通过即可，**不作为验收硬门**（`cargo test -p photasa-scan` 无法验证其形状是否正确，因为没有真实调用方）。`scan_runner.rs` 已在 0134 中直接 await `photasa_thumbnail::create_thumbnail(...)`。
7. **No behavior change** — 0116 / 0117 契约不变.
8. **v1 范围写死** — 见 Acceptance.

## Proposed crate layout

```
crates/photasa-types/
  Cargo.toml          # serde, serde_json; NO tauri
  src/
    lib.rs
    scan.rs           # ScanAction / PhotoFileRequest / validation DTOs
    config.rs         # PhotasaConfigView + shared config constants
    notify.rs         # notify payload/source DTOs
    file_operation.rs # watch queue FileOperation DTO

crates/photasa-scan/
  Cargo.toml          # serde, serde_json, walkdir, sha2, async-trait, photasa-import, photasa-thumbnail, photasa-types; NO tauri
  src/
    lib.rs
    strategy.rs       # from scan_strategy.rs (+ PhotasaConfigView)
    cache.rs          # from scan_cache.rs
    media.rs          # from scan_media.rs（无重复扩展名表）
    notify.rs         # from scan_notify.rs
    cleanup.rs        # from scan_cleanup.rs
    sink.rs           # async ScanEventSink + async ThumbnailBridge
    # pipeline.rs   — NOT in v1（见 Acceptance）
```

### What stays in `src-tauri`（v1）

| Stay                                       | Reason               |
| ------------------------------------------ | -------------------- |
| `scan_runner.rs`（可继续厚）               | v1 不强制抽 pipeline |
| `spawn_scan_job` / adapter / stubs         | Tauri + 对外 API     |
| `PhotasaConfigView` + `ScanEventSink` 实现 | 桥 0071 / emit       |
| `photasa_config` IPC commands              | 0071 UI 面           |

### Dependency graph

```
photasa-thumbnail (0134)
photasa-types
photasa-scan ──► photasa-types + photasa-import + photasa-thumbnail
photasa (src-tauri) ──► photasa-scan + photasa-import + photasa-watch(0133)
```

0133 **不**依赖 0132。Watch 只产 `FileOperation[]` 给前端队列。

## Alternatives

| Option                                        | Pros                    | Cons                      |
| --------------------------------------------- | ----------------------- | ------------------------- |
| **A. `photasa-scan`（本 RFC）**               | 对齐 0131；测试目标清晰 | runner 可后移             |
| **B. Mega `photasa-fs`（scan+watch+config）** | 少 crate                | 违反一事一 RFC；揉进 0071 |
| **C. 留 src-tauri**                           | 不搬家                  | 仍链 Tauri                |

**Recommend A.**

## Implementation checklist

- [x] Workspace member `crates/photasa-types` + root wiring
- [x] Workspace member `crates/photasa-scan` + root wiring
- [x] Move：strategy / cache / media / notify / cleanup（零 Tauri）
- [x] `PhotasaConfigView` + `ScanEventSink`；`ThumbnailBridge` trait defined for future runner extraction
- [x] 删除 media 内重复扩展名表；统一 `photasa-import::path_filter`
- [x] 现有 `scan_*` 单测随模块迁移；`cargo test -p photasa-scan` 绿
- [x] `cargo tree -p photasa-types` / `cargo tree -p photasa-scan` 无 tauri；`cargo check -p photasa` 绿
- [x] `scan_adapter` / `stubs` IPC 形状不断
- [x] ROADMAP / TASK_TRACKING → ✅；RFC → `completed/`

## Out of scope

| Topic                                  | Owner                                                              |
| -------------------------------------- | ------------------------------------------------------------------ |
| Watch coalescer                        | **[0133](./0133-tauri-photasa-watch-crate.md)**                    |
| Thumbnail 引擎 crate 拆分              | **[0134](./0134-tauri-photasa-thumbnail-crate.md)**（P1a；已落地） |
| Config IPC / 0116 路径契约变更         | **0071 / 0116**                                                    |
| 0117 SKIP/FULL / cache schema 变更     | 需新 parity RFC                                                    |
| `scan_runner` → `pipeline.rs` 全量抽离 | **v2 / 后续 RFC**（非本篇 v1）                                     |

## Risks

| Risk                         | Mitigation                         |
| ---------------------------- | ---------------------------------- |
| Config 耦合拖垮拆分          | 硬门：仅 `PhotasaConfigView`       |
| Runner 过大导致 RFC 无限延期 | v1 不要求迁 runner                 |
| 扩展名表分叉                 | 删 `PHOTO_EXTENSIONS`；只用 import |
| 误改 0116/0117 行为          | 搬家 diff 禁止逻辑改；测表保留     |

## Testing strategy

```bash
cargo test -p photasa-types
cargo test -p photasa-scan
cargo tree -p photasa-scan
cargo check -p photasa
```

Coverage gate：**`-p photasa-scan` only**.

Verification evidence（2026-07-18）:

- `cargo test -p photasa-types`：2 passed
- `cargo test -p photasa-scan`：32 passed
- `cargo check -p photasa`：passed
- `cargo clippy -p photasa-types --all-targets -- -D warnings`：No issues found
- `cargo clippy -p photasa-scan --all-targets -- -D warnings`：No issues found
- `cargo clippy -p photasa --all-targets -- -D warnings`：No issues found
- `cargo test -p photasa`：87 passed, 3 ignored
- `cargo tree -p photasa-types | rg -i tauri`：no matches
- `cargo tree -p photasa-scan | rg -i tauri`：no matches

## Acceptance（v1）

1. `crates/photasa-scan` **无** `tauri` 依赖.
2. **v1 ✅** = strategy + cache + media + notify + cleanup 已迁且 `-p photasa-scan` 绿；**`scan_runner` / pipeline 可仍在 src-tauri**.
3. Runtime 行为相对迁前不变（0116 路径 + 0117 流水线）.
4. `scan_adapter` / `stubs` 仍可导出 `ScanAction` / `spawn_scan_job`.
5. ROADMAP / TASK_TRACKING ✅；正文进 `completed/`.

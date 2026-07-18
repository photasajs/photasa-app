# RFC 0132: Split Photasa scan into standalone `photasa-scan` crate

- **Start Date**: 2026-07-18
- **Last updated**: 2026-07-18
- **Status**: ⏳ Draft
- **Area**: Photasa / Rust crates / Scan
- **Depends on**: [0117](./0117-tauri-scan-pipeline-parity.md), [0105](./0105-tauri-scan-incremental-cache.md), [0111](./0111-tauri-scan-notify-status-bridge.md), [0131](./completed/0131-tauri-photasa-import-crate.md)
- **Related**: [0133](./0133-tauri-photasa-watch-crate.md)（watch 队列合并另案）
- **Path**: `.spec/rfc/0132-tauri-photasa-scan-crate.md`

## Implementation principle (Photasa / Tauri)

> **Rust rewrite, not TypeScript copy.** Policy: [./TAURI_RUST_REWRITE_POLICY.md](./TAURI_RUST_REWRITE_POLICY.md).

- Scan **algorithm** lives in **`crates/photasa-scan`** — **zero Tauri**.
- Electron `@photasa/scan` = **behavioral contract only**; do **not** import Node/TS into Tauri.
- Thumbnail decode / FFmpeg / `create_thumbnail_*` stay in `apps/photasa/src-tauri` (or a future thumbnail crate); scan crate calls them via a **trait**.

## Goal

Directory/file scan pipeline (strategy, cache, walk, notify payload builders, cleanup) is a workspace crate testable with:

```bash
cargo test -p photasa-scan
```

`apps/photasa/src-tauri` keeps thin `#[tauri::command]` / `spawn_scan_job` / `AppHandle::emit` / thumbnail bridge only.

## Problem

Today scan logic sits under `apps/photasa/src-tauri/src/commands/`:

| File               | ~LOC | Tauri?                           | Notes                                                            |
| ------------------ | ---- | -------------------------------- | ---------------------------------------------------------------- |
| `scan_runner.rs`   | ~708 | **yes** (`AppHandle`, `Emitter`) | orchestration + emit + thumbnail calls                           |
| `scan_cache.rs`    | ~376 | no                               | `.photasa-folder.json` + `IncrementalCacheManager`               |
| `scan_media.rs`    | ~346 | no\*                             | walk / extensions; uses `photasa_config` helpers                 |
| `scan_notify.rs`   | ~348 | no                               | `notify:status` payload builders                                 |
| `scan_strategy.rs` | ~274 | no\*                             | SKIP/FULL; uses `photasa_config` + `photasa_import::path_filter` |
| `scan_cleanup.rs`  | ~157 | no                               | orphan thumbnail cleanup                                         |

\*No `tauri` import, but coupled to `commands::photasa_config` and re-exported path filter.

Algorithm tests require compiling the whole Photasa binary (Window, plugins). Same pain **0131** solved for import.

## Design criteria

1. **Testability first** — strategy / cache / notify / walk / cleanup green under `-p photasa-scan` without Window.
2. **Zero Tauri** in crate `Cargo.toml`.
3. **Reuse `photasa-import`** for media path filter (`classify_media`, ignore/hidden) — do **not** duplicate extension tables.
4. **Config I/O via trait or moved pure helpers** — do not drag entire `photasa_config` command module into the crate in v1 if that balloons scope; prefer:
    - move **pure** path/constants used by scan (`PHOTASA_FOLDER_CACHE_FILE`, thumbnail relative path builders needed by walk/strategy) into crate or shared tiny module; **or**
    - inject `PhotasaConfigReader` / pass already-loaded `photoList` + folder hash inputs into `decide_scan_strategy` / `should_process_file`.
5. **Runner emits via sink** — `ScanEventSink` (or equivalent) for `picasa:find-photo` + `notify:status` JSON; Tauri implements with `app.emit`.
6. **Thumbnail via trait** — `ThumbnailBridge::create(...) -> Result<...>` implemented in src-tauri; crate must not depend on `ffmpeg-next` / `libheif`.
7. **No behavior change** — parity with RFC 0117 tables; move is structural.

## Proposed crate layout

```
crates/photasa-scan/
  Cargo.toml          # serde, serde_json, walkdir, sha2, log, photasa-import; NO tauri
  src/
    lib.rs
    strategy.rs       # from scan_strategy.rs
    cache.rs          # from scan_cache.rs
    media.rs          # from scan_media.rs (ScanAction, walk, extensions)
    notify.rs         # from scan_notify.rs
    cleanup.rs        # from scan_cleanup.rs
    pipeline.rs       # optional: pure orchestration extracted from scan_runner
    sink.rs           # ScanEventSink + ThumbnailBridge traits
```

### What stays in `src-tauri`

| Stay                                           | Reason                                                                 |
| ---------------------------------------------- | ---------------------------------------------------------------------- |
| `spawn_scan_job` / command registration        | Tauri entry                                                            |
| `AppHandle` emit adapters                      | implements `ScanEventSink`                                             |
| `create_thumbnail_sync` calls                  | implements `ThumbnailBridge`                                           |
| `photasa_config` **commands** (read/write IPC) | UI/config surface; scan crate may call sync helpers only if moved/pure |

### Dependency graph

```
photasa-scan ──► photasa-import (path_filter)
photasa (src-tauri) ──► photasa-scan + photasa-import
```

**0133** (`photasa-watch`) does **not** depend on `photasa-scan`. Watch only builds `FileOperation[]` for the frontend queue; scan pipeline consumes scan jobs separately.

## Alternatives

| Option                                         | Pros                            | Cons                                |
| ---------------------------------------------- | ------------------------------- | ----------------------------------- |
| **A. `photasa-scan` only (this RFC)**          | Matches 0131; clear test target | Runner extraction may be phased     |
| **B. Mega `photasa-fs` (scan+watch+config)**   | One crate                       | Violates 一事一 RFC; hard to review |
| **C. Leave in src-tauri, more `#[cfg(test)]`** | No move                         | Still links Tauri; slow feedback    |

**Recommend A.**

## Implementation checklist（开工后勾选；Draft 阶段勿写代码）

- [ ] Workspace member `crates/photasa-scan` + root `Cargo.toml` / `workspace.dependencies`
- [ ] Move modules: strategy / cache / media / notify / cleanup（零 Tauri）
- [ ] Depend on `photasa-import` for path filter; delete duplicate re-export paths in scan modules
- [ ] Define `ScanEventSink` + `ThumbnailBridge`; wire thin adapters in `scan_runner`
- [ ] Resolve `photasa_config` coupling without pulling Tauri commands into crate
- [ ] Existing `scan_*` unit tests move with modules; `cargo test -p photasa-scan` green
- [ ] `cargo test` / `cargo check -p photasa` green（no IPC contract change）
- [ ] Thin shims in `commands/scan_*.rs` re-export or delete after move
- [ ] ROADMAP / TASK_TRACKING → ✅；RFC → `completed/`

## Out of scope

| Topic                                    | Owner                                           |
| ---------------------------------------- | ----------------------------------------------- |
| Watch coalescer / `notify` watcher       | **[0133](./0133-tauri-photasa-watch-crate.md)** |
| Thumbnail engine rewrite                 | 0069 / existing thumbnail commands              |
| Import algorithm                         | **0131** ✅                                     |
| Changing SKIP/FULL rules or cache schema | would need new parity RFC                       |

## Risks

| Risk                                      | Mitigation                                                             |
| ----------------------------------------- | ---------------------------------------------------------------------- |
| `scan_runner` + config circular deps      | Traits + pass data in; phased move (pure modules first, runner second) |
| Accidental Tauri dep via transitive crate | CI / `cargo tree -p photasa-scan` assert no `tauri`                    |
| Test drift vs Electron golden             | Keep 0117 table tests; run `-p photasa-scan` as gate                   |

## Testing strategy

```bash
cargo test -p photasa-scan
cargo check -p photasa
# optional: existing scan_ tests that remain in src-tauri adapters
```

Coverage gate for algorithm: **`-p photasa-scan` only**, not whole photasa binary.

## Acceptance

1. `crates/photasa-scan` has **no** `tauri` dependency.
2. Strategy / cache / notify / media / cleanup unit tests run under `-p photasa-scan`.
3. Runtime scan behavior unchanged vs pre-move (0117 contract).
4. Indexed in ROADMAP + TASK_TRACKING as ✅ when done.

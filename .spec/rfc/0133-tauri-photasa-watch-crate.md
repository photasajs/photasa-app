# RFC 0133: Split Photasa watch queue into standalone `photasa-watch` crate

- **Start Date**: 2026-07-18
- **Last updated**: 2026-07-18
- **Status**: ⏳ Draft
- **Area**: Photasa / Rust crates / Watch
- **Depends on**: [0082](./completed/0082-tauri-watch-start-stop-commands.md), [0083](./completed/0083-tauri-watch-event-contract.md), [0003](./completed/0003-unify-watch-to-scan-queue.md)
- **Related**: [0132](./0132-tauri-photasa-scan-crate.md)（scan pipeline 另案；本 crate **不**依赖 photasa-scan）
- **Path**: `.spec/rfc/0133-tauri-photasa-watch-crate.md`

## Implementation principle (Photasa / Tauri)

> **Rust rewrite, not TypeScript copy.** Policy: [./TAURI_RUST_REWRITE_POLICY.md](./TAURI_RUST_REWRITE_POLICY.md).

- Watch **queue algorithm** (dedupe / debounce / `FileOperation` JSON) lives in **`crates/photasa-watch`** — **zero Tauri**.
- Electron `WatchService` = behavioral contract only.
- OS filesystem watcher (`notify` crate) + `AppHandle::emit` stay in `src-tauri` thin layer.

## Goal

`ScanQueueCoalescer` and pure helpers become workspace crate testable with:

```bash
cargo test -p photasa-watch
```

Commands `start_file_watch` / `stop_file_watch` remain Tauri wrappers that own `RecommendedWatcher` and emit:

- `picasa:file-*` / `picasa:file-ready` / `picasa:file-error`（event names unchanged — RFC 0083）
- `picasa:add-to-scan-queue`（`FileOperation[]` — RFC 0003）

## Problem

| File                  | ~LOC | Issue                                                                  |
| --------------------- | ---- | ---------------------------------------------------------------------- |
| `watch_scan_queue.rs` | ~227 | Algorithm + **`tauri::AppHandle`** + **`tauri::async_runtime::spawn`** |
| `watch.rs`            | ~180 | `notify` watcher + emit; correctly Tauri-bound                         |

Only priority / dedup window / debounce tier tests run today; flush scheduling and batch emit need Window or are untested. Same class of problem as pre-**0131** import.

## Design criteria

1. **Testability first** — pending map, dedupe windows, debounce tiers, `FileOperation` shape, flush token cancel — all under `-p photasa-watch`.
2. **Zero Tauri** in crate.
3. **Emit via sink** — `ScanQueueSink::emit_batch(ops: Vec<serde_json::Value>)` (or typed `FileOperation` struct + serde).
4. **Timer via injectable clock/spawn** — do **not** call `tauri::async_runtime` from crate. Options (pick one in implementation):
    - **A.** `async` flush with `tokio` (crate dep `tokio` with `time` only) + sink; Tauri passes runtime; tests use tokio test runtime.
    - **B.** Sync: crate returns “schedule flush after N ms” intents; Tauri owns timer (harder to unit-test flush).
    - **Recommend A** if workspace already has tokio; keep crate free of `tauri`.
5. **Event-name / CreateKind mapping** may stay in `watch.rs` (Tauri) **or** move pure `(EventKind → op_type + event_name)` helpers into crate as pure functions — prefer helpers in crate for tests.
6. **No dependency on `photasa-scan`** — watch only enqueues ops for the **frontend** scan queue; does not run directory scan.
7. **No behavior change** — same windows (add 50ms, change 200ms, …), same debounce tiers, same JSON keys as Electron `createFileOperation`.

## Proposed crate layout

```
crates/photasa-watch/
  Cargo.toml          # serde, serde_json, uuid, log, tokio (time); NO tauri
  src/
    lib.rs
    priority.rs       # event_priority
    dedupe.rs         # deduplication_window_ms, should_deduplicate
    debounce.rs       # calculate_debounce_ms
    file_operation.rs # build FileOperation JSON / struct
    coalescer.rs      # ScanQueueCoalescer + ScanQueueSink
    event_map.rs      # optional: notify EventKind → (event_name, op_type, is_file)
```

### What stays in `src-tauri`

| Stay                                   | Reason                          |
| -------------------------------------- | ------------------------------- |
| `start_file_watch` / `stop_file_watch` | Tauri commands + `WatchState`   |
| `notify::RecommendedWatcher`           | OS integration                  |
| `app.emit(...)` for `picasa:file-*`    | UI contract                     |
| Adapter implementing `ScanQueueSink`   | emit `picasa:add-to-scan-queue` |

### Dependency graph

```
photasa-watch          (standalone)
photasa-scan ──► photasa-import   (0132; unrelated to watch)
photasa (src-tauri) ──► photasa-watch + photasa-scan + photasa-import
```

## Alternatives

| Option                                     | Pros                            | Cons                                                    |
| ------------------------------------------ | ------------------------------- | ------------------------------------------------------- |
| **A. Separate `photasa-watch` (this RFC)** | Matches 一事一 RFC; small crate | Two crates to maintain                                  |
| **B. Fold coalescer into `photasa-scan`**  | One less crate                  | Couples FS-watch queue to scan pipeline; wrong boundary |
| **C. Keep in src-tauri**                   | No move                         | Cannot test flush without Tauri                         |

**Recommend A.** Watch queue is Electron `WatchService` domain; scan is `@photasa/scan` domain.

## Implementation checklist（开工后勾选；Draft 阶段勿写代码）

- [ ] Workspace member `crates/photasa-watch` + root workspace wiring
- [ ] Move coalescer + pure helpers; introduce `ScanQueueSink`
- [ ] Replace `tauri::async_runtime` with tokio (or approved timer abstraction)
- [ ] `watch.rs` thin: notify + emit file events + call coalescer
- [ ] Unit tests: priority, windows, debounce, dedupe, flush cancel token, batch JSON shape
- [ ] `cargo test -p photasa-watch` green
- [ ] `cargo check -p photasa` green；手动：start/stop watch → `add-to-scan-queue` still fires
- [ ] ROADMAP / TASK_TRACKING → ✅；RFC → `completed/`

## Out of scope

| Topic                                | Owner                                          |
| ------------------------------------ | ---------------------------------------------- |
| Scan strategy / cache / thumbnails   | **[0132](./0132-tauri-photasa-scan-crate.md)** |
| Changing event names or payload keys | would need new 0083-style RFC                  |
| Shunfenger / Electron watch package  | Legacy; not Photasa path                       |

## Risks

| Risk                                           | Mitigation                                     |
| ---------------------------------------------- | ---------------------------------------------- |
| Timer semantics drift (tauri runtime vs tokio) | Same debounce ms; integration smoke after move |
| UUID / timestamp shape in `FileOperation.id`   | Keep `"{ms}-{uuid}"` format; snapshot test     |
| Accidentally linking watch → scan              | Explicit non-dependency in Cargo.toml + review |

## Testing strategy

```bash
cargo test -p photasa-watch
cargo check -p photasa
```

Manual (post-implement): start watch on a folder, touch a file, confirm renderer receives `picasa:file-change` and batched `picasa:add-to-scan-queue`.

## Acceptance

1. `crates/photasa-watch` has **no** `tauri` dependency.
2. Coalescer algorithm tests run under `-p photasa-watch`.
3. Event names and `FileOperation` JSON keys unchanged vs RFC 0083 / 0003.
4. Indexed in ROADMAP + TASK_TRACKING as ✅ when done.

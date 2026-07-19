# RFC 0129: Tauri `import:progress` — emit throttling

- **Start Date**: 2026-07-18
- **Status**: ✅ Implemented（2026-07-18）
- **Area**: Photasa / Import / Performance
- **Depends on**: [0070](./0070-tauri-import-service-migration.md)
- **One thing only**: throttle `import:progress` emission (currently one event per file, no batching)

## Implementation principle (Photasa / Tauri)

> **Rust rewrite, not TypeScript copy.** Policy: [ROADMAP.md](../../../ROADMAP.md).

## Summary

Code review (2026-07-18): the per-file copy loop (`crates/photasa-import/src/copy_loop.rs`, `on_progress` called from `import_execute.rs:109`) emits one `import:progress` Tauri IPC event **per copied file**, with no time-based or count-based throttle. Importing thousands of files fires thousands of `window.emit` calls in rapid succession, each requiring JSON serialization and cross-process dispatch to the webview — needless load for progress ticks finer than the UI can visually distinguish (e.g. 10,000 individual 0.01% updates).

## Fix

Batch progress emission by count: emit initial snapshot, first copied-file tick, every 25 files, and final tick. Final state is never stale.

## Non-goals

| Topic                                              | RFC      |
| -------------------------------------------------- | -------- |
| `status: "paused"` emit / cancelled-payload fields | **0125** |
| `import:progress` missing `importId`               | **0128** |
| `import_legacy.rs` copy dedup                      | **0130** |

## Checklist

- [x] Decide throttle strategy: count-based every 25 files
- [x] Always emit initial + first file + final tick
- [x] Rust unit test: many-file import emits fewer than N progress events, last event reflects final counters
- [x] ROADMAP ✅

## Testing

- Unit: simulate many-file import — assert `import:progress` emit count is below file count, and last emitted payload has `processedFiles === totalFiles`.

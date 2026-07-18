# RFC 0129: Tauri `import:progress` — emit throttling

- **Start Date**: 2026-07-18
- **Status**: ⏳ Draft / **P3**（未开工）
- **Area**: Photasa / Import / Performance
- **Depends on**: [0070](./0070-tauri-import-service-migration.md)
- **One thing only**: throttle `import:progress` emission (currently one event per file, no batching)

## Implementation principle (Photasa / Tauri)

> **Rust rewrite, not TypeScript copy.** Policy: [./TAURI_RUST_REWRITE_POLICY.md](./TAURI_RUST_REWRITE_POLICY.md).

## Summary

Code review (2026-07-18): the per-file copy loop (`crates/photasa-import/src/copy_loop.rs`, `on_progress` called from `import_execute.rs:109`) emits one `import:progress` Tauri IPC event **per copied file**, with no time-based or count-based throttle. Importing thousands of files fires thousands of `window.emit` calls in rapid succession, each requiring JSON serialization and cross-process dispatch to the webview — needless load for progress ticks finer than the UI can visually distinguish (e.g. 10,000 individual 0.01% updates).

## Fix

Batch progress emission: emit at most once per N files (e.g. every 10–50) **or** once per M milliseconds (e.g. every 100–250ms), whichever comes first — always still emit on the very first file (so the UI doesn't sit blank) and always emit the final tick before completion/cancellation/error so the last state is never stale.

## Non-goals

| Topic | RFC |
|-------|-----|
| `status: "paused"` emit / cancelled-payload fields | **0125** |
| `import:progress` missing `importId` | **0128** |
| `import_legacy.rs` copy dedup | **0130** |

## Checklist

- [ ] Decide throttle strategy: count-based, time-based, or both (whichever fires first)
- [ ] Always emit first tick + final tick regardless of throttle window
- [ ] Rust unit test: N-file import emits fewer than N progress events, but the last emitted event reflects final counters
- [ ] ROADMAP ✅

## Testing

- Unit: simulate a 1,000-file import — assert `import:progress` emit count is well below 1,000, and the last emitted payload has `processedFiles === totalFiles` (or matches the terminal count).

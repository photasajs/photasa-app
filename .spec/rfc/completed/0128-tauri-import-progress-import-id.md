# RFC 0128: Tauri `import:progress` — missing `importId` field

- **Start Date**: 2026-07-18
- **Status**: ✅ Implemented
- **Area**: Photasa / Import / Events
- **Path**: `.spec/rfc/completed/0128-tauri-import-progress-import-id.md`
- **Depends on**: [0070](../0070-tauri-import-service-migration.md), [0118](./0118-tauri-import-background-ui.md)
- **One thing only**: `import:progress` event payload → add `importId`

## Implementation principle (Photasa / Tauri)

> **Rust rewrite, not TypeScript copy.** Policy: [../TAURI_RUST_REWRITE_POLICY.md](../TAURI_RUST_REWRITE_POLICY.md).

## Summary

Code review (2026-07-18) confirmed: `import:complete` and `import:error` both embed `importId` in their JSON payload (`import_execute.rs:117-120`, `168-173`), but `import:progress` does not — `grep -n "importId" crates/photasa-import/src/copy_loop.rs` returns zero matches, and the progress-emit call site (`import_execute.rs:109-110`) passes the raw `progress_val` through unmodified.

Frontend `import-session.ts:90-92` applies every `import:progress` payload unconditionally — there is nothing to filter on. If import A is cancelled and import B starts immediately after, a straggling progress tick from A's still-unwinding background task (the `tauri::async_runtime::spawn` isn't force-killed; it runs to its next cancel-check) can be applied to B's session, corrupting B's displayed counters. RFC 0118's gap G4 ("progress JSON no `importId` → Multi-import filter") already named this as a known gap but deferred the Rust change ("Rust: Default no change" — RFC 0118 §7); this RFC is that deferred change, now justified by a concrete misattribution scenario.

## Fix

Add `importId` to every `import:progress` payload (normal per-file tick, initial tick, and `cancelled_progress_json`), mirroring what `import:complete`/`import:error` already do. Frontend `import-session.ts`'s progress listener should then ignore any event whose `importId` doesn't match the current session's `importId`.

## Non-goals

| Topic                                              | RFC                            |
| -------------------------------------------------- | ------------------------------ |
| `status: "paused"` emit / cancelled-payload fields | **0125**                       |
| Progress emit throttling                           | **0129**                       |
| `import_legacy.rs` copy dedup                      | **0130**                       |
| checksum / duplicateCount / resume return          | **0119** / **0123** / **0124** |

## Checklist

- [x] Add `importId` to normal progress JSON (`copy_loop.rs` per-file + initial tick)
- [x] Add `importId` to `cancelled_progress_json`
- [x] Frontend `import-session.ts`: ignore `import:progress` events whose `importId` mismatches session
- [x] Rust / Vitest test: stale progress from a cancelled import is dropped by a new session
- [x] ROADMAP ✅

## Testing

- Unit: start import A, cancel, immediately start import B — a queued/late progress event tagged with A's `importId` must not mutate B's session state.

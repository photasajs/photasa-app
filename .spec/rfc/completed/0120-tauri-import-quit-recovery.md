# RFC 0120: Tauri import — app quit / crash mid-import recovery

- **Start Date**: 2026-07-17
- **Status**: ✅ Implemented（2026-07-18）
- **Area**: Photasa / Import / Resilience
- **Depends on**: [0070](../0070-tauri-import-service-migration.md), [0118](./0118-tauri-import-background-ui.md)
- **Tracks gap**: **G11** (0118 gap analysis)

## Implementation principle (Photasa / Tauri)

> **Rust rewrite, not TypeScript copy.** Policy: [../TAURI_RUST_REWRITE_POLICY.md](../TAURI_RUST_REWRITE_POLICY.md).

## Summary

`execute_import` now records an active import marker in `ImportSessionStore` and appends each successfully copied file to a per-import JSONL journal. If Photasa exits or crashes before the import completes, the next launch reads that active marker and shows a non-expiring recovery notification.

The prompt offers two honest actions:

- **Clean up**: delete files recorded in the journal, then clear the interrupted marker.
- **Keep files**: leave copied files in place, then clear the interrupted marker.

Retry/resume is intentionally not shipped here. A killed process has no live worker to resume; pretending otherwise would create duplicate-copy edge cases. Users can start a fresh import from the wizard.

## Implementation

- `crates/photasa-import/src/session.rs`: persisted active import markers, JSONL copied-file journal, recoverable import query, cleanup, keep.
- `crates/photasa-import/src/copy_loop.rs`: reports each copied file after a successful copy.
- `apps/photasa/src-tauri/src/commands/import_execute.rs`: starts active marker, updates progress, records copied files, clears marker on cancel/error/complete.
- `apps/photasa/src-tauri/src/commands/import_session_store.rs`: `get_recoverable_imports`, `cleanup_recoverable_import`, `keep_recoverable_import`.
- `apps/photasa/src/App.vue`: startup detection and recovery notification.
- `apps/photasa/src/api/legacy-api.ts`, `apps/photasa/src/utils/api.ts`, `packages/common/src/import-types.ts`: typed frontend API.

## Verification

- [x] `cargo test -p photasa-import` → 45 passed.
- [x] Recovery unit test covers active marker restart and cleanup deleting copied files.
- [x] Copy loop unit test covers copied-file journal callback.
- [x] Frontend API/typecheck covers recoverable import wrappers.

## Checklist

- [x] On-disk active marker and copied-file journal
- [x] Startup UI prompt
- [x] Tests: interrupted import marker survives restart and cleanup works
- [x] ROADMAP ⏸️ → ✅

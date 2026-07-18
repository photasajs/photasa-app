# RFC 0120: Tauri import — app quit / crash mid-import recovery

- **Start Date**: 2026-07-17
- **Status**: ⏸️ Deferred（tracked; **not** in 0118）
- **Area**: Photasa / Import / Resilience
- **Depends on**: [0070](./0070-tauri-import-service-migration.md), [0118](./0118-tauri-import-background-ui.md)
- **Tracks gap**: **G11** (0118 gap analysis)

## Implementation principle (Photasa / Tauri)

> **Rust rewrite, not TypeScript copy.** Policy: [./TAURI_RUST_REWRITE_POLICY.md](./TAURI_RUST_REWRITE_POLICY.md).

## Summary

Today: kill app mid-`execute_import` → partial files on disk; no resume-from-crash.  
**0120** will define: detect incomplete session on next launch, user prompt (cleanup / keep / retry), optional durable journal.

## Why deferred

0118 only covers dismiss-while-running in one process. Crash recovery is separate product + Rust durability work.

## Non-goals until Accepted

- No implementation while Deferred
- Must not block 0118 ✅
- checksum → **0119**; duplicateCount → **0123**; resume → **0124**; paused emit → **0125**

## Checklist (when activated)

- [ ] On-disk journal or reuse ImportSessionStore in-progress marker
- [ ] Startup UI prompt
- [ ] Tests: kill mid-copy → relaunch behavior
- [ ] ROADMAP ⏸️ → 🔨 → ✅

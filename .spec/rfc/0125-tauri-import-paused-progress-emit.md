# RFC 0125: Tauri `pause_import` — emit `import:progress` with `status: "paused"`

- **Start Date**: 2026-07-17
- **Status**: ⏳ Draft / **P3**（未开工）
- **Area**: Photasa / Import / Events
- **Depends on**: [0096](./completed/0096-tauri-import-pause-resume.md), [0118](./0118-tauri-import-background-ui.md)（UI 可先用本地 paused 标志）
- **One thing only**: Rust import-progress event payloads honestly reflect pause/cancel state (0096 unresolved question)

## Implementation principle (Photasa / Tauri)

> **Rust rewrite, not TypeScript copy.** Policy: [./TAURI_RUST_REWRITE_POLICY.md](./TAURI_RUST_REWRITE_POLICY.md).

## Summary

Code review (2026-07-18) confirmed via direct grep: **no `"paused"` JSON status literal exists anywhere** in `import_execute.rs` or `crates/photasa-import/src/copy_loop.rs`. `pause_import` (`import_execute.rs:230-240`) only flips an `AtomicBool` via `registry_set_paused`; the copy loop's `wait_unpaused_or_cancel` (`copy_loop.rs:33-43`) busy-polls the flag with **zero callback invocation** while paused — no event fires until the next file boundary (which may be minutes away, or never if paused on the last file). Frontend `import-session.ts:105-106` has dead code waiting for `status === "paused"` that the backend structurally never sends.

Two concrete gaps, same emit-function family, fixed together:

1. **G1 — no paused emit.** On `pause_import`, emit `import:progress` once with `status: "paused"` (and current counters, sourced from `ImportSessionStore::get_import_progress`) so dismissed chip / multi-listener UIs need not rely only on a local UI flag.
2. **G2 — `cancelled_progress_json` (`copy_loop.rs:109-128`) omits fields present in every normal progress payload.** Direct field diff against the per-file progress JSON (`copy_loop.rs:261-275`): `speed`, `estimatedTimeRemaining`, `remainingTime`, `startTime` are present in normal ticks but absent from the cancelled payload. Any frontend code assuming these fields always exist on an `import:progress` payload (percentage/ETA calc) produces `undefined`/`NaN` on cancel instead of a clean cancelled display. Fix: `cancelled_progress_json` should include the same field set as the normal payload (last-known `speed`/`startTime` carried forward, `estimatedTimeRemaining`/`remainingTime` zeroed).

## Non-goals

| Topic | RFC |
|-------|-----|
| pause/resume AtomicBool | **0096** ✅ |
| Background dismiss UI | **0118** |
| checksum / duplicateCount / resume return | **0119** / **0123** / **0124** |
| `import:progress` missing `importId` | **0128** |
| Progress emit throttling | **0129** |
| `import_legacy.rs` copy dedup | **0130** |

## Checklist

- [ ] G1: Emit from `pause_import` (or execute loop on pause edge), sourced from `ImportSessionStore::get_import_progress`
- [ ] G1: Optional resume emit `status: "processing"`
- [ ] G2: `cancelled_progress_json` includes `speed`/`estimatedTimeRemaining`/`remainingTime`/`startTime` matching normal payload shape
- [ ] Rust / Vitest listen assert
- [ ] ROADMAP ✅

## Testing

- Pause → listener receives `status: "paused"` with full field set; resume continues copy.
- Cancel → listener receives `status: "cancelled"` payload with the same field set as normal progress ticks (no missing keys).

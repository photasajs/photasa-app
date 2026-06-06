# Photasa / Tauri: Rust Rewrite Policy (Golden Rule)

**Last updated**: 2026-06-06

**Applies to:** all RFCs that touch `apps/photasa`, `src-tauri`, or workspace `crates/` for backend behavior.

**Does not apply to:** Electron-only RFCs (e.g. RFC 0098 package extraction), Vue UI-only work, or historical v2.0 Electron features unless they are being re-implemented for Photasa.

---

## Golden rule

**Rewrite in Rust. Do not copy or reuse Electron-era TypeScript/Node backend code in Photasa.**

| Allowed | Forbidden |
|---------|-----------|
| Rust implementation in `apps/photasa/src-tauri` and `crates/` | Importing `@photasa/scan`, `@photasa/import`, `@photasa/config-core`, or other Node packages from Tauri |
| Reading Electron/TS **only** to learn IPC names, event payloads, on-disk JSON schemas | Translating TS line-by-line into Rust or “shared” TS packages for Tauri |
| Golden tests: same inputs → same outputs as Electron | Calling Node from Tauri, embedding worker_threads logic from desktop |
| Vue frontend reuse (components, stores, services that call `window.api`) | Growing new backend logic in renderer or new Node-only paths for Photasa |

---

## What “1:1 parity” means

**Parity = behavioral contract**, not code reuse.

- **Same:** command names, event names, JSON field shapes, file paths (e.g. `.photasa-folder.json`), user-visible outcomes.
- **Not required:** same algorithms, same file layout in repo, same dependencies (klaw vs walkdir, exifr vs kamadak-exif, etc.).

When an RFC says “align with Electron” or “match TypeScript”, it means **specification alignment**, unless the RFC explicitly scopes to **Electron-only** maintenance.

---

## Implementation workflow

1. **Specify** the contract (IPC, events, disk format) from Electron behavior or existing docs.
2. **Implement independently in Rust** (prefer pure functions + tests in `crates/` when reusable).
3. **Verify** with Rust unit/integration tests; optional black-box comparison against Electron outputs.
4. **Document** in the RFC that TS was used as reference only, not as source to copy.

---

## RFC 0098 (Electron package extraction)

RFC 0098 is **Electron monorepo hygiene only**. It must **not** block, substitute, or define the Photasa backend path. Tauri work for scan/import/config/thumbnail follows **this policy**, not 0098 Phase 2.

---

## Frontend exception (RFC 0067 / 0073)

Vue UI may be copied/adapted from `apps/desktop` renderer. That is **UI reuse**, not backend reuse. All heavy I/O, media, persistence, and security-sensitive logic stays in Rust per `AGENTS.md`.

---

## Wording for RFC authors

**Prefer:**

- “Implement in Rust to match the Electron **contract** …”
- “On-disk format compatible with legacy `.photasa-folder.json` …”
- “Reference implementation: `apps/desktop/...` (spec only)”

**Avoid:**

- “Port `scan-photos.ts` to Rust”
- “Mirror TypeScript implementation”
- “Reuse `@photasa/scan` from Tauri”
- “对应 scan-service.ts” as the **implementation** target (OK as **spec** index if labeled “behavior reference”)

---

## Related

- Root [`ROADMAP.md`](../../ROADMAP.md) — goal: Tauri + full Rust backend
- [`AGENTS.md`](../../AGENTS.md) — Rust-first (always)

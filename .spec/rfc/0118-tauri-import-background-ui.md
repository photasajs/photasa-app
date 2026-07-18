# RFC 0118: Tauri import progress — dismiss modal, continue in background

- **Start Date**: 2026-07-17
- **Last updated**: 2026-07-17
- **Status**: ⏳ Draft（**P2 UX**；非迁移）
- **Area**: Photasa / Import / UI（`apps/photasa` only）
- **Depends on**: [0070](./0070-tauri-import-service-migration.md), [0096](./completed/0096-tauri-import-pause-resume.md), [0001](./completed/0001-import-wizard-system.md)（规格）
- **Path**: `.spec/rfc/0118-tauri-import-background-ui.md`

## Implementation principle (Photasa / Tauri)

> **Rust rewrite, not TypeScript copy.** Policy: [./TAURI_RUST_REWRITE_POLICY.md](./TAURI_RUST_REWRITE_POLICY.md).

- Import **backend already rewritten** in Rust. This RFC does **not** re-port Electron import-worker or `@photasa/import`.
- Vue UI only; Rust change only if proven necessary (default: **zero**).

---

## Goal (one sentence)

Dismiss progress modal → Rust keeps copying → chip shows progress → re-open modal (no second execute) → pause/resume/cancel still work. **No Settings Import panel.**

---

## Gap analysis — every gap tracked by an RFC

**Rule:** No gap without an owning RFC. Floating “out of scope” notes are forbidden.

Reviewed against: `ImportProgressModal.vue`, `ImportPhotos.vue`, `legacy-api` import unsubs, `import_execute.rs`, `get_import_progress`.

| # | Gap | Risk | Owning RFC | Status in owner |
|---|-----|------|------------|-----------------|
| G1 | Re-open re-`executeImport` via `watch(config)` | Duplicate copies | **[0118](./0118-tauri-import-background-ui.md)** | In scope — start vs reattach |
| G2 | `removeImportListeners` kills chip | Progress dies after dismiss | **0118** | In scope — session-owned listeners |
| G3 | X/Esc = cancel | Cannot dismiss | **0118** | In scope — Dismiss ≠ Cancel |
| G4 | progress JSON no `importId` | Multi-import filter | **0118** | In scope — single-flight |
| G5 | `remove_progress` after done | Bad hydrate | **0118** | In scope — session snapshot |
| G6 | Paused while dismissed | Lost paused UI | **0118** | In scope — store paused flag |
| G7 | Complete while dismissed | Silent finish | **0118** | In scope — toast + chip |
| G8 | Wizard config still set | Re-trigger G1 | **0118** | In scope — attachOnly / alreadyStarted |
| G9 | desktop vs photasa scope | Wrong tree edits | **0118** | In scope — Photasa only |
| G10 | Legacy `importPhotos` background UX | Second UI surface | **[0122](./0122-tauri-legacy-importphotos-background-ux.md)** | ⏸️ Deferred / won't prioritize |
| G11 | App quit mid-import | Partial files | **[0120](./0120-tauri-import-quit-recovery.md)** | ⏸️ Deferred |
| G12 | Settings Import prefs | No defaults panel | **[0121](./0121-tauri-import-settings-prefs.md)** | ⏸️ Deferred |
| G13 | Concurrent start + History | Race | **0118** | In scope — block second execute |
| G14 | i18n + a11y chip | Unannounced | **0118** | In scope — i18n + aria-live |

**Related contract honesty** (not G1–G14, still must have RFC): **[0119](./0119-tauri-import-contract-polish.md)** — checksum / duplicateCount / resume shape / optional paused emit.

### Gap ownership checklist (0118 only)

- [ ] G1 start vs reattach
- [ ] G2 session listeners ≠ modal `removeImportListeners`
- [ ] G3 Dismiss ≠ Cancel
- [ ] G4 single-flight
- [ ] G5 hydrate from session
- [ ] G6 paused flag
- [ ] G7 toast when dismissed
- [ ] G8 no re-execute from leftover config
- [ ] G9 Photasa-only paths
- [ ] G13 block concurrent
- [ ] G14 i18n + aria-live

G10 / G11 / G12 → **not** implemented under 0118; progress tracked only on 0122 / 0120 / 0121.

---

## Sibling RFCs (must not float)

| RFC | Role | Priority |
|-----|------|----------|
| **0118** | Background dismiss UI (G1–G9, G13–G14) | **P2** |
| **0119** | Contract polish | **P3** |
| **0120** | Quit/crash recovery (G11) | Deferred |
| **0121** | Settings import prefs (G12) | Deferred |
| **0122** | Legacy importPhotos background UX (G10) | Deferred / low |
| **0093** | Legacy importPhotos **Rust** API | ✅ Done (not UX) |
| **0070 / 0096** | Execute / pause Rust | ✅ Done |

---

## Non-goals of **this** RFC (each has its own RFC)

| Topic | Tracked by |
|-------|------------|
| checksum / duplicateCount / resume shape | **0119** |
| Quit mid-import recovery | **0120** |
| Settings Import panel | **0121** |
| Legacy importPhotos chip/dismiss | **0122** |
| Re-write import Rust kernel | **0070** ✅ (no new RFC) |

---

## Current vs target

| Action | Today | Target |
|--------|-------|--------|
| Running + modal X / Esc | Blocked or cancel | **Dismiss** (task continues) |
| “Cancel” / Stop button | `cancel_import` | Unchanged |
| “Run in background” | Missing | Same as dismiss (+ optional explicit button) |
| After dismiss | Listeners torn down; state wiped | App session + listeners alive; chip visible |
| Re-open | Would call `startImport` again (bug) | **Reattach only** |
| Complete while dismissed | Silent | Toast + chip done |
| Second import while active | Possible | **Blocked** + toast |
| Settings | N/A | Unchanged |

---

## Detailed design

### 1. Active import session (single-flight)

Store (Pinia or composable), **one** active job:

```ts
{
  importId: string | null
  phase: "idle" | "running" | "paused" | "completed" | "failed" | "cancelled"
  progress: ImportProgress | null   // last snapshot
  result: ImportResult | null
  error: unknown
  startedAt: number
}
```

Rules:

- `executeImport` only when `phase === "idle"` (or terminal cleared).
- App-level subscribe to `import:progress` / `import:complete` / `import:error` **once** while `phase` is running/paused.
- Subscriptions live in session module — **never** registered into modal-local `cleanupFunctions` that call `removeImportListeners()`.

### 2. Modal API change

Props (conceptual):

| Prop | Meaning |
|------|---------|
| `show` | Visible |
| `config` | Required for **start** only |
| `mode`: `"start" \| "reattach"` | `start` → execute once; `reattach` → bind to session.importId, hydrate, **no** execute |

Or equivalent: `attachImportId: string | null` — if set, reattach; else start from config.

**Must change** current `watch(config, { immediate: true })` so re-show does not re-execute.

### 3. Dismiss vs cancel

| UI control | Behavior |
|------------|----------|
| X / Esc / backdrop / “Run in background” | `show=false`; **no** `cancelImport`; session stays running/paused |
| Stop / Cancel button | `cancelImport(importId)`; session → cancelled; clear chip after ack |
| Done (after complete) | emit complete; clear session |

`handleCancel` today must be split — **do not** cancel on dismiss.

### 4. Chip

- Host: `App.vue` (or shell always mounted) — not only inside closed wizard.
- Visible when `phase` ∈ {running, paused} or terminal until user dismisses chip.
- Shows processed/total (or %); paused styling if paused.
- Click → open modal in **reattach** mode.
- `aria-live="polite"` for progress updates (throttle OK).

### 5. Hydration on re-open

1. Prefer **session.progress** (always updated by app listeners).
2. Optionally `getImportProgress(importId)` while still running (map has entry).
3. After complete/cancel, Rust **removed** progress — **do not** trust empty stub alone; use session.result / phase.

### 6. Notifications

On `import:complete` / `import:error` while modal not shown: use existing `notification` manager (人界风格) so user knows.

### 7. Rust

Default **no change**. Revisit only if product requires progress `importId` field or list-active-imports.

---

## Implementation plan (ordered)

### Phase A — Session foundation

1. Add `import-session` store/composable (single-flight API: `begin`, `applyProgress`, `complete`, `fail`, `cancel`, `clear`, `canStart`).
2. Move progress/complete/error listening to session (or App bootstrap) while active.
3. **Do not** use `removeImportListeners()` for session teardown — only unlisten the session’s own handles.

### Phase B — Modal

4. Add start vs reattach modes; fix watch so reattach never `executeImport`.
5. Dismiss ≠ cancel; allow close while running/paused.
6. Stop wiping session `importId` on `show=false` when dismiss.
7. On modal unmount: clean **local** UI only; never global import unsubs used by session.

### Phase C — Chip + notify

8. Chip in App shell; wire re-open → reattach.
9. Toast on complete/error when modal hidden.
10. i18n: `runInBackground`, `importRunning`, `showProgress`, `importAlreadyRunning`.

### Phase D — Guards + ship

11. Block second wizard complete / execute while active.
12. Tests T1–T2; ROADMAP 0118 → ✅.

---

## Test plan

### T0 — Preconditions

| # | Action | Pass |
|---|--------|------|
| T0.1 | `cargo test` (import-related) | Green |
| T0.2 | Existing `ImportProgressModal` Vitest | Green before edit |

### T1 — Unit (Vitest) — merge gate

| # | Case | Assert |
|---|------|--------|
| T1.1 | Dismiss while running | `cancelImport` **not** called; session still has `importId` |
| T1.2 | Cancel button | `cancelImport` called once; phase cancelled |
| T1.3 | Re-open reattach | `executeImport` **not** called again |
| T1.4 | Progress while dismissed | Session progress updates (mock event) |
| T1.5 | Complete while dismissed | Phase completed; notify helper invoked (mock) |
| T1.6 | Second `canStart` while running | false / blocked |
| T1.7 | Modal unmount | Session listeners **still** alive (mock: progress still applied) |
| T1.8 | Reattach hydrate | Uses session snapshot; does not require progress map |

### T2 — Manual (`tauri:dev`)

| # | Steps | Pass |
|---|-------|------|
| T2.1 | Long import (>10s) | Modal shows |
| T2.2 | Run in background / X | Modal closes; disk still receiving files; chip updates |
| T2.3 | Browse library / open Settings | Usable; chip alive |
| T2.4 | Click chip | Reattach; numbers match; **no** duplicate file set |
| T2.5 | Pause / Resume from reopened modal | Honors file-boundary pause |
| T2.6 | Cancel from reopened modal | Stops; chip clears |
| T2.7 | Finish while dismissed | Toast; history entry; undo works |
| T2.8 | Start second import while first runs | Blocked + message |
| T2.9 | Settings smoke (Update / General / Scan) | Unchanged; no Import tab |

### T3 — Covered by other RFCs (do not fail 0118)

| Topic | RFC |
|-------|-----|
| checksum / duplicateCount / resume | **0119** |
| Quit/crash recovery | **0120** |
| Settings Import panel | **0121** |
| Legacy importPhotos background UX | **0122** |
| MakerNote edges | **0112** ✅（已完成；非本缺口） |

---

## Implementation checklist

- [ ] A1 Session store + single-flight
- [ ] A2 App-level listeners (no global remove on dismiss)
- [ ] B1 Modal start vs reattach
- [ ] B2 Dismiss ≠ cancel
- [ ] B3 Preserve session on dismiss
- [ ] C1 Chip + aria-live
- [ ] C2 Toast when complete/error while dismissed
- [ ] C3 i18n
- [ ] D1 Block concurrent start
- [ ] T1 green
- [ ] T2 signed
- [ ] ROADMAP / TASK_TRACKING → ✅

---

## Drawbacks / risks

| Risk | Mitigation |
|------|------------|
| Listener leak | Session clears unlisten on terminal + `clear` |
| Double execute | G1 + D1 |
| Silent complete | G7 toast |
| User forgets import | Chip |

## Alternatives

- Modal-only: reject.  
- Tray-only: defer.  
- Put chip only inside `ImportPhotos`: weaker if shell changes — prefer **App.vue**.

## Unresolved (decide in Phase C)

- Chip placement: default **bottom status area**.  
- Explicit “Run in background” button vs rely on X only: prefer **both** (button + X = dismiss).

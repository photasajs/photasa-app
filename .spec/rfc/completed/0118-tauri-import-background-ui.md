# RFC 0118: Tauri import progress — dismiss modal, continue in background

- **Start Date**: 2026-07-17
- **Last updated**: 2026-07-18
- **Status**: ✅ Implemented（2026-07-18；T2 user-signed）
- **Area**: Photasa / Import / UI（`apps/photasa` only）
- **Depends on**: [0070](./0070-tauri-import-service-migration.md), [0096](./0096-tauri-import-pause-resume.md), [0001](./0001-import-wizard-system.md)（规格）
- **Path**: `.spec/rfc/completed/0118-tauri-import-background-ui.md`

## Implementation principle (Photasa / Tauri)

> **Rust rewrite, not TypeScript copy.** Policy: [ROADMAP.md](../../../ROADMAP.md).

- Import **backend already rewritten** in Rust. This RFC does **not** re-port contract reference import-worker or `@photasa/import`.
- Vue UI only; Rust change only if proven necessary (default: **zero**).

---

## Goal (one sentence)

Dismiss progress modal → Rust keeps copying → chip shows progress → re-open modal (no second execute) → pause/resume/cancel still work. **No Settings Import panel.**

---

## Gap analysis — every gap tracked by an RFC

**Rule:** No gap without an owning RFC. Floating “out of scope” notes are forbidden.

Reviewed against: `ImportProgressModal.vue`, `ImportPhotos.vue`, `legacy-api` import unsubs, `import_execute.rs`, `get_import_progress`.

| #   | Gap                                                                        | Risk                                                                                  | Owning RFC                                                              | Status in owner                                         |
| --- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------- |
| G1  | Re-open re-`executeImport` via `watch(config)`                             | Duplicate copies                                                                      | **[0118](./0118-tauri-import-background-ui.md)**                        | In scope — start vs reattach                            |
| G2  | `removeImportListeners` kills chip                                         | Progress dies after dismiss                                                           | **0118**                                                                | In scope — session-owned listeners                      |
| G3  | X/Esc = cancel                                                             | Cannot dismiss                                                                        | **0118**                                                                | In scope — Dismiss ≠ Cancel                             |
| G4  | progress JSON no `importId`                                                | Multi-import filter                                                                   | **0118**                                                                | In scope — single-flight                                |
| G5  | `remove_progress` after done                                               | Bad hydrate                                                                           | **0118**                                                                | In scope — session snapshot                             |
| G6  | Paused while dismissed                                                     | Lost paused UI                                                                        | **0118**                                                                | In scope — store paused flag                            |
| G7  | Complete while dismissed                                                   | Silent finish                                                                         | **0118**                                                                | In scope — toast + chip                                 |
| G8  | Wizard config still set                                                    | Re-trigger G1                                                                         | **0118**                                                                | In scope — attachOnly / alreadyStarted                  |
| G9  | desktop vs photasa scope                                                   | Wrong tree edits                                                                      | **0118**                                                                | In scope — Photasa only                                 |
| G10 | Legacy `importPhotos` background UX                                        | Second UI surface                                                                     | **[0122](../rejected/0122-tauri-legacy-importphotos-background-ux.md)** | ❌ Rejected / won't fix                                 |
| G11 | App quit mid-import                                                        | Partial files                                                                         | **[0120](./0120-tauri-import-quit-recovery.md)**                        | ✅ Implemented                                          |
| G12 | Settings Import prefs                                                      | No defaults panel                                                                     | **[0121](./0121-tauri-import-settings-prefs.md)**                       | ✅ Implemented                                          |
| G13 | Concurrent start + History                                                 | Race                                                                                  | **0118**                                                                | In scope — block second execute                         |
| G14 | i18n + a11y chip                                                           | Unannounced                                                                           | **0118**                                                                | In scope — i18n + aria-live                             |
| G15 | `importError`/`importResult` refs never reset in `ImportProgressModal.vue` | Stale error/result panel leaks into next import run                                   | **0118**                                                                | In scope — reset on `startImport` + terminal close      |
| G16 | `applyProgress` no `phase==="cancelled"` guard                             | Late in-flight `import:progress` event resurrects phase to `"running"` after cancel   | **0118**                                                                | In scope — no-op once cancelled                         |
| G17 | `startListeners()` uses `await import("@tauri-apps/api/event")`            | Violates CLAUDE.md ES6-import-only rule; sibling adapters prove static import is safe | **0118**                                                                | In scope — hoist to static import                       |
| G18 | `en-GB.json` missing `import.status.failed`                                | Locale gap vs `en-US.json` / `zh-CN.json`                                             | **0118**                                                                | In scope — add key                                      |
| G19 | Preview step disables Back to avoid stale async preview                    | Confuses import-options navigation with running import cancellation                   | **0118**                                                                | In scope — Back means edit import options before Import |

**Related one-thing RFCs** (not G1–G14; each own file — **no mono “contract polish”**):

| Topic                                              | RFC                                                                |
| -------------------------------------------------- | ------------------------------------------------------------------ |
| `checksum`                                         | **[0119](./0119-tauri-import-checksum.md)**                        |
| `duplicateCount`                                   | **[0123](./0123-tauri-import-duplicate-count.md)**                 |
| `resumeImport` return                              | **[0124](./0124-tauri-import-resume-return-shape.md)**             |
| pause → `status: "paused"` emit                    | **[0125](./0125-tauri-import-paused-progress-emit.md)**            |
| contract reference same UX                         | **[0126](../rejected/0126-legacy-import-background-ux-parity.md)** |
| `import:error` payload shape                       | **[0127](./0127-tauri-import-error-payload-shape.md)**             |
| `status: "paused"` emit / cancelled-payload fields | **[0125](./0125-tauri-import-paused-progress-emit.md)**            |
| `import:progress` missing `importId`               | **[0128](./0128-tauri-import-progress-import-id.md)**              |
| `import:progress` emit throttling                  | **[0129](./0129-tauri-import-progress-throttle.md)**               |
| `import_legacy.rs` copy dedup                      | **[0130](./0130-tauri-import-legacy-copy-dedup.md)**               |

### Gap ownership checklist (0118 only)

- [x] G1 start vs reattach
- [x] G2 session listeners ≠ modal `removeImportListeners`
- [x] G3 Dismiss ≠ Cancel
- [x] G4 single-flight
- [x] G5 hydrate from session
- [x] G6 paused flag
- [x] G7 toast when dismissed
- [x] G8 no re-execute from leftover config
- [x] G9 Photasa-only paths
- [x] G13 block concurrent
- [x] G14 i18n + aria-live
- [x] G19 preview Back = edit import options; Import boundary owns no Back

G10 / G11 / G12 were intentionally kept out of 0118. Final disposition: 0120 ✅, 0121 ✅, 0122 ❌.

---

## Sibling RFCs (one concern each — no mono bags)

| RFC             | One thing                               | Priority    |
| --------------- | --------------------------------------- | ----------- |
| **0118**        | Background dismiss UI (G1–G9, G13–G14)  | **P2**      |
| **0119**        | `checksum` only                         | **P3**      |
| **0120**        | Quit/crash recovery (G11)               | Implemented |
| **0121**        | Settings import prefs (G12)             | Implemented |
| **0122**        | Legacy importPhotos background UX (G10) | Rejected    |
| **0123**        | `duplicateCount` only                   | **P3**      |
| **0124**        | `resumeImport` return shape only        | **P3**      |
| **0125**        | `status: "paused"` emit only            | **P3**      |
| **0126**        | contract reference UX parity only       | Rejected    |
| **0127**        | `import:error` payload shape only       | **P3**      |
| **0093**        | Legacy importPhotos Rust API            | ✅          |
| **0070 / 0096** | Execute / pause Rust                    | ✅          |

---

## Non-goals of **this** RFC (each has its own RFC)

| Topic                            | Tracked by  |
| -------------------------------- | ----------- |
| `checksum`                       | **0119**    |
| `duplicateCount`                 | **0123**    |
| resume return shape              | **0124**    |
| paused progress emit             | **0125**    |
| Quit mid-import recovery         | **0120**    |
| Settings Import panel            | **0121**    |
| Legacy importPhotos chip/dismiss | **0122**    |
| contract reference same UX       | **0126**    |
| Re-write import Rust kernel      | **0070** ✅ |

---

## Current vs target

| Action                     | Today                                          | Target                                                         |
| -------------------------- | ---------------------------------------------- | -------------------------------------------------------------- |
| Running + modal X / Esc    | Blocked or cancel                              | **Dismiss** (task continues)                                   |
| “Cancel” / Stop button     | `cancel_import`                                | Unchanged                                                      |
| “Run in background”        | Missing                                        | Same as dismiss (+ optional explicit button)                   |
| After dismiss              | Listeners torn down; state wiped               | App session + listeners alive; chip visible                    |
| Re-open                    | Would call `startImport` again (bug)           | **Reattach only**                                              |
| Complete while dismissed   | Silent                                         | Toast + chip done                                              |
| Second import while active | Possible                                       | **Blocked** + toast                                            |
| Preview step Back          | Disabled to avoid stale async preview          | **Edit import options**; clear preview-derived data; no cancel |
| After clicking Import      | Wizard state can still look like previous step | **No Back**; progress modal owns running task                  |
| Settings                   | N/A                                            | Unchanged                                                      |

---

## Detailed design

### 0. Wizard setup vs running import boundary

Import UI has two separate phases:

| Phase           | Meaning                                                                  | Allowed navigation                                              |
| --------------- | ------------------------------------------------------------------------ | --------------------------------------------------------------- |
| Setup / preview | User is choosing import options and reviewing files; no copy has started | Back means edit import options; close means cancel import setup |
| Running import  | `executeImport` has returned `importId`; Rust copy is active             | No Back; use Run in background, Pause/Resume, or Cancel import  |

Rules:

- Preview Back is not Cancel. It returns to Configuration and clears preview-derived data so the next preview is regenerated from the edited import options.
- The irreversible boundary is the Import button. After it is clicked, wizard closes and progress modal owns the task.
- Running import UI must never show Back. Going back cannot undo already copied files.
- Cancel before Import cancels setup only. Cancel after Import calls `cancel_import(importId)`.

### 1. Active import session (single-flight)

Store (Pinia or composable), **one** active job:

```ts
{
    importId: string | null;
    phase: "idle" | "running" | "paused" | "completed" | "failed" | "cancelled";
    progress: ImportProgress | null; // last snapshot
    result: ImportResult | null;
    error: unknown;
    startedAt: number;
}
```

Rules:

- `executeImport` only when `phase === "idle"` (or terminal cleared).
- App-level subscribe to `import:progress` / `import:complete` / `import:error` **once** while `phase` is running/paused.
- Subscriptions live in session module — **never** registered into modal-local `cleanupFunctions` that call `removeImportListeners()`.

### 2. Modal API change

Props (conceptual):

| Prop                            | Meaning                                                                                |
| ------------------------------- | -------------------------------------------------------------------------------------- |
| `show`                          | Visible                                                                                |
| `config`                        | Required for **start** only                                                            |
| `mode`: `"start" \| "reattach"` | `start` → execute once; `reattach` → bind to session.importId, hydrate, **no** execute |

Or equivalent: `attachImportId: string | null` — if set, reattach; else start from config.

**Must change** current `watch(config, { immediate: true })` so re-show does not re-execute.

### 3. Dismiss vs cancel

| UI control                               | Behavior                                                            |
| ---------------------------------------- | ------------------------------------------------------------------- |
| X / Esc / backdrop / “Run in background” | `show=false`; **no** `cancelImport`; session stays running/paused   |
| Stop / Cancel button                     | `cancelImport(importId)`; session → cancelled; clear chip after ack |
| Done (after complete)                    | emit complete; clear session                                        |

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

4. Allow back navigation from Preview to Configuration.
5. Rename Preview back action to `Edit import options` / `编辑导入选项`.
6. On Preview → Configuration, clear `preview` step data and preview-only progress/errors.
7. Keep progress modal as the only running-import control surface; no Back after `executeImport`.
8. Add start vs reattach modes; fix watch so reattach never `executeImport`.
9. Dismiss ≠ cancel; allow close while running/paused.
10. Stop wiping session `importId` on `show=false` when dismiss.
11. On modal unmount: clean **local** UI only; never global import unsubs used by session.

### Phase C — Chip + notify

12. Chip in App shell; wire re-open → reattach.
13. Toast on complete/error when modal hidden.
14. i18n: `runInBackground`, `importRunning`, `showProgress`, `importAlreadyRunning`.

### Phase D — Guards + ship

15. Block second wizard complete / execute while active.
16. Tests T1–T2; ROADMAP 0118 → ✅.

---

## Test plan

### T0 — Preconditions

| #    | Action                                | Pass              |
| ---- | ------------------------------------- | ----------------- |
| T0.1 | `cargo test` (import-related)         | Green             |
| T0.2 | Existing `ImportProgressModal` Vitest | Green before edit |

### T1 — Unit (Vitest) — merge gate

| #     | Case                            | Assert                                                                      |
| ----- | ------------------------------- | --------------------------------------------------------------------------- |
| T1.1  | Dismiss while running           | `cancelImport` **not** called; session still has `importId`                 |
| T1.2  | Cancel button                   | `cancelImport` called once; phase cancelled                                 |
| T1.3  | Re-open reattach                | `executeImport` **not** called again                                        |
| T1.4  | Progress while dismissed        | Session progress updates (mock event)                                       |
| T1.5  | Complete while dismissed        | Phase completed; notify helper invoked (mock)                               |
| T1.6  | Second `canStart` while running | false / blocked                                                             |
| T1.7  | Modal unmount                   | Session listeners **still** alive (mock: progress still applied)            |
| T1.8  | Reattach hydrate                | Uses session snapshot; does not require progress map                        |
| T1.9  | Preview → Edit import options   | `executeImport` not called; `cancelImport` not called; preview data cleared |
| T1.10 | Click Import                    | Wizard closes; modal starts in `start` mode; no Back control shown          |

### T2 — Manual (`tauri:dev`)

| #     | Steps                                    | Pass                                                   |
| ----- | ---------------------------------------- | ------------------------------------------------------ |
| T2.1  | Long import (>10s)                       | Modal shows                                            |
| T2.2  | Run in background / X                    | Modal closes; disk still receiving files; chip updates |
| T2.3  | Browse library / open Settings           | Usable; chip alive                                     |
| T2.4  | Click chip                               | Reattach; numbers match; **no** duplicate file set     |
| T2.5  | Pause / Resume from reopened modal       | Honors file-boundary pause                             |
| T2.6  | Cancel from reopened modal               | Stops; chip clears                                     |
| T2.7  | Finish while dismissed                   | Toast; history entry; undo works                       |
| T2.8  | Start second import while first runs     | Blocked + message                                      |
| T2.9  | Settings smoke (Update / General / Scan) | Unchanged; no Import tab                               |
| T2.10 | Edit config after preview                | Re-preview uses new config, no stale files             |

### T3 — One RFC per leftover (do not fail 0118; **no mono**)

| Topic                             | RFC         |
| --------------------------------- | ----------- |
| `checksum`                        | **0119**    |
| `duplicateCount`                  | **0123**    |
| `resumeImport` return             | **0124**    |
| pause `status: "paused"` emit     | **0125**    |
| Quit/crash recovery               | **0120**    |
| Settings Import panel             | **0121**    |
| Legacy importPhotos background UX | **0122**    |
| contract reference same UX        | **0126**    |
| MakerNote / metadata golden       | **0112** ✅ |

---

## Implementation checklist

- [x] A1 Session store + single-flight
- [x] A2 App-level listeners (no global remove on dismiss)
- [x] B1 Modal start vs reattach
- [x] B2 Dismiss ≠ cancel
- [x] B3 Preserve session on dismiss
- [x] C1 Chip + aria-live
- [x] C2 Toast when complete/error while dismissed
- [x] C3 i18n
- [x] D1 Block concurrent start
- [x] T1 green
- [x] T2 signed by user (2026-07-18)
- [x] G15 reset `importError`/`importResult` on `startImport` + terminal close
- [x] G16 `applyProgress` no-op once `phase==="cancelled"`
- [x] G17 static `import { listen } from "@tauri-apps/api/event"`
- [x] G18 `en-GB.json` add `import.status.failed`
- [x] G19 Preview Back = edit import options; clear preview-derived state; no Back after Import
- [x] UI buttons use `BaseButton` icon slot; no stacked icon/text buttons
- [x] ROADMAP / TASK_TRACKING → ✅

---

## Drawbacks / risks

| Risk                | Mitigation                                    |
| ------------------- | --------------------------------------------- |
| Listener leak       | Session clears unlisten on terminal + `clear` |
| Double execute      | G1 + D1                                       |
| Silent complete     | G7 toast                                      |
| User forgets import | Chip                                          |

## Alternatives

- Modal-only: reject.
- Tray-only: defer.
- Put chip only inside `ImportPhotos`: weaker if shell changes — prefer **App.vue**.

## Unresolved (decide in Phase C)

- Chip placement: default **bottom status area**.
- Explicit “Run in background” button vs rely on X only: prefer **both** (button + X = dismiss).

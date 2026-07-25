# RFC 0160 – Retire Queue Health Monitoring Dashboard

## Implementation principle (Photasa / Tauri)

> **Rust rewrite, not TypeScript copy.** Policy: [ROADMAP.md](../../ROADMAP.md).

**Status**: ✅ Implemented (removal)  
**Created**: 2026-07-24  
**Area**: Photasa / Renderer / Scan queue UX  
**Related**: [0003](../completed/0003-unify-watch-to-scan-queue.md), [0046](../completed/0046-scanning-queue-persistence.md), [0136](../completed/0136-tauri-scan-runtime-contract.md), [0144](../completed/0144-tauri-scan-queue-persistence-alignment.md)

---

## Summary

Remove the **队列健康监控** (`QueueHealthDashboard`) feature from Photasa. It duplicated `ScanQueueDialog`, stored no durable data, exposed misleading metrics, and shipped control actions that were never implemented.

**User-facing queue UI remains:** titlebar clock icon → `ScanQueueDialog` (paths, status, actions).

---

## Problem (why it existed)

[RFC 0003](../completed/0003-unify-watch-to-scan-queue.md) listed a future “queue health monitoring dashboard.” A renderer-side dashboard was added (`queue-monitoring-service`, charts, export JSON) to visualize scan queue metrics in dev/ops scenarios.

---

## Why retire (decision)

| Issue | Detail |
|-------|--------|
| **No persistence** | Metrics lived only in RAM (`processingHistory`, `chartData`). Closing the modal or restarting the app erased everything. |
| **Wrong data layer** | Dashboard polled Pinia `scanningStore.queue` (UI projection), not the durable queue. |
| **Fake “memory”** | `memoryUsage` = `queue.length × 350 bytes` estimate — not process memory. |
| **Unimplemented controls** | `pause`, `resume`, `clear-*`, `retry-failed` were TODO stubs (log only). |
| **Duplicate UX** | `ScanQueueDialog` already shows queue size, paths, timestamps, and per-item status for users. |
| **Misleading health** | Processing rate / error rate / ETA inferred from queue snapshot diffs; unstable under RFC 0048 v3 “success removes item immediately” semantics. |
| **Ongoing cost** | 5s `setInterval`, ~470 lines service + dashboard + chart + common types + tests — maintenance with no product owner. |

**Conclusion:** Not worth keeping as product or ops tooling. Real queue truth belongs in Rust + `scanning.json`; user operations belong in `ScanQueueDialog`.

---

## Where queue data actually lives

| Layer | Location | Contents |
|-------|----------|----------|
| **Durable queue** | `~/.photasa/scan/scanning.json` | Written by Rust `scan_queue_*` commands (`photasa-scan` / Tauri IPC) |
| **UI projection** | Pinia `scanningStore.queue` | Synced via 袁天罡 invoke + `matter-sync.yml` |
| **User dialog** | `ScanQueueDialog.vue` | Lists pending/processing/failed items; driven by `scanningFolder` ref |
| ~~Health dashboard~~ | ~~RAM only~~ | **Removed** — never wrote disk |

If future ops need queue health, spec it against **Rust metrics or structured logs**, not a Vue polling dashboard.

---

## Scope of removal

### Deleted

- `apps/photasa/src/services/queue-monitoring-service.ts`
- `apps/photasa/src/services/__tests__/queue-monitoring-service.spec.ts`
- `apps/photasa/src/components/queue-monitoring/` (dashboard, chart, metrics cards, tests)
- `packages/@photasa/common/src/queue-monitoring-types.ts` (+ export from `index.ts`)

### Wired out

- `App.vue` — modal + `queueMonitoringService` lifecycle
- `TitlebarMac.vue` / `TitlebarWinLinux.vue` — Dashboard icon + `openQueueDashboard` emit

### Kept

- `ScanQueueDialog` + titlebar clock icon (`handleOpenScanList`)
- `scanMonitoringService` (idle detection / auto-resume — separate concern)
- Rust scan queue persistence and IPC unchanged

---

## Alternatives considered

| Option | Verdict |
|--------|---------|
| Keep dashboard, hide behind dev flag | Still ships dead controls + fake metrics; not chosen |
| Fix dashboard (real memory, wire controls to Rust) | Large scope; duplicates ops needs better served by Rust/logging later |
| Merge metrics into `ScanQueueDialog` | User dialog should stay simple; no derived “health score” needed |

---

## Verification

- [x] No imports of `queue-monitoring-*` / `QueueMonitoringService` remain
- [x] `pnpm --filter @photasa/photasa run typecheck` passes
- [x] Titlebar opens scan queue via clock icon only
- [ ] Full `test:unit` — unrelated `preference.spec.ts` logger spy failures pre-exist; queue tests removed with feature

---

## Follow-up (out of scope)

- Optional Rust-side queue stats command if CI/ops needs throughput metrics
- Update RFC 0003 checklist line “queue health monitoring dashboard” to point here as **retired**

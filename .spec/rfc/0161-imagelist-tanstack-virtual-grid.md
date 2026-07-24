# RFC 0161 – ImageList TanStack Virtual Grid Consolidation

## Implementation principle (Photasa / Tauri)

> **Renderer-only.** No Rust changes. Policy: [ROADMAP.md](../../ROADMAP.md).

**Status**: ⏳ Draft  
**Created**: 2026-07-24  
**Area**: Photasa / Renderer / `ImageList` / `@tanstack/vue-virtual`  
**Related**: [0011](../completed/0011-imagelist-file-count-display.md), [0148](../completed/0148-tauri-rebuild-thumbnail-ui-contract.md), `VirtualizedGrid.vue`, `VirtualList.vue`

---

## Summary

`ImageList.vue` **already** virtualizes rows with `@tanstack/vue-virtual` (`useVirtualizer`), but the logic is **inline, duplicated, and brittle**. This RFC consolidates grid virtualization into one **Base** primitive and refactors `ImageList` to use it—same TanStack dependency (`^3.13.12`), clearer contracts, measurable perf wins on large folders.

**Not in scope:** changing thumbnail IPC, folder config shape, or Rust scan pipeline.

---

## Current state (as-built)

| Piece | Role |
|-------|------|
| `ImageList.vue` | Inline `useVirtualizer` — virtualizes **rows** (`groupImagesByColumns` → `rows: Image[][]`) |
| `VirtualizedGrid.vue` | Generic row virtualizer + slot — **exported, never used by ImageList** |
| `VirtualList.vue` | 1D list virtualizer — used by `BaseTree` |
| `ImageListHelper.ts` | `computeColumns`, `groupImagesByColumns`, `toImageList` — **not** virtualizer-aware |

### Data flow (unchanged by this RFC)

```
currentFolder + currentFolderConfig (Pinia)
  → toImageList() → card.images[]
  → groupImagesByColumns(images, columns) → rows[][]
  → TanStack virtualizer renders visible rows only
```

**Persistence:** images come from `.photasa.json` / folder config via Rust; virtualizer holds **no** durable state—only scroll offset in DOM for the session.

---

## Problems

1. **Duplicate implementations** — `ImageList` reimplements what `VirtualizedGrid` already does (absolute rows, `overscan`, `measure()` on resize).
2. **Fragile virtualizer lifecycle** — `initializeVirtualizer()` mutates `options.count`, forces `scrollTop = 0`, called from **four** watchers + debounced resize; easy to regress (historical flicker fixes in CHANGELOG).
3. **Stale `estimateSize`** — `useVirtualizer({ estimateSize: () => rowHeight.value })` at setup; thumbnail size changes rely on manual `measure()` instead of reactive options.
4. **Full subtree remount** — template `:key="\`virtualizer-${card.title}-${card.images.length}\`"` destroys virtualizer state on every count change.
5. **Fixed row height assumption** — no `measureElement`; OK today (square thumbnails) but blocks future variable-aspect rows.
6. **No scroll API** — `VirtualList` exposes `scrollToIndex`; `ImageList` cannot restore scroll after folder switch or support keyboard focus scroll-into-view.
7. **Test gap** — `ImageListHelper.test.ts` only; no virtualizer contract tests for grid behavior.

`docs/DEV_GUIDE.md` states “无需新 RFC” — **outdated**; that note predates consolidation work and duplicate-component debt.

---

## Goals

1. **Single grid virtualizer primitive** for Photasa (`BaseVirtualGrid` or hardened `VirtualizedGrid`).
2. **`ImageList` thin** — header, empty/loading, context menus, preview drawer; grid defers to primitive.
3. **Reactive row geometry** — column count + row height drive virtualizer options without imperative `initializeVirtualizer`.
4. **Stable keys** — remove virtualizer wrapper remount key; reset scroll only on **folder path** change.
5. **Expose `scrollToImageIndex(index)`** for preview/lightbox and future keyboard nav.
6. **Tests** — primitive unit tests + one `ImageList` integration test with mocked rows.

## Non-goals

- Column masonry / variable-height tiles (future RFC if needed).
- Windowing thumbnails in Rust or prefetch pipeline changes.
- Replacing `BaseTree`’s `VirtualList` (1D tree is a different shape).

---

## Decision

### Approach A (recommended): Harden `VirtualizedGrid` → use from `ImageList`

**原理：** Row-based virtualization matches current `groupImagesByColumns` output. One component owns TanStack wiring; `ImageList` passes `rows`, `rowHeight`, scroll parent ref.

**Steps:**

1. **Extend `VirtualizedGrid.vue`**
   - Accept **external scroll element** via prop or `defineExpose` + parent ref (match `ImageList`’s `flex-1 overflow-auto` container — avoid fixed `containerHeight: 400px` default).
   - Reactive `count`, `estimateSize`, `overscan` via `computed` passed into `useVirtualizer` options (TanStack v3 pattern).
   - Optional `scrollToRow(index)` / `scrollToOffset` exposed like `VirtualList.vue`.
   - Slot props: `{ item, rowIndex, colIndex }` (already partial).

2. **Refactor `ImageList.vue`**
   - Delete inline `useVirtualizer`, `initializeVirtualizer`, debounced resize virtualizer path.
   - Keep `computeColumns` / `rows` computed in `ImageListHelper` or colocated composable `useImageGridRows.ts`.
   - Map `openPreview(rowIdx, colIdx)` unchanged.
   - On `currentFolder` change: call `scrollToOffset(0)` only.

3. **Tests**
   - `VirtualizedGrid.test.ts` — renders N rows, only visible row DOM nodes (happy-dom + stub items).
   - Extend or add `ImageList.virtual.test.ts` — folder switch resets scroll, thumbnail size change updates row height without throw.

4. **Docs**
   - Update `DEV_GUIDE.md` §图片列表虚拟化 → point to RFC 0161.

**风险：** Scroll parent nesting (`imageListRef` vs grid internal ref) — spike first with one integration test.

### Approach B: Composable-only (`useImageGridVirtualizer.ts`)

Extract `useVirtualizer` into composable; `ImageList` keeps template. Less template churn, **still duplicates** grid layout markup vs `VirtualizedGrid`.

**推荐 A** — eliminates duplicate component, aligns with Base-prefix UI layer.

---

## API sketch (primitive)

```ts
// VirtualizedGrid.vue (extended)
interface VirtualizedGridProps<T> {
  rows: T[][];
  rowHeight: number;
  gap?: number;
  overscan?: number;
  scrollElementRef?: Ref<HTMLElement | null>; // parent overflow container
}

// expose
scrollToRow(rowIndex: number, align?: "start" | "center");
scrollToOffset(offset: number);
measure();
```

```vue
<!-- ImageList.vue (target) -->
<div ref="imageListRef" class="flex-1 min-h-0 overflow-auto ...">
  <VirtualizedGrid
    v-if="rows.length"
    :rows="rows"
    :row-height="rowHeight"
    :scroll-element-ref="imageListRef"
    @item-click="onGridItemClick"
  >
    <template #item="{ item, rowIndex, colIndex }">
      <!-- BaseContextMenu + BaseImage unchanged -->
    </template>
  </VirtualizedGrid>
</div>
```

---

## Acceptance criteria

- [ ] `ImageList` contains **no** direct `useVirtualizer` import.
- [ ] `VirtualizedGrid` used by `ImageList`; fixed-height default removed or overridden for flex layouts.
- [ ] Folder switch scrolls to top; same-folder thumbnail resize does **not** remount entire virtualizer subtree.
- [ ] 10k-image folder: DOM row count ≪ total rows (manual or test with `overscan`).
- [ ] `pnpm --filter @photasa/photasa run typecheck` + new unit tests pass.
- [ ] Preview open (`openPreview`) still resolves correct global index `rowIdx * columns + colIdx`.

---

## Verification plan

```bash
pnpm --filter @photasa/photasa exec vitest run \
  src/components/ui/__tests__/VirtualizedGrid.test.ts \
  src/components/__tests__/ImageList.virtual.test.ts
pnpm --filter @photasa/photasa run typecheck
```

Manual: 5k+ photo folder — scroll smooth, memory stable in Activity Monitor; resize window changes column count without blank grid.

---

## Alternatives rejected

| Option | Why not |
|--------|---------|
| No virtualization (render all) | Breaks large libraries; already solved |
| `vue-virtual-scroller` | Second dependency; TanStack already in tree |
| Cell-level (2D) virtualizer | Overkill; row grouping matches square grid |
| Keep status quo | Duplicate code + watcher sprawl; DEV_GUIDE already wrong |

---

## Rollout

1. Implement primitive + tests (no `ImageList` switch).
2. Switch `ImageList` behind no feature flag (behavioral parity).
3. Remove dead virtualizer code from `ImageList`.
4. Mark RFC ✅ Implemented; update ROADMAP / TASK_TRACKING.

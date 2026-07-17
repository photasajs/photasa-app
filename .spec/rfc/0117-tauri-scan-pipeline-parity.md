# RFC 0117 – Tauri scan pipeline parity (strategy decision, per-file gating, serial thumbnails, subdir recursion)

> **Title fix (review):** "async thumbnails" was wrong — Electron fresh scan is **serial
> per file** (`concatMap` + `await addTask`). Renamed to "serial thumbnails". See §4.

## Implementation principle (Photasa / Tauri)

> **Rust rewrite, not TypeScript copy.** Policy: [./TAURI_RUST_REWRITE_POLICY.md](./TAURI_RUST_REWRITE_POLICY.md).

- The Electron `@photasa/scan` pipeline is the **behavioral contract**, not a library to import or translate line-by-line.
- "Parity" = same skip/process decisions, same events, same on-disk JSON, same user-visible outcome — **not** the same code.
- This RFC fixes a **regression**: the current `scan_runner.rs` collapsed the multi-stage Electron pipeline into a single flat synchronous loop, dropping the strategy decision, per-file gating, resume sub-path, and inlining blocking thumbnail generation.
- **All tables below are transcribed from the TS source** (`scan-photos.ts`, `scan-helpers.ts`, `strategy/scan-strategy.ts`, `cache/incremental-cache.ts`, `cache/folder-cache-manager.ts`, `worker/directory-scan-progress.ts`, `scan-cleanup.ts`, `utils/path-utils.ts`, `@photasa/common/utils.ts`). They are the literal spec for the Rust port; nothing is summarized away.

| Field | Value |
|-------|-------|
| **Status** | ✅ Implemented (2026-06-06) — BUG① subdir SKIP-only + `current` gated; BUG② SKIP progress `(N,N)`; 52 `cargo test scan_` pass |
| **Created** | 2026-06-09 |
| **Last updated** | 2026-06-06 |
| **Area** | Tauri / Scan |
| **Depends on** | [0105](0105-tauri-scan-incremental-cache.md), [0068](0068-tauri-scan-service-migration.md), [0111](0111-tauri-scan-notify-status-bridge.md), [0116](0116-tauri-photasa-config-thumbnail-parity.md), [0069](0069-tauri-thumbnail-service-migration.md) |
| **Supersedes scope of** | the `scan_runner.rs` processing-loop portion of [0105](0105-tauri-scan-incremental-cache.md) (cache file format unchanged) |

---

## Problem

The Electron scan is a **layered pipeline**. The Tauri rewrite in `scan_runner.rs`
shipped only the discovery + cache layer (RFC 0105) and **reinvented** the rest as a
flat loop, diverging from the Electron contract:

| # | Electron contract (`@photasa/scan`) | Current `scan_runner.rs` | Symptom |
|---|--------------------------------------|---------------------------|---------|
| 1 | `decideScanStrategy` → `SKIP` or `FULL` per directory | No strategy decision; **always** walks + processes every file | Re-scans already-indexed folders on every open; ignores valid `.photasa.json` |
| 2 | On `SKIP`: `restoreCachedFiles` re-emits photoList from `.photasa.json`, **then** recurses subdirs | No skip path; no cached re-emit | Cannot short-circuit unchanged folders like Electron |
| 3 | `shouldProcessFile` gates each file: rescan→always, missing config→yes, already in photoList→**no** | Every discovered file written to config + thumbnailed | Redundant `.photasa.json` writes + thumbnail work every scan |
| 4 | `processPhotoFile` dispatches thumbnails to a **WorkerPool** (decode on a worker thread); `concatMap` + `await addTask` make fresh-scan **serial per file**, off the main/IPC thread | `create_thumbnail_sync` runs in the scan's `spawn_blocking` loop (also serial, also off main thread) | Closest to parity; residual issue is ordering/await coupling and no pool reuse, **not** "blocks the main thread" (see #4 below — narrower than first stated) |
| 5 | `scanSubdirectories` re-applies the pipeline **per child dir**; `shouldScanOneLevel` (action `current`) limits depth to 0 | One flat `walkdir(recursive)`; depth = single bool | Per-directory skip decisions lost; `current` depth-0 semantics lost |
| 6 | Resume sub-path inside FULL: `cache.inProgress && processedFiles.length>0` → diff all files vs processed, process only the rest | Cache resume re-processes from `pendingFiles` only; no full-list diff | Resume set can diverge from Electron after partial scans |
| 7 | `IncrementalCacheManager` **batched** writes (dynamic batch, 5s timer) | `scan_cache.save()` on **every** file | More disk I/O; different write cadence (cosmetic, but a contract delta) |

---

## Electron reference (source of truth)

### Module map

| TS module | Functions ported by this RFC |
|-----------|------------------------------|
| `scan-photos.ts` | `walkthroughPhotosInFolder`, `scanPhotos` (skip / full / resume branches + fallback), `scanSubdirectories`, `processMediaFile`, `processFileList`, `extendedCleanup` |
| `scan-helpers.ts` | `validateScanParams`, `shouldCreateThumbnail`, `buildThumbnailRequest`, `processPhotoFile`, `restoreCachedFiles` (`isDirectoryScan` = `operationType != "file"`, inline; `createSubscriptionHandlers` is RxJS plumbing, N/A in Rust) |
| `strategy/scan-strategy.ts` | `shouldScanOneLevel`, `shouldProcessFile`, `decideScanStrategy` |
| `cache/incremental-cache.ts` | `IncrementalCacheManager` (init/resume, batch, mark complete) |
| `cache/folder-cache-manager.ts` | `computeFolderHash`, `createDefaultCache`; **dead:** `getCacheInfo`, `compareHashesAndDecide` (see note) |
| `worker/directory-scan-progress.ts` | `mergeDirectoryScanProgressWithCache`, `buildDirectoryScanProgressMessage` |
| `utils/path-utils.ts` | `buildThumbnailPath`, `isHiddenFile` |
| `@photasa/common/utils.ts` | `shouldIgnorePhotasaPath`, `PHOTASA_ORIGINALS` |

### ⚠️ Accuracy note: strategy is **SKIP / FULL only**

`decideScanStrategy` **never returns `INCREMENTAL`**. In `scan-strategy.ts` the imports
`getCacheInfo` and `compareHashesAndDecide` are **commented out** (lines 20–21); the live
function only branches to `SKIP` or `FULL`. `ScanStrategy.INCREMENTAL` and
`compareHashesAndDecide` exist in `folder-cache-manager.ts` but are **dead code** — not
reachable from `scanPhotos`.

**Do not port a live 3-way decision.** Port SKIP/FULL only. The behavior people call
"incremental" is actually the **resume sub-path inside FULL** (#6), driven by
`cache.inProgress`, not by hash compare. `compute_folder_hash` is still ported because
`decideScanStrategy` calls it to distinguish "empty config + folder has media" (FULL)
from "empty config + no media" (SKIP).

### `decideScanStrategy` (exact — scan-strategy.ts)

```
if action == "rescan"                        -> FULL  ("强制重新扫描")
if .photasa.json missing                     -> FULL  ("配置文件不存在")
read getPhotasaConfig(folder):
  on read error                              -> FULL  ("配置文件读取失败")
  if photoList empty:
    h = computeFolderHash(folder)
    if h != ""  (folder has media)           -> FULL  ("配置文件为空但文件夹有照片")
    else        (no media)                   -> SKIP  ("配置文件为空且文件夹无照片")
  if photoList non-empty                      -> SKIP  ("配置文件存在且有效，无需重新扫描")
on outer exception                            -> FULL  ("决策失败，使用安全的完整扫描")
```

### `shouldProcessFile` (exact — scan-strategy.ts)

```
if action == "rescan"                        -> true
dir = dirname(filePath); config = dir + "/.photasa.json"
if config missing                            -> true
try getPhotasaConfig(dir):
  return !photoList.some(p => p.path == basename(filePath))
catch                                        -> true   (read failure ⇒ process)
```

### `shouldScanOneLevel` (exact)

```
shouldScanOneLevel(action) = (action == "current")   // depthLimit 0; else -1 (recurse)
```

### `validateScanParams` (exact — scan-helpers.ts; FULL list)

```
!path           -> invalid "扫描路径不能为空"
!action         -> invalid "扫描动作不能为空"
thumbnailSize<=0 / missing -> invalid "缩略图尺寸必须大于0"
!exists(path)   -> invalid "路径不存在: {path}"
operationType=="file"      && !isFile(path)      -> invalid "期望文件但得到目录"
operationType=="directory" && !isDirectory(path) -> invalid "期望目录但得到文件"
stat throw      -> invalid "路径不存在或无法访问: {path}"
else            -> valid
```

### `walkthroughPhotosInFolder` (exact — scan-photos.ts)

```
if !exists(path)                       -> error "Path does not exist"
stats = stat(path)
single-file branch  (operationType=="file" OR (isFile && operationType!="directory")):
  if isVideo|isImage  -> emit { path, thumbnail=buildThumbnailPath(path), isImage, isVideo, isDirectory:false }
  else                -> skip (debug log)
  complete
directory branch:
  if !isDirectory     -> error "Expected directory but got file"
  depthLimit = shouldScanOneLevel(action) ? 0 : -1
  filter(item) = !shouldIgnorePhotasaPath(item) && !isHiddenFile(item)
  for each klaw item where isVideo|isImage:
    emit { path, thumbnail=buildThumbnailPath, isImage, isVideo, isDirectory: item.stats.isDirectory() }
```

### `shouldIgnorePhotasaPath` (exact — @photasa/common/utils.ts; substring match, 6 terms)

```
ignore if path contains ANY of:
  ".photasaoriginals" | ".picasaoriginals" | ".photasaoriginal" |
  ".picasaoriginal"   | ".photasa.json"    | ".AppleDouble"
```

`isHiddenFile(file) = basename(file).startsWith(".")`.

### `scanPhotos` directory branch (exact control flow — scan-photos.ts)

```
validate -> on fail: error
if isDirectoryScan:
  decision = decideScanStrategy(path, action)
  if decision == SKIP:
    cacheManager.initialize(); cacheManager.markScanComplete()
    restoreCachedFiles(path, subscriber)        // re-emit photoList (no complete here)
    scanSubdirectories(path)                     // recurse even on skip
    subscriber.complete()                        // caller owns lifecycle
  else (FULL):
    cacheManager.initialize() -> cache
    if cache.inProgress && cache.processedFiles.length>0:   // RESUME sub-path (#6)
      allFiles = collect walkthroughPhotosInFolder(path)
      unprocessed = allFiles.filter(f => !cacheManager.isFileProcessed(f))
      cacheManager.setPendingFiles(unprocessed.map(path))
      processFileList(unprocessed, ...)          // per-file gate + record + complete
    else:                                        // fresh FULL scan
      walkthrough |> concatMap(async action:
        shouldProcess = shouldProcessFile(action.path, scan.action)
        if shouldProcess: cacheManager.recordFileProcessed(action)
        processPhotoFile(action, scan, shouldProcess, pool))
      on complete: cacheManager.markScanComplete(); wait 50ms†; subscriber.complete()
    on cacheManager.initialize() error:          // FALLBACK
      degrade to traditional scan (walkthrough |> processPhotoFile), NO incremental cache
else (single file):
  walkthrough |> processPhotoFile(shouldProcessFile gate)
```

> **`concatMap` = sequential.** The fresh-FULL pipe processes one file at a time
> (`concatMap` awaits each inner async, which `await`s `pool.addTask`). So fresh scan is
> **serial per file**; the pool's multiple workers are not used concurrently by this path.
> **Order matters and differs between the two FULL sub-paths:**
> - **Fresh scan**: `recordFileProcessed` **before** `processPhotoFile` (record-then-process).
> - **`processFileList` (resume)**: `processPhotoFile` **before** `recordFileProcessed`,
>   and `subscriber.next(file)` is emitted **unconditionally** (even when not processed).

### `processFileList` (exact — scan-photos.ts; resume path)

```
for file in files:
  shouldProcess = shouldProcessFile(file.path, scan.action)
  if shouldProcess:
    processPhotoFile(file, scan, shouldProcess, pool)   // process FIRST
    cacheManager.recordFileProcessed(file)              // record AFTER
  subscriber.next(file)                                 // ALWAYS, even if skipped
  (per-file error logged, loop continues)
markScanComplete(); wait 50ms†; subscriber.complete()
```

> **† `wait 50ms` and the fresh-vs-resume order flip are TS artifacts** — see "TS artifacts
> that are bugs, not contract". Rust drops the sleep (synchronous writes) and uses one
> process→record order for both paths.

### `processPhotoFile` (exact — scan-helpers.ts)

```
if !shouldProcess: return action
if shouldCreateThumbnail(action.thumbnail, scan.action):   // !exists(thumb) || action=="rescan"
  req = buildThumbnailRequest(action, scan)
  if pool: pool.addTask("create", req)  else: debug "skip (no pool)"
addToPhotasaConfig({ queueId:0, paths:[action.path] })
return action
```

### `buildThumbnailRequest` (exact)

```
{ path, thumbnail, width:thumbnailSize, height:thumbnailSize,
  withoutEnlargement:true, preview:thumbnail, always: scan.action=="rescan" }
```

### `processMediaFile` (exact — scan-photos.ts; per-action branches incl. delete)

```
thumbnailPath = buildThumbnailPath(filePath)
action "scan":
  if !shouldProcessFile(file, "scan"): return
  if !exists(thumbnailPath) && pool: pool.addTask("create", {...,always:false})
  addToPhotasaConfig({queueId:0, paths:[file]})
action "rescan":
  if pool: pool.addTask("create", {...,always:true})
  addToPhotasaConfig({queueId:0, paths:[file]})
action "current":            // DELETE
  if exists(thumbnailPath): unlink(thumbnailPath)
  removeFromPhotoList(file)
default: warn "未知的扫描操作"
```

### `restoreCachedFiles` (exact — scan-helpers.ts)

```
config = path + "/.photasa.json"
if missing                          -> warn, return (NO complete)
read+JSON.parse; on parse error     -> error log, warn "损坏将触发完整重扫", return (NO complete)
if !photoList || !Array             -> warn, return (NO complete)
for photo in photoList where photo && photo.path:
  fullPath = join(folder, photo.path)         // photo.path is filename
  emit { path:fullPath, thumbnail: photo.thumbnail || buildThumbnailPath(fullPath),
         isImage: photo.isImage||false, isVideo: photo.isVideo||false, isDirectory:false }
// never calls subscriber.complete(); caller owns lifecycle
on exception -> subscriber.error
```

> **`isImage` field gap.** Rust `PhotoEntry` (`photasa_config.rs`) stores `path`,
> `thumbnail`, `is_video`, `history` — **no `isImage`** (matches what `addToPhotoList`
> writes; TS reads `photo.isImage` which is normally `undefined` → `false`). For the
> re-emitted event, `is_video` comes from the entry; `is_image` should be derived
> (`is_image_file(path)` / `!is_video && media`) so the `picasa:find-photo` payload still
> carries both flags. Do **not** add `isImage` to the on-disk schema (RFC 0116 owns it).

### `scanSubdirectories` (exact — scan-photos.ts)

```
entries = readdir(path, withFileTypes)
subdirs = entries.filter(isDirectory)
                 .filter(e => !shouldIgnorePhotasaPath(e.name))
                 .filter(e => !isHiddenFile(e.name))
for subdir in subdirs:
  subdirScan = {...scan, path: join(path, subdir.name)}
  await scanPhotos(subdirScan)   // re-enter full pipeline per child (own strategy decision)
  // child error is logged and SKIPPED, does not abort siblings
```

> **⚠️ Read the next section before implementing this block.** `scanSubdirectories` is
> called from **exactly one site — the SKIP branch**. Do **not** wire it into FULL.

### 🔴 Recursion model — `scanSubdirectories` runs on **SKIP only**, NOT FULL

This is the single most error-prone part. In `scan-photos.ts`, `scanSubdirectories` is
called from **exactly one place — line 200, inside the SKIP branch.** The FULL branch
does **not** call it.

| Branch | How descendants are covered |
|--------|------------------------------|
| **FULL** | `walkthroughPhotosInFolder` uses `klaw` with `depthLimit: -1` (action `current` → 0). It is **already fully recursive** — one flat pass yields every descendant media file. **No** per-subdir re-entry. |
| **SKIP** | The parent emitted cached files but processed nothing. Children may be unindexed, so `scanSubdirectories` re-enters `scanPhotos` per child — each child makes its **own** SKIP/FULL decision. |

**Implication for Rust:** subdir re-entry must be **gated on the SKIP branch**, not run
unconditionally. Running it on FULL **double-processes** every nested file (recursive
walkthrough *plus* per-subdir re-walk) — N-deep files processed once per ancestor level —
and emits a spurious `complete` per subdir.

> **✅ Fixed (2026-06-10).** `scan_directory_at` now gates subdir re-entry through the pure
> `should_recurse_subdirs(strategy, action) = (strategy == SKIP && !should_scan_one_level)`.
> FULL no longer recurses (the recursive `walkthrough` already covers the subtree); `current`
> never recurses in any branch. Pinned by `full_scan_does_not_recurse_subdirs`,
> `skip_scan_recurses_subdirs`, `current_action_never_recurses`.

### `complete` event: `paths` and cardinality (verified)

- **`complete.paths` is always `[]`** in both Electron and Rust. Electron `foundPaths`
  (`scan-worker.ts`) only pushes `action.isDirectory` items, but `walkthrough`'s
  `isVideo||isImage` filter (Rust: `classify_media`) **never emits a directory** → nothing
  is ever pushed. The renderer's `computeScannedFilePaths` (`yuantiangang/utils.ts`) handles
  this: empty `paths` ⇒ fall back to `action.path` when `action.isDirectory`. The folder
  tree is driven by **`complete.action.path`**, not by `paths`.
  - **Do not "fix" `found_paths` by populating it** — empty is correct parity. The Rust
    `found_paths` local in `scan_runner.rs` is structurally always-empty; drop it or comment
    it as intentional.
- **Cardinality**: Rust emits one `complete` **per directory** (`scan_directory_at`
  recurses). Electron's SKIP path also re-enters `scanPhotos` per child (own subscriber →
  own `complete`), so per-directory `complete` is acceptable parity. After the
  recursion-model fix (subdir re-entry SKIP-only): FULL emits one `complete` for the whole
  subtree (single recursive `walkthrough`); SKIP emits one per visited directory. **Pin with
  a test** (see Testing).

### `IncrementalCacheManager` (exact constants — incremental-cache.ts)

```
UPDATE_INTERVAL = 5000 ms ; MIN_BATCH_SIZE = 20 ; MAX_BATCH_SIZE = 200
dynamic batch: totalFiles<100 -> 20 ; <1000 -> 50 ; else -> 200
recordFileProcessed(file):
  push basename(file.path) to processedFiles   // BASENAME only
  fileCount = processedFiles.length ; lastUpdate = now ; processedSinceLastUpdate++
  if file.thumbnail: thumbnailsGenerated++
  if processedSinceLastUpdate >= dynamicBatch: flush now
  else if no timer: set 5s flush timer
isFileProcessed(filePath) = processedFiles.includes(basename(filePath))
setPendingFiles(files): pendingFiles=files; totalFiles=processed.length+files.length; save
markScanComplete: inProgress=false; scanCompleted=true; scanDuration; lastScan=now;
                  pendingFiles=[]; flush; save
save: atomic write to .photasa-folder.json (tmp + rename, copy+delete fallback, plain-write fallback)
```

### Progress event shape (exact — directory-scan-progress.ts)

```
mergeDirectoryScanProgressWithCache(scanRoot, processedFallback):
  read scanRoot + "/.photasa-folder.json"
  if processedFiles is array:
    processed = processedFiles.length
    total     = processed + (pendingFiles?.length || 0)
  else: { processed: processedFallback, total: 0 }

buildDirectoryScanProgressMessage:
  actPath = action?.path || scanFallbackPath
  isDir   = action?.isDirectory || false
  currentFile = (action?.path && !action?.isDirectory) ? basename(action.path) : undefined
  -> { type:"progress", requestId, action:{path:actPath,isDirectory:isDir}, progress, currentFile }
```

> Current Rust `emit_progress` sets `currentFile` from basename unconditionally — must
> follow the `action.path && !isDirectory` rule above to match.

### `scan-cleanup.ts` (`extendedCleanup`) — ported to `scan_cleanup.rs`, **no live caller**

Note: `extendedCleanup` / `cleanupInvalidCaches` are **exported from `@photasa/scan` but
called by nobody** in either app — not `apps/desktop` (Electron), not Photasa
(renderer/Rust). It is dead export surface.

It was nevertheless ported to `scan_cleanup.rs` (with unit tests) for full spec parity.
That is **harmless but inert**: until something invokes it (startup sweep? schedule?
manual?), the 7-day `.photasa-folder.json` GC does not run. **Open item:** decide whether
to wire a trigger (own RFC) or leave the function unwired. The remove rules (age > 7d,
missing dir, missing `version`/`folderHash`, unparseable) match TS.

---

## TS artifacts that are bugs, not contract (do NOT port verbatim)

> Parity = same **observable** behavior (events, disk, decisions), not cloning Node-specific
> workarounds. Three TS details are accidental, not designed — port the **intent**, drop the
> mechanism:

| TS artifact | Why it exists in TS | Rust action |
|-------------|---------------------|-------------|
| **`await sleep(50ms)` before `complete`** (`scanPhotos`, `processFileList`) | Band-aid for `addToPhotasaConfig`'s **async batched** queue writer — give pending writes time to flush before signaling done | Rust `add_photo_to_folder_list` writes **synchronously**. No race ⇒ **no sleep**. Emit `complete` after the loop. |
| **Per-file progress re-reads `.photasa-folder.json` from disk** (`mergeDirectoryScanProgressWithCache`) | Progress builder lives in a separate module with **no handle to the cache object**, so it reads counts back off disk | Rust holds the cache in memory ⇒ compute `processed/total` from the **in-memory cache**; do not write-then-read-back per file. Same numbers, no disk thrash. |
| **Two opposite record/process orders** (fresh: record→process; resume: process→record + unconditional emit) | Two code paths written at different times; the difference is **not designed** — it only matters if `record`/`process` throws | Pick **one** order in Rust (recommend **process→record**: don't mark a file processed until its config/thumbnail actually ran) and apply it to both paths. Document the choice. Observable output (events, final cache) is identical on the success path. |

Everything else in the tables is real contract and must match.

---

## Decision

Implement the **full Electron scan pipeline in Rust**, reproducing each **observable**
decision stage **as tabulated above**, minus the three TS artifacts called out directly
above. Keep RFC 0105 `.photasa-folder.json` format and RFC 0116 config / thumbnail-path
contract unchanged. No `@photasa/scan` import; no line-by-line translation — the tables
are the spec.

### Phasing (ship each green — Kent Beck)

Land in independently-testable steps, **not** one big-bang rewrite:

1. `scan_strategy.rs` (pure: `decide_scan_strategy` / `should_process_file` /
   `should_scan_one_level` / `compute_folder_hash`) + unit tests.
2. SKIP branch (`restore_cached_files` + recurse) + test: cached list re-emitted.
3. FULL fresh branch (gate + in-memory progress + thumbnail) + test.
4. FULL resume branch (inProgress diff) + test.
5. `scan_subdirectories` (per-dir re-entry) + test: child error skipped.
6. File-scan `processMediaFile` incl. `current`=delete + test.
7. `extendedCleanup` GC — **separately schedulable** (see scope note).

### 1. Strategy layer (`scan_strategy.rs`)

- `should_scan_one_level(action)`, `should_process_file(file, action)`,
  `compute_folder_hash(folder)`, `decide_scan_strategy(folder, action) -> {strategy, reason}`.
- `ScanStrategy { Skip, Full }` **only** (no `Incremental` — it is dead code in TS).
- `should_process_file` reads `.photasa.json` via `photasa_config::read_config_sync`.

### 2. Validation (`scan_runner.rs`)

- `validate_scan_params` reproducing the full `validateScanParams` list; on failure emit
  the existing `error` event payload.

### 3. Orchestration (`scan_runner.rs`, rewritten to the `scanPhotos` control flow)

- **SKIP**: `restore_cached_files` re-emits photoList from `.photasa.json` (exact
  `restoreCachedFiles` mapping), then `scan_subdirectories` (unless `current`), then complete.
- **FULL / fresh**: discovery → per file `should_process_file` gate → if process:
  thumbnail + `add_photo_to_folder_list`, **then** `record_file_processed` (unified
  process→record order, see artifacts table) → progress event from **in-memory** cache.
  Cache writes batched. **No 50ms sleep** before `complete`.
- **FULL / resume** (`cache.in_progress && !processed.is_empty()`): collect all files,
  diff vs `is_file_processed`, `set_pending_files`, then for each: gate → process → record,
  emit the file. Same order as fresh (TS's opposite order is an artifact, not contract).
- **Fallback**: cache init failure → traditional scan (walk + process, no incremental cache).
- **File scan**: `processMediaFile` per-action branches incl. `current` = delete thumbnail +
  `remove_from_photo_list`.

### 4. Thumbnail dispatch (fix #4 — decided: serial)

- **Decision: serial, off the main/IPC thread.** Electron fresh scan is serial per file
  (`concatMap` + `await addTask`); the current Rust `create_thumbnail_sync` inside the
  scan `spawn_blocking` **already matches** (serial, off the main thread). Keep it.
- **No pool concurrency in this RFC.** It is not Electron's behavior, and it introduces
  out-of-order side effects (cache/config sequencing). If speed becomes a problem, open a
  **separate** RFC for a bounded decode pool — do not smuggle it in here.
- **Contract preserved**: gate `shouldCreateThumbnail` (`!exists(thumb) || action=="rescan"`),
  `width/height=thumbnailSize`, `withoutEnlargement=true`, `preview=thumbnail`,
  `always=(action=="rescan")`, target = `absolute_thumbnail_path_for_source` (RFC 0116).

### 5. Subdirectory recursion (fix #5) — **SKIP-only**

- `scan_subdirectories`: enumerate child dirs, filter `shouldIgnorePhotasaPath` (6-term
  substring) + `isHiddenFile`, re-enter the pipeline per child (own strategy decision).
  Child error logged + skipped, never aborts siblings.
- **Gate: only on the SKIP branch** (see "Recursion model"). FULL already covers the whole
  subtree via the recursive `walkthrough`; re-entering subdirs on FULL double-processes.
- Honor `current`: no subdir recursion when `action == "current"`.
- **Status: ✅ fixed (2026-06-10)** via `should_recurse_subdirs` — recurses only on SKIP,
  never on FULL, never on `current`.

### 6. Progress event shape (fix the `currentFile` drift)

- `currentFile` set only when `action.path && !isDirectory`.
- `processed/total` computed from the **in-memory** cache (`processed_files.len()`,
  `+ pending_files.len()`) — same numbers `mergeDirectoryScanProgressWithCache` reads off
  disk, without the per-file write-then-read-back (artifacts table).

### 7. Batched cache writes (fix #7)

- `record_file_processed` stores **basename**, increments `thumbnailsGenerated` when a
  thumbnail was requested, and flushes on dynamic batch (`<100→20`, `<1000→50`, else 200)
  or a 5s timer — not on every file. Final state flushed on `mark_scan_complete`.

### Out of scope (unchanged contracts)

- `.photasa-folder.json` schema + resume format — **RFC 0105** (kept).
- `.photasa.json` thumbnail path / `add_photo_to_folder_list` / `fix_config_sync` —
  **RFC 0116** (kept; no post-rescan `fix_config_sync`).
- `notify:status` payload — **RFC 0111** (`scan_notify.rs`, kept).
- Thumbnail decode engine (image/HEIC/ffmpeg/placeholder) — **RFC 0069** (kept).
- `pool-manager.ts` is a **stub** in TS (throws); not ported — the real pool was Electron
  `?nodeWorker`; Rust supplies its own bounded pool (#4).

---

## Impact

- Indexed folders hit the **SKIP** path: no re-scan, no redundant thumbnail/config writes —
  the biggest win; only changed/new folders pay scan cost.
- Thumbnail decode stays serial + off the main/IPC thread (already true); no behavior change
  there, just correct gating (`shouldCreateThumbnail`).
- Per-directory strategy + `current` depth + resume diff restore Electron semantics.
- Fewer disk ops than the current build: in-memory progress (no per-file cache re-read) and
  batched cache writes (no per-file save).
- On-disk formats and events stay identical to RFC 0105/0111/0116 — store/UI unchanged.

---

## Implementation checklist

- [x] `scan_strategy.rs`: `decide_scan_strategy` (SKIP/FULL), `should_process_file`,
      `should_scan_one_level`, `compute_folder_hash` (+ unit tests, exact tables)
- [x] `scan_runner.rs`: `validate_scan_params` (full list)
- [x] `scan_runner.rs`: SKIP branch (`restore_cached_files` exact mapping + subdir recurse)
- [x] `scan_runner.rs`: FULL fresh branch (per-file gate + batched cache + serial thumb)
- [x] `scan_runner.rs`: FULL resume branch (inProgress diff vs `is_file_processed`)
- [x] `scan_runner.rs`: cache-init-failure fallback (traditional scan)
- [x] `scan_runner.rs`: file-scan `processMediaFile` incl. `current` = delete + remove
- [x] `scan_subdirectories`: enumerate, 6-term ignore + hidden filter, skip-on-error
- [x] **subdir re-entry SKIP-only + honors `current`** (`should_recurse_subdirs` + 3 tests) —
      fixed 2026-06-10 (was: recursed on FULL → double-traversal)
- [x] Thumbnail: gate `shouldCreateThumbnail` + `always=rescan`; serial decode in
      `spawn_blocking` (keep). **No** pool concurrency in this RFC.
- [x] **One** process→record order for both fresh and resume (drop TS order flip)
- [x] **No 50ms sleep** before `complete` (synchronous config writes)
- [x] Progress event: `currentFile` only when `path && !isDirectory`; counts from
      **in-memory** cache (no per-file disk re-read)
- [x] Batched cache writes: basename, dynamic batch (20/50/200) + 5s timer, `thumbnailsGenerated`
- [x] `extendedCleanup` GC ported (`scan_cleanup.rs` + tests) — **but no live caller** (inert
      until a trigger is wired; see scan-cleanup note)
- [x] Keep RFC 0105 cache format; keep RFC 0116 config/thumbnail contract
- [x] **SKIP progress counts fixed.** `restore_cached_files` now emits `(idx+1, N)` from the
      photoList (N = entry count) → final `(N, N)`, matching Electron
      `mergeDirectoryScanProgressWithCache`. Was `(0,0)` from the empty cache. Mapping pinned
      by `cached_photo_to_request` tests.
- [x] **Cleanup**: `found_paths` dead local removed; `complete.paths` emits `&[]` with a
      comment (always-empty = Electron klaw parity)
- [ ] Orchestration tests with a Tauri `AppHandle` (SKIP/FULL emit sequences, `complete`
      cardinality) — pure decision/mapping logic is now tested (`should_recurse_subdirs`,
      `cached_photo_to_request`); the `app.emit` side-effects still lack an integration test
      (dirs never classified as media) — drop it or comment as intentional `[]` parity
- [x] `cargo test scan_` green (**52 passed**); `cargo build -p photasa`
- [x] Register in `ROADMAP.md` + `TASK_TRACKING.md`

---

## Testing strategy

```bash
cd apps/photasa/src-tauri && cargo test scan_strategy
cd apps/photasa/src-tauri && cargo test scan_
cd apps/photasa/src-tauri && cargo build -p photasa
```

Unit tests (exact Electron tables):

- `decide_scan_strategy`: rescan→FULL; missing config→FULL; read error→FULL; empty+media→FULL;
  empty+no-media→SKIP; valid→SKIP. **No INCREMENTAL case** (dead in TS).
- `should_process_file`: rescan→true; missing config→true; in-list→false; not-in-list→true;
  read failure→true.
- `should_scan_one_level`: `current`→true; `scan`/`rescan`→false.
- `compute_folder_hash`: empty dir→`""`; with media→non-empty; deterministic; sorted by name.
- `validate_scan_params`: each invalid branch + valid.
- `shouldIgnorePhotasaPath`: each of the 6 substrings ignored; clean path not ignored.
- progress shape: `currentFile` present for file action, absent for directory.
- `restore_cached_files`: filename→fullPath join; thumbnail fallback to `buildThumbnailPath`.
- `extendedCleanup`: age>7d remove; missing dir remove; missing version/folderHash remove.

Orchestration tests (the hard part — `scan_runner.rs` has **none** yet):

> **✅ Bug pinned by pure-function tests (2026-06-10).** The double-traversal hinged on the
> recursion gate, now extracted as `should_recurse_subdirs(strategy, action)` and tested:
> `full_scan_does_not_recurse_subdirs` (FULL → false), `skip_scan_recurses_subdirs` (SKIP →
> true), `current_action_never_recurses` (`current` → false). A full integration test
> ("`nested.jpg` processed exactly once") still wants a Tauri `AppHandle` harness.

- **SKIP branch**: folder with valid `.photasa.json` → emits one event per photoList entry
  (fullPath, thumbnail), no config rewrite, no thumbnail call; then recurses subdirs.
- **FULL fresh**: new folder, 3 media files → 3 progress events with rising `processed`,
  config gains 3 entries, `complete` with `fileCount=3`; counts from in-memory cache.
- **FULL resume**: cache `inProgress` with 1 of 3 processed → only the 2 remaining processed.
- **Fallback**: cache init fails → still walks + processes (no `.photasa-folder.json`).
- **Subdir gating**: FULL parent with a child dir → child files processed by the recursive
  `walkthrough`, **not** by a second subdir re-entry (no double-process). SKIP parent → child
  re-entered once (own decision).
- **`current` no-recurse**: `current` on parent with a child dir → only parent's files touched.
- **`current` delete (file scan)**: existing file → thumbnail unlinked + entry removed.
- **Subdir error isolation**: parent + 2 children, one child unreadable → sibling still scanned.
- **`complete` cardinality**: FULL of a 2-level tree → exactly one `complete` for the subtree;
  SKIP of 2 indexed dirs → one `complete` each, `action.path` = that dir.
- **SKIP progress counts**: indexed folder with N photoList entries → restored-file progress
  reports `processed=N, total=N` (not `0/0`). Fixed: `restore_cached_files` emits `(idx+1, N)`.
- **No-sleep**: `complete` emitted without a fixed delay; config on disk already has entries
  at `complete` time (proves synchronous-write ordering, no 50ms needed).

Manual / golden parity:

- Open indexed folder → SKIP, grid loads from cache, no re-scan (verify: no
  `.photasa.json`/thumbnail writes — file mtimes unchanged).
- Open new folder → FULL, progress streams (`processed` increments), grid fills.
- Partial scan then reopen → RESUME processes only the remaining files.
- Rescan → `always:true`, all thumbnails regenerated, photoList rebuilt via add (RFC 0116).
- Delete (`current`) → thumbnail unlinked + entry removed.
- `current` action → only selected folder, no recursion.

---

## Risks

- **SKIP path event shape**: re-emitted photoList must match the store's expected
  `picasa:find-photo` shape (RFC 0116 folder-switch race) — golden test the emission.
- **Behavioral change vs current shipped build**: intentionally **changes** scan workload
  (less work on indexed folders) and drops the per-file disk re-read. Verify no UI relies on
  the current always-rescan side effect or the disk-backed progress counts.
- **Dropping the 50ms sleep**: safe **only** because `add_photo_to_folder_list` is
  synchronous. If config writes ever become async/batched in Rust, the ordering guarantee
  must be re-established explicitly (not via a sleep).
- **Resume diff cost**: resume collects the full file list to diff — same as Electron;
  acceptable, bounded by directory size.

## Alternatives considered

- **Parallelize thumbnails only, keep flat loop** — rejected: still skips strategy / per-file
  gating / resume / subdir-per-dir decisions (#1–3, 5, 6).
- **Port `compareHashesAndDecide` as a live 3-way strategy** — rejected: it is **dead code**
  in TS (`decideScanStrategy` never returns INCREMENTAL); porting it would *add* behavior
  Electron does not run.
- **Import `@photasa/scan` into Tauri** — rejected by
  [TAURI_RUST_REWRITE_POLICY.md](./TAURI_RUST_REWRITE_POLICY.md); no Node in backend.
- **Line-by-line TS→Rust translation** — rejected by policy; the tables are the contract,
  the Rust implementation is independent (pure functions + tests).
- **Cloning the 50ms sleep / per-file disk re-read / fresh-vs-resume order flip** — rejected:
  these are Node-specific workarounds and accidental inconsistencies (see artifacts table),
  not observable contract. Porting them would copy bugs and thrash disk for no benefit.
- **Bounded decode pool (concurrency)** — deferred to a separate RFC; not Electron's
  fresh-scan behavior and adds ordering hazard. This RFC stays serial.

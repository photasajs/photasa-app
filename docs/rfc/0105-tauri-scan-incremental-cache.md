# RFC 0105 – Tauri scan: incremental cache (.photasa-folder.json)

**Status**: Draft  
**Created**: 2026-04-05  
**Area**: Tauri / Scan

---

## Problem

The Electron `scan-worker.ts` reads a per-folder `.photasa-folder.json` cache
to track incremental scan progress:

```ts
const cacheFilePath = path.join(scan.path, ".photasa-folder.json");
const cache = JSON.parse(fs.readFileSync(cacheFilePath, "utf8"));
// cache.processedFiles  → already-scanned count
// cache.pendingFiles    → remaining count
progressData = {
  processed: cache.processedFiles.length,
  total:     cache.processedFiles.length + cache.pendingFiles.length,
};
```

The cache is populated by `@photasa/scan` (`scanPhotos` / `processMediaFile`)
during the scan and allows resuming a partial scan and reporting accurate
`processed/total` progress to the frontend.

The Rust `scan_photos` in `stubs.rs` and `scan_adapter.rs` perform a raw
`walkdir` traversal.  They emit each found path as a `picasa:find-photo` event
but:

- Do not write or read `.photasa-folder.json`.
- Report no `progress.total` — the frontend always sees `total: 0`.
- Cannot resume a partially-completed scan.

---

## Decision

Implement a per-folder cache file `.photasa-folder.json` in Rust to mirror the
TypeScript behaviour.

### Cache file schema (matches existing TS format)

```json
{
  "version": "1",
  "scannedAt": "<ISO-8601>",
  "processedFiles": ["<path>", …],
  "pendingFiles":   ["<path>", …]
}
```

### Scan flow with cache

1. **Discovery phase**: walkdir the target directory to collect all candidate
   media paths (use the existing `PHOTO_EXTENSIONS` filter).  Store the full
   list as `pendingFiles`.  Write initial `.photasa-folder.json`.
2. **Processing loop**: for each path in `pendingFiles`:
   - Move path from `pendingFiles` to `processedFiles` in the cache.
   - Write updated `.photasa-folder.json` to disk.
   - Emit `picasa:find-photo { type: "found", requestId, path }`.
   - Emit `picasa:find-photo { type: "progress", requestId, progress: { processed, total } }`.
3. **Completion**: emit `picasa:find-photo { type: "complete", … }`.
4. **Resume**: if `.photasa-folder.json` already exists and `pendingFiles` is
   non-empty, skip the discovery phase and process only the remaining
   `pendingFiles` entries.

### File operation type routing

Match the Electron scan-worker behaviour:

- `operationType == "file"`: apply the `isPhotasaMediaFile` extension guard;
  emit a single complete event if the file is not a media file.
- `operationType == "directory"` (default): run the full directory scan with
  cache.

### Implementation location

Extend `apps/photasa/src-tauri/src/commands/stubs.rs::scan_photos` (or extract
to a dedicated `scan_cache.rs` module).  The `scan_adapter.rs` `scanPaths`
action should also use the cache for parity with the Tianting workflow path.

---

## Impact

- Progress bar in the frontend will show accurate `processed / total` counts.
- Long scans of large directories can be resumed after an app crash or restart.
- On-disk format is identical to Electron output; future hybrid
  Electron↔Tauri scenarios remain compatible.

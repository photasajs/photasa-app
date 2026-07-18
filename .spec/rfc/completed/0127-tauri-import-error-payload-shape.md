# RFC 0127: Tauri import — `import:error` payload shape (`[object Object]` bug)

- **Start Date**: 2026-07-17
- **Status**: ✅ Implemented（2026-07-18）
- **Area**: Photasa / Import / Contract
- **Depends on**: [0070](../0070-tauri-import-service-migration.md), [0118](./0118-tauri-import-background-ui.md)
- **One thing only**: `import:error` event payload → JS `Error` shape at the store boundary

## Implementation principle (Photasa / Tauri)

> **Rust rewrite, not TypeScript copy.** Policy: [../TAURI_RUST_REWRITE_POLICY.md](../TAURI_RUST_REWRITE_POLICY.md).

## Summary

Rust emits `import:error` with `json!({ "message": ..., "importId": ... })` — a plain object, not a JS `Error`.

Two TS sites treat it as possibly-an-`Error` and fall back to `String(err)` otherwise:

- `apps/photasa/src/stores/import-session.ts` `fail(err)` — `err instanceof Error ? err.message : String(err ?? "未知错误")`
- `apps/photasa/src/components/ImportProgressModal.vue` `sessionError` watcher — `err instanceof Error ? err : new Error(String(err))`

Since the payload is never `instanceof Error`, both sites run `String({message, importId})`, producing the literal text `"[object Object]"` — shown to the user in the failure toast and in the modal's error panel (`importError.message`) on any real backend import error (e.g. target directory creation failure).

## Fix

Normalize the error payload **once** at the store boundary (`import-session.ts`, where `errorUnlisten` receives `event.payload`), extracting `.message` from the known Rust shape `{message, importId}` before storing it as `error.value`. Downstream consumers (`ImportProgressModal.vue`) then only ever see a string/Error with the real message — no second normalization needed.

## Non-goals

| Topic                       | RFC      |
| --------------------------- | -------- |
| `checksum`                  | **0119** |
| `duplicateCount`            | **0123** |
| `resumeImport` return shape | **0124** |
| `status: "paused"` emit     | **0125** |
| Background UI               | **0118** |

## Checklist

- [x] Normalize `import:error` payload in `import-session.ts` `errorUnlisten` handler
- [x] Downstream receives real `Error(message)`
- [x] Vitest: error toast stores real Rust `message`, never `"[object Object]"`
- [x] ROADMAP ✅

## Testing

- Unit: simulate `import:error` payload `{message: "创建目标目录失败: ...", importId: "..."}` → toast and modal panel both display the real message string.

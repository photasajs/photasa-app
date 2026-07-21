# RFC 0137: Zhenguan direct Tauri IPC migration

- **Start Date**: 2026-07-19
- **Status**: Draft
- **Priority**: P1f
- **Area**: Photasa / Zhenguan / Tauri IPC boundary
- **Depends on**: [0136](./completed/0136-tauri-scan-runtime-contract.md)
- **Path**: `.spec/rfc/0137-tauri-zhenguan-direct-ipc-migration.md`

## Decision

`YuanTianGang` represents the Tauri / Rust transport feature. It is the only IPC boundary: calls Rust commands with Tauri `invoke` and subscribes to Tauri events directly.

`window.api` / `legacy-api.ts` remains only as a compatibility wrapper for legacy Vue callers not yet migrated. It is not an allowed dependency for Zhenguan services or new Tauri feature paths.

人物职责优先于技术层：袁天罡代表 IPC，不是某个可替换的 `invoke` helper；尉迟恭代表扫描队列，不是某个可替换的 queue store；房玄龄代表状态与持久化，不是可被任何人直接修改的 Pinia。

```text
UI intent
-> DuRuHui / QiZou / LiShiMin / Shengzhi
-> YuanTianGang
-> Rust command or Tauri event

Rust event
-> YuanTianGang
-> QiZou / LiShiMin / Shengzhi
-> target service
```

## Golden Rules

贞观拟人化边界在 IPC 迁移中保持不变：袁天罡只管交通，李世民只管跨功能路由，杜如晦只传圣旨，房玄龄只落状态；任何人不接管另一个人的功能。

1. No Zhenguan person imports or calls `window.api`, `legacy-api.ts`, Electron preload APIs, or a wrapper around them.
2. No component invokes Rust directly. Components submit intent through the Zhenguan path to the responsible person.
3. Only `YuanTianGang` imports Tauri IPC primitives for personified feature traffic.
4. `YuanTianGang` translates only transport contracts. It does not mutate Pinia, persist queue state, run scan pipelines, or decide queue policy.
5. Tauri command/event names and payloads are explicit Rust contracts. Wrapper-shaped APIs are not the source of truth.
6. A migration removes one capability at a time. Keep the legacy wrapper for remaining callers until that capability has no callers, then delete only that wrapper surface.
7. New scan work follows RFC 0136 from the first line. No temporary `window.api.scanPhotos` bridge.

## Scope

This RFC migrates Zhenguan service IPC capability by capability. It does not remove the entire compatibility surface at once and does not change Electron behavior.

Initial order:

1. Scan command invocation and scan event subscription.
2. Watch command invocation and watch event subscription.
3. Other Zhenguan service capabilities, each with direct-call inventory, Rust contract tests, and wrapper caller removal.
4. Delete a `legacy-api.ts` capability only after its caller count is zero.

## Required Evidence Per Capability

1. Inventory every `window.api` / `legacy-api` caller for the capability.
2. Define Rust command and event payload contract.
3. Route service request and report through Zhenguan boundaries.
4. Verify no Zhenguan service imports the wrapper.
5. Verify legacy callers remain functional until migrated.
6. Delete the wrapper member only after zero remaining callers.

## Non-Goals

- No rewrite of all frontend adapter code in one change.
- No direct component-to-Rust invocation.
- No service-to-service direct call to avoid routing.
- No new Node or Electron backend dependency.

## Acceptance

1. Scan traffic uses `YuanTianGang` direct Tauri IPC only.
2. No scan service path references `window.api.scanPhotos` or `legacy-api.ts`.
3. The scan path retains the RFC 0136 persisted queue, pipeline, and crash-recovery semantics.
4. Each later migrated capability has a caller inventory and zero-wrapper-caller proof before deletion.
5. Existing legacy callers are not broken during staged migration.

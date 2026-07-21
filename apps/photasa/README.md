# Photasa (Tauri)

**Rust-first** desktop photo app. Backend in `src-tauri` + `crates/`; Vue renderer for UI and orchestration only.

Electron and zouwu (`TianshuService`, `tianshu_command`, workflow YAML) were removed in [RFC 0153](../../.spec/rfc/completed/0153-tauri-zouwu-workspace-removal.md). Production IPC is direct `invoke()` via `YuanTianGang` (RFC 0137).

## Layout

```
apps/photasa/
├── src/                    # Vue renderer
│   ├── api/                # legacy-api, adapters (scan, import, config, …)
│   ├── services/           # Zhenguan domain services (lishimin, fangxuanling, …)
│   └── main.ts
└── src-tauri/
    ├── src/
    │   ├── main.rs         # Tauri entry, command registration
    │   ├── commands/       # Typed #[tauri::command] handlers
    │   └── utils/          # e.g. scan queue persistence
    ├── Cargo.toml
    └── tauri.conf.json
```

Rust algorithms live in workspace crates (`photasa-scan`, `photasa-import`, `photasa-thumbnail`, `photasa-config`, `photasa-preference`, `photasa-folder-tree`, `photasa-media`, `photasa-watch`, `photasa-types`, `libheif-sys`).

## Commands

From repo root:

```bash
pnpm dev                  # tauri dev
pnpm run build:photasa    # tauri build
pnpm run clippy           # cargo clippy -p photasa
```

From this directory:

```bash
pnpm install
pnpm run dev
pnpm run test:unit
pnpm run lint
pnpm run typecheck
```

## Status

Core migration is **implemented** (scan, import, thumbnail, config, preferences, folder tree, watch, shell/menu). Track remaining work in [ROADMAP.md](../../ROADMAP.md) — notably `legacy-api.ts` capability retirement (RFC 0097).

Umbrella RFC: [0067](../../.spec/rfc/completed/0067-tauri-app-photasa.md). Recent retirements: [0137](../../.spec/rfc/completed/0137-tauri-zhenguan-direct-ipc-migration.md) (direct IPC), [0139/0140](../../.spec/rfc/completed/0139-tauri-zouwu-retirement-plan.md) (zouwu domain exit), [0153](../../.spec/rfc/completed/0153-tauri-zouwu-workspace-removal.md) (physical removal).

## Policy

See [TAURI_RUST_REWRITE_POLICY.md](../../docs/rfc/TAURI_RUST_REWRITE_POLICY.md) — match Electron **contracts** in tests; implement in Rust only.

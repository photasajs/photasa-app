# Photasa

Desktop photo manager — **Tauri 2 + Vue 3 + Rust**. Electron (`apps/desktop`) and the zouwu workflow engine have been removed; backend logic lives in `apps/photasa/src-tauri` and `crates/`.

## Quick Start

```bash
pnpm install

# Tauri dev (default)
pnpm dev
# or: pnpm run tauri:dev

# Frontend only (no native window)
pnpm run vite:dev:photasa

# Production build
pnpm run build:photasa
```

| Task       | Root command                                   | `apps/photasa`       |
| ---------- | ---------------------------------------------- | -------------------- |
| Dev        | `pnpm dev`                                     | `pnpm run dev`       |
| Vite only  | `pnpm run vite:dev:photasa`                    | `pnpm run vite:dev`  |
| Build      | `pnpm run build:photasa`                       | `pnpm run build`     |
| Unit tests | `pnpm --filter @photasa/photasa run test:unit` | `pnpm run test:unit` |
| Rust tests | `cargo test --workspace`                       | —                    |
| Clippy     | `pnpm run clippy`                              | `pnpm run clippy`    |

### Prerequisites

- Node.js 20+ and **pnpm 9**
- Rust stable (see `rust-toolchain.toml`)
- Platform deps for Tauri (WebKit, etc.) — see [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/)

## Project Structure

```
picasa-vue/
├── apps/photasa/           # Photasa app (Vue UI + Tauri shell)
│   ├── src/                # Renderer: Vue, Zhenguan services, legacy-api compat
│   └── src-tauri/          # Rust: commands, crates integration
├── crates/                 # Rust workspace (scan, import, thumbnail, config, …)
├── packages/               # Shared TS packages (@photasa/common, …)
├── .spec/rfc/              # Photasa / Tauri RFCs (active + completed)
├── docs/                   # Guides, design, legacy Electron RFCs
├── ROADMAP.md              # Migration status & next priorities
└── TASK_TRACKING.md        # Sprint checklists
```

## Architecture (short)

- **UI**: Vue 3 + Pinia + Tailwind; domain services (“贞观”) orchestrate flows.
- **IPC**: `YuanTianGang.executeZhaoling` is the production boundary — direct `invoke()` to typed `#[tauri::command]` handlers (RFC 0137). No zouwu / `tianshu_command` path.
- **Rust**: Feature logic in workspace crates (`photasa-scan`, `photasa-import`, `photasa-thumbnail`, `photasa-config`, …); Tauri commands stay thin.
- **Compat**: `legacy-api.ts` still exposes flat `window.api` for unmigrated callers; being retired per RFC 0097.

Policy: **Rust rewrite, not TS copy** — see [ROADMAP.md](./ROADMAP.md) (Golden rule) and [TAURI_RUST_REWRITE_POLICY.md](./docs/rfc/TAURI_RUST_REWRITE_POLICY.md).

## CI & Branches

| Branch    | Role            | Protection (rulesets)                                               |
| --------- | --------------- | ------------------------------------------------------------------- |
| `develop` | Integration     | No force-push / delete; **Lint & Test (Ubuntu)** required on update |
| `main`    | Release default | PR required; same CI check + strict up-to-date                      |

Workflow: [`.github/workflows/photasa-build.yml`](./.github/workflows/photasa-build.yml) — lint, typecheck, vitest, `cargo clippy`, `cargo test`, three-platform Tauri debug build.

## Documentation

- [Development Guide](docs/DEV_GUIDE.md) — setup (partially legacy Electron; prefer this README + `apps/photasa`)
- [Debug Guide](docs/DEBUG.md) · [MCP Debug](docs/DEBUG_MCP.md)
- [ROADMAP.md](./ROADMAP.md) — what’s done / next (e.g. `legacy-api` retirement)
- RFCs: `.spec/rfc/` (Photasa) · `docs/rfc/` (historical / Electron)

## Technology Stack

- **Shell**: Tauri 2
- **Frontend**: Vue 3, TypeScript, Vite, Tailwind CSS
- **Backend**: Rust (workspace crates + `src-tauri`)
- **Monorepo**: pnpm workspaces + Turborepo
- **Testing**: Vitest (renderer), `cargo test` (Rust)

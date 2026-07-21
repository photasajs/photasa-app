# Photasa monorepo

- **Package manager**: pnpm workspaces (`pnpm-workspace.yaml`, `packageManager` in root `package.json`)
- **Desktop app**: `apps/desktop` (`@photasa/desktop`)
- **Shared packages**: `packages/common`, `packages/@photasa/*`
- **Run tasks**: `pnpm -r run <script>` at repo root, or `pnpm --filter @photasa/desktop <script>` for the app
- **RFC / roadmap**: `.spec/rfc/`, `.spec/ROADMAP.md`

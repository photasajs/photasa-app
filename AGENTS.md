<!-- turbo configuration start-->
<!-- Leave the start & end comments to automatically receive updates. -->

# General Guidelines for working with Turborepo

- When running tasks (build, lint, test, typecheck, etc.), prefer running through the root `turbo` (e.g. `pnpm run build`, `pnpm run lint`, `turbo run build --filter=@photasa/desktop`) instead of invoking tooling per package directly
- Workspace packages are defined in `pnpm-workspace.yaml`; task pipeline is in `turbo.json`
- For single-package tasks from root use `pnpm --filter <package-name> run <script>` or `turbo run <task> --filter=<package-name>`

<!-- turbo configuration end-->

# Project preferences

- **Rust-first (always)**: For Photasa / Tauri (`apps/photasa`), prefer implementing features in Rust first—`src-tauri`, workspace crates under `crates/`, and IPC commands—rather than growing Electron-era renderer or Node-only paths. Use the frontend only for UI, orchestration, and thin API calls; heavy I/O, filesystem, media probing, persistence, and security-sensitive logic belong in Rust unless an RFC explicitly defers them.
- **Rust rewrite, not TS copy (golden rule)**: Rewrite backend behavior in Rust; do **not** import or port Electron/Node packages (`@photasa/scan`, `@photasa/import`, etc.) into Tauri. Electron TypeScript is a **behavioral specification** only (IPC, events, on-disk formats, golden tests). See [`docs/rfc/TAURI_RUST_REWRITE_POLICY.md`](docs/rfc/TAURI_RUST_REWRITE_POLICY.md) and `ROADMAP.md` → Golden rule.
- **Active RFCs (Photasa)**: Only RFCs whose implementation target is **Rust** may be **Photasa Active** in `ROADMAP.md` / `TASK_TRACKING.md`. RFC 0098 and v2.0 Electron drafts are **not** Photasa Active; open a new Tauri RFC for Rust work.
- **Photasa / FFmpeg 自包含（默认）**：视频探测与缩略图用 `ffmpeg-next`，**`Cargo.toml` 固定 `build` + `build-zlib`**，在编译期把 FFmpeg 静态链进产物；**禁止**把「让用户或 CI 安装系统 `ffmpeg` / 靠 pkg-config 找 libav」当方案。构建机需要能编 C/汇编（如 clang、部分架构上的 nasm）——这是**工程构建条件**，与**最终用户机器是否装过 ffmpeg**无关。
- **Photasa / HEIC**：`libheif-rs` 使用 **`embedded-libheif`**（随 crate 构建 libheif），**不**以系统 `libheif-dev` / Homebrew / vcpkg 为默认前提；详见 [RFC 0103](docs/rfc/completed/0103-tauri-native-deps-build-strategy.md)。
- **Plans and roadmaps**: Use `ROADMAP.md` (project root) for migration plans, rollout order, and high-level “what’s next”. Do not create ad-hoc plan or migration `.md` files elsewhere (e.g. in `docs/rfc/`) unless the user explicitly asks for a new document.
- **Cursor agent skills**: Reusable workflows live under `.cursor/skills/<skill-name>/SKILL.md` (e.g. `.cursor/skills/tauri-debug-investigate/` for Tauri debugging with MCP; `.cursor/skills/rfc-management/` + `.cursor/skills/rfc-workflow/` for generic RFC lifecycle with `ROADMAP.md` + `docs/rfc/`).

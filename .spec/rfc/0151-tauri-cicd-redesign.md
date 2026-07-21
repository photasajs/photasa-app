# RFC 0151: 重建 Tauri PR 构建流水线（替换 Electron build-matrix）

- **Start Date**: 2026-07-21
- **Status**: Draft
- **Priority**: P1
- **Area**: Photasa / Tauri build / GitHub Actions
- **Depends on**: [0113](./0113-tauri-updater-production-and-prefs-sync.md)（release/updater workflow 设计，本 RFC 只管 PR 阶段构建，两者共同替换现有三个 Electron workflow）
- **Path**: `.spec/rfc/0151-tauri-cicd-redesign.md`

## Decision

`.github/workflows/build-matrix.yml` 构建的是 `apps/desktop`（Electron，`electron-builder`），仓库已是 Photasa 专属，这条流水线**编译的是错误的 app**。删除它，为 `apps/photasa/src-tauri`（Rust + Tauri）**从零重建**一条 PR 构建流水线——核心是"三平台 Tauri 应用能否编译通过"，测试/lint 是同一条流水线里的配套步骤，不是本 RFC 的重点，重点是 build。

## 背景

**现状核实（读源码，2026-07-21）**：

- `.github/workflows/build-matrix.yml`：`pull_request` 触发（`main`/`develop`），矩阵跑 `npm run build:linux/mac/win`——三个脚本均在 `apps/desktop/package.json`（`electron-builder` + `generate-sha512.js`），跟 Photasa 无关。`npm run test` 是根 turbo 全量测试，可能间接跑到 Photasa 的 vitest，但构建阶段完全不构建 Photasa。
- `.github/workflows/release.yml`（release-please）+ `upload-release-assets.yml`：同样 Electron 专属，由 [0113](./0113-tauri-updater-production-and-prefs-sync.md) 处理删除与替换。
- 仓库当前**没有任何** workflow 会：编译 `apps/photasa/src-tauri`（Rust）、跑 `cargo test`/`cargo clippy`、跑 Photasa 前端 vitest、或在 PR 上给出 Photasa 相关的构建/测试反馈。PR 合并前，Photasa 代码的正确性完全没有 CI 把关。

## Goals

1. **核心：三平台 Tauri 构建验证**（`.github/workflows/photasa-ci.yml`，矩阵 macOS/Windows/Linux）：`cargo build -p photasa`（或 `tauri build --debug`），确认 `apps/photasa/src-tauri` 在三平台都能编译通过。这是本 RFC 要解决的主问题——当前仓库没有任何 workflow 编译 Photasa，PR 阶段发现不了跨平台编译错误（含 libheif/ffmpeg 原生依赖问题），只能等到手动本地构建或发布时才暴露。矩阵化不是可选项，是本 RFC 的存在理由。
2. **触发条件**：
    ```yaml
    on:
        pull_request:
            branches: [main, develop]
        push:
            branches: [develop]
    ```
    （`develop` push 和 PR 都跑构建，不产出 Release；Release 只在 0113 定义的 `main` 分支路径触发，两个 workflow 触发条件不重叠但可能同时运行）。
3. **配套检查（同一 workflow 内，非本 RFC 重点但顺手接入）**：`cargo test --workspace`、`cargo clippy --workspace -- -D warnings`（复用仓库根 `rust-toolchain.toml`，显式用 `dtolnay/rust-toolchain` 或等价 action 读取，不依赖 runner 预装 cargo 版本）；`apps/photasa` 的 `vitest run`/`eslint`（单一 runner 即可，前端测试与 OS 无关，不需要矩阵化）。
4. **删除 `build-matrix.yml`**，随 0113 一并处理 Electron workflow 清理（是否在同一个 PR 里删三个文件还是分开，留给实施阶段决定，不在本 RFC 强制顺序）。

## Non-goals

- 不在本 RFC 处理 release/updater 发布流程，见 0113。
- 不引入新的测试类型（E2E/性能测试等）——只把现有 `cargo test`/`vitest`/`eslint`/`clippy` 检查接入 CI，不新增测试范围。
- 不处理 monorepo 里 `apps/desktop`（Electron）的 CI——如果该 app 仍需要独立维护，其 CI 需求超出本 RFC 范围（本仓库当前策略是 Photasa 专属，desktop 是否还活跃需要用户确认，不在本 RFC 假设）。

## Testing strategy

- 新 workflow 落地后，故意提交一个会让 `cargo clippy`/`vitest` 失败的 PR，确认 CI 正确标红并阻止合并（分支保护规则需要同步勾选新 workflow 为必需检查项，这是 GitHub 仓库设置层面的操作，不在 workflow 文件本身，需要额外记录在 Acceptance）。
- 确认 `develop` push 触发构建测试但不触发 release（与 0113 的 `main`-only release 边界互相印证）。

## Acceptance

1. `.github/workflows/photasa-ci.yml` 存在，`build-matrix.yml` 已删除，三平台（macOS/Windows/Linux）矩阵均执行 `apps/photasa/src-tauri` 构建并通过。
2. PR 到 `main`/`develop` 触发配套的 `cargo test`/`cargo clippy`/`vitest`/`eslint`，全部在 PR 状态检查中可见。
3. GitHub 仓库分支保护规则（Settings → Branches）已将新 workflow 的检查项设为必需——这一步是仓库设置变更，需要有仓库管理权限的人执行，AI/CI 配置本身不能自动完成，需人工确认后勾选。
4. `develop` push 不触发任何 Release 相关 workflow（与 0113 Acceptance 第 6 条呼应，两份 RFC 共同验证"只有 main 能发布"这条边界）。

## Risks

- CI 时长：三平台 Tauri 构建（尤其含 libheif/ffmpeg 原生依赖编译）可能显著慢于当前 Electron 矩阵，需要评估是否用 `Swatinem/rust-cache` 或等价缓存策略控制时长（RFC 0103 的原生依赖构建策略已经讨论过 NASM/rust-cache，可直接复用其中的 CI 优化建议，不用重新设计）。
- 若 `apps/desktop` 仍在活跃维护（不是完全废弃），删除 `build-matrix.yml` 会让 Electron 应用失去 PR 构建门禁——本 RFC 假设仓库已是 Photasa-only（基于仓库名 `photasa-app` 与用户明确的"no more electron"指示），如果这个假设有误，需要保留一份 Electron CI 或明确 desktop 的维护状态。

# RFC 0151: 重建 Tauri PR 构建流水线（替换 contract reference build-matrix）

- **Start Date**: 2026-07-21
- **Status**: Completed
- **Priority**: P1
- **Area**: Photasa / Tauri build / GitHub Actions
- **Depends on**: [0113](./0113-tauri-updater-production-and-prefs-sync.md)（release/updater workflow 设计，本 RFC 只管 PR 阶段构建，两者共同替换现有三个 retired workflow）
- **Path**: `.spec/rfc/completed/0151-tauri-cicd-redesign.md`

## Decision

`.github/workflows/build-matrix.yml` 构建的是 `legacy-api contract`（contract reference，`legacy packager`），仓库已是 Photasa 专属，这条流水线**编译的是错误的 app**。删除它，为 `apps/photasa/src-tauri`（Rust + Tauri）**从零重建**一条 PR 构建流水线——核心是"三平台 Tauri 应用能否编译通过"，测试/lint 是同一条流水线里的配套步骤，不是本 RFC 的重点，重点是 build。

## 背景

**现状核实（读源码，2026-07-21）**：

- `.github/workflows/build-matrix.yml`：`pull_request` 触发（`main`/`develop`），矩阵跑 `npm run build:linux/mac/win`——三个脚本均在 `legacy-api contract/package.json`（`legacy packager` + `generate-sha512.js`），跟 Photasa 无关。`npm run test` 是根 turbo 全量测试，可能间接跑到 Photasa 的 vitest，但构建阶段完全不构建 Photasa。
- `.github/workflows/release.yml`（release-please）+ `upload-release-assets.yml`：同样 已废弃，由 [0113](./0113-tauri-updater-production-and-prefs-sync.md) 处理删除与替换。
- 仓库当前**没有任何** workflow 会：编译 `apps/photasa/src-tauri`（Rust）、跑 `cargo test`/`cargo clippy`、跑 Photasa 前端 vitest、或在 PR 上给出 Photasa 相关的构建/测试反馈。PR 合并前，Photasa 代码的正确性完全没有 CI 把关。

## Goals

1. **核心：三平台 Tauri 构建验证**（`.github/workflows/photasa-build.yml`，矩阵 macOS/Windows/Linux）：`cargo build -p photasa`（或 `tauri build --debug`），确认 `apps/photasa/src-tauri` 在三平台都能编译通过。这是本 RFC 要解决的主问题——当前仓库没有任何 workflow 编译 Photasa，PR 阶段发现不了跨平台编译错误（含 libheif/ffmpeg 原生依赖问题），只能等到手动本地构建或发布时才暴露。矩阵化不是可选项，是本 RFC 的存在理由。
2. **触发条件**：

```yaml
on:
pull_request:
branches: [main, develop]
push:
branches: [develop]
```

（`develop` push 和 PR 都跑构建，不产出 Release；Release 只在 0113 定义的 `main` 分支路径触发，两个 workflow 触发条件不重叠但可能同时运行）。3. **配套检查准入标准**：一个检查项能加进本 workflow，当且仅当它不需要矩阵化、能在单一 runner 上快速完成（如 lint/单测）。需要平台特定验证的新检查（例如未来的 GUI 冒烟测试）应该新增独立 job 或另开 RFC 评估，不能因为"顺手"就塞进这条 workflow，避免它变成什么检查都往里堆的垃圾抽屉。当前符合准入标准、随本 RFC 一并接入的：`cargo test --workspace`、`cargo clippy --workspace -- -D warnings`（复用仓库根 `rust-toolchain.toml`，显式用 `dtolnay/rust-toolchain` 或等价 action 读取，不依赖 runner 预装 cargo 版本）；`apps/photasa` 的 `vitest run`/`eslint`。4. **删除 `build-matrix.yml`**——仓库不再支持 contract reference，`legacy-api contract` 不再需要 CI 覆盖。随 0113 一并处理三个 retired workflow 清理（是否在同一个 PR 里删三个文件还是分开，留给实施阶段决定，不在本 RFC 强制顺序）。5. **与 0113 共享初始化步骤**：`photasa-build.yml`（本 RFC）与 `photasa-release.yml`（0113）都需要 checkout → setup Rust（读 `rust-toolchain.toml`）→ setup Node → `pnpm install` 这套初始化。两份 YAML 各写一遍会导致后续升级（如 Node 版本）只改一处、另一处漂移。应抽成 composite action（如 `.github/actions/setup-photasa-toolchain/action.yml`）供两个 workflow 共同引用，不是各自内联。

## Non-goals

- 不在本 RFC 处理 release/updater 发布流程，见 0113。
- 不引入新的测试类型（E2E/性能测试等）——只把现有 `cargo test`/`vitest`/`eslint`/`clippy` 检查接入 CI，不新增测试范围。

## Testing strategy

- **对应核心 Goal 1**：故意在某一平台（如 Windows 专属代码路径）引入编译错误的 PR，确认矩阵能精确报出是哪个平台失败，而不是笼统标红——这是本 RFC 声称的存在理由，必须验证，不能只验证配套检查。
- 故意提交一个会让 `cargo clippy`/`vitest` 失败的 PR，确认 CI 正确标红并阻止合并（分支保护规则需要同步勾选新 workflow 为必需检查项，这是 GitHub 仓库设置层面的操作，不在 workflow 文件本身，需要额外记录在 Acceptance）。
- 确认 `develop` push 触发构建但不触发 release（与 0113 的 `main`-only release 边界互相印证）。

## Acceptance

1. `.github/workflows/photasa-build.yml` 存在，`build-matrix.yml` 已删除，三平台（macOS/Windows/Linux）矩阵均执行 `apps/photasa/src-tauri` 构建并通过。
2. 故意引入的单平台编译错误能被矩阵精确捕获并标红对应平台（验证核心价值，非仅配套检查）。
3. PR 到 `main`/`develop` 触发配套的 `cargo test`/`cargo clippy`/`vitest`/`eslint`，全部在 PR 状态检查中可见。
4. GitHub 仓库分支保护规则（Settings → Branches）已将新 workflow 的检查项设为必需——这一步是仓库设置变更，需要有仓库管理权限的人执行，AI/CI 配置本身不能自动完成，需人工确认后勾选。
5. `develop` push 不触发任何 Release 相关 workflow（与 0113 Acceptance 第 6 条呼应，两份 RFC 共同验证"只有 main 能发布"这条边界）。
6. `photasa-build.yml` 与 `photasa-release.yml`（0113）共享同一个初始化 composite action，两份 workflow 文件里不各自内联重复的 checkout/setup 步骤。

## Risks

- CI 时长：三平台 Tauri 构建（尤其含 libheif/ffmpeg 原生依赖编译）可能显著慢于当前 legacy 矩阵，需要评估是否用 `Swatinem/rust-cache` 或等价缓存策略控制时长（RFC 0103 的原生依赖构建策略已经讨论过 NASM/rust-cache，可直接复用其中的 CI 优化建议，不用重新设计）。
- 删除 `build-matrix.yml` 是不可逆操作（虽可从 git 历史恢复），随本 RFC 实施时一并执行。

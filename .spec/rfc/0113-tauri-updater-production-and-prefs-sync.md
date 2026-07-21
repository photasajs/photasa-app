# RFC 0113 – Tauri updater: production config + preferences sync

## Implementation principle (Photasa / Tauri)

> **Rust rewrite, not TypeScript copy.** Policy: [ROADMAP.md](../../ROADMAP.md).

**Status**: 🔨 In Progress — preferences 同步部分已完成；生产 pubkey/endpoints 从未真正配置（`tauri.conf.json` 现状 `pubkey: ""`, `endpoints: []`），2026-07-21 补充 GitHub Release 落地方案
**Created**: 2026-06-06
**Area**: Tauri / Update
**Depends on**: RFC 0090, RFC 0106, RFC 0107
**Related**: [0151](./0151-tauri-cicd-redesign.md)（PR 阶段构建/测试 workflow 重设计；本 RFC 只管 `main` 分支 release/updater 发布，两者共同替换现有三个 retired workflow）

---

## Problem

1. **Production:** `tauri.conf.json` / builder lacks real updater `pubkey` and endpoints (0090 运维项).
2. **Runtime:** contract reference `UpdateService.initializeWithConfig` loads preferences on startup; Tauri `UpdateState.auto_config` defaults until user opens Settings — periodic checker may run with `enabled: false` incorrectly.

## Decision

1. Document and wire production updater signing/endpoints (CI secrets, not in repo).
2. On app setup (after `photasa-preference` load), **Rust** reads `system.autoUpdate` from preferences JSON and calls internal `apply_auto_update_config` — no TS backend.
3. Optional: persist `lastCheck` back to preferences from Rust after each check.
4. **2026-07-21 新增**：用 GitHub Release 作为 updater 分发后端（`endpoints` 指向本仓库 Release 资产），新建 Tauri 专属 CI workflow 产出签名更新包。

## Implementation checklist

- [x] `preferences` → `UpdateState` sync in `main.rs` setup (`commands/update_config.rs`)
- [ ] ~~`tauri.conf.json` + docs for pubkey/endpoints~~ — **文档已写（`UPDATER.md`），配置从未真正落地**（`pubkey`/`endpoints` 仍为空，见下方 2026-07-21 现状核实）
- [x] Test: enabled + checkInterval from preferences affect `update_periodic` behavior
- [x] `photasa-preference`: `system.autoUpdate` 持久化字段
- [ ] **2026-07-21 新增待办**：GitHub Release 作为 updater 后端（见下方章节）

## Impact

Auto-update matches contract reference without renderer-side config hacks.

---

## 2026-07-21 补充：GitHub Release 作为 updater 后端

### 现状核实（读源码，非猜测）

- `apps/photasa/src-tauri/tauri.conf.json:88-91`：`plugins.updater.pubkey: ""`，`endpoints: []`——生产 updater 从未真正配置过，`UPDATER.md` 写的是"如何配置"的操作手册，不是已完成状态。
- 仓库 `.github/workflows/` 现有三个 workflow（`release.yml`/`build-matrix.yml`/`upload-release-assets.yml`）**全部是 The removed desktop tree 专属**——用 `npm run build:linux/mac/win`（legacy packager），产物路径 `dist/out/release/build`，跟 `apps/photasa`（Tauri）无关，不能复用。**没有任何现存 workflow 会构建 Photasa 或产出 Tauri updater 需要的签名 `latest.json`。**
- 仓库地址：`systembugtj/picasa-vue`；Photasa `identifier`: `me.photasa.app`；`@tauri-apps/cli: ^2.0.0`。

### 方案：Tauri 官方 `tauri-action` + GitHub Release

Tauri v2 官方提供 [`tauri-apps/tauri-action`](https://github.com/tauri-apps/tauri-action)，一步完成"构建各平台包 → 签名 → 创建/更新 GitHub Release → 生成 updater 需要的 `latest.json`"，是 Tauri + GitHub Release 组合的标准做法，不需要手写 legacy packager 那套上传逻辑。

**新增 workflow**（`.github/workflows/photasa-release.yml`，替换现有三个 retired workflow，见下方删除说明）：

**触发条件——只允许 `main` 分支发布，`develop` 绝不触发**：

```yaml
on:
    push:
    branches:
        - main
    tags:
        - "v*"
    workflow_dispatch: {}
```

`push.branches: [main]` 是硬性限制——`develop` 或任何 feature 分支的 push 都不触发这条 workflow。但 `branches` 过滤器只对分支 push 生效，`tags` 条件是独立的"或"关系——如果在非 `main` 分支（如 `develop`）打 tag 并 push，`tags: ["v*"]` 条件本身仍会触发，不受 `branches` 限制约束。必须在 job 内加一道显式校验，用 GitHub 官方认可的 `github.event.base_ref` 字段（tag push 事件携带该 tag 所在分支的引用）确认 tag 确实打在 `main` 上：

```yaml
jobs:
    release:
    runs-on: ${{ matrix.os }}
    if: github.ref == 'refs/heads/main' || github.event.base_ref == 'refs/heads/main'
    strategy:
    matrix:
    os: [macos-latest, windows-latest, ubuntu-latest]
```

- 矩阵：macOS（arm64 + x86_64，或 universal）、Windows、Linux——与 `apps/photasa/src-tauri` 目标平台一致。
- 步骤：checkout → **共享 composite action**（见 [0151](./0151-tauri-cicd-redesign.md) Goal 5，`.github/actions/setup-photasa-toolchain`，封装 setup Rust + setup Node + `pnpm install`，与 `photasa-build.yml` 共用，不在本 workflow 内联重复）→ `tauri-apps/tauri-action@v0` 指向 `apps/photasa` 工作目录。
- 密钥：`TAURI_SIGNING_PRIVATE_KEY`/`TAURI_SIGNING_PRIVATE_KEY_PASSWORD` 走 GitHub Secrets（`UPDATER.md` 已记录这两个变量约定，直接复用，不用新造）。**失败路径**：若这两个 secret 未配置，`tauri-action` 的签名步骤必须清晰失败并终止 workflow，不能静默产出未签名安装包——未签名包会被 Tauri updater 客户端拒绝，若 CI 没有在构建阶段就报错，问题会一直拖到用户端更新失败才被发现。落地时需要显式检查这两个环境变量是否为空并提前 fail-fast（例如构建步骤前加一个 `if: env.TAURI_SIGNING_PRIVATE_KEY == ''` 的失败步骤），不能依赖 `tauri-action` 自身的默认行为。
- **`develop` 分支的 push/PR 只跑构建+测试（现有 CI 逻辑，不产出 Release）**，`main` 分支的 push 才触发这条发布 workflow——这是"main 才发布"的实际执行边界，不是靠人工记住不要在 develop 手动触发。

**`tauri.conf.json` 配置**：

```json
"plugins": {
 "updater": {
 "pubkey": "<CI 注入或 build 前 patch>",
 "endpoints": [
 "https://github.com/photasajs/photasa-app/releases/latest/download/latest.json"
 ]
 }
}
```

`pubkey` 私钥不进仓库（`UPDATER.md` 已有此约定）；`endpoints` 指向 Release 固定资产名 `latest.json`（`tauri-action` 默认产出此文件名，随每次 Release 更新）。

### `.github/workflows/` 现存三个 workflow 是 contract reference 遗留物，应删除

`release.yml`（release-please）/`build-matrix.yml`/`upload-release-assets.yml` 全部针对 `legacy-api contract`（`npm run build:linux/mac/win`，legacy packager 产物路径），仓库已是 Photasa 专属（`photasajs/photasa-app`），不再需要维护 legacy 构建路径。这三个文件应随本 RFC 一并删除，替换为新的 Tauri-only workflow，不是"共存"。

### Non-goals（本次不做）

- 不搭建独立更新服务器（RFC 0020 描述的自建方案，已被 GitHub Release 方案取代，不需要）。
- 实施阶段与新 `photasa-release.yml`/`photasa-build.yml`（0151）落地一并执行删除，不单独拆步骤。

### Acceptance（新增）

1. 新 workflow 文件存在，`apps/photasa/src-tauri` 专属，仓库不再有 legacy 构建路径。
2. `tauri.conf.json` 的 `endpoints` 指向真实可达的 GitHub Release URL（`photasajs/photasa-app`）。
3. 手动触发一次 workflow，产出签名更新包并成功创建/更新 GitHub Release，`latest.json` 内容与本次构建版本一致。
4. 私钥全程不出现在仓库或日志中（GitHub Secrets 遮蔽验证）。
5. `UPDATER.md` 更新为反映真实已配置状态，不再是"如何配置"的纯手册，仓库链接改为 `photasajs/photasa-app`。
6. 在 `develop` 分支 push 或打 tag，均不触发 `photasa-release.yml`（手动验证：`develop` 分支打一个测试 tag push 后确认 workflow 未运行）；只有 `main` 分支的 push 或 `main` 上的 tag 才触发。
7. **失败路径**：临时移除/清空 `TAURI_SIGNING_PRIVATE_KEY` secret 后触发一次 workflow，确认在签名步骤明确失败（fail-fast），不产出未签名安装包或成功状态的假阳性 Release。

### Risks

- `tauri-action` 的默认 GitHub Release 行为可能是"draft"或"prerelease"，需要明确配置发布状态，避免 updater 端点读到未发布的草稿 Release（草稿 Release 资产不可通过公开 URL 访问，会导致 updater 静默失败）。
- 首次签名密钥生成后需要安全存档（如密钥丢失，所有已发布版本的用户都无法验证后续更新签名，需要重新分发新公钥——这是不可逆操作，需谨慎执行一次即可，不要重复生成）。
- 删除现有三个 retired workflow 是不可逆操作（虽可从 git 历史恢复），随本 RFC 实施时一并执行。

# RFC 0158 – Tauri release 产物补全 + updater `latest.json` 多平台验收

## Implementation principle (Photasa / Tauri)

> **Rust rewrite, not TypeScript copy.** Policy: [ROADMAP.md](../../ROADMAP.md).

**Status**: ⏳ Active  
**Created**: 2026-07-23  
**Area**: Tauri / CI / Updater  
**Supersedes（文档层面，部分）**: [0155](./0155-tauri-release-pipeline-as-built.md) 中 `workflow_run` + tag 猜测链路描述（已由 `workflow_call` 取代，见下文）  
**Related**: 0090, 0106, 0113, 0151, 0155, 0157

---

## Problem

`photasa-v2.0.0`（2026-07-23）首次走通 release-please + `upload-release-assets.yml`，但 **updater 仍不能视为生产就绪**：

| 现象                                                                                                    | 影响                                                                                 |
| ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| GitHub Release 仅有 macOS `aarch64` 包 + `latest.json`                                                  | Linux 用户无法安装/更新                                                              |
| `upload-release-assets` `ubuntu-latest` job **构建成功** 后 `tauri-action` 报 `No artifacts were found` | Linux 产物未上传                                                                     |
| `latest.json` 仅含 `darwin-aarch64` / `darwin-aarch64-app`                                              | `linux-x86_64` 缺失 → Linux `updater.check()` 无可用包                               |
| `verify-updater-artifact` 因 matrix 一腿失败被 **skip**                                                 | CI 未阻断「半套 release」                                                            |
| 旧 workflow 用 `workflow_run` + `git tag -l "v*"` 猜 tag                                                | `photasa-v2.0.0` 被跳过，workflow **绿但零产物**（已在 develop 修复，待合入 `main`） |

**客户端读 `latest.json` 的代码路径已存在**（`tauri.conf.json` endpoints + `tauri_plugin_updater` + `commands/update.rs`），**不需要**在前端/Rust 手写 JSON 解析。本 RFC 解决的是 **CI 如何把完整、可验签的多平台产物写入 GitHub Release**。

---

## 现状核实（2026-07-23）

### Release 链路（合入 PR #193 后）

```
push main
  → release.yml
       release-please（manifest/config，统一 workspace 版本）
       if release_created:
         workflow_call → upload-release-assets.yml
           inputs: tag_name, release_sha（来自 release-please outputs，不猜 tag）
           matrix: ubuntu-latest + macos-latest（Windows 仍由 PHOTASA_CI_WINDOWS_ENABLED 控制）
           tauri-action: build + sign + upload
           verify-updater-artifact: 全 matrix 成功后检查 latest.json
```

手动补发：`workflow_dispatch` + `tag_name`（例如 `photasa-v2.0.0`）。

### `photasa-v2.0.0` 实测

- **Release assets**：`latest.json`、`Photasa_aarch64.app.tar.gz`、`.sig`（仅 Apple Silicon）
- **`latest.json` URL**（`/releases/latest/download/latest.json`）：HTTP 200，`version: "2.0.0"`，platforms 仅 darwin aarch64
- **CI run `30044132458`**：`macos-latest` success；`ubuntu-latest` **failure** — `tauri build` 完成，日志列出 `deb`/`rpm`/`appimage` 路径，但 `tauri-action` 报 `##[error] No artifacts were found`

### Updater 运行时（无需本 RFC 改代码即可工作）

- 配置：`apps/photasa/src-tauri/tauri.conf.json` → `plugins.updater.endpoints` + `pubkey`
- 检查：`commands/update.rs` → `app.updater().check().await`
- 定时：`commands/update_periodic.rs`（启动 5s + 按偏好间隔）
- 前端：`legacy-api.ts` → `check_for_updates` / `download_update` / `install_update`

---

## Goals

1. **Linux release 产物稳定上传**到现有 GitHub Release（与 macOS 同一 tag）。
2. **`latest.json` 多平台完整**：至少 `darwin-aarch64` + `linux-x86_64`（与当前 CI matrix 一致）。
3. **CI 断言升级**：半套 release（缺 platform 或缺 `latest.json`）必须 **fail**，不能绿过。
4. **补发 `photasa-v2.0.0`**（或下一 patch）使 Latest release 对 macOS/Linux updater 可用。
5. **更新文档**：0155 中过时的 `workflow_run` 描述以本 RFC 为准。

## Non-goals

- 多 channel（beta/stable）endpoint 分流 — 另开 RFC 若需要。
- Windows CI 重新启用 — 仍由 `PHOTASA_CI_WINDOWS_ENABLED` 控制；本 RFC 仅预留验收项。
- 重写 updater UI（`UpdateSettings.vue` 仍经 legacy-api 薄封装）。

---

## Root-cause hypotheses（待验证，按优先级）

### H1 — Linux 未执行 bundle（已确认，2026-07-23）

**根因**：`tauri.conf.json` 中 `bundle.targets: ["app"]` 为 **macOS 专用**；在 Linux 上 `tauri build` 仅输出 `target/release/photasa` 二进制，**不生成** `bundle/deb|rpm|appimage/`。`tauri-action` 随后 `existsSync` 全部失败 → `No artifacts were found`。

CI run `30044132458` 日志仅见 `Built application at: .../target/release/photasa`，无 bundling 步骤。

**修复**：新增 `apps/photasa/src-tauri/tauri.linux.conf.json`，`bundle.targets: ["appimage", "deb", "rpm"]`（Tauri 自动 merge 平台配置）。`appimage` → updater `AppImage.tar.gz`；`deb`/`rpm` → Release 手动安装。macOS 仍用 `["app"]` → `.app.tar.gz` updater 包。

（日志中同时列出 `Photasa_*` 与 `photasa_*` 路径是 action 的候选列表，并非磁盘上已存在文件。）

### H2 — 并行 matrix 写同一 Release 的竞态

macOS 与 Linux 并行上传同一 tag；若 Linux 失败，macOS 已写入 **`latest.json` 仅含 darwin**。需在验收中要求 **最终** `latest.json` 含全部目标 platform（或改为串行 merge job — 仅当 H1 修复后仍复现时考虑）。

### H3 — 验收过弱

当前 `verify-updater-artifact` 只检查 `latest.json` **存在**，不检查 `platforms.linux-x86_64` 等键。macOS-only 上传会通过 mac job 侧的间接成功，整体 verify 被 skip。

### H4 — Intel macOS 不在矩阵

`macos-latest`（GitHub 现为 Apple Silicon）仅产出 `aarch64`。`darwin-x86_64` 需 `macos-13` 或 `x86_64` runner — **本 RFC P2**，不阻断 Linux。

---

## Decision

### Phase 1 — 修复 Linux 上传 + 强化验收（P0）

1. **调查并修复** `ubuntu-latest` 上 `tauri-action` 的 `No artifacts were found`（H1）。
2. **扩展 `verify-updater-artifact`**：
    - 下载 release 的 `latest.json`
    - 断言 `platforms.darwin-aarch64` 与 `platforms.linux-x86_64` 均存在且含 `url` + `signature`
    - 可选：断言 release assets 列表含预期文件名（deb 或 appimage tarball，与 updater 选用格式一致）
3. **手动 `workflow_dispatch`** 补全 `photasa-v2.0.0`（或发布 `2.0.1` patch）并手测 updater：
    - macOS aarch64 客户端：`check_for_updates` → `hasUpdate`（若本地 < 2.0.0）
    - Linux x86_64 客户端：同上
4. **更新** [UPDATER.md](../../apps/photasa/src-tauri/UPDATER.md) 与 0155 交叉引用：发布链路改为 `workflow_call`。

### Phase 2 — Updater 偏好对齐（P1，可选）

`AutoUpdateConfigState.allow_prerelease` 已持久化，但 **未**传入 `tauri_plugin_updater::Updater` builder。若未来需要 GitHub Prerelease 渠道，在 `perform_check_for_updates` 中读取配置并设置 `allow_prerelease`（或等价 API）。**默认行为不变**（仅 stable Latest）。

### Phase 3 — 平台矩阵补全（P2）

- Intel macOS：`darwin-x86_64` runner 或额外 matrix leg
- Windows：`PHOTASA_CI_WINDOWS_ENABLED=true` 后纳入同一验收矩阵

---

## Acceptance

### Phase 1（必须）

1. ✅ `upload-release-assets` 在 `ubuntu-latest` **成功**上传 Linux 产物到指定 tag。
2. ✅ 同一 tag 的 `latest.json` 同时包含 **`darwin-aarch64`** 与 **`linux-x86_64`**（URL 可下载，signature 非空）。
3. ✅ 任一 platform leg 失败或 `latest.json` 缺 platform 时，workflow **失败**（非 skip）。
4. ✅ `photasa-v2.0.0`（或后继 patch release）GitHub Latest 满足上项；`curl` 公网 `latest.json` 可验证。
5. ✅ 0155 / UPDATER.md 中发布触发描述与本 RFC 一致（`workflow_call`，非 `workflow_run` 猜 tag）。

### Phase 2（可选）

6. ⬜ `allow_prerelease` 偏好影响 `updater.check()` 行为，有 Rust 单测。

### Phase 3（可选）

7. ⬜ `darwin-x86_64` 出现在 `latest.json`（若产品仍需 Intel Mac 支持）。
8. ⬜ Windows 产物 + `windows-x86_64` 在 CI 启用后纳入验收。

---

## Implementation notes

| 区域                                            | 可能改动                                              |
| ----------------------------------------------- | ----------------------------------------------------- |
| `.github/workflows/upload-release-assets.yml`   | Linux 产物上传、verify jq 断言、失败策略              |
| `apps/photasa/src-tauri/tauri.conf.json`        | 必要时收敛 Linux `bundle.targets` 与 updater 格式一致 |
| `apps/photasa/src-tauri/src/commands/update.rs` | Phase 2 only：`allow_prerelease`                      |
| `apps/photasa/src-tauri/UPDATER.md`             | 发布链路与验收说明                                    |
| `.spec/rfc/0155-*.md`                           | 顶部一行指向本 RFC（不改正文历史）                    |

### 验证命令

```bash
# CI 绿后
curl -sL https://github.com/photasajs/photasa-app/releases/latest/download/latest.json | jq '.platforms | keys'

gh release view photasa-v2.0.0 --json assets --jq '.assets[].name'

# 本地（已安装旧版时）
# 设置 → 自动更新 → 立即检查更新
```

---

## Risks

- **并行上传**若持续导致 `latest.json` 被覆盖为单平台，需改为「分 platform 上传 + 最后合并 latest.json」或 tauri-action 推荐的多 job 模式 — 仅在 Phase 1 修复 H1 后仍复现时升级方案。
- **补发 2.0.0** 不 bump 版本时，已装 2.0.0 用户 `hasUpdate: false` 属预期；Linux 用户需 **新装** release 资产或等 2.0.1。
- **0155 Acceptance 4**「删除 latest.json 触发 fail」仍未在 CI 实跑 — 本 RFC Phase 1 合并 platform 断言后一并验证。

---

## References

- CI failure: `Upload Release Assets` run `30044132458` (`ubuntu-latest` → `No artifacts were found`)
- Release: `photasa-v2.0.0` assets（2026-07-23）
- PR #193: `workflow_call` + 去掉错误 `releaseId`
- [Tauri updater plugin](https://v2.tauri.app/plugin/updater/)
- [tauri-action](https://github.com/tauri-apps/tauri-action)

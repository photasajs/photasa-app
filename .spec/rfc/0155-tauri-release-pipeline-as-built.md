# RFC 0155 – Tauri release/updater pipeline：如实记录现状 + 补齐生产阻断缺口

## Implementation principle (Photasa / Tauri)

> **Rust rewrite, not TypeScript copy.** Policy: [ROADMAP.md](../../ROADMAP.md).

**Status**: ✅ Implemented（Acceptance 1/2/3/4/5/6/7/8 done；Acceptance 4 的"手动删除配置触发一次 workflow"验证步骤本身需实跑 CI 一次，见 Risks）
**Created**: 2026-07-22
**Area**: Tauri / Update / CI
**Supersedes（文档层面，非代码）**: [0113](./completed/0113-tauri-updater-production-and-prefs-sync.md) 第41-123行「GitHub Release 作为 updater 后端」章节、[0151](./completed/0151-tauri-cicd-redesign.md) 中对 `photasa-release.yml` 的引用
**Related**: 0090, 0106, 0107

---

## Problem

0113 和 0151 两份已归档 RFC 都描述了一个从未被构建的文件：`.github/workflows/photasa-release.yml`（`push:[main]+tags:[v*]` 双触发 + 手写 `base_ref` 校验）。实际实现走了完全不同的架构，且比文档描述的更简单。此外，实测发现两个生产阻断级配置缺口，与架构选择无关，任何架构下都会导致 updater 彻底不可用。

本 RFC 不改代码架构（现有 `release.yml`/`upload-release-assets.yml` 两段式判定为优于原设计，见下），只做两件事：（1）如实记录当前架构，取代 0113/0151 里的错误描述；（2）修复两个配置缺口。

## 现状核实（读源码，非猜测）

### 实际发布链路（与 0113/0151 描述不同）

```
push main
  → release.yml（release-please，仅 push:[main] 触发，无 tags 分支）
     → 打 vX.Y.Z tag + 建/更新 GitHub Release
  → upload-release-assets.yml（workflow_run 监听 "Release Please" workflow 完成）
     → 校验 tag SHA == release commit SHA（非每次 push 都发布，跳过则 should_upload=false 静默 no-op）
     → 校验 TAURI_SIGNING_PRIVATE_KEY secret 存在，缺失 fail-fast（第67-74行）
     → setup-photasa-toolchain（与 photasa-build.yml 共用，0151 Goal 5 落实）
     → tauri-apps/tauri-action@v0：build + 签名 + 上传 GitHub Release（第82-94行）
```

`develop` 分支不会进入这条链路——不是靠 `base_ref` 显式校验（0113 原设计），而是**结构性不可达**：`release.yml` 本身只在 `push:[main]` 触发，`upload-release-assets.yml` 只被动响应它的 `workflow_run`，`develop` 从源头就没有触发入口。这一点比 0113 原设计的「显式校验 + 依赖记住不要在 develop 手动触发」更彻底。

### 为什么保留这个架构，不补建 `photasa-release.yml`

三方审查（Linus / Kent Beck / Martin Fowler）一致结论：

- **Fowler**：`release-please` 已经是「何时发布」的权威判定者，`upload-release-assets.yml` 只负责「响应后做什么」，职责分离干净；0113 原设计的 `photasa-release.yml` 会重复一遍 `release-please` 已经在做的触发判断，是重复造轮子。
- **Linus**：`workflow_run` 链路结构性排除 `develop`，比 0113 手写的 `base_ref` 校验更不容易出错（校验代码本身也可能写错；结构性不可达没有「写错」这个失败模式）。
- **Kent**：现有实现已经有 fail-fast（签名密钥缺失检查，第67-74行）、已经用 `tauri-action`（不是手写 packager 逻辑），比从零重建更值得保留。

**唯一真实风险**（Fowler 指出）：`upload-release-assets.yml:9` 的 `workflows: ["Release Please"]` 是字符串名字匹配，`release.yml:1` 的 `name:` 一旦被改名，监听会静默失效——不报错，只是再也不触发。缓解措施见下方 Acceptance。

## Decision

1. **不新建 `photasa-release.yml`**。0113/0151 中所有指向该文件名的描述视为已被本 RFC 取代的过时设计草案，不再实施。
2. **修复 `bundle.createUpdaterArtifacts` 缺失**（生产阻断，见下）。
3. **修复 `pubkey` 为空**（生产阻断，见下）。
4. **`release.yml` 顶部加注释**，标注 `name: Release Please` 是跨文件契约（`upload-release-assets.yml` 靠这个名字触发），禁止随意改名。
5. **CI 加产物存在性断言**：`upload-release-assets.yml` 的 `tauri-action` 步骤之后新增一步，校验本次 Release 资产中存在 `latest.json`，不存在则 fail——把「workflow 跑绿」和「updater 真的可用」绑定，避免 `createUpdaterArtifacts` 类缺口未来再次静默复发且无人发现。
6. **`UPDATER.md` 第13行**（"pubkey 与 endpoints 为空，开发构建不会连生产更新服务器"）改为准确描述当前状态，消除与第37-50行的自相矛盾。

## 两个生产阻断缺口（按 blast radius 排序，Linus 判定）

### 1. `bundle.createUpdaterArtifacts` 从未设置（阻断程度：100%，无人能收到更新）

`apps/photasa/src-tauri/tauri.conf.json` 的 `bundle` 块（第72-83行）没有 `createUpdaterArtifacts` 字段，默认 `false`。`UPDATER.md:54` 自己写明此字段为 `true` 时才会生成签名更新包——即便 `pubkey`/`endpoints`/CI 签名步骤全部正确，没这个开关，`tauri-action` 也不产出 `.sig`/`latest.json`，`endpoints` 指向的 URL 会 404。

修复：

```json
"bundle": {
    "active": true,
    "targets": ["app"],
    "createUpdaterArtifacts": true,
    ...
}
```

### 2. `pubkey` 仍为空字符串（阻断程度：100%，签名验证必然失败）

`tauri.conf.json:92` `"pubkey": ""`。三个 workflow 里没有任何步骤注入真实公钥。updater 插件启动时用空 pubkey 验证下载包签名，必然失败。

修复（方案已定：公钥直接提交进仓库，非敏感信息，不走 CI 动态注入）：

1. 若尚未生成密钥对：`pnpm tauri signer generate -w ~/.tauri/photasa.key`
2. `~/.tauri/photasa.key.pub` 内容写入 `tauri.conf.json` → `plugins.updater.pubkey`，提交进仓库
3. 私钥内容存入 `TAURI_SIGNING_PRIVATE_KEY` GitHub Secret（`upload-release-assets.yml:87` 已引用此 secret 名，无需改动）

**风险**：密钥一旦生成并有用户安装了用该密钥签名的版本，后续不可更换公钥（换了所有已装用户都验证失败、拿不到新版本）——生成前确认这是最终密钥，不要重复生成占位密钥。

**✅ 2026-07-22 已执行**（密钥经过一次重新生成，见下）：

- 第一次生成：`tauri-cli 2.9.6` 无密码密钥在非交互终端签名必崩（`incorrect updater private key password: Device not configured (os error 6)`）——`--ci`/`-p ""`/unset 三种"求无密码"方式均触发同一个 CLI bug，与配置正确性无关。CI runner 正是非交互环境，无密码密钥在 CI 里会同样失败。
- 改用带密码密钥后本地验证通过，但密码由 AI 生成、只写入 GitHub Secret，用户本人未持有明文——不满足"密钥丢失可恢复"的备份要求。
- **最终版**：重新生成第二对密钥对，密码由用户本人提供并留存，公钥 `D83AB98591C7FA55` 已写入 `tauri.conf.json`，私钥+密码已更新进 `photasajs/photasa-app` 仓库的 `TAURI_SIGNING_PRIVATE_KEY`/`TAURI_SIGNING_PRIVATE_KEY_PASSWORD` Secrets（2026-07-22T19:07 UTC）。本地 `tauri build`（release profile）验证产出 `target/release/bundle/macos/Photasa.app.tar.gz.sig`，签名机制确认可用。
- **结论**：CI 若使用无密码密钥需先确认 tauri-cli 版本是否修复此 bug，否则必须使用带密码密钥；密钥生成后密码必须由密钥所有者本人持有备份，不能只存在单一 CI Secret 里（唯一副本风险）。

## Non-goals

- 不新建独立更新服务器（RFC 0020 方案已被 GitHub Release 方案取代）。
- 不重写 `upload-release-assets.yml` 的整体触发架构（`workflow_run` 链路判定为优于 0113 原设计，予以保留）。
- 不回填修改 `completed/0113`、`completed/0151` 正文本身——按 Fowler 判断，`completed/` 是历史意图快照，本 RFC 作为新记录取代其描述，不篡改归档文件（可在两者顶部各加一行指向本 RFC 的引用，见 Acceptance 5）。

## Acceptance

1. ✅ `tauri.conf.json` 的 `bundle.createUpdaterArtifacts` 为 `true`。
2. ✅ `tauri.conf.json` 的 `plugins.updater.pubkey` 为非空真实公钥（`D83AB98591C7FA55`，用户本人持有密码备份）。
3. ✅ 本地执行一次 `tauri build`（release profile），确认产出 `.sig` 文件（`target/release/bundle/macos/Photasa.app.tar.gz.sig`，2026-07-22 已验证两次：初版密钥 + 最终密钥）。`latest.json` 由 `tauri-action` 在实际 GitHub Release 发布流程中生成，本地单机 build 不产出该文件，留待 CI 实跑验证。
4. ✅ `upload-release-assets.yml` 新增「Verify updater artifact was published」步骤，`tauri-action` 之后用 `gh release view --json assets` 校验 `latest.json` 存在，不存在则 fail-fast。**「人为删除配置后触发一次 workflow 确认断言生效」这一手动验证动作尚未实跑**——断言代码已落地，但未在真实 CI 环境验证过它会在预期场景下正确触发失败。
5. ✅ `completed/0113-...md` 与 `completed/0151-...md` 顶部已各加一行指向本 RFC 的说明。
6. ✅ `UPDATER.md:13` 已更新为准确描述，不再与配置现状矛盾。
7. ✅ `release.yml` 顶部已加注释标注 `name: Release Please` 为跨文件契约。
8. ✅（新增，本次审查发现）`upload-release-assets.yml` 原 matrix 的 `bundle_globs` 死字段已清理，matrix 简化为仅 `os` 列表，加注释说明 `tauri-action` 自管构建产物。

## Risks

- 密钥生成与写入 `pubkey` 是一次性操作，写错或用占位符提交会导致后续排查困难——执行前确认密钥来源可靠、私钥已安全存入 Secret。
- `workflow_run` 名字匹配耦合（`upload-release-assets.yml:9` ↔ `release.yml:1`）已用注释缓解（Acceptance 7），未做结构性根除（结构性根除需改用 `workflow_call` 显式调用，超出本 RFC 范围，如需要另开 RFC）。
- Acceptance 4 的产物存在性断言代码已落地，但**未经真实 CI 运行验证**——下一次 `main` 分支产生真实 release 时才是第一次实战验证机会；若断言逻辑本身有误（如 `gh release view` 权限不足、`jq` 过滤条件写错），要等到那次 release 才会暴露。

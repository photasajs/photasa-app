# RFC 0157 – Dev 与 Prod 版 Photasa 同机并存

## Implementation principle (Photasa / Tauri)

> **Rust rewrite, not TypeScript copy.** Policy: [ROADMAP.md](../../ROADMAP.md).

**Status**: 🔨 Draft
**Created**: 2026-07-22
**Area**: Tauri / Build / CI
**Related**: 0155（release 流水线）、0100（单实例，`identifier` 作用域——**下方标注为待验证假设，见 Risks**）

---

## Problem

`apps/photasa/src-tauri/tauri.conf.json` 中 `identifier: "me.photasa.app"`（第5行）与 `productName: "Photasa"`（第3行）是全局唯一的。**本地日常开发**若直接跑裸 `tauri dev` / 手敲 `tauri build --debug`（无 `--config`），与 **已安装的 prod 包**（CI release 产出）共用同一份主配置，因而共用同一个 `identifier`。**本 RFC 落地后，Dev 通道仅指 `pnpm dev` / `pnpm build:debug`（均带 `tauri.dev.conf.json`）；手敲 CLI 无 `--config` 仍属 prod 通道，不在本 RFC 保证范围内。**

Tauri 的 `app_data_dir()`（`apps/photasa/src-tauri/src/main.rs:125`）由 `identifier` 派生——macOS 上是 `~/Library/Application Support/me.photasa.app`，Windows/Linux 同理按 identifier 生成路径。**同一 identifier 意味着 dev 和 prod 两个进程会读写同一份 `preferences.json`、同一个 scan 队列持久化文件、同一套 folder tree 状态**——不是"能不能同时开两个窗口"的问题，是同时开着会互相破坏对方数据。

[RFC 0100](./completed/0100-tauri-single-instance.md) 的 `tauri-plugin-single-instance` 同样以 `tauri.conf.json` 的 `identifier` 为锁作用域（Windows 互斥体名、Linux D-Bus 名、macOS `/tmp/{identifier}_si.sock`）。**dev 与 prod 共用 `me.photasa.app` 时，单实例锁也共用**——例如 prod 已运行时再 `pnpm dev`，第二进程会被当作「重复启动」而聚焦 prod 主窗并退出，无法正常并行开发；反之亦然。需要 **每个通道各自单实例**（通道内仍只允许一个进程），而不是 dev/prod 互斥。

此外：

- macOS 上 `.app` bundle 若 `productName` 相同，装在 `/Applications/Photasa.app` 会互相覆盖，无法同时保留两份安装。
- Dock/任务栏图标无法区分，用户会分不清哪个是 dev 哪个是 prod。
- Vite dev server 固定端口 `1421`（`tauri.conf.json:9`）——**这一点不冲突**，因为 prod 是打包后的 app，不启动 dev server，只有两个 `tauri dev` 实例才会撞这个端口（本 RFC 不处理"两个 dev 实例同跑"，只处理"一个 dev + 一个 prod 同跑"）。

## Goals

1. Dev 构建使用独立 `identifier`（→ 独立数据目录，不与 prod 互相污染）。
2. Dev 构建使用独立 `productName`（→ 独立 `.app`/`.exe` 安装位置，不互相覆盖），建议加后缀区分（如 `Photasa Dev`）。
3. Dev 与 prod **各自**维持 RFC 0100 单实例语义（通道内第二个进程聚焦首实例并退出），但 **dev 与 prod 之间不互斥**——可同时各跑一个实例（依赖独立 `identifier` 驱动插件锁，无需改 `main.rs`）。
4. 窗口标题 / `productName` 文字可区分 dev 与 prod（不新增图标资产，见 Non-goals）。
5. CI（RFC 0155 的 `upload-release-assets.yml`）产出的 release 产物**不受影响**，仍使用 prod identifier——本 RFC 只新增 dev 侧配置，不改 prod 路径。
6. 本地 `pnpm --filter @photasa/photasa dev` / `build:debug` 默认走 dev identifier，无需额外参数（改默认值，不是加 flag 靠记忆）。

## Build channels（术语，避免与 CI `--debug` 混淆）

| 通道                     | `identifier`         | 单实例锁           | 谁构建                                                                          | 是否发布                                           |
| ------------------------ | -------------------- | ------------------ | ------------------------------------------------------------------------------- | -------------------------------------------------- |
| **Dev**（`Photasa Dev`） | `me.photasa.app.dev` | 仅 dev 通道内互斥  | **仅本机**（`pnpm dev` / `pnpm build:debug` + `tauri.dev.conf.json`）           | 否，**CI/CD 从不构建**                             |
| **Prod**（`Photasa`）    | `me.photasa.app`     | 仅 prod 通道内互斥 | **CI/CD**（`photasa-build.yml` 编译门禁 + `upload-release-assets.yml` release） | 仅 `upload-release-assets.yml` 上传 GitHub Release |

**铁律**：`tauri.dev.conf.json` **不得**出现在任何 `.github/workflows/**` 或 release 脚本中。CI 里的 `tauri build --debug`（`tauri:build:ci`）是 **prod 配置 + debug profile 的编译冒烟**，不是 Dev 产物；profile 为加速/跳过签名，**identifier 仍是 `me.photasa.app`**。

## Decision

Tauri 官方支持多配置文件叠加（`tauri build --config <path>` / `tauri dev --config <path>`），后者覆盖 `tauri.conf.json` 中的指定字段，不需要维护两份完整配置。

**本 RFC 的核心改动**（其余脚本/机制均为已存在、本 RFC 不碰，仅作背景说明，见下方「不受影响的既有脚本」）：

1. 新增 `apps/photasa/src-tauri/tauri.dev.conf.json`，覆盖 `productName` / `identifier` / 窗口标题，以及 **dev 专用 updater 空端点**（见 Decision §5）：

```json
{
    "productName": "Photasa Dev",
    "identifier": "me.photasa.app.dev",
    "app": {
        "windows": [
            {
                "title": "Photasa (Dev)"
            }
        ]
    },
    "plugins": {
        "updater": {
            "endpoints": []
        }
    }
}
```

实现前需先做一次手工 spike 确认 Tauri v2 `--config` 的合并语义（深合并还是浅合并，尤其 `app.windows` 数组）——见 Acceptance 0，这是决定 overlay 是否需要重复声明 `width`/`height` 等字段的前置条件，不是事后风险记录。

2. `apps/photasa/package.json` 中 **本地 Dev 脚本**改为携带 `--config`（**CI 脚本不改**）：

```json
{
    "scripts": {
        "dev": "tauri dev --config src-tauri/tauri.dev.conf.json",
        "tauri:dev": "tauri dev --config src-tauri/tauri.dev.conf.json",
        "build:debug": "tauri build --debug --config src-tauri/tauri.dev.conf.json"
    }
}
```

`tauri:dev` 与 `dev` 必须一致，避免别名绕过 dev overlay 仍用 prod `identifier`（进而与 prod 共用数据目录与单实例锁）。

### 脚本归属（CI = prod，本地 Dev 脚本 = dev）

| 脚本                    | 运行者         | 通道 | `identifier`         | `--config`                                         |
| ----------------------- | -------------- | ---- | -------------------- | -------------------------------------------------- |
| `dev` / `tauri:dev`     | 开发者         | Dev  | `me.photasa.app.dev` | `tauri.dev.conf.json`                              |
| `build:debug`           | 开发者         | Dev  | `me.photasa.app.dev` | `tauri.dev.conf.json`                              |
| `build` / `tauri:build` | 开发者（少见） | Prod | `me.photasa.app`     | 无                                                 |
| `tauri:build:ci`        | **仅 CI**      | Prod | `me.photasa.app`     | 无（主配置 + 内联 `createUpdaterArtifacts:false`） |

3. **单实例（RFC 0100）**：`main.rs` 中 `tauri_plugin_single_instance::init` **无需修改**。插件从运行时 `app.config().identifier` 派生锁名；dev overlay 换成 `me.photasa.app.dev` 后，dev 与 prod 自动获得**独立**单实例域。验收：prod 运行中再启 dev，两个进程均应存活；同一通道内第二次启动仍应聚焦首实例并退出（行为与现网 prod 一致）。

### 不受影响的既有脚本（本 RFC 不新增、不修改，仅说明现状供对照）

- `build`（`tauri build`，本地 prod release，日常开发不用）——**已存在，不改**。
- `tauri:build:ci`（`tauri build --debug -c "{...createUpdaterArtifacts:false...}"`，仅 `photasa-build.yml` 调用，走主 `tauri.conf.json` prod identifier，`--debug` 仅为编译门禁）——**已存在，不改**。`upload-release-assets.yml` 经 `tauri-action` 读主配置 release profile，与 `tauri:build:ci` 同属 prod 通道，区别仅 profile/签名。

`tauri:build:ci` 的内联 JSON override 与本 RFC 新增的文件式 overlay 是两种不同机制解决同类问题（配置差异化）——目前范围小（`tauri:build:ci` 只覆盖一个布尔值）暂不构成问题，但若未来 CI 侧需要覆盖更多字段，应考虑改用同款 `tauri.ci.conf.json` overlay 文件统一机制，而非继续堆叠内联 JSON 字符串（可读性/可 diff 性更差）。本 RFC 不在当前范围内做这个统一，仅记录以避免日后重复踩坑。

4. Dev 图标：复用现有 icon 集合，不新增设计资产（Non-goal，见下）——`productName`/窗口标题的文字区分已经足够满足"能分清哪个是哪个"的需求，不因为这个 RFC 去做图标设计。

5. **`updater`（已决策）**：`tauri.dev.conf.json` **显式覆盖** updater 端点为空数组，dev 不连接生产更新服务器：

```json
"plugins": {
    "updater": {
        "endpoints": []
    }
}
```

`pubkey` 不写入 dev overlay（继承主配置无实际影响——无 `endpoints` 则不会拉取 `latest.json`）。Prod 通道仍用主 `tauri.conf.json` 的完整 updater 配置（RFC 0155）。理由：dev 与 prod 数据/身份已隔离，无需让 dev 进程具备触达生产更新源的能力；比「继承 prod endpoints 但指望 identifier 防误装」更干净。

## CI/CD 影响（RFC 0155 协同）

**CI/CD 只构建 prod（`me.photasa.app`），从不构建 Dev（`me.photasa.app.dev`）。**

| Workflow                    | 配置                                                                                           | 产物性质                             |
| --------------------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------ |
| `photasa-build.yml`         | 主 `tauri.conf.json` + `tauri:build:ci`（`--debug`，无 updater 签名，**已存在，本 RFC 不改**） | Prod identifier 编译冒烟，**不发布** |
| `upload-release-assets.yml` | 主 `tauri.conf.json` + `tauri-action` release（**已存在，本 RFC 不改**）                       | **唯一**对外发布的 prod 安装包       |

本 RFC **不改动** workflow 的触发条件、矩阵或构建产物（仍调用 `tauri:build:ci` → prod identifier），但 **在 `photasa-build.yml` 新增一步 grep 门禁**（见 Acceptance 7）——这是策略校验，不是换构建通道。门禁扫描 `.github/workflows/**` 与 `apps/photasa/package.json` 的 `tauri:build:ci`，确保 dev overlay 未渗入 CI/prod 脚本。

验收时勿把 `photasa-build.yml` 的 debug profile 说成「CI 在构建 dev 版」——那是 prod 配置的快速编译检查。

### Build channels 表格归属说明

本节上方的"通道"表格（见 Goals 之后）描述的是长期有效的团队协作策略（谁构建什么、是否发布），不是本 RFC 特有的一次性设计决策。RFC 完成后会归档到 `.spec/rfc/completed/`，成为历史快照；但"Dev/Prod 通道划分"这条策略应该持续维护、易于发现。**落地时必须执行 Acceptance 8**：把 Build channels 表与脚本归属表迁入 `ROADMAP.md`（Photasa 小节），本 RFC 归档后只保留指向 `ROADMAP.md` 的链接。

## Non-goals

- 不做 dev 专属图标设计（用窗口标题/productName 文字区分即可）。
- 不改变 RFC 0100 单实例语义（通道内仍单实例）；本 RFC 通过独立 `identifier` 实现 **dev 与 prod 各一套锁**，不是取消单实例。
- 不支持「同一通道内两个 dev 实例同时跑」（例如两个 `pnpm dev` 仍受 dev 单实例锁约束；若需并行多 dev 实例，需另开 RFC 改 `devUrl` 端口与单实例策略）。
- 不新增 CI workflow、不改动任何 workflow 的触发条件或构建产物——本 RFC 唯一涉及 CI 的改动是 `photasa-build.yml` 内新增一步字符串 grep 门禁（见 Acceptance 7），**不改变该 workflow 构建什么、何时触发**；grep 仅校验 dev 配置未渗入 CI/prod 脚本。本 RFC 核心仍是**本地** Dev/Prod 并存；**CI/CD 仅 prod**。
- 不引入 beta/nightly 等第三套发布通道——只解决"一份 dev 一份 prod 同机共存"，不是多通道发布策略设计。

## Acceptance

0. **实施前置 spike**：手工执行一次 `tauri dev --config src-tauri/tauri.dev.conf.json`（仅含 `productName`/`identifier`/窗口标题三个字段），检查主配置里其他窗口属性（`width`/`height` 等，见 `tauri.conf.json` 现有 `app.windows[0]`）是否在合并后保留。确认 Tauri v2 `--config` 是深合并还是浅合并——若是浅合并（数组整体替换），`tauri.dev.conf.json` 的 `app.windows` 必须补全所有原有窗口字段，不能只写 `title`。此项必须先做，结果决定 Decision 第1条最终文件内容，不能跳过直接实现。
1. `apps/photasa/src-tauri/tauri.dev.conf.json` 存在，覆盖 `productName`/`identifier`/窗口标题（或按 Acceptance 0 补全的窗口字段）及 `plugins.updater.endpoints: []`。
2. `pnpm --filter @photasa/photasa dev` 默认使用 dev identifier 启动（无需手动加参数）。
3. **自动化测试**（Vitest，纯 Node，不依赖 Tauri 运行时）：
    - 解析 `tauri.conf.json` 与 `tauri.dev.conf.json`，断言 `devConfig.identifier !== baseConfig.identifier` 且 `devConfig.identifier === baseConfig.identifier + ".dev"`。
    - 解析 `apps/photasa/package.json` 的 `scripts`：`dev`、`tauri:dev`、`build:debug` 均包含 `tauri.dev.conf.json`；`tauri:build:ci` **不得**包含 `tauri.dev.conf.json` 或 `me.photasa.app.dev`。
      把数据目录隔离与脚本通道归属固化为可重复回归，不依赖人工每次改配置后 `ls ~/Library/Application Support/`。
4. 首次实现后人工验证一次：同时安装一份 prod release 包与运行一次 dev 构建，`ls ~/Library/Application Support/` 确认两个独立目录物理存在（一次性确认底层机制真实生效，之后靠 Acceptance 3 的自动化测试防回归，不需要每次改动都重复人工步骤）。
5. 验证 dev 窗口标题可与 prod 版区分（人工确认，非自动化——视觉判断无法机械化，一次性确认即可）。
6. **单实例（RFC 0100）**：prod 已运行时启动 `pnpm dev`（dev 通道），两进程均存活；再启动第二个 dev（或第二个 prod）时，该通道内仍只保留一个实例（第二进程聚焦首实例并退出）。一次性人工验收即可。
7. **CI / prod 脚本门禁**：`photasa-build.yml` 新增一步，fail-fast 若任一项匹配：
    - `.github/workflows/**` 中出现 `tauri.dev.conf.json` 或 `me.photasa.app.dev`；
    - `apps/photasa/package.json` 的 `tauri:build:ci` 脚本中出现上述字符串或 `--config src-tauri/tauri.dev.conf.json`。
      门禁本身要有一次验证：临时在 workflow 或 `tauri:build:ci` 中插入违规字符串，确认步骤报错，然后撤销。
8. **Living doc**：`ROADMAP.md` Photasa 小节写入 Build channels 表 + 脚本归属表（与本文 Decision 节一致），并注明「日常开发用 `pnpm dev`，勿用手敲裸 `tauri dev`」。

## Risks

- `identifier` 变更会改变 `app_data_dir()` 路径——**这不是小事，需要在合入当天用醒目方式通知团队（PR 描述加粗提示，不能只写在本 RFC 的 Risks 段落里）**：若开发者本机已经用主 identifier 跑过大量 dev 数据（旧 scan 队列、旧 preferences），迁移到 dev identifier 后这些历史数据不会自动迁移；首次切换后本地 dev 环境会表现得像全新安装，旧数据仍在原 `me.photasa.app` 目录下未丢失，但 dev 会话看不到它。预期行为、非 bug，但对没看这份 RFC 的团队成员是纯粹的意外。
- 若 `dev` / `tauri:dev` / `build:debug` 未全部挂上 `--config`，会悄悄回到 prod `identifier`，表现为数据互踩 **且** dev 与 prod 共用单实例锁（RFC 0100 插件仍生效，但锁名相同）——实现时三个脚本必须同改，并在 code review 中核对。
- `tauri:build:ci` 现有的内联 JSON `-c` override（`package.json`，本 RFC 不改）与本 RFC 新增的文件式 overlay 是两种不同机制解决同类"配置差异化"问题——见 Decision 节内说明，当前范围小暂不构成问题，但如果 CI 侧未来需要覆盖更多字段，两种机制并存会增加认知负担和漂移风险，建议届时统一为同一种（文件 overlay）。
- Acceptance 0 的 spike 若发现是浅合并，Decision 第1条的 `tauri.dev.conf.json` 内容需要扩充（补全窗口字段），这会略微增加 overlay 文件的行数，但不改变本 RFC 的整体方案（仍是单一 overlay 文件 + 两行脚本改动）。

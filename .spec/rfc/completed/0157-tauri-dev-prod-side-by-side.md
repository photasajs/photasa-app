# RFC 0157 – Dev 与 Prod 版 Photasa 同机并存

## Implementation principle (Photasa / Tauri)

> **Rust rewrite, not TypeScript copy.** Policy: [ROADMAP.md](../../../ROADMAP.md).

**Status**: ✅ Implemented（2026-07-23 归档核实：`tauri.dev.conf.json`、`package.json` dev/build:debug/build:ci 三脚本、`apps/photasa/DEVELOPMENT.md`、`apps/photasa/src/__tests__/build-channels.test.ts`（9/9 通过）、`scripts/ci/guard-prod-build-channel.sh`（已接入 `photasa-build.yml:40`）均落地并实测通过；Acceptance 0 的深浅合并疑问已由测试断言确认为浅合并/array-replace，`tauri.dev.conf.json` 相应补全全部窗口字段。Acceptance 6（单实例双开运行时验证）为人工项，未随本次归档核实）
**Created**: 2026-07-22
**Area**: Tauri / Build / CI
**Related**: 0155（release 流水线）、0100（单实例，`identifier` 作用域——**已用 `tauri-plugin-single-instance` 2.4.1 三平台源码验证，见 Problem 节**）

---

## Problem

`apps/photasa/src-tauri/tauri.conf.json` 中 `identifier: "me.photasa.app"`（第5行）与 `productName: "Photasa"`（第3行）是全局唯一的。**本地日常开发**若直接跑裸 `tauri dev` / 手敲 `tauri build --debug`（无 `--config`），与 **已安装的 prod 包**（CI release 产出）共用同一份主配置，因而共用同一个 `identifier`。**本 RFC 落地后，Dev 通道仅指 `pnpm dev` / `pnpm build:debug`（均带 `tauri.dev.conf.json`）；手敲 CLI 无 `--config` 仍属 prod 通道，不在本 RFC 保证范围内。**

Tauri 的 `app_data_dir()`（`apps/photasa/src-tauri/src/main.rs:125`）由 `identifier` 派生——macOS 上是 `~/Library/Application Support/me.photasa.app`，Windows/Linux 同理按 identifier 生成路径。**同一 identifier 意味着 dev 和 prod 两个进程会读写同一份 `preferences.json`、同一个 scan 队列持久化文件、同一套 folder tree 状态**——不是"能不能同时开两个窗口"的问题，是同时开着会互相破坏对方数据。

**✅ 已用源码验证**（三方审查曾指出此前只是推测，现已核实）：[RFC 0100](./0100-tauri-single-instance.md) 的 `tauri-plugin-single-instance`（本仓库锁定版本 `2.4.1`，见 `apps/photasa/src-tauri/Cargo.toml:60`）**确实**以 `identifier` 为锁作用域，三平台源码逐一确认：

- **macOS**（`platform_impl/macos.rs:60-61`）：`socket_path()` 直接用 `config.identifier` 拼出 `/tmp/{identifier}_si.sock`，`config` 即运行时 `app.config()`（经 `--config` overlay 合并后的结果）。
- **Windows**（`platform_impl/windows.rs:58,67`）：`app.config().identifier` 拼出 mutex 名 `{id}-sim`，`CreateMutexW` 用该名字创建互斥体。
- **Linux**（`platform_impl/linux.rs:37-38`）：`app.config().identifier` 拼出 D-Bus 服务名 `{identifier}.SingleInstance`。

三平台均直接读取运行时 `identifier`，不缓存、不需要额外传参，`main.rs` 中 `tauri_plugin_single_instance::init()` 的调用点本身不需要显式传入 identifier——插件在 `setup` 回调内部通过 `app.config()` 自行取值。**结论：dev overlay 切换 identifier 后，单实例锁自动获得独立作用域，Decision §3 与 Goals 第3条的设计成立，`main.rs` 确实无需修改。**

此外：

- macOS 上 `.app` bundle 若 `productName` 相同，装在 `/Applications/Photasa.app` 会互相覆盖，无法同时保留两份安装。
- Dock/任务栏图标无法区分，用户会分不清哪个是 dev 哪个是 prod。
- Vite dev server 固定端口 `1421`（`tauri.conf.json:9`）——**这一点不冲突**，因为 prod 是打包后的 app，不启动 dev server，只有两个 `tauri dev` 实例才会撞这个端口（本 RFC 不处理"两个 dev 实例同跑"，只处理"一个 dev + 一个 prod 同跑"）。
- **`updater` 周期性检查**（已用代码验证，非假设）：`main.rs` 在 setup 阶段无条件注册 `tauri_plugin_updater`，并对非 mobile 构建启动周期性更新检查任务——**包括 dev 构建**。dev 若继承主配置的 `plugins.updater.endpoints`（指向 prod 的 GitHub `latest.json`），运行中的 dev 进程会真实轮询 prod 发布源，可能提示"更新"并引导安装 prod 安装包，与 dev 本身产生混淆甚至覆盖风险。**identifier 隔离本身不解决这个问题**——updater 插件不读取 identifier 做区分，这是 Decision §5 需要显式清空 dev 侧 `endpoints` 的根本原因，不是锦上添花的额外保护。

## Goals

1. Dev 构建使用独立 `identifier`（→ 独立数据目录，不与 prod 互相污染）。
2. Dev 构建使用独立 `productName`（→ 独立 `.app`/`.exe` 安装位置，不互相覆盖），建议加后缀区分（如 `Photasa Dev`）。
3. Dev 与 prod **各自**维持 RFC 0100 单实例语义（通道内第二个进程聚焦首实例并退出），且 **dev 与 prod 之间不互斥**——可同时各跑一个实例（已用源码验证，见 Problem 节；`main.rs` 无需改动，仅靠 dev overlay 切换 `identifier` 即达成）。
4. 窗口标题 / `productName` 文字可区分 dev 与 prod（不新增图标资产，见 Non-goals）。
5. CI（RFC 0155 的 `upload-release-assets.yml`）产出的 release 产物**不受影响**，仍使用 prod identifier——本 RFC 只新增 dev 侧配置，不改 prod 路径。
6. 本地 `pnpm --filter @photasa/photasa dev` / `build:debug` 默认走 dev identifier，无需额外参数（改默认值，不是加 flag 靠记忆）。

## Decision

Tauri 官方支持多配置文件叠加（`tauri build --config <path>` / `tauri dev --config <path>`），后者覆盖 `tauri.conf.json` 中的指定字段，不需要维护两份完整配置。

**本 RFC 的核心改动**（其余脚本/机制均为已存在、本 RFC 不碰，仅作背景说明，见下方「不受影响的既有脚本」）：

1. 新增 `apps/photasa/src-tauri/tauri.dev.conf.json`，覆盖 `productName` / `identifier` / 窗口标题，以及 **dev 专用 updater 空端点**（已用代码验证为必要，见 Decision §5）：

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

> **⚠️ 该 JSON 未必是最终形态**：Tauri v2 `--config` 的合并语义（深合并还是浅合并，尤其 `app.windows` 数组）尚未验证——见下方 Acceptance 0。若验证结果为浅合并（数组整体替换而非按字段合并），上面 `app.windows` 必须补全主配置里的 `width`/`height` 等其余字段，不能只写 `title`，否则会静默丢失窗口尺寸设置。**实现前必须先跑 Acceptance 0 的 spike，再决定这份 JSON 的最终内容**，不要直接照抄本示例。

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

`tauri:dev` **当前已存在于 `package.json`（值为裸 `"tauri dev"`），本 RFC 是修改其内容加上 `--config`，不是新增脚本**——原稿曾误写成"新增"，此处订正。`tauri:dev` 与 `dev` 必须保持一致，避免开发者误用其中一个别名时绕过 dev overlay、仍落回 prod `identifier`（进而与 prod 共用数据目录、以及若 Problem 节假设成立则共用单实例锁）。

### 各表用途说明（避免多表信息重复漂移）

以下只保留「脚本归属表」承载逐脚本细节；原稿中单独的「Build channels」表与「CI/CD 影响」表所描述的通道级事实（谁构建、是否发布）与脚本归属表高度重叠，已合并进本节说明，不再单独成表，减少后续维护时需要同步的位置数。

### 脚本归属（CI = prod，本地 Dev 脚本 = dev；唯一权威表）

| 脚本                                          | 运行者         | 通道 | `identifier`         | `--config`                                         | 是否发布                    |
| --------------------------------------------- | -------------- | ---- | -------------------- | -------------------------------------------------- | --------------------------- |
| `dev` / `tauri:dev`                           | 开发者         | Dev  | `me.photasa.app.dev` | `tauri.dev.conf.json`                              | 否，CI/CD 从不构建 Dev 通道 |
| `build:debug`                                 | 开发者         | Dev  | `me.photasa.app.dev` | `tauri.dev.conf.json`                              | 否                          |
| `build` / `tauri:build`                       | 开发者（少见） | Prod | `me.photasa.app`     | 无                                                 | 否（本地产物，非发布渠道）  |
| `tauri:build:ci`（仅 `photasa-build.yml`）    | **仅 CI**      | Prod | `me.photasa.app`     | 无（主配置 + 内联 `createUpdaterArtifacts:false`） | 否，仅编译门禁              |
| `upload-release-assets.yml`（`tauri-action`） | **仅 CI**      | Prod | `me.photasa.app`     | 无（主配置 release profile）                       | **是**，唯一对外发布路径    |

**铁律**：`tauri.dev.conf.json` **不得**出现在任何 `.github/workflows/**` 或 release 脚本中。CI 里的 `tauri:build:ci`（`tauri build --debug`）是 **prod 配置 + debug profile 的编译冒烟**，不是 Dev 产物；profile 为加速/跳过签名，**identifier 仍是 `me.photasa.app`**。此铁律由 Acceptance 7 的 CI grep 门禁机械化执行，不只依赖本段文字约束。

3. **单实例（RFC 0100，机制已验证）**：`main.rs` 中 `tauri_plugin_single_instance::init` **无需修改**——插件在 `setup` 回调内通过 `app.config().identifier` 自行派生锁作用域（源码依据见 Problem 节），dev overlay 换成 `me.photasa.app.dev` 后即自动获得独立单实例域，不依赖任何额外传参。验收标准见 Acceptance 6：prod 运行中再启 dev，两个进程均应存活；同一通道内第二次启动仍应聚焦首实例并退出（行为与现网 prod 一致）。

### 不受影响的既有脚本（本 RFC 不新增，`build`/`tauri:build:ci` 内容不修改，仅说明现状供对照）

- `build`（`tauri build`，本地 prod release，日常开发不用）——**已存在，内容不改**。
- `tauri:build:ci`（`tauri build --debug -c "{...createUpdaterArtifacts:false...}"`，仅 `photasa-build.yml` 调用，走主 `tauri.conf.json` prod identifier，`--debug` 仅为编译门禁）——**已存在，内容不改**。`upload-release-assets.yml` 经 `tauri-action` 读主配置 release profile，与 `tauri:build:ci` 同属 prod 通道，区别仅 profile/签名。

`tauri:build:ci` 的内联 JSON override 与本 RFC 新增的文件式 overlay 是两种不同机制解决同类问题（配置差异化）——目前范围小（`tauri:build:ci` 只覆盖一个布尔值）暂不构成问题，但若未来 CI 侧需要覆盖更多字段，应考虑改用同款 `tauri.ci.conf.json` overlay 文件统一机制，而非继续堆叠内联 JSON 字符串（可读性/可 diff 性更差）。本 RFC 不在当前范围内做这个统一，仅记录以避免日后重复踩坑。

4. Dev 图标：复用现有 icon 集合，不新增设计资产（Non-goal，见下）——`productName`/窗口标题的文字区分已经足够满足"能分清哪个是哪个"的需求，不因为这个 RFC 去做图标设计。

5. **`updater`（已用代码验证为必要，非可选加固）**：`tauri.dev.conf.json` **显式覆盖** updater 端点为空数组，阻止 dev 连接生产更新服务器：

```json
"plugins": {
    "updater": {
        "endpoints": []
    }
}
```

`pubkey` 不写入 dev overlay（继承主配置无实际影响——无 `endpoints` 则不会拉取 `latest.json`）。Prod 通道仍用主 `tauri.conf.json` 的完整 updater 配置（RFC 0155）。**理由（已证实，非猜测）**：`main.rs` 无条件注册 updater 插件并对非 mobile 构建启动周期性检查任务，该检查不区分 identifier；若不清空，运行中的 dev 进程会真实轮询 prod 的 GitHub Release `latest.json`，可能提示更新并引导安装 prod 包——这是 identifier 隔离完全不覆盖的独立失效路径，必须单独处理。

## CI/CD 影响（RFC 0155 协同）

**CI/CD 只构建 prod（`me.photasa.app`），从不构建 Dev（`me.photasa.app.dev`）**——具体谁构建什么、是否发布，以上方「脚本归属」表为准，本节不重复列出，只说明本 RFC 对 CI 的唯一改动。

本 RFC **不改动** workflow 的触发条件、矩阵或构建产物（仍调用 `tauri:build:ci` → prod identifier），但 **在 `photasa-build.yml` 新增一步 grep 门禁**（见 Acceptance 7）——这是策略校验，不是换构建通道。门禁扫描 `.github/workflows/**` 与 `apps/photasa/package.json` 的 `tauri:build:ci`，确保 dev overlay 未渗入 CI/prod 脚本。

验收时勿把 `photasa-build.yml` 的 debug profile 说成「CI 在构建 dev 版」——那是 prod 配置的快速编译检查。

### 「脚本归属」表的归属说明

上方「脚本归属」表描述的是长期有效的团队协作策略（谁构建什么、是否发布），不是本 RFC 特有的一次性设计决策。RFC 完成后会归档到 `.spec/rfc/completed/`，成为历史快照；但这条策略应该持续维护、易于发现。**落地时必须执行 Acceptance 8**：把该表迁入 **`apps/photasa/DEVELOPMENT.md`**（新建，若不存在）——三方审查判定 `ROADMAP.md` 不是合适的落点：`ROADMAP.md` 承载的是架构/策略类内容（Golden rule、Active RFCs 索引），不是日常开发脚本参考，新贡献者第一次跑 `pnpm dev` 前不会去翻 `ROADMAP.md`；`DEVELOPMENT.md` 放在 `apps/photasa/` 下与 `package.json` 同级，才是会被实际发现的位置。本 RFC 归档后只在 `ROADMAP.md` 保留一句指向 `apps/photasa/DEVELOPMENT.md` 的链接，不重复表格内容。

## Non-goals

- 不做 dev 专属图标设计（用窗口标题/productName 文字区分即可）。
- 不改变 RFC 0100 单实例语义（通道内仍单实例）；本 RFC 通过独立 `identifier` 实现 **dev 与 prod 各一套锁**，不是取消单实例（机制已用源码验证，见 Problem 节）。
- 不支持「同一通道内两个 dev 实例同时跑」（例如两个 `pnpm dev` 仍受 dev 单实例锁约束；若需并行多 dev 实例，需另开 RFC 改 `devUrl` 端口与单实例策略）。
- 不新增 CI workflow、不改动任何 workflow 的触发条件或构建产物——本 RFC 唯一涉及 CI 的改动是 `photasa-build.yml` 内新增一步字符串 grep 门禁（见 Acceptance 7），**不改变该 workflow 构建什么、何时触发**；grep 仅校验 dev 配置未渗入 CI/prod 脚本。本 RFC 核心仍是**本地** Dev/Prod 并存；**CI/CD 仅 prod**。
- 不引入 beta/nightly 等第三套发布通道——只解决"一份 dev 一份 prod 同机共存"，不是多通道发布策略设计。

## Acceptance

0. **实施前置 spike（gate，非装饰性风险记录）**：手工执行一次 `tauri dev --config src-tauri/tauri.dev.conf.json`（仅含 `productName`/`identifier`/窗口标题三个字段），检查主配置里其他窗口属性（`width`/`height` 等，见 `tauri.conf.json` 现有 `app.windows[0]`）是否在合并后保留。确认 Tauri v2 `--config` 是深合并还是浅合并。**此项结果直接决定 Decision §1 JSON 的最终字段**（若浅合并，`app.windows` 必须补全所有原有窗口字段）——Acceptance 1 的验收内容随本项结果分支，不能跳过直接实现。（单实例锁作用域已在 Problem 节用源码验证完毕，本项 spike 不再需要覆盖这部分。）
1. `apps/photasa/src-tauri/tauri.dev.conf.json` 存在，覆盖 `productName`/`identifier`/窗口标题（按 Acceptance 0 结果确定最终字段范围）及 `plugins.updater.endpoints: []`。
2. `pnpm --filter @photasa/photasa dev` 默认使用 dev identifier 启动（无需手动加参数）。
3. **自动化测试**（Vitest，纯 Node，不依赖 Tauri 运行时）——**这是本 RFC 的主要回归防线，覆盖静态配置层面的所有可机械化不变量**：
    - 解析 `tauri.conf.json` 与 `tauri.dev.conf.json`，断言 `devConfig.identifier !== baseConfig.identifier` 且 `devConfig.identifier === baseConfig.identifier + ".dev"`。**这条断言同时是 Acceptance 6 单实例锁隔离的间接回归保护**——锁作用域已确认由 identifier 派生（见 Problem 节源码依据），本断言保住了"两个 identifier 不同"这个前提条件，锁隔离行为随之成立，无需为锁行为本身另写自动化测试。
    - 解析 `apps/photasa/package.json` 的 `scripts`：`dev`、`tauri:dev`、`build:debug` 均包含 `tauri.dev.conf.json`；`tauri:build:ci` **不得**包含 `tauri.dev.conf.json` 或 `me.photasa.app.dev`。
      把数据目录隔离与脚本通道归属固化为可重复回归，不依赖人工每次改配置后 `ls ~/Library/Application Support/`。
4. 首次实现后人工验证一次：同时安装一份 prod release 包与运行一次 dev 构建，`ls ~/Library/Application Support/` 确认两个独立目录物理存在（一次性确认底层机制真实生效，之后靠 Acceptance 3 的自动化测试防回归，不需要每次改动都重复人工步骤）。
5. 验证 dev 窗口标题可与 prod 版区分（人工确认，非自动化——视觉判断无法机械化，一次性确认即可）。
6. **单实例（RFC 0100，运行时行为验证，Acceptance 3 已提供静态前提保护，本项只验证运行时真实表现）**：prod 已运行时启动 `pnpm dev`（dev 通道），两进程均存活；再启动第二个 dev（或第二个 prod）时，该通道内仍只保留一个实例（第二进程聚焦首实例并退出）。一次性人工验收即可——因为锁隔离的前提条件（identifier 不同）已被 Acceptance 3 自动化，锁作用域由 identifier 派生的机制也已在 Problem 节用源码验证，本项只需确认一次"实际运行表现与源码分析一致"，不需要每次改动重复验证。
7. **CI / prod 脚本门禁**：`photasa-build.yml` 新增一步，fail-fast 若任一项匹配：
    - `.github/workflows/**` 中出现 `tauri.dev.conf.json` 或 `me.photasa.app.dev`；
    - `apps/photasa/package.json` 的 `tauri:build:ci` 脚本中出现上述字符串或 `--config src-tauri/tauri.dev.conf.json`。
      **与 Acceptance 3 的关系**：Acceptance 3 的 Vitest 断言在仓库测试套件中运行，可能被跳过、被过滤，或在某次 push 未被触发；本项是 CI 构建任务内的硬门禁，即使测试被跳过也会独立拦截，且额外覆盖 Acceptance 3 未触达的 `.github/workflows/**` 全目录扫描——两者防的是不同触发路径下的同一类回归，均需保留，不是重复实现。门禁本身要有一次验证：临时在 workflow 或 `tauri:build:ci` 中插入违规字符串，确认步骤报错，然后撤销。
8. **Living doc**：`apps/photasa/DEVELOPMENT.md`（新建，若不存在）写入「脚本归属」表，并注明「日常开发用 `pnpm dev`，勿用手敲裸 `tauri dev`」；`ROADMAP.md` Photasa 小节只保留指向该文件的一句链接，不重复表格内容。

## Risks

- `identifier` 变更会改变 `app_data_dir()` 路径——**这不是小事，需要在合入当天用醒目方式通知团队（PR 描述加粗提示，不能只写在本 RFC 的 Risks 段落里）**：若开发者本机已经用主 identifier 跑过大量 dev 数据（旧 scan 队列、旧 preferences），迁移到 dev identifier 后这些历史数据不会自动迁移；首次切换后本地 dev 环境会表现得像全新安装，旧数据仍在原 `me.photasa.app` 目录下未丢失，但 dev 会话看不到它。预期行为、非 bug，但对没看这份 RFC 的团队成员是纯粹的意外。
- 若 `dev` / `tauri:dev` / `build:debug` 未全部挂上 `--config`，会悄悄回到 prod `identifier`，表现为数据互踩 **且** dev 与 prod 共用单实例锁（锁机制已确认由 identifier 派生，见 Problem 节）——实现时三个脚本必须同改，并在 code review 中核对。
- `tauri:build:ci` 现有的内联 JSON `-c` override（`package.json`，本 RFC 不改）与本 RFC 新增的文件式 overlay 是两种不同机制解决同类"配置差异化"问题——见 Decision 节内说明，当前范围小暂不构成问题，但如果 CI 侧未来需要覆盖更多字段，两种机制并存会增加认知负担和漂移风险，建议届时统一为同一种（文件 overlay）。
- Acceptance 0 的 spike 若发现是浅合并，Decision §1 的 `tauri.dev.conf.json` 内容需要扩充（补全窗口字段），这会略微增加 overlay 文件的行数，但不改变本 RFC 的整体方案（仍是单一 overlay 文件 + 两行脚本改动）。
- **前瞻性风险**（Fowler 指出，仍然成立）：锁作用域由 identifier 派生这一行为已用 `tauri-plugin-single-instance` 2.4.1 源码验证（见 Problem 节），但这是**特定版本**的实现细节，未被本 RFC 的任何自动化测试锁定——若未来升级 Tauri/该插件版本改变派生方式，没有任何检查会捕获这个回归，只能靠人工再次留意。建议：每次升级 `tauri-plugin-single-instance` 或 Tauri 主版本时，重新执行一次 Acceptance 6 的人工验证，作为升级检查清单的一项，而不是假定行为永久不变。

# RFC 0163 – PostHog 遥测接入（Rust + Vue 双端，免费额度优先）

## Implementation principle (Photasa / Tauri)

> **Rust rewrite, not TypeScript copy.** Policy: [ROADMAP.md](../../ROADMAP.md).

**Status**: 🔨 Draft
**Created**: 2026-07-24
**Area**: Tauri / Observability
**Related**: 无（首次引入遥测/错误追踪能力）

---

## Problem

Photasa 目前没有任何崩溃追踪、错误上报或使用情况可见性——Rust 后端 panic、Vue 前端未捕获异常，除了本地日志文件外无人知晓，个人 hobby 项目也没有渠道知道用户装完之后是否真的能跑起来。

比较过 PostHog / Sentry：Sentry 免费版硬性卡 1 个项目 + 5000 错误/月，个人多项目场景容易撞墙；PostHog 免费版 100 万事件/月、无项目数限制，错误追踪 + 产品分析（用了哪些功能、留存）共用同一额度，性价比更高。**决策依据：免费额度优先**，选 PostHog。

## Goals

1. Rust 后端（`src-tauri`）能上报 panic/错误事件到 PostHog。
2. Vue 前端能上报未捕获异常 + 关键用户行为事件（哪些功能被用到）。
3. 遵循行业最佳实践的显式同意（consent）机制——首次启动主动询问，不默认开启、不用被动开关冒充同意，用户可随时撤回。
4. 不引入服务端组件，纯客户端上报，SaaS 免费额度内运行。
5. 不因为遥测上报失败/网络不通而影响应用启动或功能（非阻塞、失败静默降级）。

## Non-goals

- 不做自建 PostHog（self-host）——个人项目跑 SaaS 免费版即可，不引入运维负担。
- 不做 session replay（免费额度里包含但对桌面应用意义不大，Photasa 不是网页，没有 DOM 录制场景）。
- 不做 feature flag（PostHog 支持，但当前无 A/B 测试或灰度发布需求，不在本 RFC 范围）。
- 不采集照片内容/文件路径等用户数据本体——只采集应用行为事件（如"扫描完成""导入触发"）和错误堆栈，不采集图库内容本身。

## Decision

### 1. Rust 后端接入：官方 [`posthog-rs`](https://crates.io/crates/posthog-rs) crate（[GitHub](https://github.com/PostHog/posthog-rs)）

- 异步客户端，非阻塞上报——`capture()` 把事件丢给后台 worker 批量发送，不等网络，符合 Goal 5。
- `Cargo.toml` 加依赖：

```toml
posthog-rs = "0.3"
```

- 接入点：`apps/photasa/src-tauri/src/main.rs` 的 `.setup()` 钩子内（第88行附近，与 `app_data_dir` 初始化同一阶段）初始化 PostHog 客户端，存入 Tauri 的 managed state，供各 command 模块通过 `app.state()` 取用。
- panic hook：`std::panic::set_hook` 捕获 Rust panic，序列化堆栈信息后调用 PostHog `capture()` 上报，不中断 panic 本身的正常处理流程（不能吞掉 panic，只是额外上报）。
- 事件粒度：应用启动/退出、扫描完成/失败、导入完成/失败、致命错误——不采集逐文件级别的操作。

### 2. Vue 前端接入：官方 PostHog JS SDK

- `pnpm add posthog-js --filter @photasa/photasa`
- 初始化位置：`apps/photasa/src/main.ts`（应用入口，早于路由/store 初始化，确保尽早捕获异常）。
- 全局错误捕获：Vue `app.config.errorHandler` + `window.onerror`/`window.onunhandledrejection` 都接入 PostHog 上报。
- 用户行为事件：关键操作节点埋点（如"打开设置""触发扫描""导入完成"），不做逐像素/逐点击的细粒度追踪。

### 3. 同意机制（Consent，Goal 3，强制，遵循行业最佳实践）

**被动的"默认关+设置里藏一个开关"不构成有效 consent**——参考 VS Code / JetBrains / Sentry 等桌面工具的通行做法，真正的同意机制要求：主动询问、清楚说明用途、对称的接受/拒绝选项、随时可撤回。本 RFC 采用首次启动一次性对话框（不是被动默认值），具体设计：

- `photasa-preference` 新增两个字段：
    - `telemetry.consentStatus`：三态 `"undecided" | "granted" | "denied"`，**不是简单布尔** `enabled`——区分"用户明确拒绝过"和"用户还没被问过"，避免每次启动重复弹窗骚扰已拒绝的用户。
    - `telemetry.consentPolicyVersion`：记录做出该决定时对应的 **隐私政策版本号**（整数或字符串，如 `"1"`），不是应用版本号——只有隐私政策实际变更时才递增，避免普通功能升级触发不必要的重新征询。
- **首次启动流程**：`consentStatus === "undecided"` 时，`main.rs` 的 `.setup()` 阶段（PostHog 客户端初始化**之前**）触发前端展示一次性同意对话框，PostHog 客户端在用户做出选择前**完全不初始化**（不是初始化后暂停发送，是压根不加载/不建连）。
- **对话框文案要求**（对称呈现，不做"接受"按钮更显眼、"拒绝"按钮做小做灰这种 dark pattern）：
    - 说明用途："帮助我们了解应用崩溃情况和使用模式，改进 Photasa"
    - 说明范围："仅上报应用行为事件和错误堆栈，不采集照片内容或文件路径"
    - 说明去向：明确写出用的是 PostHog（第三方服务），附一句指向隐私政策/本 RFC 的链接（如仓库有隐私政策文档）
    - 两个按钮对等呈现："同意"/"不同意"，不用"好的"vs"以后再说"这种诱导性措辞
- **选择后**：`consentStatus` 落盘（`granted` 或 `denied`），同时把当前隐私政策版本号写入 `consentPolicyVersion`。此后启动不再弹窗，直接按该值决定是否初始化 PostHog。
- **重新征询触发条件**（已确认：隐私政策变更时重新问，不是每次版本升级都问）：应用启动时比较 `consentPolicyVersion` 与代码里硬编码的"当前隐私政策版本号"常量——不一致时（无论原先是 `granted` 还是 `denied`）将 `consentStatus` 重置为 `undecided`，重新弹一次对话框。仅当隐私政策文本本身发生实质变化（如新增数据采集类型）才递增这个版本号，普通功能迭代/常规版本发布不触发。
- **撤回权**：Settings 页面提供一个开关，读写同一个 `telemetry.consentStatus`——用户随时可以从 `granted` 改回 `denied`（撤回同意），下次启动生效；也允许从 `denied` 改为 `granted`（重新同意），不强制只能弹窗时决定。手动切换不改变 `consentPolicyVersion`（只有首次对话框选择才会写入/更新该字段）。
- Rust 侧与前端侧的初始化逻辑均以 `consentStatus === "granted"` 为唯一门槛，其余两态（`undecided`/`denied`）都不加载 PostHog 客户端、不产生任何出站网络请求。

### 4. 项目 API Key 管理

- PostHog Project API Key 不是敏感信息（客户端上报本来就是公开可见的，同 Sentry DSN 性质）——直接写入 `tauri.conf.json` 或前端 `.env` 提交进仓库，不用像 updater 签名私钥那样走 CI Secret 注入。
- 若未来需要区分 dev/prod 环境的事件流（避免本地开发调试事件污染生产数据），复用 RFC 0157 已建立的 `tauri.dev.conf.json` overlay 机制，为 dev channel 配置单独的 PostHog Project（或直接用 `telemetry.enabled=false` 作为 dev 默认值，更简单）。

**已确认的实际配置值**（2026-07-24，项目已创建）：

| 项                   | 值                                                 |
| -------------------- | -------------------------------------------------- |
| Project API Key      | `phc_ohBeDHC9RNkG6HkWdbJdjPtacoDTxDjEnZbnYGuVmmja` |
| API Host（数据区域） | `https://us.i.posthog.com`（US，已确认选定）       |

实现时 Rust 侧（`posthog-rs` client 构造）与前端侧（`posthog.init()`）均使用上表两个值；不做环境变量间接层——按本节第一条已确认这两个值本身不敏感，直接写入 `tauri.conf.json`（Rust 侧读取）与前端初始化代码（如 `apps/photasa/src/main.ts` 常量），无需额外配置管理层。

## Acceptance

1. `apps/photasa/src-tauri/Cargo.toml` 引入 `posthog-rs`，`main.rs` 完成客户端初始化 + panic hook 挂载。
2. `apps/photasa/package.json` 引入 `posthog-js`，`main.ts` 完成初始化 + 全局错误捕获。
3. `photasa-preference` 新增 `telemetry.consentStatus` 三态字段（`undecided`/`granted`/`denied`，默认 `undecided`）与 `telemetry.consentPolicyVersion` 字段（记录同意时的隐私政策版本号）。
4. 首次启动（`consentStatus === "undecided"`）弹出同意对话框，文案含用途/范围/去向说明，"同意"/"不同意"按钮视觉对等（非 dark pattern）；选择后落盘 `consentStatus` + 当前 `consentPolicyVersion`，二次启动不再弹窗。
5. 对话框展示期间及用户选择前，验证 PostHog 客户端（Rust + 前端）均未初始化，无任何出站网络请求。
6. Settings 页面可撤回/重新授予同意（`granted` ↔ `denied` 双向切换），验证切换后下次启动的初始化行为随新状态变化；手动切换不改变已记录的 `consentPolicyVersion`。
7. **重新征询验证**：手动修改代码里硬编码的"当前隐私政策版本号"常量（模拟一次隐私政策变更），确认下次启动时无论原 `consentStatus` 是 `granted` 还是 `denied`，均被重置为 `undecided` 并重新弹出对话框；不修改该常量时（模拟普通版本升级），确认不触发重新弹窗。
8. 手动触发一次 Rust panic（测试环境，`consentStatus=granted`）和一次前端未捕获异常，确认 PostHog Dashboard 收到对应事件；`consentStatus=denied` 时重复同一操作，确认 Dashboard 无新事件。
9. 遥测上报关闭网络后不影响应用启动、扫描、导入等核心功能正常运行（验证 Goal 5 的失败静默降级）。
10. 不采集文件路径/照片内容——人工审查已发送事件的 payload，确认只有行为事件名和非敏感元数据，不包含用户目录路径等 PII。

## Risks

- opt-in 默认关的代价是大多数用户不会主动开启，数据量会偏少——这是已知取舍（隐私优先于采集覆盖率），不是需要后续重新讨论的开放问题。
- `posthog-rs` 相对年轻（对比 `sentry` Rust SDK 生态成熟度），API 可能随版本演进变化，锁定具体版本号并在升级时人工验证 breaking change。
- 免费额度 100 万事件/月对个人项目通常充裕，但若事件粒度设计过细（比如每次鼠标移动都上报），可能意外快速消耗额度——Decision 里已限定"关键节点埋点"而非细粒度追踪，实现时需遵守这个粒度边界，不要事后逐步加码到细粒度。

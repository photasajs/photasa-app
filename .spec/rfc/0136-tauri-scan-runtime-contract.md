# RFC 0136: Tauri persisted queue scan pipeline

- **Start Date**: 2026-07-18
- **Last updated**: 2026-07-19
- **Status**: Draft
- **Priority**: P1e
- **Area**: Photasa / Tauri scan queue / scan pipeline / scan UI
- **Depends on**: [0117](./completed/0117-tauri-scan-pipeline-parity.md), [0132](./completed/0132-tauri-photasa-scan-crate.md), [0133](./completed/0133-tauri-photasa-watch-crate.md), [0138](./completed/0138-tauri-photasa-config-crate.md)（已完成，`photasa-config::add_photo_to_folder_list` 可用）, [0111](./0111-tauri-scan-notify-status-bridge.md)（状态栏桥接需同步改造，见 Rust worker and IPC 章节）
- **Related**: RFC 0137（`window.api` staged removal；本 RFC 不定义 wrapper）
- **Path**: `.spec/rfc/0136-tauri-scan-runtime-contract.md`

## Decision

Scan is a report source. It does not create thumbnails, write `.photasa.json`, or own queue.

Tauri application composes independent crates into one scan pipeline.

**One-line ownership:** 千里眼/顺风耳只报告；尉迟恭只排队调度；房玄龄只落盘投影；袁天罡只通天；李世民+杜如晦只转发；虞世南/魏征/UI 只消费投影。扫描不做队列，队列不做扫描。

## Zhenguan Golden Rule

贞观不是一组无名 service。每个人代表一个稳定功能边界；功能责任跟人走，不能为方便跨人直调。

本项目新增功能、RFC、接口、测试与 UI 说明都必须先回答：这是谁的职责。没有对应人物的功能，不得作为无名 helper、store mutation 或 IPC wrapper 落地。

### Who is who / who does what（0136 全表）

| 人 / 角色    | 代码身份                                | **只干（唯一职责）**                                                             | **绝不干**                                                |
| ------------ | --------------------------------------- | -------------------------------------------------------------------------------- | --------------------------------------------------------- |
| 李世民       | `LishiminService` + `event-routing.yml` | 跨功能协调：按 YAML 决定报告/意图去向（如 `scan_directory_discovered` → 尉迟恭） | 队列、Store、IPC、扫描、流水线                            |
| 杜如晦       | `DuRuHuiService`                        | 圣旨邮差：把李世民决定的圣旨交给目标官                                           | 路由决策、持久化、PQueue、扫描                            |
| 袁天罡       | `YuanTianGangService`                   | 人界↔天界边界：直连 Rust command；收 Tauri event；把报告化为启奏                 | 队列策略、Pinia、缩略图/配置流水线                        |
| 千里眼       | `photasa-scan` + Tauri scan worker      | 主动观察**当前一项**：只报直属子目录 + 媒体文件                                  | 队列、持久化、缩略图、`.photasa.json`、UI、IPC            |
| 顺风耳       | `photasa-watch`                         | 被动聆听 watched roots：归一化/去抖/合并 → `FileObservation`                     | 队列、扫描、缩略图、`.photasa.json`、直调千里眼           |
| 尉迟恭       | `YuChiGongService`                      | 扫描队列：准入/去重、**唯一 PQueue**、任务生命周期；改队只走奏折                 | 直写 Pinia、直调 `window.api`/Rust、缩略图、配置写入      |
| 房玄龄       | `FangXuanLingService`                   | 状态与持久化：批尉迟恭奏折；持久化队列；投影 `scanningStore`                     | 决定任务准入策略、跑 PQueue、扫描                         |
| 虞世南       | `YuShiNanService`                       | 扫描呈现：消费**已投影**进度 / 状态栏                                            | 队列真相、开停扫、从队列派生栏文案当 SSOT                 |
| 魏征         | `WeiZhengService`                       | 文件夹树：消费**已处理完**的文件投影后更新树                                     | 原始扫描报告、队列控制                                    |
| Tauri 组合根 | `apps/photasa/src-tauri` pipeline       | 粘合：file 报告 → thumb → config；directory 报告 → 启奏入队链；产出流水线终端    | 写 renderer 队列 / Pinia；冒充尉迟恭调度                  |
| UI（百姓）   | Vue / dialogs                           | 发用户意图；读 `useYuChiGong().scanningQueue` 等人物投影                         | 调 Rust、`window.api`、写队列、吃 raw `find-photo` 当队列 |

褚遂良 / 秦琼 / 长孙无忌不在本 RFC 扫描主链中心（路径偏好 / watch→树 UI / 菜单）。顺风耳入队仍必须走 **启奏 → 李世民 → 杜如晦 → 尉迟恭**，不得旁路。

这张表是**目标边界**，不为现有绕行背书。当前任何人物直接写 Pinia、直接调 `window.api`、或越过李世民直调另一人物，都是待迁移违规；RFC 0137 负责 IPC wrapper 退场，RFC 0136 负责扫描路径职责落地。

### 文书铁律（不可混）

```text
跨人意图或报告
-> QiZou（启奏）
-> LiShiMin event-routing.yml
-> DuRuHui Shengzhi（圣旨）
-> target service

改状态 / 持久化
-> Zouzhe（奏折）
-> FangXuanLing
-> durable Store / Tianshu path

碰 Rust / Tauri IPC
-> YuanTianGang only
-> direct Rust command / Tauri event
```

1. 人物之间 never call methods directly。
2. 人物 never read or write Pinia directly。读走 `FangXuanLing` accessors；写走 `Zouzhe`。
3. 人物 never call `window.api`。`YuanTianGang` 是唯一 IPC 边界。
4. `LiShiMin` 只通过 YAML 路由；`DuRuHui` 只投递。二人都不拥有队列状态或扫描工作。
5. `YuChiGong` 拥有任务策略与唯一 PQueue；`FangXuanLing` 拥有耐久队列变更路径。
6. Tauri 是 crate 组合根：组合扫描/缩略图/配置阶段，不写 renderer 队列或 Pinia。
7. UI 只发意图、只读人物投影；不调 Rust、不调 `window.api`、不写队列。

`window.api` 是遗留兼容壳，不是贞观边界。新扫描路径不得经它进出。RFC 0137 负责其 staged removal。

### 调度步骤 ↔ 谁执行（对齐 Electron 顺序）

目标用户可见顺序：

```text
当前目录
  -> 列直属子目录
  -> 子目录持久化并加入同一 PQueue
  -> 不等待子目录扫描
  -> 完成当前目录文件流水线
  -> 当前目录完成/失败
  -> PQueue 执行下一项
```

| 步骤                                 | 谁执行                                                                                                                                |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| 选出当前任务 / PQueue 调度           | **尉迟恭**                                                                                                                            |
| 标 `processing` / 落盘               | **尉迟恭** 奏折 → **房玄龄**                                                                                                          |
| submit 当前任务给 Rust               | **袁天罡** → **千里眼**                                                                                                               |
| 列直属子目录 + 直属媒体（报告）      | **千里眼**（一层；不递归子树）                                                                                                        |
| 子目录：请求耐久入队                 | 报告 → **袁天罡** 启奏 → **李世民** YAML → **杜如晦** 圣旨 → **尉迟恭** 准入 → 奏折 → **房玄龄** 持久化收据 → **尉迟恭** `PQueue.add` |
| 不等待子目录扫描                     | **尉迟恭** 调度语义（父只等入队收据，不等子 complete）                                                                                |
| 文件：thumb + `.photasa.json`        | **Tauri 组合根**（`photasa-thumbnail` + config module）                                                                               |
| 当前项流水线终端 → 删任务 / `failed` | **尉迟恭**（仅在匹配终端之后）                                                                                                        |
| 队列 UI                              | **UI** 读尉迟恭投影（房玄龄 `scanningStore`）                                                                                         |
| 进度/状态栏文案                      | **虞世南**（投影，非队列 SSOT）                                                                                                       |
| 树节点更新                           | **魏征**（已处理文件投影之后）                                                                                                        |

**房玄龄持久化路径不经 zouwu/Tianshu workflow，直调 Rust command。** `zouwu-core`/`zouwu-builtin` 是 Electron `TaiyiEngine` 的 Rust 移植，价值在于给 preload 隔离的 renderer 一个跨多 engine 编排的声明式 YAML 入口（RFC 0107 preferences/config/taiyi/siming/taibaijinxing 走这条路，仍在用，不删）。Tauri 扫描队列没有 preload 边界，尉迟恭/房玄龄之间是同进程 Rust 调用，不需要 YAML 模板变量插值这层（`{{steps.xxx}}` 本身是 0048 postmortem 记录过的真实故障源之一）。`add_scan_action`/`update_scan_action_status` 等队列持久化步骤在 Tauri 里必须是普通 Rust 函数，不得新建或复用 `.zouwu` 工作流文件。

### 一条目录任务转手（完整链）

```text
尉迟恭：PQueue 取出 D → 奏折标 processing（房玄龄落盘）
  → 袁天罡 submit Rust（千里眼只看 D）
千里眼报告：
  file → Tauri：thumb → .photasa.json → FileProcessedReport
        （呈现可再经袁天罡启奏 → 虞世南 / 魏征）
  directory → 袁天罡启奏 scan_directory_discovered
           → 李世民 YAML → 杜如晦圣旨 add_scan_task
           → 尉迟恭准入 → 奏折 ADD_SCAN_ACTION → 房玄龄持久化收据
           → 尉迟恭把子目录丢进同一 PQueue（不等子扫完）
千里眼发现结束 → 当前 D 文件阶段全完 → 流水线终端
  → 尉迟恭：删任务 / markFailed → PQueue 下一项
```

### 一眼违规（实现红线）

| 违规                                    | 正确归属                         |
| --------------------------------------- | -------------------------------- |
| 尉迟恭 / 他人 `window.api.scanPhotos`   | **袁天罡** 直连 Rust             |
| 千里眼写队列 / 缩略图 / `.photasa.json` | 报告 only；流水线在 Tauri 组合根 |
| 顺风耳直调千里眼或写 `ScanQueueItem`    | 启奏 → 尉迟恭 / 房玄龄           |
| 虞世南决定删队或以队列派生当栏 SSOT     | 尉迟恭队列；虞世南只呈现         |
| UI 直吃 raw `find-photo` 当队列         | `useYuChiGong().scanningQueue`   |
| 人物 A 直接 `service.method()` 调人物 B | 启奏或奏折                       |

### 千里眼与顺风耳

```text
尉迟恭选出一个当前任务
-> 袁天罡直连 Rust command
-> 千里眼观察该任务
-> 袁天罡收 Tauri report
-> 贞观路由处理报告

顺风耳听到文件系统变化
-> 归一化 / 去抖 / 合并为 FileObservation
-> 袁天罡收 Tauri report
-> QiZou -> 李世民 YAML -> 杜如晦
-> 尉迟恭 `add_scan_task`
-> 房玄龄持久化 -> 尉迟恭排入同一 PQueue
```

千里眼只看当前任务，一次一个目录或文件。目录报告只表示“发现直接子目录”；文件报告只表示“发现媒体文件”。顺风耳只听 watched roots；观察报告只表示“文件系统发生变化”。两人都不把报告直接变成队列项，也不直接调用对方。

旧 Electron 文档中“千里眼管理扫描队列/`scanning.json`”和“顺风耳向千里眼直接派命令”不适用于 Tauri 目标，不能作为实现依据。`photasa-scan` 是千里眼的观察算法；`photasa-watch` 是顺风耳的观察算法。其现有 `ThumbnailBridge`、`ScanEventSink`、`ScanQueueSink` 等过渡接口不定义未来职责：0136 的 Tauri composition root 取代它们完成文件流水线和贞观报告路由。

```text
persisted queue
-> PQueue takes one directory task
-> photasa-scan reports direct entries
   -> file report: thumbnail stage -> config stage -> processed file report
   -> directory report: queue stage persists child task -> same PQueue
-> all current file stages finish
-> current directory task complete
-> PQueue takes next task
```

Child directory task is added immediately but never awaited by parent. File processing belongs to parent task pipeline and must finish before parent terminal result.

**Child directory has exactly one action: request durable queue admission.** It reports `scan_directory_discovered`; the Zhenguan route admits the child to the queue and arranges its later PQueue turn. The report handler has no thumbnail, config, or child-scan behavior.

## Electron behavior retained

Electron `YuChiGong.executeScan()` defines queue ordering:

```text
processing parent
-> discover direct child folders
-> persist children
-> add children to same PQueue
-> do not await children
-> await parent scanPhotos
-> remove or fail parent
-> PQueue advances
```

Electron currently couples discovery, thumbnail, and config inside `@photasa/scan`. Tauri keeps behavior but separates those responsibilities at application composition boundary.

## Crate boundaries

| Layer                | 对应人 (Zhenguan owner)  | Owns                                                                                  | Must not depend on                                                                                                                                                                                                          |
| -------------------- | ------------------------ | ------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `photasa-types`      | 无人（纯类型，无职责）   | scan entry, file-processing request/result types                                      | application crates                                                                                                                                                                                                          |
| `photasa-scan`       | 千里眼                   | one current task direct directory/file discovery; emits reports                       | thumbnail crate, config implementation, Tauri, queue, **`photasa-import`**（scan 是队列驱动一层发现；import 永远递归收集整棵树；两者用例不同，禁止共享判定逻辑或代码路径——2026-07-20 发现真实代码违反此条，见下方复核记录） |
| `photasa-thumbnail`  | 无人（纯机制，无职责）   | thumbnail creation/removal request                                                    | scan crate, config implementation, queue                                                                                                                                                                                    |
| `photasa-watch`      | 顺风耳                   | watched-root observation normalization, debounce, coalescing; emits `FileObservation` | scan crate, queue, thumbnail/config implementation, Tauri                                                                                                                                                                   |
| Tauri config module  | 无人（纯机制，无职责）   | `.photasa.json` read/write                                                            | queue/UI services                                                                                                                                                                                                           |
| Tauri scan pipeline  | 袁天罡（交通边界职责内） | connects reports to thumbnail/config stages; task terminal outcome                    | queue storage, UI state                                                                                                                                                                                                     |
| `YuChiGong`（TS 类） | 尉迟恭                   | persisted queue and PQueue dispatch                                                   | scan internals, thumbnail/config internals                                                                                                                                                                                  |
| `scanningStore`      | 虞世南（呈现职责内）     | queue UI projection                                                                   | filesystem work                                                                                                                                                                                                             |

crate 命名规则：`crates/` 下的 Rust crate 名一律用功能性英文（`photasa-scan`/`photasa-watch`/`photasa-thumbnail`/`photasa-import`/`photasa-types`），不拟人化——crate 是可独立 `cargo test` 的机制层，属于 Rust 生态惯例，不代表贞观职责边界。**贞观人物只出现在 Tauri 应用层的 `src-tauri/src/services/<pinyin>/` 目录**（如 `services/yuchigong`、`services/weizheng`），这一层才是职责边界，才对应上表"对应人"列。一个 crate 没有对应人，说明它是无状态机制（类型定义、纯解码/编解码、纯文件 I/O），只能被 Tauri 组合层或某个人的 service 调用，不能自己越权持有职责（队列策略、准入、UI 投影等）。

No reusable crate imports another feature crate to complete scan work. Tauri application owns composition because it is the dependency root. 千里眼和顺风耳只报告；尉迟恭、房玄龄、袁天罡按贞观职责消费报告。

## Persisted queue

Queue is authoritative unfinished-work list.

```ts
type ScanQueueItem = {
    path: string;
    action: "scan" | "rescan" | "current";
    operationType: "directory" | "file";
    source: "user" | "auto" | "discovered";
    status: "pending" | "processing" | "failed";
    createdAt: number;
    startedAt?: number;
    progress?: { processed: number; total: number };
    error?: string;
    retryCount: number;
    maxRetries: number;
};
```

`YuChiGong` changes queue state through `FangXuanLing`. Durable queue storage is written before PQueue scheduling. `scanningStore` mirrors it for UI; it is not a second queue.

```text
persist pending -> add PQueue
PQueue starts -> persist processing
pipeline complete -> remove persisted task
pipeline error -> persist failed task
```

On restart, load durable queue before accepting new work:

```text
pending -> add PQueue
processing -> pending -> add PQueue
failed -> existing retry/expiry policy
```

In-flight work died with process. `processing` never means complete after restart.

## Queue entry paths

| Source                     | Queue task                           |
| -------------------------- | ------------------------------------ |
| Add watched folder         | root directory `scan`                |
| Manual rescan              | directory `rescan`                   |
| Watch filesystem operation | mapped file/directory action         |
| Pipeline directory report  | direct child directory, `discovered` |
| Startup recovery           | restored unfinished task             |

All entries reach one `YuChiGong` add-task path. Rust and UI never write queue directly. Persist child before scheduling it. If app stops between those steps, startup recovery schedules it.

顺风耳的 `FileObservation` 使用同一准入链，不得写 `ScanQueueItem`、调用 PQueue 或派发给千里眼：

```text
FileObservation
-> YuanTianGang QiZou `watch_observed`
-> LiShiMin YAML route
-> DuRuHui Shengzhi `add_scan_task`
-> YuChiGong / FangXuanLing
```

For a directory report, the required admission route is:

```text
ScanDirectoryReport
-> YuanTianGang emits QiZou `scan_directory_discovered`
-> LiShiMin YAML route
-> DuRuHui delivers Shengzhi `add_scan_task`
-> YuChiGong handles admission
-> YuChiGong submits ADD_SCAN_ACTION Zouzhe
-> FangXuanLing persists task and returns durable receipt
-> YuChiGong schedules the same PQueue
```

The route returns a durable-admission receipt to the current Tauri pipeline. Parent processing may wait for that receipt so a discovered child cannot disappear on crash. It must never wait for the child scan or any child file work.

## One current task pipeline

`PQueue({ concurrency: 1 })` is only queue dispatcher.

For directory task `D`:

```text
1. mark D processing
2. submit D to managed Rust scan worker
3. scan worker reports direct entries only
4. file report: run file pipeline synchronously for D
5. directory report: request child durable admission through Zhenguan route; continue D after admission receipt
6. scanner finishes entry discovery
7. await all file pipeline stages for D
8. complete D or fail D
9. PQueue takes next task
```

For file task `F`:

```text
1. mark F processing
2. scan reports F
3. run F file pipeline
4. complete F or fail F
```

Directory report does not start a child scan. Parent waits only for child durable admission, never child completion. File stage failure fails current task according to existing failed/retry policy.

## File pipeline

File report means a discovered media file, not a completed photo record.

```text
ScanFileReport
-> derive thumbnail request from action and source file
-> photasa-thumbnail create/remove
-> Tauri config module add/remove source file in owning `.photasa.json`
-> FileProcessedReport
```

Action behavior:

| Action         | Thumbnail stage              | Config stage                         |
| -------------- | ---------------------------- | ------------------------------------ |
| `scan`         | Create only when missing     | Add file if scan strategy selects it |
| `rescan`       | Force create                 | Add/update file                      |
| `current`      | Remove thumbnail             | Remove file                          |
| cached restore | No thumbnail/config mutation | Report existing configured file      |

The pipeline emits `FileProcessedReport` only after required stages complete. UI and photo projection consume this processed report, never raw discovery report.

## Directory pipeline

Directory report means a direct child directory discovered by current task.

```text
ScanDirectoryReport
-> YuanTianGang QiZou `scan_directory_discovered`
-> LiShiMin YAML route
-> DuRuHui Shengzhi `add_scan_task`
-> YuChiGong Zouzhe `ADD_SCAN_ACTION`
-> FangXuanLing durable queue admission receipt
-> return
```

`photasa-scan` never performs these steps. `YuChiGong` owns admission policy, path normalization, de-duplication, and later PQueue scheduling. `FangXuanLing` applies the Zouzhe durable mutation and updates its Store projection. Directory report handling owns none of them.

### Implementation status（2026-07-20，`e4180c1`）

`walkthrough_photos_in_folder`（`crates/photasa-scan/src/media.rs`）已兑现本节契约：遍历时先分流 `entry.path().is_dir()`，目录直接产出目录报告（不经媒体分类），文件才走 `classify_media` 判定。`photasa-scan` 改为直接依赖 `photasa-media`（`Cargo.toml` 已替换 `photasa-import` → `photasa-media`），`should_ignore_photasa_path`/`basename_hidden`/`classify_media_flags` 权威实现在 `photasa-media`，`photasa-import` 改为纯转发。验证：`cargo tree -p photasa-scan` 不含 `photasa-import`，`cargo tree -p photasa-import` 不含 `photasa-scan`；`cargo test -p photasa-scan -p photasa-import -p photasa-media` 80 passed。

RFC 0117 记录的"`classify_media` never emits a directory, and that's correct"是 Electron FULL-递归架构下的 parity 事实，不适用于本节定义的队列驱动架构，两者不冲突。

Nothing else is allowed for child directory in current turn:

```text
no child scan
no child thumbnail
no child .photasa.json mutation
no child file pipeline
no await child completion
```

Child begins only when current task has reached pipeline terminal result and PQueue selects child on a later turn.

## Rust worker and IPC

One managed process-lifetime Rust thread executes only current PQueue submission. It has no persisted task list, retry logic, priority, child-task API, or detached per-request `tokio::spawn`.

Keep `picasa:find-photo` name during migration.

### notify:status 状态栏桥接（RFC 0111）迁移范围

`scan_runner.rs`（顶部标注"Electron `scanPhotos` 管线 Rust 重写（RFC 0117）"）当前的 `emit_status_notify`/`ScanWorkerNotifySource`/`build_scan_notify_payload`（`photasa-scan/src/notify.rs`）是 0117 时代事件模型的一部分，`NotifyPayload` 不带 `requestId`/`runId`，跟本节下方定义的 `ScanFileReport`/`ScanDirectoryReport`/`ScanTerminal`（均带 `requestId`）是两套不同类型体系。0111 本身的 error/complete/progress 转 payload 映射逻辑没有问题，是虞世南状态栏展示这一层的职责，但它读取的输入类型属于旧 pipeline，本节实现落地时需要同步改造：`ScanWorkerNotifySource` 的构造点从新的 `ScanFileReport`/`ScanDirectoryReport`/`ScanTerminal` 派生，而不是继续依赖 0117 时代 `scan_runner.rs` 的旧编排结构。这条迁移之前未被本节列入范围，一并记录。

```ts
type ScanFileReport = {
    type: "file";
    requestId: string;
    rootPath: string;
    file: { path: string; isDirectory: false };
    progress: { processed: number; total: number };
};

type ScanDirectoryReport = {
    type: "directory";
    requestId: string;
    rootPath: string;
    directory: { path: string; isDirectory: true };
};

type ScanTerminal = {
    type: "complete" | "error";
    requestId: string;
    rootPath: string;
    error?: string;
};
```

Rules:

1. `rootPath` is fixed current queue task path. Reported path never replaces it.
2. One request emits zero or more file/directory reports and exactly one terminal report.
3. Scanner terminal means entry discovery finished. Pipeline terminal means all required file stages finished.
4. `YuanTianGang` invokes the Rust scan command directly and owns Tauri event subscription cleanup. No scan path calls `window.api.scanPhotos`.
5. `YuChiGong` removes/fails current item only after matching pipeline terminal result.

## Folder tree consequence

RFC 0048（贞观权威设计）确认：扫描完成不是终点，文件夹树更新是下游必然结果，且历史上因两个根因（`router.ts` 数组模板变量解析失败、`weizheng.ts` 根节点判定失败）真实故障过两次。0136 不得重复丢失这条链路。

`YuChiGong` 当前任务达到 pipeline terminal（complete/error）后：

1. `YuChiGong` 发 Qizou `scan_completed`（事实，不是命令），携带本次任务发现的目录列表。
2. 李世民按 `event-routing.yml` 路由，至少下旨 魏征 `addFolderPath`（同一 Qizou 可能同时触发虞世南状态栏更新，二者互不依赖）。
3. 魏征消费 Shengzhi，更新 `folderTree` store；子目录不经过魏征无法出现在 UI 树上。

`YuChiGong` 不得直接调用 `addFolderPath`；魏征不得订阅原始扫描报告或队列事件——都必须经李世民路由，理由同 Golden Rule 表格的"禁止承担"列。

## UI

`ScanQueueDialog` reads `useYuChiGong().scanningQueue`, backed by `scanningStore` projection.

```text
pending: persisted root and discovered child tasks
processing: current root and pipeline progress
failed: task path, error, retry state
```

UI consumes processed-file projection. It does not consume raw scanner reports, call Rust, write queue, or derive queue state from status bar.

## Acceptance

1. ✅ `photasa-scan` compiles without thumbnail/config/Tauri/queue/`photasa-import` dependency（`cargo tree -p photasa-scan` 不含 `photasa-import`，2026-07-20 验证通过，`e4180c1`）。
2. Tauri pipeline composes scan, thumbnail, and config stages for each file report.
3. Directory report only requests Zhenguan durable admission; it does not scan, thumbnail, configure, or await child work.
4. Parent waits for own file pipeline and child durable-admission receipts, not child directory scans.
5. Queue persistence survives crash; startup turns orphan processing task into pending and resumes it.
6. PQueue has one current task; Rust worker has one current scan.
7. One request has exactly one pipeline terminal result.
8. UI shows durable queue state and processed-file progress only.
9. Pipeline terminal completion emits `scan_completed` Qizou; 李世民 routes it to 魏征 `addFolderPath` so discovered child directories reach `folderTree` — not just `scanningStore`.

## Implementation order（2026-07-20 具体化，已核实当前代码状态）

**已完成，不在本轮范围**：

- `photasa-scan` 一层遍历 + 目录/文件分流（`crates/photasa-scan/src/media.rs::walkthrough_photos_in_folder`，`e4180c1`）。
- `photasa-scan` 零依赖 `photasa-import`（改依赖 `photasa-media`，`cargo tree` 验证）。
- `ScanWorker` managed 线程（`apps/photasa/src-tauri/src/commands/scan_runner.rs`，单命名线程 + `mpsc` channel，已在 `main.rs` 注册）。
- `photasa-config::add_photo_to_folder_list`（0138，`crates/photasa-config`）。
- 扫描队列持久化（`ScanQueueRepository`，0144，`Mutex` 单写者 + 原子落盘）。

**新发现的阻塞问题（2026-07-20，必须在第 2 步一并修复，否则目录条目会被当文件处理）**：

`walkthrough_photos_in_folder` 现在会产出目录条目（`is_directory: true`），但 `scan_runner.rs` 的 `run_traditional_directory_scan`/`run_full_directory_scan`（line 340-396）遍历 `walkthrough_photos_in_folder` 返回值时，对每一条目（不分文件/目录）无差别调用 `process_photo_file`——该函数（line 225-233）无条件执行 `create_thumbnail_for_file` + `photasa_config::add_photo_to_folder_list`。门控函数 `should_process_scan_file`/`should_process_file_with_config`（`crates/photasa-scan/src/strategy.rs:138-`）只判断"文件是否已在 config 里"，不判断是否为目录，`action == "rescan"` 时直接放行。目录条目因此会被尝试生成缩略图、写入 `.photasa.json`——这是错误行为，不是"暂缓处理"，是主动做了不该做的事。

**第 2 步必须包含**：在两个扫描循环里，遍历前先按 `file.is_directory` 分流；`is_directory == true` 的条目跳过 `process_photo_file`，改为构造 `ScanDirectoryReport` 走第 3 步；只有 `is_directory == false` 才进现有文件处理路径。

**待实现，按顺序**：

1. **在 `photasa-types` 定义新 IPC 契约类型**（当前完全不存在，仅存在于本 RFC 文字里，`grep -rn "ScanFileReport\|ScanDirectoryReport\|ScanTerminal" crates apps/photasa/src-tauri/src` 零命中）：
    - `crates/photasa-types/src/scan_report.rs`（新文件）：`ScanFileReport`/`ScanDirectoryReport`/`ScanTerminal`，字段按本 RFC "Rust worker and IPC" 章节的 TS 类型定义（`requestId`/`rootPath` 必填，与现有 `PhotoFileRequest`/`ScanAction` 不同——新类型专用于 IPC 边界，不复用旧的内部处理类型）。
    - `crates/photasa-types/src/lib.rs` 导出新模块。
2. **`scan_runner.rs` 改造为产出新类型**：当前 `emit_scan_event`（line 62-64）发 `picasa:find-photo` + 原始 `serde_json::Value`，改为按 `PhotoFileRequest.is_directory` 分流，构造 `ScanFileReport`（文件）或 `ScanDirectoryReport`（目录），各自 emit；`ScanWorker` 每次 submission 结束时 emit 恰好一条 `ScanTerminal`（complete/error）。事件名可保留 `picasa:find-photo`（本 RFC 已声明兼容期不改名），payload 形状换成新类型。
3. **目录报告接入 YuanTianGang→QiZou 链路**：`yuantiangang.ts` 新增/复用 Tauri event 订阅，收到 `ScanDirectoryReport` 后 emit `qizou.scan_directory_discovered`（当前 `event-routing.yml` 是否已有该路由需先核实，若无则新增，按本 RFC "Queue entry paths" 章节的路由链：QiZou → LiShiMin YAML → DuRuHui Shengzhi `add_scan_task` → YuChiGong 准入 → Zouzhe `ADD_SCAN_ACTION` → FangXuanLing 持久化收据）。
4. **文件报告接入现有文件流水线**：`ScanFileReport` → Tauri 组合根（复用现有 thumbnail/config 调用逻辑，当前已在 `scan_runner.rs` 里，只需确认入参从新类型解构而非旧 `PhotoFileRequest`）→ `FileProcessedReport`。
5. **父任务等待策略改造**：当前逻辑需确认是否已经"不等待子目录扫描，只等子目录入队收据"——若当前实现是等 `ScanTerminal` 才处理子目录（旧模式），改为目录报告到达时立即触发第 3 步，不等本次 `ScanTerminal`。
6. **`notify:status` 桥接改造**（见 0111 2026-07-20 补记）：`ScanWorkerNotifySource` 的构造点从 `ScanFileReport`/`ScanDirectoryReport`/`ScanTerminal` 派生，替换当前从旧 `PhotoFileRequest`/`ScanAction` 构造的逻辑（`scan_runner.rs::emit_file_progress`/`emit_status_notify`）。
7. **验证**（对应 Acceptance 2-9）：crash recovery（0144 已验证）、child non-waiting（第 5 步改造后验证）、durable child admission、file-stage ordering、direct YuanTianGang IPC、UI projection、folder tree consequence——**已确认接线**（2026-07-20 读源码核实）：`yuchigong.ts:214` emit Qizou `scan_completed` → `event-routing.yml:265` 路由到魏征 Shengzhi `add_paths` → `weizheng.ts:188` `handleAddPaths` 消费。第 1-6 步改造新事件类型后，需重新确认这条链路的触发点（`yuchigong.ts` emit `scan_completed` 的时机）改用新 `ScanTerminal` 而不是旧事件，不能假设改造后自动保留。

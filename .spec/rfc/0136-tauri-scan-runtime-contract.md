# RFC 0136: Tauri persisted queue scan pipeline

- **Start Date**: 2026-07-18
- **Last updated**: 2026-07-19
- **Status**: Draft
- **Priority**: P1e
- **Area**: Photasa / Tauri scan queue / scan pipeline / scan UI
- **Depends on**: [0117](./completed/0117-tauri-scan-pipeline-parity.md), [0132](./completed/0132-tauri-photasa-scan-crate.md), [0133](./completed/0133-tauri-photasa-watch-crate.md), [0138](./0138-tauri-photasa-config-crate.md)（文件流水线的 config 写入阶段依赖 `photasa-config` crate 的 `add_photo_to_folder_list`）
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

| Layer                | 对应人 (Zhenguan owner)  | Owns                                                                                  | Must not depend on                                        |
| -------------------- | ------------------------ | ------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| `photasa-types`      | 无人（纯类型，无职责）   | scan entry, file-processing request/result types                                      | application crates                                        |
| `photasa-scan`       | 千里眼                   | one current task direct directory/file discovery; emits reports                       | thumbnail crate, config implementation, Tauri, queue      |
| `photasa-thumbnail`  | 无人（纯机制，无职责）   | thumbnail creation/removal request                                                    | scan crate, config implementation, queue                  |
| `photasa-watch`      | 顺风耳                   | watched-root observation normalization, debounce, coalescing; emits `FileObservation` | scan crate, queue, thumbnail/config implementation, Tauri |
| Tauri config module  | 无人（纯机制，无职责）   | `.photasa.json` read/write                                                            | queue/UI services                                         |
| Tauri scan pipeline  | 袁天罡（交通边界职责内） | connects reports to thumbnail/config stages; task terminal outcome                    | queue storage, UI state                                   |
| `YuChiGong`（TS 类） | 尉迟恭                   | persisted queue and PQueue dispatch                                                   | scan internals, thumbnail/config internals                |
| `scanningStore`      | 虞世南（呈现职责内）     | queue UI projection                                                                   | filesystem work                                           |

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

1. `photasa-scan` compiles without thumbnail/config/Tauri/queue dependency.
2. Tauri pipeline composes scan, thumbnail, and config stages for each file report.
3. Directory report only requests Zhenguan durable admission; it does not scan, thumbnail, configure, or await child work.
4. Parent waits for own file pipeline and child durable-admission receipts, not child directory scans.
5. Queue persistence survives crash; startup turns orphan processing task into pending and resumes it.
6. PQueue has one current task; Rust worker has one current scan.
7. One request has exactly one pipeline terminal result.
8. UI shows durable queue state and processed-file progress only.
9. Pipeline terminal completion emits `scan_completed` Qizou; 李世民 routes it to 魏征 `addFolderPath` so discovered child directories reach `folderTree` — not just `scanningStore`.

## Implementation order

1. Define dependency-free report/request types in `photasa-types`.
2. Refactor `photasa-scan` to discovery/report only.
3. Build Tauri scan pipeline composition: file -> thumbnail -> config; directory -> YuanTianGang/QiZou queue-admission request.
4. Add `scan_directory_discovered` YAML routing, `add_scan_task` Shengzhi delivery, and durable-admission receipt without cross-service calls.
5. Preserve one persisted `YuChiGong` queue path and PQueue dispatch.
6. Replace detached Rust scan spawning with managed current-task worker.
7. Settle PQueue only after pipeline terminal result.
8. Verify crash recovery, child non-waiting, durable child admission, file-stage ordering, direct YuanTianGang IPC, and UI projection.

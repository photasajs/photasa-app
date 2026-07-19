# RFC 0143: Tauri scanning & queue commands personification (扫描与队列命令贞观之治设计对齐)

- **Start Date**: 2026-07-19
- **Status**: Draft
- **Priority**: P1
- **Area**: Photasa / Renderer / Zhenguan Design / Scanning
- **Depends on**: [0137](./0137-tauri-zhenguan-direct-ipc-migration.md)（Zhenguan 直连 Tauri IPC 规范）、[0142](./0142-tauri-zhenguan-config-commands-personification.md)（文件夹配置命令拟人化设计对齐）
- **Path**: `.spec/rfc/0143-tauri-zhenguan-scanning-personification.md`

## 1. Decision

重构前端扫描调度引擎 尉迟恭（`YuChiGongService`） 以及 UI（`FolderList.vue`）中与扫描、重新扫描（rescan）相关的操作。

1. **去直接调用 Tauri/API 依赖**：彻底废除 `yuchigong.ts` 对 `window.api`（兼容层）的直接依赖。将子目录遍历（`sub_folders`）、父目录解析（`to_dir_name`）、照片扫描执行（`scan_photos`）全面转化为朝廷奏折/诏令系统，由 袁天罡（`YuanTianGang`）直连天界 IPC 响应。
2. **UI 贞观设计对齐**：废除 UI（`FolderList.vue`）直接调用 `yuChiGong.requestRescan` 服务方法的做法。改为通过 UI（百姓）广播启奏事件（`qizou`），通过李世民（中央事件路由）下发圣旨（`add_scan_task`）给 尉迟恭 执行。
3. **扫描队列状态脱离天枢工作流**：在 Tauri 模式下，拦截 `get_scanning_queue`、`add_scan_action`、`remove_scan_action`、`update_scan_action_status` 四个状态同步奏折。直接通过前端本地 Pinia `scanningStore` 的快照回传，彻底打通 Tauri 生产环境下的状态闭环。
4. **入队去重（Deduplication）**：在圣旨处理中实现完全的去重跳过逻辑。如果目标文件夹已经在扫描队列中（执行中或等待中），一律不进行移除和重新入队，仅打印警告并上报去重，从而避免破坏当前正在执行的扫描线程。

---

## 2. 背景与现状分析

在目前的 Tauri 移植实现中，存在以下违背贞观设计和阻塞生产环境的问题：

1. **UI 越权直接调用服务**：
   `FolderList.vue` 中的重新扫描（rescan）操作直接调用了 `yuChiGong.requestRescan`。在贞观设计体系下，组件属于“百姓”，不能绕过“中央事件总线”去命令内部行政官员。
2. **服务层直接调用底层 IPC 兼容接口**：
   `yuchigong.ts` 的 `executeScan` 函数中强耦合了 `window.api.scanPhotos`、`window.api.scanSubfolders` 以及 `window.api.toDirName` 接口，绕过了房玄龄和袁天罡，破坏了传输边界的独立性。
3. **天枢引擎在生产环境下不可用导致阻塞**：
   目前扫描状态相关的 Zouzhe（如 `add_scan_action`）依然会派发给天枢引擎执行工作流。因为天枢工作流文件未在 Tauri 生产环境打包，这些操作均会失败抛错，进而阻断了尉迟恭的任务物理队列调度（`this.scanQueue.add` 永远无法执行）。
4. **移除并重新入队的弊端**：
   之前的 rescan 实现中，如果任务已存在，会调用 `removeScanTask` 强行在队列中移除再重新入队。这会导致正在执行的后台 Rust 扫描线程异常中断或多重冲突，因此必须转为纯粹的去重（Dedup）策略。

---

## 3. 设计方案

### 3.1 流程图 (重新扫描 rescan 贞观之治流转)

```text
[UI 右键点击重新扫描]
       │ (百姓广播 Qizou: request_rescan)
       ▼
[李世民中央事件总线]
       │ (下发圣旨: add_scan_task, action=rescan)
       ▼
[尉迟恭 (YuChiGongService)]
       │ (1. 检查 isInQueue: 若存在则 Dedup 去重跳过)
       │ (2. 否则写入 Pinia & 本地 p-queue 队列)
       ▼
[executeScan 调度执行]
       ├─ 向房玄龄上报 Zouzhe ──> 袁天罡直连 Rust IPC (to_dir_name / sub_folders / scan_photos)
       └─ 扫描状态同步 Zouzhe ──> 袁天罡直接截获并同步本地 Pinia Store 快照
```

### 3.2 步骤 1: 增设 Zouzhe 奏折事项

在 `apps/photasa/src/interfaces/fang-xuan-ling.interface.ts` 中新增扫描工具事项：

```typescript
export const ZOUZHE_MATTERS = {
    // ...
    TO_DIR_NAME: "to_dir_name", // 获取父目录名称
    SCAN_SUBFOLDERS: "scan_subfolders", // 扫描子文件夹列表
    SCAN_PHOTOS: "scan_photos", // 执行照片扫描
} as const;
```

### 3.3 步骤 2: 尉迟恭（YuChiGong）逻辑重构与去重（Dedup）

在 `apps/photasa/src/services/yuchigong/yuchigong.ts` 的 `handleAddScanTask` 中：

```typescript
private async handleAddScanTask(shengzhi: Shengzhi): Promise<void> {
    const content = shengzhi.content as Record<string, unknown>;
    const path = content.path as string;
    // ...
    // 去重策略：只要在队列中，不论 scan 还是 rescan，都去重跳过，不强行移除和重新入队
    if (this.fangXuanLingService.scanning.isInQueue(path)) {
        logger.warn(`🛡️ 尉迟恭：扫描任务已存在，去重跳过添加 ${path}`);
        this.emitQizou("scan_task_duplicate", {
            shengzhiId: shengzhi.id,
            path,
        });
        return;
    }

    await this.scheduleDirectoryScan(path, action, source);
}
```

### 3.4 步骤 3: 李世民路由与 UI 启奏化

在 `apps/photasa/src/services/lishimin/event-routing.yml` 中新增百姓上书路由：

```yaml
# ✅ 百姓请求重新扫描
request_rescan:
    - when:
          from: "百姓"
          type: "request"
      then:
          service: "尉迟恭"
          shengzhi:
              command: "add_scan_task"
              content:
                  path: "{{qizou.content.path}}"
                  action: "rescan"
                  source: "user"
              priority: "normal"
          description: "百姓请求重新扫描文件夹，下旨尉迟恭添加重新扫描任务"
```

同时修改 `FolderList.vue` 的 `rescan` 实现：

```typescript
async function rescan(key: string): Promise<void> {
    const folderPath = normalizePath(key);
    logger.info(`[FolderList] Requesting rescan for folder: ${folderPath}`);
    qizouBus.emit("qizou", {
        from: "百姓",
        type: "request",
        matter: "request_rescan",
        content: { path: folderPath },
        timestamp: Date.now(),
    });
}
```

### 3.5 步骤 4: 袁天罡直连与本地 Store 队列状态拦截

在 `apps/photasa/src/services/yuantiangang/yuantiangang.ts` 中拦截队列管理与执行奏折，直接回传前端 Pinia `scanningStore` 的快照：

```typescript
// 1. 扫描与路径工具直连 Rust IPC
if (zhaoling.command === ZOUZHE_MATTERS.TO_DIR_NAME) {
    data = await invoke("to_dir_name", { path: zhaoling.context.path });
} else if (zhaoling.command === ZOUZHE_MATTERS.SCAN_SUBFOLDERS) {
    data = await invoke("sub_folders", { folderPath: zhaoling.context.folderPath });
} else if (zhaoling.command === ZOUZHE_MATTERS.SCAN_PHOTOS) {
    // 异步监听事件流
    // ...
}
// 2. 状态队列拦截，不经过天枢工作流
else if (
    zhaoling.command === ZOUZHE_MATTERS.GET_SCANNING_QUEUE ||
    zhaoling.command === ZOUZHE_MATTERS.ADD_SCAN_ACTION ||
    zhaoling.command === ZOUZHE_MATTERS.REMOVE_SCAN_ACTION ||
    zhaoling.command === ZOUZHE_MATTERS.UPDATE_SCAN_ACTION_STATUS
) {
    const scanningStore = useScanningStore();
    data = { queue: scanningStore.queue };
}
```

---

## 4. 交付清单

- [ ] 增加 Zouzhe 事务声明 ([fang-xuan-ling.interface.ts](file:///Volumes/ORICO/ws/prj/picasa/picasa-vue/apps/photasa/src/interfaces/fang-xuan-ling.interface.ts))
- [ ] 更正尉迟恭服务，移除 `window.api` 依赖并实现去重策略 ([yuchigong.ts](file:///Volumes/ORICO/ws/prj/picasa/picasa-vue/apps/photasa/src/services/yuchigong/yuchigong.ts))
- [ ] 编写李世民路由协调规则 ([event-routing.yml](file:///Volumes/ORICO/ws/prj/picasa/picasa-vue/apps/photasa/src/services/lishimin/event-routing.yml))
- [ ] 改造 `FolderList.vue` 的重新扫描触发方式 ([FolderList.vue](file:///Volumes/ORICO/ws/prj/picasa/picasa-vue/apps/photasa/src/components/FolderList.vue))
- [ ] 袁天罡钦天监对扫描执行的直连和扫描队列管理状态拦截器的实现 ([yuantiangang.ts](file:///Volumes/ORICO/ws/prj/picasa/picasa-vue/apps/photasa/src/services/yuantiangang/yuantiangang.ts))
- [ ] 确保 `yuchigong.test.ts` 中的所有单元测试正常运行。

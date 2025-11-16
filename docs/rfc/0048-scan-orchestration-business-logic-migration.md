# RFC 0048: 扫描编排业务逻辑完全下沉 - 尉迟恭自治架构

- **RFC编号**: 0048
- **标题**: 扫描编排业务逻辑迁移 - 职责自洽架构
- **作者**: AI Architect (Agent 1)
- **开始日期**: 2025-11-09
- **更新日期**: 2025-11-15
- **状态**: ✅ 架构设计已确定，待实施
- **类型**: 架构重构
- **目标版本**: v2.0.0
- **依赖RFC**:
  - RFC 0046: 扫描队列持久化 - 千里眼scanning.json管理（已完成95%）✅
  - RFC 0042: scanningFolder四步渐进式迁移（Step 1已完成）✅

---

## 摘要

**职责自洽迁移**：将 App.vue 中的扫描编排逻辑（`orchestrateScan`）迁移到尉迟恭（YuChiGongService），通过启奏-圣旨协调跨职责操作。删除 AppHelper.ts（306行），App.vue 减少 ~200 行代码。

**核心原则** - "职责自洽 + 启奏描述事实"（2025-11-09确定）：
1. ✅ **最小依赖** - 尉迟恭只注入 FangXuanLingService
2. ✅ **职责内自己执行** - 扫描、删除任务由尉迟恭直接完成
3. ✅ **启奏描述事实** - scan_started/completed/failed（描述"发生了什么"）
4. ✅ **启奏不是命令** - ❌ update_folder_tree（描述"要做什么"）
5. ✅ **跨职责启奏协调** - scan_completed → 李世民路由 → 魏征响应圣旨
6. ✅ **删除callbacks** - 完全移除callbacks机制
7. ✅ **删除中间层** - AppHelper.ts 完全废弃

---

## 动机

### 当前架构问题

**问题1：UI层包含复杂业务逻辑**
```typescript
// App.vue Line 250-269: watchArray监听scanningFolder变化
watchArray(scanningFolder, () => {
    if (scanPhotosTask.isIdle) {
        startScanning();  // ❌ UI层主动驱动
    }
}, { deep: true });

// App.vue Line 356-383: startScanning函数（27行）
async function startScanning(): Promise<void> {
    scanMonitoringService.recordActivity();
    const result = await orchestrateScan(scanningFolder.value, callbacks);
    // ... 复杂的扫描编排逻辑
}

// App.vue Line 272-354: callbacks对象定义（147行）
const callbacks: ScanCallbacks = {
    logInfo: logger.info.bind(logger),
    logDebug: logger.debug.bind(logger),
    // ... 大量回调方法
};
```

**问题2：AppHelper.ts 作为中间层**
```typescript
// AppHelper.ts 306行代码
export async function orchestrateScan(
    scanQueue: ScanAction[],
    callbacks: ScanCallbacks,
): Promise<{...}> {
    // 复杂的编排逻辑
}
```

**问题3：职责不清晰**
- App.vue 既负责 UI 渲染，又负责扫描编排（200+ 行）
- AppHelper.ts 作为纯函数工具库，但只被 App.vue 使用
- 扫描逻辑与 UI 耦合，难以测试

**问题4：违反 Linus "简洁执念"**
- 超过 3 层抽象：App.vue → AppHelper → callbacks
- 复杂的回调机制
- 代码散落在多个文件

### 目标

1. **服务完全自治** - 尉迟恭自主监听队列，自动处理
2. **删除 500+ 行代码** - App.vue -200 行，AppHelper.ts -306 行
3. **事件驱动架构** - 通过启奏（Qizou）通信
4. **UI 层极简** - 只监听事件，更新 UI
5. **易于测试** - 服务层独立测试，无需 UI 环境

---

## 详细设计

### 架构对比

#### 当前架构（问题多多）

```
用户操作 → 队列更新
         ↓
    watchArray 触发（App.vue）
         ↓
    startScanning()（App.vue）
         ↓
    orchestrateScan()（AppHelper）
         ↓
    callbacks 回调（147行）
         ↓
    更新 UI
```

**问题**：
- UI 层主动驱动业务逻辑
- 多层嵌套调用
- 复杂的回调机制

---

#### 目标架构（职责自洽 + 启奏协调）

```
用户操作 → 尉迟恭.addScanTask()
         ↓
       奏折 → 天界持久化
         ↓
    ScanningStore.queue 更新
         ↓
    尉迟恭 watch 触发（内部）← 自动
         ↓
    尉迟恭.processNextTask()（内部）← 自动
         ├─ emitQizou('scan_started') → mitt → App.vue 更新 UI
         ├─ window.api.scanPhotos() → 执行扫描（职责内）
         ├─ removeScanTask() → 移除任务（职责内）
         └─ emitQizou('scan_completed') → mitt → 李世民路由
                ↓
         李世民查找 event-routing.yml
                ↓
         杜如晦发圣旨给魏征
                ↓
         魏征.addFolderPath() ← 响应圣旨
```

**核心原则：职责自洽 + 启奏协调**
- ✅ **职责内自己执行** - 扫描、删除任务由尉迟恭直接完成
- ✅ **跨职责启奏协调** - 需要魏征更新树时，启奏 scan_completed 让李世民下旨
- ✅ **启奏描述事实** - scan_started/completed/failed（不是 update_folder_tree）
- ✅ **UI 监听启奏** - App.vue 通过 mitt 监听启奏事件更新 UI

**优势**：
- ✅ 服务完全自主，无需 UI 驱动
- ✅ 职责边界清晰，易于理解
- ✅ 符合官府架构，遵循启奏-圣旨流程
- ✅ 代码大幅减少（~470 行）
- ✅ 易于测试和维护

---

### 技术实现

#### 1. 尉迟恭完全自治

**文件**: `src/renderer/src/services/yuchigong/yuchigong.ts`

```typescript
import { watch } from "vue";
import type { ScanAction } from "@common/scan-types";
import { loggers } from "@common/logger";

const logger = loggers.yuchigong;

export class YuChiGongService implements IService, IYuChiGongService {
    private isScanning = false;

    constructor(
        private fangXuanLingService: IFangXuanLingService
        // ✅ 最小依赖原则：只注入FangXuanLingService
        // ✅ 职责自洽：扫描、删除任务自己完成
        // ✅ 跨职责协调：通过启奏事件（scan_completed）让李世民协调魏征
    ) {
        logger.info("🛡️ 尉迟恭就任，负责扫描队列业务逻辑管理");

        // ✅ 启动时自动初始化扫描监听
        this.startAutoScan();
    }

    /**
     * 启动自动扫描监听（核心：服务自治）
     * 监听队列变化，自动触发扫描
     */
    private startAutoScan(): void {
        logger.info("🛡️ 尉迟恭：启动自动扫描监听");

        // 监听 ScanningStore.queue 变化
        watch(
            () => this.scanningQueue,
            (newQueue) => {
                logger.debug(`🛡️ 尉迟恭：检测到队列变化，当前 ${newQueue.length} 个任务`);

                // 如果有任务且当前空闲，自动处理
                if (!this.isScanning && newQueue.length > 0) {
                    // 使用 setTimeout 避免 watch 内部修改响应式数据
                    setTimeout(() => this.processNextTask(), 0);
                }
            },
            { deep: true }
        );

        logger.info("🛡️ 尉迟恭：自动扫描监听已启动");
    }

    /**
     * 处理下一个扫描任务
     *
     * **核心原则**：职责自洽 + 启奏描述事实
     * - ✅ 职责内操作自己执行（扫描、删除任务）
     * - ✅ 跨职责操作启奏协调（scan_completed → 李世民 → 魏征）
     * - ✅ 启奏描述事实，不是命令（scan_completed，不是update_folder_tree）
     */
    private async processNextTask(): Promise<void> {
        if (this.isScanning) {
            logger.debug("🛡️ 尉迟恭：扫描进行中，跳过");
            return;
        }

        const queue = this.scanningQueue;
        if (queue.length === 0) {
            logger.debug("🛡️ 尉迟恭：队列为空，扫描完成");
            return;
        }

        const task = queue[0];
        this.isScanning = true;

        logger.info(`🛡️ 尉迟恭：开始处理扫描任务 ${task.path}`);

        try {
            // 1. 启奏：扫描开始（✅ 描述事实："扫描开始了"）
            this.emitQizou('scan_started', {
                path: task.path,
                action: task.action
            });

            // 2. 重扫描时重置配置（✅ 职责内操作）
            if (task.action === 'rescan' && task.operationType === 'directory') {
                logger.debug(`🛡️ 尉迟恭：重置配置 ${task.path}`);
                await window.api.resetPhotasaConfig(task.path);
            }

            // 3. 文件操作 - 记录父目录（✅ Linus补充）
            let parentDir: string | null = null;
            if (task.operationType === 'file') {
                parentDir = window.api.toDirName(task.path);
            }

            // 4. 目录操作 - 扫描子文件夹（✅ 职责内操作）
            if (task.operationType === 'directory') {
                const subfolders = await window.api.scanSubfolders(task.path);
                if (subfolders.length > 0) {
                    logger.info(`🛡️ 尉迟恭：发现 ${subfolders.length} 个子文件夹`);
                    await this.addScanTasks(subfolders, 'scan');
                }
            }

            // 5. 执行扫描任务（✅ 职责内操作）
            logger.debug(`🛡️ 尉迟恭：执行扫描 ${task.path}`);
            await window.api.scanPhotos({
                path: task.path,
                action: task.action,
                thumbnailSize: 150,
                isDirectory: task.operationType !== 'file'
            });

            // 6. 移除已完成任务（✅ 职责内操作）
            await this.removeScanTask(task.path);

            // 7. 启奏：扫描完成（✅ 描述事实："扫描完成了"）
            // ✅ 不直接调用魏征，让李世民根据event-routing.yml决定是否下旨给魏征
            this.emitQizou('scan_completed', {
                path: task.path,
                parentDir: parentDir,
                operationType: task.operationType
            });

            logger.info(`🛡️ 尉迟恭：任务处理完成 ${task.path}`);

        } catch (error) {
            logger.error(`🛡️ 尉迟恭：扫描失败 ${task.path}`, error);

            // 失败也要移除任务，避免卡死
            await this.removeScanTask(task.path);

            // 启奏：扫描失败（✅ 描述事实："扫描失败了"）
            this.emitQizou('scan_failed', {
                path: task.path,
                error: String(error)
            });
        } finally {
            this.isScanning = false;
            // watch 会自动触发下一个任务
        }
    }

    // ... 其他现有方法保持不变（addScanTasks, removeScanTask, emitQizou等）
}
```

---

#### 2. event-routing.yml 新增路由

**文件**: `src/renderer/src/services/lishimin/event-routing.yml`

**YAML 格式规范** ⚠️：
- ✅ **必须使用纯 YAML 语法** - 不使用 JSON 风格
- ❌ **禁止 JSON 对象语法** - `{from: "尉迟恭"}`
- ❌ **禁止 JSON 数组语法** - `["path1", "path2"]`
- ✅ **使用 YAML 缩进表达层次** - 清晰、可维护

```yaml
# ✅ 正确：纯 YAML 格式
scan_completed:
  - when:
      from: "尉迟恭"
      type: "report"
    then:
      service: "魏征"
      shengzhi:
        command: "add_paths"
        content:
          paths:
            - "{{qizou.content.path}}"  # ← YAML 列表语法
      description: "扫描完成后，下旨魏征更新树"

# ❌ 错误：JSON 风格（已废弃）
# scan_completed:
#   - when: {from: "尉迟恭"}  # ← 禁止使用
#     then:
#       shengzhi:
#         content:
#           paths: ["{{qizou.content.path}}"]  # ← 禁止使用
```

**关键原则**：
- ✅ **启奏描述事实**："scan_started"、"scan_completed"、"scan_failed"
- ❌ **启奏不是命令**："update_folder_tree"、"add_to_queue"
- ✅ **一个启奏多个响应**：scan_completed可同时触发魏征和状态栏
- ✅ **尉迟恭不知道后果**：只报告扫描完成，李世民决定协调谁
- ✅ **纯 YAML 格式**：不混用 JSON 语法，保持一致性

---

#### 3. App.vue 简化

**文件**: `src/renderer/src/App.vue`

**删除内容**（~200 行）：
```typescript
// ❌ 删除：orchestrateScan 导入（Line 1）
import { orchestrateScan, type ScanCallbacks } from "./AppHelper";

// ❌ 删除：watchArray 监听（Line 250-269, 19行）
watchArray(scanningFolder, () => {
    if (scanPhotosTask.isIdle) {
        logger.info("👑 scanPhotosTask is idle, calling startScanning");
        startScanning();
    }
}, { deep: true });

// ❌ 删除：callbacks 对象（Line 272-354, 147行）- 完全不需要了！
const callbacks: ScanCallbacks = {
    logInfo: logger.info.bind(logger),
    logDebug: logger.debug.bind(logger),
    logError: logger.error.bind(logger),
    updateProcessingStatus: (status: string) => { ... },
    updateFileProgress: (fileName: string) => { ... },
    clearProcessingStatus: () => { ... },
    updateFolderTree: (path: string) => weiZheng.addFolderPath(path), // ❌ 不再需要
    removeScanTask: async (path: string) => yuChiGong.removeScanTask(path),
    scanSubfolders: scanSubfolders,
    addScanFoldersToQueue: async (paths, action) => yuChiGong.addScanTasks(paths, action),
    performScanTask: async (action) => scanPhotosTask.perform(action),
    resetPhotasaConfig: async (path) => resetPhotasaConfig(path),
    extractParentDir: (path) => window.api.toDirName(path),
    scheduleNextScan: () => setTimeout(() => startScanning(), 0),
    t: (key, params) => t(key, params || {}),
};

// ❌ 删除：startScanning 函数（Line 356-383, 27行）
async function startScanning(): Promise<void> {
    logger.debug("👑 [扫描启动] 开始扫描流程");
    try {
        scanMonitoringService.recordActivity();
        const result = await orchestrateScan(scanningFolder.value, callbacks);
        // ...
    } catch (error) {
        logger.error("👑 [扫描启动] 扫描过程中发生异常", error);
        scanMonitoringService.recordFailure();
        throw error;
    }
}
```

**新增内容**（~20行）：
```typescript
// ✅ Linus版本：App.vue只watch Store，不监听mitt！
// ✅ 李世民路由器负责监听mitt，App.vue只watch Store
watch(
  () => yuChiGong.scanningQueue,
  (newQueue) => {
    if (newQueue.length > 0) {
      processingFile.value = t('status.scanningPath', {path: newQueue[0].path});
    } else {
      processingFile.value = '';
    }
  },
  {deep: true}
);
```

**关键原则**：
- ✅ **李世民路由器负责监听mitt** - 已在lishimin/event-routing.yml中处理
- ✅ **App.vue只watch Store** - 监听yuChiGong.scanningQueue变化
- ❌ **App.vue不监听mitt** - 避免重复监听

**代码减少**：
- 删除：~200 行（watchArray, startScanning, callbacks 对象完整删除）
- 新增：~20 行（watch Store监听队列变化）
- **净减少：~180 行**

---

#### 4. 删除 AppHelper.ts

**文件**: `src/renderer/src/AppHelper.ts` (306 行)

**操作**: 完全删除此文件

**理由**:
- `orchestrateScan` 逻辑已集成到 YuChiGong
- `ScanCallbacks` 接口不再需要
- 工具函数已内联到 YuChiGong
- 符合 Linus "消除复杂性"原则

---

#### 5. PreferenceStore 清理

**文件**: `src/renderer/src/stores/preference.ts`

**删除方法**:
```typescript
// ❌ 删除：Line 513-527
completeScanPath(folder: string): void {
    const index = this.scanningFolder.findIndex((f) => f.path === folder);
    if (index > -1) {
        this.scanningFolder.splice(index, 1); // 直接操作数组
    }
}
```

**修复 removePath()**:
```typescript
// Line 635: 删除对 completeScanPath 的调用
removePath(path: string): void {
    // ... 其他清理逻辑 ...

    // ❌ 删除这行
    // this.completeScanPath(path);

    // ✅ 队列清理由尉迟恭自动处理（watch 机制）
    // 无需手动干预
}
```

---

## 实施计划

### Phase 1: YuChiGong 扩展（1.5 天）

**1.1 新增依赖注入**
- [ ] 添加 `weiZheng: IWeiZhengService`
- [ ] 添加 `scanPhotosTask: IScanPhotosTask`
- [ ] 添加 `i18n: I18n`
- [ ] 更新构造函数

**1.2 实现自动扫描机制**
- [ ] 实现 `startAutoScan()` - watch 监听队列
- [ ] 实现 `processNextTask()` - 核心扫描逻辑
- [ ] 实现 `processSubfolders()` - 子文件夹处理
- [ ] 错误处理和重试机制

**1.3 新增启奏事件**
- [ ] 定义 4 个新 QizouMatters
- [ ] 在关键节点发送启奏
- [ ] 测试启奏事件流程

**1.4 单元测试**
- [ ] 测试 `processNextTask()` 逻辑
- [ ] 测试 watch 触发机制
- [ ] 测试错误处理
- [ ] 覆盖率 ≥ 90%

---

### Phase 2: App.vue 简化（0.5 天）

**2.1 删除代码**
- [ ] 删除 `orchestrateScan` 导入
- [ ] 删除 `callbacks` 对象（147行）
- [ ] 删除 `startScanning()` 函数（27行）
- [ ] 删除 `watchArray(scanningFolder)` 监听（19行）

**2.2 添加启奏监听**
- [ ] 监听 `SCAN_STARTED` 事件
- [ ] 监听 `SCAN_COMPLETED` 事件
- [ ] 监听 `SCAN_FAILED` 事件
- [ ] 更新 UI 状态显示

**2.3 测试**
- [ ] E2E 测试：UI 正确更新
- [ ] E2E 测试：扫描流程完整

---

### Phase 3: PreferenceStore 清理（0.5 天）

**3.1 删除旧方法**
- [ ] 删除 `completeScanPath()` (Line 513-527)
- [ ] 从 `removePath()` 删除队列操作逻辑（Line 635）

**3.2 测试**
- [ ] 单元测试：removePath() 不操作队列
- [ ] 集成测试：路径移除流程

---

### Phase 4: AppHelper 废弃（0.5 天）

**4.1 删除文件**
- [ ] 删除 `src/renderer/src/AppHelper.ts` (306 行)
- [ ] 删除所有导入引用
- [ ] 更新 TypeScript 配置

**4.2 验证**
- [ ] 编译通过，零错误
- [ ] 所有测试通过
- [ ] Lint 检查通过

---

### Phase 5: 集成测试（0.5 天）

**5.1 端到端测试**
- [ ] 添加扫描任务自动触发
- [ ] 扫描完成自动移除任务
- [ ] 队列自动循环处理
- [ ] UI 状态正确更新

**5.2 性能测试**
- [ ] 连续扫描 100 个任务
- [ ] watch 性能监控
- [ ] 内存泄漏检查

---

### Phase 6: 文档更新（0.5 天）

- [ ] 更新 API 文档
- [ ] 更新架构图
- [ ] 更新用户手册
- [ ] 标记 RFC 0048 为 Completed

**总计**: 约 3 天

---

## 验收标准

### 功能性

- ✅ 队列添加后自动触发扫描（无需 UI 参与）
- ✅ 扫描完成自动移除任务
- ✅ 队列自动循环处理
- ✅ UI 实时显示扫描状态
- ✅ 错误正确处理和提示

### 架构合规

- ✅ 服务完全自治（YuChiGong 内部 watch）
- ✅ UI 层极简（只监听事件）
- ✅ 事件驱动通信（启奏）
- ✅ 零 callbacks 机制

### 代码质量

- ✅ 删除 AppHelper.ts (306 行)
- ✅ App.vue 减少 ~180 行
- ✅ **总计减少 ~500 行代码**
- ✅ 单元测试覆盖率 ≥ 90%
- ✅ 零 lint 错误
- ✅ 零 TypeScript 错误

### 可维护性

- ✅ 逻辑集中在服务层
- ✅ 易于测试（服务独立测试）
- ✅ 易于扩展（新增扫描策略）
- ✅ 代码清晰，职责单一

---

## 风险评估

### 低风险

- **服务依赖注入** - 现有依赖注入机制成熟
- **启奏事件** - 现有 Qizou 系统稳定

### 中风险

- **watch 性能** - 队列频繁更新时的性能
  - **缓解**: 使用 setTimeout 延迟执行
  - **监控**: 性能日志

- **并发扫描** - `isScanning` 标志防止并发
  - **缓解**: 严格的标志检查
  - **测试**: 并发测试

### 零破坏性

- ✅ API 接口不变（addScanTask, removeScanTask）
- ✅ 持久化格式不变（scanning.json）
- ✅ 用户体验不变（扫描流程相同）
- ✅ **向后兼容性 100%**

---

## 核心收益

### 代码简化

- **App.vue**: -200 行（删除 watchArray, startScanning，callbacks 保持不变）
- **删除 AppHelper.ts**: -306 行
- **PreferenceStore**: -15 行
- **总计减少**: ~520 行代码

### 架构优化

- ✅ **职责清晰** - UI vs 服务完全分离
- ✅ **测试简化** - 服务独立测试，无需 UI 环境
- ✅ **维护性提升** - 逻辑集中，易于修改
- ✅ **扩展性强** - 新增扫描策略只需修改 YuChiGong

### 符合 Linus 哲学

- ✅ **"好品味"** - 消除 callbacks 复杂性，统一数据流
- ✅ **"简洁执念"** - 代码大幅减少，逻辑更清晰
- ✅ **"实用主义"** - 服务自治更实用，易于维护
- ✅ **"Never break userspace"** - 零破坏性，用户无感知

---

## 替代方案

### 方案A：保留 AppHelper.ts（已否决）

**优点**：
- 纯函数设计，易测试

**缺点**：
- 增加抽象层次
- 复杂的 callbacks 机制
- 代码散落在多个文件

### 方案B：保留原有架构（已否决）

**优点**：
- 无需迁移
- 风险低

**缺点**：
- UI 层包含业务逻辑
- 难以测试和维护
- 违反单一职责原则

**结论**：采用激进重构方案，删除 500+ 行代码，实现服务完全自治

---

## 未解决问题

1. **扫描并发策略？**
   - 当前：串行扫描（`isScanning` 标志）
   - 待确认：是否需要支持并发扫描

2. **watch 性能优化？**
   - 当前：deep watch + setTimeout
   - 待确认：是否需要 debounce

3. **扫描超时策略？**
   - 当前：无超时限制
   - 待确认：是否需要单任务超时

---

## 参考资料

- RFC 0042: scanningFolder四步渐进式迁移
- RFC 0046: 扫描队列持久化
- CLAUDE.md: 双界日志风格规范
- Linus Torvalds: "好品味"编程哲学

---

## 架构演变历史（2025-11-09）

### 第一版：最简迁移（19:55）❌ 被否决
```typescript
// 注入callbacks对象，复制orchestrateScan逻辑
constructor(fangXuanLingService, callbacks: ScanCallbacks)
```
**问题**：callbacks是脱裤子放屁，违反职责自洽原则

---

### 第二版：直接注入服务（19:57）❌ 被否决
```typescript
// 直接注入魏征和i18n
constructor(fangXuanLingService, weiZheng, i18n)
await this.weiZheng.addFolderPath(path); // 直接调用魏征
```
**问题**：尉迟恭不应该知道需要更新树，违反职责分离

---

### 第三版：启奏命令（20:02）❌ 被否决
```typescript
// 只注入FangXuanLingService，通过启奏协调
this.emitQizou('update_folder_tree', {path}); // ❌ 错误：命令式
```
**问题**：update_folder_tree是命令，不是事实描述

---

### 第四版：启奏事实（20:04）✅ 最终确定
```typescript
// 只注入FangXuanLingService
constructor(fangXuanLingService)

// 启奏描述事实
this.emitQizou('scan_completed', {path, isDirectory}); // ✅ 正确：事实描述
```

**关键原则**（20:05最终确认）：
1. ✅ **启奏描述"发生了什么"**（事实）：scan_started/completed/failed
2. ❌ **启奏不是"要做什么"**（命令）：update_folder_tree
3. ✅ **尉迟恭不知道后果**：只报告扫描完成，李世民决定协调谁
4. ✅ **一个启奏多个响应**：scan_completed可同时触发魏征、状态栏等

---

## 更新历史

- **2025-11-15**: 架构设计已确定，更新RFC文档
  - 明确最终架构原则
  - 记录架构演变历史
  - 标记状态为"待实施"

- **2025-11-09**: 激进重构版本 - "Think Bigger"方案
  - 经过4轮架构讨论，最终确定"启奏描述事实"原则
  - 删除callbacks机制
  - 删除AppHelper.ts
  - App.vue减少~200行
  - 服务完全自治架构

# RFC 0042: scanningFolder四步渐进式迁移

- **RFC编号**: 0042
- **标题**: scanningFolder四步渐进式迁移
- **作者**: AI Architect (Agent 1)
- **开始日期**: 2025-10-16
- **状态**: 📋 Draft - 规划中
- **最后更新**: 2025-10-16 (架构修正)
- **类型**: 架构重构
- **目标版本**: v2.0.0
- **依赖RFC**:
  - RFC 0038: 偏好设置工作流集成与Store边界统一（已完成）✅
  - RFC 0038 Phase 7: qizou-shengzhi架构（已完成）✅
- **相关RFC**:
  - RFC 0032: 千里眼扫描引擎
  - RFC 0043: useQinQiong()访问模式

---

## 摘要

本RFC采用四步渐进式策略，将`scanningFolder`从当前混乱架构逐步迁移到清晰的人界天界分工架构。

**核心架构原则** (2025-10-16修正):
1. **只有FangXuanLing可以管理Store** - 其他服务不能直接访问Store
2. **Store先行** - 先创建专用Store，再迁移业务逻辑
3. **QianLiYan优先** - 持久化是第一要务
4. **Don't break things** - 不破坏现有功能

**四步路线图**（修正后）：
- **Step 1**: 房玄龄创建专用ScanningQueueStore（Store分离优先）
- **Step 2**: 千里眼追踪scanning.json持久化（天界优先）
- **Step 3**: 尉迟恭接管App.vue扫描编排（业务逻辑下沉）
- **Step 4**: scan-service迁移讨论（天界化，待评估）

---

## 背景

### 当前架构问题

**问题1: Store职责混乱**
```typescript
// ❌ 当前：PreferenceStore
export interface PreferenceState {
    preferences: UnifiedPreferences;  // 用户偏好设置
    appState: {
        scanningFolder: ScanAction[];  // ❌ 运行时队列不应在preference中
        // ...
    };
}
```

**问题2: UI层包含业务逻辑**
```typescript
// ❌ 当前：App.vue (344-371行)
async function startScanning(): Promise<void> {
    scanMonitoringService.recordActivity();
    const result = await orchestrateScan(scanningFolder.value, callbacks);
    // ... 复杂的扫描编排逻辑
}
```

**问题3: 持久化机制不当**
- ✅ 当前通过PreferenceStore持久化到localStorage（有持久化）
- ❌ 但localStorage不可靠（浏览器可能清空、配额限制）
- ❌ 运行时队列不应和用户preference混在一起持久化
- ❌ 应该由天界（千里眼）管理持久化到scanning.json文件

**问题4: 扫描引擎位置错误**
- orchestrateScan在Renderer进程
- 应该在Main进程（千里眼引擎）
- 但迁移复杂度高，需要谨慎评估

### 架构设计原则 (2025-10-16)

**核心原则**：只有FangXuanLing可以管理Store

```
服务层访问Store的正确方式：

❌ 错误：
YuChiGong → 直接访问 → ScanningQueueStore

✅ 正确：
YuChiGong → FangXuanLing.getScanningQueue() → ScanningQueueStore
```

---

## 迁移原则

### 核心原则

1. **Store访问隔离** - 只有FangXuanLing可以访问Store
2. **每步独立可测试** - 单元测试 + 集成测试 + 手动测试
3. **每步可回滚** - 明确的回滚计划
4. **不破坏现有功能** - 用户无感知

### 质量标准

- ✅ 单元测试覆盖率 ≥ 90%
- ✅ 零lint错误
- ✅ 零TypeScript类型错误
- ✅ 功能完全一致
- ✅ 性能无明显下降

---

## Step 1: 房玄龄创建ScanningQueueStore（Store先行）

### 目标

**优先级1**: 将scanningFolder从PreferenceStore.appState中分离出来，创建专用的ScanningQueueStore。

**核心原则**:
- ✅ **只有FangXuanLing可以管理Store**
- ✅ Store分离必须先行，后续服务才能正确访问
- ✅ 运行时队列不应混在preference中

### 当前架构问题

```typescript
// ❌ 当前：PreferenceStore
export interface PreferenceState {
    preferences: UnifiedPreferences;  // 用户偏好设置（应该持久化）
    appState: {
        scanningFolder: ScanAction[];  // ❌ 运行时队列（不应该在preference中）
        // ...
    };
}
```

**问题**：
- ❌ 概念混淆：queue不是preference
- ❌ 持久化错误：runtime queue被持久化到preference
- ❌ 职责不清：PreferenceStore管理运行时队列

### 迁移设计

#### 1.1 FangXuanLing创建ScanningQueueStore

```typescript
// src/renderer/src/services/fangxuanling/scanning-queue-store.ts

import { defineStore } from "pinia";
import type { ScanAction } from "@common/scan-types";
import { loggers } from "@common/logger";

const logger = loggers.app;

/**
 * 扫描队列State接口
 *
 * ⚠️ 注意：此Store不持久化（persist: false）
 * 运行时队列状态，持久化由天界（千里眼）管理
 */
export interface ScanningQueueState {
    /** 扫描队列 */
    queue: ScanAction[];

    /** 是否正在处理 */
    isProcessing: boolean;

    /** 当前正在扫描的路径 */
    currentPath: string | null;
}

/**
 * 扫描队列Store
 *
 * 职责：
 * - 管理扫描队列的运行时状态
 * - 提供队列增删改查接口
 * - 不负责持久化（由千里眼管理scanning.json）
 *
 * 访问方式：
 * - ❌ 服务不能直接访问此Store
 * - ✅ 必须通过FangXuanLing提供的服务方法访问
 */
export const useScanningQueueStore = defineStore("scanningQueue", {
    state: (): ScanningQueueState => ({
        queue: [],
        isProcessing: false,
        currentPath: null,
    }),

    getters: {
        /**
         * 获取队列大小
         */
        queueSize: (state) => state.queue.length,

        /**
         * 获取队列中的所有路径
         */
        queuePaths: (state) => state.queue.map(action => action.path),

        /**
         * 检查路径是否在队列中
         */
        isInQueue: (state) => (path: string) => {
            return state.queue.some(action => action.path === path);
        },

        /**
         * 获取下一个待扫描任务
         */
        nextScanAction: (state) => state.queue[0] || null,
    },

    actions: {
        /**
         * 添加到队列
         *
         * ⚠️ 内部方法：不应被服务直接调用
         * 应通过FangXuanLing.addToScanningQueue()访问
         */
        addToQueue(action: ScanAction): void {
            logger.debug(`📋 房玄龄Store：添加扫描任务 ${action.path}`);
            this.queue.push(action);
        },

        /**
         * 从队列中移除
         *
         * ⚠️ 内部方法：不应被服务直接调用
         * 应通过FangXuanLing.removeFromScanningQueue()访问
         */
        removeFromQueue(path: string): void {
            const index = this.queue.findIndex(action => action.path === path);
            if (index >= 0) {
                logger.debug(`📋 房玄龄Store：移除任务 ${path}`);
                this.queue.splice(index, 1);
            }
        },

        /**
         * 清空队列
         */
        clearQueue(): void {
            logger.info("📋 房玄龄Store：清空扫描队列");
            this.queue = [];
            this.isProcessing = false;
            this.currentPath = null;
        },

        /**
         * 批量设置队列（用于从天界恢复）
         */
        setQueue(queue: ScanAction[]): void {
            logger.info(`📋 房玄龄Store：设置扫描队列 (${queue.length}个任务)`);
            this.queue = [...queue];
        },

        /**
         * 更新处理状态
         */
        setProcessingStatus(isProcessing: boolean, currentPath: string | null = null): void {
            this.isProcessing = isProcessing;
            this.currentPath = currentPath;
        },

        /**
         * 更新扫描任务进度
         */
        updateProgress(path: string, progress: { processed: number; total: number }): void {
            const action = this.queue.find(a => a.path === path);
            if (action) {
                action.progress = {
                    processed: progress.processed,
                    total: progress.total,
                    cacheEnabled: true,
                };
            }
        },
    },

    // ⚠️ 关键：不持久化到localStorage
    persist: false,
});

/**
 * ScanningQueueStore类型导出
 */
export type ScanningQueueStore = ReturnType<typeof useScanningQueueStore>;
```

#### 1.2 FangXuanLing提供服务方法（Store访问封装）

```typescript
// src/renderer/src/services/fangxuanling/fangxuanling.ts

import { useScanningQueueStore, type ScanningQueueStore } from "./scanning-queue-store";
import type { ScanAction } from "@common/scan-types";

export class FangXuanLingService {
    private scanningQueueStore: ScanningQueueStore | null = null;

    /**
     * 初始化所有Store
     */
    initializeStores(): void {
        logger.info("🏛️ 房玄龄：初始化Store系统");

        // 初始化PreferenceStore
        const preferenceStore = usePreferenceStore();

        // ✅ 新增：初始化ScanningQueueStore
        this.scanningQueueStore = useScanningQueueStore();

        logger.info("🏛️ 房玄龄：Store系统初始化完成");
    }

    // ========== 扫描队列访问方法（供其他服务使用） ==========

    /**
     * 获取扫描队列（只读）
     *
     * @returns 扫描队列的快照
     *
     * 使用场景：
     * - YuChiGong读取队列进行编排
     * - UI组件展示队列状态
     */
    getScanningQueue(): ScanAction[] {
        if (!this.scanningQueueStore) {
            logger.error("🏛️ 房玄龄：ScanningQueueStore未初始化");
            return [];
        }
        return [...this.scanningQueueStore.queue];
    }

    /**
     * 获取队列大小
     */
    getScanningQueueSize(): number {
        if (!this.scanningQueueStore) {
            return 0;
        }
        return this.scanningQueueStore.queueSize;
    }

    /**
     * 检查路径是否在队列中
     */
    isInScanningQueue(path: string): boolean {
        if (!this.scanningQueueStore) {
            return false;
        }
        return this.scanningQueueStore.isInQueue(path);
    }

    /**
     * 添加到扫描队列
     *
     * @param action 扫描任务
     *
     * 使用场景：
     * - 褚遂良完成路径添加后，李世民下旨尉迟恭，尉迟恭通过房玄龄添加任务
     * - UI组件手动添加扫描任务
     */
    addToScanningQueue(action: ScanAction): void {
        if (!this.scanningQueueStore) {
            logger.error("🏛️ 房玄龄：ScanningQueueStore未初始化");
            return;
        }

        logger.info(`🏛️ 房玄龄：添加扫描任务 ${action.path}`);
        this.scanningQueueStore.addToQueue(action);
    }

    /**
     * 从扫描队列移除
     *
     * @param path 路径
     *
     * 使用场景：
     * - 扫描完成后移除任务
     * - 用户取消扫描
     */
    removeFromScanningQueue(path: string): void {
        if (!this.scanningQueueStore) {
            logger.error("🏛️ 房玄龄：ScanningQueueStore未初始化");
            return;
        }

        logger.info(`🏛️ 房玄龄：移除扫描任务 ${path}`);
        this.scanningQueueStore.removeFromQueue(path);
    }

    /**
     * 清空扫描队列
     *
     * 使用场景：
     * - 用户清空所有任务
     * - 应用退出时清理
     */
    clearScanningQueue(): void {
        if (!this.scanningQueueStore) {
            logger.error("🏛️ 房玄龄：ScanningQueueStore未初始化");
            return;
        }

        logger.info("🏛️ 房玄龄：清空扫描队列");
        this.scanningQueueStore.clearQueue();
    }

    /**
     * 批量设置扫描队列（用于恢复）
     *
     * @param queue 队列数据
     *
     * 使用场景：
     * - 从天界（千里眼）恢复队列
     */
    setScanningQueue(queue: ScanAction[]): void {
        if (!this.scanningQueueStore) {
            logger.error("🏛️ 房玄龄：ScanningQueueStore未初始化");
            return;
        }

        logger.info(`🏛️ 房玄龄：设置扫描队列 (${queue.length}个任务)`);
        this.scanningQueueStore.setQueue(queue);
    }

    /**
     * 更新扫描进度
     *
     * @param path 路径
     * @param progress 进度信息
     */
    updateScanningProgress(path: string, progress: { processed: number; total: number }): void {
        if (!this.scanningQueueStore) {
            return;
        }

        this.scanningQueueStore.updateProgress(path, progress);
    }
}
```

#### 1.3 PreferenceStore清理（移除scanningFolder）

```typescript
// src/renderer/src/stores/preference.ts

export type PreferenceState = {
    preferences: UnifiedPreferences;
    appState: {
        firstTime: boolean;
        lastOpenedFolder: string;
        currentFolder: string;
        scannedFolder: string;
        currentFolderConfig: PhotasaConfig;
        folderTree: DataNode[];
        // ❌ 删除：scanningFolder: ScanAction[];
    };
};

// ❌ 删除所有scanningFolder相关的actions：
// - addScanFolder()
// - addFileOperation()
// - completeScanPath()
// 这些功能现在通过FangXuanLing访问ScanningQueueStore
```

#### 1.4 数据迁移逻辑（首次启动）

```typescript
// src/renderer/src/services/lishiming/lishiming.ts

export class LisshimingService {
    /**
     * 首次启动时迁移现有scanningFolder数据
     */
    private async migrateExistingScanningFolder(): Promise<void> {
        const preferenceStore = usePreferenceStore();

        // 检查PreferenceStore中是否还有scanningFolder数据
        const existingScanningFolder = (preferenceStore.$state as any).appState?.scanningFolder;

        if (!existingScanningFolder || existingScanningFolder.length === 0) {
            logger.info("🏛️ 李世民：无需迁移scanningFolder数据");
            return;
        }

        logger.info(`🏛️ 李世民：开始迁移scanningFolder数据（共${existingScanningFolder.length}个任务）`);

        // 通过FangXuanLing迁移到新Store
        this.fangXuanLingService.setScanningQueue(existingScanningFolder);

        // 清空旧Store中的数据
        delete (preferenceStore.$state as any).appState.scanningFolder;

        logger.info("🏛️ 李世民：scanningFolder数据迁移完成");
    }

    private async employ() {
        // ... 其他初始化

        // ✅ 执行数据迁移（在Store初始化后）
        await this.migrateExistingScanningFolder();

        // ... 其他初始化
    }
}
```

### 实施计划

#### Phase 1.1: ScanningQueueStore创建（1天）
- [ ] 创建scanning-queue-store.ts
- [ ] 实现所有state、getters、actions
- [ ] 单元测试：ScanningQueueStore基础功能

#### Phase 1.2: FangXuanLing封装（1天）
- [ ] FangXuanLing添加Store初始化逻辑
- [ ] FangXuanLing实现所有服务方法
- [ ] 单元测试：FangXuanLing服务方法

#### Phase 1.3: PreferenceStore清理（0.5天）
- [ ] 删除scanningFolder字段
- [ ] 删除相关actions
- [ ] 更新类型定义

#### Phase 1.4: 数据迁移（0.5天）
- [ ] 实现migrateExistingScanningFolder()
- [ ] 测试迁移逻辑

#### Phase 1.5: 测试验证（1天）
- [ ] 单元测试：Store + Service层
- [ ] 集成测试：数据迁移流程
- [ ] 手动测试：现有用户升级场景

### 验收标准

- ✅ ScanningQueueStore独立运行
- ✅ FangXuanLing提供完整服务方法
- ✅ PreferenceStore不再包含scanningFolder
- ✅ 数据迁移自动完成
- ✅ 现有代码暂时仍可工作（通过FangXuanLing访问）
- ✅ 单元测试覆盖率≥90%
- ✅ 零lint错误

### 回滚计划

如果Step 1失败：
1. Revert ScanningQueueStore相关代码
2. Restore PreferenceStore.scanningFolder
3. Revert FangXuanLing的新方法
4. **数据迁移可回滚**：旧Store仍保留数据

---

## Step 2: 千里眼追踪scanning.json持久化（天界优先）

### 目标

**优先级1**: 实现断电恢复能力，天界（千里眼）管理持久化，人界（ScanningQueueStore）管理UI状态。

### 当前架构问题

- ✅ 当前通过PreferenceStore持久化到localStorage（有持久化）
- ❌ localStorage不可靠（浏览器可能清空、配额限制、用户清理缓存）
- ❌ 运行时队列和preference概念混淆
- ❌ 应该由千里眼管理scanning.json文件持久化

### 迁移设计

#### 2.1 QianLiYan添加持久化能力

```typescript
// src/engines/qianliyan/core/QianliyanEngine.ts

import { writeFile, readFile } from "fs/promises";
import { join } from "path";

export class QianliyanEngine extends EventEmitter {
    private scanningQueuePath: string;

    constructor(config: QianliyanEngineConfig) {
        super();
        this.config = { ...defaultConfig, ...config };
        this.scanningQueuePath = join(this.config.cacheDir!, "scanning.json");
    }

    /**
     * 新增：保存队列到scanning.json
     */
    async persistQueue(queue: ScanAction[]): Promise<void> {
        try {
            logger.debug(`🌌 千里眼：持久化扫描队列 (${queue.length}个任务)`);

            const data = JSON.stringify({
                version: "1.0",
                timestamp: Date.now(),
                queue: queue,
            }, null, 2);

            await writeFile(this.scanningQueuePath, data, "utf-8");

            logger.info(`🌌 千里眼：扫描队列已持久化到 ${this.scanningQueuePath}`);
        } catch (error) {
            logger.error("🌌 千里眼：持久化扫描队列失败", error);
            throw error;
        }
    }

    /**
     * 新增：从scanning.json恢复队列
     */
    async restoreQueue(): Promise<ScanAction[]> {
        try {
            logger.debug("🌌 千里眼：尝试恢复扫描队列");

            const data = await readFile(this.scanningQueuePath, "utf-8");
            const parsed = JSON.parse(data);

            if (!parsed.queue || !Array.isArray(parsed.queue)) {
                logger.warn("🌌 千里眼：scanning.json格式无效");
                return [];
            }

            logger.info(`🌌 千里眼：恢复扫描队列 (${parsed.queue.length}个任务)`);
            return parsed.queue;
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code === "ENOENT") {
                logger.debug("🌌 千里眼：scanning.json不存在，返回空队列");
                return [];
            }
            logger.error("🌌 千里眼：恢复扫描队列失败", error);
            return [];
        }
    }

    /**
     * 新增：清空持久化队列
     */
    async clearPersistedQueue(): Promise<void> {
        try {
            await writeFile(this.scanningQueuePath, JSON.stringify({
                version: "1.0",
                timestamp: Date.now(),
                queue: [],
            }, null, 2), "utf-8");

            logger.info("🌌 千里眼：已清空持久化队列");
        } catch (error) {
            logger.error("🌌 千里眼：清空持久化队列失败", error);
        }
    }
}
```

#### 2.2 IPC事件定义

```typescript
// src/common/ipc-events.ts

export const IPC_EVENTS = {
    // ... 其他事件

    // 扫描队列持久化
    QIANLIYAN_PERSIST_QUEUE: "qianliyan:persist-queue",
    QIANLIYAN_RESTORE_QUEUE: "qianliyan:restore-queue",
    QIANLIYAN_CLEAR_QUEUE: "qianliyan:clear-queue",
};
```

```typescript
// src/main/ipc/qianliyan-ipc-handler.ts

import { ipcMain } from "electron";
import { IPC_EVENTS } from "@common/ipc-events";
import type { ScanAction } from "@common/scan-types";

/**
 * 注册千里眼IPC处理器
 */
export function registerQianliyanIpcHandlers(qianliyanEngine: QianliyanEngine): void {
    // 持久化队列
    ipcMain.on(IPC_EVENTS.QIANLIYAN_PERSIST_QUEUE, async (_event, queue: ScanAction[]) => {
        try {
            await qianliyanEngine.persistQueue(queue);
        } catch (error) {
            logger.error("🌌 IPC: 持久化队列失败", error);
        }
    });

    // 恢复队列
    ipcMain.handle(IPC_EVENTS.QIANLIYAN_RESTORE_QUEUE, async () => {
        try {
            return await qianliyanEngine.restoreQueue();
        } catch (error) {
            logger.error("🌌 IPC: 恢复队列失败", error);
            return [];
        }
    });

    // 清空队列
    ipcMain.handle(IPC_EVENTS.QIANLIYAN_CLEAR_QUEUE, async () => {
        try {
            await qianliyanEngine.clearPersistedQueue();
        } catch (error) {
            logger.error("🌌 IPC: 清空队列失败", error);
        }
    });

    logger.info("🌌 千里眼IPC处理器已注册");
}
```

#### 2.3 Renderer API包装

```typescript
// src/preload/index.ts

export const api = {
    // ... 其他API

    qianliyan: {
        /**
         * 持久化扫描队列（单向，不等待返回）
         */
        persistQueue: (queue: ScanAction[]): void => {
            ipcRenderer.send(IPC_EVENTS.QIANLIYAN_PERSIST_QUEUE, queue);
        },

        /**
         * 恢复扫描队列（双向，等待返回）
         */
        restoreQueue: (): Promise<ScanAction[]> => {
            return ipcRenderer.invoke(IPC_EVENTS.QIANLIYAN_RESTORE_QUEUE);
        },

        /**
         * 清空持久化队列
         */
        clearQueue: (): Promise<void> => {
            return ipcRenderer.invoke(IPC_EVENTS.QIANLIYAN_CLEAR_QUEUE);
        },
    },
};
```

#### 2.4 FangXuanLing触发持久化

```typescript
// src/renderer/src/services/fangxuanling/fangxuanling.ts

import { debounce } from "lodash-es";

export class FangXuanLingService {
    /**
     * 触发天界持久化（防抖）
     */
    private triggerPersistence = debounce(() => {
        const queue = this.getScanningQueue();
        if (window.api?.qianliyan?.persistQueue) {
            logger.debug("🏛️ 房玄龄：触发天界持久化");
            window.api.qianliyan.persistQueue(queue);
        }
    }, 1000);

    addToScanningQueue(action: ScanAction): void {
        if (!this.scanningQueueStore) {
            logger.error("🏛️ 房玄龄：ScanningQueueStore未初始化");
            return;
        }

        logger.info(`🏛️ 房玄龄：添加扫描任务 ${action.path}`);
        this.scanningQueueStore.addToQueue(action);

        // ✅ 新增：触发持久化
        this.triggerPersistence();
    }

    removeFromScanningQueue(path: string): void {
        if (!this.scanningQueueStore) {
            logger.error("🏛️ 房玄龄：ScanningQueueStore未初始化");
            return;
        }

        logger.info(`🏛️ 房玄龄：移除扫描任务 ${path}`);
        this.scanningQueueStore.removeFromQueue(path);

        // ✅ 新增：触发持久化
        this.triggerPersistence();
    }

    clearScanningQueue(): void {
        if (!this.scanningQueueStore) {
            logger.error("🏛️ 房玄龄：ScanningQueueStore未初始化");
            return;
        }

        logger.info("🏛️ 房玄龄：清空扫描队列");
        this.scanningQueueStore.clearQueue();

        // ✅ 新增：触发天界清空持久化
        if (window.api?.qianliyan?.clearQueue) {
            window.api.qianliyan.clearQueue();
        }
    }
}
```

#### 2.5 LiShiMing启动时恢复

```typescript
// src/renderer/src/services/lishiming/lishiming.ts

export class LisshimingService {
    private async employ() {
        // ✅ 第一步：从天界恢复队列
        await this.restoreQueueFromQianliyan();

        // ... 其他初始化
    }

    /**
     * 从千里眼恢复扫描队列
     */
    private async restoreQueueFromQianliyan(): Promise<void> {
        try {
            logger.info("🏛️ 李世民：从天界恢复扫描队列");

            const restoredQueue = await window.api.qianliyan.restoreQueue();

            if (restoredQueue.length > 0) {
                this.fangXuanLingService.setScanningQueue(restoredQueue);
                logger.info(`🏛️ 李世民：成功恢复${restoredQueue.length}个扫描任务`);
            } else {
                logger.info("🏛️ 李世民：无需恢复扫描队列（队列为空）");
            }
        } catch (error) {
            logger.error("🏛️ 李世民：恢复扫描队列失败", error);
            // 不抛出错误，继续初始化
        }
    }
}
```

### 实施计划

#### Phase 2.1: QianLiYan持久化能力（1天）
- [ ] QianLiYan添加persistQueue()方法
- [ ] QianLiYan添加restoreQueue()方法
- [ ] QianLiYan添加clearPersistedQueue()方法
- [ ] 单元测试：QianLiYan持久化逻辑

#### Phase 2.2: IPC通信层（0.5天）
- [ ] 定义IPC事件常量
- [ ] 实现Main进程IPC处理器
- [ ] 实现Preload API包装

#### Phase 2.3: Renderer集成（1天）
- [ ] FangXuanLing添加triggerPersistence()
- [ ] FangXuanLing在方法中调用持久化
- [ ] LiShiMing添加restoreQueueFromQianliyan()

#### Phase 2.4: 测试验证（1天）
- [ ] 单元测试：QianLiYan持久化/恢复
- [ ] 集成测试：完整持久化恢复流程
- [ ] 手动测试：断电恢复场景
- [ ] 性能测试：防抖机制验证

### 验收标准

- ✅ 队列变化自动持久化到scanning.json
- ✅ 应用启动自动恢复队列
- ✅ 断电后队列不丢失
- ✅ 防抖机制有效（1秒内只持久化一次）
- ✅ 性能无明显影响
- ✅ 单元测试覆盖率≥90%
- ✅ 零lint错误

### 回滚计划

如果Step 2失败：
1. 禁用QianLiYan持久化功能（注释IPC处理器）
2. 禁用启动恢复逻辑
3. 禁用FangXuanLing的triggerPersistence调用
4. **队列恢复到Step 1状态（内存only）**
5. **scanning.json不影响现有功能**

---

## Step 3: 尉迟恭接管App.vue扫描编排（业务逻辑下沉）

### 目标

将App.vue中的扫描触发逻辑迁移到YuChiGong服务，实现UI层与业务逻辑分离。

**核心原则**:
- ✅ YuChiGong通过FangXuanLing访问ScanningQueueStore
- ✅ 不直接访问Store
- ✅ UI层纯化

### 当前架构分析

**App.vue中需要迁移的代码**：
```typescript
// Line 248-266: watchArray监听scanningFolder变化
watchArray(scanningFolder, () => {
    if (scanPhotosTask.isIdle) {
        startScanning();
    }
}, { deep: true });

// Line 344-371: startScanning函数
async function startScanning(): Promise<void> {
    scanMonitoringService.recordActivity();
    const result = await orchestrateScan(scanningFolder.value, callbacks);
    // ... 复杂的扫描编排逻辑
}
```

### 迁移设计

#### 3.1 YuChiGong新增扫描编排能力

```typescript
// src/renderer/src/services/yuchigong/yuchigong.ts

export class YuChiGongService implements IService, IYuChiGongService {
    private _shengzhiPort: MessagePort | null = null;
    private _qizouBus: Emitter<{ qizou: Qizou }> | null = null;
    private scanningTasks = new Set<string>();

    // 新增：扫描编排器
    private isProcessing = false;

    // 新增：扫描监控服务引用
    private scanMonitoringService: ScanMonitoringService;

    constructor(
        fangXuanLingService: IFangXuanLingService,
        scanMonitoringService: ScanMonitoringService
    ) {
        this.fangXuanLingService = fangXuanLingService;
        this.scanMonitoringService = scanMonitoringService;
    }

    /**
     * 新增：监听扫描队列变化（替代App.vue的watchArray）
     */
    watchScanningQueue(): void {
        logger.info("🛡️ 尉迟恭：开始监听扫描队列");

        watchArray(
            () => this.fangXuanLingService.getScanningQueue(),  // ✅ 通过FangXuanLing访问
            () => {
                logger.debug("🛡️ 尉迟恭：检测到扫描队列变化");

                if (scanPhotosTask.isIdle) {
                    this.startScanningOrchestration();
                } else {
                    logger.debug("🛡️ 尉迟恭：扫描任务忙碌，延迟500ms重试");
                    setTimeout(() => {
                        if (scanPhotosTask.isIdle) {
                            this.startScanningOrchestration();
                        }
                    }, 500);
                }
            },
            { deep: true }
        );
    }

    /**
     * 新增：启动扫描编排流程（从App.vue迁移）
     */
    async startScanningOrchestration(): Promise<void> {
        if (this.isProcessing) {
            return;
        }

        this.isProcessing = true;

        try {
            this.scanMonitoringService.recordActivity();

            // ✅ 通过FangXuanLing获取队列
            const queue = this.fangXuanLingService.getScanningQueue();

            const callbacks = this.buildScanCallbacks();
            const result = await orchestrateScan(queue, callbacks);

            if (result.shouldScheduleNext) {
                setTimeout(() => this.startScanningOrchestration(), 0);
            }
        } catch (error) {
            logger.error("🛡️ 尉迟恭：扫描编排异常", error);
        } finally {
            this.isProcessing = false;
        }
    }

    /**
     * 新增：构建扫描回调（从App.vue迁移）
     */
    private buildScanCallbacks(): ScanCallbacks {
        const photosStore = usePhotosStore();
        const statusBarStore = useStatusBarStore();
        const { t } = useI18n();

        return {
            logInfo: logger.info.bind(logger),
            // ... 其他回调

            // ✅ 通过FangXuanLing访问
            completeScanPath: (path: string) => {
                this.fangXuanLingService.removeFromScanningQueue(path);
            },

            addScanFolderToQueue: (path: string, action: string) => {
                const scanAction = createScanAction({
                    path,
                    action: action as "scan" | "rescan" | "current",
                    thumbnailSize: usePreferenceStore().thumbnailSize,
                    operationType: "directory",
                }, "auto");

                // ✅ 通过FangXuanLing添加
                this.fangXuanLingService.addToScanningQueue(scanAction);
            },

            // ...
        };
    }
}
```

#### 3.2 App.vue简化

```typescript
// src/renderer/src/App.vue

<script setup lang="ts">
// ❌ 删除：import { orchestrateScan } from "./AppHelper"
// ❌ 删除：const { scanningFolder } = storeToRefs(preferenceStore)
// ❌ 删除：watchArray(scanningFolder, ...)

// ✅ YuChiGong已经在lishiming中初始化并监听队列
// 无需在App.vue中额外操作
</script>
```

#### 3.3 LiShiMing集成

```typescript
// src/renderer/src/services/lishiming/lishiming.ts

export class LisshimingService {
    private employ() {
        // 初始化YuChiGong
        this.yuChiGongService = new YuChiGongService(
            this.fangXuanLingService,
            scanMonitoringService  // 新增
        );

        // 初始化qizou-shengzhi系统
        this.initializeQizouShengzhiSystem();

        // ✅ YuChiGong开始监听扫描队列
        this.yuChiGongService.watchScanningQueue();
    }
}
```

### 实施计划

#### Phase 3.1: YuChiGong增强（2天）
- [ ] YuChiGong添加scanMonitoringService字段
- [ ] 实现watchScanningQueue()方法
- [ ] 实现startScanningOrchestration()方法
- [ ] 实现buildScanCallbacks()方法
- [ ] 单元测试：YuChiGong扫描编排逻辑

#### Phase 3.2: App.vue简化（0.5天）
- [ ] 删除startScanning()函数
- [ ] 删除watchArray(scanningFolder)
- [ ] 删除callbacks对象构建

#### Phase 3.3: LiShiMing集成（0.5天）
- [ ] 更新YuChiGong构造函数调用
- [ ] 添加watchScanningQueue()调用

#### Phase 3.4: 测试验证（1天）
- [ ] 单元测试：YuChiGong所有新方法
- [ ] 集成测试：完整扫描流程
- [ ] 手动测试：真实扫描场景

### 验收标准

- ✅ App.vue不再包含扫描逻辑
- ✅ YuChiGong通过FangXuanLing访问队列
- ✅ 功能完全不变，用户无感知
- ✅ 单元测试覆盖率≥90%
- ✅ 零lint错误

### 回滚计划

如果Step 3失败：
1. Revert YuChiGong的修改
2. Restore App.vue的原始代码
3. **Store和持久化功能不受影响**

---

## Step 4: scan-service迁移讨论（天界化扫描引擎）

⚠️ **警告：这是最复杂的一步，需要谨慎评估ROI和风险！**

### 目标

将扫描执行逻辑从Renderer进程迁移到Main进程，实现真正的天界化。

### 技术挑战

1. **IPC开销**：大量进度更新需要跨进程通信
2. **依赖重构**：AppHelper依赖Renderer进程API
3. **状态同步**：Main进程状态如何同步到UI
4. **错误处理**：跨进程错误传递
5. **调试难度**：Main进程调试复杂

### 实施决策点

⏸️ **暂不实施**，等待以下条件：

- ✅ Step 1-3全部完成并稳定运行≥2周
- ✅ 性能profiling证明必要性
- ✅ 技术方案经过充分讨论并达成共识
- ✅ 测试策略完备，包含回滚计划
- ✅ 用户反馈证明需求

### 替代方案

如果Step 4暂不实施，可以考虑：

1. **优化现有orchestrateScan**
2. **引入Web Worker**
3. **按需扫描**

---

## 总体风险评估

### 高风险项

**风险1: Step 1数据迁移**
- **影响**：用户队列丢失
- **缓解**：首次启动自动迁移 + 数据备份
- **回滚**：保留旧Store代码路径

**风险2: Step 2 IPC性能**
- **影响**：频繁持久化影响性能
- **缓解**：防抖机制（1秒）+ 批量写入
- **回滚**：禁用持久化功能

---

## 成功指标

### 功能指标

- ✅ **Step 1**: Store分离，职责清晰
- ✅ **Step 2**: 断电恢复，队列不丢失
- ✅ **Step 3**: UI层纯化，业务逻辑下沉
- ⏸️ **Step 4**: 暂缓，待充分讨论和评估

### 质量指标

- ✅ 每步单元测试覆盖率≥90%
- ✅ 每步集成测试通过
- ✅ 每步零lint错误
- ✅ 每步性能无明显下降（<5%）

---

## 实施时间表

### Phase 1: Step 1实施（4天）
- Week 1: Store创建 + FangXuanLing封装 + 数据迁移 + 测试
- **Milestone**: Store分离完成

### Phase 2: Step 2实施（3.5天）
- Week 2: QianLiYan持久化 + IPC通信 + Renderer集成 + 测试
- **Milestone**: 天界持久化完成

### Phase 3: Step 3实施（4天）
- Week 3: YuChiGong增强 + App.vue简化 + LiShiMing集成 + 测试
- **Milestone**: UI层纯化完成

### Phase 4: Step 4讨论（时间待定）
- Week 4+: 技术方案讨论 + ROI评估 + 决策
- **Milestone**: 实施决策或替代方案确定

**总计**：11.5天（Step 1-3），Step 4待定

---

## 架构修正总结 (2025-10-16)

### 关键修正点

1. **Store访问隔离**
   - ❌ 旧设计：YuChiGong直接访问PreferenceStore
   - ✅ 新设计：YuChiGong通过FangXuanLing访问ScanningQueueStore

2. **优先级调整**
   - ❌ 旧顺序：Step 1 App.vue迁移 → Step 2 Store分离
   - ✅ 新顺序：Step 1 Store分离 → Step 2 QianLiYan持久化 → Step 3 App.vue迁移

3. **持久化优先**
   - ❌ 旧设计：Step 3才考虑持久化
   - ✅ 新设计：Step 2就实现持久化（用户明确要求）

### 架构原则确认

**核心原则**：只有FangXuanLing可以管理Store

**正确的服务通信链路**：
```
Service → FangXuanLing.getXXX() → Store → 数据
                ↓
         FangXuanLing.triggerPersistence() → IPC → QianLiYan → scanning.json
```

---

## 参考资料

- RFC 0038: 偏好设置工作流集成与Store边界统一（已完成）
- RFC 0032: 千里眼扫描引擎
- RFC 0043: useQinQiong()访问模式
- [YuChiGong服务实现](../../src/renderer/src/services/yuchigong/yuchigong.ts)

---

## 变更历史

- 2025-10-16: 初始版本，基于用户四步策略规划
- 2025-10-16: **架构修正** - 基于用户反馈重写Step 1-3，确保遵循"只有FangXuanLing管理Store"原则

---

## 附录A：架构错误分析

### 原始错误设计

```typescript
// ❌ 错误：YuChiGong直接访问Store
export class YuChiGongService {
    private preferenceStore: PreferenceStore;  // ❌ WRONG!

    constructor(
        fangXuanLingService,
        preferenceStore  // ❌ WRONG!
    ) {
        this.preferenceStore = preferenceStore;
    }

    watchScanningQueue() {
        watchArray(
            () => this.preferenceStore.scanningFolder,  // ❌ WRONG!
            // ...
        );
    }
}
```

### 正确设计

```typescript
// ✅ 正确：YuChiGong通过FangXuanLing访问
export class YuChiGongService {
    // ❌ 删除：private preferenceStore

    constructor(
        fangXuanLingService,
        // ❌ 删除：preferenceStore参数
    ) {
        this.fangXuanLingService = fangXuanLingService;
    }

    watchScanningQueue() {
        watchArray(
            () => this.fangXuanLingService.getScanningQueue(),  // ✅ CORRECT!
            // ...
        );
    }
}
```

### 架构原则强调

**永远记住**：
1. 只有FangXuanLing可以访问Store
2. 其他服务通过FangXuanLing提供的方法访问
3. Store是FangXuanLing的内部实现细节
4. 服务不应知道Store的存在

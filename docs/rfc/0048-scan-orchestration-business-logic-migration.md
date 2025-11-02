# RFC 0048: 扫描编排业务逻辑下沉 - 尉迟恭接管App.vue

- **RFC编号**: 0048
- **标题**: 扫描编排业务逻辑下沉 - 尉迟恭接管App.vue
- **作者**: AI Architect (Agent 1)
- **开始日期**: 2025-11-01
- **状态**: 📋 Draft
- **类型**: 架构重构
- **目标版本**: v2.0.0
- **依赖RFC**:
  - RFC 0046: 扫描队列持久化 - 千里眼scanning.json管理（必须完成）
  - RFC 0047: folderTree持久化与初始化 - 司命/千里眼appState管理（必须完成）
  - RFC 0042: scanningFolder四步渐进式迁移（Step 1已完成 - ScanningStore创建）✅

---

## 摘要

本RFC将App.vue中的扫描触发逻辑迁移到尉迟恭（YuChiGongService）服务，实现UI层与业务逻辑分离。通过监听扫描队列变化自动触发扫描，将复杂的扫描编排逻辑从UI组件中剥离到服务层。

**核心原则**：
1. ✅ **UI层纯化** - App.vue只负责UI渲染，不包含业务逻辑
2. ✅ **服务层职责** - 尉迟恭负责扫描编排和状态管理
3. ✅ **通过房玄龄访问Store** - 尉迟恭通过奏折访问ScanningStore
4. ✅ **事件驱动** - 监听队列变化自动触发扫描

---

## 动机

### 当前架构问题

**问题1：UI层包含复杂业务逻辑**
```typescript
// App.vue Line 248-266: watchArray监听scanningFolder变化
watchArray(scanningFolder, () => {
    if (scanPhotosTask.isIdle) {
        startScanning();  // ❌ UI层直接触发扫描
    }
}, { deep: true });

// App.vue Line 344-371: startScanning函数 - 复杂的扫描编排逻辑
async function startScanning(): Promise<void> {
    scanMonitoringService.recordActivity();
    const result = await orchestrateScan(scanningFolder.value, callbacks);
    // ... 复杂的扫描编排逻辑
}
```

**问题2：职责不清晰**
- App.vue既负责UI渲染，又负责扫描编排
- 扫描逻辑与UI耦合，难以测试和维护
- 违反单一职责原则

**问题3：可维护性差**
- 扫描逻辑散落在UI组件中
- 难以复用和扩展
- 测试困难（需要完整UI环境）

### 目标

1. **UI层纯化** - App.vue只负责UI渲染和用户交互
2. **业务逻辑下沉** - 扫描编排逻辑迁移到尉迟恭服务
3. **事件驱动架构** - 监听队列变化自动触发扫描
4. **可测试性** - 服务层可独立测试，无需UI环境
5. **可维护性** - 扫描逻辑集中管理，易于维护和扩展

---

## 详细设计

### 架构概览

#### 当前架构（需要重构）

```
用户点击"添加扫描" → App.vue添加到scanningFolder
                    ↓
            watchArray监听变化
                    ↓
             App.vue.startScanning()
                    ↓
           orchestrateScan执行扫描
```

**问题**：UI层承担业务逻辑责任

---

#### 目标架构（事件驱动）

```
用户点击"添加扫描" → 褚遂良发奏折 → 房玄龄 → 袁天罡 → 天枢 → 千里眼
                                                      ↓
                                            千里眼持久化queue并返回
                                                      ↓
                                       Store Automation同步到ScanningStore
                                                      ↓
                                      尉迟恭监听ScanningStore.queue变化
                                                      ↓
                                         尉迟恭触发扫描编排逻辑
                                                      ↓
                                      orchestrateScan执行扫描（服务层）
```

**优势**：UI层与业务逻辑完全分离，事件驱动，易于测试和维护

---

### 技术实现

#### 1. 尉迟恭扫描编排逻辑

**文件**: `src/renderer/src/services/yuchigong/yuchigong.ts`

```typescript
import { watch } from "vue";
import type { IScanningAccessor } from "@/interfaces/fang-xuan-ling.interface";
import { orchestrateScan } from "@/utils/scan-orchestrator";
import { loggers } from "@/utils/logger";

const logger = loggers.yuchigong;

export class YuChiGongService {
    private scanningAccessor: IScanningAccessor;
    private isScanning: boolean = false;

    constructor(fangXuanLingService: FangXuanLingService) {
        this.fangXuanLingService = fangXuanLingService;
        this.scanningAccessor = fangXuanLingService.scanning;
    }

    /**
     * 启动扫描编排服务
     * 监听扫描队列变化，自动触发扫描
     */
    async startScanOrchestration(): Promise<void> {
        logger.info("🛡️ 尉迟恭：启动扫描编排服务");

        // 监听扫描队列变化
        watch(
            () => this.scanningAccessor.queue,
            async (newQueue) => {
                logger.debug(`🛡️ 尉迟恭：检测到队列变化，当前队列长度 ${newQueue.length}`);

                // 如果有待扫描任务且当前不在扫描中，触发扫描
                if (newQueue.length > 0 && !this.isScanning) {
                    await this.triggerScan();
                }
            },
            { deep: true }
        );

        logger.info("🛡️ 尉迟恭：扫描编排服务已启动");
    }

    /**
     * 触发扫描
     * 从队列中获取任务并执行扫描
     */
    private async triggerScan(): Promise<void> {
        if (this.isScanning) {
            logger.debug("🛡️ 尉迟恭：扫描正在进行中，跳过本次触发");
            return;
        }

        this.isScanning = true;
        logger.info("🛡️ 尉迟恭：开始执行扫描编排");

        try {
            // 获取当前队列（通过Accessor只读访问）
            const queue = this.scanningAccessor.queue;

            if (queue.length === 0) {
                logger.debug("🛡️ 尉迟恭：队列为空，无需扫描");
                return;
            }

            // 准备扫描回调
            const callbacks = {
                onProgress: this.handleScanProgress.bind(this),
                onComplete: this.handleScanComplete.bind(this),
                onError: this.handleScanError.bind(this),
            };

            // 执行扫描编排（使用现有的orchestrateScan逻辑）
            const result = await orchestrateScan(queue, callbacks);

            logger.info(`🛡️ 尉迟恭：扫描完成，处理了 ${result.processedCount} 个任务`);

        } catch (error) {
            logger.error("🛡️ 尉迟恭：扫描编排失败", error);
            this.emitQizou("scan_orchestration_failed", {
                error: (error as Error).message,
            });
        } finally {
            this.isScanning = false;
            logger.debug("🛡️ 尉迟恭：扫描状态已重置");
        }
    }

    /**
     * 处理扫描进度
     */
    private handleScanProgress(progress: ScanProgress): void {
        logger.debug(`🛡️ 尉迟恭：扫描进度 ${progress.current}/${progress.total}`);

        // 启奏汇报扫描进度
        this.emitQizou("scan_progress", {
            current: progress.current,
            total: progress.total,
            path: progress.currentPath,
        });
    }

    /**
     * 处理扫描完成
     */
    private handleScanComplete(result: ScanResult): void {
        logger.info(`🛡️ 尉迟恭：扫描任务完成 ${result.path}`);

        // 发送REMOVE_SCAN_ACTION奏折，从队列移除已完成任务
        const zouzhe: Zouzhe = {
            department: GUANYUAN_NAMES.YU_CHI_GONG,
            matter: ZOUZHE_MATTERS.REMOVE_SCAN_ACTION,
            content: { path: result.path },
            timestamp: Date.now(),
            priority: ZOUZHE_PRIORITIES.NORMAL,
        };

        this.fangXuanLingService.processZouzhe(zouzhe);

        // 启奏汇报任务完成
        this.emitQizou("scan_task_completed", {
            path: result.path,
            filesFound: result.filesFound,
        });
    }

    /**
     * 处理扫描错误
     */
    private handleScanError(error: ScanError): void {
        logger.error(`🛡️ 尉迟恭：扫描失败 ${error.path}`, error);

        // 发送REMOVE_SCAN_ACTION奏折，从队列移除失败任务
        const zouzhe: Zouzhe = {
            department: GUANYUAN_NAMES.YU_CHI_GONG,
            matter: ZOUZHE_MATTERS.REMOVE_SCAN_ACTION,
            content: { path: error.path },
            timestamp: Date.now(),
            priority: ZOUZHE_PRIORITIES.NORMAL,
        };

        this.fangXuanLingService.processZouzhe(zouzhe);

        // 启奏汇报错误
        this.emitQizou("scan_task_error", {
            path: error.path,
            error: error.message,
        });
    }
}
```

#### 2. 接口定义

**文件**: `src/renderer/src/interfaces/yu-chi-gong.interface.ts`

```typescript
export interface IYuChiGongService {
    // ... 现有方法

    /**
     * 启动扫描编排服务
     * 监听扫描队列变化，自动触发扫描
     */
    startScanOrchestration(): Promise<void>;
}

export interface ScanProgress {
    current: number;
    total: number;
    currentPath: string;
}

export interface ScanResult {
    path: string;
    filesFound: number;
    duration: number;
}

export interface ScanError {
    path: string;
    message: string;
}
```

#### 3. 李世民启动时初始化

**文件**: `src/renderer/src/services/lishiming/lishiming.ts`

```typescript
// startZhengguan方法中，在所有初始化完成后启动扫描编排
async startZhengguan(): Promise<void> {
    // ... 其他初始化

    logger.info("👑 尉迟恭大将军服务初始化扫描队列");
    await this.yuChiGongService.initializeScanningQueue();

    logger.info("👑 尉迟恭大将军服务初始化文件夹树");
    await this.yuChiGongService.initializeFolderTree();

    // ✅ 新增：启动扫描编排服务
    logger.info("👑 尉迟恭大将军服务启动扫描编排");
    await this.yuChiGongService.startScanOrchestration();

    logger.info("👑 朝廷开衙，诸司各就其位");
}
```

#### 4. App.vue重构

**文件**: `src/renderer/src/App.vue`

```vue
<script setup lang="ts">
// ❌ 删除：watchArray监听scanningFolder变化
// watchArray(scanningFolder, () => {
//     if (scanPhotosTask.isIdle) {
//         startScanning();
//     }
// }, { deep: true });

// ❌ 删除：startScanning函数
// async function startScanning(): Promise<void> {
//     scanMonitoringService.recordActivity();
//     const result = await orchestrateScan(scanningFolder.value, callbacks);
//     // ... 复杂的扫描编排逻辑
// }

// ✅ UI层只负责监听启奏事件，更新UI状态
import { useLiShiMing } from "@/composables/useLiShiMing";

const { listenQizou } = useLiShiMing();

// 监听扫描进度启奏
listenQizou("scan_progress", (data) => {
    // 更新UI进度条
    scanProgress.value = data.current / data.total * 100;
    currentScanPath.value = data.path;
});

// 监听扫描完成启奏
listenQizou("scan_task_completed", (data) => {
    // 显示成功提示
    showNotification(`扫描完成: ${data.path}, 发现 ${data.filesFound} 个文件`);
});

// 监听扫描错误启奏
listenQizou("scan_task_error", (data) => {
    // 显示错误提示
    showErrorNotification(`扫描失败: ${data.path}, ${data.error}`);
});
</script>
```

---

## 实施计划

### Phase 1: 服务层实现（2天）

- [ ] 在尉迟恭添加`startScanOrchestration()`方法
- [ ] 实现队列监听逻辑
- [ ] 实现`triggerScan()`方法
- [ ] 实现扫描回调处理（onProgress, onComplete, onError）
- [ ] 单元测试：扫描编排逻辑

### Phase 2: 接口定义（0.5天）

- [ ] 更新`IYuChiGongService`接口
- [ ] 定义`ScanProgress`, `ScanResult`, `ScanError`接口
- [ ] 单元测试：接口类型检查

### Phase 3: 启动初始化（0.5天）

- [ ] 李世民`startZhengguan`中调用`startScanOrchestration()`
- [ ] 验证启动流程
- [ ] 单元测试：启动初始化

### Phase 4: App.vue重构（1天）

- [ ] 删除`watchArray`监听代码
- [ ] 删除`startScanning()`函数
- [ ] 添加启奏事件监听
- [ ] 更新UI状态管理
- [ ] 端到端测试：UI交互

### Phase 5: 集成测试（1天）

- [ ] 端到端测试：添加扫描任务流程
- [ ] 端到端测试：扫描自动触发
- [ ] 端到端测试：扫描完成后移除任务
- [ ] 性能测试：连续扫描任务

### Phase 6: 验证与文档（0.5天）

- [ ] 验证所有测试通过
- [ ] 零lint错误
- [ ] 更新API文档
- [ ] 更新用户手册

**总计**: 约5.5天

---

## 验收标准

### 功能性

- ✅ 扫描队列变化自动触发扫描
- ✅ 扫描完成后自动从队列移除
- ✅ 扫描进度实时更新UI
- ✅ 扫描错误正确处理和提示
- ✅ App.vue不包含扫描业务逻辑

### 架构合规

- ✅ 尉迟恭通过房玄龄访问ScanningStore
- ✅ UI层只负责UI渲染，不包含业务逻辑
- ✅ 服务层承担扫描编排责任
- ✅ 事件驱动架构，松耦合

### 代码质量

- ✅ 单元测试覆盖率≥90%
- ✅ 集成测试覆盖关键路径
- ✅ 零lint错误
- ✅ 零TypeScript错误
- ✅ 所有日志符合人界风格规范

### 可维护性

- ✅ 扫描逻辑集中在服务层
- ✅ 易于测试（无需UI环境）
- ✅ 易于扩展（新增扫描策略）
- ✅ 代码清晰，职责单一

---

## 风险评估

### 高风险

1. **扫描逻辑迁移风险**
   - 缓解：逐步迁移，保留原有逻辑作为对比
   - 测试：完整回归测试

2. **UI状态同步**
   - 缓解：使用启奏事件，确保状态一致
   - 监控：UI状态日志

### 中风险

1. **性能影响**
   - 缓解：队列监听使用防抖
   - 监控：性能日志

2. **并发扫描**
   - 缓解：`isScanning`标志防止并发
   - 测试：并发测试

---

## 替代方案

### 方案A：保留App.vue逻辑（已否决）

**优点**：
- 无需迁移
- 风险低

**缺点**：
- UI层包含业务逻辑
- 难以测试和维护
- 违反单一职责原则

### 方案B：创建独立扫描服务（未来可选）

**优点**：
- 职责更清晰
- 可复用

**缺点**：
- 增加复杂度
- 当前不需要

**结论**：当前采用尉迟恭承担扫描编排，未来如需独立可拆分

---

## 未解决问题

1. **扫描优先级策略？**
   - 建议：FIFO，按添加顺序扫描
   - 待确认：是否需要优先级队列

2. **扫描并发数？**
   - 建议：串行扫描，避免资源竞争
   - 待确认：是否支持并发扫描

3. **扫描超时策略？**
   - 建议：单个任务超时10分钟
   - 待确认：超时后如何处理

---

## 参考资料

- RFC 0042: scanningFolder四步渐进式迁移（Step 3设计来源）
- RFC 0046: 扫描队列持久化 - 千里眼scanning.json管理
- RFC 0047: folderTree持久化与初始化
- RFC 0038: 偏好设置工作流集成与Store边界统一
- CLAUDE.md: 双界日志风格规范

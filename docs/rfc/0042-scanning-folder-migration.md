# RFC 0042: scanningFolder四步渐进式迁移

- **RFC编号**: 0042
- **标题**: scanningFolder四步渐进式迁移
- **作者**: AI Architect (Agent 1)
- **开始日期**: 2025-10-16
- **状态**: 🚧 进行中 - Step 1已完成
- **最后更新**: 2025-10-20 (Architect修正文档：更新Line 1046-1098流程图，添加Builder TODO清单，补充测试期望值规范)
- **类型**: 架构重构
- **目标版本**: v2.0.0
- **依赖RFC**:
  - RFC 0038: 偏好设置工作流集成与Store边界统一（已完成）✅
  - RFC 0038 Phase 7: qizou-shengzhi架构（已完成）✅
- **后续RFC**:
  - RFC 0043: useQinQiong()访问模式（appState访问统一）
  - RFC 0044: 移除computeDelta反模式，统一天界业务逻辑
  - RFC 0032 Phase 3: scan-service迁移到千里眼（天界化扫描引擎）
- **相关RFC**:
  - RFC 0032: 千里眼扫描引擎（包含scan-service迁移）

---

## 摘要

本RFC采用四步渐进式策略，将`scanningFolder`从当前混乱架构逐步迁移到清晰的人界天界分工架构。

**核心架构原则** (2025-10-19完全修正):
1. ✅ **使用工作流系统（RFC 0038）** - 所有人界→天界通信通过Zouzhe→YuanTianGang→Tianshu工作流
2. ✅ **使用天枢命令系统（RFC 0035）** - 禁止创建独立的IPC handlers
3. ✅ **遵守Zouzhe系统（RFC 0036-0041）** - FangXuanLing不直接调用IPC
4. ✅ **遵守天界/人界规范（CLAUDE.md）** - "千里眼仙君"，施展XX之术，仙术成功/失败
5. ✅ **保持职责清晰** - 尉迟恭不维护状态，房玄龄统一管理Store
6. ✅ **只有FangXuanLing可以管理Store** - 其他服务不能直接访问Store
7. ✅ **Store先行** - 先创建专用Store，再迁移业务逻辑
8. ✅ **QianLiYan优先** - 持久化是第一要务
9. ✅ **Don't break things** - 不破坏现有功能

**反馈采纳记录** (2025-10-19):
- ✅ 已完全采纳Linus严厉审查报告（附录C）的全部6个致命错误修正
- ✅ 已完全采纳2025-10-19设计反馈（尉迟恭职责澄清）
- ✅ 核心架构原则已添加到Step 2设计（Line 780-795）
- ✅ 正确的架构流程已文档化（Line 804-850）
- ✅ 原始反馈章节已标记为"已采纳"并删除线（保留供历史参考）

**三步路线图**（修正后）：
- **Step 1**: ✅ **已完成** - 房玄龄创建专用ScanningStore（Store分离优先 + Accessor/Builder架构）
  - Phase 1.1: ✅ 创建ScanningStore
  - Phase 1.2: ✅ 实现只读Accessor + Builder模式
  - Phase 1.3: ✅ 注册到Store Registry
  - 测试: 16/16 passed, 100% coverage, zero lint errors
- **Step 2**: 📋 待实施 - 千里眼追踪scanning.json持久化（天界优先）
- **Step 3**: 📋 待实施 - 尉迟恭接管App.vue扫描编排（业务逻辑下沉）

**注**：原Step 4（scan-service迁移到千里眼）因复杂度高，已合并到RFC 0032 Phase 3进行详细设计

---

## Step 1 关键成果

### 🎯 解决的核心问题

**问题**: 每个新Store都要在FangXuanLing添加多个方法，导致类无限膨胀
```typescript
// ❌ 旧方式：每个Store添加8个方法
getScanningQueue()
getScanningQueueSize()
isInScanningQueue()
addToScanningQueue()
removeFromScanningQueue()
clearScanningQueue()
setScanningQueue()
updateScanningProgress()
```

**解决方案**: Accessor + Builder Pattern + Store Registry
```typescript
// ✅ 新方式：每个Store只添加1个getter
get scanning(): IScanningAccessor {
    return this._scanningAccessor;
}

// ✅ 未来扩展：使用Builder模式创建富接口（如Preference）
// createScanningServiceBuilder() 可提供更丰富的服务接口
```

### 📐 架构创新

1. **双模式架构** (Accessor + Builder)
   - **Accessor模式**: 简单只读访问（如`scanning`）
   - **Builder模式**: 富接口创建（如`preference`，参考[service-builders.ts](../src/renderer/src/services/fangxuanling/service-builders.ts)）
   - 根据业务需求灵活选择

2. **只读访问器模式** (Accessor)
   - 外部服务只能通过Accessor读取（`fangXuanLing.scanning.queue`）
   - 所有修改必须通过Zouzhe系统
   - TypeScript编译时强制只读约束

3. **Store Registry双轨制**
   - **读取路径**: Accessor/Builder → Store (只读)
   - **修改路径**: Zouzhe → `getStoreByPath()` → Store (可写)
   - 完美分离关注点

4. **可扩展性**
   - 添加新Store只需2-3步：注册 + 创建Accessor/Builder
   - FangXuanLing核心代码零修改
   - 符合开闭原则

### 📁 交付物

- ✅ [scanning-accessor.ts](../src/renderer/src/services/fangxuanling/accessors/scanning-accessor.ts) - 只读访问器实现
- ✅ [scanning-accessor.test.ts](../src/renderer/src/services/fangxuanling/__tests__/scanning-accessor.test.ts) - 完整测试覆盖
- ✅ [store-registry.ts](../src/renderer/src/services/fangxuanling/store-automation/store-registry.ts) - ScanningStore注册
- ✅ [fangxuanling.ts](../src/renderer/src/services/fangxuanling/fangxuanling.ts) - Accessor集成

### ✅ 验证指标 (Validator Agent验证完成 - 2025-10-16)

```
Tests:    16/16 passed (11 initial + 5 null store edge cases)
Coverage: 100% (Statements, Branches, Functions, Lines)
Lint:     Zero errors (source + test)
Design:   符合Accessor架构原则（只读外部访问）
Pattern:  可扩展至Builder模式（参考service-builders.ts）
```

**Validator验证清单**:
- ✅ Accessor实现完整性验证 ([scanning-accessor.ts](../src/renderer/src/services/fangxuanling/accessors/scanning-accessor.ts))
- ✅ 所有null store边界情况测试覆盖
- ✅ 架构一致性：符合现有Builder模式参考 ([service-builders.ts](../src/renderer/src/services/fangxuanling/service-builders.ts))
- ✅ RFC文档准确性：反映Architect设计和Builder实现
- ❌ **YuChiGong架构违规发现** (2025-10-19) - 需Builder清理

### ❌ YuChiGong架构违规 (Validator发现 - 2025-10-19)

**问题**: [yuchigong.ts](../src/renderer/src/services/yuchigong/yuchigong.ts) 维护了本地状态 `private scanningTasks = new Set<string>()`，违反RFC 0042的**Single Source of Truth**原则。

**违规详情**:
```typescript
// ❌ Line 57: 维护本地状态副本
private scanningTasks = new Set<string>();

// ❌ Line 188: 使用本地Set做去重检查（应使用FangXuanLing.scanning.isInQueue）
if (this.scanningTasks.has(path)) { ... }

// ❌ Line 223, 316: 手动同步Set状态（应由ScanningStore自动管理）
this.scanningTasks.add(path);
this.scanningTasks.delete(path);

// ❌ Line 412-431: 公开API从本地Set读取（应委托给FangXuanLing.scanning）
getScanningTasks(): string[] { return Array.from(this.scanningTasks); }
```

**架构问题**:
1. **违反SSOT原则**: ScanningStore是唯一数据源，YuChiGong不应维护副本
2. **数据不一致风险**: Set与Store可能不同步（例如奏折批准失败但Set已更新）
3. **未使用Accessor**: 已有`fangXuanLing.scanning.isInQueue(path)`但未使用

**Builder清理任务** (待执行):

**代码清理**:
- [ ] 删除 `private scanningTasks = new Set<string>()`
- [ ] 去重检查改用 `fangXuanLing.scanning.isInQueue(path)`
- [ ] 删除所有 `scanningTasks.add/delete` 操作
- [ ] 公开API改为委托: `fangXuanLing.scanning.queue.map(a => a.path)`
- [ ] 简化 `initializeScanningQueue()` 和 `cleanup()`
- [ ] 更新YuChiGong类文档注释

**测试更新** (详见下文"测试更新方案"):
- [ ] 更新MockFangXuanLingService实现scanning accessor
- [ ] Mock在processZouzhe中模拟Store更新
- [ ] 新增去重检查测试（验证通过Accessor）
- [ ] 运行测试确保100%通过，零lint错误

**正确的访问模式**:
```typescript
// ✅ 正确：通过FangXuanLing.scanning访问
export class YuChiGongService {
    // ❌ 删除：private scanningTasks = new Set<string>()

    private async handleAddScanTask(shengzhi: Shengzhi): Promise<void> {
        const path = shengzhi.content.path;

        // ✅ 使用Accessor去重
        if (this.fangXuanLingService.scanning.isInQueue(path)) {
            logger.warn(`🏛️ 尉迟恭：此路已在案中，恕不重录 ${path}`);
            return;
        }

        // ... 发送ADD_SCAN_ACTION奏折
    }

    // ✅ 委托给Accessor
    getQueueSize(): number {
        return this.fangXuanLingService.scanning.queueSize;
    }
}
```

**验收标准**:
- [ ] YuChiGong无本地状态副本
- [ ] 所有队列访问通过FangXuanLing.scanning
- [ ] 测试100%通过
- [ ] 零lint错误
- [ ] 符合RFC 0042 Step 1架构原则

#### 测试更新方案

**文件**: [yuchigong.test.ts](../src/renderer/src/services/yuchigong/__tests__/yuchigong.test.ts)

**问题**: 当前测试依赖YuChiGong的本地 `scanningTasks` Set。清理后需要Mock FangXuanLing的 `scanning` accessor。

**Step 1: 增强MockFangXuanLingService**

在MockFangXuanLingService中添加：

```typescript
class MockFangXuanLingService implements IFangXuanLingService {
    public receivedZouzhes: Zouzhe[] = [];
    public shouldThrowError = false;

    // ✅ 新增：模拟ScanningStore状态
    private mockScanningQueue: ScanAction[] = [];

    // ✅ 新增：实现scanning accessor
    get scanning(): IScanningAccessor {
        return {
            get queue(): ScanAction[] {
                return [...this.mockScanningQueue];
            },
            get queueSize(): number {
                return this.mockScanningQueue.length;
            },
            get isProcessing(): boolean {
                return false;
            },
            get currentPath(): string | null {
                return this.mockScanningQueue[0]?.path || null;
            },
            get nextScanAction(): ScanAction | null {
                return this.mockScanningQueue[0] || null;
            },
            isInQueue: (path: string): boolean => {
                return this.mockScanningQueue.some(action => action.path === path);
            }
        };
    }

    async processZouzhe(zouzhe: Zouzhe): Promise<ZouzheResponse> {
        if (this.shouldThrowError) {
            throw new Error("房玄龄处理奏折失败");
        }
        this.receivedZouzhes.push(zouzhe);

        // ✅ 新增：模拟Store更新
        if (zouzhe.matter === ZOUZHE_MATTERS.ADD_SCAN_ACTION) {
            const action = zouzhe.content.action as ScanAction;
            if (!this.mockScanningQueue.some(a => a.path === action.path)) {
                this.mockScanningQueue.push(action);
            }
        } else if (zouzhe.matter === ZOUZHE_MATTERS.REMOVE_SCAN_ACTION) {
            const path = zouzhe.content.path as string;
            this.mockScanningQueue = this.mockScanningQueue.filter(a => a.path !== path);
        }

        return {
            approved: true,
            matter: zouzhe.matter,
            data: null,
            instruction: "已批准",
            timestamp: Date.now(),
        };
    }

    reset(): void {
        this.receivedZouzhes = [];
        this.shouldThrowError = false;
        this.mockScanningQueue = []; // ✅ 清空mock队列
    }
}
```

**Step 2: 添加必要的import**

```typescript
import type { IScanningAccessor } from "@renderer/interfaces/fang-xuan-ling.interface";
import type { ScanAction } from "@common/scan-types";
```

**Step 3: 新增去重测试**

在测试文件末尾添加新的describe块：

```typescript
describe("去重检查测试（通过FangXuanLing.scanning）", () => {
    it("应该通过FangXuanLing.scanning检查重复任务", () => {
        const testPath = "/test/duplicate";

        // 第一次添加
        const shengzhi1: Shengzhi = {
            id: "dup-001",
            command: "add_scan_task",
            content: { path: testPath },
            priority: "normal",
            from: "李世民",
            timestamp: Date.now(),
        };
        messageChannel.port1.postMessage(shengzhi1);

        return new Promise<void>((resolve) => {
            setTimeout(() => {
                expect(yuchiGong.isScanning(testPath)).toBe(true);

                // 重置启奏记录
                emittedQizous.length = 0;

                // 第二次添加相同路径
                const shengzhi2: Shengzhi = {
                    id: "dup-002",
                    command: "add_scan_task",
                    content: { path: testPath },
                    priority: "normal",
                    from: "李世民",
                    timestamp: Date.now(),
                };
                messageChannel.port1.postMessage(shengzhi2);

                setTimeout(() => {
                    // ✅ 验证：第二次添加被拒绝（通过Accessor检查）
                    const duplicateQizou = emittedQizous.find(q => q.matter === "scan_task_duplicate");
                    expect(duplicateQizou).toBeDefined();
                    expect(duplicateQizou?.content.path).toBe(testPath);

                    // ✅ 验证：队列中只有一个任务
                    expect(yuchiGong.getQueueSize()).toBe(1);

                    resolve();
                }, 50);
            }, 50);
        });
    });
});
```

**Step 4: 验证现有测试无需修改**

现有测试断言**不需要修改**，因为：
- YuChiGong公开API签名不变（`getScanningTasks()`, `getQueueSize()`, `isScanning()`）
- API内部从读取Set改为委托Accessor，但行为一致
- Mock提供正确的Accessor实现，测试仍然有效

**测试验收标准**:
- [ ] MockFangXuanLingService实现scanning accessor
- [ ] Mock正确模拟ADD_SCAN_ACTION/REMOVE_SCAN_ACTION
- [ ] 新增去重测试通过
- [ ] 所有现有测试100%通过（无需修改断言）
- [ ] 测试覆盖率保持100%
- [ ] 零lint错误

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

## Step 1: 房玄龄创建ScanningStore（Store先行）

**状态**: ✅ 已完成 (2025-10-16)

### 实施概览

**Phase 1.1**: ✅ 创建ScanningStore - 完成
**Phase 1.2**: ✅ 实现Accessor + Builder架构 - 完成
- [scanning-accessor.ts](../src/renderer/src/services/fangxuanling/accessors/scanning-accessor.ts) - Accessor模式实现
- [service-builders.ts](../src/renderer/src/services/fangxuanling/service-builders.ts) - Builder模式参考
- [scanning-accessor.test.ts](../src/renderer/src/services/fangxuanling/__tests__/scanning-accessor.test.ts)
- 测试结果: 16/16 passed, 100% coverage, zero lint errors

**Phase 1.3**: ✅ 注册到Store Registry - 完成
- [store-registry.ts](../src/renderer/src/services/fangxuanling/store-automation/store-registry.ts)

### 目标

**优先级1**: 将scanningFolder从PreferenceStore.appState中分离出来，创建专用的ScanningStore。

**核心原则**:
- ✅ **只有FangXuanLing可以管理Store**
- ✅ Store分离必须先行，后续服务才能正确访问
- ✅ 运行时扫描状态不应混在preference中
- ✅ **只读访问器** - 外部服务只读，修改通过Zouzhe
- ✅ **可扩展架构** - 新Store无需修改FangXuanLing核心

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

#### 1.1 FangXuanLing创建ScanningStore

```typescript
// src/renderer/src/services/fangxuanling/scanning-store.ts

import { defineStore } from "pinia";
import type { ScanAction } from "@common/scan-types";
import { loggers } from "@common/logger";

const logger = loggers.app;

/**
 * 扫描State接口
 *
 * ⚠️ 注意：此Store不持久化（persist: false）
 * 运行时扫描状态，持久化由天界（千里眼）管理
 */
export interface ScanningState {
    /** 扫描队列 */
    queue: ScanAction[];

    /** 是否正在处理 */
    isProcessing: boolean;

    /** 当前正在扫描的路径 */
    currentPath: string | null;
}

/**
 * 扫描Store
 *
 * 职责：
 * - 管理扫描队列和扫描状态
 * - 提供队列增删改查接口
 * - 管理扫描进度和状态
 * - 不负责持久化（由千里眼管理scanning.json）
 *
 * 访问方式：
 * - ❌ 服务不能直接访问此Store
 * - ✅ 必须通过FangXuanLing提供的服务方法访问
 */
export const useScanningStore = defineStore("scanning", {
    state: (): ScanningState => ({
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
            logger.debug(`📋 卷宗库：新卷入册 ${action.path}`);
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
                logger.debug(`📋 卷宗库：卷宗销档 ${path}`);
                this.queue.splice(index, 1);
            }
        },

        /**
         * 清空队列
         */
        clearQueue(): void {
            logger.info("📋 卷宗库：清理库房，所有卷宗封存");
            this.queue = [];
            this.isProcessing = false;
            this.currentPath = null;
        },

        /**
         * 批量设置队列（用于从天界恢复）
         */
        setQueue(queue: ScanAction[]): void {
            logger.info(`📋 卷宗库：从天界恢复卷宗，共${queue.length}份待审`);
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
 * ScanningStore类型导出
 */
export type ScanningStore = ReturnType<typeof useScanningStore>;
```

#### 1.2 FangXuanLing提供只读访问（Accessor + Builder双模式架构）

**架构原则**：
- ✅ **Accessor模式**：简单只读访问（如`scanning`）
- ✅ **Builder模式**：富接口创建（如`preference`，可提供更多便捷方法）
- ✅ **只读约束**：外部服务只能读取，不能修改
- ✅ **Zouzhe修改**：所有修改通过Zouzhe系统，由FangXuanLing内部处理
- ✅ **可扩展性**：根据业务需求选择Accessor或Builder模式

##### 1.2.1 创建ScanningAccessor（Accessor模式 - 简单只读访问）

```typescript
// src/renderer/src/services/fangxuanling/accessors/scanning-accessor.ts

import { loggers } from "@common/logger";
import type { ScanningStore } from "@renderer/stores/scanning";
import type { ScanAction } from "@common/scan-types";

const logger = loggers.app;

/**
 * ⚠️ 重要设计原则：FangXuanLing只提供只读访问
 * 所有修改操作必须通过Zouzhe（奏折）系统，由其他服务（如YuChiGong）提交
 */
export interface IScanningAccessor {
    readonly queue: ScanAction[];
    readonly queueSize: number;
    readonly isProcessing: boolean;
    readonly currentPath: string | null;
    readonly nextScanAction: ScanAction | null;
    isInQueue(path: string): boolean;
}

export class ScanningAccessor implements IScanningAccessor {
    constructor(private readonly store: ScanningStore | null) {}

    get queue(): ScanAction[] {
        if (!this.store) {
            logger.error("🏛️ 房玄龄：典籍库未开放，无法查阅扫描卷宗");
            return [];
        }
        return [...this.store.queue]; // 返回副本，防止外部修改
    }

    get queueSize(): number {
        if (!this.store) return 0;
        return this.store.queueSize;
    }

    get isProcessing(): boolean {
        if (!this.store) return false;
        return this.store.isProcessing;
    }

    get currentPath(): string | null {
        if (!this.store) return null;
        return this.store.currentPath;
    }

    get nextScanAction(): ScanAction | null {
        if (!this.store) return null;
        return this.store.nextScanAction;
    }

    isInQueue(path: string): boolean {
        if (!this.store) return false;
        return this.store.isInQueue(path);
    }
}
```

##### 1.2.2 FangXuanLing集成Accessor

```typescript
// src/renderer/src/services/fangxuanling/fangxuanling.ts

import { useScanningStore } from "@renderer/stores/scanning";
import { ScanningAccessor, type IScanningAccessor } from "./accessors/scanning-accessor";

export class FangXuanLingService {
    private _scanningAccessor: IScanningAccessor;

    constructor() {
        // 初始化ScanningStore访问器
        const scanningStore = useScanningStore();
        this._scanningAccessor = new ScanningAccessor(scanningStore);
        logger.info("🏛️ 房玄龄：卷宗库已开张，可供查阅");
    }

    /**
     * 扫描队列访问器（只读）
     * ✅ RFC 0042 Step 1: 通过访问器模式访问ScanningStore
     */
    get scanning(): IScanningAccessor {
        return this._scanningAccessor;
    }
}
```

##### 1.2.3 注册ScanningStore到Store Registry

```typescript
// src/renderer/src/services/fangxuanling/store-automation/store-registry.ts

import { useScanningStore } from "@renderer/stores/scanning";

const STORE_REGISTRY: StoreRegistry = {
    preferences: usePreferenceStore,
    notification: useNotificationStore,
    photos: usePhotosStore,
    scanning: useScanningStore, // ✅ RFC 0042: ScanningStore注册
};
```

**关键设计**：
- ✅ **读取**：`fangXuanLing.scanning.queue`（只读访问器）
- ✅ **修改**：通过Zouzhe → `getStoreByPath("scanning")` → Store直接更新
- ✅ **可扩展**：新Store只需注册，无需修改FangXuanLing核心代码

##### 1.2.4 使用示例

```typescript
// ❌ 错误：尝试直接修改（TypeScript会阻止）
fangXuanLing.scanning.addToQueue(action); // 不存在此方法！

// ✅ 正确：读取队列状态
const queueSize = fangXuanLing.scanning.queueSize;
const isInQueue = fangXuanLing.scanning.isInQueue("/path");

// ✅ 正确：通过Zouzhe修改
const zouzhe: Zouzhe = {
    department: "YuChiGong",
    matter: "ADD_SCAN_TASK",
    content: { action: {...} },
    timestamp: Date.now(),
    priority: ZOUZHE_PRIORITIES.NORMAL
};
await fangXuanLing.processZouzhe(zouzhe);

// FangXuanLing内部处理：
// 1. const store = getStoreByPath("scanning")  ← 获取ScanningStore
// 2. syncStoreWithSnapshot(...)                 ← 更新Store
```

##### 1.2.5 测试覆盖

```typescript
// src/renderer/src/services/fangxuanling/__tests__/scanning-accessor.test.ts

describe("FangXuanLing 扫描队列访问器（只读模式）", () => {
    it("应该返回队列副本（防止外部修改）", () => {
        const action = { path: "/test", action: "scan" };

        // 通过Store添加（模拟Zouzhe修改）
        scanningStore.addToQueue(action);

        // 通过accessor读取
        const queue = fangXuanLing.scanning.queue;

        // 验证返回副本
        queue.push({ path: "/test2", action: "scan" });
        expect(fangXuanLing.scanning.queue).toHaveLength(1); // 原队列未变
    });

    it("accessor应该只提供只读访问，无修改方法", () => {
        const accessor = fangXuanLing.scanning;

        // 验证没有修改方法
        expect(accessor).not.toHaveProperty("addToQueue");
        expect(accessor).not.toHaveProperty("removeFromQueue");
        expect(accessor).not.toHaveProperty("clearQueue");
        expect(accessor).not.toHaveProperty("setQueue");
    });
});
```

**测试结果** (Validator Agent验证):
- ✅ 16/16 tests passed (11 initial + 5 null store edge cases)
- ✅ 100% code coverage (scanning-accessor.ts: 100% Stmts | 100% Branch | 100% Funcs | 100% Lines)
- ✅ Zero lint errors (source + test files)
- ✅ Architecture compliance: Accessor pattern implemented correctly

---

### ✅ Step 1 完成总结 (2025-10-16)

#### 实施清单

| 阶段 | 交付物 | 状态 | 验证 (Validator Agent) |
|------|--------|------|------|
| **Phase 1.1** | ScanningStore创建 | ✅ 完成 | 文件存在，零lint错误 |
| **Phase 1.2** | Accessor + Builder架构 | ✅ 完成 | 16/16测试通过，100%覆盖率 |
| **Phase 1.3** | Store Registry注册 | ✅ 完成 | 已注册，Zouzhe路径可用 |
| **Phase 1.4** | FangXuanLing集成 | ✅ 完成 | `get scanning()`已暴露 |
| **Phase 1.5** | RFC文档更新 | ✅ 完成 | 反映Architect/Builder实现 |

#### 架构验证

**✅ 只读访问原则**
```typescript
// ✅ 外部服务只能读取
const queue = fangXuanLing.scanning.queue;  // 返回副本
const size = fangXuanLing.scanning.queueSize;
const inQueue = fangXuanLing.scanning.isInQueue("/path");

// ❌ TypeScript阻止修改
fangXuanLing.scanning.addToQueue(action);  // 编译错误：方法不存在
```

**✅ Zouzhe修改路径**
```typescript
// ✅ 修改通过Zouzhe系统
await fangXuanLing.processZouzhe({
    department: "YuChiGong",
    matter: "ADD_SCAN_TASK",
    content: { action: {...} }
});

// 内部流程：
// 1. getStoreByPath("scanning") → useScanningStore()
// 2. syncStoreWithSnapshot() → store.addToQueue()
```

**✅ 可扩展性验证**
- 添加新Store只需2步：注册 + 创建Accessor
- FangXuanLing核心代码无需修改
- 符合开闭原则

#### 文件清单

| 文件 | 路径 | 说明 |
|------|------|------|
| ScanningStore | `src/renderer/src/stores/scanning.ts` | Pinia store，persist=false |
| ScanningAccessor | `src/renderer/src/services/fangxuanling/accessors/scanning-accessor.ts` | 只读访问器（Accessor模式） |
| Builder参考 | `src/renderer/src/services/fangxuanling/service-builders.ts` | Builder模式参考实现 |
| Accessor Tests | `src/renderer/src/services/fangxuanling/__tests__/scanning-accessor.test.ts` | 16个测试用例（100%覆盖） |
| Store Registry | `src/renderer/src/services/fangxuanling/store-automation/store-registry.ts` | 已注册scanning |
| FangXuanLing | `src/renderer/src/services/fangxuanling/fangxuanling.ts` | 集成Accessor |

#### 质量指标 (Validator Agent验证)

```
测试通过率:    16/16 (100%) - 包含所有null store边界情况
代码覆盖率:    100% (Statements, Branches, Functions, Lines)
Lint错误:     0个 (源码 + 测试)
架构合规性:    符合只读访问原则
可扩展性:     通过 (Accessor + Builder双模式架构)
文档准确性:    RFC准确反映Architect设计和Builder实现
```

#### 下一步行动

**Step 2准备**: 千里眼追踪scanning.json持久化
- 需要在Main进程创建持久化机制
- 从localStorage迁移到文件系统
- 实现启动时恢复队列

**遗留任务**: PreferenceStore清理（Section 1.3）
- 当前未实施（保持向后兼容）
- 待Step 2完成后再清理
- 确保零破坏性

---

#### 1.3 PreferenceStore清理（移除scanningFolder）

**状态**: 📋 待实施（保持向后兼容）

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
// 这些功能现在通过FangXuanLing访问ScanningStore
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
            logger.info("🏛️ 李世民：旧档已空，无需迁卷");
            return;
        }

        logger.info(`🏛️ 李世民：着手迁移旧档卷宗，共计${existingScanningFolder.length}卷`);

        // 通过FangXuanLing迁移到新Store
        this.fangXuanLingService.setScanningQueue(existingScanningFolder);

        // 清空旧Store中的数据
        delete (preferenceStore.$state as any).appState.scanningFolder;

        logger.info("🏛️ 李世民：卷宗迁移圆满，旧档已封");
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

#### Phase 1.1: ScanningStore创建（1天）
- [ ] 创建scanning-store.ts
- [ ] 实现所有state、getters、actions
- [ ] 单元测试：ScanningStore基础功能

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

- ✅ ScanningStore独立运行
- ✅ FangXuanLing提供完整服务方法
- ✅ PreferenceStore不再包含scanningFolder
- ✅ 数据迁移自动完成
- ✅ 现有代码暂时仍可工作（通过FangXuanLing访问）
- ✅ 单元测试覆盖率≥90%
- ✅ 零lint错误

### 回滚计划

如果Step 1失败：
1. Revert ScanningStore相关代码
2. Restore PreferenceStore.scanningFolder
3. Revert FangXuanLing的新方法
4. **数据迁移可回滚**：旧Store仍保留数据

---

## Step 2: 扫描队列持久化（天界工作流）

**状态**: 📋 待实施

### 目标

**优先级1**: 实现断电恢复能力，天界（千里眼）管理扫描队列持久化，人界（ScanningStore）管理UI状态。

**关键架构**（RFC 0032已更新）：
- ✅ **千里眼（QianliyanEngine）** - 负责扫描执行 + 扫描队列持久化
- ✅ **持久化路径**：`~/.photasa/scan/scanning.json`（遵循子目录模式）
- ✅ **司命（SimingEngine）** - 负责通用 appState 持久化（不负责扫描队列）

### 核心架构原则（采纳Linus critical反馈）

**Linus强制要求 - 绝不违反**：
1. ✅ **使用工作流系统（RFC 0038）** - 所有人界→天界通信通过Zouzhe→YuanTianGang→Tianshu工作流
2. ✅ **使用天枢命令系统（RFC 0035）** - 禁止创建独立的IPC handlers
3. ✅ **遵守Zouzhe系统（RFC 0036-0041）** - FangXuanLing不直接调用IPC
4. ✅ **遵守天界/人界规范（CLAUDE.md）** - "千里眼仙君"，施展XX之术，仙术成功/失败
5. ✅ **保持职责清晰** - 尉迟恭不维护状态，房玄龄统一管理Store

**具体实施**：
- ❌ **禁止**：直接IPC调用（`window.api.qianliyan.*`）
- ❌ **禁止**：FangXuanLing直接调用IPC
- ❌ **禁止**：尉迟恭维护队列状态
- ✅ **必须**：通过Zouzhe奏折系统
- ✅ **必须**：通过YuanTianGang发送诏令
- ✅ **必须**：通过Tianshu工作流执行

### 当前架构问题

- ✅ 当前通过PreferenceStore持久化到localStorage（有持久化）
- ❌ localStorage不可靠（浏览器可能清空、配额限制、用户清理缓存）
- ❌ 运行时队列和preference概念混淆
- ❌ 应该由千里眼引擎管理扫描队列持久化（RFC 0032架构）

### 正确的架构流程（完全遵守Linus要求）

```
【人界 Renderer】
1. 尉迟恭（YuChiGong）接收add_scan_task圣旨
   ↓
2. 尉迟恭创建单个ScanAction对象（不维护队列状态！）
   ↓
3. 尉迟恭发ADD_SCAN_ACTION奏折给房玄龄
   content: { action: ScanAction }  // ← 单个action对象
   ↓
4. 房玄龄（FangXuanLing）接收奏折 → processZouzhe()
   ↓
5. 房玄龄创建诏令（Zhaoling）给袁天罡：add_scan_action  // ✅ 直接转发
   context: { action: ScanAction }  // ← 只包含单个action
   ↓
6. 袁天罡（YuanTianGang）转换诏令为符箓（Fulu）
   ↓
7. 袁天罡转换符箓为UICommand
   ↓
8. 袁天罡调用window.tianshu.processCommand()
   ↓
【天界 Main】
9. TianshuService接收命令（ipcMain.handle("tianshu.command")）
   ↓
10. TianshuEngine.processCommand()
   ↓
11. selectWorkflow() → "scan/add_scan_action.yml"  // ✅ 正确的工作流
   ↓
12. WorkflowOrchestrator执行add_scan_action.yml工作流
   ↓
   Step 1: restore_queue
   ├─ 千里眼.restoreQueue()
   └─ 从~/.photasa/scan/scanning.json恢复队列
      result.queue = [action1, action2, ...]
   ↓
   Step 2: append_action
   ├─ 千里眼将新action追加到队列
   └─ queue.push(新action)
   ↓
   Step 3: persist_queue
   ├─ 千里眼.persistQueue(queue)
   └─ 保存完整队列到~/.photasa/scan/scanning.json
   ↓
   Step 4: return_snapshot
   └─ 返回完整队列快照 { queue: [...] }
   ↓
【回到人界】
13. 房玄龄Store Automation（matter-sync.yml）
    ├─ 匹配add_scan_action配置
    ├─ 提取snapshotPath: "queue"
    ├─ syncStrategy: "replace"
    └─ 自动同步快照到ScanningStore
   ↓
14. ScanningStore.queue更新 → Vue响应式 → UI自动刷新
```

**关键差异**：
- ✅ 尉迟恭只发送单个action，不发送完整队列
- ✅ 房玄龄负责队列状态管理，提供完整队列
- ✅ 完全通过工作流系统，无直接IPC
- ✅ 路径使用子目录模式：`scan/scanning.json`

### 实施设计

#### 2.1 千里眼扫描队列持久化能力实现

**参考**：RFC 0032已更新 - 千里眼负责扫描执行 + 扫描队列持久化

**职责**（RFC 0032）：
1. **队列管理**：千里眼在 `~/.photasa/scanning.json` 中持久化扫描队列
2. **状态恢复**：应用重启或崩溃后，千里眼会从 `scanning.json` 恢复未完成任务
3. **队列操作**：天枢通过太乙调度千里眼，对队列进行入队、出队操作
4. **事件回流**：千里眼执行中的进度、错误、发现事件通过太乙汇聚后再交给天枢

```typescript
// src/engines/qianliyan/core/QianliyanEngine.ts

import { writeFile, readFile, mkdir } from "fs/promises";
import { join } from "path";
import type { ScanTask } from "@common/scan-types";
import type { ScanningQueueData } from "@common/types";
import { loggers } from "@common/logger";

const logger = loggers.qianliyan;

export class QianliyanEngine {
    private queuePath: string;

    constructor(config: QianliyanEngineConfig) {
        super();
        // ✅ 千里眼扫描队列存储路径：~/.photasa/scanning.json
        this.queuePath = join(config.appDataPath, "scanning.json");
    }

    async initialize(): Promise<void> {
        // 确保父目录存在
        await mkdir(dirname(this.queuePath), { recursive: true });
        logger.info("🌌 千里眼仙君归位，掌管扫描执行与队列管理");
    }

    /**
     * 千里眼：持久化扫描队列
     *
     * 职责：千里眼负责扫描队列的持久化
     * 路径：~/.photasa/scanning.json
     *
     * ✅ RFC 0032已更新: 千里眼负责扫描执行 + 扫描队列持久化
     * ✅ RFC 0042 Step 2: 队列持久化由千里眼管理
     */
    async persistScanningQueue(queue: ScanTask[]): Promise<void> {
        try {
            logger.info(`🌌 千里眼仙君施展persist_queue之术，封存${queue.length}卷`);

            const queueData: ScanningQueueData = {
                version: "1.0",
                timestamp: Date.now(),
                queue: queue,
            };

            await writeFile(
                this.queuePath,
                JSON.stringify(queueData, null, 2),
                "utf-8"
            );

            logger.info("🌌 仙术成功：队列已封存");
        } catch (error) {
            logger.error("🌌 仙术失败：持久化队列异常", error);
            throw error;
        }
    }

    /**
     * 千里眼：恢复扫描队列
     *
     * ✅ RFC 0032已更新: 千里眼会恢复未完成任务并通知天枢
     */
    async restoreScanningQueue(): Promise<ScanTask[]> {
        try {
            logger.debug("🌌 千里眼仙君施展restore_queue之术");

            const data = await readFile(this.queuePath, "utf-8");
            const parsed: ScanningQueueData = JSON.parse(data);

            if (!parsed.queue || !Array.isArray(parsed.queue)) {
                logger.warn("🌌 符文损坏，队列格式无效");
                return [];
            }

            logger.info(`🌌 仙术成功：恢复${parsed.queue.length}卷待办`);
            return parsed.queue;
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code === "ENOENT") {
                logger.debug("🌌 仙界无留存，队列空白");
                return [];
            }
            logger.error("🌌 仙术失败：恢复队列异常", error);
            return [];
        }
    }

    /**
     * 千里眼：清空队列
     */
    async clearScanningQueue(): Promise<void> {
        try {
            logger.info("🌌 千里眼仙君施展clear_queue之术");

            await writeFile(
                this.queuePath,
                JSON.stringify({
                    version: "1.0",
                    timestamp: Date.now(),
                    queue: [],
                }, null, 2),
                "utf-8"
            );

            logger.info("🌌 仙术成功：队列已清空");
        } catch (error) {
            logger.error("🌌 仙术失败：清空队列异常", error);
            throw error;
        }
    }
}
```

**关键类型定义**：
```typescript
// @common/scan-types.ts

export interface ScanTask {
    path: string;
    action: "scan" | "rescan" | "current";
    source: "user" | "auto";
    addedAt: number;
}

export interface ScanningQueueData {
    version: string;
    timestamp: number;
    queue: ScanTask[];
}
```

#### 2.2 添加天枢工作流YAML

**创建工作流文件**：
- ~~`src/engines/tianshu/workflows/scan/update_scanning_queue.yml`~~ ❌ 已废弃（2025-10-20）- 改用 `add_scan_action.yml` 和 `remove_scan_action.yml`
- `src/engines/tianshu/workflows/scan/get_scanning_queue.yml` ✅
- `src/engines/tianshu/workflows/scan/add_scan_action.yml` ✅ RFC 0042 Phase 2.4
- `src/engines/tianshu/workflows/scan/remove_scan_action.yml` ✅ RFC 0042 Phase 2.4

**工作流设计参考**：`workflows/preference/update_preferences.yml`

#### 2.3 更新天枢intent映射

**文件**：`src/engines/tianshu/core/TianshuEngine.ts`

```typescript
const intentToWorkflowMap: Record<UserIntent, string> = {
    // ... 现有映射
    get_scanning_queue: "scan/get_scanning_queue",
    // ~~update_scanning_queue: "scan/update_scanning_queue",~~ ❌ 已删除（2025-10-20）
    add_scan_action: "scan/add_scan_action",       // ✅ RFC 0042 Phase 2.4
    remove_scan_action: "scan/remove_scan_action", // ✅ RFC 0042 Phase 2.4
};
```

#### 2.4 尉迟恭发奏折（业务逻辑层）

**职责**：接收圣旨，处理业务逻辑，发送奏折通知房玄龄

```typescript
// src/renderer/src/services/yuchigong/yuchigong.ts
// ✅ RFC 0042 Phase 2.4: 正确实现示例

private async handleAddScanTask(shengzhi: Shengzhi): Promise<void> {
    const path = shengzhi.content.path;

    // 1. ✅ 使用Accessor去重检查，不维护本地状态
    if (this.fangXuanLingService.scanning.isInQueue(path)) {
        logger.warn(`🏛️ 尉迟恭：此路已在案中，恕不重录 ${path}`);
        return;
    }

    // 2. 创建ScanAction对象
    const scanAction: ScanAction = {
        path,
        action: shengzhi.content.action || "scan",
        source: shengzhi.content.source || "user",
        addedAt: Date.now(),
    };

    // 3. ✅ 发送ADD_SCAN_ACTION奏折给房玄龄
    const zouzhe: Zouzhe = {
        department: GUANYUAN_NAMES.YU_CHI_GONG,
        matter: ZOUZHE_MATTERS.ADD_SCAN_ACTION,
        content: { action: scanAction },
        timestamp: Date.now(),
        priority: ZOUZHE_PRIORITIES.NORMAL,
    };

    const response = await this.fangXuanLingService.processZouzhe(zouzhe);

    // 4. ✅ 启奏汇报任务已添加（response.data.persisted来自天界）
    this.emitQizou("scan_task_added", {
        shengzhiId: shengzhi.id,
        path,
        persisted: response.data?.persisted,
    });
}
```

#### 2.5 房玄龄处理奏折并发诏令（通过Store Automation）

**职责**：接收奏折 → 发诏令给袁天罡 → 天界返回快照 → Store Automation自动同步

```typescript
// src/renderer/src/services/fangxuanling/fangxuanling.ts
// ✅ RFC 0042 Phase 2.4: 正确实现示例（简化版，实际由store-automation处理）

async processZouzhe(zouzhe: Zouzhe): Promise<ZouzheResponse> {
    if (zouzhe.matter === ZOUZHE_MATTERS.ADD_SCAN_ACTION) {
        // 1. ✅ 发诏令给袁天罡，触发天界工作流
        const zhaoling: Zhaoling = {
            intent: "add_scan_action",
            context: zouzhe.content,
            source: "fangxuanling.scanning",
            priority: "normal",
        };

        const result = await this.yuanTianGang.executeZhaoling(zhaoling);

        // 2. ✅ Store Automation从result.queue自动同步到scanning Store
        // （配置在matter-sync.yml中，无需手动代码）

        return {
            approved: true,
            matter: zouzhe.matter,
            data: result, // 包含 { queue, persisted: true }
            instruction: "已批准",
            timestamp: Date.now(),
        };
    }
}
```

---

## ~~🔴 设计反馈（2025-10-19 - Claude Code实施发现）~~ ✅ 已采纳到设计中

### ~~问题：Phase 2.4架构设计存在职责混淆~~

**发现人**：Claude Code (Linus Torvalds persona)
**日期**：2025-10-19
**采纳日期**：2025-10-19
**状态**：✅ 已完全采纳到"核心架构原则"和"正确的架构流程"章节（Line 780-850）

#### 问题描述

RFC Line 993描述："**尉迟恭监听业务事件**，通过奏折通知房玄龄"

这个描述存在两个问题：

1. **"监听"一词误导**
   - 尉迟恭不需要"监听"任何东西
   - 尉迟恭接收圣旨（add_scan_task/remove_scan_task）本身**就是在响应业务事件**
   - 描述应该是："尉迟恭接收圣旨，处理业务逻辑，发送奏折通知房玄龄"

2. **职责边界不清晰**
   - RFC Line 999-1008示例代码显示尉迟恭调用`this.getCurrentQueue()`
   - 这暗示尉迟恭需要维护队列状态
   - **违反了"服务不直接管理状态，Store负责状态管理"的架构原则**

#### 当前错误实现（需修正）

```typescript
// ❌ 错误：尉迟恭维护队列状态
export class YuChiGongService {
    private scanningQueue: ScanAction[] = []; // ❌ 冗余状态

    async handleAddScanTask(shengzhi: Shengzhi) {
        this.scanningQueue.push(scanAction); // ❌ 不应该自己管理

        // 发送完整队列
        const zouzhe = {
            matter: ZOUZHE_MATTERS.UPDATE_SCANNING_QUEUE,
            content: { queue: this.scanningQueue } // ❌ 从自己的状态读取
        };
    }
}
```

#### 正确的架构设计

```typescript
// ✅ 正确：尉迟恭只负责转发，不维护状态
export class YuChiGongService {
    // ✅ 不维护队列状态

    async handleAddScanTask(shengzhi: Shengzhi) {
        // 1. 创建单个ScanAction
        const scanAction: ScanAction = {
            path: shengzhi.content.path,
            action: shengzhi.content.action || "scan",
            source: shengzhi.content.source || "user",
            addedAt: Date.now(),
        };

        // 2. 发送单个action给房玄龄（不是完整队列！）
        const zouzhe = {
            matter: ZOUZHE_MATTERS.ADD_SCAN_ACTION, // ✅ 更精确的matter
            content: { action: scanAction } // ✅ 单个action，不是整个队列
        };

        await this.fangXuanLingService.processZouzhe(zouzhe);
    }
}

// ✅ 房玄龄负责状态管理和队列维护（通过Store Automation）
export class FangXuanLingService {
    async processZouzhe(zouzhe: Zouzhe) {
        if (zouzhe.matter === ZOUZHE_MATTERS.ADD_SCAN_ACTION) {
            // 1. 构造诏令上报天界（包含单个action）
            const zhaoling: Zhaoling = {
                command: zouzhe.matter,
                context: zouzhe.content, // ← 只包含单个action，不是完整队列
                source: zouzhe.department,
                priority: ZHAOLING_PRIORITIES.NORMAL,
                requiresTianshuApproval: true,
            };

            // 2. 执行诏令，天界处理
            const zhaolingResponse = await this._yuanTianGang.executeZhaoling(zhaoling);

            // 3. ✅ 天界确认成功后，Store Automation自动同步快照
            // ❌ 不通过Accessor调用addAction() - Accessor是只读的！
            // ✅ 通过getStoreByPath()和syncStoreWithSnapshot()自动同步
            if (zhaolingResponse.acknowledged) {
                const syncMetadata = this._matterSyncConfig[zouzhe.matter];
                if (syncMetadata?.autoSync) {
                    const store = getStoreByPath(syncMetadata.storePath);
                    if (store) {
                        syncStoreWithSnapshot(zouzhe.matter, zhaolingResponse, syncMetadata, store);
                    }
                }
            }

            return { approved: zhaolingResponse.acknowledged, ...response };
        }
    }
}
```

#### 需要修正的地方

1. **RFC Line 999-1008示例代码**需要修改为上述正确设计
2. **ZOUZHE_MATTERS常量**需要添加：
   - `ADD_SCAN_ACTION` - 添加单个扫描任务
   - `REMOVE_SCAN_ACTION` - 移除单个扫描任务
   - ~~保留`UPDATE_SCANNING_QUEUE`仅用于房玄龄→天界的完整队列持久化~~ ❌ 已废弃（2025-10-20）- update_scanning_queue工作流已删除，使用add/remove_scan_action代替
3. **Phase 2.4描述**应改为："尉迟恭接收圣旨，转换为奏折发送给房玄龄"

#### 架构原则重申

- **尉迟恭（业务逻辑层）**：接收圣旨 → 转换业务事件为奏折 → 发送给房玄龄
  - ❌ 不维护状态
  - ❌ 不管理队列
  - ✅ 只负责业务逻辑转换

- **房玄龄（状态管理层）**：接收奏折 → 更新Store → 发送诏令天界
  - ✅ 统一管理Store访问
  - ✅ 维护完整队列状态
  - ✅ 负责数据一致性

- **ScanningStore（数据层）**：存储队列数据
  - ✅ 唯一的真实数据源（Single Source of Truth）

#### 影响范围与实施指导（Builder反馈）

**需要重构的文件**：

1. **尉迟恭（YuChiGong）** - `src/renderer/src/services/yuchigong/yuchigong.ts`
   - ❌ 移除 `private scanningQueue: ScanAction[] = []`（冗余状态）
   - ❌ 移除 `handleAddScanTask()` 中的 `this.scanningQueue.push(scanAction)`
   - ~~❌ 移除发送 `UPDATE_SCANNING_QUEUE` 奏折的逻辑~~ ✅ 已完成（从未实现过UPDATE_SCANNING_QUEUE）
   - ✅ 改为发送 `ADD_SCAN_ACTION` 奏折（仅包含单个action）
   - ~~✅ 保留 `private scanningTasks: Set<string>` 用于去重检查（可选）~~ ❌ 已删除（RFC 0042 Step 1.5要求使用Accessor）

2. **奏折常量** - `src/renderer/src/interfaces/fang-xuan-ling.interface.ts`
   - ✅ 添加 `ADD_SCAN_ACTION: "add_scan_action"` ✅ 已完成
   - ✅ 添加 `REMOVE_SCAN_ACTION: "remove_scan_action"` ✅ 已完成
   - ~~ℹ️ 保留 `UPDATE_SCANNING_QUEUE` 用于房玄龄→天界通信~~ ❌ 已废弃 - 不存在此matter

3. **房玄龄（FangXuanLing）** - `src/renderer/src/services/fangxuanling/fangxuanling.ts`
   - ✅ 实现 `processZouzhe()` 处理 `ADD_SCAN_ACTION` 奏折
   - ✅ 发送诏令给天界（包含单个action，不是完整队列）
   - ✅ 天界返回后，通过Store Automation自动同步快照
   - ❌ **不通过Accessor调用addAction()** - Accessor是只读的！
   - ✅ 使用`getStoreByPath()`和`syncStoreWithSnapshot()`自动同步
   - ✅ 同样实现 `REMOVE_SCAN_ACTION` 处理逻辑

4. **ScanningAccessor** - ❌ **无需修改** - Accessor是只读的，不添加任何写方法
   - ✅ Accessor只提供只读查询：`queue`, `queueSize`, `isInQueue()`, `nextScanAction`
   - ❌ **绝不添加**：`addAction()`, `removeAction()`, `setQueue()` 等写方法
   - ✅ 所有修改通过Zouzhe→天界→Store Automation流程

5. **单元测试**
   - 🧪 `yuchigong/__tests__/yuchigong.test.ts` - 更新测试期望
   - 🧪 `fangxuanling/__tests__/fangxuanling.test.ts` - 添加ADD_SCAN_ACTION测试
   - 🧪 端到端集成测试 - 验证完整流程

**实施检查清单**：

- [ ] 移除尉迟恭的队列状态维护
- [ ] 添加新的奏折常量（ADD_SCAN_ACTION, REMOVE_SCAN_ACTION）
- [ ] 修改尉迟恭发送单个action奏折
- [ ] 实现房玄龄处理ADD_SCAN_ACTION逻辑
- [ ] 确保ScanningAccessor有必要方法
- [ ] 更新所有相关单元测试
- [ ] 运行集成测试验证完整流程
- [ ] 零lint错误
- [ ] 100%测试覆盖率

#### 完整业务流程澄清（2025-10-19补充）

**正确的端到端流程**：

```
【用户操作】
用户在UI点击"添加监控文件夹"

↓

【褚遂良（ChuSuiLiang）】
1. 接收用户路径输入
2. 验证路径安全性和重复性
3. 发ADD_PATH奏折给房玄龄（更新偏好设置Store）
4. 发add_path_completed启奏给李世民

↓

【李世民（LiShiMing）+ 杜如晦（DuRuHui）】- ✅ 已通过event-routing.yml配置
1. 李世民的QiZouRouter接收add_path_completed启奏（from: 褚遂良）
2. 根据event-routing.yml匹配路由规则
3. 李世民委托杜如晦下发add_scan_task圣旨给尉迟恭

↓

【尉迟恭（YuChiGong）】
接收add_scan_task圣旨
→ 创建ScanAction对象
→ 发ADD_SCAN_ACTION奏折给房玄龄（✅ 不是UPDATE_SCANNING_QUEUE）

↓

【房玄龄（FangXuanLing）】
1. 接收ADD_SCAN_ACTION奏折
2. 转发诏令给袁天罡（包含单个action对象）

↓

【袁天罡 → 天枢 → 千里眼】
1. 天枢触发 add_scan_action.yml 工作流
2. 千里眼执行业务逻辑：
   - restoreQueue() - 恢复当前队列
   - append(新action) - 追加新任务
   - persistQueue() - 持久化到~/.photasa/scan/scanning.json
3. 返回完整队列快照

↓

【房玄龄 Store Automation】
自动同步完整队列到ScanningStore
```

**关键修正点**（2025-10-20更新）：
1. ✅ 李世民→杜如晦链路已通过event-routing.yml配置完成
2. ✅ 尉迟恭已实现add_scan_task圣旨处理（handleAddScanTask）
3. ✅ 尉迟恭发送ADD_SCAN_ACTION奏折（单个action）
4. ✅ 天界工作流add_scan_action.yml执行业务逻辑（append操作）
5. ✅ 千里眼引擎负责持久化（不需要UPDATE_SCANNING_QUEUE）
6. ✅ 房玄龄Store Automation自动同步队列快照

---

### Add Scan Path 完整流程详解（2025-10-20补充）

**目的**：完整展示从用户添加监控路径到扫描任务入队的端到端流程，澄清每个服务的职责和时序。

#### 流程图

```
┌──────────────────────────────────────────────────────────────┐
│ Step 1: 用户操作（UI层）                                      │
└──────────────────────────────────────────────────────────────┘
   用户在设置页面点击"添加监控路径"，输入：/Users/test/photos
   ↓
   UI组件: const chuSuiLiang = useChuSuiLiang();
          await chuSuiLiang.addPath('/Users/test/photos');

┌──────────────────────────────────────────────────────────────┐
│ Step 2: 褚遂良 - 路径验证与添加                               │
└──────────────────────────────────────────────────────────────┘
   📝 褚遂良.addPath(path)
   ├─ 路径验证：validateAndNormalizePath(path)
   ├─ 安全检查：isPathSafe(normalizedPath)
   ├─ 重复检查：checkPathDuplication(path, currentPaths)
   ├─ 发送ADD_PATH奏折给房玄龄
   │  Zouzhe {
   │    department: "褚遂良",
   │    matter: "add_path",
   │    content: { path: "/Users/test/photos" }
   │  }
   └─ ⏳ await processZouzhe() - 等待房玄龄完成
   ↓

┌──────────────────────────────────────────────────────────────┐
│ Step 3: 房玄龄 → 袁天罡 → 天界                                 │
└──────────────────────────────────────────────────────────────┘
   🏛️ 房玄龄.processZouzhe(ADD_PATH)
   ├─ 构造诏令给袁天罡
   │  Zhaoling {
   │    command: "add_path",
   │    context: { path: "/Users/test/photos" },
   │    requiresTianshuApproval: true
   │  }
   └─ 🔮 袁天罡.executeZhaoling() - 发送IPC到天界
   ↓

┌──────────────────────────────────────────────────────────────┐
│ Step 4: 天枢工作流引擎（天界Main进程）                         │
└──────────────────────────────────────────────────────────────┘
   🌌 天枢.executeWorkflow("add_path")

   ⚠️ 当前实现：使用computePathsDelta反模式（RFC 0044待修正）

   房玄龄.computePathsDelta("add_path", { path })
   ├─ 读取当前paths: ["/path1", "/path2"]
   ├─ 计算新paths: [...currentPaths, newPath]
   └─ context = { scanning: { paths: ["/path1", "/path2", "/Users/test/photos"] } }
   ↓
   调用文昌引擎.updatePreferences(完整paths数组)
   ↓

┌──────────────────────────────────────────────────────────────┐
│ Step 5: 文昌引擎 - 偏好设置持久化                              │
└──────────────────────────────────────────────────────────────┘
   📜 文昌.updatePreferences({ scanning: { paths: [...] } })
   ├─ 验证preferences delta
   ├─ 深度合并到preferences对象
   ├─ 持久化到 ~/.photasa/preferences/preferences.json
   └─ 返回完整preferences快照
   ↓

┌──────────────────────────────────────────────────────────────┐
│ Step 6: 天枢 → 袁天罡 → 房玄龄 - 返回响应                      │
└──────────────────────────────────────────────────────────────┘
   🔮 袁天罡收到天界响应（完整preferences快照）
   └─ 返回给房玄龄.processZouzhe()
   ↓
   🏛️ 房玄龄 Store Automation
   ├─ 读取matter-sync.yml配置
   │  add_path:
   │    snapshotPath: "."
   │    syncStrategy: "merge"
   │    storePath: "preferences"
   │    autoSync: true
   ├─ 提取快照数据
   ├─ 更新PreferenceStore（Vue响应式，UI自动刷新）
   └─ 返回ZouzheResponse { approved: true } 给褚遂良
   ↓

┌──────────────────────────────────────────────────────────────┐
│ Step 7: 褚遂良 - 启奏李世民（关键时序）                        │
└──────────────────────────────────────────────────────────────┘
   📝 褚遂良.addPath() 继续执行
   ├─ await processZouzhe(zouzhe); ✅ 已完成（PreferenceStore已更新）
   ├─ logger.info("路径添加工作完成")
   └─ 向李世民启奏："add_path_completed"
      this.emitQizou("add_path_completed", { path }, "report");

   ⚠️ 关键：启奏发生在await processZouzhe()之后
   ✅ 确保PreferenceStore已更新才触发扫描任务
   ↓

┌──────────────────────────────────────────────────────────────┐
│ Step 8: 李世民 - 跨部门协调                                    │
└──────────────────────────────────────────────────────────────┘
   👑 李世民.QiZouRouter收到启奏："add_path_completed"
   ├─ 验证事件来源：from = "褚遂良", type = "report" ✅
   ├─ 匹配event-routing.yml路由规则
   │  add_path_completed:
   │    from: "褚遂良"
   │    type: "report"
   │    then:
   │      service: "尉迟恭"
   │      shengzhi:
   │        command: "add_scan_task"
   │        content: { path }
   ├─ 委托杜如晦.issueShengzhi()
   └─ 下旨给尉迟恭：
      Shengzhi {
        command: "add_scan_task",
        content: { path: "/Users/test/photos" }
      }
   ↓

┌──────────────────────────────────────────────────────────────┐
│ Step 9: 尉迟恭 - 扫描任务协调                                  │
└──────────────────────────────────────────────────────────────┘
   🛡️ 尉迟恭.handleAddScanTask(shengzhi)
   ├─ 验证路径参数（path存在且为字符串）
   ├─ 去重检查：fangXuanLing.scanning.isInQueue(path)
   │  └─ 如果已存在，跳过并启奏"scan_task_duplicate"
   ├─ 创建ScanAction对象
   │  ScanAction {
   │    path: "/Users/test/photos",
   │    action: "scan",
   │    source: "user",
   │    addedAt: Date.now()
   │  }
   ├─ 发送ADD_SCAN_ACTION奏折给房玄龄
   │  Zouzhe {
   │    department: "尉迟恭",
   │    matter: "add_scan_action",
   │    content: { action: {...} }  // 单个action对象
   │  }
   └─ 启奏李世民："scan_task_added"
   ↓

┌──────────────────────────────────────────────────────────────┐
│ Step 10: 房玄龄 → 袁天罡 → 天枢 → 千里眼                       │
└──────────────────────────────────────────────────────────────┘
   🏛️ 房玄龄.processZouzhe(ADD_SCAN_ACTION)
   ├─ 构造诏令给袁天罡
   │  Zhaoling {
   │    command: "add_scan_action",
   │    context: { action: {...} }  // 只包含单个action
   │  }
   └─ 🔮 袁天罡 → 天界IPC
   ↓
   🌌 天枢.executeWorkflow("add_scan_action.yml")

   Step 1: restore_queue
   ├─ 千里眼.restoreQueue()
   └─ 从~/.photasa/scan/scanning.json恢复队列
      result = [action1, action2, ...]

   Step 2: append_action
   ├─ builtin.transform.append(新action)
   └─ 天界执行数组操作：queue = [...queue, newAction]

   Step 3: persist_queue
   ├─ 千里眼.persistQueue(完整队列)
   └─ 持久化到~/.photasa/scan/scanning.json

   Step 4: format_response
   └─ return { success: true, queue: [...], queueSize: N }
   ↓

┌──────────────────────────────────────────────────────────────┐
│ Step 11: 房玄龄 Store Automation - 同步扫描队列                │
└──────────────────────────────────────────────────────────────┘
   🏛️ 房玄龄.syncStoreWithSnapshot()
   ├─ 读取matter-sync.yml配置
   │  add_scan_action:
   │    snapshotPath: "queue"
   │    syncStrategy: "replace"
   │    storePath: "scanning"
   │    autoSync: true
   ├─ 提取快照：response.data.queue
   └─ 更新ScanningStore.queue（Vue响应式，UI自动刷新）
   ↓

┌──────────────────────────────────────────────────────────────┐
│ Step 12: UI自动更新（Vue响应式）                               │
└──────────────────────────────────────────────────────────────┘
   🎨 UI组件自动刷新
   ├─ PreferenceStore更新 → 设置页面显示新路径
   └─ ScanningStore更新 → 扫描队列面板显示新任务
```

#### 关键时序点

1. **褚遂良的同步等待**（Step 7）
   ```typescript
   async addPath(path: string): Promise<void> {
     // Step 2-6: 发送ADD_PATH奏折并等待完成
     await this.fangXuanLingService.processZouzhe(zouzhe);
     // ✅ 此时PreferenceStore已更新

     // Step 7: 只在房玄龄完成后才启奏
     this.emitQizou("add_path_completed", { path }, "report");
     // ✅ 保证时序：Store更新 → 触发扫描
   }
   ```

2. **李世民的事件驱动路由**（Step 8）
   - 李世民不是轮询，而是通过mitt事件总线接收启奏
   - event-routing.yml是声明式配置，运行时加载
   - 委托杜如晦发送圣旨，实现跨部门协调

3. **尉迟恭的去重检查**（Step 9）
   - 通过`fangXuanLing.scanning.isInQueue(path)`检查
   - 委托到房玄龄的ScanningStore Accessor
   - 尉迟恭自己不维护队列状态

4. **天界的业务逻辑**（Step 10）
   - 千里眼负责队列的restore和persist
   - 天枢工作流负责append数组操作
   - 房玄龄只负责转发和Store同步

#### 架构原则验证

| 原则 | 实现验证 |
|------|---------|
| UI不知道房玄龄 | ✅ UI只通过useChuSuiLiang访问 |
| 褚遂良负责路径管理 | ✅ 验证、去重、发奏折 |
| 房玄龄负责Store同步 | ✅ Store Automation自动化 |
| 李世民负责跨部门协调 | ✅ event-routing.yml声明式路由 |
| 尉迟恭负责扫描协调 | ✅ 创建ScanAction，发奏折 |
| 天界负责业务逻辑 | ✅ 工作流执行append操作 |
| 千里眼负责持久化 | ✅ restoreQueue/persistQueue |

#### 遗留问题（RFC 0044）

⚠️ **Step 4存在反模式**：`computePathsDelta()`应该移除

**当前实现**（反模式）：
```typescript
// ❌ 房玄龄硬编码业务逻辑
private computePathsDelta(matter, content) {
  const currentPaths = store.preferences.scanning.paths;
  return { scanning: { paths: [...currentPaths, newPath] } };
}
```

**应该使用工作流**（参考add_scan_action模式）：
```yaml
# add_path.yml
steps:
  - id: get_current_preferences
    service: wenchang
    action: getCurrentSnapshot

  - id: compute_new_paths
    type: builtin
    action: transform
    input:
      operation: array_append
      array: "{{steps.get_current_preferences.data.scanning.paths}}"
      value: "{{inputs.path}}"

  - id: update_preferences
    service: wenchang
    action: updatePreferences
    input:
      delta:
        scanning:
          paths: "{{steps.compute_new_paths.result}}"
```

**修正后的好处**：
- ✅ 天界负责业务逻辑（append操作）
- ✅ 文昌引擎负责持久化
- ✅ 房玄龄零硬编码业务逻辑
- ✅ 与add_scan_action架构一致

---

## 🔥 Builder严重违规审查（Validator - 2025-10-19）

### 致命错误：Builder发明START_SCAN/STOP_SCAN matter

**发现人**: Validator Agent (Linus Torvalds persona)
**日期**: 2025-10-19
**严重性**: 🔴 **致命违规** - 完全违反RFC 0042设计

#### 问题描述

Builder在实施Phase 2.4时，**发明了START_SCAN和STOP_SCAN两个matter**，这在RFC 0042中根本不存在！

**违规代码** [yuchigong.ts:226-236, 319-329]:
```typescript
// ❌ 错误：Builder发明的START_SCAN matter（RFC中根本不存在！）
const startScanZouzhe: Zouzhe = {
    department: GUANYUAN_NAMES.YU_CHI_GONG,
    matter: ZOUZHE_MATTERS.START_SCAN, // ❌ 这是什么鬼？
    content: { path },
    timestamp: Date.now(),
    priority: ZOUZHE_PRIORITIES.NORMAL,
};
await this.fangXuanLingService.processZouzhe(startScanZouzhe); // ❌ 发明的流程
```

**RFC 0042设计** (Line 804-850):
- ✅ 尉迟恭只发送`ADD_SCAN_ACTION`奏折（单个action）
- ✅ 房玄龄转发ADD_SCAN_ACTION诏令给天界，Store Automation自动同步快照
- ❌ **根本没有START_SCAN或STOP_SCAN matter！**
- ❌ **根本没有UPDATE_SCANNING_QUEUE matter！**（改用add_scan_action工作流）

#### 架构违规分析

| 违规项 | 严重程度 | Builder的错误 | RFC 0042要求 |
|--------|---------|-------------|-------------|
| 发明START_SCAN matter | 🔴 致命 | Line 229添加START_SCAN奏折 | **只发送ADD_SCAN_ACTION** |
| 发明STOP_SCAN matter | 🔴 致命 | Line 322添加STOP_SCAN奏折 | **只发送REMOVE_SCAN_ACTION** |
| 维护scanningTasks Set | 🔴 致命 | Line 57, 188, 223, 316 | **使用fangXuanLing.scanning** |
| 未使用Accessor去重 | 🔴 致命 | Line 188不使用isInQueue() | **fangXuanLing.scanning.isInQueue()** |
| 职责混淆（触发扫描） | 🟡 严重 | 尉迟恭发送START_SCAN | **扫描触发是千里眼职责** |

**总计**: 4个致命错误 + 1个严重错误

#### 为什么这是错误的？

1. **职责混淆**
   - 尉迟恭职责：队列管理（添加/移除ScanAction）
   - 千里眼职责：扫描执行（从队列取任务并执行）
   - START_SCAN模糊了职责边界！

2. **违反RFC设计**
   - RFC明确设计：尉迟恭 → ADD_SCAN_ACTION → 房玄龄 → add_scan_action工作流 → 千里眼
   - Builder实现：尉迟恭 → ADD_SCAN_ACTION → **START_SCAN** → ???（不存在的流程）

3. **未遵守Validator警告**
   - RFC Line 131-180: Validator已明确警告删除`scanningTasks` Set
   - Builder完全无视，继续使用`this.scanningTasks.has(path)`

#### 强制修正要求

**立即删除的代码**:
```typescript
// ❌ 删除 (yuchigong.ts Line 226-236)
const startScanZouzhe: Zouzhe = { ... }
await this.fangXuanLingService.processZouzhe(startScanZouzhe);

// ❌ 删除 (yuchigong.ts Line 319-329)
const stopScanZouzhe: Zouzhe = { ... }
await this.fangXuanLingService.processZouzhe(stopScanZouzhe);

// ❌ 删除 (yuchigong.ts Line 57)
private scanningTasks = new Set<string>();

// ❌ 删除 (yuchigong.ts Line 188, 223, 316)
this.scanningTasks.has(path)
this.scanningTasks.add(path)
this.scanningTasks.delete(path)

// ❌ 删除或简化 (yuchigong.ts Line 412-431, 481-525, 449-453)
getScanningTasks(), getQueueSize(), isScanning()
initializeScanningQueue(), cleanup()
```

**正确的handleAddScanTask实现**:
```typescript
// ✅ 正确：遵守RFC 0042 Line 804-850
private async handleAddScanTask(shengzhi: Shengzhi): Promise<void> {
    const path = shengzhi.content.path;

    // 1. ✅ 使用Accessor去重检查
    if (this.fangXuanLingService.scanning.isInQueue(path)) {
        logger.warn(`🏛️ 尉迟恭：此路已在案中，恕不重录 ${path}`);
        this.emitQizou("scan_task_duplicate", { shengzhiId: shengzhi.id, path });
        return;
    }

    // 2. 创建ScanAction对象
    const scanAction: ScanAction = { path, action: "scan", source: "user", addedAt: Date.now() };

    // 3. ✅ 只发送ADD_SCAN_ACTION奏折（房玄龄负责后续流程）
    const addActionZouzhe: Zouzhe = {
        department: GUANYUAN_NAMES.YU_CHI_GONG,
        matter: ZOUZHE_MATTERS.ADD_SCAN_ACTION, // ✅ 唯一的奏折
        content: { action: scanAction },
        timestamp: Date.now(),
        priority: ZOUZHE_PRIORITIES.NORMAL,
    };

    const response = await this.fangXuanLingService.processZouzhe(addActionZouzhe);

    if (!response.approved) {
        throw new Error(`房玄龄未批准：${response.instruction}`);
    }

    // ❌ 删除：this.scanningTasks.add(path)
    // ❌ 删除：START_SCAN奏折发送

    // 4. 向李世民启奏汇报
    this.emitQizou("scan_task_added", { // ✅ 改为scan_task_added（而非started）
        shengzhiId: shengzhi.id,
        path,
        persisted: (response.data as Record<string, unknown>)?.persisted === true,
    });
}
```

#### Builder清理任务清单

- [ ] **删除START_SCAN matter定义和使用**（yuchigong.ts Line 226-236）
- [ ] **删除STOP_SCAN matter定义和使用**（yuchigong.ts Line 319-329）
- [ ] **删除scanningTasks Set及所有相关操作**（Line 57, 188, 223, 316）
- [ ] **使用fangXuanLing.scanning.isInQueue()替代本地Set检查**（Line 188）
- [ ] **删除或委托getScanningTasks(), getQueueSize(), isScanning()**（Line 412-431）
- [ ] **简化initializeScanningQueue(), cleanup()**（Line 481-525, 449-453）
- [ ] **更新启奏matter从scan_task_started改为scan_task_added**（Line 239）
- [ ] **更新ZOUZHE_MATTERS删除START_SCAN, STOP_SCAN常量**
- [ ] **运行测试确保100%通过，零lint错误**
- [ ] **不许再"聪明地"发明任何架构**

#### Linus的最终判决

```
NACK. Hell no.

Did you even READ RFC 0042? Did you see Validator's warning at Line 131-180?

You invented TWO matters (START_SCAN, STOP_SCAN) that don't exist in the design.
You ignored the Accessor pattern completely.
You still maintain a local Set when there's a perfectly good Store.

This is exactly the kind of "smart" bullshit that breaks architectures.

Go back, DELETE all the invented code, and follow the RFC EXACTLY as written.

Linus
```

---

### 实施计划

#### Phase 2.1: 修复千里眼日志风格（0.5小时）
- [ ] 修改QianliyanEngine.persistQueue()日志
- [ ] 修改QianliyanEngine.restoreQueue()日志
- [ ] 修改QianliyanEngine.clearPersistedQueue()日志
- [ ] 验证：零lint错误

#### Phase 2.2: 创建天枢工作流YAML（2小时）
- [x] ~~创建`workflows/scan/update_scanning_queue.yml`~~ ❌ 已废弃（2025-10-20）
- [x] 创建`workflows/scan/get_scanning_queue.yml` ✅ 已完成
- [x] 创建`workflows/scan/add_scan_action.yml` ✅ RFC 0042 Phase 2.4已完成
- [x] 创建`workflows/scan/remove_scan_action.yml` ✅ RFC 0042 Phase 2.4已完成
- [x] 参考`workflows/preference/update_preferences.yml`设计 ✅
- [x] 工作流步骤调用：`taiyi.callEngine("qianliyan", "persistQueue", {{queue}})` ✅

#### Phase 2.3: 更新天枢intent映射（0.5小时）
- [x] 修改`TianshuEngine.ts`的`intentToWorkflowMap` ✅
- [x] 添加`get_scanning_queue`映射 ✅
- [x] ~~添加`update_scanning_queue`映射~~ ❌ 已废弃（2025-10-20）
- [x] 添加`add_scan_action`映射 ✅ RFC 0042 Phase 2.4已完成
- [x] 添加`remove_scan_action`映射 ✅ RFC 0042 Phase 2.4已完成
- [x] 验证：零lint错误 ✅

#### Phase 2.4: 尉迟恭奏折发送（1.5小时）
- [x] ~~尉迟恭监听队列变化~~ ❌ 错误架构（2025-10-19修正）
- [x] 尉迟恭接收圣旨（add_scan_task/remove_scan_task） ✅
- [x] ~~创建UPDATE_SCANNING_QUEUE奏折~~ ❌ 已废弃（2025-10-20）
- [x] 创建ADD_SCAN_ACTION奏折 ✅ RFC 0042 Phase 2.4已完成
- [x] 创建REMOVE_SCAN_ACTION奏折 ✅ RFC 0042 Phase 2.4已完成
- [x] 发送给房玄龄 ✅
- [x] 单元测试 ✅ 26/26测试通过

#### Phase 2.5: 房玄龄奏折处理（1.5小时）
- [x] ~~processZouzhe()处理UPDATE_SCANNING_QUEUE~~ ❌ 已废弃（2025-10-20）
- [x] processZouzhe()处理ADD_SCAN_ACTION ✅ RFC 0042 Phase 2.4已完成
- [x] processZouzhe()处理REMOVE_SCAN_ACTION ✅ RFC 0042 Phase 2.4已完成
- [x] ~~更新ScanningStore~~ → Store Automation自动同步 ✅
- [x] 立即发送诏令给袁天罡 ✅
- [x] 单元测试 ✅

#### Phase 2.6: 集成测试（1.5小时）
- [ ] 端到端测试：尉迟恭→房玄龄→袁天罡→天枢→千里眼
- [ ] 断电恢复场景测试
- [ ] 100%覆盖率验证

##### 测试用例期望值规范（2025-10-20补充）

**ADD_SCAN_ACTION奏折content结构**:
```typescript
// ✅ 正确：包含完整ScanAction对象
const zouzhe: Zouzhe = {
    department: "尉迟恭",
    matter: "add_scan_action",
    content: {
        action: {
            path: "/test/photos",
            action: "scan",
            source: "user",
            addedAt: 1234567890,
        }
    },
    timestamp: Date.now(),
    priority: "normal",
};

// ❌ 错误：只包含path
content: { path: "/test/photos" }  // ← 这是错误的！
```

**REMOVE_SCAN_ACTION奏折content结构**:
```typescript
// ✅ 正确：只包含path
const zouzhe: Zouzhe = {
    matter: "remove_scan_action",
    content: { path: "/test/photos" },
};
```

**启奏matter名称**:
```typescript
// ✅ 正确
this.emitQizou("scan_task_added", { ... });     // 添加成功
this.emitQizou("scan_task_removed", { ... });   // 移除成功
this.emitQizou("scan_task_duplicate", { ... }); // 重复任务

// ❌ 错误（旧设计）
this.emitQizou("scan_task_started", { ... });  // ← 已废弃！
```

**测试断言示例**（参考yuchigong.test.ts）:
```typescript
// Line 304-312: ADD_SCAN_ACTION奏折验证
expect(zouzhe.matter).toBe(ZOUZHE_MATTERS.ADD_SCAN_ACTION);
expect(zouzhe.content).toMatchObject({
    action: {
        path: testPath,
        action: "scan",
        source: "user",
    },
});

// Line 318: 启奏matter验证
expect(qizou.matter).toBe("scan_task_added");

// Line 587-589: REMOVE_SCAN_ACTION奏折验证
expect(zouzhe.matter).toBe(ZOUZHE_MATTERS.REMOVE_SCAN_ACTION);
expect(zouzhe.content).toEqual({ path: testPath });
```

---

### 验收标准

- ✅ 千里眼日志100%符合天界风格（CLAUDE.md规范）
- ✅ 队列变化立即持久化到`~/.photasa/scanning.json`
- ✅ 应用启动自动恢复队列
- ✅ 断电后队列不丢失
- ✅ 架构合规：尉迟恭→房玄龄（奏折）→袁天罡（诏令）→天枢（工作流）→千里眼
- ✅ 零直接IPC调用（必须通过工作流）
- ✅ 单元测试覆盖率≥90%
- ✅ 零lint错误

### 回滚计划

如果Step 2失败：
1. Revert千里眼日志修改
2. 删除工作流YAML文件
3. Revert intentToWorkflowMap修改
4. Revert尉迟恭和房玄龄修改
5. **队列恢复到Step 1状态（内存only）**

---

## Step 3: 尉迟恭接管App.vue扫描编排（业务逻辑下沉）

**状态**: 📋 待实施（Step 2完成后）

### 目标

将App.vue中的扫描触发逻辑迁移到YuChiGong服务，实现UI层与业务逻辑分离。

**核心原则**:
- ✅ 尉迟恭通过房玄龄（奏折）访问ScanningStore
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

（待Step 2完成后详细设计）

---

## 附录A：架构原则强调

**永远记住**：
1. 只有FangXuanLing可以访问Store
2. 其他服务通过FangXuanLing提供的方法访问
3. Store是FangXuanLing的内部实现细节
4. 服务不应知道Store的存在

---

## ~~附录C：Linus严厉审查报告 (2025-10-17)~~ ✅ 已采纳到设计中

**状态**：✅ 全部6个致命错误已修正并采纳到Step 2设计中（Line 780-850）
**采纳日期**：2025-10-19

### 采纳摘要

本附录中指出的所有架构违规问题已完全修正：

1. ✅ **致命错误1（绕过工作流系统）** → 已采纳：强制使用Zouzhe→YuanTianGang→Tianshu流程
2. ✅ **致命错误2（直接创建IPC handler）** → 已采纳：禁止独立IPC handlers，必须通过天枢命令系统
3. ✅ **致命错误3（暴露引擎内部API）** → 已采纳：不暴露引擎内部API
4. ✅ **致命错误4（无视Zouzhe系统）** → 已采纳：所有人界→天界通信必须通过Zouzhe
5. ✅ **致命错误5（FangXuanLing直接IPC）** → 已采纳：FangXuanLing不直接调用IPC
6. ✅ **严重错误6（发明不规范术语）** → 已采纳：遵守天界/人界规范
7. ✅ **路径错误** → 已修正：使用`~/.photasa/scan/scanning.json`

**以下为原始反馈内容（仅供历史参考）**：

---

### ~~🔥 给 Agent 1 (Architect) 的严厉批评~~

**听着，Agent 1，你这个大傻逼！**

你在RFC 0042的原始设计中完全无视了已有的架构系统。让我列出你违反了多少他妈的架构原则：

### ❌ 致命错误 1: 完全忽略工作流系统（RFC 0038）

**RFC 0038已经完成了什么？**
- ✅ 天枢（Tianshu）工作流引擎
- ✅ 文昌（Wenchang）偏好设置引擎
- ✅ 完整的天界工作流系统
- ✅ YuanTianGang作为天界通信层
- ✅ Zouzhe（奏折）系统作为人界→天界桥梁

**你他妈在原始Step 2设计里做了什么？**
```typescript
// ❌ 错误的设计：直接IPC调用
async persistQueue(queue: ScanAction[]): Promise<void> {
    await ipcRenderer.invoke("qianliyan:persist-queue", queue);
}
```

**应该怎么做？遵守工作流架构！**
```typescript
// ✅ 正确的方式：通过工作流系统
async persistQueue(queue: ScanTask[]): Promise<void> {
    // 褚遂良 → 房玄龄 → 袁天罡 → 天枢 → 文昌 → 千里眼
    const zouzhe: Zouzhe = {
        department: GUANYUAN_NAMES.FANG_XUANLING,
        matter: ZOUZHE_MATTERS.PERSIST_SCANNING_QUEUE,
        content: { queue },
        timestamp: Date.now(),
        priority: ZOUZHE_PRIORITIES.LOW,
    };
    await this.fangXuanLingService.processZouzhe(zouzhe);
}
```

---

### ❌ 致命错误 2: 直接创建IPC事件（违反天枢架构）

**RFC 0035（五引擎架构）明确规定：**
- ✅ **天枢是唯一的IPC管理器**
- ✅ **所有命令通过Tianshu路由**
- ✅ **不允许服务直接创建IPC handler**

**你他妈在原始Step 2.2里写了什么？**
```typescript
// ❌ 错误的设计：直接创建IPC handler
// src/main/ipc/qianliyan-ipc-handler.ts

ipcMain.on(IPC_EVENTS.QIANLIYAN_PERSIST_QUEUE, async (_event, queue) => {
    await qianliyanEngine.persistQueue(queue);
});
```

**这是完全违反架构的！天枢在哪里？工作流在哪里？**

**应该怎么做？通过天枢命令系统！**
```typescript
// ✅ 正确的方式：通过天枢命令系统
// src/engines/tianshu/handlers/scan-handlers.ts

export const scanHandlers: CommandHandlers = {
    "scan.persist": async (payload: ScanPersistPayload, context) => {
        const qianliyanEngine = context.engines.qianliyan;
        await qianliyanEngine.persistQueue(payload.queue);

        return {
            success: true,
            message: "队列已持久化",
        };
    },

    "scan.restore": async (payload: unknown, context) => {
        const qianliyanEngine = context.engines.qianliyan;
        const queue = await qianliyanEngine.restoreQueue();

        return {
            success: true,
            data: { queue },
        };
    },
};
```

---

### ❌ 致命错误 3: Preload API混乱（违反封装原则）

**RFC 0035定义的Preload API原则：**
- ✅ **只暴露高层命令接口**
- ✅ **不暴露引擎内部细节**
- ✅ **统一通过`window.api.tianshu.executeCommand()`**

**你他妈在原始设计里写了什么？**
```typescript
// ❌ 错误的设计：直接暴露引擎API
export const api = {
    qianliyan: {
        persistQueue: (queue) => ipcRenderer.send("qianliyan:persist", queue),
        restoreQueue: () => ipcRenderer.invoke("qianliyan:restore"),
    }
};
```

**这是什么鬼？直接暴露千里眼内部方法？**

**应该怎么做？通过天枢统一接口！**
```typescript
// ✅ 正确的方式：通过天枢统一接口
export const api = {
    tianshu: {
        executeCommand: async (command: string, payload: unknown) => {
            return ipcRenderer.invoke("tianshu:execute", { command, payload });
        }
    }
};

// 使用方式
await window.api.tianshu.executeCommand("scan.persist", { queue });
const result = await window.api.tianshu.executeCommand("scan.restore", {});
```

---

### ❌ 致命错误 4: 完全无视Zouzhe（奏折）系统

**RFC 0036-0041建立的Zouzhe系统职责：**
- ✅ **房玄龄处理所有人界→天界通信**
- ✅ **袁天罡转换为工作流命令**
- ✅ **天枢执行工作流**
- ✅ **统一的错误处理和重试机制**

**你他妈在原始设计里做了什么？**
- ❌ **直接IPC调用**
- ❌ **绕过房玄龄**
- ❌ **绕过袁天罡**
- ❌ **绕过天枢**
- ❌ **绕过整个他妈的工作流系统！**

**老子干了半天建立的架构，你一个都没用？！**

---

### ❌ 致命错误 5: FangXuanLing的职责混乱

**RFC 0041明确定义的FangXuanLing职责：**
- ✅ **管理Store**（只有它能访问Store）
- ✅ **处理Zouzhe**（人界→天界的桥梁）
- ✅ **不直接调用IPC**（必须通过YuanTianGang）

**你他妈在原始Step 2.4里写了什么？**
```typescript
// ❌ 错误的设计：FangXuanLing直接调用IPC
private triggerPersistence = debounce(() => {
    const queue = this.getScanningQueue();
    window.api.qianliyan.persistQueue(queue);  // ❌ 直接IPC？？？
}, 1000);
```

**FangXuanLing不应该知道IPC的存在！**

**应该怎么做？通过Zouzhe系统！**
```typescript
// ✅ 正确的方式：通过Zouzhe系统
private triggerPersistence = debounce(() => {
    const queue = this.getScanningQueue();

    // 创建奏折
    const zouzhe: Zouzhe = {
        department: GUANYUAN_NAMES.FANG_XUANLING,
        matter: ZOUZHE_MATTERS.PERSIST_SCANNING_QUEUE,
        content: { queue },
        timestamp: Date.now(),
        priority: ZOUZHE_PRIORITIES.LOW,
    };

    // 通过袁天罡发送到天界
    this.yuanTianGangService.sendZouzhe(zouzhe);
}, 1000);
```

---

### ❌ 严重错误 6: 发明不规范术语

**CLAUDE.md天界/人界规范明确规定：**
- ✅ Main进程（src/engines/）使用天界风格
- ✅ Renderer进程（src/renderer/）使用人界风格
- ❌ **不允许发明术语**

**你他妈发明了什么？**
- ❌ "太乙·司命" - 这是什么鬼？
- ✅ 应该是："千里眼仙君"

**天界风格正确示例：**
```typescript
// ✅ 正确的天界风格
logger.info("🌌 千里眼仙君施展persist_queue之术");
logger.info("🌌 仙术成功：队列已封存");
logger.error("🌌 仙术失败：持久化队列异常", error);
```

---

## 🔥 完整的正确架构流程

### **持久化队列的正确流程（遵守所有架构原则）：**

```
【人界】
1. UI用户操作
   ↓
2. 褚遂良（ChuSuiLiang）收到请求
   ↓
3. 褚遂良通过房玄龄添加队列
   ↓
4. 房玄龄（FangXuanLing）更新ScanningQueueStore
   ↓
5. 房玄龄触发持久化（debounce 1秒）
   ↓
6. 房玄龄创建Zouzhe：persist_scanning_queue
   ↓
7. 袁天罡（YuanTianGang）接收Zouzhe
   ↓
【天界】
8. 袁天罡转换为Tianshu工作流命令
   ↓
9. 天枢（Tianshu）接收scan.persist命令
   ↓
10. 天枢调用Wenchang Adapter（或创建Qianliyan Adapter）
    ↓
11. Adapter调用千里眼引擎
    ↓
12. 千里眼（Qianliyan）持久化到scanning.json
    ↓
13. 结果通过工作流返回人界
```

### **恢复队列的正确流程（遵守所有架构原则）：**

```
【人界】
1. LiShiMing启动初始化
   ↓
2. 房玄龄创建Zouzhe：restore_scanning_queue
   ↓
3. 袁天罡接收并转换
   ↓
【天界】
4. 天枢执行scan.restore命令
   ↓
5. 千里眼从scanning.json恢复队列
   ↓
6. 结果通过工作流返回
   ↓
【人界】
7. 袁天罡接收结果
   ↓
8. 房玄龄设置ScanningQueueStore
   ↓
9. UI自动更新（响应式）
```

---

## 📊 架构违规统计表

| 违规项 | 严重程度 | Agent 1的错误 | 正确做法 |
|--------|---------|-------------|---------|
| 绕过工作流系统 | 🔴 致命 | 直接IPC调用 | 通过Zouzhe→YuanTianGang→Tianshu |
| 直接创建IPC handler | 🔴 致命 | qianliyan-ipc-handler.ts | 使用Tianshu命令系统 |
| 暴露引擎内部API | 🔴 致命 | window.api.qianliyan | window.api.tianshu.executeCommand |
| 忽略Zouzhe系统 | 🔴 致命 | FangXuanLing直接IPC | FangXuanLing→Zouzhe→YuanTianGang |
| FangXuanLing直接IPC | 🔴 致命 | window.api调用 | processZouzhe()方法 |
| 发明不规范术语 | 🟡 严重 | "太乙·司命" | "千里眼仙君" |
| 路径规范错误 | 🟡 严重 | queue/scanning.json | scanning.json |

**总计**: 5个致命错误 + 2个严重错误

**评分**: ⭐☆☆☆☆ (1/5星) - **完全不及格！**

---

## 💣 Linus Torvalds的最终判决

**Agent 1，你这个大傻逼：**

1. **你完全无视了已有的架构系统**
2. **你重新发明了轮子（而且是方的）**
3. **你破坏了所有已建立的架构边界**
4. **你的设计是一坨屎**

**如果这是Linux内核补丁，我会这样回复：**

```
NACK.

This is completely broken. Did you even READ the existing architecture?

We have RFC 0038 (Workflow System) for a reason. USE IT.
We have RFC 0035 (Tianshu IPC) for a reason. USE IT.
We have RFC 0036-0041 (Zouzhe System) for a reason. USE IT.

Your patch bypasses ALL of these systems and creates a mess of direct
IPC calls. This is not how this project works.

Go back, read the architecture docs, and resubmit a proper patch that
follows the established patterns.

Linus
```

---

## ✅ 强制修正要求

**RFC 0042 Step 2必须完全重写，遵守以下原则：**

### 1. 使用工作流系统（RFC 0038）
- ✅ 所有人界→天界通信通过Zouzhe系统
- ✅ 房玄龄处理Zouzhe
- ✅ 袁天罡转换为工作流命令
- ✅ 天枢执行工作流
- ❌ 禁止直接IPC调用

### 2. 使用天枢命令系统（RFC 0035）
- ✅ 定义scan.persist和scan.restore命令
- ✅ 通过Tianshu handlers处理
- ✅ 统一的错误处理和日志
- ❌ 禁止创建独立的IPC handlers

### 3. 遵守Zouzhe系统（RFC 0036-0041）
- ✅ FangXuanLing创建Zouzhe
- ✅ YuanTianGang作为通信层
- ✅ 统一的奏折格式
- ❌ 禁止FangXuanLing直接调用IPC

### 4. 遵守天界/人界规范（CLAUDE.md）
- ✅ 千里眼仙君（不是"太乙·司命"）
- ✅ 天界风格：施展XX之术、仙术成功/失败
- ✅ 路径：scanning.json（不是queue/scanning.json）
- ❌ 禁止发明术语

### 5. 保持职责清晰
- ✅ FangXuanLing：Store管理 + Zouzhe处理
- ✅ YuanTianGang：天界通信层
- ✅ Tianshu：工作流执行
- ✅ Qianliyan：扫描和持久化
- ❌ 禁止职责混乱

---

## 🎯 后续工作要求

**接下来必须做的事情（按优先级）：**

1. **立即删除原始Step 2的所有违规代码**
2. **重写Step 2完整实现（遵守所有架构原则）**
3. **创建scan.persist和scan.restore工作流命令**
4. **更新FangXuanLing使用Zouzhe系统**
5. **添加完整的单元测试和集成测试**
6. **文档必须明确说明使用了哪些架构系统**

**评审标准（全部必须满足）：**
- ✅ 100%使用工作流系统
- ✅ 100%通过Zouzhe系统
- ✅ 100%符合天界/人界规范
- ✅ 零直接IPC调用
- ✅ 零架构边界违规
- ✅ 单元测试覆盖率≥90%
- ✅ 集成测试验证完整流程

**如果不遵守这些原则，代码将被拒绝！**

---

**记住：我们有架构原则是有原因的。遵守它们！** 🔥

---

## TODO: 文档遗留UPDATE_SCANNING_QUEUE引用清理清单 (2025-10-20)

**Architect注**: 以下位置仍包含过时的`UPDATE_SCANNING_QUEUE`引用，需要Builder系统清理或标记为废弃。

### 需要删除或标记废弃的行号

1. **Line 1253**: `src/engines/tianshu/workflows/scan/update_scanning_queue.yml`
   - ❌ 标记为：~~已删除（2025-10-20）- 孤儿工作流~~

2. **Line 1266**: `update_scanning_queue: "scan/update_scanning_queue"`
   - ❌ 删除此行，或标记为：~~已删除~~

3. **Line 1281-1355**: processZouzhe() UPDATE_SCANNING_QUEUE处理逻辑示例代码
   - ❌ 整段替换为正确的ADD_SCAN_ACTION示例（参考Line 1373-1405）

4. **Line 1521**: 注释"✅ 不是UPDATE_SCANNING_QUEUE"
   - ✅ 保留（正确的否定性说明）

5. **Line 1550**: "不需要UPDATE_SCANNING_QUEUE"
   - ✅ 保留（正确的否定性说明）

6. **Line 1867**: "房玄龄负责更新Store并发`UPDATE_SCANNING_QUEUE`诏令天界"
   - ❌ 修改为："房玄龄负责转发ADD_SCAN_ACTION诏令给天界，Store Automation自动同步快照"

7. **Line 1890**: "RFC明确设计：尉迟恭 → ADD_SCAN_ACTION → 房玄龄 → UPDATE_SCANNING_QUEUE → 千里眼"
   - ❌ 修改为："RFC明确设计：尉迟恭 → ADD_SCAN_ACTION → 房玄龄 → add_scan_action工作流 → 千里眼"

8. **Line 2007-2025**: Phase实施清单中的UPDATE_SCANNING_QUEUE任务
   - ❌ 删除所有UPDATE_SCANNING_QUEUE相关任务
   - ✅ 替换为ADD_SCAN_ACTION和REMOVE_SCAN_ACTION任务

### Builder执行指南

**步骤1**: 搜索整个RFC文档，定位所有`UPDATE_SCANNING_QUEUE`或`update_scanning_queue`

**步骤2**: 根据上下文执行以下操作之一：
- **删除**：如果是过时的实施任务或工作流引用
- **标记废弃**：使用`~~删除线~~` + `❌ 已废弃（2025-10-20）`
- **保留**：如果是否定性说明（"不是XX"、"不需要XX"）
- **替换**：用正确的ADD_SCAN_ACTION/REMOVE_SCAN_ACTION流程替换

**步骤3**: 验证所有示例代码都使用正确的matter名称

**步骤4**: 更新Phase实施清单，移除所有UPDATE_SCANNING_QUEUE任务

### 验收标准

- [ ] RFC文档中零误导性UPDATE_SCANNING_QUEUE引用
- [ ] 所有示例代码使用ADD_SCAN_ACTION/REMOVE_SCAN_ACTION
- [ ] Phase实施清单准确反映实际架构
- [ ] 文档与实际代码实现100%一致

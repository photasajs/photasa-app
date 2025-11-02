# RFC 0042: scanningFolder四步渐进式迁移

- **RFC编号**: 0042
- **标题**: scanningFolder四步渐进式迁移
- **作者**: AI Architect (Agent 1)
- **开始日期**: 2025-10-16
- **状态**: ✅ 已完成 - Step 1完成，后续步骤已拆分为独立RFC
- **最后更新**: 2025-11-01 (Agent 1将未完成任务拆分为RFC 0046/0047/0048)
- **类型**: 架构重构
- **目标版本**: v2.0.0
- **依赖RFC**:
  - RFC 0038: 偏好设置工作流集成与Store边界统一（已完成）✅
  - RFC 0038 Phase 7: qizou-shengzhi架构（已完成）✅
- **后续RFC** (Step 2-3已拆分为独立RFC):
  - RFC 0046: 扫描队列持久化 - 千里眼scanning.json管理（Step 2）
  - RFC 0047: folderTree持久化与初始化 - 司命/千里眼appState管理（Step 2.5）
  - RFC 0048: 扫描编排业务逻辑下沉 - 尉迟恭接管App.vue（Step 3）
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

**四步路线图**（修正后）：
- **Step 1**: ✅ **已完成** - 房玄龄创建专用ScanningStore（Store分离优先 + Accessor/Builder架构）
  - Phase 1.1: ✅ 创建ScanningStore
  - Phase 1.2: ✅ 实现只读Accessor + Builder模式
  - Phase 1.3: ✅ 注册到Store Registry
  - 测试: 16/16 passed, 100% coverage, zero lint errors
- **Step 2**: 📋 待实施 - 千里眼追踪scanning.json持久化（天界优先）
- **Step 2.5**: ⚠️ **需要修复** - folderTree持久化实现（尉迟恭→房玄龄→天枢→千里眼）
  - ✅ 基础设施完成：千里眼持久化方法、工作流YAML、Store自动同步配置
  - ❌ 架构违规1：尉迟恭直接访问preferenceStore（Line 344-351）
  - ❌ 架构违规2：袁天罡intentMapping缺少UPDATE_FOLDER_TREE映射
  - ⚠️ 配置差异：matter-sync.yml配置与RFC设计不一致（需确认）
  - 🔨 Builder任务：修复所有架构违规，严格按RFC实施
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

## Store Automation设计说明 (2025-10-27)

### 概述

Store Automation系统是RFC 0038引入的配置驱动机制，实现天界响应到人界Store的自动同步。本章节澄清其核心概念和设计缺陷修正方案。

### 核心概念

**关键字段职责**：

1. **storePath** (建议重命名为 `storeName`)
   - **当前职责**：指定Store名称，用于Store Registry映射
   - **示例**：`"preferences"` → `usePreferenceStore()`
   - **使用位置**：`getStoreByPath(storePath)` 查找对应Store
   - **问题**：命名暗示是"路径"，但实际是"名称"

2. **snapshotPath** (建议重命名为 `propertyPath`)
   - **当前职责**：属性链，双重用途
     - **用途1**：从天界响应提取数据 → `extractSnapshotFromResponse(response, snapshotPath)`
     - **用途2**：向Store写入数据位置 → `setStoreFieldData(store, snapshotPath, data)`
   - **示例**：
     - `"queue"` → 提取`response.data.queue`，写入`store.queue`
     - `"."` → 提取`response.data`整体，写入store根级别
     - `"ui.theme"` → 提取`response.data.ui.theme`，写入`store.ui.theme`
   - **问题**：命名暗示只用于"snapshot提取"，但实际用于Store写入

3. **syncStrategy**
   - **职责**：定义同步策略
   - **选项**：
     - `merge` - 深度合并（使用mergePreferencesFromTianjie）
     - `replace` - 完全替换
     - `patch` - 浅层合并（Object.assign）

### 当前实现分析

```typescript
// src/renderer/src/services/fangxuanling/store-automation/store-sync-utils.ts

// ✅ 正确：storePath用于获取Store
const store = getStoreByPath(syncMetadata.storePath);

// ❌ 混淆：snapshotPath既用于提取数据
const snapshot = extractSnapshotFromResponse(zhaolingResponse, syncMetadata.snapshotPath);

// ❌ 混淆：snapshotPath又用于Store操作
const currentStoreData = getStoreFieldData(store, syncMetadata.snapshotPath);
setStoreFieldData(store, syncMetadata.snapshotPath, updatedData);
```

**当前YAML配置示例**：

```yaml
# src/renderer/src/services/fangxuanling/store-automation/matter-sync.yml

matters:
    get_scanning_queue:
        snapshotPath: "queue"        # 从response.data.queue提取，写入store.queue
        syncStrategy: "replace"
        storePath: "scanning"        # Store名称：useScanningStore()

    theme_change:
        snapshotPath: "ui.theme"     # 从response.data.ui.theme提取，写入store.ui.theme
        syncStrategy: "merge"
        storePath: "preferences"     # Store名称：usePreferenceStore()
```

### 设计缺陷分析

**问题1：命名语义混淆**

```typescript
// ❌ 当前接口：命名不清晰
export interface MatterSyncMetadata {
    snapshotPath: string;  // 实际是属性链，但名称暗示只用于snapshot
    storePath: string;     // 实际是Store名称，但名称暗示是路径
    syncStrategy: "merge" | "replace" | "patch";
    storePath: string;
    autoSync: boolean;
}
```

**问题2：职责不清导致代码混乱**

- `getStoreFieldData(store, snapshotPath)` - 参数名误导，实际是Store内部路径
- `setStoreFieldData(store, snapshotPath, data)` - 参数名误导，实际是Store内部路径
- 代码阅读者难以理解`snapshotPath`的双重职责

### 修正方案（Linus "好品味"设计）

**核心思想**：一个属性链，两个用途，清晰命名

```typescript
// ✅ 建议接口：语义清晰
export interface MatterSyncMetadata {
    storeName: string;      // 明确是Store名称（Registry键）
    propertyPath: string;   // 明确是属性链（Property Chain）
    syncStrategy: "merge" | "replace" | "patch";
    autoSync: boolean;
    description?: string;
}
```

**建议的YAML配置**：

```yaml
matters:
    get_scanning_queue:
        storeName: "scanning"          # 明确：Store名称
        propertyPath: "queue"          # 明确：属性链（双重用途）
        syncStrategy: "replace"

    theme_change:
        storeName: "preferences"       # 明确：Store名称
        propertyPath: "ui.theme"       # 明确：属性链（双重用途）
        syncStrategy: "merge"
```

**代码修正示例**：

```typescript
// ✅ 修正后：清晰的参数命名
export function getStoreFieldData(
    store: Record<string, unknown>,
    propertyPath: string,  // 清晰：属性链
): Record<string, unknown>

export function setStoreFieldData(
    store: Record<string, unknown> & { $patch: (data: Record<string, unknown>) => void },
    propertyPath: string,  // 清晰：属性链
    newData: Record<string, unknown> | unknown[],
): void

export function syncStoreWithSnapshot(
    matter: string,
    zhaolingResponse: ZhaolingResponse,
    syncMetadata: MatterSyncMetadata,
    store: Record<string, unknown> & { $patch: (data: Record<string, unknown>) => void },
): boolean {
    // 1. 从response.data提取数据（使用propertyPath）
    const snapshot = extractSnapshotFromResponse(zhaolingResponse, syncMetadata.propertyPath);

    // 2. 获取Store当前数据（使用propertyPath）
    const currentStoreData = getStoreFieldData(store, syncMetadata.propertyPath);

    // 3. 应用策略
    let updatedData = applyStrategy(currentStoreData, snapshot, syncMetadata);

    // 4. 写入Store（使用propertyPath）
    setStoreFieldData(store, syncMetadata.propertyPath, updatedData);
}
```

### 实施计划

重命名工作将在**Step 2 Phase 2.5**中实施，详见Step 2实施设计章节。

**核心原则**：
- ✅ 语义清晰优于简洁
- ✅ 消除混淆优于保持兼容
- ✅ 一次性重构优于渐进式混乱
- ✅ Linus "好品味"：正确的命名让特殊情况消失

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

#### 2.6 Store Automation重构：storeName + propertyPath (2025-10-27)

**目标**：修正Store Automation的命名混淆问题，实现Linus "好品味"的清晰设计。

**详细设计**：见"Store Automation设计说明"章节。

**实施步骤**：

**Step 1: 更新TypeScript接口定义**

```typescript
// src/renderer/src/services/fangxuanling/store-automation/index.ts

// ✅ 修改前
export interface MatterSyncMetadata {
    snapshotPath: string;
    storePath: string;
    syncStrategy: "merge" | "replace" | "patch";
    autoSync: boolean;
    description?: string;
}

// ✅ 修改后：清晰的语义
export interface MatterSyncMetadata {
    storeName: string;      // 重命名：明确是Store名称
    propertyPath: string;   // 重命名：明确是属性链
    syncStrategy: "merge" | "replace" | "patch";
    autoSync: boolean;
    description?: string;
}
```

**Step 2: 更新YAML配置**

```yaml
# src/renderer/src/services/fangxuanling/store-automation/matter-sync.yml

# ✅ 修改所有matter配置
matters:
    get_scanning_queue:
        storeName: "scanning"          # 重命名：storePath → storeName
        propertyPath: "queue"          # 重命名：snapshotPath → propertyPath
        syncStrategy: "replace"
        autoSync: true

    add_scan_action:
        storeName: "scanning"
        propertyPath: "queue"
        syncStrategy: "replace"
        autoSync: true

    remove_scan_action:
        storeName: "scanning"
        propertyPath: "queue"
        syncStrategy: "replace"
        autoSync: true

    theme_change:
        storeName: "preferences"
        propertyPath: "ui.theme"
        syncStrategy: "merge"
        autoSync: true

    # ... 更新所有其他matter配置
```

**Step 3: 更新store-sync-utils.ts函数签名**

```typescript
// src/renderer/src/services/fangxuanling/store-automation/store-sync-utils.ts

// ✅ 修改所有函数的参数名
export function getStoreFieldData(
    store: Record<string, unknown>,
    propertyPath: string,  // 重命名：snapshotPath → propertyPath
): Record<string, unknown>

export function setStoreFieldData(
    store: Record<string, unknown> & { $patch: (data: Record<string, unknown>) => void },
    propertyPath: string,  // 重命名：snapshotPath → propertyPath
    newData: Record<string, unknown> | unknown[],
): void

export function extractSnapshotFromResponse(
    zhaolingResponse: ZhaolingResponse,
    propertyPath: string,  // 重命名：snapshotPath → propertyPath
): unknown | null

export function applyMergeStrategy(
    storeData: Record<string, unknown>,
    propertyPath: string,  // 重命名：storePath → propertyPath
    snapshot: unknown,
): Record<string, unknown>

export function syncStoreWithSnapshot(
    matter: string,
    zhaolingResponse: ZhaolingResponse,
    syncMetadata: MatterSyncMetadata,  // 已更新接口
    store: Record<string, unknown> & { $patch: (data: Record<string, unknown>) => void },
): boolean {
    // 使用syncMetadata.propertyPath和syncMetadata.storeName
    const snapshot = extractSnapshotFromResponse(zhaolingResponse, syncMetadata.propertyPath);
    const currentStoreData = getStoreFieldData(store, syncMetadata.propertyPath);
    // ...
    setStoreFieldData(store, syncMetadata.propertyPath, updatedData);
}
```

**Step 4: 更新store-registry.ts**

```typescript
// src/renderer/src/services/fangxuanling/store-automation/store-registry.ts

// ✅ 修改函数名和文档注释
/**
 * 从storeName提取Store名称（纯函数）
 *
 * 示例：
 * - "preferences" -> "preferences"
 * - "scanning" -> "scanning"
 *
 * @param storeName - Store名称（Registry键）
 * @returns Store名称
 */
export function extractStoreName(storeName: string): string {
    return storeName.split(".")[0];
}

/**
 * 根据storeName获取对应的Store实例
 *
 * @param storeName - Store名称（如"preferences"、"scanning"等）
 * @returns Store实例，如果未找到则返回null
 */
export function getStoreByName(storeName: string): any | null {
    const storeFactory = STORE_REGISTRY[storeName];
    if (!storeFactory) {
        logger.error(
            `❌ 未找到Store: ${storeName}，可用Store: ${Object.keys(STORE_REGISTRY).join(", ")}`,
        );
        return null;
    }
    return storeFactory();
}

/**
 * 检查storeName是否有效（纯函数）
 *
 * @param storeName - Store名称
 * @returns 是否有效
 */
export function isValidStoreName(storeName: string): boolean {
    return storeName in STORE_REGISTRY;
}

// 保留旧函数作为别名（渐进式迁移）
export const getStoreByPath = getStoreByName;
export const isValidStorePath = isValidStoreName;
```

**Step 5: 更新FangXuanLingService调用**

```typescript
// src/renderer/src/services/fangxuanling/fangxuanling.ts

async processZouzhe(zouzhe: Zouzhe): Promise<ZouzheResponse> {
    // ...
    if (zhaolingResponse.acknowledged) {
        const syncMetadata = this._matterSyncConfig[zouzhe.matter];
        if (syncMetadata?.autoSync) {
            // ✅ 使用新的storeName字段
            const store = getStoreByName(syncMetadata.storeName);
            if (store) {
                syncStoreWithSnapshot(zouzhe.matter, zhaolingResponse, syncMetadata, store);
            } else {
                logger.error(
                    `❌ 典籍归档失败: 未找到册库「${syncMetadata.storeName}」办理「${zouzhe.matter}」`,
                );
            }
        }
    }
}
```

**Step 6: 更新所有测试文件**

```typescript
// src/renderer/src/services/fangxuanling/store-automation/__tests__/*.test.ts

// ✅ 更新所有测试中的字段名
const mockMetadata: MatterSyncMetadata = {
    storeName: "preferences",      // 重命名
    propertyPath: "ui.theme",      // 重命名
    syncStrategy: "merge",
    autoSync: true,
};
```

**验收标准**：
- [x] 所有TypeScript类型错误已修复 ✅
- [x] 所有YAML配置已更新（14个matter配置）✅
- [x] 所有测试100%通过 ✅ (51/51 passed)
- [x] 零lint错误 ✅
- [x] 功能完全一致（行为无变化）✅

**实施日期**: 2025-10-27
**实施者**: Agent 2 (Builder)
**提交状态**: ✅ 已完成并验证

**回滚计划**：
- Git提交前创建专门分支：`refactor/store-automation-naming`
- 保留旧函数别名（`getStoreByPath`），确保兼容性
- 如发现问题，可快速回滚到上一个commit

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
- [x] 端到端测试：尉迟恭→房玄龄→袁天罡→天枢→千里眼 ✅ 2025-10-29完成
- [x] 断电恢复场景测试 ✅ 2025-10-29完成
- [x] 100%覆盖率验证 ✅ 2025-10-29完成 (13/13 tests passing)

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

## Step 2.5: folderTree持久化架构设计（司命引擎天界化）

**状态**: 📋 架构设计阶段 - 重大架构调整
**作者**: Architect (Linus Torvalds风格)
**创建日期**: 2025-10-29
**架构调整日期**: 2025-10-30

**⚠️ 重大架构变更（2025-10-30）**：
- **服务职责分离**：创建魏征（WeiZheng）专门管理appState，秦琼（QinQiong）只负责file watch
- **引擎变更**：folderTree持久化从千里眼引擎改为司命引擎（SimingEngine）
- **目标**：避免秦琼职责重叠（watch + appState管理），遵循单一职责原则

### 🎯 核心问题

**当前错误架构**：
```typescript
// ❌ 错误1：尉迟恭直接调用preferenceStore.updateFolderTree()
preferenceStore.updateFolderTree(path);  // ← 违反Store访问规则！

// ❌ 错误2：folderTree只在内存store中更新，没有持久化
this._scanningStore.folderTree = [...]; // ← 没有持久化到磁盘！

// ❌ 错误3：App.vue直接更新folderTree
args.paths.forEach((p: string) => updateFolderTree(p)); // ← UI层直接修改！
```

**根本问题**：
1. **folderTree必须持久化** - 应用重启后文件夹树结构应该恢复
2. **千里眼负责持久化** - 扫描完成后，通过标准流程持久化到独立文件 `appstate/foldertree.json`
3. **Store Automation自动同步** - 持久化数据应自动同步到store，无需手动调用
4. **必须走标准流程** - 不能绕过 奏折→诏令→符箓→天枢→千里眼 架构
5. **违反了"Bad programmers worry about code, good programmers worry about data structures"原则** - 我们没有先设计清楚数据流！

### 🏗️ 正确的数据流架构

**Linus哲学**：先设计数据结构和数据流，再写代码！

```
【数据结构】
FolderNode[]  // 文件夹树结构，需要持久化

【持久化位置】
~/.photasa/appstate/foldertree.json  // 独立文件，与scanning queue保持一致
{
  "version": "1.0",
  "timestamp": 1234567890,
  "tree": FolderNode[]
}

【数据流方向】
扫描完成
→ 完整的奏折→诏令→符箓→天枢→千里眼流程
→ 千里眼持久化到 appstate/foldertree.json（磁盘）
→ 返回结果给房玄龄
→ Store Automation自动同步到PreferenceStore.appState.folderTree（内存）
→ Vue响应式系统更新UI
```

### 🎨 架构设计：两条数据流

**Linus哲学**："好代码的关键不在于代码本身，而在于数据流是否清晰。"

本系统有两条完全不同的数据流，各自独立但最终汇聚到同一个标准流程：

---

#### Flow 1: 扫描完成事件流（异步通知 → 启奏 → 圣旨 → 奏折）

**触发源**：千里眼扫描服务完成扫描（Main进程）

**完整数据流**：
```
千里眼扫描服务 (Main进程 IPC "picasa:find-photo")
  ↓
袁天罡监听IPC事件 (setupQianliyanEventListening)
  ↓ 构造启奏 (Qizou: matter="scan_completed", content={paths})
李世民路由 (LiShiMing via mitt qizouBus)
  ↓ event-routing.yml 路由决策
杜如晦下旨 (DuRuHui via MessageChannel)
  ↓ 圣旨 (Shengzhi: command="update_folder_tree", content={paths})
尉迟恭接旨 (YuChiGong.handleUpdateFolderTree)
  ↓ 发送奏折 (Zouzhe: matter="UPDATE_FOLDER_TREE", content={tree})
房玄龄处理奏折 (FangXuanLing.processZouzhe)
  ↓ 构造诏令 (Zhaoling)
袁天罡执行诏令 (YuanTianGang.executeZhaoling)
  ↓ 转换为符箓 (Fulu)
天枢工作流 (update_folder_tree.yml)
  ↓ 太乙路由 (TaiYi callEngine protocol)
千里眼引擎 (persistFolderTree/restoreFolderTree)
  ↓ 持久化到磁盘
本地JSON文件 (~/.photasa/appstate/foldertree.json)
  ↓ 返回结果
房玄龄自动同步Store (syncStoreWithSnapshot via matter-sync.yml)
  ↓
PreferenceStore.appState.folderTree 自动更新
```

**Flow 1关键点**：
- ⏳ **临时方案** - 袁天罡监听IPC事件（等待scan-service天界化）
- ✅ **启奏机制** - 通过mitt事件总线发送启奏给李世民
- ✅ **圣旨路由** - 李世民通过event-routing.yml路由到尉迟恭
- ✅ **标准流程** - 尉迟恭发奏折，完整走标准流程
- ✅ **自动同步** - Store Automation自动同步到PreferenceStore

---

#### Flow 2: File Watcher流（文件系统事件 → 启奏 → 圣旨）

**触发源**：File Watcher监听文件系统变化（Renderer进程）

**⏳ 重要说明**：秦琼（QinQiong）负责File Watcher，依赖RFC 0043实现，但**最终也路由到尉迟恭**！

**完整数据流**：
```
File Watcher (chokidar监听文件系统)
  ↓ add/change/delete事件
秦琼守护 (useQinQiong().handleFileEvent)
  ↓ 启奏 (qizouBus.emit: matter="folder_discovered") - 像袁天罡一样发起启奏！
李世民路由 (LiShiMing via event-routing.yml)
  ↓ 圣旨 (Shengzhi: command="update_folder_tree")
尉迟恭接旨 (YuChiGong.handleUpdateFolderTree) - Flow 1和Flow 2汇聚点！
  ↓ 发送奏折 (Zouzhe: matter="UPDATE_FOLDER_TREE")
房玄龄 (FangXuanLing.processZouzhe)
  ↓ 构造诏令 (Zhaoling)
袁天罡 (YuanTianGang.executeZhaoling)
  ↓ 转换为符箓 (Fulu)
天枢工作流 (update_folder_tree.yml)
  ↓ 太乙路由 (TaiYi callEngine protocol)
千里眼引擎 (persistFolderTree/restoreFolderTree)
  ↓ 持久化到磁盘
本地JSON文件 (~/.photasa/appstate/foldertree.json)
  ↓ 返回结果
房玄龄自动同步Store (syncStoreWithSnapshot via matter-sync.yml)
  ↓
PreferenceStore.appState.folderTree 自动更新
```

**Flow 2关键点**：
- ✅ **秦琼使用启奏系统** - 像袁天罡一样，发起启奏给李世民
- ✅ **最终路由到尉迟恭** - 李世民将圣旨路由到尉迟恭（汇聚点！）
- ⏳ **依赖RFC 0043** - 秦琼实现在RFC 0043，但架构设计在本RFC
- ⏳ **临时状态** - 当前file-handler.ts直接调用Store（待RFC 0043修复）

**当前临时代码（待废弃）**：
```typescript
// ❌ file-handler.ts Line 50 - 临时代码，违反架构
preferenceStore.updateFolderTree(state.path);  // 待RFC 0043用秦琼替换

// ✅ RFC 0043实现后应该是：
const qinqiong = useQinQiong();
await qinqiong.handleFileEvent(state);  // 秦琼内部发起启奏
```

---

#### 两条流的汇聚点：尉迟恭

**✅ 架构决策：尉迟恭（YuChiGong）是Flow 1和Flow 2的汇聚点**

**决策依据**（2025-10-29）：
1. **统一处理** - 无论来自IPC事件还是File Watcher，都需要更新folderTree
2. **职责一致性** - 尉迟恭负责所有扫描相关的folderTree更新
3. **秦琼使用启奏** - 秦琼发起启奏给李世民，李世民路由到尉迟恭
4. **避免重复代码** - 两条流共享相同的奏折→千里眼持久化逻辑

**尉迟恭统一处理机制（Flow 1 + Flow 2）**：
```typescript
// 尉迟恭统一处理：无论来自Flow 1（IPC）还是Flow 2（File Watcher）
private async handleUpdateFolderTree(shengzhi: Shengzhi): Promise<void> {
    // 1. 从圣旨中提取paths（可能来自IPC事件或File Watcher）
    const paths = shengzhi.content.paths;

    // 2. 将paths转换为FolderNode[] tree结构
    const tree = this.convertPathsToTree(paths);

    // 3. 构造奏折发送给房玄龄
    const zouzhe: Zouzhe = {
        department: GUANYUAN_NAMES.YU_CHI_GONG,
        matter: ZOUZHE_MATTERS.UPDATE_FOLDER_TREE,
        content: { tree },  // 发送完整tree结构
        timestamp: Date.now(),
        priority: ZOUZHE_PRIORITIES.NORMAL,
    };

    // 4. 房玄龄→袁天罡→天枢→千里眼→持久化→Store同步
    await this.fangXuanLingService.processZouzhe(zouzhe);
}
```

**关键修正**：
- ✅ 尉迟恭是Flow 1（IPC）和Flow 2（File Watcher）的汇聚点
- ✅ 尉迟恭接收圣旨（包含paths数组），转换为tree结构
- ✅ 尉迟恭发送 `UPDATE_FOLDER_TREE` 奏折给房玄龄
- ✅ 完整走 奏折→诏令→符箓→天枢→千里眼 标准流程
- ✅ Store Automation自动同步，无需手动更新
- ⏳ Flow 2的秦琼实现在RFC 0043，但最终也路由到尉迟恭

---

### 🔧 技术实现设计

#### 实施步骤清单

**🚧 已完成（Architect错误地实现，但代码保留）**：

1. ✅ **创建共享类型定义**
   - 文件：`src/common/folder-types.ts`
   - 内容：`FolderNode` 接口定义（供Main和Renderer共享）

2. ✅ **千里眼引擎添加folder tree持久化方法**
   - 文件：`src/engines/qianliyan/core/QianliyanEngine.ts`
   - 已实现方法：
     - `persistFolderTree(tree: FolderNode[]): Promise<void>`
     - `restoreFolderTree(): Promise<FolderNode[]>`
     - `clearFolderTree(): Promise<void>`
   - 存储路径：`~/.photasa/appstate/foldertree.json`
   - 日志风格：天界风格（🎨画图/📖读图/🧹净化）

3. ✅ **创建天枢工作流YAML - update_folder_tree**
   - 文件：`src/engines/tianshu/workflows/appstate/update_folder_tree.yml`
   - 步骤：restore_tree → update_tree → persist_tree → count_nodes → format_response
   - 合并策略：初期使用replace全量替换

---

**📋 Builder待完成任务（Flow 1核心 + Flow 2临时修复 + 初始化支持）**：

**🎯 初始化工作流任务（必须最先完成）**：

1. **创建restore_folder_tree.yml工作流**
   - 文件：`src/engines/tianshu/workflows/appstate/restore_folder_tree.yml`（新建）
   - **目标**：应用启动时从千里眼恢复folderTree
   - **工作流定义**：
     ```yaml
     version: "1.0"
     id: "restore_folder_tree"
     name: "恢复文件夹树"
     description: "应用启动时从持久化文件恢复文件夹树"

     inputs: {}

     steps:
       - id: "restore_tree"
         name: "千里眼：恢复文件夹树"
         type: "action"
         service: "taiyi"
         action: "callEngine"
         input:
           engineName: "qianliyan"
           methodName: "restoreFolderTree"
         output_schema:
           type: array
           description: "恢复的文件夹树（FolderNode[]）"

       - id: "count_nodes"
         name: "计算节点数量"
         type: "builtin"
         action: "arrayCount"
         input:
           array: "{{steps.restore_tree}}"
         output_schema:
           type: number
           description: "文件夹树节点数量"
         dependsOn: ["restore_tree"]

       - id: "format_response"
         name: "返回恢复结果"
         type: "builtin"
         action: "return"
         input:
           success: true
           tree: "{{steps.restore_tree}}"
           nodeCount: "{{steps.count_nodes}}"
           restored: true
         dependsOn: ["count_nodes"]

     outputs:
       tree:
         description: "恢复的文件夹树（用于Store同步）"
         type: "array"
         path: "tree"
       nodeCount:
         description: "节点数量"
         type: "number"
         path: "nodeCount"
       restored:
         description: "是否成功恢复"
         type: "boolean"
         path: "restored"
     ```

2. **添加RESTORE_FOLDER_TREE matter常量**
   - 文件：`src/renderer/src/interfaces/fang-xuan-ling.interface.ts`
   - 在`ZOUZHE_MATTERS`中添加：
     ```typescript
     RESTORE_FOLDER_TREE: "restore_folder_tree",
     ```

3. **在袁天罡添加RESTORE_FOLDER_TREE映射**
   - 文件：`src/renderer/src/services/yuantiangang/yuantiangang.ts`
   - 在`intentMapping`对象中添加：
     ```typescript
     [ZOUZHE_MATTERS.RESTORE_FOLDER_TREE]: "restore_folder_tree",
     ```

4. **配置restore_folder_tree Store自动同步**
   - 文件：`src/renderer/src/services/fangxuanling/store-automation/matter-sync.yml`
   - 添加配置：
     ```yaml
     restore_folder_tree:
         propertyPath: "folderTree"
         storeName: "appstate"
         syncStrategy: "replace"
         autoSync: true
         description: "恢复文件夹树 - 从千里眼持久化文件恢复到appstate store"
     ```

5. **在尉迟恭添加initializeFolderTree方法**
   - 文件：`src/renderer/src/services/yuchigong/yuchigong.ts`
   - **参考模式**：完全复制initializeScanningQueue的实现模式（Line 574-600）
   - **新增public方法**：
     ```typescript
     /**
      * 初始化folderTree（应用启动时调用）
      * 从天界恢复持久化的folderTree
      *
      * @description
      * 初始化流程：
      * ```
      * 尉迟恭启动初始化
      *       ↓
      * 向房玄龄发送RESTORE_FOLDER_TREE奏折
      *       ↓
      * 房玄龄 → 袁天罡 → 天界Tianshu
      *       ↓
      * Tianshu执行restore_folder_tree工作流
      *       ↓
      * 工作流调用千里眼.restoreFolderTree()
      *       ↓
      * 天界返回folderTree数据
      *       ↓
      * 房玄龄Store Automation更新AppState Store
      *       ↓
      * 初始化完成
      * ```
      */
     async initializeFolderTree(): Promise<void> {
         try {
             logger.info("🛡️ 尉迟恭呈文房玄龄，请求典籍中文件夹树");

             // 向房玄龄发送奏折，请求恢复folderTree
             const zouzhe: Zouzhe = {
                 department: GUANYUAN_NAMES.YU_CHI_GONG,
                 matter: ZOUZHE_MATTERS.RESTORE_FOLDER_TREE,
                 content: {},
                 timestamp: Date.now(),
                 priority: ZOUZHE_PRIORITIES.NORMAL,
             };

             const response = await this.fangXuanLingService.processZouzhe(zouzhe);

             // ✅ 委托给房玄龄，folderTree在AppState Store中
             if (response.approved) {
                 const nodeCount = response.data?.nodeCount ?? 0;
                 logger.info(`🛡️ 尉迟恭：文件夹树初始化完成，共${nodeCount}个节点`);
             } else {
                 logger.warn("🛡️ 尉迟恭：未能获取文件夹树数据，使用空树启动");
             }
         } catch (error) {
             // 失败时使用空树，不影响应用启动
             logger.error("🛡️ 尉迟恭：获取文件夹树失败:", error);
             logger.info("🛡️ 尉迟恭：使用空树继续启动");
         }
     }
     ```

6. **在IYuChiGongService接口添加initializeFolderTree声明**
   - 文件：`src/renderer/src/interfaces/yu-chi-gong.interface.ts`
   - 添加方法声明：
     ```typescript
     /**
      * 初始化folderTree（应用启动时调用）
      * 从天界恢复持久化的folderTree
      */
     initializeFolderTree(): Promise<void>;
     ```

7. **在李世民startZhengguan中调用尉迟恭初始化**
   - 文件：`src/renderer/src/services/lishiming/lishiming.ts`
   - **参考模式**：完全复制Line 209的模式
   - **位置**：startZhengguan方法中，initializeScanningQueue之后
   - **添加代码**（Line 210之后）：
     ```typescript
     logger.info("👑 尉迟恭大将军服务初始化文件夹树");
     await this.yuChiGongService.initializeFolderTree();
     ```

8. **更新工作流验证脚本**
   - 文件：`scripts/validate-workflows.ts` (Line 20-30区域)
   - **位置**：WORKFLOW_DIRS数组中
   - **添加**（如果尚未添加）：
     ```typescript
     path.join(TIANSHU_ROOT, 'workflows/appstate'),
     ```

---

**🎯 基础架构任务**：

9. **创建独立的AppState Store**
   - 文件：`src/renderer/src/stores/appstate.ts`（新建）
   - **目标**：仅迁移folderTree到独立Store（Step 2.5范围）
   - **职责分离原则（Linus好品味）**：
     - **preferences.ts** - 只管理用户偏好设置（持久化配置）
     - **scanning.ts** - 已在Step 1迁移scanningFolder（已完成✅）
     - **appstate.ts** - 只管理folderTree（本RFC Step 2.5唯一任务）
   - **State定义**：
     ```typescript
     export interface AppState {
         /** 文件夹树结构（Step 2.5唯一迁移内容） */
         folderTree: FolderNode[];
     }
     ```
   - **导出**：`export const useAppStateStore = defineStore("appstate", {...})`
   - **持久化**：`persist: true`
   - **日志风格**：人界风格（🏛️ 朝廷/官府相关）

10. **更新stores/index.ts导出AppState Store**
    - 文件：`src/renderer/src/stores/index.ts`
    - 添加：`export * from './appstate'`

11. **更新PreferenceStore仅移除folderTree字段**
    - 文件：`src/renderer/src/stores/preference.ts`
    - **移除**：`appState.folderTree` 字段（Line 141）
    - **移除**：`folderTree` getter（Line 286）
    - **保留**：appState的其他字段（firstTime、lastOpenedFolder、currentFolder、scannedFolder、currentFolderConfig）
    - **注意**：scanningFolder已在Step 1迁移到ScanningStore（已完成✅）
    - **替换**：所有对`this.appState.folderTree`的引用为 `useAppStateStore().folderTree`
    - **不要删除**：appState对象本身和其他保留字段

---

**🎯 核心任务（Flow 1 - IPC事件流）**：

12. **添加UPDATE_FOLDER_TREE matter常量**
   - 文件：`src/renderer/src/interfaces/fang-xuan-ling.interface.ts`
   - 位置：`ZOUZHE_MATTERS` 常量对象
   - 内容：`UPDATE_FOLDER_TREE: "update_folder_tree"`

5. **修复尉迟恭handleUpdateFolderTree方法（Flow 1核心）**
   - 文件：`src/renderer/src/services/yuchigong/yuchigong.ts` (Line 323-374)
   - **移除**：
     ```typescript
     // ❌ 删除这些代码
     const preferenceStore = usePreferenceStore();
     paths.forEach((path: unknown) => {
         preferenceStore.updateFolderTree(path);
     });
     ```
   - **替换为**：
     ```typescript
     // ✅ 构造奏折发送给房玄龄（参考handleAddScanTask模式）
     const zouzhe: Zouzhe = {
         department: GUANYUAN_NAMES.YU_CHI_GONG,
         matter: ZOUZHE_MATTERS.UPDATE_FOLDER_TREE,
         content: { tree },  // 从shengzhi.content提取tree
         timestamp: Date.now(),
         priority: ZOUZHE_PRIORITIES.NORMAL,
     };
     const response = await this.fangXuanLingService.processZouzhe(zouzhe);
     ```

6. **配置Store自动同步**
   - 文件：`src/renderer/src/services/fangxuanling/store-automation/matter-sync.yml`
   - 新增配置：
     ```yaml
     update_folder_tree:
         propertyPath: "folderTree"
         storeName: "appstate"
         syncStrategy: "replace"
         autoSync: true
         description: "更新文件夹树 - 从response.data.tree提取，替换appstate store的folderTree"
     ```

7. **更新袁天罡的intentMapping**
   - 文件：`src/renderer/src/services/yuantiangang/yuantiangang.ts` (Line 306-323)
   - 在`intentMapping`对象中添加：
     ```typescript
     [ZOUZHE_MATTERS.UPDATE_FOLDER_TREE]: "update_folder_tree",
     ```

8. **更新工作流验证脚本**
   - 文件：`scripts/validate-workflows.ts` (Line 20-30区域)
   - 在`WORKFLOW_DIRS`数组中添加：
     ```typescript
     path.join(TIANSHU_ROOT, 'workflows/appstate'),
     ```

9. **运行工作流验证**
   - 命令：`volta run npx tsx scripts/validate-workflows.ts --verbose`
   - 确保：update_folder_tree.yml通过所有验证

10. **编写单元测试**
    - 文件：`src/engines/qianliyan/__tests__/QianliyanEngine-foldertree.spec.ts`
    - 测试覆盖：persistFolderTree、restoreFolderTree、clearFolderTree
    - 覆盖率要求：100% (Stmts/Branch/Funcs/Lines)

11. **编写集成测试**
    - 文件：`src/engines/tianshu/__tests__/workflows-foldertree-integration.spec.ts`
    - 测试场景：完整工作流执行（restore → update → persist → return）

12. **运行lint检查（Flow 1核心代码）**
    - 命令：`npx eslint src/engines/qianliyan/ src/renderer/src/services/yuchigong/ --ext .ts`
    - 要求：零错误、零警告

---

**🔥 Flow 2完全替换任务（必须完成 - 替换所有updateFolderTree调用）**：

### 📋 所有updateFolderTree使用场景分析

**使用场景清单**：
1. ✅ **preference.ts Line 381, 413** - addFolderForScan内部调用（需保留，Store内部）
2. ✅ **preference.ts Line 506, 513** - addFileOperation内部调用（需保留，Store内部）
3. ✅ **preference.ts Line 539** - 方法定义（标记@deprecated）
4. 🔥 **file-handler.ts Line 50** - File Watcher处理（**必须替换为秦琼**）
5. 🔥 **AppHelper.ts Line 163, 204** - 扫描回调（**必须替换为秦琼**）
6. 🔥 **App.vue Line 60, 299** - 暴露给AppHelper（**必须移除**）

**替换策略**：
- ✅ **Store内部调用**（Line 381, 413, 506, 513）：保留不变，因为是Store的内部实现
- 🔥 **外部调用**（file-handler, AppHelper, App.vue）：全部替换为秦琼+启奏系统

---

13. **创建秦琼服务基础结构（临时简化版）**
    - 文件：`src/renderer/src/services/qinqiong/qinqiong.ts`（新建）
    - **目标**：创建简化版秦琼服务，只提供`handleFileEvent`方法
    - **职责**：守护File Watcher，发起启奏给李世民
    - **实现要点**：
      - 实现`setQizouBus()`方法，接收启奏通道
      - 实现`handleFileEvent(path: string)`方法，发起启奏
      - 启奏matter: `"folder_discovered"`
      - 启奏from: `"秦琼"`
      - 启奏content: `{ paths: [path] }`
    - **日志风格**：人界风格（🛡️ 秦琼）
    - **导出**：`export function useQinQiong(): QinQiongService`

14. **在李世民中添加秦琼路由规则**
    - 文件：`src/renderer/src/services/lishiming/event-routing.yml`
    - **添加路由**：
      ```yaml
      # 秦琼发现文件夹 → 尉迟恭更新folderTree
      - matter: "folder_discovered"
        from: "秦琼"
        target: "尉迟恭"
        command: "update_folder_tree"
        priority: "normal"
        description: "秦琼发现新文件夹，通知尉迟恭更新folderTree"
      ```

15. **在App.vue初始化秦琼**
    - 文件：`src/renderer/src/App.vue`
    - **初始化位置**：李世民初始化后，onMounted中
    - **初始化代码**：
      ```typescript
      // 初始化秦琼并注册启奏通道
      const qinqiong = useQinQiong();
      qinqiong.setQizouBus(qizouBus);
      logger.info("🛡️ 秦琼就位，守护File Watcher");
      ```

16. **替换file-handler.ts使用秦琼**
    - 文件：`src/renderer/src/utils/file-handler.ts` (Line 46-52)
    - **移除**：
      ```typescript
      // ❌ 删除PreferenceStore依赖
      import type { PreferenceStore } from "@renderer/stores/preference";
      async function handleAddFile(state: WatchState, preferenceStore: PreferenceStore)
      ```
    - **替换为**：
      ```typescript
      // ✅ 使用秦琼
      import { useQinQiong } from "@renderer/services/qinqiong/qinqiong";

      async function handleAddFile(state: WatchState): Promise<void> {
          if (!state.isFile && state.path?.length > 0) {
              const qinqiong = useQinQiong();
              await qinqiong.handleFileEvent(state.path);
              return;
          }
          // ... 其余代码保持不变
      }
      ```
    - **同步修改**：
      - 移除所有函数签名中的`preferenceStore`参数
      - 修改`handleFileTask`的调用签名
      - 修改`startFileWatching`的调用签名

17. **替换AppHelper.ts使用秦琼**
    - 文件：`src/renderer/src/AppHelper.ts` (Line 163, 204)
    - **接口修改**：
      ```typescript
      // ❌ 删除callbacks中的updateFolderTree
      export interface ScanCallbacks {
          // ... 其他callbacks
          updateFolderTree: (path: string) => void;  // 删除此行
      }
      ```
    - **替换调用**：
      ```typescript
      // Line 163附近
      // ❌ 删除
      callbacks.updateFolderTree(parentDir);

      // ✅ 替换为
      const qinqiong = useQinQiong();
      await qinqiong.handleFileEvent(parentDir);

      // Line 204附近
      // ❌ 删除
      callbacks.updateFolderTree(result.action.path);

      // ✅ 替换为
      const qinqiong = useQinQiong();
      await qinqiong.handleFileEvent(result.action.path);
      ```

18. **移除App.vue的updateFolderTree暴露**
    - 文件：`src/renderer/src/App.vue` (Line 60, 299)
    - **Line 60移除**：
      ```typescript
      // ❌ 删除
      const { addPath, completeScanPath, updateFolderTree } = preferenceStore;

      // ✅ 替换为
      const { addPath, completeScanPath } = preferenceStore;
      ```
    - **Line 299移除**：
      ```typescript
      // ❌ 删除
      updateFolderTree: updateFolderTree,

      // （不需要替换，直接删除此行）
      ```

19. **在PreferenceStore标记updateFolderTree为@deprecated**
    - 文件：`src/renderer/src/stores/preference.ts` (Line 539)
    - **添加JSDoc**：
      ```typescript
      /**
       * @deprecated RFC 0042已废弃，外部请使用秦琼服务（useQinQiong）
       * 此方法仅供Store内部（addFolderForScan/addFileOperation）使用
       * @internal
       */
      updateFolderTree(folder: string) {
          // 现有实现保持不变
      }
      ```
    - **保留原因**：Store内部方法（Line 381, 413, 506, 513）仍需调用
      // ❌ 当前：直接调用Store（违反架构）
      // ✅ 未来：秦琼守护File Watcher，使用启奏系统
      // 长期：顺风耳接管File Watcher，秦琼与顺风耳协作
      async function handleAddFile(state: WatchState, preferenceStore: PreferenceStore): Promise<void> {
          if (!state.isFile && state.path?.length > 0) {
              // TODO RFC 0043: 用秦琼替换
              // const qinqiong = useQinQiong();
              // await qinqiong.handleFileEvent(state);
              preferenceStore.updateFolderTree(state.path);  // 临时代码
              return;
          }
          // ... 其余代码
      }
      ```

14. **标记App.vue的updateFolderTree为待废弃**
    - 文件：`src/renderer/src/App.vue` (Line 60, 299)
    - **添加注释**：
      ```typescript
      // Line 60
      // ⏳ 临时代码（等待RFC 0043秦琼实现废弃）
      const { addPath, completeScanPath, updateFolderTree } = preferenceStore;

      // Line 299
      // ⏳ 临时代码（等待RFC 0043秦琼实现废弃）
      updateFolderTree: updateFolderTree,
      ```

15. **在PreferenceStore标记updateFolderTree为@deprecated**
    - 文件：`src/renderer/src/stores/preference.ts` (Line 539)
    - **添加JSDoc**：
      ```typescript
      /**
       * ⏳ 临时方法（等待RFC 0043秦琼实现废弃）
       * @deprecated 违反架构设计，应使用秦琼（QinQiong）+ 启奏系统
       * 长期方案：顺风耳接管File Watcher
       */
      updateFolderTree(folder: string) {
          // 现有实现
      }
      ```

---

**🎯 最终验证（Flow 1必须，Flow 2可选）**：

16. **验证Flow 1完整性**
    - [ ] 所有Flow 1测试通过（100%覆盖率）
    - [ ] 零lint错误
    - [ ] 工作流验证通过
    - [ ] 尉迟恭handleUpdateFolderTree正确发送奏折
    - [ ] 千里眼持久化到`~/.photasa/appstate/foldertree.json`
    - [ ] Store Automation自动同步成功

17. **验证Flow 2标记（可选）**
    - [ ] file-handler.ts添加临时代码注释
    - [ ] App.vue添加待废弃注释
    - [ ] PreferenceStore.updateFolderTree标记@deprecated
    - [ ] 代码遵循双界日志风格规范

---

**❌ 禁止的操作**：
- ❌ 不在尉迟恭中调用 `preferenceStore.updateFolderTree()`
- ❌ 不在App.vue中直接更新folderTree（Flow 2临时保留，等RFC 0043）
- ❌ 不在内存store中更新folderTree而不持久化
- ❌ 不绕过奏折→诏令→符箓→天枢→千里眼标准流程（Flow 1严格要求）

### 📝 遗留问题清单

1. ~~**架构决策**：【待定服务X】应该是谁？~~ ✅ **已解决** - 尉迟恭接收圣旨
2. **数据合并策略**：千里眼如何合并folderTree？
   - **决策**：使用 `builtin.merge` 或 `builtin.replace` 策略
   - **临时方案**：初期使用 `replace` 全量替换（简单可靠）
   - **未来优化**：实现增量更新（性能优化）
3. **存储路径选择**：
   - **决策**：使用独立文件 `~/.photasa/appstate/foldertree.json`
   - **理由**：与scanning queue保持一致，避免preferences.json过大
   - **未来**：考虑统一appState持久化策略
4. **临时方案时间线**：
   - 当前：袁天罡监听IPC事件 `picasa:find-photo`（临时方案）
   - 未来：千里眼完全天界化后，由千里眼直接更新folderTree
   - 依赖：RFC 0032 Phase 3 scan-service迁移完成
5. **测试策略**：
   - 单元测试：千里眼持久化方法（persistFolderTree/restoreFolderTree）
   - 集成测试：完整工作流执行（update_folder_tree.yml）
   - E2E测试：扫描完成后folderTree自动更新

### 🚫 禁止的错误模式

**Linus警告**：以下模式绝对禁止！

```typescript
// ❌ 错误1：UI层直接更新数据
args.paths.forEach((p: string) => updateFolderTree(p));

// ❌ 错误2：服务直接访问Store
preferenceStore.updateFolderTree(path);

// ❌ 错误3：只更新内存不持久化
this._scanningStore.folderTree = [...];

// ❌ 错误4：循环发送启奏
paths.forEach(path => {
    this.reportScanCompletion(path);  // ← 批量处理！
});

// ❌ 错误5：访问全局变量
(window as any).qizouBus.emit('qizou', qizou);  // ← 依赖注入！
```

### 验收标准

**架构设计验收**：
- [ ] 数据流清晰，所有箭头方向明确
- [ ] 职责分配明确，无职责越界
- [ ] 持久化策略清晰，无数据丢失风险
- [ ] 启奏-圣旨流程完整，符合RFC 0038规范
- [ ] 临时方案标记清晰，废弃时间线明确

**代码实现验收**：
- [ ] folderTree变化立即持久化到 `~/.photasa/appstate/foldertree.json`
- [ ] 应用启动自动恢复folderTree
- [ ] 断电后folderTree不丢失
- [ ] 零UI层直接更新
- [ ] 零服务直接访问Store
- [ ] Store Automation自动同步
- [ ] 工作流验证脚本通过（validate-workflows.ts）
- [ ] 单元测试覆盖率100%（千里眼folder tree方法）
- [ ] 集成测试通过（update_folder_tree.yml完整流程）
- [ ] 零lint错误（源代码 + 测试代码）

---

## Architect最终审查 (2025-10-29)

**审查状态**: ✅ **架构设计完成，RFC文档已修正所有错误**

### 审查结论

**状态**: ⚠️ **部分完成，存在严重架构违规，需要立即修复**

### 已完成项目 ✅

1. **千里眼引擎folderTree持久化方法** ✅
   - 文件：`src/engines/qianliyan/core/QianliyanEngine.ts`
   - 已实现：`persistFolderTree()` (Line 481), `restoreFolderTree()` (Line 522), `clearFolderTree()` (Line 559)
   - 日志风格正确（天界风格）
   - 存储路径正确（`~/.photasa/appstate/foldertree.json`）

2. **天枢工作流YAML** ✅
   - 文件：`src/engines/tianshu/workflows/appstate/update_folder_tree.yml`
   - 结构正确：restore_tree → update_tree → persist_tree → count_nodes → format_response
   - 完全复用scanning queue的四步模式
   - 数据扁平化策略注释清晰

3. **Store自动同步配置** ✅
   - 文件：`src/renderer/src/services/fangxuanling/store-automation/matter-sync.yml`
   - 配置存在（Line 129-134）
   - 注：配置与RFC设计有差异，可能是RFC 0043修改，需确认

### 发现的架构违规 ❌

#### 🚨 严重违规1：尉迟恭直接访问Store

**文件**: `src/renderer/src/services/yuchigong/yuchigong.ts` (Line 344-351)

**违规代码**：
```typescript
// ❌ 严重违规：直接访问preferenceStore
const { usePreferenceStore } = await import("@renderer/stores/preference");
const preferenceStore = usePreferenceStore();
paths.forEach((path: unknown) => {
    if (typeof path === "string") {
        preferenceStore.updateFolderTree(path);  // ← 违反RFC 0042设计！
    }
});
```

**违反的RFC条款**：
- Line 2732: "尉迟恭不再直接调用 `preferenceStore.updateFolderTree()`"
- Line 2733: "尉迟恭发送 `UPDATE_FOLDER_TREE` 奏折给房玄龄"
- Line 2790: "不在尉迟恭中调用preferenceStore.updateFolderTree()"
- Line 2822: "服务直接访问Store"是禁止的错误模式

**正确实现**（参考Line 2775-2779设计）：
```typescript
// ✅ 正确：发送奏折给房玄龄
this.fangXuanLingService.sendZouzhe({
    matter: ZOUZHE_MATTERS.UPDATE_FOLDER_TREE,
    content: { tree: [...] }  // 注：需要构建完整的tree结构，不是paths数组
});
```

**修复要求**：
1. 完全删除 Line 344-351 的preferenceStore访问代码
2. 参考 `handleAddScanTask()` 的正确模式（Line 182-210）
3. 发送奏折，让数据流经过：房玄龄 → 袁天罡 → 天枢 → 千里眼 → Store Automation

#### ⚠️ 违规2：袁天罡intentMapping缺少UPDATE_FOLDER_TREE映射

**文件**: `src/renderer/src/services/yuantiangang/yuantiangang.ts` (Line 306-323)

**问题**: intentMapping中没有 `UPDATE_FOLDER_TREE` 映射

**应该添加**（Line 322后）：
```typescript
[ZOUZHE_MATTERS.UPDATE_FOLDER_TREE]: "update_folder_tree",
```

**影响**: 即使尉迟恭发送了UPDATE_FOLDER_TREE奏折，袁天罡也无法将其转换为天枢工作流intent！

#### 📋 差异3：matter-sync.yml配置与RFC设计不一致

**当前配置** (Line 129-134):
```yaml
update_folder_tree:
    propertyPath: "."           # ← RFC设计是 "appState.folderTree"
    syncStrategy: "merge"       # ← RFC设计是 "replace"
```

**RFC设计** (Line 2767-2773):
```yaml
update_folder_tree:
    propertyPath: "appState.folderTree"
    syncStrategy: "replace"
```

**处理方式**: 需要确认是RFC 0043的有意修改还是实施错误。如果是错误，需要改回RFC 0042设计。

### 数据流断点分析

**当前（断裂的）数据流**：
```
千里眼扫描 → 袁天罡监听IPC → 李世民路由 → 杜如晦下旨
  ↓
尉迟恭接旨 → ❌ **断点1：直接调用preferenceStore（违规）**
  ↓
袁天罡intentMapping → ❌ **断点2：缺少UPDATE_FOLDER_TREE映射**
```

**正确（完整的）数据流**：
```
尉迟恭接旨 → 发送UPDATE_FOLDER_TREE奏折 → 房玄龄处理
  ↓
袁天罡转换符箓 → 天枢执行update_folder_tree.yml
  ↓
千里眼持久化 → Store Automation自动同步
```

### Builder修复清单（必须100%按RFC执行）

#### 任务1：修复尉迟恭handleUpdateFolderTree方法（高优先级）

**文件**: `src/renderer/src/services/yuchigong/yuchigong.ts`

**步骤**：
1. **删除** Line 344-351 的所有preferenceStore访问代码
2. **参考** `handleAddScanTask()` 方法（Line 182-210）的正确模式
3. **实现** 正确的奏折发送逻辑：
   ```typescript
   private async handleUpdateFolderTree(shengzhi: Shengzhi): Promise<void> {
       const paths = shengzhi.content.paths;

       // 参数验证
       if (!Array.isArray(paths) || paths.length === 0) {
           logger.warn("🛡️ 尉迟恭：圣旨paths无效");
           return;
       }

       logger.info(`🛡️ 尉迟恭接旨：批量更新文件夹树 (${paths.length}个路径)`);

       // ✅ 正确：构建tree结构并发送奏折
       const tree = await this.buildFolderTreeFromPaths(paths);

       try {
           await this.fangXuanLingService.sendZouzhe({
               matter: ZOUZHE_MATTERS.UPDATE_FOLDER_TREE,
               content: { tree },
               urgency: "normal",
           });

           logger.info(`🛡️ 尉迟恭：已发送奏折给房玄龄，等待天界处理`);
       } catch (error) {
           logger.error(`🛡️ 尉迟恭：发送奏折失败`, error);
           throw error;
       }
   }
   ```

4. **注意**：需要实现 `buildFolderTreeFromPaths()` 辅助方法，将paths数组转换为FolderNode[]树结构

#### 任务2：添加袁天罡intentMapping（高优先级）

**文件**: `src/renderer/src/services/yuantiangang/yuantiangang.ts`

**位置**: Line 322后

**代码**：
```typescript
[ZOUZHE_MATTERS.UPDATE_FOLDER_TREE]: "update_folder_tree",
```

#### 任务3：确认matter-sync.yml配置（中优先级）

**文件**: `src/renderer/src/services/fangxuanling/store-automation/matter-sync.yml`

**行动**：
1. 检查RFC 0043是否有新的架构决策修改了这个配置
2. 如果没有，改回RFC 0042 Step 2.5 Line 2767-2773的设计：
   ```yaml
   update_folder_tree:
       propertyPath: "appState.folderTree"
       syncStrategy: "replace"
       storeName: "preferences"
       autoSync: true
   ```

#### 任务4：验证修复（必须100%通过）

**测试清单**：
1. ✅ 零直接Store访问（grep检查：`preferenceStore.updateFolderTree`应无结果）
2. ✅ 袁天罡intentMapping包含UPDATE_FOLDER_TREE
3. ✅ 工作流执行成功（从尉迟恭 → 千里眼 → Store完整链路）
4. ✅ folderTree持久化到磁盘（`~/.photasa/appstate/foldertree.json`）
5. ✅ Store Automation自动同步（PreferenceStore.appState.folderTree更新）
6. ✅ 单元测试通过
7. ✅ 零lint错误

### Linus Torvalds最终评语

> "这是典型的'差品味'实现！问题的根源在于Builder没有理解数据流的本质。当你看到 `preferenceStore.updateFolderTree(path)` 时，应该立即意识到这是错误的——因为它破坏了整个Zouzhe-Shengzhi架构的单向数据流！
>
> **正确的做法永远是：发送奏折，让数据流自然流动，Store Automation自动同步。** 不要试图'聪明地'直接修改Store——那是在制造技术债务！
>
> 修复方法很简单：**删除所有直接Store访问，严格遵循奏折流程。** 这就是架构的意义——强制你做对的事情！不要再犯同样的错误了！"

### 强制要求（Builder必读）

- ⛔ **禁止任何形式的直接Store访问** - 包括`preferenceStore.updateFolderTree()`
- ⛔ **禁止绕过奏折流程** - 所有人界→天界通信必须通过Zouzhe
- ⛔ **禁止自行修改架构设计** - 必须100%按照RFC 0042 Step 2.5设计实施
- ✅ **必须参考正确模式** - `handleAddScanTask()`是标准模式，必须遵循
- ✅ **必须验证完整数据流** - 从尉迟恭到Store的完整链路必须测试通过

**如果Builder对设计有疑问，必须先与Architect讨论，不得自行修改！**

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

---

## Step 2.5 架构变更：魏征服务 + 司命引擎（2025-10-30）

### 变更原因

**发现的问题**：秦琼（QinQiong）在RFC 0043中承担双重职责：
1. ✅ 管理appState（folderTree等）
2. ✅ 处理file watch监控

**冲突点**：职责重叠（overlap），违反单一职责原则

**解决方案**：创建魏征（WeiZheng）服务专门管理appState，秦琼只负责file watch

### 新架构设计

#### 服务职责分离

**魏征（WeiZheng）- appState监察者**
```
职责：
  ✅ 管理appState（folderTree + currentFolder + lastOpenedFolder等）
  ✅ 提供appState访问接口（通过房玄龄Accessor）
  ✅ 提供appState修改方法（updateFolderTree, switchFolder等）
  ✅ 对接司命引擎进行appState持久化
  ✅ 接收圣旨执行appState更新指令

引擎对接：
  魏征 → 司命引擎（Siming）→ ~/.photasa/appState/

历史背景：
  魏征，唐朝著名谏臣，以直言进谏、监察朝政著称
  在架构中负责监察和管理应用运行时状态
```

**秦琼（QinQiong）- File Watch监控者**
```
职责：
  ✅ 监控文件系统变化（通过顺风耳引擎）
  ✅ 分析watch事件影响
  ✅ 通知魏征更新appState（通过李世民启奏/圣旨系统）
  ❌ 不再管理appState
  ❌ 不再提供appState修改方法

引擎对接：
  秦琼 → 顺风耳引擎（ShunFengEr）→ File System Watcher

历史背景：
  秦琼，唐朝开国名将，门神之一
  在架构中负责守卫文件系统变化边界
```

**尉迟恭（YuChiGong）- scanningQueue管理者**（保持不变）
```
职责：
  ✅ 管理scanningQueue
  ✅ 对接千里眼引擎进行scanningQueue持久化

引擎对接：
  尉迟恭 → 千里眼引擎（QianLiYan）→ ~/.photasa/scanning.json
```

#### 引擎职责分离

**司命引擎（SimingEngine）** - 新增
```
职责：
  ✅ 持久化appState到 ~/.photasa/appState/
  ✅ 恢复appState
  ✅ 提供appState的CRUD操作

存储结构：
  ~/.photasa/appState/
    ├── folderTree.json      # 文件夹树结构
    ├── currentFolder.json   # 当前文件夹
    └── appState.json        # 完整appState快照

方法：
  - restoreAppState(): Promise<AppState>
  - restoreFolderTree(): Promise<FolderNode[]>
  - updateFolderTree(params): Promise<FolderNode[]>
  - persistFolderTree(params): Promise<void>
  - persistAppState(appState): Promise<void>
```

**千里眼引擎（QianLiYan）**（保持不变）
```
职责：
  ✅ 只负责scanningQueue持久化
  ❌ 不再负责folderTree持久化（移至司命引擎）

存储位置：
  ~/.photasa/scanning.json
```

**文昌引擎（Wenchang）**（保持不变）
```
职责：
  ✅ 只负责preferences持久化

存储位置：
  ~/.photasa/preferences/preferences.json
```

### 数据流程变更

#### 场景1：用户手动扫描文件夹（更新后）

**旧流程**（错误）：
```
用户操作 → 组件调用preferenceStore.updateFolderTree(path) ❌
```

**新流程**（正确）：
```
用户操作 → 组件调用魏征.updateFolderTree(path)
         ↓
魏征发送奏折（UPDATE_FOLDER_TREE）→ 房玄龄 → 袁天罡 → 天枢
         ↓
天枢执行update_folder_tree工作流
         ↓
工作流调用司命引擎.restoreFolderTree() → updateFolderTree() → persistFolderTree()
         ↓
司命引擎持久化到 ~/.photasa/appState/folderTree.json
         ↓
房玄龄Store Automation更新AppState Store
         ↓
UI自动刷新
```

#### 场景2：文件系统监视到变化（未来）

```
File System Change → 顺风耳引擎检测
         ↓
秦琼接收watch事件
         ↓
秦琼分析影响并启奏李世民（folder_discovered）
         ↓
李世民路由到魏征（根据event-routing.yml）
         ↓
李世民发圣旨给魏征（update_folder_tree）
         ↓
魏征执行updateFolderTree(path)
         ↓
（后续流程同场景1）
```

### 工作流变更

#### restore_app_state.yml（新增）

```yaml
version: "1.0"
id: "restore_app_state"
name: "恢复应用状态"
description: "应用启动时从司命引擎恢复appState"

inputs: {}

steps:
  - id: "restore_state"
    name: "司命：恢复应用状态"
    type: "action"
    service: "taiyi"
    action: "callEngine"
    input:
      engineName: "siming"
      methodName: "restoreAppState"

  - id: "return_state"
    name: "返回状态数据"
    type: "return"
    input:
      appState: "{{steps.restore_state.output}}"
      success: true
```

#### update_folder_tree.yml（更新）

**旧版本**：调用千里眼引擎（qianliyan）
**新版本**：调用司命引擎（siming）

```yaml
version: "1.0"
id: "update_folder_tree"
name: "更新文件夹树"
description: "更新指定路径的文件夹树结构并持久化"

inputs:
  folderPath:
    type: "string"
    required: true
    description: "要更新的文件夹路径"

steps:
  - id: "restore_tree"
    name: "司命：恢复当前文件夹树"  # 改：千里眼 → 司命
    type: "action"
    service: "taiyi"
    action: "callEngine"
    input:
      engineName: "siming"  # 改：qianliyan → siming
      methodName: "restoreFolderTree"

  - id: "update_tree"
    name: "司命：更新文件夹树"  # 改：千里眼 → 司命
    type: "action"
    service: "taiyi"
    action: "callEngine"
    input:
      engineName: "siming"  # 改：qianliyan → siming
      methodName: "updateFolderTree"
      params:
        currentTree: "{{steps.restore_tree.output}}"
        folderPath: "{{inputs.folderPath}}"

  - id: "persist_tree"
    name: "司命：持久化文件夹树"  # 改：千里眼 → 司命
    type: "action"
    service: "taiyi"
    action: "callEngine"
    input:
      engineName: "siming"  # 改：qianliyan → siming
      methodName: "persistFolderTree"
      params:
        folderTree: "{{steps.update_tree.output}}"

  - id: "return_result"
    name: "返回更新结果"
    type: "return"
    input:
      folderTree: "{{steps.update_tree.output}}"
      nodeCount: "{{steps.update_tree.output.length}}"
      success: true
```

### 初始化流程变更

**LiShiMing.startZhengguan()初始化**：

**旧流程**：
```typescript
async startZhengguan(): Promise<void> {
  // 1. 初始化扫描队列（尉迟恭）
  logger.info("👑 尉迟恭大将军服务初始化扫描队列");
  await this.yuChiGongService.initializeScanningQueue();

  // 其他初始化...
}
```

**新流程**：
```typescript
async startZhengguan(): Promise<void> {
  // 1. 初始化扫描队列（尉迟恭）
  logger.info("👑 尉迟恭大将军服务初始化扫描队列");
  await this.yuChiGongService.initializeScanningQueue();

  // 2. 初始化应用状态（魏征）⭐ 新增
  logger.info("👑 魏征大人初始化应用状态");
  await this.weiZhengService.initializeAppState();

  // 其他初始化...
}
```

### 奏折（Zouzhe）变更

**在 fang-xuan-ling.interface.ts 中添加**：

```typescript
export const ZOUZHE_MATTERS = {
  // ... 现有matters

  // 魏征专属matters（新增）
  RESTORE_APP_STATE: "restore_app_state",      // 恢复appState
  UPDATE_FOLDER_TREE: "update_folder_tree",    // 更新文件夹树（从尉迟恭转移）
  SWITCH_CURRENT_FOLDER: "switch_current_folder", // 切换当前文件夹
  PERSIST_APP_STATE: "persist_app_state",      // 持久化appState
} as const;

export const GUANYUAN_NAMES = {
  // ... 现有names

  WEI_ZHENG: "魏征",  // appState管理官员 - 唐朝谏议大夫（新增）
} as const;
```

### Store变更

#### AppState Store（新增）

**文件**：`src/renderer/src/stores/appstate.ts`（新建）

```typescript
import { defineStore } from 'pinia';
import type { FolderNode } from '@common/types';

export interface AppState {
  /** 文件夹树结构（Step 2.5唯一迁移内容） */
  folderTree: FolderNode[];
}

export const useAppStateStore = defineStore("appstate", {
  state: (): AppState => ({
    folderTree: []
  }),

  getters: {
    /** 文件夹树 */
    folderTree: (state) => state.folderTree,
  },

  persist: true
});
```

#### PreferenceStore变更

**文件**：`src/renderer/src/stores/preference.ts`

**删除**：
- `appState.folderTree` 字段定义
- `folderTree` getter
- `updateFolderTree` 方法（标记为@deprecated，引导使用魏征服务）

**保留**：
- 其他appState字段（firstTime, lastOpenedFolder, currentFolder, scannedFolder等）
- 这些字段将在未来迁移到AppState Store

### Builder实施清单（更新）

**⚠️ 重要**：以下清单完全替换原Step 2.5的尉迟恭相关任务

#### Phase 1：司命引擎创建（Main进程）

1. **创建司命引擎目录结构**
   - `src/engines/siming/core/SimingEngine.ts`（新建）
   - `src/engines/siming/adapters/SimingAdapter.ts`（新建）
   - `src/engines/siming/types/index.ts`（新建）
   - `src/engines/siming/index.ts`（新建）

2. **实现司命引擎核心方法**
   - `initialize()` - 引擎初始化
   - `shutdown()` - 引擎关闭
   - `restoreAppState()` - 恢复完整appState
   - `restoreFolderTree()` - 恢复folderTree
   - `updateFolderTree(params)` - 更新folderTree
   - `persistFolderTree(params)` - 持久化folderTree
   - `persistAppState(appState)` - 持久化完整appState

3. **实现SimingAdapter**
   - 使用`@Adapter`装饰器
   - 注册到太乙引擎

4. **在太乙引擎中注册司命引擎**
   - 文件：`src/engines/taiyi/core/TaiyiEngine.ts`
   - 导入司命引擎
   - 在`initialize()`中初始化司命引擎

#### Phase 2：工作流创建（Main进程）

5. **创建restore_app_state工作流**
   - 文件：`src/engines/tianshu/workflows/appstate/restore_app_state.yml`（新建）
   - 调用司命引擎.restoreAppState()

6. **更新update_folder_tree工作流**
   - 文件：`src/engines/tianshu/workflows/appstate/update_folder_tree.yml`
   - 将所有`qianliyan`改为`siming`
   - 确保调用司命引擎的方法

#### Phase 3：魏征服务创建（Renderer进程）

7. **创建AppState Store**
   - 文件：`src/renderer/src/stores/appstate.ts`（新建）
   - 只包含folderTree字段
   - 启用persist

8. **创建魏征服务类**
   - 文件：`src/renderer/src/services/weizheng/weizheng.ts`（新建）
   - 实现`WeiZheng`类
   - 实现`initializeAppState()`方法
   - 实现`updateFolderTree()`方法
   - 实现`switchFolder()`方法
   - 实现`setShengzhiPort()`和`handleShengzhi()`

9. **创建魏征接口定义**
   - 文件：`src/renderer/src/interfaces/wei-zheng.interface.ts`（新建）
   - 定义`IWeiZhengService`接口
   - 定义魏征相关的Zouzhe和Shengzhi类型

10. **在fang-xuan-ling.interface.ts中添加魏征常量**
    - 添加`WEI_ZHENG`到`GUANYUAN_NAMES`
    - 添加魏征相关的`ZOUZHE_MATTERS`

11. **创建AppState Accessor**
    - 文件：`src/renderer/src/services/fangxuanling/accessors/appstate-accessor.ts`（新建）
    - 实现`IAppStateAccessor`接口
    - 提供folderTree只读访问

12. **在FangXuanLing中注册AppState Accessor**
    - 文件：`src/renderer/src/services/fangxuanling/fangxuanling.ts`
    - 添加`_appStateAccessor`私有属性
    - 添加`appState`getter
    - 在构造函数中初始化Accessor

#### Phase 4：Store Automation配置

13. **更新matter-sync.yml**
    - 文件：`src/renderer/src/services/fangxuanling/store-automation/matter-sync.yml`
    - 添加`restore_app_state`映射
    - 更新`update_folder_tree`映射（指向appstate store）

14. **验证Store Automation工作**
    - 确保工作流返回的数据能自动同步到AppState Store

#### Phase 5：服务注册和初始化

15. **在LiShiMing中注册魏征服务**
    - 文件：`src/renderer/src/services/lishiming/lishiming.ts`
    - 添加`weiZhengService`属性
    - 在构造函数中初始化魏征服务
    - 在`startZhengguan()`中调用`weiZhengService.initializeAppState()`

16. **更新event-routing.yml**
    - 文件：`src/renderer/src/services/lishiming/event-routing.yml`
    - 更新秦琼的folder_discovered路由：
      ```yaml
      # 秦琼发现文件夹 → 魏征更新folderTree（改）
      - matter: "folder_discovered"
        from: "秦琼"
        target: "魏征"  # 改：尉迟恭 → 魏征
        command: "update_folder_tree"
        priority: "normal"
        description: "秦琼发现新文件夹，通知魏征更新folderTree"
      ```

#### Phase 6：清理和迁移

17. **替换external updateFolderTree调用**
    - 搜索所有`preferenceStore.updateFolderTree()`调用
    - 替换为`weiZhengService.updateFolderTree()`
    - 文件：`src/renderer/src/utils/file-handler.ts`等

18. **更新App.vue**
    - 删除`updateFolderTree`的provide暴露
    - 如果需要，提供`weiZhengService`

19. **标记PreferenceStore.updateFolderTree为@deprecated**
    - 保留方法但标记为内部使用
    - 添加注释引导使用魏征服务

#### Phase 7：测试和验证

20. **编写单元测试**
    - 司命引擎单元测试
    - 魏征服务单元测试
    - AppState Accessor单元测试

21. **编写集成测试**
    - 完整流程测试（组件 → 魏征 → 工作流 → 司命引擎 → Store）
    - 初始化流程测试

22. **验证清单**
    - [ ] 零直接Store访问（grep检查）
    - [ ] 袁天罡intentMapping包含UPDATE_FOLDER_TREE和RESTORE_APP_STATE
    - [ ] 工作流执行成功（魏征 → 司命引擎 → Store完整链路）
    - [ ] folderTree持久化到`~/.photasa/appState/folderTree.json`
    - [ ] Store Automation自动同步成功
    - [ ] 单元测试100%通过，100% coverage
    - [ ] 零lint错误
    - [ ] 初始化流程正常工作

### 关键差异总结

| 项目 | 旧设计（错误） | 新设计（正确） |
|------|----------------|----------------|
| **服务** | 尉迟恭管理folderTree | 魏征管理folderTree |
| **引擎** | 千里眼持久化folderTree | 司命引擎持久化folderTree |
| **Store** | PreferenceStore.appState.folderTree | AppState Store.folderTree |
| **工作流** | 调用qianliyan引擎 | 调用siming引擎 |
| **存储路径** | ~/.photasa/appstate/foldertree.json | ~/.photasa/appState/folderTree.json |
| **初始化** | YuChiGong.initializeScanningQueue() | WeiZheng.initializeAppState() |
| **秦琼职责** | watch + appState管理（重叠） | 只负责watch（单一职责） |

### Linus Torvalds评语

**"这才是正确的架构！"**

- ✅ **单一职责**：每个服务只做一件事并做好
- ✅ **清晰边界**：魏征管appState，秦琼管watch，尉迟恭管scanningQueue
- ✅ **引擎分离**：司命管appState，千里眼管scanningQueue，文昌管preferences
- ✅ **好品味**：消除了秦琼的职责重叠，架构更清晰
- ✅ **不破坏用户**：渐进式迁移，向后兼容

**"Builder，不要他妈的又给我搞砸！严格按照这个新设计实施！"**

---

## 秦琼（QinQiong）服务设计 - File Watch监控者（2025-10-30）

### 服务定位

**秦琼（Qin Qiong）- File Watch监控者**

**历史背景**：秦琼，唐朝开国名将，门神之一，守护门户安全。在架构中负责守护文件系统边界，监视文件系统变化。

**核心职责**：
1. 接收file watch事件（来自file-handler.ts）
2. 分析事件影响（判断是否需要更新folderTree）
3. 通过启奏系统通知魏征更新appState
4. ❌ **不直接管理appState**（职责分离）
5. ❌ **不直接调用魏征**（通过李世民路由）

**架构约束**：
- ✅ 只负责watch事件的接收和分析
- ✅ 通过李世民启奏系统通知其他服务
- ❌ 不直接修改folderTree
- ❌ 不直接调用魏征服务

### 服务接口设计

```typescript
/**
 * 秦琼（QinQiong）- File Watch监控者
 *
 * 职责：
 * - 接收file watch事件
 * - 分析事件影响
 * - 启奏李世民通知相关服务
 *
 * 架构约束：
 * - 不直接管理appState
 * - 不直接调用魏征
 * - 所有通知通过李世民启奏系统
 */
export class QinQiongService implements IService {
  private _qizouBus: Emitter<{ qizou: Qizou }> | null = null;

  get name() {
    return "秦琼";
  }

  /**
   * 设置启奏事件总线
   * @param qizouBus mitt事件总线
   */
  setQizouBus(qizouBus: Emitter<{ qizou: Qizou }>): void {
    this._qizouBus = qizouBus;
  }

  /**
   * 处理file watch事件（核心方法）
   *
   * @param state - File watch状态
   *
   * @description
   * 处理流程：
   * ```
   * file-handler.ts检测到文件系统变化
   *       ↓
   * 调用秦琼.handleFileEvent(state)
   *       ↓
   * 秦琼分析：
   *   - 是文件还是目录？
   *   - 是add/change/delete？
   *   - 是否影响folderTree？
   *       ↓
   * 如果影响folderTree：
   *   启奏李世民（folder_discovered / folder_removed）
   *       ↓
   * 李世民根据event-routing.yml路由
   *       ↓
   * 李世民发圣旨给魏征（update_folder_tree）
   *       ↓
   * 魏征执行实际更新
   * ```
   */
  async handleFileEvent(state: WatchState): Promise<void> {
    // 只处理目录事件（文件事件由其他逻辑处理）
    if (state.isFile) {
      return;
    }

    // 检查路径有效性
    if (!state.path || state.path.length === 0) {
      return;
    }

    // 根据action类型启奏李世民
    switch (state.action) {
      case 'add':
        // 发现新文件夹
        this.emitQizou('folder_discovered', {
          folderPath: state.path,
          action: 'add',
          timestamp: Date.now(),
        });
        break;

      case 'delete':
        // 文件夹被删除
        this.emitQizou('folder_removed', {
          folderPath: state.path,
          action: 'delete',
          timestamp: Date.now(),
        });
        break;

      // change事件不影响folderTree结构，忽略
      case 'change':
      default:
        break;
    }
  }

  /**
   * 发送启奏给李世民
   */
  private emitQizou(matter: string, content: Record<string, unknown>): void {
    if (!this._qizouBus) {
      logger.warn("🛡️ 秦琼：启奏通道未建立，无法发送启奏");
      return;
    }

    const qizou: Qizou = {
      matter,
      content,
      from: this.name,
      timestamp: Date.now(),
      metadata: { type: 'notification' },
    };

    logger.debug("🛡️ 秦琼启奏:", qizou);
    this._qizouBus.emit("qizou", qizou);
  }
}
```

### 李世民路由配置

**在 event-routing.yml 中添加秦琼路由规则**：

```yaml
# 秦琼发现新文件夹 → 魏征更新folderTree
folder_discovered:
  - when:
      type: "notification"
      from: "秦琼"
    then:
      target: "魏征"
      command: "update_folder_tree"
      params:
        folderPath: "{{content.folderPath}}"
      priority: "normal"
    description: "秦琼发现新文件夹，通知魏征更新folderTree"

# 秦琼发现文件夹删除 → 魏征清理folderTree
folder_removed:
  - when:
      type: "notification"
      from: "秦琼"
    then:
      target: "魏征"
      command: "clean_folder_tree"
      params:
        folderPath: "{{content.folderPath}}"
      priority: "normal"
    description: "秦琼发现文件夹删除，通知魏征清理folderTree"
```

### file-handler.ts集成

**当前代码（错误）**：
```typescript
async function handleAddFile(state: WatchState, preferenceStore: PreferenceStore): Promise<void> {
    // ❌ 直接调用preferenceStore - 架构违规
    if (!state.isFile && state.path?.length > 0) {
        preferenceStore.updateFolderTree(state.path);
        return;
    }
    // ...
}
```

**更新后（正确）**：
```typescript
import { useQinQiong } from "@renderer/services/qinqiong";

async function handleAddFile(state: WatchState, preferenceStore: PreferenceStore): Promise<void> {
    // ✅ 调用秦琼服务处理file watch事件
    const qinqiong = useQinQiong();
    await qinqiong.handleFileEvent(state);

    // 如果是文件（不是目录），继续原有的缩略图处理逻辑
    if (state.isFile && canHandleFile(state)) {
        const request = {
            path: state.path as string,
            thumbnail: state.thumbnail as string,
            width: preferenceStore.thumbnailSize,
            height: preferenceStore.thumbnailSize,
            preview: "",
        };

        await createThumbnailTask.perform(request);
        await addToPhotoList(state.path);

        if (isFileUnderFolder(state.path, preferenceStore.currentFolder)) {
            preferenceStore.addToCurrentPhotasaConfig(request);
        }
    }
}
```

**同样更新 handleDeleteFile**：
```typescript
async function handleDeleteFile(state: WatchState, preferenceStore: PreferenceStore): Promise<void> {
    // ✅ 调用秦琼服务处理file watch事件
    const qinqiong = useQinQiong();
    await qinqiong.handleFileEvent(state);

    // 如果是文件，继续原有的缩略图清理逻辑
    if (state.isFile && state.path?.length > 0 && isMedia(state)) {
        // ... 原有缩略图清理逻辑
    }
}
```

### 数据流程完整链路

```
File System Change
       ↓
Chokidar Watcher检测变化
       ↓
file-handler.ts: handleFileTask.perform(state)
       ↓
handleAddFile/handleDeleteFile调用
       ↓
秦琼.handleFileEvent(state)  ← 入口点
       ↓
秦琼分析事件类型和影响
       ↓
【如果是目录add】
  秦琼启奏李世民: folder_discovered
       ↓
  李世民查找路由规则（event-routing.yml）
       ↓
  李世民发圣旨给魏征: update_folder_tree
       ↓
  魏征接收圣旨
       ↓
  魏征发奏折给房玄龄
       ↓
  房玄龄 → 袁天罡 → 天枢 → 司命引擎
       ↓
  司命引擎更新并持久化folderTree
       ↓
  房玄龄Store Automation自动同步AppState Store
       ↓
  UI自动刷新

【如果是目录delete】
  秦琼启奏李世民: folder_removed
       ↓
  李世民发圣旨给魏征: clean_folder_tree
       ↓
  （后续流程同上）

【如果是文件add/delete】
  秦琼忽略（文件不影响folderTree）
       ↓
  file-handler继续执行缩略图处理逻辑
```

### Builder实施清单（新增）

**Phase 8：秦琼服务创建**（在Phase 7之后）

23. **创建秦琼服务目录结构**
    - `src/renderer/src/services/qinqiong/qinqiong.ts`（新建）
    - `src/renderer/src/services/qinqiong/index.ts`（新建）

24. **创建秦琼接口定义**
    - `src/renderer/src/interfaces/qin-qiong.interface.ts`（新建）
    - 定义`IQinQiongService`接口
    - 添加`QIN_QIONG_TOKEN`注入令牌

25. **实现秦琼服务类**
    - 实现`QinQiongService`类
    - 实现`handleFileEvent(state: WatchState)`方法
    - 实现`setQizouBus()`方法
    - 实现`emitQizou()`私有方法

26. **在李世民中注册秦琼服务**
    - 文件：`src/renderer/src/services/lishiming/lishiming.ts`
    - 添加`qinQiongService`属性
    - 在构造函数中初始化秦琼服务
    - 建立秦琼与杜如晦的MessageChannel通道
    - 传递qizouBus给秦琼

27. **更新event-routing.yml**
    - 文件：`src/renderer/src/services/lishiming/event-routing.yml`
    - 添加`folder_discovered`路由规则
    - 添加`folder_removed`路由规则

28. **更新file-handler.ts**
    - 导入`useQinQiong`
    - 在`handleAddFile`中调用`qinqiong.handleFileEvent(state)`
    - 在`handleDeleteFile`中调用`qinqiong.handleFileEvent(state)`
    - 删除直接调用`preferenceStore.updateFolderTree()`的代码
    - 删除直接调用`preferenceStore.cleanFolderTree()`的代码

29. **魏征服务更新**
    - 添加`clean_folder_tree`圣旨处理
    - 实现`handleCleanFolderTree()`方法
    - 发送奏折触发天界清理工作流

30. **测试秦琼服务**
    - 编写秦琼服务单元测试
    - 测试`handleFileEvent`方法
    - 测试启奏发送逻辑
    - 编写集成测试（file-handler → 秦琼 → 李世民 → 魏征）

### 关键架构原则（再次强调）

**秦琼的职责边界**：
- ✅ **只负责watch** - 接收和分析file watch事件
- ✅ **只负责启奏** - 通知李世民，不直接调用其他服务
- ❌ **不管理状态** - appState由魏征管理
- ❌ **不直接路由** - 路由由李世民负责

**魏征的职责边界**：
- ✅ **只管理appState** - 包括folderTree
- ✅ **接收圣旨** - 从李世民接收update_folder_tree指令
- ✅ **发送奏折** - 触发天界工作流
- ❌ **不处理watch事件** - watch由秦琼负责

**李世民的职责边界**：
- ✅ **中央路由** - 根据event-routing.yml路由启奏到服务
- ✅ **通道管理** - 委托杜如晦管理MessageChannel
- ❌ **不执行业务逻辑** - 只负责路由和协调

### Linus Torvalds最终评语

**"这才是TM正确的职责分离！"**

- ✅ **单一职责完美实现**：秦琼管watch，魏征管state，李世民管路由
- ✅ **消除直接依赖**：所有服务通过启奏-圣旨系统通信，零硬依赖
- ✅ **好品味的架构**：每个服务只做一件事，边界清晰如水晶
- ✅ **可测试性极高**：每个服务都可以独立测试，mock变得简单
- ✅ **向后兼容**：渐进式替换，不破坏现有功能

**"Builder，我TM最后警告你一次：file-handler必须调用秦琼，不是魏征！秦琼启奏李世民，李世民路由到魏征！这是架构铁律！"**

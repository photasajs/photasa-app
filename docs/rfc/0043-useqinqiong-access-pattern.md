# RFC 0043: useQinQiong() 访问模式 - appState统一访问

- **RFC编号**: 0043
- **标题**: useQinQiong() 访问模式 - appState统一访问
- **作者**: AI Architect (Agent 1)
- **开始日期**: 2025-10-16
- **状态**: 📋 Draft - 规划中
- **最后更新**: 2025-10-16
- **类型**: 架构优化
- **目标版本**: v2.0.0
- **依赖RFC**:
  - RFC 0038: 偏好设置工作流集成与Store边界统一（已完成）✅
  - RFC 0042: scanningFolder四步渐进式迁移（进行中）
- **相关RFC**:
  - RFC 0032: 千里眼扫描引擎

---

## 摘要

本RFC提出使用`useQinQiong()`组合式函数作为appState的统一访问入口，并引入**司命引擎**作为天界的appState持久化管理者。

**核心目标**：
1. **统一访问模式** - 所有appState访问通过useQinQiong()
2. **类型安全** - 提供完整的TypeScript类型支持
3. **响应式封装** - 自动处理响应式和计算属性
4. **易于重构** - 未来appState变更只需修改一处
5. **天界持久化** - 司命引擎管理appState的持久化存储（`~/.photasa/appState/`）

**架构分层**：
```
人界（Renderer）: 秦琼守护 → useQinQiong() 统一访问接口
                                    ↓
天界（Main）: 司命引擎 → SimingEngine 管理 appState 持久化
```

**命名由来**：
- **秦琼（Qin Qiong）** - 唐朝开国名将，门神之一，**人界守护者**
  - **职责** - 守护appState访问边界，确保组件正确使用应用状态
- **司命（Siming）** - 道教神祇，主管生命寿算，**天界管理者**
  - **职责** - 管理appState的持久化存储，确保应用状态的生命周期管理

---

## 背景

### 当前架构问题

**问题1: 组件直接访问PreferenceStore**
```typescript
// ❌ 当前：组件中到处都是
import { usePreferenceStore } from "@renderer/stores/preference";

const preferenceStore = usePreferenceStore();
const { currentFolder, scanningFolder, folderTree } = storeToRefs(preferenceStore);
```

**问题2: appState访问模式不统一**
```typescript
// ❌ 有的用storeToRefs
const { currentFolder } = storeToRefs(preferenceStore);

// ❌ 有的直接访问
const folder = preferenceStore.currentFolder;

// ❌ 有的通过computed
const folder = computed(() => preferenceStore.currentFolder);
```

**问题3: 未来重构困难**
- scanningFolder即将从PreferenceStore移除（RFC 0042）
- 每个使用scanningFolder的组件都需要修改
- 无法统一控制appState访问逻辑

**问题4: 类型不明确**
```typescript
// ❌ appState的具体类型在组件中不可见
const state = preferenceStore.appState;  // 类型：any | AppState
```

### RFC 0042的影响

RFC 0042将scanningFolder从PreferenceStore.appState移除，移到专用的ScanningStore。这意味着：

1. **破坏性变更**：所有使用`preferenceStore.scanningFolder`的组件都会失效
2. **重构难度**：需要逐个修改每个组件的导入和引用
3. **维护成本**：未来其他appState字段的迁移会遇到同样的问题

**解决方案**：引入useQinQiong()作为统一访问层，隔离Store的变化。

---

## 设计方案

### 核心架构

```
┌─────────────────────────────────────────────────────────────┐
│ 人界（Renderer进程）                                         │
│                                                               │
│  组件层                                                       │
│    ↓ useQinQiong()                                          │
│  统一访问层（秦琼守护）                                      │
│    ↓ 内部路由                                                │
│  PreferenceStore.appState / ScanningStore / 其他Store       │
│    ↓ 奏折系统（FangXuanLing）                               │
└────────────────────────────────────────────────────────────┘
                              ↓ IPC
┌─────────────────────────────────────────────────────────────┐
│ 天界（Main进程）                                             │
│                                                               │
│  天枢（Tianshu）工作流编排                                  │
│    ↓ 太乙（Taiyi）适配器注册中心                           │
│  司命引擎（SimingEngine）                                   │
│    - appState持久化管理                                      │
│    - 存储位置：~/.photasa/appState/                         │
│    - 窗口状态、会话状态、应用级状态                         │
└─────────────────────────────────────────────────────────────┘
```

### 双界协作模式

**人界（秦琼守护）**：
- 组件通过 `useQinQiong()` 统一访问 appState（只读）
- 秦琼负责路由到不同的 Store（PreferenceStore、ScanningStore等）
- **所有修改必须通过圣旨系统（杜如晦 + 李世民）**，不能直接修改 Store

**天界（司命管理）**：
- 司命引擎负责 appState 的持久化存储
- 管理 `~/.photasa/appState/` 目录下的所有应用状态
- 通过太乙适配器注册中心暴露能力给天枢
- 确保应用重启后状态可恢复

### 关键设计原则

**1. 人界只读访问**：
- `useQinQiong()` 提供的所有状态都是 `ComputedRef`（只读）
- 组件不能直接修改 appState
- 所有修改必须通过圣旨系统

**2. 修改通过圣旨系统**：
```typescript
// ❌ 错误：直接修改
const appState = useQinQiong();
appState.currentFolder.value = "/new/path";  // 不允许！

// ✅ 正确：通过圣旨系统
import { useLishiming } from "@renderer/services/lishimin";

const lishiming = useLishiming();
lishiming.qizou({
  matter: "update_folder_tree",
  data: { newFolder: "/new/path" }
});
```

**3. 天界/人界职责分离**：
- **天界**：持久化存储、数据真值来源
- **人界**：UI 状态镜像、用户交互
- **禁止跨界**：人界不能直接操作天界数据，必须通过圣旨系统

### 房玄龄 IAppStateAccessor 访问器（Accessor 模式）

遵循 [Accessor + Builder 模式](../architecture/accessor-builder-pattern.md)，秦琼不直接访问 Store，而是通过房玄龄的 `IAppStateAccessor` 访问器获取数据。

#### 接口定义

```typescript
// src/renderer/src/services/fangxuanling/accessors/appstate-accessor.ts

import type { DataNode, PhotasaConfig } from "@common/types";
import type { ScanAction } from "@common/scan-types";

/**
 * 应用状态访问器接口（房玄龄提供）
 *
 * ⚠️ Accessor模式：只读访问，所有属性都是readonly
 * ⚠️ 只包含 appState，不包含扫描队列（扫描队列由尉迟恭管理）
 * 修改必须通过Zouzhe系统：fangxuanling.processZouzhe()
 *
 * @see docs/architecture/accessor-builder-pattern.md
 * @see docs/rfc/0042-scanning-folder-migration.md
 */
export interface IAppStateAccessor {
  // 基础状态（来自 PreferenceStore.appState）
  readonly firstTime: boolean;
  readonly lastOpenedFolder: string;
  readonly currentFolder: string;
  readonly scannedFolder: string;
  readonly currentFolderConfig: PhotasaConfig | null;
  readonly folderTree: DataNode[];

  // 计算属性
  readonly hasScannedFolders: boolean;
}
```

#### 实现类

```typescript
/**
 * 应用状态访问器实现
 * 遵循 Accessor 模式：防御式编程 + 返回副本
 *
 * ⚠️ 只管理 appState，不包含扫描队列（扫描队列由尉迟恭的 ScanningAccessor 管理）
 */
export class AppStateAccessor implements IAppStateAccessor {
  constructor(private readonly preferenceStore: PreferenceStore | null) {}

  // 基础状态（来自 PreferenceStore.appState）
  get firstTime(): boolean {
    if (!this.preferenceStore) {
      logger.error("🏛️ 房玄龄：PreferenceStore未初始化");
      return true;  // 默认为首次运行
    }
    return this.preferenceStore.appState.firstTime;
  }

  get lastOpenedFolder(): string {
    if (!this.preferenceStore) return "";
    return this.preferenceStore.appState.lastOpenedFolder;
  }

  get currentFolder(): string {
    if (!this.preferenceStore) return "";
    return this.preferenceStore.appState.currentFolder;
  }

  get scannedFolder(): string {
    if (!this.preferenceStore) return "";
    return this.preferenceStore.appState.scannedFolder;
  }

  get currentFolderConfig(): PhotasaConfig | null {
    if (!this.preferenceStore) return null;
    return this.preferenceStore.appState.currentFolderConfig;
  }

  // ✅ 关键：返回副本！防止外部修改
  get folderTree(): DataNode[] {
    if (!this.preferenceStore) return [];
    return JSON.parse(JSON.stringify(this.preferenceStore.appState.folderTree));
  }

  // 计算属性
  get hasScannedFolders(): boolean {
    return this.folderTree.length > 0;
  }
}
```

#### 集成到房玄龄

```typescript
// src/renderer/src/services/fangxuanling/fangxuanling.ts

import { AppStateAccessor, type IAppStateAccessor } from "./accessors/appstate-accessor";
import { ScanningAccessor, type IScanningAccessor } from "./accessors/scanning-accessor";
import { usePreferenceStore } from "@renderer/stores/preference";
import { useScanningStore } from "./scanning-store";

export class FangXuanLingService {
  private _appStateAccessor: IAppStateAccessor;
  private _scanningAccessor: IScanningAccessor;

  constructor() {
    // ✅ 房玄龄管理所有 Store
    const preferenceStore = usePreferenceStore();
    const scanningStore = useScanningStore();

    // 初始化 AppState Accessor（只包含 appState）
    this._appStateAccessor = new AppStateAccessor(preferenceStore);
    logger.info("📋 房玄龄：AppState访问器已就绪");

    // 初始化 Scanning Accessor（只包含扫描队列）
    this._scanningAccessor = new ScanningAccessor(scanningStore);
    logger.info("📋 房玄龄：Scanning访问器已就绪");
  }

  /**
   * 应用状态访问器（只读）
   * 秦琼通过此访问器获取 appState
   */
  get appState(): IAppStateAccessor {
    return this._appStateAccessor;
  }

  /**
   * 扫描队列访问器（只读）
   * 尉迟恭通过此访问器获取扫描队列
   */
  get scanning(): IScanningAccessor {
    return this._scanningAccessor;
  }
}
```

**架构原则**（遵循 RFC 0038 + Accessor 模式）：
- **房玄龄**：唯一可以访问 Store 的服务
- **秦琼**：通过 `fangxuanling.appState` 访问器获取 appState 数据（只读）
- **尉迟恭**：通过 `fangxuanling.scanning` 访问器获取扫描队列数据（只读）
- **修改流程**：秦琼 → `fangxuanling.processZouzhe()` → 房玄龄更新 Store → 袁天罡 → 天枢 → 司命引擎

**职责分离**：
- `IAppStateAccessor` - 只管理 appState（秦琼使用）
- `IScanningAccessor` - 只管理扫描队列（尉迟恭使用，RFC 0042）
- `IPreference` - 只管理偏好设置（褚遂良使用，RFC 0038）

### currentFolderConfig 的司簿工作流支持

`IAppStateAccessor` 中的 `currentFolderConfig` 字段来自司簿引擎读取当前文件夹的 `.photasa.json` 配置文件。

#### 工作流定义

需要创建天枢工作流 `get_folder_config.yml`:

```yaml
# src/engines/tianshu/workflows/folder/get_folder_config.yml

id: "get_folder_config"
name: "获取文件夹配置"
description: "从司簿引擎读取指定文件夹的.photasa.json配置"
version: "1.0.0"
author: "Tianshu Engine"

# 触发条件
triggers:
  - intent: "get_folder_config"
  - intent: "folder_config_read"

# 输入参数
inputs:
  folder_path:
    type: "string"
    required: true
    description: "文件夹路径"

# 工作流步骤
steps:
  - id: "read_config"
    name: "司簿读取文件夹配置"
    type: "action"
    description: "调用司簿引擎读取.photasa.json"
    service: "taiyi"
    action: "callEngine"
    input:
      engineName: "sibu"
      methodName: "readFolderConfig"
      params:
        - "{{inputs.folder_path}}"
    # 声明司簿适配器返回结构
    output_schema:
      result:
        type: object
        properties:
          config:
            type: object
            description: "PhotasaConfig对象或null"
          exists:
            type: boolean

  - id: "log_result"
    name: "记录读取结果"
    type: "builtin"
    action: "log"
    input:
      level: "info"
      message: "🔧 文件夹配置读取完成: {{inputs.folder_path}} (存在: {{steps.read_config.result.exists}})"
    dependsOn: ["read_config"]

  - id: "format_response"
    name: "格式化返回结果"
    type: "builtin"
    action: "return"
    input:
      success: true
      config: "{{steps.read_config.result.config}}"
      exists: "{{steps.read_config.result.exists}}"
      folder: "{{inputs.folder_path}}"
      timestamp: "{{now()}}"
    dependsOn: ["log_result"]

# 输出定义
outputs:
  success:
    description: "读取是否成功"
    type: "boolean"
  config:
    description: "文件夹配置对象(如果不存在则为null)"
    type: "object"
  exists:
    description: "配置文件是否存在"
    type: "boolean"

# 错误处理
error_handling:
  file_not_found:
    type: "return_ok"
    response:
      success: true
      config: null
      exists: false
      error: "配置文件不存在"

  engine_error:
    type: "return_error"
    response:
      success: false
      config: null
      error: "司簿引擎读取失败"
      reason: "{{ error.message }}"

# 超时设置
timeout: 5000
priority: "normal"
```

#### 房玄龄集成（工作流驱动架构）

**✅ 核心设计原则：房玄龄不包含特殊业务逻辑，统一使用工作流编排**

房玄龄的 `processZouzhe()` 使用**统一流程**处理所有 matter，无需特殊 handler：

```typescript
// src/renderer/src/services/fangxuanling/fangxuanling.ts

export class FangXuanLingService {
  async processZouzhe(zouzhe: Zouzhe): Promise<ZouzheResponse> {
    logger.info(`📝 收到${zouzhe.department}奏章: ${zouzhe.matter}`, zouzhe);

    try {
      // 1️⃣ 构造诏令（简单映射，无特殊逻辑）
      const zhaoling: Zhaoling = {
        command: zouzhe.matter,        // matter → command
        context: zouzhe.content,        // 原样转发内容
        timestamp: Date.now(),
        source: zouzhe.department,
        priority: zouzhe.priority === ZOUZHE_PRIORITIES.URGENT
          ? ZHAOLING_PRIORITIES.URGENT
          : ZHAOLING_PRIORITIES.NORMAL,
        requiresTianshuApproval: true
      };

      // 2️⃣ 发诏令给袁天罡（袁天罡 → 天枢 → 工作流编排）
      const zhaolingResponse = await this._yuanTianGang.executeZhaoling(zhaoling);

      // 3️⃣ 天界确认后，自动同步 Store（基于 matter-sync.yml）
      if (zhaolingResponse.acknowledged) {
        const syncMetadata = this._matterSyncConfig[zouzhe.matter];
        if (syncMetadata?.autoSync) {
          const store = getStoreByPath(syncMetadata.storePath);
          if (store) {
            // 自动同步引擎：根据配置自动更新 Store
            syncStoreWithSnapshot(zouzhe.matter, zhaolingResponse, syncMetadata, store);
          }
        }
      }

      // 4️⃣ 返回响应
      return buildResponse(zhaolingResponse);

    } catch (error) {
      logger.error(`❌ 奏疏有误，退回重拟: ${zouzhe.matter}`, error);
      return buildErrorResponse(error);
    }
  }
}
```

**关键要点**：
- ✅ **无特殊 handler** - 不再有 `handleSwitchCurrentFolder()` 等方法
- ✅ **统一流程** - 所有 matter 都走同样的 4 步流程
- ✅ **工作流编排** - 天枢工作流负责业务逻辑（获取配置、持久化等）
- ✅ **自动同步** - `matter-sync.yml` 声明式配置自动同步 Store
- ✅ **职责清晰** - 房玄龄只负责转发奏折和同步 Store，不知道天界如何处理

#### 司簿适配器实现

司簿适配器需要提供 `readFolderConfig` 方法:

```typescript
// src/engines/sibu/adapters/SibuAdapter.ts

@Adapter({
  name: "sibu",
  version: "1.0.0",
  description: "司簿文件夹清单管理引擎"
})
export class SibuAdapter {
  private engine: SibuEngine;

  /**
   * 读取文件夹配置
   * @param folderPath 文件夹路径
   * @returns { config: PhotasaConfig | null, exists: boolean }
   */
  async readFolderConfig(folderPath: string): Promise<{ config: PhotasaConfig | null; exists: boolean }> {
    logger.debug("🌌 召唤仙家: sibu仙君施展readFolderConfig之术", folderPath);

    try {
      const configPath = path.join(folderPath, '.photasa.json');
      const exists = await fs.pathExists(configPath);

      if (!exists) {
        return { config: null, exists: false };
      }

      const config = await this.engine.readConfig(folderPath);
      return { config, exists: true };
    } catch (error) {
      logger.error("🌌 仙术失败: sibu仙君的readFolderConfig之术未能成功", error);
      throw error;
    }
  }
}
```

**数据流**:
```
秦琼.switchFolder(folder)
  → 房玄龄.processZouzhe({ matter: "switch_current_folder", content: { folder } })
    → 房玄龄.handleSwitchCurrentFolder()
      → 袁天罡.executeZhaoling({ command: "GET_FOLDER_CONFIG", context: { folder_path } })
        → 天枢.executeWorkflow("get_folder_config.yml")
          → 司簿.readFolderConfig(folder_path)
            → 返回 { config: PhotasaConfig | null, exists: boolean }
      → 房玄龄更新 Store: currentFolder + currentFolderConfig
      → 袁天罡.executeZhaoling({ command: "UPDATE_APP_STATE", context: { delta } })
        → 天枢 → 司命引擎持久化到 ~/.photasa/appState/
```

### 组件使用模式

**迁移前（❌ 旧模式）**：
```typescript
// ❌ 组件直接访问Store
<script setup lang="ts">
import { storeToRefs } from "pinia";
import { usePreferenceStore } from "@renderer/stores/preference";

const preferenceStore = usePreferenceStore();
const { currentFolder, scanningFolder } = storeToRefs(preferenceStore);
</script>

<template>
  <div>{{ currentFolder }}</div>
  <div>扫描队列：{{ scanningFolder.length }}</div>
</template>
```

**迁移后（✅ 新模式）**：
```typescript
// ✅ 组件使用useQinQiong()
<script setup lang="ts">
import { useQinQiong } from "@renderer/services/qinqiong";

const qinqiong = useQinQiong();

// 只读访问
const appState = qinqiong.appState;

// 修改操作
function switchFolder(newPath: string) {
  qinqiong.switchFolder(newPath);
}
</script>

<template>
  <div>{{ appState.currentFolder }}</div>
  <div>扫描队列：{{ appState.scanningQueue.length }}</div>
  <button @click="switchFolder('/new/path')">切换文件夹</button>
</template>
```

### 重构隔离示例

**场景**：RFC 0042将scanningFolder移到ScanningStore

**影响范围**：
- ❌ 旧模式：需要修改所有使用scanningFolder的组件（~20个文件）
- ✅ 新模式：只需修改秦琼类的 `appState` getter 实现（1个文件）

**秦琼类内部修改**：
```typescript
// Before RFC 0042
get appState(): AppState {
  const { scanningFolder } = storeToRefs(this.preferenceStore.appState);
  return { scanningQueue: scanningFolder };  // 别名
}

// After RFC 0042
get appState(): AppState {
  const scanningQueue = computed(() => this.scanningStore.queue);
  return { scanningQueue };  // 实现变了，接口不变
}
```

**组件代码零修改**：
```typescript
// 组件代码完全不变
const qinqiong = useQinQiong();
const appState = qinqiong.appState;
console.log(appState.scanningQueue.value);  // 仍然有效
```

---

## 实施计划

### Phase 1: 秦琼创建（2天）

**1.1 类型定义**
- [ ] 创建 `src/renderer/src/services/qinqiong/types.ts`
- [ ] 定义 `AppState` 接口（所有字段都是 ComputedRef，只读）

**1.2 秦琼类实现**
- [ ] 创建 `src/renderer/src/services/qinqiong/qinqiong.ts`
- [ ] 实现 `QinQiong` 类（实现 IService 接口）
- [ ] 实现 `appState` getter（只读访问）
- [ ] 实现 `handleShengzhi()` 方法接收圣旨
- [ ] 实现 folderTree 更新方法：
  - `switchFolder()` - 切换当前文件夹
  - `addFolderToTree()` - 添加文件夹到树
  - `updateFolderTree()` - 更新整个树（私有方法，仅圣旨调用）
- [ ] 每个方法都要：更新Store → 启奏李世民 → 发奏折到房玄龄

**1.3 useQinQiong() composable 创建**
- [ ] 在 `qinqiong.ts` 中实现 `useQinQiong()` 函数
- [ ] 返回秦琼单例实例
- [ ] 添加 JSDoc 文档

**1.4 李世民路由集成**
- [ ] 在李世民中注册"秦琼"
- [ ] 天界事件路由：`folder_discovered` → 秦琼.add_folder_to_tree

**1.5 杜如晦通道创建**
- [ ] 在杜如晦中为"秦琼"创建 MessageChannel
- [ ] 调用 `qinqiong.setShengzhiPort(port)`
- [ ] 测试圣旨系统通信

**1.6 单元测试**
- [ ] 创建 `__tests__/qinqiong.test.ts`
- [ ] 测试 appState getter 响应式引用正确性
- [ ] 测试 switchFolder() / addFolderToTree() 方法
- [ ] 测试圣旨接收和执行
- [ ] 测试启奏和奏折发送
- [ ] 覆盖率≥90%

### Phase 2: 组件迁移（2天）

**2.1 识别需要迁移的组件**
```bash
# 查找所有直接访问PreferenceStore的组件
grep -r "usePreferenceStore" src/renderer/src/components/
grep -r "preferenceStore.appState" src/renderer/src/
```

**2.2 批量迁移策略**
- [ ] 创建迁移脚本（可选，手动迁移也可）
- [ ] 按模块迁移：
  - 文件夹管理组件（FolderPanel, FolderTree等）
  - 扫描相关组件（ScanProgress等）
  - 设置相关组件（Preferences等）

**2.3 迁移模板**
```typescript
// Before
import { usePreferenceStore } from "@renderer/stores/preference";
const preferenceStore = usePreferenceStore();
const { currentFolder } = storeToRefs(preferenceStore);

// After
import { useQinQiong } from "@renderer/services/qinqiong";
const qinqiong = useQinQiong();
const appState = qinqiong.appState;
// currentFolder → appState.currentFolder
```

### Phase 3: 司命引擎实现（3天）

**3.1 引擎核心创建**
- [ ] 创建 `src/engines/siming/core/SimingEngine.ts`
- [ ] 实现 `appstate-registry.ts` - appState注册表
- [ ] 实现 `appstate-storage.ts` - 文件系统持久化
- [ ] 支持 `~/.photasa/appState/` 目录管理

**3.2 SimingAdapter实现**
- [ ] 创建 `SimingAdapter.ts` 并使用 @Adapter 装饰器
- [ ] 实现 `getAppState()` 方法
- [ ] 实现 `updateAppState()` 方法
- [ ] 实现 `resetAppState()` 方法
- [ ] 添加生命周期管理（initialize/shutdown）

**3.3 天枢集成**
- [ ] 在天枢中注册司命适配器
- [ ] 创建 appState 管理工作流
- [ ] 实现天枢-太乙-司命调度链
- [ ] 测试 IPC 通信

**3.4 单元测试**
- [ ] SimingEngine 测试 - 100% 覆盖率
- [ ] SimingAdapter 测试 - 100% 覆盖率
- [ ] 持久化存储测试
- [ ] 零 lint 错误

### Phase 4: 扫描场景集成（2天）

**4.1 天枢工作流集成**
- [ ] 在千里眼扫描工作流中添加 `folder_discovered` 事件发送
- [ ] 天枢执行工作流：send_ipc_event("folder_discovered", { path: "/new/folder" })

**4.2 袁天罡事件转换**
- [ ] 袁天罡监听 IPC Event: `folder_discovered`
- [ ] 转换为启奏：`renjieEventBus.emit('qizou', { from: "袁天罡", matter: "folder_discovered", ... })`

**4.3 李世民路由**
- [ ] 李世民监听启奏事件
- [ ] 路由决策：`folder_discovered` → 委托杜如晖下旨
- [ ] `duruhui.issueShengzhi("秦琼", { command: "add_folder_to_tree", ... })`

**4.4 秦琼执行**
- [ ] 秦琼接收圣旨并执行 `handleShengzhi()`
- [ ] 调用 `updateFolderTree()` 更新 folderTree
- [ ] 启奏李世民（报告完成）+ 发奏折到房玄龄（请求持久化）

**4.5 集成测试**
- [ ] 测试扫描时发现新文件夹 → folderTree自动更新
- [ ] 测试持久化到 `~/.photasa/appState/`
- [ ] 测试跨界通信完整流程

### Phase 5: 测试验证（1天）

**5.1 单元测试**
- [ ] useQinQiong()测试通过
- [ ] 所有组件测试通过
- [ ] 覆盖率≥90%

**5.2 集成测试**
- [ ] 文件夹切换正常
- [ ] 扫描队列管理正常
- [ ] 配置加载正常
- [ ] 司命引擎持久化正常

**5.3 手动测试**
- [ ] 真实使用场景验证
- [ ] 性能无明显下降
- [ ] appState 恢复功能正常

---

## 验收标准

### 功能标准

- ✅ useQinQiong()提供完整的AppState访问
- ✅ 所有组件迁移到新模式
- ✅ PreferenceStore直接访问全部移除
- ✅ RFC 0042集成后组件无需修改
- ✅ 司命引擎正常运行
- ✅ appState 持久化和恢复功能正常

### 质量标准

- ✅ 单元测试覆盖率≥90%
- ✅ 零lint错误
- ✅ 零TypeScript类型错误
- ✅ 所有测试通过
- ✅ SimingEngine 测试 100% 覆盖率
- ✅ SimingAdapter 测试 100% 覆盖率

### 文档标准

- ✅ useQinQiong() JSDoc完整
- ✅ AppState接口文档清晰
- ✅ 迁移指南完备
- ✅ 司命引擎架构文档完整

---

## 回滚计划

如果useQinQiong()模式失败：

1. **Revert composable**
   - 删除useQinQiong.ts文件
   - 删除相关测试

2. **Revert 组件**
   - 恢复组件中的PreferenceStore直接访问
   - 恢复storeToRefs用法

3. **无数据影响**
   - 只是访问模式变更
   - Store数据结构不变
   - 零数据迁移风险

---

## 架构优势

### 1. 统一访问模式

**Before（混乱）**：
```typescript
// 组件A
const { currentFolder } = storeToRefs(preferenceStore);

// 组件B
const folder = preferenceStore.currentFolder;

// 组件C
const folder = computed(() => preferenceStore.appState.currentFolder);
```

**After（统一）**：
```typescript
// 所有组件
const appState = useQinQiong();
const folder = appState.currentFolder;
```

### 2. 重构隔离

**Store变更影响范围**：
- ❌ 旧模式：影响所有组件（~20个文件）
- ✅ 新模式：只影响useQinQiong()（1个文件）

### 3. 类型安全

**类型定义清晰**：
```typescript
// ✅ AppState接口明确定义
export interface AppState {
  currentFolder: ComputedRef<string>;  // 清晰的类型
  scanningQueue: ComputedRef<ScanAction[]>;  // 清晰的类型
}

// ❌ 旧模式类型不明确
const state = preferenceStore.appState;  // 类型：any?
```

### 4. 响应式封装

**自动处理响应式**：
```typescript
// ✅ 自动computed包装
const appState = useQinQiong();
// appState.currentFolder 自动响应式

// ❌ 旧模式需要手动处理
const folder = computed(() => preferenceStore.currentFolder);
```

---

## FolderTree 管理架构（关键场景）

### 核心问题

FolderTree 是 appState 中最关键的状态之一，需要在以下场景中更新：

1. **用户手动切换文件夹** - 组件触发
2. **扫描时发现新文件夹** - 扫描引擎（千里眼）触发
3. **拖拽单个文件** - 需要添加文件所在父目录
4. **应用启动恢复** - 从持久化恢复

### 架构设计

```
┌─────────────────────────────────────────────────────────────┐
│ 组件层（只读访问）                                           │
│   const appState = useQinQiong();                           │
│   const folderTree = appState.folderTree; // ComputedRef   │
│   （不能直接修改）                                           │
└─────────────────────────────────────────────────────────────┘
                              ↓ 需要修改时
┌─────────────────────────────────────────────────────────────┐
│ 圣旨系统（人界修改通道）                                     │
│   组件 → useLishiming().qizou()                            │
│        → 李世民路由决策                                      │
│        → 杜如晦发送圣旨                                      │
│        → 秦琼接收并执行                                      │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│ 秦琼（appState 守护者）                                     │
│   职责：                                                     │
│   - 接收圣旨指令                                             │
│   - 更新 PreferenceStore.appState.folderTree               │
│   - 通过奏折系统通知天界持久化                               │
└─────────────────────────────────────────────────────────────┘
                              ↓ 奏折系统（FangXuanLing）
┌─────────────────────────────────────────────────────────────┐
│ 天界（持久化存储）                                           │
│   房玄龄 → 袁天罡 → 天枢 → 司命引擎                         │
│   司命引擎持久化 folderTree 到：                            │
│   ~/.photasa/appState/                                     │
└─────────────────────────────────────────────────────────────┘
```

### 场景 1：用户手动切换文件夹

```typescript
// 组件代码
<script setup lang="ts">
import { useQinQiong } from "@renderer/services/qinqiong";

const qinqiong = useQinQiong();

// ✅ 只读访问
const folderTree = qinqiong.appState.folderTree;

// ✅ 修改通过秦琼方法
function switchFolder(newFolder: string) {
  qinqiong.switchFolder(newFolder);
}
</script>
```

**流程**：
1. **组件调用秦琼方法**：`qinqiong.switchFolder(newFolder)`
2. **秦琼更新 Store**：更新 `PreferenceStore.appState.currentFolder`
3. **秦琼启奏李世民**：`renjieEventBus.emit('qizou', { matter: "folder_switched", ... })`
4. **秦琼发奏折到房玄龄**：请求天界持久化
   ```typescript
   fangxuanling.processZouzhe({
     department: "秦琼",
     matter: "persist_current_folder",
     data: { folder: newFolder }
   });
   ```
5. **房玄龄 → 袁天罡 → 天枢 → 司命引擎**：持久化到 `~/.photasa/appState/`

### 场景 2：扫描时发现新文件夹（关键！）

```
┌─────────────────────────────────────────────────────────────┐
│ 天界（扫描引擎）                                             │
│   千里眼扫描时发现新文件夹：/Photos/NewFolder              │
│     ↓                                                        │
│   千里眼 → 天枢工作流                                       │
│     ↓                                                        │
│   天枢执行 workflow: "scan/update_folder_tree.yml"          │
│     step:                                                   │
│       - send_ipc_event:                                    │
│           event: "folder_discovered"                       │
│           data: { path: "/Photos/NewFolder" }              │
└─────────────────────────────────────────────────────────────┘
                              ↓ IPC Event
┌─────────────────────────────────────────────────────────────┐
│ 人界（袁天罡接收）                                           │
│   袁天罡监听天界 IPC 事件                                    │
│     ↓                                                        │
│   袁天罡转换为人界事件：                                     │
│     renjieEventBus.emit('qizou', {                         │
│       from: "袁天罡",                                        │
│       matter: "folder_discovered",                         │
│       data: { path: "/Photos/NewFolder" }                  │
│     })                                                      │
└─────────────────────────────────────────────────────────────┘
                              ↓ mitt 启奏
┌─────────────────────────────────────────────────────────────┐
│ 李世民（中央路由）                                           │
│   监听启奏：renjieEventBus.on('qizou', ...)                │
│     ↓                                                        │
│   路由决策：matter === "folder_discovered"                 │
│     → 目标服务：秦琼                                         │
│     ↓                                                        │
│   委托杜如晦下旨：                                           │
│     duruhui.issueShengzhi("秦琼", {                        │
│       command: "add_folder_to_tree",                       │
│       data: { folder: "/Photos/NewFolder" }                │
│     })                                                      │
└─────────────────────────────────────────────────────────────┘
                              ↓ MessageChannel 圣旨
┌─────────────────────────────────────────────────────────────┐
│ 秦琼服务（接旨执行）                                         │
│   handleShengzhi(shengzhi) {                               │
│     // 1. 更新 folderTree                                  │
│     this.preferenceStore.updateFolderTree(folder);        │
│                                                             │
│     // 2. 启奏李世民（报告完成）                            │
│     renjieEventBus.emit('qizou', {                        │
│       from: "秦琼",                                         │
│       matter: "folder_tree_updated"                       │
│     });                                                    │
│                                                             │
│     // 3. 发奏折到房玄龄（请求天界持久化）                   │
│     fangxuanling.processZouzhe({                          │
│       department: "秦琼",                                   │
│       matter: "persist_folder_tree",                      │
│       data: { folderTree: ... }                           │
│     });                                                    │
│   }                                                        │
└─────────────────────────────────────────────────────────────┘
                              ↓ 奏折系统
┌─────────────────────────────────────────────────────────────┐
│ 房玄龄 → 袁天罡 → 天枢 → 司命引擎                          │
│   持久化 folderTree 到：~/.photasa/appState/               │
└─────────────────────────────────────────────────────────────┘
```

**关键点**：
1. **天界不直接修改人界 Store**（禁止跨界）
2. **天界通过 IPC Event 发送事件**
3. **袁天罡接收 IPC Event，转换为启奏（Qizou）**
4. **李世民监听启奏，路由决策，委托杜如晦下旨**
5. **秦琼接收圣旨（Shengzhi），更新 folderTree**
6. **秦琼启奏李世民（报告完成）+ 发奏折到房玄龄（请求持久化）**

### 场景 3：拖拽单个文件

```typescript
// 组件代码
<script setup lang="ts">
import { useQinqiong } from "@renderer/services/qinqiong";
import { dirname } from "path";

const qinqiong = useQinqiong();

function onFileDrop(filePath: string) {
  const parentDir = dirname(filePath);

  // 调用秦琼添加父目录到 folderTree
  qinqiong.addFolderToTree(parentDir);
}
</script>
```

**流程**：同场景 1，组件 → 秦琼 → 更新 Store → 启奏 + 奏折。

### 秦琼（QinQiong）接口设计

```typescript
// src/renderer/src/services/qinqiong/qinqiong.ts

import type { IService, Shengzhi } from "@renderer/interfaces/li-shi-ming.interface";
import type { IFangXuanLingService } from "@renderer/interfaces/fang-xuan-ling.interface";
import { useFangxuanling } from "@renderer/services/fangxuanling/fangxuanling";
import { renjieEventBus } from "../renjie-event-bus";
import type { DataNode } from "@common/types";
import { logger } from "@renderer/utils/logger";
import { ZOUZHE_PRIORITIES } from "@common/constants";

/**
 * 秦琼（QinQiong）- appState 守护者
 *
 * 职责（遵循褚遂良模式）：
 * - 提供 appState 只读访问（通过房玄龄 Accessor）
 * - 提供 appState 修改方法供组件调用
 * - 接收圣旨（Shengzhi）执行指令
 * - 启奏李世民（Qizou）报告状态
 * - 发奏折到房玄龄（Zouzhe）请求天界持久化
 *
 * ⚠️ 架构约束：
 * - 不直接访问 Store（所有访问通过房玄龄）
 * - 不直接修改 Store（所有修改通过奏折系统）
 *
 * @see docs/rfc/completed/0038-preference-workflow-integration.md
 * @see docs/architecture/accessor-builder-pattern.md
 */
export class QinQiong implements IService {
  private fangxuanling: IFangXuanLingService;

  constructor() {
    this.fangxuanling = useFangxuanling();
  }

  get name() {
    return "秦琼";
  }

  /**
   * 提供只读的 appState 访问（通过房玄龄 Accessor）
   *
   * ⚠️ 只读访问：组件只能读取，不能修改
   * 修改必须通过秦琼提供的方法（switchFolder/addFolderToTree）
   */
  get appState(): IAppStateAccessor {
    return this.fangxuanling.appState;
  }

  /**
   * 设置圣旨接收端口（杜如晦调用）
   */
  setShengzhiPort(port: MessagePort): void {
    port.onmessage = (event) => {
      const shengzhi = event.data as Shengzhi;
      this.handleShengzhi(shengzhi);
    };
  }

  /**
   * 接收圣旨（从杜如晦通过 MessageChannel）
   */
  private handleShengzhi(shengzhi: Shengzhi): void {
    logger.info("🛡️ 秦琼接旨:", shengzhi.command);

    switch (shengzhi.command) {
      case "switch_folder":
        this.switchFolder(shengzhi.data.folder);
        break;

      case "add_folder_to_tree":
        this.addFolderToTree(shengzhi.data.folder);
        break;

      case "update_folder_tree":
        this.updateFolderTree(shengzhi.data.folders);
        break;

      default:
        logger.warn("🛡️ 秦琼：未知圣旨指令", shengzhi.command);
    }
  }

  /**
   * 组件调用：切换当前文件夹
   *
   * ⚠️ 不直接修改 Store！通过奏折系统修改
   */
  switchFolder(folder: string): void {
    logger.debug("🛡️ 秦琼：组件请求切换文件夹", folder);

    // ✅ 发奏折到房玄龄（遵循褚遂良模式）
    this.fangxuanling.processZouzhe({
      department: "秦琼",
      matter: "switch_current_folder",
      content: { folder },
      timestamp: Date.now(),
      priority: ZOUZHE_PRIORITIES.NORMAL
    });

    // ✅ 启奏李世民（报告完成）
    renjieEventBus.emit('qizou', {
      from: "秦琼",
      matter: "folder_switch_requested",
      content: { folder },
      timestamp: Date.now(),
      metadata: { type: 'report' }
    });
  }

  /**
   * 组件调用：添加文件夹到 folderTree
   *
   * ⚠️ 不直接修改 Store！通过奏折系统修改
   */
  addFolderToTree(folder: string): void {
    logger.debug("🛡️ 秦琼：组件请求添加文件夹到树", folder);

    // ✅ 发奏折到房玄龄
    this.fangxuanling.processZouzhe({
      department: "秦琼",
      matter: "add_folder_to_tree",
      content: { folder },
      timestamp: Date.now(),
      priority: ZOUZHE_PRIORITIES.NORMAL
    });

    // ✅ 启奏李世民
    renjieEventBus.emit('qizou', {
      from: "秦琼",
      matter: "folder_add_requested",
      content: { folder },
      timestamp: Date.now(),
      metadata: { type: 'report' }
    });
  }

  /**
   * 圣旨调用：更新整个 folderTree
   * （天界通过李世民→杜如晖→秦琼调用）
   *
   * ⚠️ 不直接修改 Store！通过奏折系统修改
   */
  private updateFolderTree(folders: DataNode[]): void {
    logger.debug("🛡️ 秦琼：收到圣旨，更新文件夹树", folders.length);

    // ✅ 发奏折到房玄龄
    this.fangxuanling.processZouzhe({
      department: "秦琼",
      matter: "update_folder_tree",
      content: { folders },
      timestamp: Date.now(),
      priority: ZOUZHE_PRIORITIES.HIGH  // 圣旨调用优先级高
    });

    // ✅ 启奏李世民
    renjieEventBus.emit('qizou', {
      from: "秦琼",
      matter: "folder_tree_updated",
      content: { count: folders.length },
      timestamp: Date.now(),
      metadata: { type: 'report' }
    });
  }
}

// 导出单例
let qinqiongInstance: QinQiong | null = null;

export function useQinqiong(): QinQiong {
  if (!qinqiongInstance) {
    qinqiongInstance = new QinQiong();
  }
  return qinqiongInstance;
}
```

### 关键架构约束

**✅ 正确的做法**：
1. 组件通过 `useQinQiong()` 获取秦琼实例
2. 只读访问通过 `qinqiong.appState.xxx`（房玄龄 Accessor）
3. 修改通过秦琼方法：`qinqiong.switchFolder()` / `qinqiong.addFolderToTree()`
4. 秦琼发奏折到房玄龄：`fangxuanling.processZouzhe({ matter: "...", content: {...} })`
5. 房玄龄更新 Store → 袁天罡 → 天枢 → 司命引擎持久化到 `~/.photasa/appState/`

**❌ 禁止的做法**：
1. 秦琼直接访问 Store（违反 Accessor 模式）
2. 秦琼直接修改 Store（必须通过奏折）
3. 组件直接修改 `preferenceStore.appState`
4. 天界直接修改人界 Store（跨界操作）
5. 绕过奏折系统直接调用 Store 方法

### 房玄龄 processZouzhe 处理 appState matter

房玄龄需要处理来自秦琼的 appState 相关奏折，并更新 Store。

```typescript
// src/renderer/src/services/fangxuanling/fangxuanling.ts

export class FangXuanLingService {
  async processZouzhe(zouzhe: Zouzhe): Promise<void> {
    logger.debug("🏛️ 房玄龄收到奏折", zouzhe.matter);

    switch (zouzhe.matter) {
      // 秦琼发送的 appState 修改奏折
      case "switch_current_folder":
        await this.handleSwitchCurrentFolder(zouzhe);
        break;

      case "add_folder_to_tree":
        await this.handleAddFolderToTree(zouzhe);
        break;

      case "update_folder_tree":
        await this.handleUpdateFolderTree(zouzhe);
        break;

      // ... 其他 matter 保持不变
    }
  }

  /**
   * 处理切换当前文件夹
   */
  private async handleSwitchCurrentFolder(zouzhe: Zouzhe): Promise<void> {
    const { folder } = zouzhe.content;

    // 1. 更新 Store
    this.preferenceStore.appState.currentFolder = folder;
    logger.info(`🏛️ 房玄龄：更新 currentFolder = ${folder}`);

    // 2. 计算 delta（用于持久化）
    const delta = {
      appState: {
        currentFolder: folder
      }
    };

    // 3. 发送诏令到袁天罡 → 天枢 → 司命引擎持久化
    await this.yuanTianGang.executeZhaoling({
      command: "UPDATE_APP_STATE",
      context: { delta },
      timestamp: Date.now()
    });

    // 4. 自动同步（如果启用 matter-sync.yml）
    await this.autoSyncStore(zouzhe.matter, delta);
  }

  /**
   * 处理添加文件夹到树
   */
  private async handleAddFolderToTree(zouzhe: Zouzhe): Promise<void> {
    const { folder } = zouzhe.content;

    // 1. 更新 Store（调用 Store 的业务方法）
    this.preferenceStore.updateFolderTree(folder);
    logger.info(`🏛️ 房玄龄：添加文件夹到树 ${folder}`);

    // 2. 计算 delta
    const delta = {
      appState: {
        folderTree: this.preferenceStore.appState.folderTree
      }
    };

    // 3. 持久化
    await this.yuanTianGang.executeZhaoling({
      command: "UPDATE_APP_STATE",
      context: { delta },
      timestamp: Date.now()
    });

    await this.autoSyncStore(zouzhe.matter, delta);
  }

  /**
   * 处理更新整个 folderTree（圣旨调用）
   */
  private async handleUpdateFolderTree(zouzhe: Zouzhe): Promise<void> {
    const { folders } = zouzhe.content;

    // 1. 更新 Store
    this.preferenceStore.appState.folderTree = folders;
    logger.info(`🏛️ 房玄龄：更新整个 folderTree (${folders.length}个文件夹)`);

    // 2. 计算 delta
    const delta = {
      appState: {
        folderTree: folders
      }
    };

    // 3. 持久化
    await this.yuanTianGang.executeZhaoling({
      command: "UPDATE_APP_STATE",
      context: { delta },
      timestamp: Date.now()
    });

    await this.autoSyncStore(zouzhe.matter, delta);
  }
}
```

**关键点**：
- ✅ 房玄龄是唯一可以修改 Store 的服务
- ✅ 所有 appState 修改都通过 `UPDATE_APP_STATE` 诏令持久化
- ✅ 使用 `autoSyncStore()` 自动同步（如果配置了 matter-sync.yml）
- ✅ 计算 delta 只包含变化的部分，避免全量更新

### matter-sync.yml 配置（Store 自动同步）

为了让 appState 修改自动同步到 Store，需要在 `matter-sync.yml` 中添加秦琼的 matter 配置：

```yaml
# src/renderer/src/services/fangxuanling/store-automation/matter-sync.yml

matters:
  # ... 现有 matter 保持不变 ...

  # 秦琼 - 切换当前文件夹
  switch_current_folder:
    snapshotPath: "appState.currentFolder"
    syncStrategy: "merge"
    storePath: "preferences"
    autoSync: true
    description: "切换当前文件夹 - 合并 preferences.appState.currentFolder"

  # 秦琼 - 添加文件夹到树
  add_folder_to_tree:
    snapshotPath: "appState.folderTree"
    syncStrategy: "merge"
    storePath: "preferences"
    autoSync: true
    description: "添加文件夹到树 - 合并 preferences.appState.folderTree"

  # 秦琼 - 更新整个 folderTree
  update_folder_tree:
    snapshotPath: "appState.folderTree"
    syncStrategy: "replace"
    storePath: "preferences"
    autoSync: true
    description: "更新整个 folderTree - 替换 preferences.appState.folderTree"
```

**工作流程**：
1. 秦琼发奏折到房玄龄：`matter: "switch_current_folder"`
2. 房玄龄调用 `handleSwitchCurrentFolder()` 更新 Store
3. 房玄龄调用 `autoSyncStore("switch_current_folder", delta)`
4. 自动同步系统根据 `matter-sync.yml` 配置：
   - 提取 delta 中的 `appState.currentFolder`
   - 使用 `merge` 策略合并到 `preferences` Store
   - 触发 Store 响应式更新
5. 房玄龄发送诏令到袁天罡 → 天枢 → 司命引擎持久化

**优势**：
- ✅ 声明式配置，无需硬编码
- ✅ 自动提取 delta 中的正确字段
- ✅ 支持不同的同步策略（merge/replace/patch）
- ✅ 易于维护和扩展

---

## 司命引擎设计（天界 appState 管理）

### 引擎架构

```
src/engines/siming/
├── core/
│   ├── SimingEngine.ts          # 司命引擎核心
│   └── appstate-registry.ts     # appState注册表
├── adapters/
│   ├── index.ts                 # 适配器统一导入
│   └── SimingAdapter.ts         # @Adapter装饰器包装
├── storage/
│   └── appstate-storage.ts      # 文件系统持久化
└── index.ts                     # 只暴露SimingEngine
```

### SimingEngine 职责

**核心能力**：
1. **appState 持久化** - 管理 `~/.photasa/appState/` 目录
2. **状态恢复** - 应用启动时恢复上次的 appState
3. **状态更新** - 接收天枢指令更新 appState
4. **状态清理** - 定期清理过期的状态数据

**存储结构**：
```
~/.photasa/appState/
├── window-state.json           # 窗口状态（位置、大小等）
├── session-state.json          # 会话状态（当前文件夹、扫描状态等）
└── app-config.json             # 应用配置（启动计数、上次使用时间等）
```

### SimingAdapter 接口

```typescript
// src/engines/siming/adapters/SimingAdapter.ts

import { Adapter } from "@engines/taiyi/core/adapter-decorators";
import { SimingEngine } from "../core/SimingEngine";
import type { AppState } from "@common/types";

@Adapter({
  name: "siming",
  version: "1.0.0",
  description: "司命appState管理引擎",
})
export class SimingAdapter {
  private engine: SimingEngine;

  constructor() {
    this.engine = new SimingEngine();
  }

  async initialize(): Promise<void> {
    logger.info("🌌 司命星君归位，掌管应用状态");
    await this.engine.initialize();
  }

  async shutdown(): Promise<void> {
    logger.info("🌌 司命星君归隐，应用状态封存");
    await this.engine.shutdown();
  }

  /**
   * 获取当前 appState
   */
  async getAppState(): Promise<AppState> {
    logger.debug("🌌 召唤仙家: siming仙君施展getAppState之术");
    return await this.engine.getAppState();
  }

  /**
   * 更新 appState
   */
  async updateAppState(delta: Partial<AppState>): Promise<AppState> {
    logger.debug("🌌 召唤仙家: siming仙君施展updateAppState之术");
    return await this.engine.updateAppState(delta);
  }

  /**
   * 重置 appState
   */
  async resetAppState(): Promise<AppState> {
    logger.debug("🌌 召唤仙家: siming仙君施展resetAppState之术");
    return await this.engine.resetAppState();
  }
}
```

### 天枢-太乙-司命调度链

```
UI层 → 天枢引擎 → 太乙引擎 → 司命引擎
       (Tianshu)   (Taiyi)     (Siming)

示例流程：更新当前文件夹
1. 用户切换文件夹
   ↓
2. useQinQiong() 检测到变化
   ↓
3. FangXuanLing 发送奏折到天界
   ↓
4. 天枢接收奏折，创建工作流
   ↓
5. 太乙调度司命引擎
   ↓
6. 司命更新 session-state.json
   ↓
7. 司命返回新的 appState
   ↓
8. 天枢广播变更事件到 UI
```

### 与其他引擎的关系

**司命 vs 千里眼**：
- 司命：管理**通用** appState（窗口、会话、应用配置）
- 千里眼：管理**扫描专用**队列（`~/.photasa/scanning.json`）

**司命 vs 文昌**：
- 司命：管理**应用状态**（运行时数据）
- 文昌：管理**用户偏好**（配置数据）

**司命 vs 司簿**：
- 司命：管理**全局** appState（`~/.photasa/appState/`）
- 司簿：管理**单照片文件夹**清单（`/path/to/photos/.photasa.json`）

---

## 未来扩展

### 扩展1: 权限控制

未来可以在useQinQiong()中添加权限检查：

```typescript
export function useQinQiong(options?: { role?: UserRole }): AppState {
  const { role } = options || {};

  // 根据角色返回不同的AppState子集
  if (role === 'readonly') {
    return {
      currentFolder: computed(() => preferenceStore.currentFolder),
      // 只读用户不能访问扫描队列
    };
  }

  return fullAppState;
}
```

### 扩展2: 性能优化

可以添加缓存和懒加载：

```typescript
export function useQinQiong(): AppState {
  // 懒加载ScanningStore
  const scanningStore = computed(() => useScanningStore());

  return {
    scanningQueue: computed(() => scanningStore.value.queue),
  };
}
```

### 扩展3: 调试支持

可以添加调试日志：

```typescript
export function useQinQiong(): AppState {
  if (import.meta.env.DEV) {
    logger.debug("🛡️ 秦琼：组件请求appState访问");
  }

  return appState;
}
```

---

## 风险评估

### 高风险项

**风险1: 大规模组件迁移**
- **影响**：可能遗漏某些组件
- **概率**：中等
- **缓解**：自动化搜索 + 清单验证
- **回滚**：单个组件可独立回滚

**风险2: 性能影响**
- **影响**：额外的computed包装可能影响性能
- **概率**：低
- **缓解**：性能测试 + benchmarking
- **回滚**：完全回滚到旧模式

### 中风险项

**风险3: 类型不兼容**
- **影响**：AppState接口可能遗漏字段
- **概率**：低
- **缓解**：完整的类型测试
- **回滚**：补充缺失字段

---

## 实施时间表

### Week 1: 秦琼服务实现（2天）
- Day 1: QinQiongService + useQinQiong() 创建
- Day 2: 李世民路由集成 + 杜如晦通道 + 单元测试

### Week 2: 组件迁移（2天）
- Day 3: 迁移文件夹管理组件（FolderPanel, FolderTree）
- Day 4: 迁移扫描和设置组件（ScanProgress, Preferences）

### Week 3: 司命引擎实现（3天）
- Day 5: SimingEngine核心 + appstate-storage
- Day 6: SimingAdapter实现 + 太乙注册
- Day 7: 天枢集成 + IPC通信

### Week 4: 扫描场景集成（2天）
- Day 8: 天枢工作流 - 发现新文件夹时发送 IPC Event
- Day 9: 李世民监听天界事件 → 杜如晦 → 秦琼更新 folderTree

### Week 5: 集成测试（2天）
- Day 10: RFC 0042集成 + 完整测试
- Day 11: 性能测试 + 文档完善

**总计**：11天（约2.5周）

---

## 参考资料

- RFC 0038: 偏好设置工作流集成与Store边界统一（已完成）
- RFC 0042: scanningFolder四步渐进式迁移（进行中）
- [Vue 3 Composition API](https://vuejs.org/api/composition-api-setup.html)
- [Pinia storeToRefs](https://pinia.vuejs.org/api/modules/pinia.html#storetorefs)

---

## 变更历史

- 2025-10-16: 初始版本，基于RFC 0038阶段6设计
- 2025-10-16: 完整设计，响应RFC 0042的Store重构需求
- 2025-10-19: 添加司命引擎架构设计，明确天界 appState 持久化职责

---

## 附录A：命名解释

### 为什么叫"秦琼"？（人界守护者）

**秦琼（Qin Qiong）** - 唐朝开国名将，民间传说中的门神之一。

**职责类比**：
1. **门神职责** - 守护门户，控制进出
   - useQinQiong()守护appState访问边界
   - 确保组件正确访问应用状态

2. **唐朝背景** - 符合项目的古代中国主题（人界）
   - 李世民（LiShiMing）- 中央集权管理
   - 房玄龄（FangXuanLing）- Store管理大臣
   - 秦琼（QinQiong）- 守护appState门户

3. **技术隐喻**
   - 门神站在门口 = useQinQiong()作为访问入口
   - 守护家园 = 保护appState访问安全
   - 识别来者 = 提供类型安全的访问

### 为什么叫"司命"？（天界管理者）

**司命（Siming）** - 道教神祇，主管生命寿算、福禄祸福的命运之神。

**职责类比**：
1. **生命管理** - 掌管生命周期
   - SimingEngine 管理 appState 的生命周期
   - 负责状态的诞生（初始化）、存续（持久化）、恢复（重启）

2. **天界背景** - 符合项目的神话架构（天界）
   - 天枢（Tianshu）- 工作流编排，天枢星
   - 太乙（Taiyi）- 适配器注册中心，太乙真人
   - 司命（Siming）- appState 管理，司命星君

3. **技术隐喻**
   - 掌管寿算 = 管理应用状态的持久化
   - 记录功德 = 存储窗口状态、会话状态
   - 天界职责 = Main 进程的后台管理

**命名一致性**：
- **人界（Renderer）**：
  - usePreference() - 偏好设置访问
  - useQinQiong() - appState访问
- **天界（Main）**：
  - 千里眼（Qianliyan）- 扫描引擎
  - 文昌（Wenchang）- 偏好管理引擎
  - 司命（Siming）- appState管理引擎
  - 司簿（Sibu）- 清单管理引擎

---

## 附录B：迁移检查清单

### 组件迁移清单

- [ ] FolderPanel.vue
- [ ] FolderTree.vue
- [ ] ScanProgress.vue
- [ ] Preferences.vue
- [ ] App.vue
- [ ] PhotoGrid.vue
- [ ] StatusBar.vue
- [ ] ... （自动生成完整列表）

### 验证清单

- [ ] 所有import语句已更新
- [ ] 所有PreferenceStore直接引用已移除
- [ ] 所有storeToRefs调用已移除
- [ ] 类型检查通过
- [ ] 单元测试通过
- [ ] 集成测试通过
- [ ] 手动测试通过

### 清理清单

- [ ] 删除未使用的import
- [ ] 删除未使用的变量
- [ ] 更新组件文档
- [ ] 更新README（如有）

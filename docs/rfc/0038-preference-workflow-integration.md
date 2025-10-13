# RFC 0038: 偏好设置工作流集成与Store边界统一

## 元信息
- **RFC编号**: 0038
- **标题**: 偏好设置工作流集成与Store边界统一
- **状态**: 🟢 **核心完成** (Core Completed) - 架构纯化和Store边界已完成
- **创建日期**: 2025-09-28
- **最后更新**: 2025-10-12 (阶段5：工作流数据流简化)
- **目标版本**: v2.0.0
- **完成进度**:
  - ✅ 阶段1-2: Store边界统一（scanFolders删除、preferences结构统一）
  - ✅ 阶段5: 架构纯化（删除业务逻辑、事件统一）
  - 🔨 **阶段0.1: 事件链实现（袁天罡→李世民→服务响应）- 设计中**
  - 🔨 **阶段0.2: Store自动同步机制（元数据驱动）- 设计中**
  - ⏳ 阶段3: useQinQiong()访问模式（待实施）
  - 📋 阶段4: scanningFolder迁移（待规划）
- **相关RFC**:
  - RFC 0036: 文昌偏好集成（已完成）✅
  - RFC 0040: RemovePath功能修复（已完成）✅
  - RFC 0041: 偏好架构重构（已完成）✅
  - RFC 0039: 天枢工作流语法规范
  - RFC 0032: 千里眼扫描引擎

## 摘要

本RFC描述偏好设置管理的完整实现，并定义PreferenceStore的边界统一任务。核心目标：
1. **统一preference字段**：所有用户偏好必须在`preferences`对象中，与Wenchang保持一致
2. **明确appState边界**：应用运行时状态通过`useQinQiong()`访问
3. **规划scanningFolder迁移**：扫描队列将来由尉迟恭服务(人界)和千里眼引擎(天界)管理

**实际实现说明**：当前实现采用服务层模式（褚遂良→房玄龄→袁天罡→天枢→文昌），更符合职责分离和可维护性原则。

## 背景

### 问题陈述

1. **架构违规**：之前的实现违反了"Tianshu→Taiyi链条"的强制性设计原则
2. **命名混淆**：使用"backend-preference"等术语违反了"一个系统"的设计理念
3. **代码重复**：偏好设置逻辑分散在多个层级，存在重复和不一致
4. **工作流缺失**：偏好设置操作未充分利用工作流的运行时描述能力

### 设计目标

- 严格遵循Tianshu→Taiyi→Engine调用链，绝无例外
- 建立统一的偏好设置管理，消除前后端概念
- 通过YAML工作流描述所有偏好设置操作逻辑
- 为未来AI集成提供基于语言生成工作流的基础

## 详细设计

### 架构原则

#### 1. 服务层调用链
```
UI组件 → 褚遂良服务 → 房玄龄服务 → 袁天罡服务 → 天枢引擎 → 文昌引擎
```

**架构原则**：
- 褚遂良：UI层服务，验证输入，构建奏折
- 房玄龄：业务逻辑层，计算delta，管理Store状态
- 袁天罡：协议转换层，映射命令到工作流
- 天枢：工作流执行引擎
- 文昌：纯存储引擎，只负责持久化

#### 2. 统一命名规范
- 使用`preference`（单数）而非`preferences`（复数）
- 去除`backend-`、`frontend-`等分层概念
- 强调"一个系统"的统一性

#### 3. 工作流驱动
```yaml
# 运行时逻辑描述示例
- id: "update_preferences"
  type: "action"
  service: "wenchang"
  action: "applyDelta"
  input:
    delta: "${inputs.delta}"
    source: "${inputs.source}"
```

### 组件架构

#### 1. 统一偏好设置Store (`@common/stores/preference.ts`)

```typescript
/**
 * 偏好设置Store
 * 统一的偏好设置管理，通过Tianshu工作流与WenchangEngine同步
 */
export const usePreferenceStore = defineStore("preference", {
  state: (): PreferenceState => ({
    preferences: null,
    isLoaded: false,
    isLoading: false,
    error: null,
  }),

  actions: {
    async loadFromBackend(): Promise<void> {
      const result = await window.tianshu.processCommand({
        workflowId: "get_preferences",
        inputs: { key: undefined }
      });
      // 处理结果...
    },

    async updatePreferences(delta: PreferenceDelta): Promise<void> {
      const result = await window.tianshu.processCommand({
        workflowId: "update_preferences",
        inputs: { delta, source: "user" }
      });
      // 处理结果...
    }
  }
});
```

#### 2. 工作流定义

**获取偏好设置工作流** (`src/engines/tianshu/workflows/preference/get_preferences.yml`)：
```yaml
id: "get_preferences"
name: "获取用户偏好设置"
steps:
  - name: "get_snapshot"
    type: "action"
    service: "wenchang"
    action: "getCurrentSnapshot"
    input: {}
```

**更新偏好设置工作流** (`src/engines/tianshu/workflows/preference/update_preferences.yml`)：
```yaml
id: "update_preferences"
name: "更新用户偏好设置"
steps:
  - id: "validate_delta"
    type: "action"
    service: "wenchang"
    action: "validate"
  - id: "update_engine"
    type: "action"
    service: "wenchang"
    action: "updatePreferences"
```

#### 3. 应用初始化流程

```typescript
// src/renderer/src/main.ts
async function initializePreferences() {
  try {
    await preferenceStore.loadFromBackend();
    // 同步到本地store以保持兼容性
    syncToLocalStore(preferenceStore.preferences);
  } catch (error) {
    // 失败时使用本地偏好设置
    console.error("初始化偏好设置失败:", error);
  }
}
```

### 数据流设计

#### 1. 偏好设置加载流程
```
应用启动 → initializePreferences() → window.tianshu.processCommand({workflowId: "get_preferences"})
→ TianshuService.processCommand() → TianshuEngine.executeWorkflow()
→ Taiyi.executeAction() → WenchangEngine.getCurrentSnapshot()
→ 返回偏好设置快照 → 同步到本地store
```

#### 2. 偏好设置更新流程
```
用户修改 → store.updatePreferences(delta) → window.tianshu.processCommand({workflowId: "update_preferences"})
→ 工作流验证和处理 → WenchangEngine.applyDelta()
→ 返回更新结果 → 更新统一store → 触发响应式更新
```

#### 3. 工作流数据流设计原则（2025-10-12）

**完整数据流链路**：
```
Engine.method() 返回 rawData
  ↓
TaiyiEngine.callEngine() 包装
  → { result: rawData, success, timestamp, engineName }
  ↓
TaiyiService.getEngineResult() 提取
  → rawData (提取result字段)
  ↓
TaiyiService.extractValueByPath() 根据step.output定义提取
  → processedData (工作流可访问的数据)
  ↓
WorkflowOrchestrator 存储
  → steps.stepId.* = processedData
```

**output_schema定义规范**：

**核心规则**：`output_schema`必须声明**rawData**的实际结构（即Engine方法的返回值）

**正确示例**：

```yaml
# 例1: validate() 返回 { valid: boolean, errors?: string[] }
- id: "validate_delta"
  action: "validate"
  output_schema:
    valid: boolean        # 直接声明rawData的字段
    errors: string[]
# 访问: steps.validate_delta.valid

# 例2: getCurrentSnapshot() 返回 { data: object, revision: number, timestamp: number }
- id: "get_snapshot"
  action: "getCurrentSnapshot"
  output_schema:
    data: object          # 直接声明rawData的字段
    revision: number
    timestamp: number
# 访问: steps.get_snapshot.data
```

**❌ 错误示例**：

```yaml
# 错误1: output_schema与rawData不匹配
# Engine返回: { valid, errors }
output_schema:
  result:               # ❌ 错误！rawData里没有result字段
    valid: boolean
    errors: string[]

# 错误2: 使用output创建不必要的包装
# Engine返回: { valid, errors }
output:
  result: ""            # ❌ 错误！创建了额外的包装层
output_schema:
  result: object
```

**何时使用output字段**：
```yaml
# 只在需要重命名字段时使用
# Engine返回: { id: string }
output:
  eventId: "id"         # 将rawData.id重命名为eventId
output_schema:
  eventId: string       # 声明重命名后的结构
# 访问: steps.emit_event.eventId
```

**本次修复**：
- WenchangEngine.sanitize() 从返回`{ result: data }`改为直接返回`data`
- update_preferences.yml 删除所有不必要的output定义
- output_schema现在正确匹配Engine的实际返回值

### 工作流优势

#### 1. 运行时逻辑描述
- 所有偏好设置操作逻辑通过YAML描述
- 支持动态修改而无需重新编译
- 为未来AI集成提供可解析的逻辑描述

#### 2. 扩展性设计
```yaml
# 未来AI可基于用户语言生成的工作流
- intent: "change theme to dark mode"
  workflow: "update_preferences"
  input:
    delta:
      ui:
        theme: "dark"
```

## 实现细节

### 1. 文件重组
- `src/renderer/src/stores/backend-preference.ts` → `src/common/stores/preference.ts`
- 统一所有偏好设置相关类型定义
- 消除"backend"、"frontend"等分层概念

### 2. 调用链修正
- 移除TianshuService中所有非processCommand的IPC处理器
- 移除TaiyiService的engine暴露
- 所有偏好设置操作必须通过工作流

### 3. 兼容性保持
- 本地store保持原有API不变
- 统一store通过watch同步本地store变更
- 渐进式迁移，避免破坏性变更

## 安全考虑

### 1. 调用链安全
- 严格的封装边界，防止直接访问内部组件
- 所有操作通过验证的工作流执行
- 错误处理和降级机制

### 2. 数据一致性
- 统一的数据源（WenchangEngine）
- 原子性的更新操作
- 冲突检测和解决机制

## 测试策略

### 1. 单元测试
- 统一store的所有方法
- 工作流执行逻辑
- 错误处理和边界情况

### 2. 集成测试
- 完整的偏好设置加载和更新流程
- 工作流与引擎的集成
- 应用启动时的偏好设置初始化

### 3. 端到端测试
- 用户界面偏好设置修改
- 跨会话的偏好设置持久化
- 错误恢复和降级场景

## 实施状态分析 (Linus视角)

### 已完成的工作 ✅

#### 阶段1：架构修正（RFC 0036/0040/0041）
- [x] 移除架构违规的直接调用
- [x] 建立正确的工作流调用链：褚遂良 → 房玄龄 → 袁天罡 → 天枢 → 文昌
- [x] 业务逻辑从存储层分离到服务层
- [x] WenchangAdapter测试全部通过（13/13）
- [x] UI更新和存储保存功能正常

#### 阶段2：功能验证和测试完善 ✅ 已完成
- [x] **偏好设置启动加载测试** - GET_PREFERENCES完整流程测试通过
- [x] **工作流执行端到端测试** - THEME_CHANGE工作流测试通过
- [x] **错误处理和降级测试** - 天枢引擎错误处理测试通过
- [x] **集成测试** - 褚遂良→房玄龄→袁天罡→天枢→文昌完整流程验证通过

**测试文件**: `src/renderer/src/services/__tests__/preference-integration.test.ts`
**测试结果**: 4/4 passed ✅

### 待完成的工作 🔄

#### 阶段3：Store边界统一任务（RFC 0038核心任务） ✅ 已完成
- [x] **阶段1**: 删除无用的scanFolders设计
- [x] **阶段2**: 统一preferences字段结构
- [ ] **阶段3**: 实现useQinQiong()访问模式（待实施）
- [ ] **阶段4**: 规划scanningFolder迁移（待规划）

#### 阶段4：架构清理和纯化 ✅ 已完成（2025-10-11 & 2025-10-12）

**阶段4.1 - 业务逻辑分离（2025-10-11）**：
- [x] 删除addPath/removePath/addScanFolder业务逻辑方法
- [x] 删除pathOperations从PreferenceDelta接口
- [x] 删除PathSyncEvent、ScanFolderSyncEvent、PathOperationResult类型定义
- [x] 统一使用preferenceChanged事件通知所有偏好变更
- [x] 确认Wenchang仅提供纯存储操作（getCurrentSnapshot, applyDelta）
- [x] 所有测试通过（343个测试全部passed）

**阶段4.2 - 数据流简化（2025-10-12）**：
- [x] 移除WenchangEngine.sanitize()的不必要包装层
- [x] 统一Engine方法返回结构（与validate()保持一致）
- [x] 删除update_preferences.yml中所有不必要的output定义
- [x] 修正工作流访问路径以匹配设计原则
- [ ] 待用户测试验证theme/language/paths设置保存功能

**阶段4.3 - 深度合并修正（2025-10-12）**：
- [x] 修复deepMergePreferences递归调用bug（缺少storePath参数）
- [x] 修复mergePreferencesFromTianjie类型检查bug（snapshot应为object非string）
- [x] 重构WenchangEngine.applyDelta()使用深度merge替代浅merge
- [x] 添加deepMerge私有方法实现基于路径的深度合并
- [ ] 待用户测试验证深度merge是否正确保留未修改字段

**架构修正理由**：
- Wenchang是纯存储引擎，不应包含业务逻辑
- Engine方法应直接返回数据，不创建不必要的包装层（遵循简洁性原则）
- 工作流output定义应遵循"不定义output，直接暴露rawData"的最佳实践
- **merge必须是深度合并，避免丢失嵌套字段**（如只更新ui.theme时，不能丢失ui.language）
- addPath/removePath由房玄龄负责（计算delta并调用applyDelta）
- 路径变更统一通过preferenceChanged事件通知，无需特殊事件
- scanningFolder将来由尉迟恭(人界)和千里眼(天界)管理

#### 阶段5：文档和清理（可选）
- [ ] 更新开发文档和架构图
- [ ] 性能分析和优化（如有必要）

### 架构优势

当前服务层架构的优势：

1. **职责分离清晰**：每层只负责自己的职责
2. **可维护性强**：业务逻辑集中在房玄龄，易于理解和修改
3. **符合"好品味"**：代码简洁，边界清晰，便于测试

### 下一步行动

**优先级1（必须）**：
1. 执行Store边界统一任务（四阶段计划）
2. 实现useQinQiong()访问模式
3. 规划scanningFolder迁移到尉迟恭/千里眼

**优先级2（可选）**：
- 文档更新和代码清理

## 未来扩展

### 1. AI工作流生成
```
用户语言："将主题改为深色模式"
→ AI解析和工作流生成
→ 自动执行偏好设置更新
```

### 2. 高级偏好设置功能
- 偏好设置历史和回滚
- 多用户偏好设置配置
- 偏好设置同步和备份

## 结论

本RFC建立了完全符合系统架构原则的偏好设置管理系统：

1. **严格遵循调用链**：Tianshu→Taiyi→Engine，绝无例外
2. **统一系统概念**：消除前后端分离，建立"一个系统"
3. **工作流驱动**：所有逻辑通过YAML描述，支持运行时修改
4. **AI集成就绪**：为未来基于语言的工作流生成奠定基础

这种设计不仅解决了当前的架构违规问题，还为系统的长期发展和AI集成提供了坚实的基础。

## 实际实现总结

### RFC 0038 vs 实际实现对比

#### RFC 0038提出的架构（未完全采用）
```typescript
// 直接从Store调用工作流
await window.tianshu.processCommand({
    workflowId: "update_preferences",
    inputs: { delta, source: "user" }
});
```

#### 当前架构（RFC 0041实现）
```typescript
// UI组件 → 褚遂良 → 房玄龄 → 袁天罡 → 天枢 → 文昌
褚遂良.updateTheme(themeId)
  → 房玄龄.processZouzhe({ matter: THEME_CHANGE, content: { themeId } })
    → 房玄龄.computePreferenceDelta()  // 业务逻辑计算
    → 袁天罡.executeZhaoling({ command: UPDATE_PREFERENCES, context: delta })
      → 天枢.executeWorkflow("update_preferences")
        → 文昌.applyDelta(delta)  // 纯存储操作
```

### 架构优势（与RFC 0041一致）

1. **职责分离清晰**
   - 褚遂良：UI层服务，验证输入，构建奏折
   - 房玄龄：业务逻辑层，计算delta，管理Store状态
   - 袁天罡：协议转换层，映射命令到工作流
   - 天枢：工作流执行引擎
   - 文昌：纯存储引擎，只负责持久化

2. **可维护性强**
   - 业务逻辑集中在房玄龄，不散落在Store中
   - 类型安全和错误处理更完善
   - 测试更容易编写和维护

3. **符合Linus"好品味"原则**
   - 消除了pathOperations等特殊情况
   - 使用统一的delta格式
   - 代码更简洁，边界更清晰

### 已完成的工作 ✅（与RFC 0041一致）

1. **服务层架构实现**
   - 褚遂良服务：UI层服务，验证输入，构建奏折
   - 房玄龄服务：业务逻辑层，计算delta，管理Store状态
   - 袁天罡服务：协议转换层，映射命令到工作流
   - 文昌引擎：纯存储引擎，只负责持久化

2. **业务逻辑分离**
   - 房玄龄负责业务逻辑计算（computePreferenceDelta）
   - 文昌引擎只负责纯存储（applyDelta）
   - 清晰的职责划分

3. **工作流集成**
   - `get_preferences.yml` - 获取偏好设置
   - `update_preferences.yml` - 更新偏好设置
   - 完整的调用链：褚遂良 → 房玄龄 → 袁天罡 → 天枢 → 文昌

4. **测试验证**
   - 单元测试通过 ✅
   - 用户验证通过 ✅
   - UI更新和存储保存完全正常 ✅

## Store边界统一任务

### 当前问题分析

经过代码审查发现，当前Store混合了三种不同类型的数据，违反了架构边界原则：

1. **preferences** (用户偏好设置) - 应该全部在 `preferences` 对象中
2. **appState** (运行时状态) - 应该通过 `useQinQiong()` 访问
3. **scanningFolder** (扫描队列) - 将来迁移到尉迟恭服务(人界) / 千里眼引擎(天界)

### 具体问题

```typescript
// 当前Store结构问题
export type PreferenceState = {
    preferences: {
        ui: { theme, language, layout, ... },
        display: { thumbnailSize, sortOrder, ... },
        performance: { maxCacheSize, ... },
        // ❌ 缺少: scanning 和 system 字段
    },
    appState: {
        // ✅ 正确的运行时状态
        firstTime: boolean,
        lastOpenedFolder: string,
        currentFolder: string,

        // ❌ 错误位置: 应该在 preferences 中
        paths: string[],
        excludePaths: string[],
        autoUpdate: AutoUpdateConfig,

        // ⏳ 临时: 将来迁移到千里眼
        scanningFolder: ScanAction[],
    }
}
```

### 实施阶段计划

#### 阶段0.1：事件链实现 🔨 设计中 (2025-10-12)

**目标**：建立中央集权事件系统，实现天界事件的监听和分发机制。

**架构设计**：
```
┌──────────────────────────────────────────────────────────────┐
│ 1. @common/events/tianjie-events.ts                         │
│    - 天界事件定义（天枢和袁天罡共享）                          │
│    - 只定义事件类型和数据结构，不包含映射逻辑                  │
└──────────────────────────────────────────────────────────────┘
                    ↓                           ↓
         ┌──────────────────┐         ┌──────────────────────────┐
         │   天枢 (天界)     │         │  袁天罡 (人界)            │
         │                  │         │  + event-mapping.yml     │
         │  发射事件        │         │    (内部自动加载)         │
         └──────────────────┘         └──────────────────────────┘
                                               ↓
                                      ┌──────────────────┐
                                      │  李世民          │
                                      │  中央路由        │
                                      └──────────────────┘
```

**关键职责划分**：
- **@common/events**：天界事件定义（共享），只定义类型和数据结构
- **袁天罡**：唯一监听IPC事件的服务，内部YAML配置事件映射
- **李世民**：中央集权路由中心，接收袁天罡上报并分发到各服务

**文件结构**：
```
src/
├── common/
│   └── events/
│       └── tianjie-events.ts        # 天界事件定义（共享）
│
└── renderer/src/services/
    ├── yuantiangang/
    │   ├── yuantiangang.ts          # 袁天罡服务
    │   ├── event-mapping.yml        # 事件映射配置（内部）
    │   └── config-loader.ts         # 配置加载器
    │
    └── li-shi-ming.service.ts       # 李世民服务
```

**实现要点**：

1. **共享事件定义 (@common/events/tianjie-events.ts)**
   ```typescript
   /**
    * 天界事件类型
    * 天枢引擎通过IPC发射的所有事件
    */
   export enum TianjieEventType {
       PREFERENCES_CHANGED = 'tianjie:preferences_changed',
       SCAN_PROGRESS = 'tianjie:scan_progress',
       SCAN_COMPLETED = 'tianjie:scan_completed',
       WORKFLOW_STATUS = 'tianjie:workflow_status',
   }

   /**
    * 天界事件数据结构
    */
   export interface TianjieEventData {
       [TianjieEventType.PREFERENCES_CHANGED]: {
           snapshot: any;
           delta: any;
           source: string;
       };
       // ... 其他事件数据结构
   }

   /**
    * 天界事件基础结构
    */
   export interface TianjieEvent<T extends TianjieEventType = TianjieEventType> {
       type: T;
       data: TianjieEventData[T];
       timestamp: number;
       source: string;
   }
   ```

2. **袁天罡事件映射配置 (yuantiangang/event-mapping.yml)**
   ```yaml
   # 袁天罡事件映射配置
   # 定义如何将天界事件映射为人界事件

   metadata:
     version: "1.0.0"
     description: "天界事件到人界事件的映射配置"

   # 事件映射规则
   mappings:
     tianjie:preferences_changed:
       renjieEventType: "preferenceChanged"
       description: "偏好设置变更事件"
       priority: "high"

     tianjie:scan_progress:
       renjieEventType: "scanProgress"
       description: "扫描进度更新事件"
       priority: "normal"
   ```

3. **袁天罡自动监听所有事件**
   ```typescript
   // yuantiangang/yuantiangang.ts
   import { TianjieEventType, TianjieEvent } from '@common/events/tianjie-events';
   import { loadEventMappingConfig } from './config-loader';

   export class YuanTianGangService extends EventEmitter {
       private eventMappings: Record<string, any>;

       constructor() {
           super();
           // ✅ 构造函数中自动加载映射配置
           this.eventMappings = loadEventMappingConfig();
           this.observeTianjieEvents();
       }

       /**
        * 观测天界动态 - 自动注册所有已定义的天界事件
        */
       private observeTianjieEvents(): void {
           // ✅ 遍历所有天界事件类型，自动注册监听
           Object.values(TianjieEventType).forEach((tianjieEventType) => {
               window.electron.on(tianjieEventType, (event: TianjieEvent) => {
                   logger.info(`🔮 袁天罡观测到天象: ${tianjieEventType}`);

                   // ✅ 从配置获取映射规则
                   const mapping = this.eventMappings[tianjieEventType];
                   if (!mapping) {
                       logger.warn(`🔮 天象${tianjieEventType}无映射配置`);
                       return;
                   }

                   // ✅ 转换为人界事件并发射给李世民
                   this.emit('renjieEvent', {
                       type: mapping.renjieEventType,
                       data: event.data,
                       timestamp: event.timestamp,
                   });
               });
           });
       }
   }
   ```

4. **李世民中央集权分发**
   ```typescript
   // li-shi-ming.service.ts
   private setupImperialDecrees(): void {
       this.yuanTianGangService.on('renjieEvent', (event: RenjieEvent) => {
           logger.info(`👑 李世民收到袁天罡上报: ${event.type}`);
           this.dispatchToMinistry(event);
       });
   }
   ```

**架构优势**：
- ✅ **类型安全**：天枢添加新事件时，更新@common/events，编译时检查
- ✅ **自动同步**：袁天罡遍历TianjieEventType，自动监听所有事件
- ✅ **配置驱动**：事件映射规则在YAML中，易于维护
- ✅ **边界清晰**：事件定义共享，映射逻辑属于袁天罡内部

**与操作链的关系**：
- **操作链**（褚遂良→房玄龄→袁天罡→天枢→文昌）：负责数据修改和Store更新
- **事件链**（天界→IPC→袁天罡→李世民→服务）：负责UI响应、日志、反应
- 两条链互不冲突，各司其职

#### 阶段0.2：Store自动同步机制 🔨 设计中 (2025-10-12)

**目标**：实现房玄龄的元数据驱动Store同步机制，消除硬编码的matter处理逻辑。

**当前问题**：
- 房玄龄中存在硬编码的switch case处理不同matter
- Store更新逻辑散落在各个case中
- 缺乏统一的同步策略

**架构设计**：
```
┌─────────────────────────────────────────────────────────────┐
│  房玄龄服务目录结构                                           │
│                                                              │
│  fangxuanling/                                               │
│  ├── fangxuanling.ts          # 主服务                       │
│  ├── utils.ts                 # 工具函数                     │
│  ├── metadata/                # 元数据配置目录                │
│  │   ├── matter-sync.yml      # Store同步配置（自动加载）     │
│  │   └── index.ts             # 配置加载器                   │
│  └── interfaces.ts            # 接口定义                     │
└─────────────────────────────────────────────────────────────┘
```

**文件结构**：
```
src/renderer/src/services/
└── fangxuanling/
    ├── fangxuanling.ts          # 房玄龄服务
    ├── utils.ts                 # 工具函数
    ├── metadata/
    │   ├── matter-sync.yml      # Store同步配置（内部）
    │   └── index.ts             # 配置加载器
    └── interfaces.ts            # 接口定义
```

**设计方案**：

1. **YAML配置文件 (fangxuanling/metadata/matter-sync.yml)**
   ```yaml
   # 房玄龄Store自动同步配置
   # 这是房玄龄内部的元数据配置，在构造函数中自动加载

   metadata:
     version: "1.0.0"
     description: "奏折matter与Store同步配置"
     lastUpdated: "2025-10-12"

   # 同步策略定义
   strategies:
     merge:
       description: "深度合并到Store"
     replace:
       description: "完全替换Store字段"
     patch:
       description: "浅层合并到Store"

   # 奏折matter同步规则
   matters:
     THEME_CHANGE:
       snapshotPath: "snapshot"
       syncStrategy: "merge"
       storePath: "preferences"
       autoSync: true
       description: "主题变更自动同步"

     LANGUAGE_CHANGE:
       snapshotPath: "snapshot"
       syncStrategy: "merge"
       storePath: "preferences"
       autoSync: true
       description: "语言变更自动同步"

     THUMBNAIL_SIZE_CHANGE:
       snapshotPath: "snapshot"
       syncStrategy: "merge"
       storePath: "preferences"
       autoSync: true
       description: "缩略图大小变更自动同步"

     ADD_PATH:
       snapshotPath: "snapshot"
       syncStrategy: "merge"
       storePath: "preferences"
       autoSync: true
       description: "添加路径自动同步"

     REMOVE_PATH:
       snapshotPath: "snapshot"
       syncStrategy: "merge"
       storePath: "preferences"
       autoSync: true
       description: "移除路径自动同步"

     GET_PREFERENCES:
       snapshotPath: "snapshot"
       syncStrategy: "replace"
       storePath: "preferences"
       autoSync: true
       description: "获取完整偏好设置快照"
   ```

2. **配置加载器 (fangxuanling/metadata/index.ts)**
   ```typescript
   import yaml from 'js-yaml';

   /**
    * 奏折matter与Store同步元数据配置
    */
   export interface MatterSyncMetadata {
       snapshotPath: string;
       syncStrategy: 'merge' | 'replace' | 'patch';
       storePath: string;
       autoSync: boolean;
       description?: string;
   }

   /**
    * 加载matter同步配置
    * 房玄龄构造函数中自动调用
    */
   export function loadMatterSyncConfig(): Record<string, MatterSyncMetadata> {
       try {
           // ✅ 使用webpack/vite的raw-loader加载YAML
           const configContent = require('./matter-sync.yml');
           const config = yaml.load(configContent);

           logger.info(`📜 加载matter同步配置: v${config.metadata.version}`);
           logger.info(`📜 配置matters数量: ${Object.keys(config.matters).length}`);

           return config.matters;
       } catch (error) {
           logger.error('📜 加载matter同步配置失败', error);
           // ✅ 降级：返回空配置
           return {};
       }
   }
   ```

3. **房玄龄自动加载配置**
   ```typescript
   // fangxuanling/fangxuanling.ts
   import { loadMatterSyncConfig, MatterSyncMetadata } from './metadata';

   export class FangXuanLingService {
       private matterSyncConfig: Record<string, MatterSyncMetadata>;

       constructor(yuanTianGang: YuanTianGangService) {
           // ✅ 构造函数中自动加载配置
           this.matterSyncConfig = loadMatterSyncConfig();

           logger.info("📜 房玄龄就任，开始处理奏折");
           logger.info(`📜 已加载${Object.keys(this.matterSyncConfig).length}个matter同步规则`);
       }

       /**
        * 根据配置自动同步Store
        * 元数据驱动的Store更新机制
        */
       private async autoSyncStore(
           matter: string,
           tianjieResponse: ZhaolingResponse
       ): Promise<void> {
           // ✅ 从内部配置获取同步规则
           const syncConfig = this.matterSyncConfig[matter];

           if (!syncConfig) {
               logger.warn(`📜 matter无同步配置: ${matter}`);
               return;
           }

           if (!syncConfig.autoSync) {
               logger.debug(`📜 matter未启用自动同步: ${matter}`);
               return;
           }

           // 从天界响应中提取snapshot
           const snapshot = _.get(tianjieResponse.data, syncConfig.snapshotPath);
           if (!snapshot) {
               logger.warn(`📜 天界响应无snapshot数据: ${matter}`);
               return;
           }

           logger.info(`📜 开始自动同步Store: ${matter}, 策略: ${syncConfig.syncStrategy}`);

           // 根据策略更新Store
           try {
               switch (syncConfig.syncStrategy) {
                   case 'merge':
                       // 深度合并
                       this.$patch((state) => {
                           const merged = mergePreferencesFromTianjie(
                               state[syncConfig.storePath],
                               snapshot
                           );
                           state[syncConfig.storePath] = merged;
                       });
                       logger.info(`📜 Store合并完成: ${syncConfig.storePath}`);
                       break;

                   case 'replace':
                       // 完全替换
                       this.$patch({
                           [syncConfig.storePath]: snapshot,
                       });
                       logger.info(`📜 Store替换完成: ${syncConfig.storePath}`);
                       break;

                   case 'patch':
                       // 浅层合并
                       this.$patch((state) => {
                           Object.assign(state[syncConfig.storePath], snapshot);
                       });
                       logger.info(`📜 Store更新完成: ${syncConfig.storePath}`);
                       break;

                   default:
                       logger.error(`📜 未知的同步策略: ${syncConfig.syncStrategy}`);
               }
           } catch (error) {
               logger.error(`📜 Store同步失败: ${matter}`, error);
               throw error;
           }
       }

       /**
        * 处理奏折 - 房玄龄的核心职责
        */
       async processZouzhe(zouzhe: Zouzhe): Promise<ZouzheResponse> {
           // 1. 计算delta（如果需要）
           // 2. 上报天界
           const response = await this.escalateToTianjie(zhaoling);

           // 3. ✅ 自动同步Store（元数据驱动）
           if (response.acknowledged) {
               await this.autoSyncStore(zouzhe.matter, response);
           }

           return response;
       }
   }
   ```

**架构优势**：
- ✅ **消除硬编码**：不再有switch case处理不同matter
- ✅ **配置驱动**：YAML配置文件，易于维护和扩展
- ✅ **自动加载**：构造函数中自动加载，不需要外部依赖
- ✅ **统一机制**：所有matter使用相同的同步逻辑
- ✅ **可扩展**：添加新matter只需在YAML中添加配置

### 四阶段统一计划

#### 阶段1：删除无用的scanFolders设计 ✅ 已完成
- [x] 从 Wenchang types 删除 `scanFolders` 字段
- [x] 从默认配置中移除 `scanFolders: []`
- [x] 清理相关代码和注释

#### 阶段2：统一preferences字段结构 ✅ 已完成
- [x] 添加 `preferences.scanning` 字段，包含：
  - `paths: string[]` (从 `appState.paths` 迁移)
  - `excludePatterns: string[]` (从 `appState.excludePaths` 迁移)
- [x] 添加 `preferences.system` 字段，包含：
  - `autoUpdate: AutoUpdateConfig` (从 `appState.autoUpdate` 迁移)
- [x] 更新房玄龄服务访问新的路径
- [x] 所有相关测试通过

#### 阶段3：实现useQinQiong()访问模式 ⏳ 待实施
- [ ] 创建 `useQinQiong()` composable 用于访问 `appState` 字段
- [ ] 更新所有UI组件使用 `useQinQiong()` 而非直接访问 `appState`
- [ ] 确保 `appState` 只包含真正的运行时状态

#### 阶段4：规划scanningFolder迁移 📋 待规划
- [ ] **人界**: 创建尉迟恭服务 (YuchiGongService) 管理扫描队列UI
- [ ] **天界**: 千里眼引擎 (QianliyanEngine) 管理实际扫描执行
- [ ] 迁移 `scanningFolder` 从Store到尉迟恭服务

#### 阶段5：架构纯化 ✅ 已完成（2025-10-11）
- [x] 删除WenchangAdapter中的业务逻辑方法（addPath/removePath/addScanFolder）
- [x] 删除PreferenceDelta中的pathOperations字段
- [x] 删除PathSyncEvent、ScanFolderSyncEvent、PathOperationResult类型定义
- [x] 删除WenchangAdapter中的事件监听器（onPathSync等）
- [x] 统一使用preferenceChanged事件
- [x] 验证所有测试通过（343/343）

**架构原则确认**：
- ✅ Wenchang = 纯存储（getCurrentSnapshot, applyDelta）
- ✅ 房玄龄 = 业务逻辑（计算delta, 管理Store）
- ✅ 事件统一 = 只需preferenceChanged，覆盖所有偏好变更

## 详细修复计划

### 问题分析

经过代码审查发现以下严重问题：

1. **scanningFolder在错误位置** ❌
   - 当前：`store.appState.scanningFolder`
   - 应该：尉迟恭服务(人界) / 千里眼引擎(天界)

2. **paths在错误位置** ❌
   - 当前：`store.appState.paths`
   - 应该：`store.preferences.scanning.paths`

3. **直接访问appState** ❌
   - 多个组件直接访问 `store.appState.paths`
   - 应该通过 `useQinQiong()` 访问

4. **代码注释缺失** ❌
   - 大量代码缺少详尽注释
   - 违反Linus"好品味"原则

### 修复计划

#### Phase 1: Store结构修复
1. **修改PreferenceState类型**
   ```typescript
   export type PreferenceState = {
       preferences: {
           ui: { theme, language, layout, ... },
           display: { thumbnailSize, sortOrder, ... },
           performance: { maxCacheSize, ... },
           // ✅ 新增：scanning字段
           scanning: {
               paths: string[],
               excludePatterns: string[],
           },
           // ✅ 新增：system字段
           system: {
               autoUpdate: AutoUpdateConfig,
           },
       },
       appState: {
           // ✅ 只保留真正的运行时状态
           firstTime: boolean,
           lastOpenedFolder: string,
           currentFolder: string,
           currentFolderConfig: PhotasaConfig,
           folderTree: DataNode[],
           // ❌ 移除：paths, excludePaths, autoUpdate
           // ⏳ 临时保留：scanningFolder (将来迁移到尉迟恭)
           scanningFolder: ScanAction[],
       }
   }
   ```

2. **添加详尽注释**
   - 为所有类型定义添加JSDoc注释
   - 为所有方法添加详细说明
   - 为所有复杂逻辑添加行内注释

#### Phase 2: 服务层修复
1. **创建useQinQiong() composable**
   ```typescript
   /**
    * 秦琼服务 - 应用状态管理UI门面
    * 提供对appState字段的安全访问
    */
   export function useQinQiong() {
       const store = usePreferenceStore();

       return {
           // 运行时状态访问
           firstTime: computed(() => store.appState.firstTime),
           lastOpenedFolder: computed(() => store.appState.lastOpenedFolder),
           currentFolder: computed(() => store.appState.currentFolder),
           currentFolderConfig: computed(() => store.appState.currentFolderConfig),
           folderTree: computed(() => store.appState.folderTree),
           // 临时：scanningFolder (将来迁移到尉迟恭)
           scanningFolder: computed(() => store.appState.scanningFolder),
       };
   }
   ```

2. **更新褚遂良服务**
   - 修改paths getter访问 `preferences.scanning.paths`
   - 添加详尽注释说明数据流

3. **更新房玄龄服务**
   - 修改delta计算逻辑
   - 更新Store访问路径
   - 添加详尽注释

#### Phase 3: UI组件修复
1. **App.vue修复**
   ```typescript
   // ❌ 错误：直接访问
   const { paths, currentFolder, scanningFolder, thumbnailSize } = storeToRefs(preferenceStore);

   // ✅ 正确：通过服务访问
   const chuSuiLiang = useChuSuiLiang();
   const qinQiong = useQinQiong();
   const paths = computed(() => chuSuiLiang.paths);
   const currentFolder = computed(() => qinQiong.currentFolder);
   const scanningFolder = computed(() => qinQiong.scanningFolder);
   ```

2. **FolderList.vue修复**
   ```typescript
   // ❌ 错误：直接访问
   const expandedKeys = ref<string[]>([...paths.value]);

   // ✅ 正确：通过褚遂良访问
   const chuSuiLiang = useChuSuiLiang();
   const paths = computed(() => chuSuiLiang.paths);
   const expandedKeys = ref<string[]>([...paths.value]);
   ```

3. **ImportPhotos.vue修复**
   ```typescript
   // ❌ 错误：直接访问
   store.paths

   // ✅ 正确：通过褚遂良访问
   const chuSuiLiang = useChuSuiLiang();
   chuSuiLiang.paths
   ```

4. **AdvancedSettings.vue修复**
   ```typescript
   // ❌ 错误：直接访问
   const paths = computed(() => preferenceStore.paths);

   // ✅ 正确：通过褚遂良访问
   const chuSuiLiang = useChuSuiLiang();
   const paths = computed(() => chuSuiLiang.paths);
   ```

#### Phase 4: 数据迁移
1. **Store数据迁移**
   - 将 `appState.paths` → `preferences.scanning.paths`
   - 将 `appState.excludePaths` → `preferences.scanning.excludePatterns`
   - 将 `appState.autoUpdate` → `preferences.system.autoUpdate`

2. **向后兼容**
   - 保持现有API不变
   - 内部使用新结构
   - 渐进式迁移

#### Phase 5: 测试验证
1. **单元测试更新**
   - 更新所有测试使用新的访问方式
   - 验证数据迁移正确性

2. **集成测试**
   - 验证UI组件正常工作
   - 验证数据同步正确

### 实施检查清单

#### 阶段1：Store结构修复
- [ ] 修改PreferenceState类型定义
- [ ] 添加preferences.scanning字段
- [ ] 添加preferences.system字段
- [ ] 移除appState中的错误字段
- [ ] 添加详尽JSDoc注释

#### 阶段2：服务层修复
- [ ] 创建useQinQiong() composable
- [ ] 更新褚遂良服务paths getter
- [ ] 更新房玄龄服务delta计算
- [ ] 添加详尽注释

#### 阶段3：UI组件修复
- [ ] 修复App.vue使用服务访问
- [ ] 修复FolderList.vue使用褚遂良
- [ ] 修复ImportPhotos.vue使用褚遂良
- [ ] 修复AdvancedSettings.vue使用褚遂良
- [ ] 添加详尽注释

#### 阶段4：数据迁移
- [ ] 实现Store数据迁移逻辑
- [ ] 保持向后兼容
- [ ] 验证数据正确性

#### 阶段5：测试验证
- [ ] 更新单元测试
- [ ] 更新集成测试
- [ ] 验证所有功能正常

### 注释标准

所有代码必须包含详尽注释：

1. **类型定义注释**
   ```typescript
   /**
    * 偏好设置状态类型
    * 定义了Store中存储的所有偏好设置和运行时状态
    */
   export type PreferenceState = {
       // ... 详细字段说明
   }
   ```

2. **方法注释**
   ```typescript
   /**
    * 添加监控路径
    * @param path 要添加的路径
    * @param source 操作来源，用于日志记录
    * @throws {Error} 当路径无效或重复时抛出错误
    */
   async addPath(path: string, source: string = "unknown"): Promise<void> {
       // ... 实现
   }
   ```

3. **复杂逻辑注释**
   ```typescript
   // 检查路径重复：避免添加已存在的路径
   const duplicationResult = checkPathDuplication(path, currentPaths);
   if (duplicationResult.isDuplicate) {
       // 路径已存在，记录日志但不抛出错误
       logger.warn(`路径已存在: ${path}`);
       return;
   }
   ```

**作为Linus Torvalds，我要说：这个修复计划体现了"好品味"！每个步骤都有明确的目标和验证标准！**

### 验证标准

- [ ] 所有preference字段都在 `preferences` 对象中
- [ ] 所有appState字段通过 `useQinQiong()` 访问
- [ ] 无用的 `scanFolders` 设计已删除
- [ ] `scanningFolder` 迁移路径已规划

### 结论

RFC 0038的核心目标（工作流驱动的偏好设置管理）已经实现，但采用了更实用的架构设计。这种架构调整是在实践中基于Linus Torvalds的"好品味"原则做出的优化，最终实现了更清晰、更易维护的代码。

**下一步**: 执行Store边界统一任务，确保架构边界清晰，为未来的千里眼引擎集成做好准备。

## 参考文档

- RFC 0035: 五引擎编排架构
- RFC 0036: 文昌偏好设置集成（实际实现基础）⭐
- RFC 0037: 天枢YAML工作流DSL
- RFC 0040: RemovePath功能修复（架构实践）⭐
- RFC 0041: 偏好架构重构 - 业务逻辑分离（架构优化）⭐

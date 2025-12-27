# RFC 0038: 偏好设置工作流集成与Store边界统一

> **⚠️ DEPRECATED**: This RFC is superseded by:
>
> - RFC 0037: ZouWu Workflow DSL Specification (for workflow syntax)
> - RFC 0050: Taiyi Workflow Engine Design (for adapter integration)
>
> This RFC remains for historical reference only.

- **RFC编号**: 0038
- **标题**: 偏好设置工作流集成与Store边界统一
- **作者**: 李鹏
- **开始日期**: 2025-09-28
- **状态**: ✅ 已完成 - DEPRECATED (Superseded by RFC 0037 & 0050)
- **完成日期**: 2025-10-16
- **最后更新**: 2025-12-24
- **类型**: 架构
- **目标版本**: v2.0.0
- **完成进度**:
    - ✅ **阶段1**: 删除scanFolders设计 - 已完成
    - ✅ **阶段2**: 统一preferences字段结构 - 已完成
    - ✅ **阶段3**: Store自动同步机制（元数据驱动）- 已完成 (2025-10-15)
        - ✅ 实现YAML配置驱动的Store同步（matter-sync.yml）
        - ✅ 完整的四大偏好设置支持（theme/language/thumbnailSize/paths）
        - ✅ 房玄龄paths delta计算逻辑（computePathsDelta方法）
        - ✅ 唐代风格日志转换（人界风格：📚 📝 🏛️ 🔔）
        - ✅ 51个测试全部通过，零lint错误
    - ✅ **阶段4**: 架构纯化（删除业务逻辑、事件统一）- 已完成 (2025-10-11)
    - ✅ **阶段7**: qizou-shengzhi架构实施 - 已完成 (2025-10-16)
        - ✅ 架构设计审查完成
        - ✅ 核心组件全部实施完成：
            - [x] IService接口定义（name getter + setShengzhiPort）✅
            - [x] DuRuHui单向圣旨通道管理器（connect方法）✅
            - [x] LiShiMingRouter中央路由决策者（mitt监听qizou + 路由决策）✅
            - [x] ChuSuiLiang实现IService接口 ✅
            - [x] event-routing.yml配置（add/remove_path_completed路由规则）✅
            - [x] Shengzhi接口添加id字段 ✅
            - [x] LiShiMing集成Router并完成ChuSuiLiang连接 ✅
            - [x] YuChiGong创建并实现IService接口（接收add_scan_task/remove_scan_task圣旨）✅
            - [x] LiShiMing集成YuChiGong服务 ✅
            - [x] renjie-event-bus.ts已清理（不存在）✅
            - [x] 集成测试验证完成（6个测试全部通过）✅
        - ✅ **质量验证**：
            - 零lint错误
            - 完整协调链路测试通过
            - 模板变量解析测试通过
            - 错误处理测试通过
            - 并发扫描测试通过
- **后续RFC**:
    - RFC 0042: scanningFolder四步渐进式迁移（原阶段5）- 📋 Draft
    - RFC 0043: useQinQiong()访问模式（原阶段6）- 📋 Draft
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
4. **事件链架构**：建立完整的mitt（启奏）+ MessageChannel（圣旨）+ 杜如晦（通道管理）混合架构

**实际实现说明**：当前实现采用服务层模式（褚遂良→房玄龄→袁天罡→天枢→文昌），更符合职责分离和可维护性原则。

**阶段7设计亮点（2025-10-15完成）**：

- ✅ **mitt事件总线**：Vue 3官方推荐，200字节，启奏机制
- ✅ **MessageChannel**：浏览器原生API，圣旨下发和回复
- ✅ **杜如晦服务**：MessageChannel管理器，职责分离
- ✅ **完整数据流**：15步骤从用户操作到扫描队列更新

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
                inputs: { key: undefined },
            });
            // 处理结果...
        },

        async updatePreferences(delta: PreferenceDelta): Promise<void> {
            const result = await window.tianshu.processCommand({
                workflowId: "update_preferences",
                inputs: { delta, source: "user" },
            });
            // 处理结果...
        },
    },
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

**类型语法支持**：

- **简单类型**：使用`key: type`格式（如`valid: boolean`，`count: number`）
- **数组类型**：必须使用JSON Schema格式，不支持`string[]`语法

    ```yaml
    # ❌ 错误：不支持TypeScript风格
    errors: string[]

    # ✅ 正确：使用JSON Schema格式
    errors:
      type: array
      items:
        type: string
    ```

- **对象类型**：复杂对象使用JSON Schema的`properties`描述

**正确示例**：

```yaml
# 例1: validate() 返回 { valid: boolean, errors?: string[] }
# 使用JSON Schema标准格式描述复杂类型（如数组）
- id: "validate_delta"
  action: "validate"
  output_schema:
      type: object
      properties:
          valid:
              type: boolean
          errors:
              type: array
              items:
                  type: string
# 访问: steps.validate_delta.valid, steps.validate_delta.errors

# 例2: getCurrentSnapshot() 返回 { data: object, revision: number, timestamp: number }
# 简单类型可使用简化格式
- id: "get_snapshot"
  action: "getCurrentSnapshot"
  output_schema:
      data: object # 简化格式：直接声明类型
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
    eventId: "id" # 将rawData.id重命名为eventId
output_schema:
    eventId: string # 声明重命名后的结构
# 访问: steps.emit_event.eventId
```

**本次修复**：

- WenchangEngine.sanitize() 从返回`{ result: data }`改为直接返回`data`
- update_preferences.yml 删除所有不必要的output定义
- output_schema现在正确匹配Engine的实际返回值

#### 4. YAML变量访问模式（2025-10-27更新）

**核心原则**：VariableResolver直接暴露`steps.stepId = result.output`（已unwrap的数据）

**允许的访问模式**：

1. **直接访问完整输出**：

    ```yaml
    # 获取步骤的完整输出
    array: "{{steps.restore_queue}}" # ✅ 获得完整数组
    data: "{{steps.get_snapshot}}" # ✅ 获得完整对象
    ```

2. **字段访问**：

    ```yaml
    # 访问输出的特定字段
    valid: "{{steps.validate_delta.valid}}" # ✅ 访问boolean字段
    errors: "{{steps.validate_delta.errors}}" # ✅ 访问数组字段
    data: "{{steps.get_snapshot.data}}" # ✅ 访问对象字段
    ```

3. **嵌套字段访问**：
    ```yaml
    # 访问嵌套字段
    theme: "{{steps.get_snapshot.data.ui.theme}}" # ✅ 深度访问
    ```

**禁止的访问模式**：

```yaml
# ❌ 禁止：显式使用.output（这是内部实现细节）
data: "{{steps.get_snapshot.output}}"
data: "{{steps.get_snapshot.output.data}}"

# validate-workflows.ts (Line 72-77) 会检测并报错
```

**架构原理**：

VariableResolver (`src/engines/tianshu/orchestration/VariableResolver.ts` Line 396-417) 实现：

```typescript
private getStepOutputs(context: ExecutionContext): Record<string, any> {
    const outputs: Record<string, any> = {};
    for (const [stepId, result] of context.stepResults.entries()) {
        // 直接暴露result.output（已unwrap）
        outputs[stepId] = result.output;  // steps.stepId → output
    }
    return outputs;
}
```

**设计理由**：

- **简洁性**：`steps.stepId`比`steps.stepId.output`更简洁
- **语义清晰**：stepId直接代表步骤的输出，无需额外后缀
- **架构一致**：与RFC 0045数据扁平化策略保持一致
- **实现细节隐藏**：`.output`是内部存储字段，不应暴露给YAML

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

#### Store边界统一任务（RFC 0038核心任务）

- [x] **阶段1**: 删除无用的scanFolders设计 ✅ 已完成
- [x] **阶段2**: 统一preferences字段结构 ✅ 已完成
- [x] **阶段3**: Store自动同步机制 ✅ 已完成 (2025-10-15)
- [x] **阶段4**: 架构纯化 ✅ 已完成 (2025-10-11)
- [ ] **阶段5**: scanningFolder迁移 📋 待规划（依赖阶段7）
- [ ] **阶段6**: useQinQiong()访问模式 ⏳ 待实施
- [ ] **阶段7**: 事件链实现（袁天罡→李世民→圣旨系统）🔨 规划中（当前任务）

#### 阶段4详情：架构清理和纯化 ✅ 已完成（2025-10-11 & 2025-10-12）

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
    inputs: { delta, source: "user" },
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

#### 阶段7详情：qizou-shengzhi架构实施 🔨 进行中（2025-10-16）

**目标**：建立统一的qizou-shengzhi架构，实现服务间的协调通信。

**核心设计原则**（2025-10-16最终确认）：

1. **IService接口** - 统一服务抽象
    - `readonly name: string` - 服务名称
    - `setShengzhiPort(port: MessagePort): void` - 接收圣旨通道（单向）

2. **DuRuHui（杜如晖）** - MessageChannel管理器
    - `connect(service: IService): void` - 自动连接服务（使用service.name）
    - `issueShengzhi(serviceName, shengzhi): void` - 下发圣旨
    - **不监听MessageChannel回复** - 服务通过qizou启奏报告

3. **LiShiMing（李世民）** - 中央路由决策者
    - 直接创建mitt实例（不使用renjie-event-bus.ts封装）
    - `mitt.on("qizou", handleQizou)` - 监听所有启奏
    - 加载event-routing.yml配置
    - `handleQizou()` - 路由决策逻辑
    - 委托duruhui下旨：`duruhui.issueShengzhi(serviceName, shengzhi)`

4. **服务实现** - 实现IService接口
    - **除了DuRuHui和FangXuanLing之外，所有服务都应实现IService接口**
    - **ChuSuiLiang（褚遂良）** - 偏好设置管理，实现IService
    - **YuChiGong（尉迟恭）** - 扫描队列UI状态管理，实现IService
    - **QinQiong（秦琼）** - UI状态管理，实现IService
    - **XuanZang（玄奘）** - 语言设置管理，实现IService
    - **DuRuHui（杜如晦）** - 不实现IService（MessageChannel管理器）
    - **FangXuanLing（房玄龄）** - 不实现IService（Store管理器）

**关键架构决策**：

✅ **事件统一为qizou** - 不创建额外的事件类型（如preference_changed）
✅ **MessageChannel单向圣旨** - 服务不通过MessageChannel回复，通过qizou启奏报告
✅ **完整协调链路** - 褚遂良完成→李世民协调→尉迟恭触发扫描→天界执行
✅ **通用业务语义** - 事件名称使用业务含义（add_path_completed），不绑定实现（tianjie/renjie）

**核心数据流**：

```
褚遂良.addPath()完成
  ↓ qizouBus.emit("qizou", {matter: "add_path_completed"})
李世民.mitt.on("qizou")收到启奏
  ↓ 查找event-routing.yml路由规则
李世民决策：下旨尉迟恭
  ↓ duruhui.issueShengzhi("尉迟恭", {command: "add_scan_task"})
尉迟恭.port.onmessage接收圣旨
  ↓ processShengzhi() → 发送奏折到房玄龄
房玄龄 → 袁天罡 → 天枢 → 千里眼执行扫描
  ↓ 千里眼发送IPC事件：scan_progress
袁天罡监听IPC → 直接调用尉迟恭.updateScanProgress()
```

**实施任务清单**：

- [ ] 创建IService接口（src/common/interfaces/service.interface.ts）
- [ ] 重构DuRuHui：删除所有路由代码，实现connect方法（单向通道）
- [ ] 重构ChuSuiLiang：实现IService接口，单向接收圣旨+qizou报告
- [ ] 创建/重构YuChiGong：实现IService接口，接收add/remove_scan_task圣旨
- [ ] 重构LiShiMing：创建mitt实例，监听qizou，实现路由决策，使用duruhui.connect
- [ ] 更新Shengzhi接口：添加id字段用于追踪
- [ ] 更新event-routing.yml：add/remove_path_completed路由规则
- [ ] 删除renjie-event-bus.ts文件
- [ ] 运行lint检查和测试验证

---

### 阶段7技术设计

#### 1. 事件总线配置（mitt）

**安装依赖**：

```bash
npm install mitt
```

**事件总线定义** (`src/renderer/src/services/renjie-event-bus.ts`):

```typescript
import mitt from "mitt";
import type { Emitter } from "mitt";
import type { Qizou } from "@common/interfaces/qizou.interface";

// 定义所有人界事件类型
export type RenjieEvents = {
    // 启奏事件（服务 → 李世民）
    qizou: Qizou;

    // 天界事件（袁天罡转换后 → 李世民）
    preference_changed: { key: string; value: unknown };
    scan_progress: { path: string; progress: number; total: number };
    scan_completed: { path: string; fileCount: number };
};

// 创建事件总线实例
export const renjieEventBus: Emitter<RenjieEvents> = mitt<RenjieEvents>();
```

#### 2. 启奏事件系统设计（mitt）

**接口定义** (`src/common/interfaces/qizou.interface.ts`):

```typescript
/**
 * 启奏 - 服务通过mitt事件总线向李世民报告事项
 */
export interface Qizou {
    /** 启奏事项 */
    matter: string;

    /** 启奏内容 */
    content: Record<string, unknown>;

    /** 来源服务 */
    from: string;

    /** 时间戳 */
    timestamp: number;

    /** 元数据 */
    metadata?: {
        type?: "request" | "report"; // 请求执行 或 报告完成
        relatedMatter?: string; // 关联的matter（report时使用）
        priority?: "urgent" | "normal";
    };
}
```

**使用方式**：

```typescript
import { renjieEventBus } from "../renjie-event-bus";

// 褚遂良发起启奏
class ChuSuiLiangService {
    private qizouLishiming(
        matter: string,
        content: Record<string, unknown>,
        type: "request" | "report",
    ): void {
        const qizou: Qizou = {
            matter: matter,
            content: content,
            from: "褚遂良",
            timestamp: Date.now(),
            metadata: { type },
        };

        logger.info(`📜 褚遂良启奏李世民: ${matter} (${type})`);

        // 使用 mitt 发送启奏事件
        renjieEventBus.emit("qizou", qizou);
    }

    async addPath(path: string): Promise<void> {
        // 1. 启奏请求执行
        this.qizouLishiming("request_add_path", { path }, "request");
        // 李世民会通过MessageChannel下旨批准执行
    }

    private lishimingPort: MessagePort | null = null;

    /**
     * 设置与李世民通信的 MessageChannel port
     */
    setLishimingPort(port: MessagePort): void {
        logger.info("📜 褚遂良建立与李世民的奏报通道");

        this.lishimingPort = port;

        // 监听李世民的圣旨
        port.onmessage = async (event) => {
            const shengzhi: Shengzhi = event.data;
            logger.info(`📜 褚遂良奉旨: ${shengzhi.command}`);

            // 执行圣旨
            const response = await this.processShengzhi(shengzhi);

            // 通过 MessageChannel 回复执行结果
            port.postMessage(response);
        };
    }

    private async processShengzhi(shengzhi: Shengzhi): Promise<ShengzhiResponse> {
        try {
            if (shengzhi.command === "execute_add_path") {
                const path = shengzhi.content.path as string;
                const result = await this.executeAddPath(path);

                // 执行成功后，启奏报告完成
                this.qizouLishiming("add_path_completed", { path, result }, "report");

                return {
                    received: true,
                    executed: true,
                    result,
                };
            }

            return {
                received: true,
                executed: false,
                error: `未知圣旨命令: ${shengzhi.command}`,
            };
        } catch (error) {
            logger.error("📜 褚遂良执行圣旨失败:", error);
            return {
                received: true,
                executed: false,
                error: String(error),
            };
        }
    }
}
```

#### 3. 杜如晦服务设计（MessageChannel管理器）

**杜如晦服务实现** (`src/renderer/src/services/duruhui/duruhui.ts`):

```typescript
/**
 * 杜如晦（DuRuHui）- MessageChannel 管理器
 * 职责：
 * 1. 创建和管理所有服务的 MessageChannel
 * 2. 提供统一的圣旨下发接口
 * 3. 监听和转发服务的回复
 */
class DuRuHuiService {
    private serviceChannels = new Map<string, MessagePort>();
    private onResponseCallback: ((serviceName: string, response: ShengzhiResponse) => void) | null =
        null;

    /**
     * 创建服务通道
     * @returns [李世民端port, 服务端port]
     */
    createServiceChannel(serviceName: string): [MessagePort, MessagePort] {
        const channel = new MessageChannel();

        logger.info(`📋 杜如晦创建通道: ${serviceName}`);

        // 李世民持有 port1
        this.serviceChannels.set(serviceName, channel.port1);

        // 监听服务的回复
        channel.port1.onmessage = (event: MessageEvent) => {
            const response: ShengzhiResponse = event.data;
            logger.info(`📋 杜如晦转呈: ${serviceName}的奏报`, response);

            // 转发给李世民
            this.onResponseCallback?.(serviceName, response);
        };

        // 返回 [李世民端, 服务端]
        return [channel.port1, channel.port2];
    }

    /**
     * 设置响应回调（李世民调用）
     */
    setResponseCallback(callback: (serviceName: string, response: ShengzhiResponse) => void): void {
        this.onResponseCallback = callback;
    }

    /**
     * 下发圣旨（李世民调用）
     */
    issueShengzhi(serviceName: string, shengzhi: Shengzhi): void {
        const port = this.serviceChannels.get(serviceName);

        if (!port) {
            logger.error(`📋 杜如晦无法下旨: 服务${serviceName}未登记`);
            return;
        }

        logger.info(`📋 杜如晦传旨: ${serviceName} - ${shengzhi.command}`);

        // 通过 MessageChannel 发送圣旨
        port.postMessage(shengzhi);
    }

    /**
     * 获取所有已注册服务
     */
    getRegisteredServices(): string[] {
        return Array.from(this.serviceChannels.keys());
    }
}
```

#### 4. 李世民服务设计（mitt监听 + 杜如晦下旨）

**李世民服务实现** (`src/renderer/src/services/lishimin/lishimin.ts`):

```typescript
import { renjieEventBus } from "../renjie-event-bus";
import type { DuRuHuiService } from "../duruhui/duruhui";
import type { Qizou, Shengzhi, ShengzhiResponse } from "@common/interfaces";

class LiShiMingService {
    private duruhui: DuRuHuiService;
    private eventRouter: EventRouter;

    constructor(duruhui: DuRuHuiService) {
        this.duruhui = duruhui;

        // 👑 李世民通过 mitt 监听所有启奏
        renjieEventBus.on("qizou", this.handleQizou.bind(this));

        // 👑 李世民监听袁天罡上报的天界事件
        renjieEventBus.on("preference_changed", this.handlePreferenceChanged.bind(this));
        renjieEventBus.on("scan_progress", this.handleScanProgress.bind(this));

        // 设置杜如晦的响应回调
        duruhui.setResponseCallback(this.handleShengzhiResponse.bind(this));

        // 加载路由配置
        this.eventRouter = new EventRouter();

        logger.info("👑 李世民就位，开始监听启奏与天界事件");
    }

    /**
     * 处理启奏（mitt事件）
     */
    private handleQizou(qizou: Qizou): void {
        logger.info(`👑 李世民收到启奏: ${qizou.from} - ${qizou.matter} (${qizou.metadata?.type})`);

        // 查询路由规则
        const routes = this.eventRouter.queryQizouRoutes(qizou.matter, qizou.metadata?.type);

        // 根据路由规则下发圣旨（通过杜如晦）
        for (const route of routes) {
            this.issueShengzhi(route.service, {
                command: route.shengzhi.command,
                content: this.resolveContent(route.shengzhi.content, qizou),
                priority: route.shengzhi.priority,
                from: "李世民",
                timestamp: Date.now(),
            });
        }
    }

    /**
     * 下发圣旨（委托杜如晦）
     */
    private issueShengzhi(serviceName: string, shengzhi: Shengzhi): void {
        logger.info(`👑 李世民下旨: ${serviceName} - ${shengzhi.command}`);

        // 委托杜如晦下发圣旨
        this.duruhui.issueShengzhi(serviceName, shengzhi);
    }

    /**
     * 处理服务回复（杜如晦转呈）
     */
    private handleShengzhiResponse(serviceName: string, response: ShengzhiResponse): void {
        logger.info(`👑 李世民收到${serviceName}的奏报:`, response);

        // 根据响应触发后续路由
        if (response.executed && response.result) {
            // 可以触发下一步操作
        }
    }
}
```

#### 5. 服务初始化（杜如晦建立MessageChannel）

**初始化代码** (`src/renderer/src/services/index.ts`):

```typescript
export function initializeServices(): void {
    // 1. 创建杜如晦（MessageChannel管理器）
    const duruhui = new DuRuHuiService();

    // 2. 创建李世民服务（依赖杜如晦）
    const lishiming = new LiShiMingService(duruhui);

    // 3. 创建各个服务
    const chusuiliang = new ChuSuiLiangService();
    const yuchigong = new YuchiGongService();
    const fangxuanling = new FangXuanLingService();

    // 4. 杜如晦为每个服务创建 MessageChannel
    const [_, chusuilingPort] = duruhui.createServiceChannel("褚遂良");
    const [__, yuchigongPort] = duruhui.createServiceChannel("尉迟恭");
    const [___, fangxuanlingPort] = duruhui.createServiceChannel("房玄龄");

    // 5. 服务持有各自的 port
    chusuiliang.setLishimingPort(chusuilingPort);
    yuchigong.setLishimingPort(yuchigongPort);
    fangxuanling.setLishimingPort(fangxuanlingPort);

    logger.info("🏛️ 朝廷开衙，百官就位");
    logger.info("📋 杜如晦已建立圣旨通道:", duruhui.getRegisteredServices());
}
```

**架构说明**：

- **杜如晦（DuRuHui）**：MessageChannel 管理器，创建、管理和维护所有服务通道
- **李世民（LiShiMing）**：中央路由，通过 mitt 监听启奏，委托杜如晦下发圣旨
- **职责分离**：李世民专注于路由决策，杜如晦专注于通道管理

#### 5. 圣旨通信系统接口

**接口定义** (`src/common/interfaces/shengzhi.interface.ts`):

```typescript
/**
 * 圣旨 - 李世民通过 MessageChannel 向各服务下达的指令
 */
export interface Shengzhi {
    /** 圣旨命令 */
    command: string;

    /** 圣旨内容 */
    content: Record<string, unknown>;

    /** 优先级 */
    priority: "urgent" | "normal";

    /** 来源（固定为李世民） */
    from: "李世民";

    /** 时间戳 */
    timestamp: number;

    /** 元数据 */
    metadata?: {
        originalQizou?: Qizou; // 触发此圣旨的启奏
        reason?: string; // 下旨原因
    };
}

/**
 * 圣旨响应 - 服务通过 MessageChannel 回复执行结果
 */
export interface ShengzhiResponse {
    /** 是否领旨 */
    received: boolean;

    /** 是否执行成功 */
    executed: boolean;

    /** 执行结果数据 */
    result?: unknown;

    /** 错误信息（如果执行失败） */
    error?: string;

    /** 时间戳 */
    timestamp?: number;

    /** 元数据 */
    metadata?: {
        executionTime?: number;
        serviceName?: string;
    };
}
```

#### 6. 李世民事件路由配置

**配置文件** (`src/renderer/src/services/lishimin/event-routing.yml`):

```yaml
# 李世民事件路由配置
# 定义如何处理启奏事件（mitt）和天界事件（mitt）

metadata:
    version: "1.0.0"
    description: "李世民中央事件路由配置 - mitt + MessageChannel 混合架构"
    lastUpdated: "2025-10-15"

# 启奏路由规则（renjieEventBus.on('qizou')）
qizou_routes:
    # 服务请求执行操作
    request_add_path:
        - when:
              type: "request"
          then:
              service: "褚遂良"
              shengzhi:
                  command: "execute_add_path"
                  content:
                      path: "{{qizou.content.path}}"
                  priority: "normal"
              description: "批准褚遂良执行addPath"

    request_remove_path:
        - when:
              type: "request"
          then:
              service: "chusuiliang"
              shengzhi:
                  command: "execute_remove_path"
                  content:
                      path: "{{qizou.content.path}}"
                  priority: "normal"
              description: "批准褚遂良执行removePath"

    # 服务报告完成
    add_path_completed:
        - when:
              type: "report"
          then:
              service: "yuchigong"
              shengzhi:
                  command: "add_scan_task"
                  content:
                      path: "{{qizou.content.path}}"
                  priority: "normal"
              description: "路径添加完成后，下旨尉迟恭添加扫描任务"

    remove_path_completed:
        - when:
              type: "report"
          then:
              service: "yuchigong"
              shengzhi:
                  command: "cancel_scan_task"
                  content:
                      path: "{{qizou.content.path}}"
                  priority: "normal"
              description: "路径移除完成后，下旨尉迟恭取消扫描任务"

# 天界事件路由规则（袁天罡上报的preference_changed等）
tianjie_routes:
    # 扫描进度事件
    scan_progress:
        - when:
              always: true
          then:
              service: "yuchigong"
              shengzhi:
                  command: "update_scan_progress"
                  content:
                      progress: "{{event.data}}"
                  priority: "normal"
              description: "扫描进度更新，下旨尉迟恭更新UI"
```

#### 7. 完整数据流：addPath → 自动触发扫描（mitt + MessageChannel混合架构）

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. 用户点击"添加路径"                                             │
└─────────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│ 2. UI → 褚遂良.addPath(path)                                     │
└─────────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│ 3. 褚遂良 → renjieEventBus.emit('qizou', {                      │
│      matter: 'request_add_path',                                │
│      content: {path},                                           │
│      from: '褚遂良',                                             │
│      metadata: {type: 'request'}                                │
│    })                                    [mitt事件总线] 📡       │
└─────────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│ 4. 李世民.renjieEventBus.on('qizou')    [mitt监听] 👑           │
│    - 收到启奏：request_add_path                                  │
│    - 查询qizou_routes配置                                       │
│    - 决策：批准执行                                              │
└─────────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│ 5. 李世民 → MessageChannel.port1.postMessage({                 │
│      command: 'execute_add_path',                               │
│      content: {path},                                           │
│      from: '李世民',                                            │
│      priority: 'normal'                                         │
│    })                            [MessageChannel下旨] 📜        │
└─────────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│ 6. 褚遂良.port2.onmessage        [MessageChannel接旨] 📜        │
│    - 收到圣旨：execute_add_path                                 │
│    - 发送奏折到房玄龄                                            │
│    - 房玄龄.processZouzhe({matter: 'add_path', content: {path}})│
└─────────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│ 7. 房玄龄 → 袁天罡 → 天枢 → 文昌.applyDelta()                    │
│    - 文昌保存到preferences.json                                  │
│    - 返回完整snapshot                                           │
└─────────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│ 8. 房玄龄.autoSyncStore() - 同步到Store                         │
│    - Store.preferences.scanning.paths 更新                      │
└─────────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│ 9. 褚遂良 → port2.postMessage({                                 │
│      received: true,                                            │
│      executed: true,                                            │
│      result: {path}                                             │
│    })                            [MessageChannel回复] 📜        │
└─────────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│ 10. 李世民收到执行结果   [MessageChannel] 👑                     │
│     - 记录执行成功                                              │
└─────────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│ 11. 褚遂良 → renjieEventBus.emit('qizou', {                     │
│       matter: 'add_path_completed',                             │
│       content: {path},                                          │
│       metadata: {type: 'report'}                                │
│     })                              [mitt启奏完成] 📡           │
└─────────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│ 12. 李世民.renjieEventBus.on('qizou') [mitt监听] 👑             │
│     - 收到启奏：add_path_completed                               │
│     - 查询qizou_routes配置                                      │
│     - 决策：下旨尉迟恭添加扫描任务                                │
└─────────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│ 13. 李世民 → MessageChannel.port1.postMessage({                │
│       command: 'add_scan_task',                                 │
│       content: {path}                                           │
│     })                           [MessageChannel下旨] 📜        │
└─────────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│ 14. 尉迟恭.port2.onmessage      [MessageChannel接旨] 📜         │
│     - 收到圣旨：add_scan_task                                   │
│     - 发送奏折到房玄龄 → 袁天罡 → 天枢 → 千里眼.addToQueue()    │
└─────────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│ 15. 千里眼添加到扫描队列 → 保存到scanning.json                   │
│     - 千里眼开始扫描 → 发射IPC进度事件                           │
└─────────────────────────────────────────────────────────────────┘
```

**关键通信机制说明**：

- 📡 **mitt事件总线**：用于服务 → 李世民的启奏（广播式，解耦）
- 📜 **MessageChannel**：用于李世民 ↔ 服务的圣旨（点对点，双向确认）
- 👑 **李世民路由中心**：监听 mitt 启奏，通过 MessageChannel 下发圣旨

#### 8. 文件结构

```
src/
├── common/
│   └── interfaces/
│       ├── qizou.interface.ts            # 启奏接口定义
│       └── shengzhi.interface.ts         # 圣旨接口定义
│
├── renderer/src/services/
│   ├── renjie-event-bus.ts               # mitt事件总线配置（新增）
│   │   # 导出：renjieEventBus, RenjieEvents类型
│   │
│   ├── lishimin/                         # 李世民服务（中央路由）
│   │   ├── lishimin.ts                   # - mitt监听启奏和天界事件
│   │   │   # - 委托杜如晦下发圣旨
│   │   │   # - 事件路由决策
│   │   ├── event-routing.yml             # 事件路由配置
│   │   ├── config-loader.ts              # YAML配置加载器
│   │   └── index.ts
│   │
│   ├── duruhui/                          # 杜如晦服务（新增 - MessageChannel管理器）
│   │   ├── duruhui.ts                    # - 创建和管理MessageChannel
│   │   │   # - 提供圣旨下发接口
│   │   │   # - 监听和转发服务回复
│   │   └── index.ts
│   │
│   ├── chusuiliang/
│   │   └── chusuiliang.ts                # 褚遂良服务（更新）
│   │       # - mitt启奏李世民
│   │       # - MessageChannel接旨和回复
│   │
│   ├── yuchigong/                        # 尉迟恭服务（新增）
│   │   ├── yuchigong.ts                  # - mitt启奏李世民
│   │   │   # - MessageChannel接旨和回复
│   │   ├── interfaces.ts
│   │   └── index.ts
│   │
│   └── index.ts                          # 服务初始化
│       # - 创建杜如晦（MessageChannel管理器）
│       # - 创建李世民（依赖杜如晦）
│       # - 杜如晦建立所有服务通道
```

**依赖安装**：

```bash
npm install mitt  # 200字节的事件总线（Vue 3官方推荐）
# MessageChannel 是浏览器原生 API，无需安装
```

**架构职责分离**：

- **mitt**：启奏事件总线（服务 → 李世民，袁天罡 → 李世民）
- **杜如晦**：MessageChannel 通道管理器
- **李世民**：中央路由决策者
- **各服务**：通过 mitt 启奏，通过 MessageChannel 接旨

#### 9. 核心职责划分

| 组件         | 职责                                               | 输入                   | 输出                          |
| ------------ | -------------------------------------------------- | ---------------------- | ----------------------------- |
| **天界引擎** | 执行工作流，发射IPC事件                            | 诏令（Zhaoling）       | IPC事件                       |
| **袁天罡**   | 监听IPC事件，转换为人界事件，上报李世民            | IPC事件                | mitt事件 → 李世民             |
| **李世民**   | 中央路由，根据配置决策，委托杜如晦下旨             | mitt监听启奏和天界事件 | 路由决策 → 杜如晦             |
| **杜如晦**   | MessageChannel管理器，创建通道、下发圣旨、转呈回复 | 李世民的下旨指令       | MessageChannel圣旨 + 转呈回复 |
| **各服务**   | 接旨并执行，完成后启奏李世民                       | MessageChannel圣旨     | MessageChannel回复 + mitt启奏 |

**通信机制说明**：

- **奏折（Zouzhe）**：服务 → 房玄龄 → 袁天罡，请求天界引擎执行工作流
- **诏令（Zhaoling）**：袁天罡 → 天界引擎，命令执行工作流
- **启奏（Qizou）**：服务/袁天罡 → 李世民，通过 `mitt.emit('qizou')` 事件分发
- **圣旨（Shengzhi）**：李世民 → 杜如晦 → 服务，通过 `MessageChannel.postMessage()` 下发
- **回复**：服务 → 杜如晦 → 李世民，通过 `MessageChannel.postMessage()` 回复执行结果

#### 10. 通信体系完整性

**完整通信架构图（mitt + MessageChannel + 杜如晦）**：

```
┌─────────────────────────────────────────────────────────────────┐
│                    完整事件链路图（三层架构）                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────┐                                   ┌──────────┐   │
│  │ UI/服务  │ ─── 奏折(Zouzhe) ──→              │ 天界引擎  │   │
│  │(人界层)  │                    ↘              │(天界层)  │   │
│  └──────────┘                     房玄龄         └──────────┘   │
│       ↑                              ↓                ↓         │
│       │                           袁天罡          IPC事件       │
│       │                              ↓                ↓         │
│  MessageChannel                  诏令(Zhaoling)   监听&转换     │
│   接旨&回复                          ↓                ↓         │
│       │                         ┌──────────┐   mitt.emit()     │
│  ┌────┴─────┐                   │ 袁天罡   │──→ 人界事件       │
│  │ 各服务   │                   └──────────┘        ↓         │
│  │(褚遂良等)│                                  ┌──────────┐   │
│  └──────────┘                                  │ 李世民   │   │
│       ↓                                        │(路由中心)│   │
│  mitt.emit('qizou')                            └────┬─────┘   │
│   启奏完成    ─────────────────────────────────────→│         │
│                                                     ↓         │
│                                              路由决策         │
│                                                     ↓         │
│                                              ┌──────────┐   │
│                                              │ 杜如晦   │   │
│                                              │(通道管理)│   │
│                                              └────┬─────┘   │
│                                                   ↓         │
│                                          MessageChannel      │
│                                          postMessage(圣旨)   │
│                                                   ↓         │
│                         各服务 ←──────────────────┘         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**关键角色**：

- **📡 mitt事件总线**：启奏（服务/袁天罡 → 李世民）
- **👑 李世民**：中央路由决策
- **📋 杜如晦**：MessageChannel管理器
- **📜 MessageChannel**：圣旨下发和回复

**上行通信（人界 → 天界）**：

```
UI/服务 → 褚遂良/房玄龄
         ↓ 奏折（Zouzhe）
      房玄龄/袁天罡
         ↓ 诏令（Zhaoling）
       天界引擎
```

**下行通信（天界 → 人界 → 服务）**：

```
天界引擎 → IPC事件
         ↓
       袁天罡（监听+转换）
         ↓ 上报事件
       李世民（中央路由）
         ↓ 查询event-routing.yml
       李世民（下发圣旨）
         ↓ 圣旨（Shengzhi）
    各服务.processShengzhi()
```

**平行通信（服务 → 李世民 → 服务）**：

```
服务A完成工作流
         ↓
    window.dispatchEvent('qizou', {detail: qizou})
         ↓
    李世民监听（window.addEventListener('qizou')）
         ↓
    李世民触发路由（查询event-routing.yml）
         ↓
    下发圣旨给服务B
         ↓
    服务B.processShengzhi()
```

**关键设计要点**：

1. **启奏（Qizou）使用浏览器原生事件系统**：实现服务与李世民的解耦通信
2. **圣旨（Shengzhi）使用直接方法调用**：确保命令执行的可靠性和返回值处理
3. **李世民作为中央路由**：统一管理所有下行通信和服务间协调
4. **事件驱动架构**：支持异步、解耦的服务协作模式

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
                                      │  + event-routing.yml │
                                      └──────────────────┘
                                               ↓
                                      下发圣旨(Shengzhi)
                                               ↓
                                   ┌──────────┴──────────┐
                                   ↓                     ↓
                              褚遂良.processShengzhi()  尉迟恭.processShengzhi()
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
        PREFERENCES_CHANGED = "tianjie:preferences_changed",
        SCAN_PROGRESS = "tianjie:scan_progress",
        SCAN_COMPLETED = "tianjie:scan_completed",
        WORKFLOW_STATUS = "tianjie:workflow_status",
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
    import { TianjieEventType, TianjieEvent } from "@common/events/tianjie-events";
    import { loadEventMappingConfig } from "./config-loader";

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
                    this.emit("renjieEvent", {
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

#### 阶段3详情：Store自动同步机制 ✅ 已完成 (2025-10-15)

**目标**：实现房玄龄的元数据驱动Store同步机制，消除硬编码的matter处理逻辑。

**已完成工作**：

- ✅ 实现YAML配置驱动的Store同步机制（matter-sync.yml）
- ✅ 消除硬编码的switch case matter处理逻辑
- ✅ 实现三种同步策略：merge（深度合并）、replace（完全替换）、patch（浅层合并）
- ✅ 自动加载机制：构造函数中自动加载YAML配置
- ✅ 完整的三大偏好设置支持：theme/language/thumbnailSize
- ✅ 所有测试通过（51/51 tests passed）
- ✅ 零lint错误

**实际实现路径**：

```
src/renderer/src/services/
└── fangxuanling/
    ├── fangxuanling.ts                    # 主服务
    ├── utils.ts                           # 深度合并工具
    ├── store-automation/                  # Store自动同步模块
    │   ├── index.ts                       # 配置加载器
    │   ├── matter-sync.yml                # Store同步配置（YAML驱动）
    │   ├── store-sync-utils.ts            # 同步工具函数（纯函数）
    │   ├── store-registry.ts              # Store注册表
    │   └── __tests__/                     # 测试套件（51个测试）
    │       ├── index.test.ts
    │       ├── store-sync-utils.test.ts
    │       └── store-registry.test.ts
    └── interfaces.ts                      # 接口定义
```

**架构设计**：

```
┌─────────────────────────────────────────────────────────────┐
│  房玄龄服务目录结构                                           │
│                                                              │
│  fangxuanling/                                               │
│  ├── fangxuanling.ts          # 主服务                       │
│  ├── utils.ts                 # 工具函数                     │
│  ├── store-automation/        # 元数据配置目录                │
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
    import yaml from "js-yaml";

    /**
     * 奏折matter与Store同步元数据配置
     *
     * ⚠️ 命名重构计划 (2025-10-27)：
     * - snapshotPath → propertyPath（更准确反映其双重职责）
     * - storePath → storeName（明确是Store名称而非路径）
     * 详见：RFC 0042 "Store Automation设计说明"章节
     */
    export interface MatterSyncMetadata {
        snapshotPath: string; // 将重命名为：propertyPath
        syncStrategy: "merge" | "replace" | "patch";
        storePath: string; // 将重命名为：storeName
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
            const configContent = require("./matter-sync.yml");
            const config = yaml.load(configContent);

            logger.info(`📜 加载matter同步配置: v${config.metadata.version}`);
            logger.info(`📜 配置matters数量: ${Object.keys(config.matters).length}`);

            return config.matters;
        } catch (error) {
            logger.error("📜 加载matter同步配置失败", error);
            // ✅ 降级：返回空配置
            return {};
        }
    }
    ```

3. **房玄龄自动加载配置**

    ```typescript
    // fangxuanling/fangxuanling.ts
    import { loadMatterSyncConfig, MatterSyncMetadata } from "./metadata";

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
            tianjieResponse: ZhaolingResponse,
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
                    case "merge":
                        // 深度合并
                        this.$patch((state) => {
                            const merged = mergePreferencesFromTianjie(
                                state[syncConfig.storePath],
                                snapshot,
                            );
                            state[syncConfig.storePath] = merged;
                        });
                        logger.info(`📜 Store合并完成: ${syncConfig.storePath}`);
                        break;

                    case "replace":
                        // 完全替换
                        this.$patch({
                            [syncConfig.storePath]: snapshot,
                        });
                        logger.info(`📜 Store替换完成: ${syncConfig.storePath}`);
                        break;

                    case "patch":
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

### 三大核心偏好设置完整追踪（2025-10-15）

#### 1. Theme（主题切换）

**配置定义** (`matter-sync.yml`):

```yaml
theme_change:
    snapshotPath: "ui.theme"
    syncStrategy: "merge"
    storePath: "preferences"
    autoSync: true
    description: "用户主题变更 - 合并preferences"
```

**数据流追踪**：

```
用户操作（UI点击）
  → 褚遂良.updateTheme(themeId)
  → 房玄龄.processZouzhe({ matter: "theme_change", content: { themeId } })
  → 房玄龄.computePreferenceDelta() 计算delta = { ui: { theme: themeId } }
  → 袁天罡.executeZhaoling({ command: "UPDATE_PREFERENCES", context: { delta } })
  → 天枢.executeWorkflow("update_preferences")
  → 文昌.applyDelta(delta) 深度合并
  → 返回完整snapshot { ui: { theme, language }, display: { ... } }
  → 房玄龄.autoSyncStore("theme_change", zhaolingResponse)
    - 从response.data提取ui.theme（按snapshotPath配置）
    - 使用merge策略深度合并到preferences
    - 只更新ui.theme，保留ui.language等其他字段
  → Store.preferences.ui.theme更新
  → Vue响应式更新UI
```

**测试覆盖**：

- ✅ `store-sync-utils.test.ts`: 测试theme_change的merge策略
- ✅ 验证深度合并不会覆盖ui.language
- ✅ 验证snapshotPath="ui.theme"正确提取

#### 2. Language（语言切换）

**配置定义** (`matter-sync.yml`):

```yaml
language_change:
    snapshotPath: "."
    syncStrategy: "merge"
    storePath: "preferences"
    autoSync: true
    description: "用户语言变更 - 合并preferences"
```

**数据流追踪**：

```
用户操作（UI点击）
  → 褚遂良.updateLanguage(languageCode)
  → 房玄龄.processZouzhe({ matter: "language_change", content: { languageCode } })
  → 房玄龄.computePreferenceDelta() 计算delta = { ui: { language: languageCode } }
  → 袁天罡.executeZhaoling({ command: "UPDATE_PREFERENCES", context: { delta } })
  → 天枢.executeWorkflow("update_preferences")
  → 文昌.applyDelta(delta) 深度合并
  → 返回完整snapshot { ui: { theme, language }, display: { ... } }
  → 房玄龄.autoSyncStore("language_change", zhaolingResponse)
    - snapshotPath="." 表示使用整个snapshot
    - 使用merge策略深度合并到preferences
    - 保留所有现有字段，只更新language
  → Store.preferences.ui.language更新
  → Vue响应式更新UI
```

**测试覆盖**：

- ✅ `store-sync-utils.test.ts`: 测试snapshotPath="."的场景
- ✅ 验证深度合并整个preferences对象
- ✅ 验证不会覆盖其他字段

#### 3. ThumbnailSize（缩略图大小）

**配置定义** (`matter-sync.yml`):

```yaml
thumbnail_size_change:
    snapshotPath: "display.thumbnailSize"
    syncStrategy: "merge"
    storePath: "preferences"
    autoSync: true
    description: "缩略图大小变更 - 合并preferences"
```

**数据流追踪**：

```
用户操作（UI滑块）
  → 褚遂良.updateThumbnailSize(size)
  → 房玄龄.processZouzhe({ matter: "thumbnail_size_change", content: { thumbnailSize: size } })
  → 房玄龄.computePreferenceDelta() 计算delta = { display: { thumbnailSize: size } }
  → 袁天罡.executeZhaoling({ command: "UPDATE_PREFERENCES", context: { delta } })
  → 天枢.executeWorkflow("update_preferences")
  → 文昌.applyDelta(delta) 深度合并
  → 返回完整snapshot { ui: { ... }, display: { thumbnailSize, sortOrder, ... } }
  → 房玄龄.autoSyncStore("thumbnail_size_change", zhaolingResponse)
    - 从response.data提取display.thumbnailSize（按snapshotPath配置）
    - 使用merge策略深度合并到preferences
    - 只更新display.thumbnailSize，保留sortOrder等其他字段
  → Store.preferences.display.thumbnailSize更新
  → Vue响应式更新UI（缩略图重新渲染）
```

**测试覆盖**：

- ✅ `store-sync-utils.test.ts`: 测试display.thumbnailSize的提取和合并
- ✅ 验证深度合并不会覆盖display.sortOrder等字段
- ✅ 验证snapshotPath="display.thumbnailSize"正确提取

#### 关键设计要点

1. **snapshotPath的灵活性**：
    - `"ui.theme"` - 提取嵌套字段
    - `"."` - 使用整个snapshot
    - `"display.thumbnailSize"` - 提取深层字段

2. **merge策略的正确性**：
    - 使用`deepMergePreferences()`实现真正的深度合并
    - 基于storePath参数决定合并路径
    - 保留未修改的所有嵌套字段

3. **自动同步的可靠性**：
    - 所有matter统一使用`autoSyncStore()`方法
    - 元数据驱动，无硬编码逻辑
    - 错误处理和降级机制完善

4. **测试覆盖的完整性**：
    - 51个测试全部通过
    - 覆盖所有同步策略（merge/replace/patch）
    - 覆盖所有边界条件（空路径、无效数据等）

**结论**：三大核心偏好设置（theme/language/thumbnailSize）的完整实现已验证，数据流清晰，测试覆盖完整。

#### 4. Paths（监控路径管理）⏳ 待修复

**配置定义** (`matter-sync.yml`):

```yaml
add_path:
    snapshotPath: "."
    syncStrategy: "merge"
    storePath: "preferences"
    autoSync: true
    description: "添加监控路径 - 合并preferences.scanning.paths"

remove_path:
    snapshotPath: "."
    syncStrategy: "merge"
    storePath: "preferences"
    autoSync: true
    description: "移除监控路径 - 合并preferences.scanning.paths"
```

**当前状态**：

- ⏳ 配置已定义，但实际工作流尚未完全集成
- ⏳ 需要验证房玄龄的computePreferenceDelta()是否正确计算paths delta
- ⏳ 需要验证add_path/remove_path工作流是否正确执行
- ⏳ 需要验证Store同步后preferences.scanning.paths是否正确更新

**预期数据流**（待验证）：

```
用户操作（添加路径）
  → 褚遂良.addPath(path)
  → 房玄龄.processZouzhe({ matter: "add_path", content: { path } })
  → 房玄龄.computePreferenceDelta() 计算delta = { scanning: { paths: [...existingPaths, newPath] } }
  → 袁天罡.executeZhaoling({ command: "UPDATE_PREFERENCES", context: { delta } })
  → 天枢.executeWorkflow("update_preferences")
  → 文昌.applyDelta(delta) 深度合并
  → 返回完整snapshot { ui: { ... }, scanning: { paths: [...] }, ... }
  → 房玄龄.autoSyncStore("add_path", zhaolingResponse)
    - snapshotPath="." 表示使用整个snapshot
    - 使用merge策略深度合并到preferences
    - 更新scanning.paths数组
  → Store.preferences.scanning.paths更新
  → Vue响应式更新UI（路径列表刷新）
```

**已验证的部分**：

1. ✅ 褚遂良.addPath/removePath正确构建奏折（matter: add_path/remove_path）
2. ✅ 房玄龄使用统一的processZouzhe流程处理所有matter
3. ✅ 文昌.applyDelta()的深度合并正确处理scanning对象和paths数组（直接覆盖）
4. ✅ autoSyncStore()通过matter-sync.yml配置自动提取和合并

**发现的问题**：

1. ❌ **关键缺陷**：房玄龄缺少paths delta计算逻辑
    - 当前：直接把zouzhe.content（只包含单个path）作为context发送给天界
    - 问题：zouzhe.content不包含完整的paths数组
    - 需要：房玄龄根据current paths计算新的paths数组

    **示例**：

    ```typescript
    // ❌ 当前行为
    zouzhe.content = { path: "/new/path", pathType: "directory" };
    context = { path: "/new/path", pathType: "directory" }; // 发送给天界
    // 文昌收到的delta不包含完整paths数组！

    // ✅ 期望行为
    zouzhe.content = { path: "/new/path", pathType: "directory" };
    房玄龄计算: currentPaths = ["/path1", "/path2"];
    房玄龄构建: delta = { scanning: { paths: ["/path1", "/path2", "/new/path"] } };
    context = delta; // 发送完整delta给天界
    ```

2. ❌ 缺少完整的测试覆盖

**修复完成** ✅ (2025-10-15)：

**实现的代码**：

1. **在房玄龄中添加paths delta计算逻辑** ✅

    ```typescript
    // fangxuanling/fangxuanling.ts
    private computePathsDelta(matter: string, content: any): PreferenceDelta | null {
        if (matter === ZOUZHE_MATTERS.ADD_PATH) {
            const currentPaths = this.preference.paths; // 从Store获取
            const newPath = content.path;
            return {
                scanning: {
                    paths: [...currentPaths, newPath]
                }
            };
        }
        if (matter === ZOUZHE_MATTERS.REMOVE_PATH) {
            const currentPaths = this.preference.paths;
            const pathToRemove = content.path;
            return {
                scanning: {
                    paths: currentPaths.filter(p => p !== pathToRemove)
                }
            };
        }
        return null;
    }
    ```

2. **更新processZouzhe集成paths计算**

    ```typescript
    async processZouzhe(zouzhe: Zouzhe): Promise<ZouzheResponse> {
        // ... existing code ...

        // 特殊处理：paths需要计算delta
        let context = zouzhe.content || {};
        if (zouzhe.matter === ZOUZHE_MATTERS.ADD_PATH ||
            zouzhe.matter === ZOUZHE_MATTERS.REMOVE_PATH) {
            const pathsDelta = this.computePathsDelta(zouzhe.matter, zouzhe.content);
            if (pathsDelta) {
                context = pathsDelta; // 使用计算后的delta作为context
            }
        }

        const zhaoling: Zhaoling = {
            command: zouzhe.matter,
            context: context, // 使用处理后的context
            // ... rest of zhaoling ...
        };

        // ... rest of processZouzhe ...
    }
    ```

**实现结果**：

- [x] 阅读褚遂良.addPath()实现 ✅
- [x] 验证房玄龄统一流程 ✅
- [x] 验证文昌.applyDelta()深度合并 ✅
- [x] 识别paths delta计算缺失问题 ✅
- [x] 实现房玄龄的computePathsDelta()方法 ✅
- [x] 更新processZouzhe集成paths delta计算 ✅
- [x] 运行相关测试验证修复 ✅ (51/51 tests passed)
- [ ] 补充paths的端到端测试覆盖（可选，当前单元测试已覆盖）

**测试结果** ✅：

- fangxuanling测试：51/51 passed
- Lint检查：零错误，仅3个预存在的`any` warnings
- 修复代码：42行（computePathsDelta方法 + processZouzhe集成）

### Store边界统一实施计划

#### 阶段1详情：删除无用的scanFolders设计 ✅ 已完成

- [x] 从 Wenchang types 删除 `scanFolders` 字段
- [x] 从默认配置中移除 `scanFolders: []`
- [x] 清理相关代码和注释

#### 阶段2详情：统一preferences字段结构 ✅ 已完成

- [x] 添加 `preferences.scanning` 字段，包含：
    - `paths: string[]` (从 `appState.paths` 迁移)
    - `excludePatterns: string[]` (从 `appState.excludePaths` 迁移)
- [x] 添加 `preferences.system` 字段，包含：
    - `autoUpdate: AutoUpdateConfig` (从 `appState.autoUpdate` 迁移)
- [x] 更新房玄龄服务访问新的路径
- [x] 所有相关测试通过

#### 阶段5详情：scanningFolder迁移 📋 待规划（依赖阶段7，2025-10-15）

**目标**：将scanningFolder从Store迁移到专用服务管理，实现服务层自洽。

**依赖关系**：

- ⚠️ **依赖阶段7**：需要李世民圣旨系统先完成，才能实现addPath→自动扫描的完整链路
- 阶段7完成后，本阶段才能开始实施

**核心问题**：

1. ❌ scanningFolder在Store/UI层维护，服务层不知情
2. ❌ UI直接调用orchestrateScan()驱动扫描，逻辑在UI层
3. ❌ scanningFolder不是偏好设置，不应存储在preference中

**架构目标**：

1. ✅ **人界**：尉迟恭服务管理扫描队列UI交互
2. ✅ **天界**：千里眼引擎管理scanning.json存储和扫描执行
3. ✅ **自洽**：扫描逻辑统一到服务层，UI只依赖服务

**实施任务**（需等待阶段7完成）：

**阶段5.1：利用圣旨系统连接addPath和扫描** 📋 待实施（依赖阶段7）

- [ ] 褚遂良.addPath()完成后启奏李世民
- [ ] 李世民根据event-routing.yml下旨尉迟恭
- [ ] 测试addPath→自动扫描的完整数据流

**阶段5.2：实现尉迟恭服务（人界）** 📋 待实施

- [ ] 创建YuchiGongService管理扫描队列UI状态
- [ ] 实现processShengzhi()接收李世民指令
- [ ] 提供UI访问接口（useYuchiGong composable）
- [ ] 发送奏折到房玄龄请求扫描操作

**阶段5.3：实现千里眼scanning.json管理（天界）** 📋 待实施

- [ ] 千里眼引擎实现scanning.json读写
- [ ] 实现扫描队列管理逻辑（addToQueue, removeFromQueue）
- [ ] 与现有scan服务合并（统一扫描逻辑）
- [ ] 发射扫描进度事件到人界

**阶段5.4：建立addPath→扫描的完整链路** 📋 待实施

- [ ] 褚遂良.addPath()完成后启奏李世民
- [ ] 李世民根据event-routing.yml下旨尉迟恭
- [ ] 尉迟恭接旨后发送奏折到房玄龄
- [ ] 房玄龄→袁天罡→天枢→千里眼添加扫描任务
- [ ] 测试完整数据流

**阶段5.5：UI层重构** 📋 待实施

- [ ] 移除App.vue中的orchestrateScan()调用
- [ ] 使用useYuchiGong()访问扫描队列状态
- [ ] 更新ScanQueueDialog等组件使用新接口
- [ ] 从Store中删除scanningFolder字段

**阶段5.6：测试验证** 📋 待实施（依赖阶段7）

- [ ] 端到端测试：addPath → 自动触发扫描
- [ ] 迁移测试：确保所有功能正常
- [ ] 性能测试：扫描队列响应速度

**注意**：阶段5的技术设计已移至阶段7，因为圣旨系统是阶段7的核心内容。

---

#### 阶段6详情：useQinQiong()访问模式 ⏳ 待实施

- [ ] 创建 `useQinQiong()` composable 用于访问 `appState` 字段
- [ ] 更新所有UI组件使用 `useQinQiong()` 而非直接访问 `appState`
- [ ] 确保 `appState` 只包含真正的运行时状态

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
    store.paths;

    // ✅ 正确：通过褚遂良访问
    const chuSuiLiang = useChuSuiLiang();
    chuSuiLiang.paths;
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
    };
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

## 阶段7快速参考

### 技术栈

```bash
npm install mitt  # 200字节事件总线
# MessageChannel 是浏览器原生 API
```

### 核心组件

| 组件         | 技术               | 职责                         |
| ------------ | ------------------ | ---------------------------- |
| **启奏系统** | mitt               | 服务/袁天罡 → 李世民         |
| **李世民**   | mitt监听           | 中央路由决策                 |
| **杜如晦**   | MessageChannel管理 | 创建通道、下发圣旨、转呈回复 |
| **圣旨系统** | MessageChannel     | 李世民 → 杜如晦 → 服务       |

### 关键文件

```
src/renderer/src/services/
├── renjie-event-bus.ts      # mitt事件总线
├── lishimin/                # 李世民（路由）
├── duruhui/                 # 杜如晦（通道管理）
└── chusuiliang/             # 服务示例
```

### 数据流

```
用户操作 → 褚遂良 → mitt.emit('qizou') → 李世民 → 杜如晦 → MessageChannel
→ 服务执行 → MessageChannel回复 → 杜如晦 → 李世民
```

## 参考文档

- RFC 0035: 五引擎编排架构
- RFC 0036: 文昌偏好设置集成（实际实现基础）⭐
- RFC 0037: 驺吾(Zouwu)工作流DSL
- RFC 0040: RemovePath功能修复（架构实践）⭐
- RFC 0041: 偏好架构重构 - 业务逻辑分离（架构优化）⭐

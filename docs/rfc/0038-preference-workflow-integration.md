# RFC 0038: 偏好设置工作流集成

## 元信息
- **RFC编号**: 0038
- **标题**: 偏好设置工作流集成
- **状态**: ✅ **已完成** (Implemented)
- **创建日期**: 2025-09-28
- **完成日期**: 2025-10-10
- **关闭日期**: 2025-10-10
- **目标版本**: v2.0.0
- **相关RFC**:
  - RFC 0036: 文昌偏好集成（已完成）✅
  - RFC 0040: RemovePath功能修复（已完成）✅
  - RFC 0041: 偏好架构重构（已完成）✅
  - RFC 0039: 天枢工作流语法规范

## 摘要

本RFC描述将偏好设置管理完全集成到Tianshu工作流系统中的架构设计，实现统一的、工作流驱动的偏好设置管理，消除前后端分离的概念，建立"一个系统"的偏好设置架构。

**实际实现说明**：本RFC提出的激进架构（直接从Store调用window.tianshu）在实践中被RFC 0036/0040/0041采用的更实用架构取代。当前实现保留了服务层（褚遂良→房玄龄→袁天罡），更符合职责分离和可维护性原则。

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

#### 1. 强制性调用链
```
前端 → window.tianshu.processCommand() → TianshuService.processCommand() → TianshuEngine → 工作流执行 → Taiyi → WenchangEngine
```

**绝对禁止**：
- TaiyiService暴露内部engine
- TianshuService提供除processCommand外的任何方法
- 任何绕过工作流的直接调用

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

### 阶段2：功能验证和测试完善 ✅ 已完成

- [x] **偏好设置启动加载测试** - GET_PREFERENCES完整流程测试通过
- [x] **工作流执行端到端测试** - THEME_CHANGE工作流测试通过
- [x] **错误处理和降级测试** - 天枢引擎错误处理测试通过
- [x] **集成测试** - 褚遂良→房玄龄→袁天罡→天枢→文昌完整流程验证通过

**测试文件**: `src/renderer/src/services/__tests__/preference-integration.test.ts`
**测试结果**: 4/4 passed ✅

#### 阶段3：文档和清理（可选，不影响完成状态）
- [ ] 清理遗留的pathOperations代码（如果存在）
- [ ] 更新开发文档和架构图
- [ ] 性能分析和优化（如有必要）

### ❌ 不需要做的工作（过度工程）

RFC 0038最初提出的"直接从Store调用window.tianshu"方案**不应实施**，原因：

1. **违反职责分离**：Store不应包含业务逻辑
2. **降低可维护性**：去掉服务层会使职责模糊
3. **不符合"好品味"**：当前架构更清晰、更优雅

### 下一步行动

**优先级1（必须）**：
1. 编写偏好设置启动加载的集成测试
2. 验证工作流执行的端到端流程
3. 测试错误处理和降级场景

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

#### 实际实现的架构（RFC 0036/0040/0041）
```typescript
// Store → 褚遂良 → 房玄龄 → 袁天罡 → 天枢 → 文昌
褚遂良.updateTheme(themeId)
  → 房玄龄.processZouzhe({ matter: THEME_CHANGE, content: { themeId } })
    → 袁天罡.executeZhaoling({ command: THEME_CHANGE, context: delta })
      → 天枢.executeWorkflow("update_preferences")
        → 文昌.applyDelta(delta)
```

### 为什么采用了不同的架构？

1. **职责分离更清晰**
   - 褚遂良：验证输入，构建奏折
   - 房玄龄：业务逻辑，计算delta
   - 袁天罡：协议转换，参数包装
   - 服务层的存在使每一步职责明确

2. **更好的可维护性**
   - 业务逻辑集中在房玄龄，不散落在Store中
   - 类型安全和错误处理更完善
   - 测试更容易编写和维护

3. **符合Linus"好品味"原则**
   - 消除了pathOperations等特殊情况
   - 使用统一的delta格式
   - 代码更简洁，边界更清晰

### 已完成的工作 ✅

1. **工作流已创建**
   - `get_preferences.yml` - 获取偏好设置
   - `update_preferences.yml` - 更新偏好设置
   - 其他管理工作流

2. **完整的调用链**
   - 褚遂良 → 房玄龄 → 袁天罡 → 天枢 → 文昌
   - 严格的架构边界，无直接调用

3. **业务逻辑分离**
   - 房玄龄负责业务逻辑计算（computePreferenceDelta）
   - 文昌引擎只负责纯存储（applyDelta）
   - 清晰的职责划分

4. **测试验证**
   - 单元测试通过 ✅
   - 用户验证通过 ✅
   - UI更新和存储保存完全正常 ✅

### 结论

RFC 0038的核心目标（工作流驱动的偏好设置管理）已经实现，但采用了更实用的架构设计。这种架构调整是在实践中基于Linus Torvalds的"好品味"原则做出的优化，最终实现了更清晰、更易维护的代码。

## 参考文档

- RFC 0035: 五引擎编排架构
- RFC 0036: 文昌偏好设置集成（实际实现基础）⭐
- RFC 0037: 天枢YAML工作流DSL
- RFC 0040: RemovePath功能修复（架构实践）⭐
- RFC 0041: 偏好架构重构 - 业务逻辑分离（架构优化）⭐

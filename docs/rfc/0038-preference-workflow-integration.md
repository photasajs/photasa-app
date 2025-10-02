# RFC 0038: 偏好设置工作流集成

## 摘要

本RFC描述将偏好设置管理完全集成到Tianshu工作流系统中的架构设计，实现统一的、工作流驱动的偏好设置管理，消除前后端分离的概念，建立"一个系统"的偏好设置架构。

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

## 迁移计划

### 阶段1：架构修正（已完成）
- [x] 移除架构违规的直接调用
- [x] 重命名文件和类型，消除前后端概念
- [x] 建立正确的工作流调用

### 阶段2：功能验证
- [ ] 完整的偏好设置加载和更新测试
- [ ] 工作流执行验证
- [ ] 错误处理验证

### 阶段3：优化和扩展
- [ ] 性能优化
- [ ] 新增偏好设置项目支持
- [ ] AI集成准备

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

## 参考文档

- RFC 0035: 五引擎编排架构
- RFC 0036: 文昌偏好设置集成
- RFC 0037: 天枢YAML工作流DSL

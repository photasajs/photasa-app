# RFC 0044: 移除computeDelta反模式，统一天界业务逻辑

- **RFC编号**: 0044
- **标题**: 移除computeDelta反模式，统一天界业务逻辑
- **作者**: Builder (Claude Code)
- **创建日期**: 2025-10-19
- **状态**: 📋 待审查
- **类型**: 架构重构
- **优先级**: 中
- **依赖RFC**:
    - RFC 0038: 偏好设置工作流集成
    - RFC 0042: 扫描文件夹迁移
- **相关文件**:
    - `src/renderer/src/services/fangxuanling/fangxuanling.ts`
    - `src/engines/tianshu/workflows/preference/update_preferences.zouwu`

---

## 摘要

当前`FangXuanLingService.computePathsDelta()`方法违反了架构分层原则，将业务逻辑放在人界而不是天界。本RFC提议删除此反模式，将"计算完整数组"的逻辑移至天界工作流。

## 问题陈述

### 当前实现（反模式）

```typescript
// ❌ 人界房玄龄计算完整paths数组
private computePathsDelta(matter: string, content: Record<string, unknown>): Record<string, unknown> | null {
    if (matter === ZOUZHE_MATTERS.ADD_PATH) {
        const store = usePreferenceStore();
        const currentPaths = store.preferences?.scanning?.paths || [];
        const newPath = content.path as string;

        return {
            scanning: {
                paths: [...currentPaths, newPath], // ❌ 在人界计算
            },
        };
    }
    // ...
}
```

### 为什么这是反模式？

1. **违反职责分离**：人界（Renderer）负责业务逻辑"计算完整数组"
2. **重复数据源**：人界Store和天界preferences.json都有paths数据
3. **特殊情况**：为什么`add_path`需要特殊处理，而其他matter不需要？
4. **不可维护**：每个需要"数组操作"的matter都要写compute方法

### Linus会说什么？

> "为什么`add_path`是特殊的？如果系统设计正确，所有matter应该走同样的流程！这是糟糕的品味！"

## 正确的架构

### 目标架构

```typescript
// ✅ 人界只发送单个path
const zouzhe: Zouzhe = {
    department: GUANYUAN_NAMES.CHU_SUILIANG,
    matter: ZOUZHE_MATTERS.ADD_PATH,
    content: { path: "/new/path" }, // ✅ 只发单个path
};

// ✅ 房玄龄processZouzhe()走统一流程（零特殊处理）
// 1. 构造诏令给天界
// 2. 天界工作流计算完整paths
// 3. 天界返回完整快照
// 4. Store Automation自动同步
```

### 天界工作流处理

```yaml
# src/engines/tianshu/workflows/preference/add_path.yml (新建)
id: "add_path"
name: "添加监控路径"

inputs:
    path:
        type: "string"
        required: true

steps:
    - id: "get_current_preferences"
      name: "文昌：读取当前偏好设置"
      type: "action"
      service: "wenchang"
      action: "getPreferences"

    - id: "compute_new_paths"
      name: "计算新的paths数组"
      type: "builtin"
      action: "transform"
      input:
          currentPaths: "{{steps.get_current_preferences.scanning.paths}}"
          newPath: "{{inputs.path}}"
          transform: "append" # 内置数组操作

    - id: "update_preferences"
      name: "文昌：更新偏好设置"
      type: "action"
      service: "wenchang"
      action: "updatePreferences"
      input:
          delta:
              scanning:
                  paths: "{{steps.compute_new_paths.result}}"
```

## 实施计划

### Phase 1: 创建天界工作流（1天）

- [ ] 创建`add_path.yml`工作流
- [ ] 创建`remove_path.yml`工作流
- [ ] 实现内置`transform`操作（数组append/filter）
- [ ] 测试工作流

### Phase 2: 删除computePathsDelta（0.5天）

- [ ] 删除`computePathsDelta()`方法
- [ ] 删除processZouzhe()中的特殊if判断
- [ ] 更新intent映射（add_path → add_path.yml）

### Phase 3: 验证（0.5天）

- [ ] 端到端测试
- [ ] 零lint错误
- [ ] 100%测试覆盖率

## 影响分析

### 优点

1. ✅ **消除特殊情况** - 所有matter走统一流程
2. ✅ **正确的职责分离** - 天界负责业务逻辑
3. ✅ **删除代码** - 删除42行computePathsDelta方法
4. ✅ **易于扩展** - 新的数组操作只需添加工作流

### 风险

- 需要修改现有工作流
- 需要实现内置transform操作

## 验收标准

- ✅ 删除`computePathsDelta()`方法
- ✅ `add_path`和`remove_path`通过天界工作流处理
- ✅ 零特殊if判断
- ✅ 所有测试通过
- ✅ 零lint错误

## 备注

此RFC受RFC 0042启发：在实施扫描队列时发现computePathsDelta是同样的反模式。

---

**状态**: 等待架构师审查

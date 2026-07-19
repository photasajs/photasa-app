# RFC 0036: 偏好设置启动加载和保存机制

- **RFC编号**: 0036
- **标题**: 偏好设置启动加载和保存机制
- **作者**: 李鹏
- **开始日期**: 2025-10-09
- **状态**: ✅ **已完成**
- **完成日期**: 2025-10-09
- **类型**: 增强
- **相关RFC**: RFC 0041 (偏好架构重构)

## 1. 问题定义与解决状态

### 1.1 核心问题（✅ 已解决）

1. ~~**映射缺失**~~：✅ `GET_PREFERENCES`已映射到天枢引擎 ([yuantiangang.ts:193](../../../src/renderer/src/services/yuantiangang/yuantiangang.ts#L193))
2. ~~**架构违反**~~：✅ 已删除`initializeGovernance`，所有操作通过奏折系统 (2025-10-09)
3. ~~**数据处理**~~：✅ 实现智能合并机制 `mergePreferencesFromTianjie` ([utils.ts:61](../../../src/renderer/src/services/fangxuanling/utils.ts#L61))

### 1.2 实施状况

- ✅ **架构统一**：所有偏好操作通过奏折系统处理
- ✅ **启动加载**：应用启动时从天界获取偏好设置 ([li-shi-ming.service.ts:64](../../../src/renderer/src/services/li-shi-ming.service.ts#L64))
- ✅ **智能合并**：天界数据与本地设置智能合并 (纯函数实现)
- ✅ **实时保存**：偏好变更时保存到天界 (RFC 0041架构)

### 1.3 目标达成

建立完整的偏好设置双向通信机制：

1. ✅ **架构统一**：所有偏好操作通过奏折系统处理
2. ✅ **启动加载**：应用启动时从天界获取偏好设置
3. ✅ **智能合并**：天界数据与本地设置智能合并
4. ✅ **实时保存**：偏好变更时保存到天界

## 2. 通信流程设计

### 2.1 偏好加载流程（修正后）

```
UI启动 → 房玄龄服务初始化
       ↓
       内部发送奏折(GET_PREFERENCES) → 房玄龄.processZouzhe()
       ↓
       诏令(get_preferences) → 袁天罡
       ↓
       符箓(get_preferences) → 天枢引擎
       ↓
       太乙委派 → 文昌引擎.getCurrentSnapshot()
       ↓
       天界偏好数据 ← 返回当前偏好状态
       ↓
       智能合并(天界数据 + 本地默认值) → 更新Store
```

### 2.2 偏好保存流程

```
UI变更 → 房玄龄.preference.updateTheme()
       ↓
       奏折(THEME_CHANGE) → 房玄龄
       ↓
       诏令(theme_change) → 袁天罡
       ↓
       符箓(update_config) → 天枢引擎
       ↓
       太乙委派 → 文昌引擎.applyDelta()
       ↓
       保存完成 ← 返回新版本号
```

## 3. 映射配置

### 3.1 需要添加的袁天罡映射

```typescript
const intentMapping: Record<string, string> = {
    // 现有映射
    [ZOUZHE_MATTERS.THEME_CHANGE]: "update_config",
    [ZOUZHE_MATTERS.LANGUAGE_CHANGE]: "update_config",
    [ZOUZHE_MATTERS.NOTIFICATION_SHOW]: "get_status",
    [ZOUZHE_MATTERS.PHOTO_SWITCH]: "scan_folder",

    // 新增映射 - 解决偏好加载问题
    [ZOUZHE_MATTERS.GET_PREFERENCES]: "get_preferences",
};
```

### 3.2 天枢引擎UserIntent扩展

需要支持的intent类型：

- `get_preferences` - 获取当前偏好配置
- `update_config` - 更新偏好配置（已支持）

### 3.3 太乙-文昌适配器

太乙需要将天枢的请求路由到文昌引擎：

- `get_preferences` → `WenchangEngine.getCurrentSnapshot()`
- `update_config` → `WenchangEngine.applyDelta()`

## 4. 数据合并策略

### 4.1 合并原则

```typescript
// 合并优先级：天界数据 > 本地用户设置 > 应用默认值
const mergedPreferences = {
    ...applicationDefaults, // 应用默认值作为基础
    ...localUserSettings, // 本地用户设置覆盖默认值
    ...tianjieData, // 天界数据具有最高优先级
};
```

### 4.2 处理策略

- **保留本地独有设置**：天界没有的本地设置保持不变
- **同步天界权威数据**：theme、language等关键设置以天界为准
- **渐进式合并**：避免丢失用户的临时设置

## 5. 实施计划

### 5.1 第一阶段：架构修正

1. 删除或重构`initializeGovernance`，改用`processZouzhe(GET_PREFERENCES)`
2. 在袁天罡中添加`get_preferences` → `get_preferences`映射
3. 确保天枢引擎支持`get_preferences` UserIntent

### 5.2 第二阶段：数据合并

1. 实现智能合并逻辑
2. 确保天界数据与本地设置正确合并
3. 验证合并策略不会丢失用户设置

### 5.3 第三阶段：测试验证

1. 测试启动时偏好加载和合并
2. 测试偏好变更保存
3. 验证完整的双向通信

### 5.4 成功标准

- ✅ 所有偏好操作通过统一奏折系统处理
- ✅ 天界偏好数据能正确加载并智能合并
- ✅ 偏好变更能正确保存到文昌引擎
- ✅ 应用重启后偏好设置保持一致且不丢失用户设置

## 6. ✅ RFC 0036 完成总结 (2025-10-09)

### 🎉 核心成就

RFC 0036已成功完成所有既定目标，建立了完整的偏好设置双向通信机制。

### 📊 实施验证

#### 已实现组件清单：

1. **GET_PREFERENCES映射**（袁天罡）✅
    - 文件：[yuantiangang.ts:193](../../../src/renderer/src/services/yuantiangang/yuantiangang.ts#L193)
    - 映射：`[ZOUZHE_MATTERS.GET_PREFERENCES]: "get_preferences"`

2. **天枢工作流**（天枢引擎）✅
    - 文件：[get_preferences.zouwu](../../../src/engines/tianshu/workflows/preference/get_preferences.zouwu)
    - 功能：完整的偏好获取工作流，支持文昌引擎快照

3. **文昌适配器方法**（WenchangAdapter）✅
    - 文件：[WenchangAdapter.ts:79](../../../src/engines/adapters/WenchangAdapter.ts#L79)
    - 方法：`getCurrentSnapshot()`返回当前偏好状态

4. **App启动时偏好加载**（李世民服务）✅
    - 文件：[li-shi-ming.service.ts:64](../../../src/renderer/src/services/li-shi-ming.service.ts#L64)
    - 流程：启动时调用`initializePreferences()`
    - 入口：[main.ts:52](../../../src/renderer/src/main.ts#L52) `await LishiminService.startZhengguan()`

5. **智能数据合并**（房玄龄工具函数）✅
    - 文件：[utils.ts](../../../src/renderer/src/services/fangxuanling/utils.ts)
    - 函数：`mergePreferencesFromTianjie()`纯函数 (L61)
    - 函数：`deepMergePreferences()`深度合并 (L24)

6. **Store更新机制**（房玄龄服务）✅
    - 文件：[fangxuanling.ts:564-573](../../../src/renderer/src/services/fangxuanling/fangxuanling.ts#L564-L573)
    - 处理：`GET_PREFERENCES`处理和智能合并

7. **完整测试覆盖**✅
    - 391个测试通过，3个跳过（需要完整mock的集成测试）
    - GET_PREFERENCES相关测试已覆盖

### 🔄 实际数据流（已验证）

```
App启动 → LiShiMingService.startZhengguan()
       ↓
       ChuSuiLiangService.initializePreferences()
       ↓
       发送奏折(GET_PREFERENCES) → FangXuanLingService.processZouzhe()
       ↓
       策略执行器处理 → PathOperationStrategy
       ↓
       诏令(get_preferences) → YuanTianGangService.executeZhaoling()
       ↓
       符箓转换(get_preferences) → TianshuEngine
       ↓
       执行工作流 → get_preferences.zouwu
       ↓
       调用WenchangAdapter.getCurrentSnapshot()
       ↓
       返回天界偏好数据
       ↓
       房玄龄智能合并(mergePreferencesFromTianjie)
       ↓
       更新PreferenceStore
```

### 🎯 架构优势

1. **统一通信架构**：所有偏好操作通过奏折系统，消除了架构违反
2. **智能数据合并**：纯函数实现，易于测试，保证数据一致性
3. **天界-人界同步**：启动时自动加载，变更时实时保存
4. **高可测试性**：391个测试通过，覆盖关键流程

### 📝 相关文档

- **RFC 0041**: 偏好架构重构 - 业务逻辑与存储层分离
- **实现文件**:
    - 袁天罡：`src/renderer/src/services/yuantiangang/yuantiangang.ts`
    - 房玄龄：`src/renderer/src/services/fangxuanling/fangxuanling.ts`
    - 褚遂良：`src/renderer/src/services/chusuiliang/chusuiliang.ts`
    - 李世民：`src/renderer/src/services/li-shi-ming.service.ts`
    - 文昌适配器：`src/engines/adapters/WenchangAdapter.ts`
    - 工作流：`src/engines/tianshu/workflows/preference/get_preferences.zouwu`

### ✅ 验证完成日期

2025-10-09

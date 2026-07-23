# RFC 0058: 长孙无忌菜单服务 - 统一菜单管理到 qizou 流程

## 元数据

- **RFC 编号**: 0058
- **标题**: 长孙无忌菜单服务 - 统一菜单管理到 qizou 流程
- **状态**: ✅ 已实现
- **作者**: AI
- **创建日期**: 2025-11-30
- **最后更新**: 2026-07-23
- **目标版本**: v2.0.0
- **关联 RFC**: RFC 0057, RFC 0038, RFC 0042

---

## 摘要

将 legacy 菜单管理（Pinia store + 直接 IPC 调用）统一到 qizou-shengzhi 架构，创建**长孙无忌**（ZhangSunWuJi）服务专门负责菜单的 UI 管理和同步。彻底消除 Renderer 进程直接调用 `window.api.applySystemMenu` 的反模式，实现架构一致性。

---

## 背景与动机

### 当前问题

**直接 IPC 调用反模式**（违反服务模式原则）：

```typescript
// ❌ 问题1: TitlebarMac.vue 直接调用 window.api.applySystemMenu
// src/renderer/src/components/TitlebarMac.vue:60-68
watch(
    () => menusStore.menus,
    (newMenus) => {
        if (window.api?.applySystemMenu) {
            window.api.applySystemMenu(JSON.parse(JSON.stringify(newMenus)));
        }
    },
    { immediate: true, deep: true },
);

// ❌ 问题2: 菜单点击事件直接通过 IPC 监听
// src/renderer/src/components/TitlebarMac.vue:75-87
if (window.api?.onMenuAction) {
    const handler = (payload: any) => {
        emit("menu-action", payload);
    };
    window.api.onMenuAction(handler);
}

// ❌ 问题3: 多个组件直接访问 menusStore
// src/renderer/src/App.vue:190
menusStore.refreshMenus(t);
// src/renderer/src/components/LanguageSwitcher.vue:36
menusStore.refreshMenus(t);
```

**架构违规**：
1. **直接 IPC 访问**：Vue 组件直接调用 `window.api.applySystemMenu`，绕过 qizou-shengzhi 架构
2. **直接 Store 访问**：多个组件直接访问 `menusStore`，违反服务模式
3. **职责混乱**：菜单管理逻辑分散在多个组件中
4. **主进程服务未统一**：主进程的 `MenuService` 使用 `@Service` 装饰器，但渲染进程未统一

### 为什么需要新服务？

**职责分离**：
- **当前**：菜单数据在 Pinia store，同步逻辑在 Vue 组件，IPC 调用在 preload
- **目标**：统一由服务管理，组件通过 composable 访问

**架构一致性**：
- 遵循 RFC 0057 的服务模式（参考 YuShiNan）
- 菜单更新通过 qizou-shengzhi 流程
- 菜单点击事件也通过 qizou-shengzhi 流程

### 长孙无忌的历史背景

**长孙无忌**（ZhangSunWuJi，字辅机，594-659年）：
- 唐朝著名政治家、开国功臣
- 贞观年间官至**司空**，负责**朝廷礼仪和接待**
- 以"**礼仪严谨**"著称，精通朝廷礼仪规范
- 主持编纂《唐律疏议》，负责**规范制定**

**在架构中的职责**（符合历史角色）：
- 作为"礼仪官"，负责**菜单的规范管理**
- **同步**菜单数据到主进程（通过 qizou-shengzhi）
- **处理**菜单点击事件（通过 qizou-shengzhi）
- 职责单一：只负责菜单 UI 层，不参与业务逻辑

---

## 解决方案设计

### 架构概览

**新架构流程**：

```
菜单更新流程（通过 zouzhe + 袁天罡 IPC）：
Vue 组件（App.vue, LanguageSwitcher.vue）
    ↓
useZhangSunWuJi() composable
    ↓
长孙无忌服务（ZhangSunWuJiService）
    ├─ refreshMenus(t) → 更新 menusStore（通过房玄龄）
    └─ 发送 UPDATE_MENU zouzhe 到房玄龄
         ↓
房玄龄处理 zouzhe
    └─ 创建 zhaoling，发送给袁天罡
         ↓
袁天罡执行 zhaoling（update_menu）
    └─ 转换为符箓，发送到天枢引擎
         ↓
天枢引擎执行工作流（menu.apply）
    └─ 调用 TaibaijinxingAdapter.applySystemMenu()
         ↓
TaibaijinxingAdapter 直接实现菜单逻辑
    ├─ 平台检查：仅 macOS 处理系统菜单（process.platform === "darwin"）
    ├─ 转换菜单：transformMenus() 过滤平台专属项（isMacOnly）
    ├─ 设置菜单：Menu.setApplicationMenu()
    └─ 处理点击：菜单项点击时发送 menu:action IPC 到渲染进程

菜单点击流程（通过 qizou-shengzhi）：
用户点击菜单项
    ↓
TaibaijinxingAdapter（菜单项 click 回调）
    └─ 发送 menu:action IPC 到渲染进程（mainWindow.webContents.send）
         ↓
袁天罡监听 IPC（menu:action）
    └─ 发送 MENU_ACTION qizou
         ↓
李世民路由到长孙无忌（根据 event-routing.yml）
    ↓
长孙无忌处理（handleMenuAction）
    └─ 根据菜单项 key 分发到相应服务或 emit 事件
```

### 服务接口设计

```typescript
/**
 * 长孙无忌服务接口
 * 负责菜单的 UI 管理和同步
 *
 * 架构原则：
 * - ❌ 长孙无忌不持有响应式状态
 * - ❌ UI 组件不能直接访问 `menusStore`（违反服务模式）
 * - ✅ 菜单数据存储在 `menusStore`（Pinia Store，作为响应式状态容器）
 * - ✅ 长孙无忌通过房玄龄的 Accessor 访问 `menusStore`（只读）
 * - ✅ 长孙无忌通过 zouzhe 更新 `menusStore`（通过房玄龄）
 * - ✅ UI 组件必须通过 `useZhangSunWuJi()` 访问菜单数据（服务接口）
 *
 * **为什么需要 `menusStore`？**
 * 1. **响应式需求**：Vue 组件需要响应式菜单数据，Store 提供响应式状态管理
 * 2. **跨组件共享**：多个组件需要访问菜单数据，Store 作为单一数据源（SSOT）
 * 3. **运行时状态**：菜单数据是运行时状态，不需要持久化，但需要响应式更新
 * 4. **符合 Accessor 模式**：遵循 RFC 0043 的 Accessor 模式，Store 作为响应式状态容器，服务通过房玄龄访问
 * 5. **架构一致性**：所有状态访问都通过服务层，保持架构一致性
 */
export interface IZhangSunWuJiService {
    /**
     * 当前菜单数据（只读）
     * 长孙无忌通过房玄龄访问 menusStore.menus
     */
    readonly menus: MenuItemData[];

    /**
     * 刷新菜单（国际化）
     * 当语言切换时调用，更新菜单的 label
     */
    refreshMenus(t: (key: string) => string): void;

    /**
     * 设置菜单项禁用状态
     */
    setMenuDisabled(key: string, disabled: boolean): void;

    /**
     * 处理菜单点击事件
     * 由主进程菜单点击事件触发（通过 qizou-shengzhi）
     */
    handleMenuAction(payload: MenuActionPayload): void;
}
```

### 数据流设计

**菜单更新流程**（通过 zouzhe + 天枢引擎）：
1. Vue 组件调用 `zhangSunWuJi.refreshMenus(t)`
2. 长孙无忌更新 `menusStore`（通过房玄龄）
3. 长孙无忌发送 `UPDATE_MENU` zouzhe 到房玄龄（`fangXuanLingService.processZouzhe()`）
4. 房玄龄处理 zouzhe，创建 `zhaoling`，发送给袁天罡（`yuanTianGang.executeZhaoling()`）
5. 袁天罡执行 zhaoling，转换为符箓，发送到天枢引擎（`sendFuluToTianshu()`）
6. 天枢引擎执行工作流（`menu.apply`），调用主进程 `MenuService` 设置菜单
7. 主进程 `MenuService` 接收并设置菜单

**架构原则**：
- ✅ **所有与主进程的 IPC 通信都必须通过天枢引擎**（统一工作流编排）
- ✅ **菜单更新通过 zouzhe + 天枢引擎流程**：长孙无忌 → 房玄龄 → 袁天罡 → 天枢引擎 → 主进程
- ✅ **职责清晰**：长孙无忌（菜单管理）→ 房玄龄（内政处理）→ 袁天罡（符箓转换）→ 天枢引擎（工作流编排）→ 主进程（菜单设置）
- ✅ **zouzhe 用于内政事务**：菜单更新是内部状态同步，不需要跨部门协调（qizou）
- ✅ **天枢引擎统一编排**：所有 IPC 调用都通过天枢引擎，保持架构一致性（参考 RFC 0042 教训）
- ❌ **禁止直接 IPC 调用**：任何服务都不能直接调用 `window.api.applySystemMenu`

**菜单点击流程**（通过 qizou-shengzhi）：
1. 用户点击菜单项
2. `TaibaijinxingAdapter` 的菜单项 `click` 回调触发
3. 适配器发送 `menu:action` IPC 到渲染进程（`mainWindow.webContents.send("menu:action", payload)`）
4. 袁天罡监听 `menu:action` IPC，发送 `MENU_ACTION` qizou
5. 李世民路由到长孙无忌（根据 `event-routing.yml`）
6. 长孙无忌处理菜单点击（`handleMenuAction()`，根据菜单项 key 分发到相应服务或 emit 事件）

---

## 实施计划

### Phase 1: 创建服务接口和实现骨架

**目标**：创建 `IZhangSunWuJiService` 接口和 `ZhangSunWuJiService` 实现骨架

**任务**：
1. 创建 `src/renderer/src/interfaces/zhang-sun-wu-ji.interface.ts`
   - 定义 `IZhangSunWuJiService` 接口
   - 定义 `MenuActionPayload` 类型
   - 定义 `ZHANG_SUN_WU_JI_TOKEN`
2. 创建 `src/renderer/src/services/zhangsunwuji/zhangsunwuji.ts`
   - 实现 `IService` 接口
   - 实现 `IZhangSunWuJiService` 接口
   - 实现基础方法（getters, refreshMenus, setMenuDisabled）
3. 创建 `src/renderer/src/composables/useZhangSunWuJi.ts`
   - 提供 `useZhangSunWuJi()` composable
   - 返回响应式 refs 和方法

**验收标准**：
- ✅ 服务接口定义完整
- ✅ 服务实现骨架完成
- ✅ Composable 可用

### Phase 2: 集成到李世民服务

**目标**：在 `LishiminService` 中注册和管理 `ZhangSunWuJiService`

**任务**：
1. 更新 `src/renderer/src/services/lishimin/lishimin.ts`
   - 实例化 `ZhangSunWuJiService`
   - 连接到 `duRuHuiService` 和 `qizouBus`
   - 在 `startZhengguan()` 中初始化
2. 更新 `src/renderer/src/main.ts`
   - 通过 `useZhangSunWuJi()` 提供服务（如果需要）

**验收标准**：
- ✅ 服务在 `LishiminService` 中注册
- ✅ 服务可以接收圣旨
- ✅ 服务可以发送 qizou

### Phase 3: 实现菜单更新流程（zouzhe + 袁天罡 IPC）

**目标**：菜单更新通过 zouzhe 流程，由袁天罡发送 IPC 到主进程

**任务**：
1. 更新 `src/renderer/src/interfaces/fang-xuan-ling.interface.ts`
   - 在 `ZOUZHE_MATTERS` 中添加 `UPDATE_MENU: "update_menu"`
   - 在 `GUANYUAN_NAMES` 中添加 `ZHANG_SUN_WU_JI: "长孙无忌"`（如果尚未添加）
2. 实现 `ZhangSunWuJiService.refreshMenus()`
   - 更新 `menusStore`（通过房玄龄）
   - 创建 `UPDATE_MENU` zouzhe，发送到房玄龄（`fangXuanLingService.processZouzhe()`）
3. 更新 `src/renderer/src/services/yuantiangang/intent.ts`
   - 在 `IntentToFuluMapping` 中添加 `UPDATE_MENU` 映射：
     ```typescript
     [ZOUZHE_MATTERS.UPDATE_MENU]: "menu.apply"
     ```
4. 创建菜单适配器（`src/engines/adapters/TaibaijinxingAdapter.ts`）：
   - 使用 `@Adapter` 装饰器注册
   - 名称：`taibaijinxing`（太白金星）
   - 显示名称：`太白金星菜单适配器`
   - **直接实现菜单逻辑**（不依赖 MenuService）：
     - 实现 `applySystemMenu(menus: MenuItemData[])` 方法
     - **平台检查**：仅 macOS 处理系统菜单（`process.platform === "darwin"`）
     - **菜单转换**：`transformMenus()` 方法，将 `MenuItemData[]` 转换为 `Electron.MenuItemConstructorOptions[]`
       - 处理分隔符（`type === "separator"`）
       - 过滤平台专属项（`item.isMacOnly && process.platform !== "darwin"` 时返回 null）
       - 递归处理子菜单（`item.items`）
     - **设置菜单**：`Menu.buildFromTemplate()` + `Menu.setApplicationMenu()`
     - **菜单点击处理**：菜单项 `click` 回调中发送 `menu:action` IPC 到渲染进程
       - 通过 `mainWindow.webContents.send("menu:action", {...})` 发送
   - **依赖注入**：需要 `IpcMain` 和 `BrowserWindow`
     - 适配器构造函数接收 `(ipcMain: IpcMain, mainWindow: BrowserWindow)`
     - 通过 `AdapterRegistry.initializeAll(ipcMain, mainWindow)` 传递
     - 需要在适配器初始化时确保这些依赖已可用
   - **神话背景**：太白金星，中国神话中广为人知的神祇，玉皇大帝的顾问，负责沟通与协调，作为天庭的"门面"代表。在架构中负责菜单界面管理，菜单是应用的门面，太白金星作为天庭顾问，负责协调与展示，与菜单适配器的职责高度契合。
   - **注意**：天界（Main进程）使用神话人物命名，人界（Renderer进程）使用历史人物命名（长孙无忌）
5. 在主进程创建菜单工作流（`src/engines/tianshu/workflows/menu.apply.yml`）：
   - 定义 `menu.apply` 工作流
   - 调用 `taibaijinxing` 适配器的 `applySystemMenu` action
6. **移除 `MenuService`**（`src/main/menu/menu-service.ts`）：
   - 菜单逻辑已迁移到 `TaibaijinxingAdapter`
   - 从 `src/main/tianting/index.ts` 移除 `MenuService` 导入
   - 从 `src/main/startup-optimizer.ts` 移除 `createMenuService()` 调用
   - **向后兼容**：如果仍有旧代码通过 IPC `menu:applySystemMenu` 调用，可以保留一个简单的 IPC 监听器，转发到适配器（可选）

**验收标准**：
- ✅ 菜单更新通过 zouzhe + 天枢引擎流程（长孙无忌 → 房玄龄 → 袁天罡 → 天枢引擎）
- ✅ `UPDATE_MENU` 已添加到 `ZOUZHE_MATTERS` 和 `IntentToFuluMapping`
- ✅ `TaibaijinxingAdapter` 已创建并注册到太乙适配器注册中心
- ✅ `TaibaijinxingAdapter` 直接实现菜单逻辑（不依赖 MenuService）
- ✅ 平台差异处理由适配器处理（macOS 专用，自动过滤平台专属项）
- ✅ 菜单点击事件通过 IPC `menu:action` 发送到渲染进程
- ✅ 天枢引擎工作流 `menu.apply` 已创建，调用 `taibaijinxing.applySystemMenu()`
- ✅ `MenuService` 已移除（逻辑已迁移到适配器）
- ✅ **命名规则**：天界（Main进程）使用神话人物（天窗），人界（Renderer进程）使用历史人物（长孙无忌）
- ✅ 主进程可以接收菜单更新
- ✅ 没有直接 IPC 调用（所有 IPC 都通过天枢引擎）

### Phase 4: 实现菜单点击事件流程（qizou-shengzhi）

**目标**：菜单点击事件通过 qizou-shengzhi 流程

**任务**：
1. 更新 `src/renderer/src/constants/qizou-shengzhi-commands.ts`
   - 添加 `MENU_ACTION` qizou matter
2. 更新 `src/renderer/src/services/lishimin/event-routing.yml`
   - 添加 `menu_action` 路由到 `长孙无忌`
3. 实现 `ZhangSunWuJiService.handleMenuAction()`
   - 接收 `menu_action` shengzhi
   - 根据菜单项 key 分发到相应服务或 emit 事件
4. 更新 `src/renderer/src/services/yuantiangang/yuantiangang.ts`
   - 添加 `menu:action` IPC 监听
   - 发送 `MENU_ACTION` qizou

**验收标准**：
- ✅ 菜单点击事件通过 qizou-shengzhi 流程
- ✅ 菜单点击可以正确分发到相应服务
- ✅ 菜单点击事件处理完整

### Phase 5: 迁移 Vue 组件

**目标**：所有 Vue 组件通过 `useZhangSunWuJi()` 或 DOM 事件访问菜单功能

**任务**：
1. 更新 `src/renderer/src/App.vue`
   - 移除 `useMenusStore` 直接访问
   - 使用 `useZhangSunWuJi().refreshMenus(t)`
2. 更新 `src/renderer/src/components/LanguageSwitcher.vue`
   - 移除 `useMenusStore` 直接访问
   - 使用 `useZhangSunWuJi().refreshMenus(t)`
3. 更新 `src/renderer/src/components/TitlebarMac.vue`
   - 移除 `watch(menusStore.menus)` 和 `window.api.applySystemMenu` 调用
   - 移除 `window.api.onMenuAction` 监听
   - 使用 `useZhangSunWuJi()` 访问菜单数据
   - 菜单点击事件通过服务处理
4. 更新 `src/renderer/src/components/TitlebarWinLinux.vue`（如果存在）
   - 同样迁移到 `useZhangSunWuJi()`

**验收标准**：
- ✅ 所有组件不再直接访问 `menusStore`
- ✅ 所有组件不再直接调用 `window.api.applySystemMenu`
- ✅ 所有组件不再直接监听 `window.api.onMenuAction`
- ✅ 菜单功能正常工作

### 何时使用服务 vs DOM 事件

**使用服务（`useZhangSunWuJi()` composable）的场景**：
- ✅ 需要访问服务的响应式状态（如 `menus`）
- ✅ 需要调用服务的复杂方法（如 `refreshMenus()`, `setMenuDisabled()`）
- ✅ 需要处理菜单点击事件（`handleMenuAction()`）
- ✅ 组件已经依赖服务层的其他功能

**使用 DOM 事件（`picasa:shangshu`）的场景**：
- ✅ 只需要触发简单操作（如 `openExternal()`, `openInFinder()`）
- ✅ 不需要访问服务的响应式状态
- ✅ 完全解耦，组件不依赖服务层
- ✅ 简单组件（如按钮、链接）只需要触发操作

**架构流程对比**：

```
使用服务：
组件 → useZhangSunWuJi().openExternal()
  → ZhangSunWuJiService.openExternal()
  → qizouBus.emit('qizou')
  → 路由器处理 → 下旨给服务

使用 DOM 事件：
组件 → window.dispatchEvent('picasa:shangshu')
  → 杜如晦监听 → 转换为 qizou
  → qizouBus.emit('qizou')
  → 路由器处理 → 下旨给服务
```

**两种方式最终都走同一个 qizou 路由系统，只是入口不同**。

### Phase 6: 清理遗留代码

**目标**：移除不再需要的代码

**任务**：
1. 检查 `menusStore` 是否还有其他用途
   - 如果没有，考虑移除或标记为内部使用
2. 检查 `window.api.applySystemMenu` 和 `window.api.onMenuAction` 是否还有其他用途
   - 如果没有，考虑从 preload 中移除
3. 更新文档和注释

**验收标准**：
- ✅ 遗留代码已清理
- ✅ 文档已更新

---

## 技术细节

### 服务实现示例

```typescript
export class ZhangSunWuJiService implements IService, IZhangSunWuJiService {
    constructor(private readonly fangXuanLingService: IFangXuanLingService) {}

    get name(): string {
        return "长孙无忌";
    }

    get menus(): MenuItemData[] {
        // 通过房玄龄访问 menusStore
        return this.fangXuanLingService.menus.menus;
    }

    refreshMenus(t: (key: string) => string): void {
        // 更新 menusStore（通过房玄龄）
        this.fangXuanLingService.menus.refreshMenus(t);
        // 发送 zouzhe 到房玄龄，房玄龄发送 zhaoling 到袁天罡，袁天罡发送 IPC 到主进程
        const zouzhe: Zouzhe = {
            department: GUANYUAN_NAMES.ZHANG_SUN_WU_JI,
            matter: ZOUZHE_MATTERS.UPDATE_MENU,
            content: { menus: this.menus },
            timestamp: Date.now(),
            priority: ZOUZHE_PRIORITIES.NORMAL,
        };
        await this.fangXuanLingService.processZouzhe(zouzhe);
    }

    setMenuDisabled(key: string, disabled: boolean): void {
        // 更新 menusStore（通过房玄龄）
        this.fangXuanLingService.menus.setMenuDisabled(key, disabled);
        // 发送 zouzhe 到房玄龄，房玄龄发送 zhaoling 到袁天罡，袁天罡发送 IPC 到主进程
        const zouzhe: Zouzhe = {
            department: GUANYUAN_NAMES.ZHANG_SUN_WU_JI,
            matter: ZOUZHE_MATTERS.UPDATE_MENU,
            content: { menus: this.menus },
            timestamp: Date.now(),
            priority: ZOUZHE_PRIORITIES.NORMAL,
        };
        await this.fangXuanLingService.processZouzhe(zouzhe);
    }

    handleMenuAction(payload: MenuActionPayload): void {
        // 根据菜单项 key 分发到相应服务
        // 例如：help.learnMore → 打开外部链接
        // 例如：view.reload → 发送 shengzhi 到相应服务
    }
}
```

### 房玄龄菜单 Accessor

需要在 `FangXuanLingService` 中添加菜单 Accessor（遵循 RFC 0043 Accessor 模式）：

```typescript
// src/renderer/src/services/fangxuanling/accessors/menus-accessor.ts
export interface IMenusAccessor {
    readonly menus: MenuItemData[];
}

export class MenusAccessor implements IMenusAccessor {
    constructor(private readonly store: MenusStore | null) {}

    get menus(): MenuItemData[] {
        if (!this.store) {
            logger.error("🏛️ 房玄龄：MenusStore未初始化");
            return [];
        }
        // ✅ 返回副本，防止外部修改
        return JSON.parse(JSON.stringify(this.store.menus));
    }
}

// src/renderer/src/services/fangxuanling/fangxuanling.ts
export interface IFangXuanLingService {
    // ... existing accessors
    readonly menus: IMenusAccessor;  // 只读访问器
}
```

**注意**：
- ✅ Accessor 只提供**只读访问**（`readonly menus`）
- ✅ 修改菜单通过 zouzhe 流程（`UPDATE_MENU` zouzhe）
- ❌ UI 组件**不能**直接访问 `menusStore`（违反服务模式）
- ✅ UI 组件必须通过 `useZhangSunWuJi()` 访问菜单数据（服务接口）
- ✅ 服务通过房玄龄的 Accessor 访问（只读）

---

## 风险评估

### 风险 1: 菜单同步延迟

**风险**：qizou-shengzhi 流程可能比直接 IPC 调用慢

**缓解**：
- 菜单更新是低频操作（主要在语言切换时）
- 可以优化 qizou 路由性能
- **架构一致性优先**：必须通过袁天罡发送 IPC，不能为了性能违反架构原则

### 风险 2: 菜单点击事件处理复杂度

**风险**：不同菜单项需要分发到不同服务，可能增加复杂度

**缓解**：
- 使用策略模式或映射表管理菜单项处理
- 保持处理逻辑简单清晰
- 可以逐步迁移，先处理常用菜单项

### 风险 3: 主进程 MenuService 兼容性

**风险**：主进程 `MenuService` 使用 `@Service` 装饰器，需要确保兼容

**缓解**：
- 主进程 `MenuService` 保持不变
- 只修改渲染进程的调用方式
- 通过袁天罡桥接 IPC 通信

---

## 验收标准

### 功能验收

- ✅ 菜单可以正常显示和更新
- ✅ 语言切换时菜单可以正常刷新
- ✅ 菜单点击事件可以正常处理
- ✅ 菜单禁用状态可以正常设置

### 架构验收

- ✅ 所有菜单相关操作通过 `useZhangSunWuJi()` 访问
- ✅ 菜单更新通过 zouzhe 流程（长孙无忌 → 房玄龄 → 袁天罡 → 主进程）
- ✅ 菜单点击事件通过 qizou-shengzhi 流程（主进程 → 袁天罡 → 李世民 → 长孙无忌）
- ✅ **袁天罡是唯一的 IPC 桥接点**：所有与主进程的 IPC 通信都通过袁天罡
- ✅ **zouzhe 用于内政事务**：菜单更新是内部状态同步，使用 zouzhe 流程
- ✅ **qizou 用于跨部门协调**：菜单点击事件需要路由分发，使用 qizou 流程
- ✅ 没有直接 IPC 调用（如 `window.api.applySystemMenu`）或直接 Store 访问

### 代码质量验收

- ✅ 服务接口定义完整
- ✅ 服务实现遵循现有模式
- ✅ 测试覆盖完整
- ✅ 文档已更新

---

## 后续工作

1. **菜单项处理扩展**：根据业务需求，逐步扩展菜单项处理逻辑
2. **性能优化**：如果发现性能问题，可以优化 qizou 路由或添加缓存
3. **主进程服务统一**：考虑将主进程 `MenuService` 也迁移到新架构（长期目标）

---

## 参考

- RFC 0057: 虞世南扫描进度展示服务（参考服务设计模式）
- RFC 0038: 偏好设置工作流集成（参考 qizou-shengzhi 流程）
- RFC 0042: scanningFolder迁移（参考服务迁移模式）


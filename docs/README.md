# Photasa Documentation

Welcome to the Photasa documentation hub. This directory contains all project documentation organized by category.

## 📚 Documentation Structure

- **`DEV_GUIDE.md`** - Complete development setup and workflow guide
- **`DEBUG.md`** - Debugging setup and troubleshooting guide
- **`design/`** - Architecture and design documentation
- **`rfc/`** - Request for Comments and design decisions
- **`issue/`** - Known issues and resolutions
- **`assets/`** - Documentation assets and resources

## 🚀 Quick Links

- [Development Guide](DEV_GUIDE.md) - Get started with development
- [Debug Guide](DEBUG.md) - Debugging and troubleshooting
- [RFC / ROADMAP](../ROADMAP.md) - RFC index and design decisions (canonical)
- [Design Documents](design/) - Architecture and design docs
- [Issues](issue/) - Known issues and solutions

---

## 开发命名规范说明

Photoasa 开发命名规范聚焦于Electron App的开发规范。

## 1. 组件命名

- 文件名：PascalCase 或 kebab-case，如 ThemeSettings.vue 或 theme-settings.vue
- 组件名：PascalCase，如 ThemeSettings

## 2. 服务/管理器命名

- 文件名：kebab-case，结尾为 .service.ts 或 -manager.ts，如 find-photo-service.ts
- 类名：PascalCase，如 FindPhotoService

## 3. 接口定义命名

- 文件名：kebab-case，结尾为 .interface.ts，如 find-photo-service.interface.ts
- 接口名：I+PascalCase，如 IFindPhotoService
- 常量名：PascalCase，如 FindPhotoServiceKey

## 4. 典型用法示例

```typescript
// src/renderer/src/services/find-photo-service.ts
import type { IFindPhotoService } from "@renderer/interface/find-photo-service.interface";

export class FindPhotoServiceIpc implements IFindPhotoService {
    /* ... */
}

// src/renderer/src/interface/find-photo-service.interface.ts
export interface IFindPhotoService {
    /* ... */
}
export const FindPhotoServiceKey = Symbol("FindPhotoService");

// src/renderer/src/main.ts
import { FindPhotoServiceIpc } from "@renderer/services/find-photo-service";
import { FindPhotoServiceKey } from "@renderer/interface/find-photo-service.interface";
app.provide(FindPhotoServiceKey, new FindPhotoServiceIpc());
```

## 5. 其他说明

- 所有import路径需与实际文件名严格一致，避免大小写混用。
- 统一采用kebab-case风格，便于自动导入和跨平台兼容。
- 组件、服务、接口等不同类型文件应分目录管理，结构清晰。

# 事件命名与分发规范

## 命名风格

- 统一采用 kebab-case（短横线分隔）风格。
- 事件命名应简洁、语义明确，推荐以领域前缀区分（如 menu-、window-、app-）。

## 菜单事件

- 所有菜单项操作统一通过 menu-action 事件分发。
- 事件 payload 结构如下：
  {
  label: string, // 菜单项唯一标识
  shortcut?: string, // 快捷键（如有）
  disabled?: boolean, // 是否禁用
  onClick?: Function // 菜单项操作（如有）
  }
- 业务逻辑统一在 App.vue 监听 menu-action 事件处理。

## 其他事件

- 窗口控制相关事件推荐 window- 前缀，如 window-minimize、window-maximize。
- 业务相关事件推荐 app- 前缀，如 app-login、app-logout。

## 事件分发与监听

- 组件通过 emit 方式分发事件，父组件统一监听处理。
- 如需全局事件分发，推荐使用事件总线（event-bus）或 provide/inject。

## 类型安全

- 所有事件 payload 应有明确类型声明，便于类型推断和维护。

## 事件命名与管理规范

- 所有事件名统一采用 kebab-case（短横线分隔）风格，领域前缀区分（如 menu-、window-、app-）。
- 所有事件名须集中归并为 EventNames 对象，并使用 Object.freeze 冻结，禁止硬编码字符串。
- 事件名引用方式：EventNames.MENU_ACTION、EventNames.WINDOW_MINIMIZE 等，避免 typo。
- 事件 payload 必须有明确类型声明，便于类型推断和维护。
- 组件通过 emit 方式分发事件，父组件统一监听处理。如需全局事件分发，推荐事件总线（event-bus）或 provide/inject。
- 事件命名、分发、监听、payload 类型声明等均需有注释和文档，便于团队协作和维护。

- menu-data.ts 中 MenuItemData 的 label 字段必须为全局唯一 id，且为国际化 key。
- 所有菜单项业务处理、事件分发、快捷键注册等均以 label 为唯一依据，禁止 label 重复。

- 所有菜单 metadata 结构（如 MenuItemData）严禁包含 function 字段，所有行为通过事件和 label 分发，保证类型安全和平台兼容性。

- MenuItemData 必须包含 key（唯一 id）和 label（国际化 key），所有事件、渲染、diff 均以 key 为主，label 仅用于显示和业务逻辑。

## 常量命名规则

- 全局导出的菜单、配置、类型等常量统一采用 PascalCase（首字母大写驼峰），如 SystemMenus、MenuItemData。
- 布尔型标志字段统一用 isXxx/hasXxx 命名，如 isMacOnly、hasSeparator。
- 仅模块内部使用的常量可用 camelCase。
- 顶层菜单数组统一命名为 SystemMenus，类型声明统一 PascalCase。
- 平台专属字段统一用 isMacOnly、isWinOnly 等布尔前缀。
- 所有常量名应简洁、语义明确，避免缩写和歧义。
- 新增常量、类型、配置等均应遵循上述命名风格，保持全局一致。
- 注释需明确说明常量用途、适用范围和平台差异。

- SystemMenus 作为唯一菜单源，必须通过 Object.freeze 冻结，所有主进程、预加载、前端 UI 初始化菜单时均直接引用 SystemMenus，禁止对其进行任何修改。
- 如需动态调整菜单结构（如权限、可见性、国际化切换等），应通过 map/filter/clone 派生新对象，保持 SystemMenus 不变。

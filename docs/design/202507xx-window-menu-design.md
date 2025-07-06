# Window 菜单渲染与事件响应设计文档

## 背景与目标
- 统一菜单渲染、事件响应、快捷键注册，提升可维护性、国际化和平台一致性。
- 菜单数据结构（menus）为唯一源，前端与主进程共享。
- 所有菜单项操作通过事件转发到 App.vue 统一处理。

## 菜单数据结构设计
- 结构：MenuData、MenuItemData，支持 label、shortcut、disabled、onClick、分组等。
- 国际化：label 字段为多语言 key，菜单渲染时通过 t() 翻译。
- 扩展性：支持分组、动态禁用、快捷键等。

## Window 菜单渲染方案
- TitlebarWinLinux.vue 渲染菜单栏，使用 headlessui/vue Menu 组件，menus 数据驱动。
- 菜单项点击、hover、active、禁用等交互由 headlessui 状态管理。
- 菜单项点击通过 emit 事件转发到 App.vue。

## 事件响应链路
- TitlebarWinLinux.vue 菜单项 emit("menu-action", item) → App.vue 统一 onMenuAction 处理。
- 支持自定义事件总线或 provide/inject 方案。
- 业务逻辑（如窗口控制、页面跳转）全部在 App.vue 处理，UI 组件仅负责转发。

## 快捷键注册机制
- menus 结构中 shortcut 字段为快捷键声明。
- UI 层可用 hotkeys-js 或自定义全局监听注册快捷键，触发与菜单项一致的事件流。
- 如需主进程快捷键支持，可设计 preload API（如 registerShortcut），但推荐 UI 层统一注册。

## 平台差异与兼容性
- macOS：TitlebarMac.vue 仅负责触发系统菜单加载，菜单项操作通过 preload.loadSystemMenu 通知主进程。
- Windows/Linux：TitlebarWinLinux.vue 完全自定义菜单栏，menus 结构驱动。
- menus 结构为唯一源，平台差异通过 menus 生成逻辑或渲染分支实现。

## 类型安全与可维护性
- 关键类型：MenuData、MenuItemData，事件 payload 明确。
- menus 数据结构与主进程 menu.ts、前端组件完全一致。
- 事件流、API、类型声明均有注释和文档。

## 后续扩展点
- 菜单动态刷新、国际化切换、自动化测试、主进程菜单同步。
- 支持分组、图标、二级菜单、权限控制等。

---
本设计文档为 Window 菜单渲染、事件响应和快捷键注册的权威依据，后续开发与维护请严格参照。

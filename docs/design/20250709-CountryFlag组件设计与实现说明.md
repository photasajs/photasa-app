---
文件名: 20250709-CountryFlag组件设计与实现说明.md
创建日期: 2025-07-09
创建者: AI
关联协议: RIPER-5 + 多维 + 代理协议 + AI开发规范
历史说明: Electron renderer 组件文档；UI 现位于 apps/photasa/src/
适用范围: Vue3 桌面应用国旗组件（原 Electron 稿）
---

# CountryFlag 组件设计与实现说明

## 一、设计目标

CountryFlag 组件用于根据传入的国家代码，动态渲染对应的 SVG 国旗图标，适配 Electron + Vue3 桌面应用，保证资源打包、路径兼容性和高可维护性。

## 二、技术方案

- 采用静态 import 方式引入所有支持的 SVG 国旗文件，确保 Electron 打包后资源可用。
- 使用 Vue3 `<component :is="..." />` 动态组件机制，根据 props 渲染对应 SVG。
- 所有 SVG 文件命名与国家代码一一对应，区分大小写，便于映射和维护。
- 默认国旗采用内联 SVG 问号占位符，提升异常兼容性。

## 三、实现细节

1. **静态资源管理**：
    - 所有 SVG 文件存放于 `src/renderer/src/assets/flags/`，命名如 US.svg、CN.svg。
    - 组件顶部静态 import 所有 SVG，构建 `flagMap` 映射对象。
2. **动态渲染机制**：
    - 组件通过 `countryCode` props 接收国家代码。
    - 使用 computed 计算属性 `flagComponent`，根据映射表返回对应 SVG 组件。
    - 模板中 `<component :is="flagComponent" />` 动态渲染 SVG。
3. **异常处理**：
    - 若传入国家代码无对应 SVG，渲染默认问号 SVG。
4. **样式规范**：
    - 统一宽高 24x16px，内联显示，适配表格、列表等多场景。
5. **注释与类型**：
    - 每行代码均有详细中文注释，类型定义严格。

## 四、测试策略

- 单元测试覆盖所有支持国家代码，断言 SVG 正确渲染。
- 测试异常情况（无效代码、空字符串），断言渲染默认 SVG。
- 使用 @vue/test-utils + vitest，测试文件 `src/renderer/src/components/__tests__/CountryFlag.spec.ts`。

## 五、维护与扩展建议

- 新增国旗时，仅需添加 SVG 文件并在组件顶部 import。
- 如需支持更多国家，可自动生成 import 语句与映射表。
- 保持 SVG 命名与国家代码一致，避免路径和大小写问题。
- 可扩展支持 PNG/JPG 等其他格式，或按需加载优化包体积。

## 六、参考配置

- 路径别名：`@renderer` → `src/renderer/src`，所有 import 路径需用 @renderer 前缀。
- 相关配置见 electron.vite.config.ts、tsconfig.web.json、vitest.config.ts。

---

文档创建于：2025-07-09
创建者：AI（自动生成，已根据项目实际情况补充）

# 路径处理解耦与多平台兼容性重构设计

## 背景

原有 renderer 层路径拼接/归一化逻辑为 POSIX 风格，导致在 Windows 下兼容性和一致性问题。为实现平台无关、类型安全、易维护，需将所有路径处理逻辑下沉到 preload 层，并通过统一 API 暴露给 renderer。

## 方案概述

1. **preload 层**：用 Node.js path 模块实现 normalizePath、mergePath 等 API，自动适配 win32/posix。
2. **renderer 层**：所有路径相关操作均通过 window.api.normalizePath/mergePath 调用，无本地实现。
3. **类型声明**：在 global.d.ts 中声明 window.api 路径相关方法，保证类型安全和开发体验。
4. **测试用例**：preload、renderer 层均补充多平台路径场景的测试，显式断言 win32/posix 行为。
5. **CI 配置**：建议在 CI 测试分支配置 matrix，三平台自动测试。

## 关键实现

- preload/index.ts 合并并暴露 normalizePath、mergePath 到 api 对象。
- renderer/src/utils/path.ts 仅桥接 window.api.normalizePath/mergePath。
- global.d.ts 类型声明同步更新。
- 相关业务代码、工具文件全部适配新 API。

## 测试覆盖

### preload 层
- path-helper.spec.ts 补充 win32/posix 路径归一化、拼接断言，直接对比 Node.js path.win32/path.posix。

### renderer 层
- path.spec.ts mock window.api.normalizePath/mergePath，分别模拟 Windows 和 POSIX 行为，断言多平台输入输出。
- preference.spec.ts 等业务测试 mock 路径 API，保证依赖路径逻辑的业务代码测试通过。

## 兼容性与可维护性

- 路径处理逻辑平台无关，所有主流操作系统下表现一致。
- 业务代码无需关心平台差异，调用统一 API 即可。
- mock 方案健全，测试用例可持续通过。

## 结论

本次重构实现了路径处理的彻底解耦、平台兼容性和类型安全，测试用例显式覆盖所有关键分支，满足长期可维护和 CI 自动化要求。

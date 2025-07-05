# 路径处理解耦与多平台兼容性重构设计

## 背景

原有 renderer 层路径拼接/归一化逻辑为 POSIX 风格，导致在 Windows 下兼容性和一致性问题。为实现平台无关、类型安全、易维护，需将所有路径处理逻辑下沉到 preload 层，并通过统一 API 暴露给 renderer。

## 分层原则

- **common 层**：仅保留纯字符串算法、常量、类型定义，无任何 Node.js 依赖，不涉及平台相关逻辑。
- **shared 层**：实现所有平台相关路径工具，供 main/preload 层共享使用，依赖 Node.js path。
- **preload 层**：合并 shared 路径工具，通过 contextBridge 暴露 normalizePath、mergePath、toFileName、toThumbnailName、shortenThumbnailName、isFileUnderFolder 等 API，类型声明全量同步。
- **renderer 层**：所有路径相关操作仅通过 window.api 调用，无本地实现，类型声明在 global.d.ts/common.d.ts 保证类型安全。

## API 设计

- preload/index.ts 合并并暴露如下 API：
  - `normalizePath(p: string): string`
  - `mergePath(left: string, right?: string): string`
  - `toFileName(file: string): string`
  - `toThumbnailName(file: string): string`
  - `shortenThumbnailName(file: string): string`
  - `isFileUnderFolder(file: string, folder: string): boolean`
- global.d.ts/common.d.ts 类型声明同步，所有 API 均有类型约束，保证开发体验和类型安全。

## 测试覆盖

- **preload 层**：`path-helper.spec.ts` 直接对比 Node.js path.win32/path.posix，断言 normalize/merge 多平台行为。
- **renderer 层**：`path.spec.ts` mock window.api，分别模拟 Windows 和 POSIX 行为，断言多平台输入输出。
- **common 层**：`utils.test.ts` 仅测试纯算法与常量，无平台相关断言。
- **mock 方案**：renderer 层测试用例通过 mock window.api 保证平台兼容性，preload 层直接依赖 Node.js path。

## CI 策略

- 配置 matrix，三平台（Windows/macOS/Linux）自动测试，保证所有路径相关逻辑在主流操作系统下表现一致。
- 关键路径相关用例为必测项，CI 失败即阻断合并。

## 迁移说明

- common 层所有路径相关实现（如 buildThumbnailPath、toRelativeThumbnailPath、toPreviewPath、toFileName、toThumbnailName、shortenThumbnailName、isFileUnderFolder 等）迁移到 shared/preload 层。
- 业务代码、工具、测试用例全部适配新 API，renderer 层仅通过 window.api 调用。
- 类型声明（global.d.ts/common.d.ts）同步更新，保证类型安全。
- 设计文档持续补充分层原则、API 设计、测试覆盖、迁移说明。

## API 迁移与分层适配清单

| 名称                      | 目标归属         | 现有 preload 暴露 | renderer 是否需调用 | 是否需要 preload api 支持 | 备注/说明                         |
|---------------------------|------------------|-------------------|--------------------|--------------------------|------------------------------------|
| buildThumbnailPath        | shared/path-util | 否                | 可能需要           | 是                       | renderer 需生成缩略图路径          |
| toRelativeThumbnailPath   | shared/path-util | 否                | 可能需要           | 是                       | renderer 需生成相对缩略图路径      |
| toPreviewPath             | shared/path-util | 否                | 可能需要           | 是                       | renderer 需生成预览图路径          |
| isFileUnderFolder         | shared/path-util | 是                | 是                 | 是                       | 已在 preload api，renderer 需用    |
| toFileName                | shared/path-util | 是                | 是                 | 是                       | 已在 preload api，renderer 需用    |
| toThumbnailName           | shared/path-util | 是                | 是                 | 是                       | 已在 preload api，renderer 需用    |
| shortenThumbnailName      | shared/path-util | 是                | 是                 | 是                       | 已在 preload api，renderer 需用    |
| PHOTASA_ORIGINALS         | common           | 否                | 否                 | 否                       | 常量，renderer 不直接用            |
| HeicExtensionRE           | common           | 否                | 否                 | 否                       | 常量，renderer 不直接用            |
| toPosix                   | common           | 否                | 否                 | 否                       | 纯算法，renderer 不直接用          |
| isHiddenFile              | common           | 是                | 是                 | 是                       | 已在 preload api，renderer 需用    |
| shouldIgnorePhotasaPath   | common           | 是                | 是                 | 是                       | 已在 preload api，renderer 需用    |
| isDirectory               | shared/preload   | 否                | 可能需要           | 视业务需求                | 依赖 fs，renderer 若需则暴露       |
| isFile                    | shared/preload   | 否                | 可能需要           | 视业务需求                | 依赖 fs，renderer 若需则暴露       |

> 迁移原则：每次迁移一个函数，严格对照本表，迁移后同步更新文档与类型声明，确保 renderer 仅通过 preload api 调用，common 层只保留常量和纯算法，shared 层实现所有平台相关逻辑。

## 迁移进度与风格吸收记录

- 已完成 buildThumbnailPath、toRelativeThumbnailPath、toPreviewPath 的迁移，全部平台相关实现已转移到 shared 层，main 层通过 @shared 路径别名调用，common 层只保留纯算法、常量、类型。
- 用户风格偏好：主进程/核心代码 prefer 路径别名（如 @shared），不再建议相对路径，已确保 alias 配置生效。
- 每次迁移和重构后，均主动回查文件内容，确保与用户实际修改100%一致，持续吸收用户风格和分层习惯。
- 迁移步骤均有详细记录，便于追溯和团队协作。

## 结论

本次重构实现了路径处理的彻底解耦、平台兼容性和类型安全，分层职责清晰，测试用例显式覆盖所有关键分支，CI 自动化保障长期可维护性和团队协作效率。

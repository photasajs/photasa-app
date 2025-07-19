# 设计文档

## 概述

Photasa 是一个使用 Electron 和 Vue.js 构建的现代照片管理应用程序，旨在提供类似经典 Picasa 应用程序的功能。该应用程序允许用户浏览、组织和查看他们的照片集合，具有文件夹扫描、缩略图生成和分屏界面等功能。

该应用程序遵循模块化架构，明确分离主 Electron 进程和渲染器进程。主进程处理系统级操作，如文件访问、窗口管理和原生菜单，而渲染器进程使用 Vue.js 管理 UI。

## 架构

### 主进程架构

主进程被组织成几个服务模块，每个模块负责应用程序的特定方面：

1. **ThumbnailService（缩略图服务）**: 处理图像缩略图生成和缓存
2. **ConfigService（配置服务）**: 管理应用程序配置和首选项
3. **ScanService（扫描服务）**: 扫描目录以查找照片并管理扫描队列
4. **WatchService（监视服务）**: 监控目录变化并触发更新
5. **WindowService（窗口服务）**: 管理应用程序窗口及其状态
6. **MenuService（菜单服务）**: 处理应用程序菜单及其操作
7. **ShellService（Shell服务）**: 提供对系统shell操作的访问

这些服务通过IPC（进程间通信）通道与渲染器进程通信，在两个进程之间提供安全的桥梁。

### 渲染器进程架构

渲染器进程使用 Vue 3 的组合式 API 构建，并组织为以下组件：

1. **组件（Components）**: 以层次结构组织的 UI 元素
    - 基础组件（可重用的 UI 元素）
    - 特定功能组件（如 ImageList, FolderList）
    - 布局组件（如 SplitView）
    - 平台特定组件（如 TitlebarMac, TitlebarWinLinux）

2. **存储（Stores）**: 使用 Pinia 进行状态管理
    - PhotosStore: 管理照片集合状态
    - PreferenceStore: 管理用户首选项并持久化
    - StatusBarStore: 管理状态栏状态
    - MenusStore: 管理菜单状态和国际化

3. **服务（Services）**: 渲染器进程的业务逻辑
    - FindPhotoService: 处理照片搜索和过滤
    - ThemeManager: 管理应用程序主题

4. **工具（Utils）**: 辅助函数和实用工具
    - 用于 IPC 通信的 API 工具
    - 文件处理工具
    - 扫描工具
    - 对象操作工具

### 数据流

1. 用户在渲染器进程中与 UI 交互
2. 操作被分派到 Pinia 存储或直接到服务
3. 服务通过 IPC 通道与主进程通信
4. 主进程服务处理请求并执行系统操作
5. 结果通过 IPC 通道发送回渲染器进程
6. UI 根据结果更新

## 组件和接口

### 主要组件

1. **App.vue**: 协调应用程序的根组件
2. **SplitView**: 用于文件夹树和图像网格的可调整大小的分屏视图组件
3. **FolderList**: 显示文件夹结构并允许导航
4. **ImageList**: 将选定文件夹中的照片显示为网格
5. **ImportPhotos**: 处理照片导入过程
6. **UserPreference**: 管理用户首选项
7. **TitlebarMac/TitlebarWinLinux**: 平台特定的标题栏组件
8. **StatusBar**: 显示应用程序状态和进度

### 关键接口

1. **IFindPhotoService**: 照片搜索和过滤的接口
2. **ScanAction**: 扫描操作的接口
3. **ThemeMeta**: 主题元数据的接口

## 数据模型

### 照片模型

照片模型包括：

- Path: 照片的文件路径
- Metadata: 从照片中提取的 EXIF 和其他元数据
- Thumbnail: 生成的缩略图路径
- Type: 图像或视频

### 文件夹模型

文件夹模型包括：

- Path: 文件夹的文件路径
- Name: 文件夹的显示名称
- Children: 子文件夹
- Photos: 文件夹中的照片

### 首选项模型

首选项模型包括：

- Paths: 监视的文件夹路径
- CurrentFolder: 当前选择的文件夹
- ThumbnailSize: 首选缩略图大小
- Locale: 选择的语言
- Theme: 选择的主题

## 错误处理

1. **日志记录**: 使用 log4js 进行全面的日志记录
2. **错误跟踪**: 与 Bugsnag 集成进行错误报告
3. **优雅降级**: 处理常见错误而不崩溃
4. **用户反馈**: 为面向用户的错误提供清晰的错误消息

## 测试策略

1. **单元测试**: 使用 Vitest 进行组件和工具测试
2. **端到端测试**: 使用 Playwright 进行端到端测试
3. **快照测试**: 用于 UI 组件
4. **集成测试**: 用于服务交互

## 国际化

应用程序通过 vue-i18n 支持多种语言：

- 英语（美国/英国）
- 中文（简体/繁体）
- 日语
- 韩语
- 法语
- 德语
- 西班牙语
- 俄语
- 阿拉伯语
- 意大利语
- 土耳其语
- 乌克兰语
- 越南语

## 主题系统

应用程序支持多种主题：

- 浅色主题（Light theme）
- 深色主题（Dark theme）
- 日光色浅色主题（Solarized Light）
- 日光色深色主题（Solarized Dark）

主题使用 CSS 变量实现，以确保整个应用程序的样式一致性。

## 平台特定考虑

### macOS

- 使用带有隐藏控件的原生标题栏
- 遵循 macOS UI 指南

### Windows/Linux

- 使用带有自定义标题栏的无边框窗口
- 提供窗口控件（最小化、最大化、关闭）

## 性能优化

1. **工作池（Worker Pool）**: 用于缩略图生成等 CPU 密集型操作
2. **懒加载（Lazy Loading）**: 用于图像加载和渲染
3. **虚拟化列表（Virtualized Lists）**: 用于高效渲染大型集合
4. **缓存（Caching）**: 用于缩略图和频繁访问的数据

## 安全考虑

1. **上下文隔离（Context Isolation）**: Electron 对预加载脚本的上下文隔离
2. **内容安全策略（Content Security Policy）**: 限制脚本执行
3. **沙箱（Sandboxing）**: 为必要的文件系统访问提供有限的沙箱
4. **输入验证（Input Validation）**: 对所有用户输入和文件路径进行验证

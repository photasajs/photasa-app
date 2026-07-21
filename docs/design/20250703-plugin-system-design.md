# 插件系统设计方案（VSCode风格，main/render双入口）

> **历史文档（Electron main/renderer）**：插件系统未按此文在 Tauri 落地。

## 1. 设计目标

- 支持插件扩展主进程（main）和渲染进程（render）能力
- 插件可动态安装、启用、禁用、卸载
- 插件描述、激活、命令、UI、服务等机制与 VSCode 兼容
- 插件与主程序安全隔离，支持 IPC 通信

## 2. 插件目录结构

```
plugins/
  my-plugin/
    package.json         # 插件描述文件
    main.js              # 主进程入口（可选）
    render.js            # 渲染进程入口（可选）
    assets/
```

## 3. 插件描述文件（package.json）示例

```json
{
    "name": "my-plugin",
    "version": "1.0.0",
    "main": "main.js",
    "render": "render.js",
    "activationEvents": ["onStartup", "onCommand:myPlugin.hello"],
    "contributes": {
        "commands": [{ "command": "myPlugin.hello", "title": "Hello from Plugin" }],
        "menus": {
            "mainMenu": [{ "command": "myPlugin.hello", "when": "true" }]
        }
    }
}
```

## 4. 插件加载与生命周期

- **主进程插件管理器**
    - 启动时扫描 plugins 目录，读取 package.json
    - 动态 require main.js，注册 IPC、服务、命令
    - 监听插件启用/禁用/卸载事件，管理插件状态
- **渲染进程插件管理器**
    - 启动时扫描 plugins 目录，读取 package.json
    - 动态 import render.js，注册 UI 组件、菜单、命令
    - 支持插件与主进程通信（IPC）
- **激活机制**
    - 支持 onStartup、onCommand、onEvent 等激活事件
    - 插件按需加载，提升性能

## 5. 插件接口与通信

- 提供统一 API（如 registerCommand、registerMenu、sendIPC、onIPC）
- 插件可注册命令、菜单、服务、UI 组件
- 主进程与渲染进程通过安全 IPC 通道通信
- 插件可监听和触发自定义事件

## 6. 安全与隔离

- 插件仅能访问白名单 API，禁止直接访问敏感 Node/Electron 能力
- 插件运行时捕获异常，防止崩溃主程序
- 支持插件沙箱/权限声明（可选）

## 7. 未来扩展

- 支持插件市场、在线安装与自动升级
- 插件热加载与热卸载
- 插件依赖管理与版本兼容性校验

---

设计人：AI助手
日期：2025-07-11

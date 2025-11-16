# Electron MCP 调试指南

本指南介绍如何使用 Model Context Protocol (MCP) 服务器来调试 Electron 应用程序，让 Claude Code 能够交互式地调试你的应用。

## 📋 概述

MCP (Model Context Protocol) 允许 AI 助手（如 Claude）通过标准协议与开发工具交互。对于 Electron 调试，有多个 MCP 服务器可用：

1. **MCP Node.js Debugger** - 用于调试 Electron 主进程（Node.js）
2. **Electron MCP Server** - 提供 UI 自动化、DOM 检查和深度调试
3. **DevTools Debugger MCP** - 完整的 Chrome DevTools Protocol 支持

## 🚀 快速开始

### 方案一：使用 MCP Node.js Debugger（推荐用于主进程调试）

**适用场景**：调试 Electron 主进程代码（`src/main/` 目录）

#### 1. 安装 MCP 服务器

在 Cursor 中配置 MCP 服务器。Cursor 的 MCP 配置通常在以下位置：

**macOS**: `~/Library/Application Support/Cursor/User/globalStorage/mcp.json`
**Windows**: `%APPDATA%\Cursor\User\globalStorage\mcp.json`
**Linux**: `~/.config/Cursor/User/globalStorage/mcp.json`

或者通过 Cursor 设置界面添加：

1. 打开 Cursor 设置（Cmd/Ctrl + ,）
2. 搜索 "MCP" 或 "Model Context Protocol"
3. 添加新的 MCP 服务器配置

#### 2. 配置 MCP 服务器

在 Cursor 的 MCP 配置文件中添加：

```json
{
  "mcpServers": {
    "nodejs-debugger": {
      "command": "npx",
      "args": [
        "-y",
        "@hyperdrive-eng/mcp-nodejs-debugger"
      ]
    }
  }
}
```

**重要提示**: 不要添加 `NODE_OPTIONS: "--inspect=9229"` 到 env 中！这会导致端口冲突错误。MCP 调试器会自动连接到 Electron 应用已有的调试端口。

#### 3. 启动 Electron 应用（调试模式）

你的项目已经配置了调试脚本：

```bash
# 启动开发模式调试（主进程端口 9229，渲染进程端口 9222）
npm run dev:debug
```

或者手动启动：

```bash
# 主进程调试
electron --inspect=9229 .

# 或者使用 electron-vite
DEBUG=true electron-vite dev --inspect=9229 --remoteDebuggingPort=9222
```

#### 4. 在 Claude Code 中使用

启动应用后，可以在 Claude Code 中请求调试：

```
请帮我调试 Electron 应用，在 src/main/index.ts 的第 343 行设置断点，并检查 app.whenReady() 的执行情况
```

### 方案二：使用 Chrome DevTools MCP Server（推荐用于渲染进程调试）

**适用场景**：渲染进程调试、DOM 检查、网络监控、Console 日志捕获

#### 1. 配置 MCP 服务器

在 Cursor 的 MCP 配置中添加：

```json
{
  "mcpServers": {
    "chrome-devtools": {
      "command": "npx",
      "args": [
        "-y",
        "chrome-devtools-mcp"
      ],
      "env": {
        "CDP_URL": "http://localhost:9222"
      }
    }
  }
}
```

**注意**: `chrome-devtools-mcp` 是 Chrome DevTools 官方的 MCP 服务器，可直接从 npm 安装。

#### 3. 启动应用

```bash
npm run dev:debug
```

#### 4. 使用示例

```
请帮我检查渲染进程的 DOM 结构，并截图当前界面状态
```

### 方案三：使用 Node.js Debugger MCP（已验证可用）

**适用场景**：主进程和渲染进程调试（通过 Node.js Inspector Protocol）

这是最可靠的方案，因为 `@hyperdrive-eng/mcp-nodejs-debugger` 已经验证可用。

#### 配置（已在方案一中说明）

这个 MCP 服务器可以同时调试主进程（端口 9229）和渲染进程（如果配置了 Node.js Inspector）。

#### 使用示例

```
请帮我调试 Electron 应用的主进程，在 src/main/index.ts 的第 343 行设置断点
```

### 方案四：手动配置 Chrome DevTools Protocol（备选方案）

如果上述 MCP 服务器不可用，你可以直接使用 Chrome DevTools Protocol：

1. 启动应用调试模式：
   ```bash
   npm run dev:debug
   ```

2. 在浏览器中打开：
   ```
   http://localhost:9222
   ```

3. 使用 Chrome DevTools 进行调试

## 🔧 项目特定配置

### 当前项目的调试端口

根据 `docs/DEBUG.md` 和 `package.json`：

- **主进程调试端口**: `9229` (`--inspect=9229`)
- **渲染进程调试端口**: `9222` (`--remote-debugging-port=9222`)

### 调试脚本

你的项目已配置以下调试命令：

```json
{
  "dev:debug": "DEBUG=true electron-vite dev --inspect=9229 --remoteDebuggingPort=9222"
}
```

### VS Code 调试配置

项目中的 `.vscode/launch.json` 应该包含以下配置（如果存在）：

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Debug Main Process (Vite)",
      "type": "node",
      "request": "launch",
      "cwd": "${workspaceFolder}",
      "runtimeExecutable": "${workspaceFolder}/node_modules/.bin/electron-vite",
      "runtimeArgs": ["dev", "--debug"],
      "outputCapture": "std",
      "console": "integratedTerminal"
    },
    {
      "name": "Debug Renderer Process",
      "type": "chrome",
      "request": "attach",
      "port": 9222,
      "webRoot": "${workspaceFolder}/src/renderer"
    }
  ]
}
```

## 📝 使用示例

### 示例 1：设置断点并检查变量

```
请使用 MCP 调试器在 src/main/index.ts 的第 343 行设置断点，
当执行到 app.whenReady() 时，检查 mainWindow 变量的值
```

### 示例 2：单步执行调试

```
请帮我单步执行 createWindow() 函数，并报告每一步的变量状态
```

### 示例 3：检查渲染进程 DOM

```
请检查渲染进程的 DOM 结构，找出所有包含 class="photo-item" 的元素
```

### 示例 4：性能分析

```
请分析 Electron 应用的启动性能，找出耗时最长的操作
```

## 🐛 故障排除

### 1. MCP 服务器无法连接

**问题**: Claude Code 无法连接到调试器

**解决方案**:
- 确认 Electron 应用已以调试模式启动
- 检查端口是否被占用：
  ```bash
  # macOS/Linux
  lsof -i :9229
  lsof -i :9222

  # Windows
  netstat -ano | findstr :9229
  netstat -ano | findstr :9222
  ```
- 验证 MCP 服务器配置是否正确
- 重启 Cursor IDE

### 2. 断点不生效

**问题**: 设置的断点没有触发

**解决方案**:
- 确认 Source Map 已启用（开发模式自动启用）
- 检查代码是否已重新编译
- 验证文件路径是否正确

### 3. 无法访问渲染进程

**问题**: 只能调试主进程，无法访问渲染进程

**解决方案**:
- 确认启动时使用了 `--remote-debugging-port=9222`
- 使用 Electron MCP Server 或 DevTools Debugger MCP
- 检查浏览器安全策略

### 4. 包不存在 (404 Not Found)

**问题**: 安装 MCP 服务器时遇到 `npm error 404 Not Found`

**解决方案**:
1. 验证包名是否正确：
   ```bash
   npm view @hyperdrive-eng/mcp-nodejs-debugger
   ```
2. 检查 npm registry 是否可访问
3. 使用已验证可用的包：`@hyperdrive-eng/mcp-nodejs-debugger`
4. 如果包名已更改，请查看 MCP 官方文档获取最新包名

### 5. 端口冲突错误 (address already in use)

**问题**: MCP 服务器启动时遇到 `Starting inspector on 127.0.0.1:9229 failed: address already in use`

**原因**: MCP 配置中错误地添加了 `NODE_OPTIONS: "--inspect=9229"`，这会让 MCP 服务器尝试监听端口 9229，但该端口已被 Electron 应用使用。

**解决方案**:
1. 从 MCP 配置中移除 `env.NODE_OPTIONS` 配置项
2. 正确的配置应该只有 `command` 和 `args`：
   ```json
   {
     "nodejs-debugger": {
       "command": "npx",
       "args": ["-y", "@hyperdrive-eng/mcp-nodejs-debugger"]
     }
   }
   ```
3. MCP 调试器会自动连接到 Electron 应用已有的调试端口，无需手动配置


## 🔗 相关资源

- [MCP 官方文档](https://modelcontextprotocol.io/)
- [Node.js Inspector Protocol](https://nodejs.org/en/docs/guides/debugging-getting-started/)
- [Chrome DevTools Protocol](https://chromedevtools.github.io/devtools-protocol/)
- [项目调试文档](./DEBUG.md)

## 📚 推荐的 MCP 服务器

1. **@hyperdrive-eng/mcp-nodejs-debugger** ✅ **已验证可用** - 主进程调试（推荐）
2. **chrome-devtools-mcp** ✅ **已验证可用** - 渲染进程调试（Chrome DevTools 官方）

**注意**: 所有推荐的包都已验证在 npm 上存在。如果遇到问题，可以验证包是否存在：
```bash
npm view @hyperdrive-eng/mcp-nodejs-debugger
npm view chrome-devtools-mcp
```

## 💡 最佳实践

1. **开发时使用**: 使用 `npm run dev:debug` 启动调试模式
2. **主进程调试**: 使用 MCP Node.js Debugger
3. **渲染进程调试**: 使用 Electron MCP Server 或 DevTools Debugger
4. **组合使用**: 可以同时配置多个 MCP 服务器，分别用于不同场景
5. **性能监控**: 结合性能分析工具使用 MCP 调试器

## 🎯 下一步

1. 选择一个 MCP 服务器并配置
2. 启动应用调试模式
3. 在 Claude Code 中尝试调试命令
4. 根据需求调整配置

---

**注意**: MCP 配置可能因 Cursor 版本而异。如果遇到配置问题，请参考 Cursor 的最新文档或联系支持。


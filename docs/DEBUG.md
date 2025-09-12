# Electron Vite 调试指南

## 🚀 快速开始

### 方法1: 使用VS Code调试配置（推荐）

1. **打开VS Code调试面板** (Ctrl+Shift+D / Cmd+Shift+D)
2. **选择调试配置**：
   - `Debug Main Process (Vite)` - 调试主进程（开发模式）
   - `Debug Main Process (Built)` - 调试主进程（构建后）
   - `Debug Renderer Process` - 调试渲染进程
   - `Debug All (Vite)` - 同时调试主进程和渲染进程

3. **设置断点**：在`src/main/`目录下的TypeScript文件中设置断点
4. **开始调试**：按F5或点击绿色播放按钮

### 方法2: 使用命令行

```bash
# 开发模式调试（推荐）
npm run dev:debug

# 构建后调试（包含source map）
npm run build:debug
```

**调试端口**：
- 主进程：`ws://127.0.0.1:9229`
- 渲染进程：`ws://127.0.0.1:9222`

**Source Map 配置**：
- 开发模式：自动生成 source map
- 调试构建：通过 `DEBUG=true` 环境变量生成 source map
- 生产构建：不生成 source map（安全且减小包体积）

## 🔧 调试配置说明

### VS Code配置

- **Debug Main Process (Vite)**: 使用electron-vite dev --debug启动，支持热重载
- **Debug Main Process (Built)**: 调试构建后的代码，使用--inspect=9229端口
- **Debug Renderer Process**: 连接到渲染进程，端口9222
- **Debug All (Vite)**: 同时启动主进程和渲染进程调试

### 端口配置

- **主进程调试**: 9229 (--inspect=9229)
- **渲染进程调试**: 9222 (--remote-debugging-port=9222)

## 🐛 常见问题解决

### 1. 断点不生效

**原因**: Source map配置问题
**解决**:
```bash
# 重新构建并启用source map
npm run build:debug
```

### 2. 无法连接到渲染进程

**原因**: 端口冲突或URL错误
**解决**:
- 检查9222端口是否被占用
- 确认渲染进程URL为 http://localhost:5173

### 3. 主进程调试器无法启动

**原因**: electron-vite配置问题
**解决**:
```bash
# 清理并重新安装依赖
rm -rf node_modules package-lock.json
npm install
```

### 4. TypeScript断点映射问题

**原因**: tsconfig配置问题
**解决**: 确保tsconfig.node.json包含正确的路径映射

## 📁 调试文件位置

- **主进程**: `src/main/` 目录
- **预加载脚本**: `src/preload/` 目录
- **渲染进程**: `src/renderer/src/` 目录
- **共享代码**: `src/common/` 和 `src/shared/` 目录

## 🎯 调试技巧

### 1. 设置条件断点
- 右键断点 → 编辑断点 → 添加条件

### 2. 使用调试控制台
- 在断点处使用 `console.log()` 或 VS Code调试控制台

### 3. 查看变量
- 在调试面板的"变量"部分查看当前作用域的变量

### 4. 调用堆栈
- 在"调用堆栈"部分查看函数调用链

## 🔍 高级调试

### 1. 调试Worker线程
```typescript
// 在worker文件中添加调试代码
if (process.env.NODE_ENV === 'development') {
    debugger; // 手动断点
}
```

### 2. 调试IPC通信
```typescript
// 在main进程中
ipcMain.on('debug-event', (event, data) => {
    console.log('IPC Debug:', data);
    debugger; // 断点
});
```

### 3. 调试异步代码
```typescript
// 使用async/await确保断点正确
async function debugAsyncFunction() {
    const result = await someAsyncOperation();
    debugger; // 断点会在这里等待
    return result;
}
```

## 📝 调试日志

### 启用详细日志
```bash
# 设置环境变量
export DEBUG=electron-vite:*
npm run dev:debug
```

### 自定义日志
```typescript
// 在代码中添加调试日志
if (process.env.NODE_ENV === 'development') {
    console.log('[DEBUG]', 'Variable value:', variable);
}
```

## 🚨 故障排除

### 1. 清理缓存
```bash
rm -rf out/
rm -rf node_modules/.vite/
npm run dev:debug
```

### 2. 重置VS Code调试配置
- 删除 `.vscode/launch.json`
- 重新创建调试配置

### 3. 检查端口占用
```bash
# macOS/Linux
lsof -i :9222
lsof -i :9229

# Windows
netstat -ano | findstr :9222
netstat -ano | findstr :9229
```

## 📚 相关文档

- [Development Guide](DEV_GUIDE.md) - 开发环境设置指南
- [Electron调试指南](https://www.electronjs.org/docs/latest/tutorial/debugging-main-process)
- [VS Code调试配置](https://code.visualstudio.com/docs/editor/debugging)
- [Electron Vite文档](https://evite.netlify.app/)

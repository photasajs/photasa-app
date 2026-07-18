# Photasa - Tauri 版本

这是 Photasa 的 Tauri 实现版本，基于 RFC 0067 创建。

## 项目结构

```
apps/photasa/
├── src/                    # Frontend (Vue3)
│   ├── main.ts            # Vue 应用入口
│   ├── App.vue            # 主组件
│   └── api/               # API 适配层
│       └── adapter.ts     # Tauri API 适配
├── src-tauri/             # Rust Backend
│   ├── src/
│   │   ├── main.rs        # 应用入口
│   │   ├── commands/      # Tauri Commands
│   │   │   ├── mod.rs
│   │   │   └── window.rs  # 窗口命令
│   │   ├── services/      # 服务系统（待实现）
│   │   ├── workers/       # Worker 线程（待实现）
│   │   └── utils/        # 工具函数
│   ├── Cargo.toml         # Rust 依赖配置
│   ├── tauri.conf.json    # Tauri 配置
│   └── build.rs           # 构建脚本
├── package.json           # Node.js 依赖
├── vite.config.ts         # Vite 配置
└── tsconfig.json          # TypeScript 配置
```

## 开发

### 前置要求

- Rust (最新稳定版)
- Node.js 和 pnpm
- Tauri CLI (`cargo install tauri-cli`)

### 安装依赖

```bash
cd apps/photasa
pnpm install
```

### 开发模式

```bash
pnpm tauri:dev
```

这将启动 Vite 开发服务器和 Tauri 应用。

### 构建

```bash
pnpm tauri:build
```

## 当前状态

### ✅ 已完成

- [x] 项目骨架创建
- [x] 基础目录结构
- [x] Rust 依赖配置
- [x] Vite 构建配置
- [x] 基础窗口命令（minimize, maximize, close, isMaximized）
- [x] API 适配层框架

### 🚧 进行中

- [ ] 迁移 renderer 代码
- [ ] 实现更多命令（Shell, Config 等）
- [ ] 服务系统实现

### 📋 待办

- [ ] 迁移核心服务（扫描、导入、缩略图等）
- [ ] 工作流引擎迁移
- [ ] 完整测试

## 参考

- [RFC 0067: 创建 Tauri 应用 Photasa](../../docs/rfc/0067-tauri-app-photasa.md)

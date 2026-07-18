# RFC 0067: 创建 Tauri 应用 Photasa - 总体架构与迁移策略

- **作者**: AI Assistant
- **状态**: ✅ 已完成
- **创建日期**: 2025-01-02
- **关联项目**: Photasa Desktop (Electron)
- **关联 RFC**:
    - [RFC 0073: UI 迁移与适配层](./0073-tauri-ui-migration-adapter.md)（最高优先级，先于后端迁移）
    - [RFC 0068: 扫描服务迁移](./0068-tauri-scan-service-migration.md)
    - [RFC 0069: 缩略图服务迁移](./0069-tauri-thumbnail-service-migration.md)
    - [RFC 0070: 导入服务迁移](./completed/0070-tauri-import-service-migration.md)
    - [RFC 0071: 配置服务迁移](./0071-tauri-config-service-migration.md)
    - [RFC 0072: 天枢服务迁移](./0072-tauri-tianshu-service-migration.md)
- **Phase 5（1:1 体验与工程补齐，已完成）**:
    - [RFC 0101: 启动 Splash](./completed/0101-tauri-startup-splash.md)
    - [RFC 0102: RAW 缩略图占位回退](./completed/0102-tauri-thumbnail-raw-fallback.md)
    - [RFC 0103: 原生依赖构建策略](./completed/0103-tauri-native-deps-build-strategy.md)

## Implementation principle (Photasa / Tauri)

> **Rust rewrite, not TypeScript copy.** Policy: [./TAURI_RUST_REWRITE_POLICY.md](./TAURI_RUST_REWRITE_POLICY.md).

- Electron/Node code is a **behavioral specification** only—not a library for Photasa.
- Implement in `apps/photasa/src-tauri` and `crates/`; **do not** import `@photasa/scan`, `@photasa/import`, or other Node packages from Tauri.
- **1:1 parity** = same IPC/events/on-disk formats; **not** porting TypeScript source.

## 摘要

在 `apps` 目录下创建一个新的 Tauri 应用 `photasa`，将现有的 Electron 应用迁移到 Tauri 架构。本 RFC 作为总体架构文档和迁移策略索引，具体的服务迁移细节请参考各个子 RFC。

## 动机

### 为什么选择 Tauri？

1. **性能优势**：Tauri 使用系统原生 WebView，相比 Electron 的 Chromium 更轻量，启动更快，内存占用更少
2. **安全性**：Rust 的类型安全和内存安全特性，减少潜在的安全漏洞
3. **包体积**：Tauri 应用的最终包体积通常比 Electron 应用小 10-50 倍
4. **跨平台一致性**：更好的原生外观和体验
5. **技术栈多样性**：引入 Rust 技术栈，为团队提供更多技术选择

### 当前 Electron 应用架构

当前 `apps/desktop` 采用三层架构：

```
┌─────────────────────────────────────┐
│   Renderer Process (Vue3)          │
│   - UI 组件和状态管理                │
│   - Pinia Stores                    │
│   - 业务逻辑                        │
└──────────────┬──────────────────────┘
               │ IPC (contextBridge)
┌──────────────▼──────────────────────┐
│   Preload Process                    │
│   - Tianshu API                      │
│   - Legacy API                       │
│   - Helper Functions                 │
└──────────────┬──────────────────────┘
               │ IPC (ipcMain/ipcRenderer)
┌──────────────▼──────────────────────┐
│   Main Process (Node.js)            │
│   - 窗口管理                        │
│   - 服务系统（天庭架构）             │
│   - IPC 处理器                      │
│   - Worker 线程                     │
│   - 文件系统操作                    │
└─────────────────────────────────────┘
```

## 设计

### 目标架构

Tauri 应用将采用以下架构：

```
┌─────────────────────────────────────┐
│   Frontend (Vue3) — UI reuse only     │
│   - Adapt apps/desktop/src/renderer   │
│   - No backend logic in renderer      │
└──────────────┬──────────────────────┘
               │ Tauri Invoke API
┌──────────────▼──────────────────────┐
│   Tauri Rust Backend (rewrite)       │
│   - Commands — Rust 独立实现         │
│   - 不 import Node / @photasa/* 包   │
│   - Electron main 仅作行为规格参考   │
└─────────────────────────────────────┘
```

> **Frontend reuse ≠ backend reuse.** Vue 可从 desktop 复制/adapt；Main 进程逻辑必须在 Rust 中重写，见 [TAURI_RUST_REWRITE_POLICY.md](./TAURI_RUST_REWRITE_POLICY.md)。

### 目录结构

```
apps/
├── desktop/          # 现有 Electron 应用
└── photasa/          # 新 Tauri 应用
    ├── src/          # Frontend (Vue3) — UI from desktop renderer (spec/adapt only)
    │   ├── main.ts   # Vue 应用入口
    │   ├── App.vue   # 主组件
    │   ├── components/  # Vue 组件
    │   ├── stores/    # Pinia stores
    │   ├── services/ # 前端服务
    │   └── ...       # 其他前端代码
    ├── src-tauri/    # Rust Backend
    │   ├── src/
    │   │   ├── main.rs           # 应用入口
    │   │   ├── commands/         # Tauri Commands
    │   │   │   ├── tianshu.rs    # 天枢命令
    │   │   │   ├── import.rs     # 导入命令
    │   │   │   ├── scan.rs       # 扫描命令
    │   │   │   ├── thumbnail.rs  # 缩略图命令
    │   │   │   ├── config.rs     # 配置命令
    │   │   │   ├── window.rs     # 窗口命令
    │   │   │   ├── shell.rs      # Shell 命令
    │   │   │   └── update.rs     # 更新命令
    │   │   ├── services/         # 服务系统
    │   │   │   ├── registry.rs   # 服务注册表
    │   │   │   ├── tianshu.rs    # 天枢服务
    │   │   │   ├── import.rs     # 导入服务
    │   │   │   └── ...           # 其他服务
    │   │   ├── workers/          # Worker 线程
    │   │   ├── utils/            # 工具函数
    │   │   └── lib.rs            # 库入口
    │   ├── Cargo.toml
    │   └── tauri.conf.json
    ├── package.json
    └── vite.config.ts
```

### Electron Main → Tauri Rust 映射

> **映射表仅索引 Electron 行为规格**（IPC 名、事件、磁盘格式）。实现方式为 **Rust 重写**，不得复制 TypeScript 源码或引用 `@photasa/*` Node 包。

#### 1. 窗口管理

**Electron:**

```typescript
// apps/desktop/src/main/index.ts
const mainWindow = new BrowserWindow({
    width, height,
    webPreferences: { preload: ... }
});
```

**Tauri 等价物:**

```rust
// apps/photasa/src-tauri/src/main.rs
use tauri::Manager;

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            let window = app.get_window("main").unwrap();
            // 窗口配置
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

#### 2. IPC 处理器 → Tauri Commands

**Electron IPC Handler:**

```typescript
// apps/desktop/src/main/deity/tianshu-service.ts
ipcMain.handle("tianshu.command", async (_, command) => {
    return await tianshuEngine.processCommand(command);
});
```

**Tauri Command:**

```rust
// apps/photasa/src-tauri/src/commands/tianshu.rs
#[tauri::command]
async fn tianshu_command(command: TianshuCommand) -> Result<TianshuResponse, String> {
    let engine = get_tianshu_engine();
    engine.process_command(command).await
        .map_err(|e| e.to_string())
}
```

#### 3. 服务系统架构

**Electron 服务系统（天庭架构）:**

- 使用装饰器 `@Service` 注册服务
- 服务注册表自动管理依赖和初始化顺序
- 服务通过 `IService` 接口实现

**Tauri Rust 服务系统:**

```rust
// apps/photasa/src-tauri/src/services/registry.rs
pub struct ServiceRegistry {
    services: HashMap<String, Box<dyn Service>>,
}

pub trait Service {
    fn name(&self) -> &str;
    async fn initialize(&mut self) -> Result<(), ServiceError>;
    async fn shutdown(&mut self) -> Result<(), ServiceError>;
}

// 服务实现示例
pub struct TianshuService {
    engine: TianshuEngine,
}

impl Service for TianshuService {
    fn name(&self) -> &str { "tianshu" }

    async fn initialize(&mut self) -> Result<(), ServiceError> {
        // 初始化逻辑
        Ok(())
    }
}
```

#### 4. Worker 线程

**Electron Worker:**

```typescript
// apps/desktop/src/main/import/import-worker.ts
const worker = new Worker(path.join(__dirname, "import-worker.js"));
```

**Tauri 等价物:**

```rust
// apps/photasa/src-tauri/src/workers/import.rs
use std::thread;

pub fn spawn_import_worker() -> thread::JoinHandle<()> {
    thread::spawn(|| {
        // Worker 逻辑
    })
}

// 或使用 tokio 异步任务
use tokio::task;

pub async fn spawn_import_task() {
    task::spawn(async {
        // 异步任务逻辑
    });
}
```

#### 5. 文件系统操作

**Electron:**

```typescript
import fs from "fs-extra";
import path from "path";
```

**Tauri:**

```rust
use std::fs;
use std::path::PathBuf;
use tauri::api::path;

// Tauri 提供了安全的路径 API
#[tauri::command]
async fn read_file(path: String) -> Result<String, String> {
    fs::read_to_string(path)
        .map_err(|e| e.to_string())
}
```

#### 6. 系统集成

**Electron Shell:**

```typescript
import { shell } from "electron";
shell.showItemInFolder(path);
```

**Tauri:**

```rust
use tauri::api::shell;

#[tauri::command]
async fn show_in_folder(path: String) -> Result<(), String> {
    shell::open(&path, None)
        .map_err(|e| e.to_string())
}
```

### Preload → Tauri Invoke API 映射

**Electron Preload:**

```typescript
// apps/desktop/src/preload/tianshu.ts
export const Tianshu = {
    processCommand: (command) => electronAPI.ipcRenderer.invoke("tianshu.command", command),
};
```

**Tauri Frontend:**

```typescript
// apps/photasa/src/api/tianshu.ts
import { invoke } from "@tauri-apps/api/tauri";

export const Tianshu = {
    processCommand: (command: TianshuCommand) =>
        invoke<TianshuResponse>("tianshu_command", { command }),
};
```

### Renderer 适配策略

#### 方案一：创建适配层（推荐）

在 `apps/photasa/src` 中创建适配层，将 Electron API 调用转换为 Tauri API：

```typescript
// apps/photasa/src/api/adapter.ts
import { invoke } from "@tauri-apps/api/tauri";
import { open } from "@tauri-apps/api/dialog";

// 统一 API 接口
export const api = {
    // Tianshu API
    tianshu: {
        processCommand: (command: any) => invoke("tianshu_command", { command }),
        getStatus: () => invoke("tianshu_status"),
    },

    // 文件操作
    chooseDirectory: () => open({ directory: true }),

    // ... 其他 API
};

// 在 main.ts 中注入
window.api = api;
```

#### 方案二：条件导入

在共享代码中使用条件导入：

```typescript
// 共享代码
const isTauri = typeof window.__TAURI__ !== "undefined";

if (isTauri) {
    // 使用 Tauri API
    const { invoke } = await import("@tauri-apps/api/tauri");
} else {
    // 使用 Electron API
    const { ipcRenderer } = require("electron");
}
```

**推荐使用方案一**，因为它提供了更好的类型安全和代码组织。

### Electron 端 API/IPC 对照（代码审查）

以下为对 `apps/desktop/src/main` 与 `preload/legacy.ts` 的审查结果，迁移时须与此一致。

| 领域               | 主进程 IPC（channel）                                                                                                                                           | 方向                                  | 说明                                                               |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- | ------------------------------------------------------------------ |
| **扫描**           | `picasa:scan-photos`                                                                                                                                            | renderer → main (send)                | 参数 `{ requestId, scanAction }`                                   |
|                    | `picasa:find-photo`                                                                                                                                             | main → renderer (send)                | 扫描进度/结果/错误                                                 |
| **缩略图**         | `picasa:create-thumbnail`                                                                                                                                       | invoke                                | `ThumbnailServiceAction.create`                                    |
|                    | `picasa:remove-thumbnail`                                                                                                                                       | invoke                                | `ThumbnailServiceAction.remove`                                    |
| **导入**           | `import:scan-directories`                                                                                                                                       | invoke                                | 见 `packages/common` 的 `ImportEvents`                             |
|                    | `import:preview`, `import:execute`, `import:cancel`, `import:pause`, `import:resume`                                                                            | invoke                                |                                                                    |
|                    | `import:get-progress`, `import:get-history`, `import:get-details`, `import:preview-undo`, `import:undo`, `import:choose-directories`, `import:extract-metadata` | invoke                                |                                                                    |
|                    | `import:progress`, `import:complete`, `import:error`                                                                                                            | main → renderer (send)                | 事件                                                               |
| **配置（主进程）** | `picasa:query-config`                                                                                                                                           | on (fire-and-forget)                  | 参数 `{ paths: string[] }`，结果由 main 发 `picasa:photasa-config` |
|                    | `picasa:add-config`                                                                                                                                             | handle                                | 参数 `{ paths: string[] }`                                         |
|                    | `picasa:remove-config`                                                                                                                                          | main → renderer (send)                | Worker 完成后由 main 发送                                          |
| **目录**           | `picasa:get-directory`                                                                                                                                          | handle                                | 参数 `{ name }`                                                    |
|                    | `picasa:choose-directory`                                                                                                                                       | send → on `picasa:selected-directory` | 选择目录                                                           |
|                    | `picasa:check-photasa-config`                                                                                                                                   | handle                                | 参数 folderPath                                                    |
|                    | `picasa:sub-folders`                                                                                                                                            | handle                                | 参数 `{ parent }`                                                  |
| **天枢**           | `tianshu.command`                                                                                                                                               | handle                                |                                                                    |
|                    | `tianshu.status`                                                                                                                                                | handle                                |                                                                    |
| **Shell**          | `shell:openExternal`                                                                                                                                            | handle                                | url                                                                |
|                    | `picasa:open-in-finder`                                                                                                                                         | on                                    | args: `{ path }`                                                   |
| **窗口**           | `window:minimize/maximize/unmaximize/close/queryMaximized`                                                                                                      | send                                  |                                                                    |
|                    | `window:maximized/unmaximized/maximizedState`                                                                                                                   | main → renderer                       |                                                                    |
| **日志**           | `log:viewer-open`, `log:viewer-close`                                                                                                                           | invoke                                | `log:entry`, `log:toggle-viewer` 为 on                             |

说明：渲染层使用的 `window.api` 由 `preload/legacy.ts` 暴露，为**扁平 API**（如 `minimizeWindow()`, `scanPhotos()`, `createThumbnail()`）。Preload 中部分配置相关逻辑在 `file-config.ts` 内用 Node/fs 实现（如 `getPhotasaConfig`, `addToPhotoList`, `resetPhotasaConfig`, `fixPhotasaConfig`），未走主进程 config-service；Tauri 迁移时需在 Rust 或兼容层中统一实现等价能力。

### 关键服务迁移清单

每个服务都有独立的 RFC 文档，详细说明迁移步骤和技术细节：

#### 核心服务（必须迁移）

1. **扫描服务 (ScanService)** - [RFC 0068](./0068-tauri-scan-service-migration.md)
    - IPC: `picasa:scan-photos` (send), `picasa:find-photo` (main→renderer)
    - 功能：照片扫描和索引
    - 预计时间：2-3 周

2. **缩略图服务 (ThumbnailService)** - [RFC 0069](./0069-tauri-thumbnail-service-migration.md)
    - IPC: `picasa:create-thumbnail`, `picasa:remove-thumbnail` (invoke)
    - 功能：缩略图生成和缓存
    - 预计时间：2-3 周

3. **导入服务 (ImportService)** - [RFC 0070](./completed/0070-tauri-import-service-migration.md)
    - IPC: `ImportEvents.*`（见上表及 `packages/common`）
    - 功能：照片导入管理
    - 预计时间：2-3 周

4. **配置服务 (ConfigService)** - [RFC 0071](./0071-tauri-config-service-migration.md)
    - IPC: `picasa:query-config` (on), `picasa:add-config` (handle), `picasa:photasa-config` / `picasa:remove-config` (main→renderer)
    - 功能：应用配置与 .photasa.json；preload 中 getPhotasaConfig/addToPhotoList 等亦需在 Tauri 侧实现
    - 预计时间：1-2 周

5. **天枢服务 (TianshuService)** - [RFC 0072](./0072-tauri-tianshu-service-migration.md)
    - IPC: `tianshu.command`, `tianshu.status`
    - 功能：工作流编排引擎
    - 预计时间：3-4 周（最复杂）

#### 基础服务（相对简单）

6. **窗口服务 (WindowService)** - 已在阶段一完成 ✅
    - IPC: `window:minimize`, `window:maximize` 等
    - 功能：窗口控制
    - 状态：已完成

7. **Shell 服务 (ShellService)** - 阶段二
    - IPC: `shell:openExternal`, `picasa:open-in-finder`
    - 功能：系统 Shell 集成
    - 预计时间：1 周

8. **更新服务 (UpdateService)** - 阶段二
    - IPC: `update:check`, `update:install` 等
    - 功能：自动更新
    - 预计时间：1-2 周

### 技术挑战和解决方案

#### 1. 图像处理库

**问题**：当前使用 Sharp、FFmpeg 等 Node.js 库进行图像处理；Ma-Liang 引擎（见 RFC 0031）在 `thumbnail-handler.ts` 中统一调度各“神笔”（Sharp/Heic/FFmpeg/Bmp/Fallback）。

**解决方案**：分阶段、按格式迁移，详见 [RFC 0069 的 Image processing support plan](./0069-tauri-thumbnail-service-migration.md#image-processing-support-plan-tauri)。要点：

- **常见图片**：Rust `image` / `imageproc`。
- **视频**：保留 FFmpeg 二进制，由 Rust 调用。
- **HEIC**：`heif-rs` 或现有 WASM；过渡期可选 Node 子进程仅处理 HEIC。
- 不新增独立“图像处理迁移”RFC；0069 为唯一规格。

#### 2. 工作流引擎

**问题**：当前工作流引擎（Zouwu）是 TypeScript 实现。

**解决方案**：

- **选项 A**：完全重写为 Rust（**最终目标**）
- **选项 B**：通过 WASM 运行 TypeScript 工作流引擎（**第一步过渡**）
- **选项 C**：保留 Node.js 进程运行工作流，通过 IPC 通信（备选过渡）

**决策**：采用选项 B（第一步过渡）→ 选项 A（最终目标）。

- **第一步**：将工作流引擎核心逻辑编译为 WASM，在 Rust 中运行
- **第二步**：逐步将 WASM 模块重写为纯 Rust 实现
- **优势**：可以快速让现有代码工作，同时为完全重写做准备

#### 3. 服务系统依赖管理

**问题**：当前服务系统使用装饰器和反射自动注册。

**解决方案**：

- Rust 使用宏系统实现类似功能
- 或使用显式注册表

```rust
// 使用宏
#[service(name = "tianshu", priority = "critical")]
pub struct TianshuService { ... }

// 或显式注册
let registry = ServiceRegistry::new()
    .register(TianshuService::new())
    .register(ImportService::new());
```

#### 4. 单例管理

**问题**：Electron 使用单例锁确保只有一个实例。

**解决方案**：

```rust
use tauri::api::process::restart;

#[tauri::command]
async fn ensure_single_instance() -> Result<(), String> {
    // Tauri 内置单例支持
    // 或使用系统级单例锁
}
```

### 迁移策略

#### 阶段一：基础设施搭建（1-2 周）

1. 创建 Tauri 项目骨架
2. 设置 Rust 开发环境
3. 配置构建系统（Vite + Tauri）
4. 创建基础命令结构
5. 实现窗口管理

#### 阶段二：核心 API 迁移（2-3 周）

1. 迁移窗口服务
2. 迁移 Shell 服务
3. 迁移配置服务
4. 创建前端适配层
5. 测试基础功能

#### 阶段三：业务服务迁移（6-10 周）

每个服务都有独立的 RFC 文档，详细说明迁移步骤：

1. **迁移扫描服务** - [RFC 0068](./0068-tauri-scan-service-migration.md)
    - 文件遍历（klaw → walkdir）
    - 扫描策略决策（SKIP/INCREMENTAL/FULL）
    - 增量缓存管理
    - Worker 线程 → Tokio Tasks
    - 预计时间：2-3 周

2. **迁移缩略图服务** - [RFC 0069](./0069-tauri-thumbnail-service-migration.md)
    - 图像处理库选择
    - 缩略图生成实现（IPC: `picasa:create-thumbnail`, `picasa:remove-thumbnail`）
    - 缓存管理
    - 预计时间：2-3 周

3. **迁移导入服务** - [RFC 0070](./completed/0070-tauri-import-service-migration.md)
    - 文件扫描和元数据提取
    - 导入操作流程（`ImportEvents.*`）
    - 进度跟踪
    - 预计时间：2-3 周

4. **迁移天枢服务** - [RFC 0072](./0072-tauri-tianshu-service-migration.md)
    - 工作流引擎设计
    - 命令处理系统
    - 状态管理
    - 预计时间：3-4 周（最复杂）

#### 阶段四：优化和测试（2-3 周）

1. 性能优化
2. 内存优化
3. 完整测试
4. 文档完善

### 依赖关系

#### Rust 依赖（Cargo.toml）

```toml
[dependencies]
tauri = { version = "1.5", features = ["shell-open", "dialog-all", "fs-all", "path-all"] }
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
tokio = { version = "1.0", features = ["full"] }
anyhow = "1.0"
thiserror = "1.0"
image = "0.24"  # 图像处理
walkdir = "2.0"  # 目录遍历
notify = "6.0"   # 文件系统监听
```

#### Frontend 依赖

```json
{
    "dependencies": {
        "@tauri-apps/api": "^1.5.0",
        "@tauri-apps/plugin-shell": "^1.0.0",
        "@tauri-apps/plugin-dialog": "^1.0.0",
        "@tauri-apps/plugin-fs": "^1.0.0"
    }
}
```

## 实施计划

### 总体迁移路线图

迁移分为 4 个主要阶段，每个阶段包含多个子任务，每个子任务都有对应的详细 RFC：

```
阶段一：基础设施搭建（1-2 周）✅ 已完成
├── 项目骨架创建 ✅
├── 基础目录结构 ✅
├── 窗口命令实现 ✅
└── WASM 运行时准备 ✅

阶段二：核心 API 迁移（2-3 周）
├── Shell 服务迁移
├── 配置服务迁移 (RFC 0071)
└── 前端适配层创建

阶段三：业务服务迁移（6-10 周）
├── 扫描服务迁移 (RFC 0068) - 2-3 周
├── 缩略图服务迁移 (RFC 0069) - 2-3 周
├── 导入服务迁移 (RFC 0070) - 2-3 周
└── 天枢服务迁移 (RFC 0072) - 3-4 周

阶段四：优化和测试（2-3 周）
├── 性能优化
├── 内存优化
├── 完整测试
└── 文档完善
```

### 详细任务清单

#### 阶段一：基础设施搭建 ✅

- [x] 创建 Tauri 项目骨架
- [x] 配置 `tauri.conf.json`
- [x] 设置 Rust 开发环境
- [x] 配置 Vite 构建
- [x] 创建基础目录结构
- [x] 实现窗口命令
- [x] WASM 运行时准备

#### 阶段二：核心 API 迁移

- [ ] Shell 服务迁移
- [ ] 配置服务迁移（参考 RFC 0071）
- [ ] 更新服务迁移
- [ ] 创建前端适配层
- [ ] 类型定义完善

#### 阶段三：业务服务迁移

每个服务都有独立的 RFC，包含详细的实施步骤：

- [ ] **扫描服务迁移**（参考 [RFC 0068](./0068-tauri-scan-service-migration.md)）
    - [ ] 文件遍历实现
    - [ ] 扫描策略决策
    - [ ] 增量缓存管理
    - [ ] Worker 线程迁移
    - [ ] 集成测试

- [ ] **缩略图服务迁移**（参考 RFC 0069）
    - [ ] 图像处理库选择
    - [ ] 缩略图生成实现
    - [ ] 缓存管理
    - [ ] 性能优化

- [ ] **导入服务迁移**（参考 RFC 0070）
    - [ ] 文件扫描
    - [ ] 元数据提取
    - [ ] 导入操作
    - [ ] 进度跟踪

- [ ] **天枢服务迁移**（参考 RFC 0072）
    - [ ] 工作流引擎设计
    - [ ] 命令处理
    - [ ] 状态管理
    - [ ] 事件系统

#### 阶段 2.5：UI 与扁平 API 兼容层（见 [RFC 0073](./0073-tauri-ui-migration-adapter.md)）

- [ ] 提供与 `preload/legacy.ts` 一致的扁平 `window.api`，使现有 Vue/utils 无需改调用即可在 Tauri 下运行
- [ ] 复制/同步 renderer 内容后验证 `npm run tauri dev` 可启动且无 `window.api.xxx` 未定义错误

#### 阶段五：测试和验证

- [ ] 单元测试（Rust）
- [ ] 单元测试（TypeScript）
- [ ] 集成测试
- [ ] E2E 测试
- [ ] 性能测试
- [ ] 内存泄漏测试

## 风险和挑战

### 技术风险

1. **图像处理性能**：Rust 图像库可能不如 Sharp 成熟
    - **缓解**：保留 FFmpeg 二进制，逐步迁移

2. **工作流引擎复杂度**：完全重写工作流引擎工作量大
    - **缓解**：先通过 IPC 调用 Node.js 进程，逐步迁移

3. **生态系统差异**：Rust 生态系统与 Node.js 不同
    - **缓解**：充分调研 Rust 库，必要时使用 FFI

### 时间风险

- 预计总耗时：10-14 周
- **缓解**：分阶段实施，每个阶段可独立交付价值

### 维护风险

- 需要维护两套代码（Electron + Tauri）
- **缓解**：共享前端代码，仅后端不同

## 替代方案

### 方案 A：全栈从零重写（不推荐）

从零编写全新 Vue + Rust，**不**复用 desktop renderer。成本高、与当前渐进迁移策略不符。

### 方案 B：渐进迁移（推荐，已采用）

- **Backend**：Rust **重写**（非 TS 复制），Electron main 仅作行为规格（[TAURI_RUST_REWRITE_POLICY.md](./TAURI_RUST_REWRITE_POLICY.md)）
- **Frontend**：复用/adapt `desktop` renderer UI，经 adapter 调 Rust
- **优点**：风险可控，可对比测试，UI 交付快
- **缺点**：过渡期内需维护 Electron + Tauri 两套后端

### 方案 C：混合架构（已拒绝 — 违反黄金规则）

Tauri 主进程 + Node.js Worker 处理复杂任务。**不采用**：Photasa 目标为 **100% Rust 后端**，禁止在 Tauri 路径保留 Node worker 或复制 TS 包。

## 未解决的问题

1. **图像处理库选择**：需要评估 Rust 图像库的性能和功能完整性
2. **工作流引擎迁移策略**：是否需要完全重写，还是通过 WASM/FFI
3. **测试策略**：如何确保 Tauri 版本功能与 Electron 版本一致
4. **性能基准**：需要建立性能基准测试，对比两个版本

## 成功标准

1. **功能完整性**：Tauri 版本实现所有 Electron 版本的核心功能
2. **性能提升**：启动时间减少 30%+，内存占用减少 40%+
3. **包体积**：最终应用包体积减少 50%+
4. **稳定性**：无关键 bug，通过所有测试

## 后续工作

1. ✅ **RFC 创建完成**：所有子 RFC 已创建，包含详细的迁移计划
2. **技术调研**：深入调研 Rust 图像处理库和工作流引擎方案
3. **原型开发**：创建最小可行原型验证架构可行性
4. **团队培训**：Rust 语言和 Tauri 框架培训
5. **开始实施**：按照阶段顺序开始迁移工作

## RFC 创建完成总结

所有迁移相关的 RFC 已创建完成：

### 主 RFC

- ✅ **RFC 0067**: 总体架构与迁移策略（本文档）

### 子 RFC（服务迁移详细计划）

- ✅ **RFC 0068**: 扫描服务迁移 - 包含完整实施步骤和代码示例
- ✅ **RFC 0069**: 缩略图服务迁移 - 包含图像处理方案
- ✅ **RFC 0070**: 导入服务迁移 - 包含导入流程设计
- ✅ **RFC 0071**: 配置服务迁移 - 包含配置管理方案
- ✅ **RFC 0072**: 天枢服务迁移 - 包含工作流引擎迁移策略

### 总预计时间

- **阶段一**：基础设施搭建 - 1-2 周 ✅ 已完成
- **阶段二**：核心 API 迁移 - 2-3 周
- **阶段三**：业务服务迁移 - 6-10 周
    - 扫描服务：2-3 周
    - 缩略图服务：2-3 周
    - 导入服务：2-3 周
    - 配置服务：1-2 周
    - 天枢服务：3-4 周
- **阶段四**：优化和测试 - 2-3 周

**总计：11-18 周**（约 3-4.5 个月）

## RFC 结构说明

本 RFC 作为总体架构文档，具体的服务迁移细节已拆分为独立的子 RFC：

### 主 RFC

- **RFC 0067**（本文档）：总体架构、迁移策略、技术映射

### 子 RFC（服务迁移详细计划）

每个服务迁移都有独立的 RFC，包含：

- 当前架构分析
- 详细的技术实现方案
- 代码示例
- 迁移步骤清单
- 时间估算

**已创建的子 RFC：**

- ✅ [RFC 0068: 扫描服务迁移](./0068-tauri-scan-service-migration.md) - 详细计划已制定
- ✅ [RFC 0069: 缩略图服务迁移](./0069-tauri-thumbnail-service-migration.md) - 详细计划已制定
- ✅ [RFC 0070: 导入服务迁移](./completed/0070-tauri-import-service-migration.md) - 详细计划已制定
- ✅ [RFC 0071: 配置服务迁移](./0071-tauri-config-service-migration.md) - 详细计划已制定
- ✅ [RFC 0072: 天枢服务迁移](./0072-tauri-tianshu-service-migration.md) - 详细计划已制定

### 如何阅读这些 RFC

1. **开始迁移前**：先阅读 RFC 0067 了解总体架构和策略
2. **迁移特定服务时**：阅读对应的子 RFC 获取详细实施步骤
3. **遇到问题时**：参考 RFC 0067 中的技术映射和解决方案

### 子 RFC 状态

| RFC                                                            | 服务       | 状态        | 预计时间 | 复杂度 |
| -------------------------------------------------------------- | ---------- | ----------- | -------- | ------ |
| [RFC 0068](./0068-tauri-scan-service-migration.md)             | 扫描服务   | ✅ 计划完成 | 2-3 周   | 中等   |
| [RFC 0069](./0069-tauri-thumbnail-service-migration.md)        | 缩略图服务 | ✅ 计划完成 | 2-3 周   | 中等   |
| [RFC 0070](./completed/0070-tauri-import-service-migration.md) | 导入服务   | ✅ 计划完成 | 2-3 周   | 中等   |
| [RFC 0071](./0071-tauri-config-service-migration.md)           | 配置服务   | ✅ 计划完成 | 1-2 周   | 简单   |
| [RFC 0072](./0072-tauri-tianshu-service-migration.md)          | 天枢服务   | ✅ 计划完成 | 3-4 周   | 复杂   |

## 参考资源

- [Tauri 官方文档](https://tauri.app/)
- [Tauri API 参考](https://tauri.app/api/)
- [Rust 图像处理库](https://github.com/image-rs/image)
- [Tauri 插件生态](https://github.com/tauri-apps/plugins-workspace)

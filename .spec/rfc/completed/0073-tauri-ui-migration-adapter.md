# RFC 0073: UI 迁移与适配层设计

- **作者**: AI Assistant
- **状态**: ✅ **已关闭**（2026-07-21）— 适配层与 UI 迁移目标已达成；剩余项见 [RFC 0149](./0149-tauri-ui-adapter-post-closure.md)
- **创建日期**: 2025-01-15
- **优先级**: 🔴 最高优先级（应在所有后端服务迁移之前完成）
- **关联 RFC**: [RFC 0067: 创建 Tauri 应用 Photasa](./0067-tauri-app-photasa.md)

## 2026-07-21 关闭说明

**0073 正式关闭。** 嵌套 adapter + 扁平 `legacy-api` 已落地，Tauri 可 `tauri dev` 跑完整 UI，各域 stub 已由 0068–0072 / 0097 等 RFC 替换为真实 Rust 命令。

**不在本 RFC 继续跟踪的事项**（已拆到子 RFC）：

| 剩余主题              | 跟踪 RFC                                               |
| --------------------- | ------------------------------------------------------ |
| `legacy-api` 退役     | [0137](../0137-tauri-zhenguan-direct-ipc-migration.md) |
| shell/menu zouwu 退场 | [0150](./0150-tauri-shell-menu-zouwu-retirement.md) ✅ |
| 汇总清单与验收        | [0149](./0149-tauri-ui-adapter-post-closure.md) ✅     |

下方 checklist 为 2025-01-15 规划快照，**2026-07-21 已全部勾选关闭**（功能以代码与测试为准，非本表实时状态）。

## 2026-07-21 归档说明（历史）

嵌套 adapter 结构（`api/window.adapter.ts`/`shell.adapter.ts`/`tianshu.adapter.ts`/`scan.adapter.ts`/`thumbnail.adapter.ts`/`import.adapter.ts`/`config.adapter.ts`）与本文档设计一致，均已落地且是真实 `invoke()` 调用（非本文档示例代码里的 stub 假数据），`apps/photasa/src/api/adapter.ts` 统一导出，被真实调用方引用。扁平 `window.api` 兼容层由 [RFC 0075](./completed/0075-tauri-flat-legacy-api-layer.md) 落地为 `legacy-api.ts`，两层并存，符合本文档"扁平 window.api 与兼容层"一节的预期设计。正文 checklist（阶段 1-4）、时间估算（5-9 天）是 2025-01-15 的规划快照，未反映实际勾选状态，不代表未完成——功能验证以 `cargo test -p photasa`（73 passed）与各真实调用方为准。

## Implementation principle (Photasa / Tauri)

> **Rust rewrite, not TypeScript copy.** Policy: [ROADMAP.md](../../../ROADMAP.md).

- Electron/Node code is a **behavioral specification** only—not a library for Photasa.
- Implement in `apps/photasa/src-tauri` and `crates/`; **do not** import `@photasa/scan`, `@photasa/import`, or other Node packages from Tauri.
- **1:1 parity** = same IPC/events/on-disk formats; **not** porting TypeScript source.

## 摘要

本文档详细说明如何将 Electron 应用的 UI 层迁移到 Tauri，并通过适配器模式实现渐进式后端替换。**这是最高优先级的迁移任务**，因为它让 Tauri 应用可以立即运行，为后续的后端服务迁移提供可视化验证环境。

## 动机

### 为什么 UI 迁移应该是第一步？

1. **快速验证**：让 UI 先跑起来，可以验证 Tauri 集成是否正确
2. **并行开发**：UI 可以继续迭代，Rust 后端逐步实现
3. **增量替换**：每实现一个服务，就替换对应的 stub
4. **风险降低**：早发现 UI 兼容性问题
5. **可视化进度**：团队可以看到真实的应用运行

### 当前问题

RFC 0067 将 UI 迁移放在"阶段四"，这是错误的顺序：

```
❌ 原计划（有问题）：
阶段一：基础设施 ✅
阶段二：核心 API 迁移 (Shell, Config, Update)
阶段三：业务服务迁移 (Scan, Thumbnail, Import, Tianshu)
阶段四：Renderer 代码迁移  ← 太晚了！

✅ 推荐计划（先跑 UI）：
阶段一：基础设施 ✅
阶段 1.5：UI + 适配层 ← 本 RFC！
阶段二：逐步替换适配器后端
阶段三：完善和优化
```

## 设计

### 核心思想：适配器模式

```
┌─────────────────────────────────────────────────────────┐
│                    Vue UI 组件                           │
│     (UI adapted from desktop renderer — not backend)    │
└──────────────────────┬──────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────┐
│                   适配层 (Adapter)                       │
│                  src/api/adapter.ts                      │
│  ┌─────────────────────────────────────────────────┐    │
│  │  if (isTauri) {                                 │    │
│  │    return invoke("command", args);              │    │
│  │  } else {                                       │    │
│  │    return window.electronAPI.command(args);     │    │
│  │  }                                              │    │
│  └─────────────────────────────────────────────────┘    │
└──────────────────────┬──────────────────────────────────┘
                       │
          ┌────────────┴────────────┐
          ▼                         ▼
┌──────────────────┐      ┌──────────────────┐
│   Tauri Backend  │      │ Electron Backend │
│   (Rust/Stub)    │      │   (保持不变)      │
└──────────────────┘      └──────────────────┘
```

### 扁平 window.api 与兼容层

渲染层与 `utils/api.ts` 使用的是 **Electron preload 暴露的扁平 API**（见 `apps/desktop/src/preload/legacy.ts`），例如：

- 窗口：`minimizeWindow`, `maximizeWindow`, `unmaximizeWindow`, `closeWindow`, `queryMaximized`, `onWindowMaximized`, `onWindowUnmaximized`, `onWindowMaximizedState`, `off*`
- 路径：`normalizePath`, `mergePath`, `splitPath`, `joinPath`, `getSeparator`, `toFileName`, `toDirName`, `isFileUnderFolder`, `isHiddenFile`, …
- 扫描/配置：`scanPhotos`, `scanSubfolders`, `getPhotasaConfig`, `addToPhotoList`, `removeFromPhotoList`, `resetPhotasaConfig`, `fixPhotasaConfig`, `checkPhotasaConfig`, `cleanupScanQueue`
- 缩略图：`createThumbnail`, `removeThumbnail`, `getImageType`, `getFileMetadata`, `isVideoFile`, `isImageFile`, `toThumbnailName`, `shortenThumbnailName`
- 导入：`scanDirectories`, `previewImport`, `executeImport`, `onImportProgress`, `cancelImport`, `pauseImport`, `resumeImport`, `getImportHistory`, `getImportDetails`, `previewUndo`, `undoImport`, `getImportProgress`, `chooseDirectories`, `extractMetadata`, `onImportComplete`, `onImportError`, `removeImportListeners`
- 目录：`chooseDirectory`, `getDirectory`
- 其他：`startWatching`, `stopWatching`, `importPhotos`, `applySystemMenu`, `onMenuAction`, `log.*`, 更新相关 API，`onScanQueueAdd`

在 Tauri 下须提供与上述**同名的扁平 `window.api`**（例如通过 `legacy-api.ts` 或等价实现），内部委托到嵌套 adapter 或 `invoke`，否则现有 Vue/utils 会出现 `window.api.xxx is not a function`。

### 目录结构

```
apps/photasa/
├── src/                          # 前端代码（从 desktop/src/renderer 复制）
│   ├── api/                      # 适配层
│   │   ├── adapter.ts            # 主适配器（嵌套形态）
│   │   ├── legacy-api.ts         # 扁平 window.api 兼容层（与 legacy.ts 对齐）
│   │   ├── env.ts                # isTauri()
│   │   ├── tianshu.adapter.ts    # 天枢适配器
│   │   ├── scan.adapter.ts       # 扫描适配器
│   │   ├── thumbnail.adapter.ts  # 缩略图适配器
│   │   ├── import.adapter.ts     # 导入适配器
│   │   ├── config.adapter.ts     # 配置适配器
│   │   ├── shell.adapter.ts      # Shell 适配器
│   │   └── window.adapter.ts     # 窗口适配器
│   ├── components/               # Vue 组件（复制）
│   ├── composables/              # Composables（复制）
│   ├── stores/                   # Pinia stores（复制）
│   ├── services/                 # 前端服务（复制，需适配）
│   ├── views/                    # 视图组件（复制）
│   ├── App.vue                   # 主组件
│   └── main.ts                   # 入口文件
├── src-tauri/
│   └── src/
│       └── commands/
│           ├── mod.rs            # 命令模块
│           ├── window.rs         # 窗口命令 ✅
│           ├── shell.rs          # Shell 命令
│           └── stubs.rs          # Stub 命令（临时）
├── index.html
├── vite.config.ts
└── package.json
```

## 实现

### 第一步：适配层核心设计

#### 1.1 环境检测

```typescript
// src/api/env.ts

/**
 * 检测当前运行环境
 */
export const isTauri = (): boolean => {
    return typeof window !== "undefined" && typeof (window as any).__TAURI__ !== "undefined";
};

/**
 * 获取 Tauri invoke 函数
 */
export const getTauriInvoke = async () => {
    if (!isTauri()) {
        throw new Error("Not running in Tauri environment");
    }
    const { invoke } = await import("@tauri-apps/api/tauri");
    return invoke;
};
```

#### 1.2 主适配器

```typescript
// src/api/adapter.ts

import { isTauri } from "./env";
import { windowAdapter } from "./window.adapter";
import { shellAdapter } from "./shell.adapter";
import { tianshuAdapter } from "./tianshu.adapter";
import { scanAdapter } from "./scan.adapter";
import { thumbnailAdapter } from "./thumbnail.adapter";
import { importAdapter } from "./import.adapter";
import { configAdapter } from "./config.adapter";

/**
 * 统一 API 适配器
 *
 * 使用方式：
 * import { api } from '@/api/adapter';
 * await api.window.minimize();
 */
export const api = {
    /** 窗口控制 */
    window: windowAdapter,

    /** Shell 操作 */
    shell: shellAdapter,

    /** 天枢工作流引擎 */
    tianshu: tianshuAdapter,

    /** 扫描服务 */
    scan: scanAdapter,

    /** 缩略图服务 */
    thumbnail: thumbnailAdapter,

    /** 导入服务 */
    import: importAdapter,

    /** 配置服务 */
    config: configAdapter,

    /** 环境信息 */
    env: {
        isTauri: isTauri(),
        platform: isTauri() ? "tauri" : "electron",
    },
};

// 全局注入（可选，用于兼容旧代码）
if (typeof window !== "undefined") {
    (window as any).api = api;
}

export default api;
```

#### 1.3 窗口适配器（Tauri 原生支持）

```typescript
// src/api/window.adapter.ts

import { isTauri } from "./env";

export const windowAdapter = {
    /**
     * 最小化窗口
     */
    minimize: async (): Promise<void> => {
        if (isTauri()) {
            const { appWindow } = await import("@tauri-apps/api/window");
            await appWindow.minimize();
        } else {
            await (window as any).electronAPI?.window?.minimize();
        }
    },

    /**
     * 最大化/还原窗口
     */
    maximize: async (): Promise<void> => {
        if (isTauri()) {
            const { appWindow } = await import("@tauri-apps/api/window");
            await appWindow.toggleMaximize();
        } else {
            await (window as any).electronAPI?.window?.maximize();
        }
    },

    /**
     * 关闭窗口
     */
    close: async (): Promise<void> => {
        if (isTauri()) {
            const { appWindow } = await import("@tauri-apps/api/window");
            await appWindow.close();
        } else {
            await (window as any).electronAPI?.window?.close();
        }
    },

    /**
     * 检查是否最大化
     */
    isMaximized: async (): Promise<boolean> => {
        if (isTauri()) {
            const { appWindow } = await import("@tauri-apps/api/window");
            return await appWindow.isMaximized();
        } else {
            return (await (window as any).electronAPI?.window?.isMaximized()) ?? false;
        }
    },

    /**
     * 设置窗口标题
     */
    setTitle: async (title: string): Promise<void> => {
        if (isTauri()) {
            const { appWindow } = await import("@tauri-apps/api/window");
            await appWindow.setTitle(title);
        } else {
            await (window as any).electronAPI?.window?.setTitle(title);
        }
    },
};
```

#### 1.4 Shell 适配器（Tauri 原生支持）

```typescript
// src/api/shell.adapter.ts

import { isTauri } from "./env";

export const shellAdapter = {
    /**
     * 在默认浏览器中打开 URL
     */
    openExternal: async (url: string): Promise<void> => {
        if (isTauri()) {
            const { open } = await import("@tauri-apps/api/shell");
            await open(url);
        } else {
            await (window as any).electronAPI?.shell?.openExternal(url);
        }
    },

    /**
     * 在文件管理器中显示文件
     */
    showInFolder: async (path: string): Promise<void> => {
        if (isTauri()) {
            const { invoke } = await import("@tauri-apps/api/tauri");
            await invoke("show_in_folder", { path });
        } else {
            await (window as any).electronAPI?.shell?.showItemInFolder(path);
        }
    },
};
```

#### 1.5 天枢适配器（Stub 实现）

```typescript
// src/api/tianshu.adapter.ts

import { isTauri } from "./env";
import type { Fulu, ZhaolingResponse } from "@/interfaces/fang-xuan-ling.interface";

export const tianshuAdapter = {
    /**
     * 处理天枢命令
     *
     * 初期使用 stub 返回，逐步替换为真实实现
     */
    processCommand: async (fulu: Fulu): Promise<ZhaolingResponse> => {
        if (isTauri()) {
            const { invoke } = await import("@tauri-apps/api/tauri");
            return await invoke("tianshu_command", { command: fulu });
        } else {
            // Electron 实现
            return await (window as any).electronAPI?.tianshu?.processCommand(fulu);
        }
    },

    /**
     * 获取天枢状态
     */
    getStatus: async (): Promise<{ workflows: number; status: string }> => {
        if (isTauri()) {
            const { invoke } = await import("@tauri-apps/api/tauri");
            return await invoke("tianshu_status");
        } else {
            return await (window as any).electronAPI?.tianshu?.getStatus();
        }
    },
};
```

#### 1.6 扫描适配器（Stub 实现）

```typescript
// src/api/scan.adapter.ts

import { isTauri } from "./env";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

export interface ScanAction {
    path: string;
    operationType: "file" | "directory";
    action: "scan" | "rescan" | "current";
    thumbnailSize?: number;
}

export interface ScanResult {
    type: "progress" | "complete" | "error";
    requestId: string;
    paths?: string[];
    error?: string;
}

export const scanAdapter = {
    /**
     * 扫描照片
     */
    scanPhotos: async (requestId: string, scanAction: ScanAction): Promise<void> => {
        if (isTauri()) {
            const { invoke } = await import("@tauri-apps/api/tauri");
            await invoke("scan_photos", { requestId, scanAction });
        } else {
            await (window as any).electronAPI?.scan?.scanPhotos(requestId, scanAction);
        }
    },

    /**
     * 监听扫描结果
     */
    onScanResult: async (
        callback: (result: ScanResult) => void,
    ): Promise<UnlistenFn | (() => void)> => {
        if (isTauri()) {
            return await listen<ScanResult>("picasa:find-photo", (event) => {
                callback(event.payload);
            });
        } else {
            // Electron 监听
            const handler = (_event: any, result: ScanResult) => callback(result);
            (window as any).electronAPI?.scan?.onResult(handler);
            return () => {
                (window as any).electronAPI?.scan?.offResult(handler);
            };
        }
    },
};
```

#### 1.7 缩略图适配器（Stub 实现）

```typescript
// src/api/thumbnail.adapter.ts

import { isTauri } from "./env";

export interface ThumbnailRequest {
    path: string;
    thumbnail: string;
    width?: number;
    height?: number;
    withoutEnlargement?: boolean;
    preview?: string;
    always?: boolean;
}

export interface ThumbnailResponse {
    success: boolean;
    file?: string;
    error?: string;
}

export const thumbnailAdapter = {
    /**
     * 创建缩略图
     */
    create: async (request: ThumbnailRequest): Promise<ThumbnailResponse> => {
        if (isTauri()) {
            const { invoke } = await import("@tauri-apps/api/tauri");
            return await invoke("create_thumbnail", { request });
        } else {
            return await (window as any).electronAPI?.thumbnail?.create(request);
        }
    },

    /**
     * 删除缩略图
     */
    remove: async (request: ThumbnailRequest): Promise<ThumbnailResponse> => {
        if (isTauri()) {
            const { invoke } = await import("@tauri-apps/api/tauri");
            return await invoke("remove_thumbnail", { request });
        } else {
            return await (window as any).electronAPI?.thumbnail?.remove(request);
        }
    },
};
```

#### 1.8 导入适配器（Stub 实现）

```typescript
// src/api/import.adapter.ts

import { isTauri } from "./env";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

export interface ImportConfig {
    sourcePaths: string[];
    targetPath: string;
    fileNaming: string;
    duplicateStrategy: "skip" | "rename" | "overwrite";
    copyMode: "copy" | "move";
}

export interface ImportProgress {
    processed: number;
    total: number;
    currentFile?: string;
    status: "scanning" | "processing" | "completed" | "cancelled" | "error";
}

export const importAdapter = {
    /**
     * 扫描目录
     */
    scanDirectories: async (paths: string[]): Promise<string[]> => {
        if (isTauri()) {
            const { invoke } = await import("@tauri-apps/api/tauri");
            return await invoke("scan_directories", { paths });
        } else {
            return await (window as any).electronAPI?.import?.scanDirectories(paths);
        }
    },

    /**
     * 执行导入
     */
    execute: async (config: ImportConfig): Promise<string> => {
        if (isTauri()) {
            const { invoke } = await import("@tauri-apps/api/tauri");
            return await invoke("execute_import", { config });
        } else {
            return await (window as any).electronAPI?.import?.execute(config);
        }
    },

    /**
     * 监听导入进度
     */
    onProgress: async (
        callback: (progress: ImportProgress) => void,
    ): Promise<UnlistenFn | (() => void)> => {
        if (isTauri()) {
            return await listen<ImportProgress>("import:progress", (event) => {
                callback(event.payload);
            });
        } else {
            const handler = (_event: any, progress: ImportProgress) => callback(progress);
            (window as any).electronAPI?.import?.onProgress(handler);
            return () => {
                (window as any).electronAPI?.import?.offProgress(handler);
            };
        }
    },

    /**
     * 取消导入
     */
    cancel: async (importId: string): Promise<void> => {
        if (isTauri()) {
            const { invoke } = await import("@tauri-apps/api/tauri");
            await invoke("cancel_import", { importId });
        } else {
            await (window as any).electronAPI?.import?.cancel(importId);
        }
    },
};
```

#### 1.9 配置适配器（Stub 实现）

```typescript
// src/api/config.adapter.ts

import { isTauri } from "./env";

export const configAdapter = {
    /**
     * 查询配置
     */
    query: async (paths: string[]): Promise<string[]> => {
        if (isTauri()) {
            const { invoke } = await import("@tauri-apps/api/tauri");
            return await invoke("query_config", { paths });
        } else {
            return await (window as any).electronAPI?.config?.query(paths);
        }
    },

    /**
     * 添加配置
     */
    add: async (paths: string[]): Promise<void> => {
        if (isTauri()) {
            const { invoke } = await import("@tauri-apps/api/tauri");
            await invoke("add_config", { paths });
        } else {
            await (window as any).electronAPI?.config?.add(paths);
        }
    },

    /**
     * 移除配置
     */
    remove: async (paths: string[]): Promise<void> => {
        if (isTauri()) {
            const { invoke } = await import("@tauri-apps/api/tauri");
            await invoke("remove_config", { paths });
        } else {
            await (window as any).electronAPI?.config?.remove(paths);
        }
    },
};
```

### 第二步：Rust Stub 后端

```rust
// src-tauri/src/commands/stubs.rs

use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use tauri::Window;
use log::warn;

// ============================================
// 天枢 Stub
// ============================================

#[derive(Debug, Deserialize)]
pub struct TianshuCommand {
    pub intent: Option<String>,
    pub inputs: Option<Value>,
}

#[derive(Debug, Serialize)]
pub struct TianshuResponse {
    pub success: bool,
    pub result: Option<Value>,
    pub error: Option<String>,
}

/// 天枢命令 - Stub 实现
#[tauri::command]
pub async fn tianshu_command(command: Value) -> Result<TianshuResponse, String> {
    warn!("🌌 [Stub] 天枢命令未实现: {:?}", command);
    Ok(TianshuResponse {
        success: true,
        result: Some(json!({
            "message": "Stub response - Tianshu not yet implemented",
            "command": command
        })),
        error: None,
    })
}

/// 天枢状态 - Stub 实现
#[tauri::command]
pub async fn tianshu_status() -> Result<Value, String> {
    warn!("🌌 [Stub] 天枢状态查询");
    Ok(json!({
        "workflows": 0,
        "status": "stub",
        "message": "Tianshu service not yet implemented"
    }))
}

// ============================================
// 扫描 Stub
// ============================================

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScanAction {
    pub path: String,
    pub operation_type: String,
    pub action: String,
    pub thumbnail_size: Option<u32>,
}

/// 扫描照片 - Stub 实现
#[tauri::command]
pub async fn scan_photos(
    window: Window,
    request_id: String,
    scan_action: ScanAction,
) -> Result<(), String> {
    warn!("🌌 [Stub] 扫描请求: {} - {:?}", request_id, scan_action.path);

    // 发送完成事件（空结果）
    window.emit("picasa:find-photo", json!({
        "type": "complete",
        "requestId": request_id,
        "action": scan_action,
        "paths": [],
        "message": "Stub response - Scan service not yet implemented"
    })).map_err(|e| e.to_string())?;

    Ok(())
}

// ============================================
// 缩略图 Stub
// ============================================

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ThumbnailRequest {
    pub path: String,
    pub thumbnail: String,
    pub width: Option<u32>,
    pub height: Option<u32>,
    pub without_enlargement: Option<bool>,
    pub preview: Option<String>,
    pub always: Option<bool>,
}

#[derive(Debug, Serialize)]
pub struct ThumbnailResponse {
    pub success: bool,
    pub file: Option<String>,
    pub error: Option<String>,
}

/// 创建缩略图 - Stub 实现
#[tauri::command]
pub async fn create_thumbnail(request: ThumbnailRequest) -> Result<ThumbnailResponse, String> {
    warn!("🌌 [Stub] 创建缩略图: {:?}", request.path);
    Ok(ThumbnailResponse {
        success: false,
        file: None,
        error: Some("Stub - Thumbnail service not yet implemented".to_string()),
    })
}

/// 删除缩略图 - Stub 实现
#[tauri::command]
pub async fn remove_thumbnail(request: ThumbnailRequest) -> Result<ThumbnailResponse, String> {
    warn!("🌌 [Stub] 删除缩略图: {:?}", request.path);
    Ok(ThumbnailResponse {
        success: true,
        file: Some(request.thumbnail),
        error: None,
    })
}

// ============================================
// 导入 Stub
// ============================================

/// 扫描目录 - Stub 实现
#[tauri::command]
pub async fn scan_directories(paths: Vec<String>) -> Result<Vec<String>, String> {
    warn!("🌌 [Stub] 扫描目录: {:?}", paths);
    Ok(vec![])
}

/// 执行导入 - Stub 实现
#[tauri::command]
pub async fn execute_import(
    window: Window,
    config: Value,
) -> Result<String, String> {
    warn!("🌌 [Stub] 执行导入: {:?}", config);

    let import_id = uuid::Uuid::new_v4().to_string();

    // 发送完成事件
    window.emit("import:progress", json!({
        "processed": 0,
        "total": 0,
        "status": "completed",
        "message": "Stub - Import service not yet implemented"
    })).map_err(|e| e.to_string())?;

    Ok(import_id)
}

/// 取消导入 - Stub 实现
#[tauri::command]
pub async fn cancel_import(import_id: String) -> Result<(), String> {
    warn!("🌌 [Stub] 取消导入: {}", import_id);
    Ok(())
}

// ============================================
// 配置 Stub
// ============================================

/// 查询配置 - Stub 实现
#[tauri::command]
pub async fn query_config(paths: Vec<String>) -> Result<Vec<String>, String> {
    warn!("🌌 [Stub] 查询配置: {:?}", paths);
    Ok(vec![])
}

/// 添加配置 - Stub 实现
#[tauri::command]
pub async fn add_config(paths: Vec<String>) -> Result<(), String> {
    warn!("🌌 [Stub] 添加配置: {:?}", paths);
    Ok(())
}

/// 移除配置 - Stub 实现
#[tauri::command]
pub async fn remove_config(paths: Vec<String>) -> Result<(), String> {
    warn!("🌌 [Stub] 移除配置: {:?}", paths);
    Ok(())
}
```

### 第三步：Shell 命令实现

```rust
// src-tauri/src/commands/shell.rs

use std::process::Command;

/// 在文件管理器中显示文件
#[tauri::command]
pub async fn show_in_folder(path: String) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        Command::new("open")
            .args(["-R", &path])
            .spawn()
            .map_err(|e| e.to_string())?;
    }

    #[cfg(target_os = "windows")]
    {
        Command::new("explorer")
            .args(["/select,", &path])
            .spawn()
            .map_err(|e| e.to_string())?;
    }

    #[cfg(target_os = "linux")]
    {
        // 尝试使用 xdg-open 打开父目录
        if let Some(parent) = std::path::Path::new(&path).parent() {
            Command::new("xdg-open")
                .arg(parent)
                .spawn()
                .map_err(|e| e.to_string())?;
        }
    }

    Ok(())
}
```

### 第四步：注册命令

```rust
// src-tauri/src/commands/mod.rs

pub mod shell;
pub mod stubs;
pub mod window;

pub use shell::*;
pub use stubs::*;
pub use window::*;
```

```rust
// src-tauri/src/main.rs (或 lib.rs)

mod commands;

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            // 窗口命令（Tauri 原生，已实现）
            commands::window::minimize,
            commands::window::maximize,
            commands::window::close,

            // Shell 命令（已实现）
            commands::shell::show_in_folder,

            // Stub 命令（待逐步替换）
            commands::stubs::tianshu_command,
            commands::stubs::tianshu_status,
            commands::stubs::scan_photos,
            commands::stubs::create_thumbnail,
            commands::stubs::remove_thumbnail,
            commands::stubs::scan_directories,
            commands::stubs::execute_import,
            commands::stubs::cancel_import,
            commands::stubs::query_config,
            commands::stubs::add_config,
            commands::stubs::remove_config,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

### 第五步：UI 代码迁移脚本

```bash
#!/bin/bash
# scripts/migrate-ui.sh

set -e

SOURCE_DIR="apps/desktop/src/renderer"
TARGET_DIR="apps/photasa/src"

echo "🚀 开始 UI 迁移..."

# 1. 创建目标目录
mkdir -p "$TARGET_DIR"

# 2. 复制核心文件
echo "📁 复制组件..."
cp -r "$SOURCE_DIR/src/components" "$TARGET_DIR/" 2>/dev/null || true
cp -r "$SOURCE_DIR/src/composables" "$TARGET_DIR/" 2>/dev/null || true
cp -r "$SOURCE_DIR/src/stores" "$TARGET_DIR/" 2>/dev/null || true
cp -r "$SOURCE_DIR/src/services" "$TARGET_DIR/" 2>/dev/null || true
cp -r "$SOURCE_DIR/src/views" "$TARGET_DIR/" 2>/dev/null || true
cp -r "$SOURCE_DIR/src/interfaces" "$TARGET_DIR/" 2>/dev/null || true
cp -r "$SOURCE_DIR/src/utils" "$TARGET_DIR/" 2>/dev/null || true
cp -r "$SOURCE_DIR/src/assets" "$TARGET_DIR/" 2>/dev/null || true
cp -r "$SOURCE_DIR/src/styles" "$TARGET_DIR/" 2>/dev/null || true

# 3. 复制入口文件
echo "📄 复制入口文件..."
cp "$SOURCE_DIR/src/App.vue" "$TARGET_DIR/" 2>/dev/null || true
cp "$SOURCE_DIR/src/main.ts" "$TARGET_DIR/" 2>/dev/null || true

# 4. 创建适配层目录
echo "🔧 创建适配层..."
mkdir -p "$TARGET_DIR/api"

echo "✅ UI 迁移完成！"
echo ""
echo "下一步："
echo "1. 创建适配层文件（src/api/*.ts）"
echo "2. 更新 import 路径"
echo "3. 运行 npm run tauri dev 验证"
```

## 迁移步骤清单

### 阶段 1：基础设施（1-2 天）

- [x] 创建适配层目录结构
- [x] 实现环境检测 (`env.ts`)
- [x] 实现窗口适配器 (`window.adapter.ts`)
- [x] 实现 Shell 适配器 (`shell.adapter.ts`)
- [x] 实现 Rust Shell 命令

### 阶段 2：UI 复制和适配（2-3 天）

- [x] 运行 UI 迁移脚本
- [x] 更新 `main.ts` 使用适配器
- [x] 更新服务层使用适配器
- [x] 修复 import 路径问题
- [x] 验证 Vite 构建通过

### 阶段 3：Stub 后端（1-2 天）

- [x] 实现天枢 Stub（后由 0072 + 0139 系列替换/退场）
- [x] 实现扫描 Stub（0068 / 0136）
- [x] 实现缩略图 Stub（0069 / 0134）
- [x] 实现导入 Stub（0070 / 0131）
- [x] 实现配置 Stub（0071 / 0138）
- [x] 注册所有命令

### 阶段 4：验证和调试（1-2 天）

- [x] 运行 `npm run tauri dev`
- [x] 验证窗口控制（最小化、最大化、关闭）
- [x] 验证 Shell 操作（打开链接、显示文件）
- [x] 验证 UI 渲染正常
- [x] 记录需要实现的功能列表（见 0097、0149）
- [x] 修复发现的问题（持续在子 RFC 中）

## 渐进式替换计划

完成 UI 迁移后，按以下顺序替换 Stub：

```
优先级 1（立即）：
├── 窗口命令 ✅ Tauri 原生
└── Shell 命令 ✅ 已实现

优先级 2（1-2 周）：
└── 配置服务 → RFC 0071

优先级 3（2-3 周）：
└── 扫描服务 → RFC 0068

优先级 4（2-3 周）：
└── 缩略图服务 → RFC 0069

优先级 5（2-3 周）：
└── 导入服务 → RFC 0070

优先级 6（3-4 周）：
└── 天枢服务 → RFC 0072（最复杂）
```

## 预计时间

**总计：5-9 天**

- 基础设施：1-2 天
- UI 复制适配：2-3 天
- Stub 后端：1-2 天
- 验证调试：1-2 天

## 成功标准

1. **UI 可运行**：Tauri 应用可以启动并显示完整 UI
2. **窗口控制正常**：最小化、最大化、关闭按钮工作
3. **Shell 操作正常**：可以打开外部链接、在文件管理器中显示文件
4. **无崩溃**：Stub 返回时 UI 不崩溃，优雅降级
5. **开发体验**：`npm run tauri dev` 热重载正常工作

## 风险和缓解

### 风险 1：API 不兼容

**问题**：Electron API 和 Tauri API 签名不同

**缓解**：适配器层统一接口，内部处理差异

### 风险 2：类型不匹配

**问题**：TypeScript 类型与 Rust 类型不一致

**缓解**：使用 `serde` 的 `rename_all = "camelCase"` 保持命名一致

### 风险 3：事件系统差异

**问题**：Electron IPC 和 Tauri 事件系统不同

**缓解**：适配器封装事件监听，统一回调接口

## 与其他 RFC 的关系

```
RFC 0073 (本文档) ─────┬──→ RFC 0067 (总体架构)
  UI 迁移 + 适配层      │
                       ├──→ RFC 0068 (扫描服务) - 替换 scan stub
                       ├──→ RFC 0069 (缩略图服务) - 替换 thumbnail stub
                       ├──→ RFC 0070 (导入服务) - 替换 import stub
                       ├──→ RFC 0071 (配置服务) - 替换 config stub
                       └──→ RFC 0072 (天枢服务) - 替换 tianshu stub
```

## 参考资源

- [Tauri API 文档](https://tauri.app/api/)
- [Tauri 事件系统](https://tauri.app/v1/guides/features/events/)
- [Tauri 命令系统](https://tauri.app/v1/guides/features/command/)

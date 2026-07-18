# RFC 0071: 配置服务迁移到 Tauri

- **作者**: AI Assistant
- **状态**: ✅ 已完成（本文档 2026-07-18 重写，对齐实际实现 — 见下方「Rewrite note」）
- **创建日期**: 2025-01-02
- **关联 RFC**: [RFC 0067: 创建 Tauri 应用 Photasa](./0067-tauri-app-photasa.md)
- **被引用（scan crate 拆分）**: [0132](./0132-tauri-photasa-scan-crate.md)（P1；`PhotasaConfigView` 桥接本 RFC 的 `read_config_sync`）

## Implementation principle (Photasa / Tauri)

> **Rust rewrite, not TypeScript copy.** Policy: [./TAURI_RUST_REWRITE_POLICY.md](./TAURI_RUST_REWRITE_POLICY.md).

- Electron/Node code is a **behavioral specification** only—not a library for Photasa.
- Implement in `apps/photasa/src-tauri` and `crates/`; **do not** import `@photasa/scan`, `@photasa/import`, or other Node packages from Tauri.
- **1:1 parity** = same IPC/events/on-disk formats; **not** porting TypeScript source.

## Rewrite note（2026-07-18）

本文档原版（2025-01-02）设想了 `services/config/{config_service,storage,cache}.rs` 架构 + `glob`/`tokio full` 依赖。**这套 service 分层从未被构建**——实际是两个扁平文件：`commands/config.rs`（Tauri command 壳）+ `commands/photasa_config.rs`（纯函数逻辑）。

## 实际架构（Actual, 2026-07-18）

```
apps/photasa/src-tauri/src/commands/
├── config.rs           (~201 LOC) — 8 个 #[tauri::command]：
│                          query_config / add_config / remove_config（文件级，legacy 三件套）
│                          get_photasa_config / add_to_photo_list / remove_from_photo_list /
│                          reset_photasa_config / fix_photasa_config（内容级，见下）
└── photasa_config.rs   (~402 LOC) — 纯函数：read_config_sync / write_config_sync /
                           parse_photo_list / to_relative_thumbnail_path /
                           absolute_thumbnail_path_for_source / add_photo_to_folder_list /
                           remove_photo_from_folder_list / fix_config_sync
```

**⚠️ 两条读路径并存，未合并**：`config.rs::get_photasa_config`（`#[tauri::command] async fn`，用 `tokio::fs::read_to_string(...).await` 真异步 IO）与 `photasa_config.rs::read_config_sync`（`pub fn`，`std::fs::read_to_string` 同步阻塞）各自独立解析同一份 `.photasa.json`。`scan_strategy.rs`（见 0117）只依赖后者（`read_config_sync`）。这两条路径目前未被要求合并——本 RFC 不改行为，只记录现状；若要去重需另开 RFC。

异步模式：Tauri command 边界（`config.rs`）用 `tokio::fs` 做真异步文件 IO（配置文件小，无需 `spawn_blocking`）；`photasa_config.rs` 的纯函数层用 `std::fs` 同步阻塞，专供 `scan_strategy.rs`/`scan_media.rs` 等非 async 上下文直接调用。两种模式**都正确**，服务不同调用场景，无需统一成一种。

**Scan crate 拆分范围**：[0132](./0132-tauri-photasa-scan-crate.md) 的 `PhotasaConfigView` trait 应只桥接 `read_config_sync`（同步、只读、已是 scan 层唯一依赖的路径）——按 0132 设计准则 #4，暴露 `photo_list`/`has_config` 等价的只读视图，**不要**把整个 `PhotasaConfigData`/`PhotoEntry` struct 或 `config.rs` 的 8 个 Tauri command 搬进 crate。

---

## 摘要（原版，2025-01-02，已过时，仅存档）

本文档详细说明如何将 Electron 的配置服务迁移到 Tauri Rust 实现。配置服务负责管理应用程序配置和照片元数据（.photasa.json 文件）。

## 当前架构分析

### Electron 实现结构

```
apps/desktop/src/main/config/
├── config-service.ts        # 主服务（IPC 处理、Worker 管理）
├── config-worker.ts         # Worker 线程实现
├── config-handler.ts        # 配置处理逻辑
├── config-storage.ts        # 配置存储
└── config-cache.ts          # 配置缓存
```

### 核心功能

1. **IPC 通信（主进程 config-service）**
    - `picasa:query-config`：`ipcMain.on`（fire-and-forget），参数 `{ paths: string[] }`；结果由 Worker 处理后由 main 发送 `picasa:photasa-config` 到 renderer。
    - `picasa:add-config`：`ipcMain.handle`，参数 `{ paths: string[] }`，返回 `Promise<void>`。
    - `picasa:remove-config`：非 invoke；主进程在 Worker 完成移除后向 renderer 发送 `picasa:remove-config`（事件）。

2. **Preload 中的配置相关 API（legacy.ts）**
    - `getPhotasaConfig`, `addToPhotoList`, `removeFromPhotoList`, `resetPhotasaConfig`, `fixPhotasaConfig` 来自 `preload/file-config.ts`；其中 `addToPhotoList` 实际调用 main `picasa:add-config`，其余在 preload 中用 Node `fs` 读写 `.photasa.json` 内容（photoList 等）。
    - Tauri 无 preload Node 环境，必须在 Rust 中实现**内容级**配置能力，并通过命令暴露，供扁平 legacy-api 调用。

3. **必须实现的 Rust 命令（内容级）**
    - `get_photasa_config(folder: String) -> Result<PhotasaConfig>`：读取目录下 `.photasa.json`，解析并返回完整配置（含 photoList）。
    - `add_to_photo_list(photoPath: String)`：确保对应目录存在 .photasa.json，并将该照片加入 photoList（与现有 add_config 语义对齐或扩展）。
    - `remove_from_photo_list(photoPath: String) -> Result<{ path, config }>`：从对应目录的 .photasa.json 的 photoList 中移除该照片，写回并返回路径与更新后 config。
    - `reset_photasa_config(folder: String)`：将 photoList 置空并写回。
    - `fix_photasa_config(folder: String)`：规范化 photoList 中每项的 path/thumbnail/isVideo 等并写回。
    - 文件级命令 `query_config` / `add_config` / `remove_config` 已存在；内容级以上 5 个为迁移 preload file-config 所必需，需在本 RFC 范围内实现。

4. **配置管理**
    - 读取/写入 `.photasa.json` 文件
    - 批量操作
    - Worker 线程处理，避免阻塞主进程

## Tauri Rust 迁移计划

### 阶段 1: 基础架构

#### 1.1 创建 Rust 模块结构

```
apps/photasa/src-tauri/src/
├── services/
│   └── config/
│       ├── mod.rs                    # 模块导出
│       ├── config_service.rs        # 主服务
│       ├── storage.rs                # 配置存储
│       ├── cache.rs                  # 配置缓存
│       └── types.rs                  # 类型定义
```

#### 1.2 依赖添加

```toml
[dependencies]
# 文件操作
tokio = { version = "1.0", features = ["full"] }
glob = "0.3"                # 文件匹配

# JSON 处理
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"

# 异步文件操作
tokio::fs = "1.0"
```

### 阶段 2: 类型定义

```rust
// src-tauri/src/services/config/types.rs

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConfigRequest {
    pub action: ConfigAction,
    pub paths: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ConfigAction {
    Query,
    Add,
    Remove,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConfigResponse {
    pub action: ConfigAction,
    pub paths: Vec<String>,
    pub error: Option<String>,
}
```

### 阶段 3: 核心功能实现

#### 3.1 配置存储

```rust
// src-tauri/src/services/config/storage.rs

use std::path::{Path, PathBuf};
use tokio::fs;
use anyhow::Result;
use serde_json::Value;

pub struct ConfigStorage;

impl ConfigStorage {
    /// 读取配置文件
    pub async fn read_config(&self, path: &str) -> Result<Value> {
        let config_path = self.get_config_path(path)?;
        let content = fs::read_to_string(&config_path).await?;
        let config: Value = serde_json::from_str(&content)?;
        Ok(config)
    }

    /// 写入配置文件
    pub async fn write_config(&self, path: &str, config: &Value) -> Result<()> {
        let config_path = self.get_config_path(path)?;
        let content = serde_json::to_string_pretty(config)?;
        fs::write(&config_path, content).await?;
        Ok(())
    }

    /// 获取配置文件路径
    fn get_config_path(&self, folder_path: &str) -> Result<PathBuf> {
        Ok(Path::new(folder_path).join(".photasa.json"))
    }

    /// 查询多个路径的配置
    pub async fn query_configs(&self, paths: Vec<String>) -> Result<Vec<String>> {
        let mut config_paths = Vec::new();

        for path in paths {
            let config_path = self.get_config_path(&path)?;
            if config_path.exists() {
                config_paths.push(config_path.to_string_lossy().to_string());
            }
        }

        Ok(config_paths)
    }
}
```

#### 3.2 主服务实现

```rust
// src-tauri/src/services/config/config_service.rs

use crate::services::config::storage::ConfigStorage;
use crate::services::config::types::*;
use anyhow::Result;

pub struct ConfigService {
    storage: ConfigStorage,
}

impl ConfigService {
    pub fn new() -> Self {
        Self {
            storage: ConfigStorage,
        }
    }

    /// 查询配置
    pub async fn query_configs(&self, paths: Vec<String>) -> Result<Vec<String>> {
        self.storage.query_configs(paths).await
    }

    /// 添加配置
    pub async fn add_config(&self, paths: Vec<String>) -> Result<()> {
        for path in paths {
            let config_path = self.storage.get_config_path(&path)?;

            // 如果配置文件不存在，创建默认配置
            if !config_path.exists() {
                let default_config = serde_json::json!({
                    "photos": [],
                    "version": "1.0"
                });
                self.storage.write_config(&path, &default_config).await?;
            }
        }

        Ok(())
    }

    /// 移除配置
    pub async fn remove_config(&self, paths: Vec<String>) -> Result<()> {
        for path in paths {
            let config_path = self.storage.get_config_path(&path)?;
            if config_path.exists() {
                fs::remove_file(&config_path).await?;
            }
        }

        Ok(())
    }
}
```

### 阶段 4: Tauri 命令

```rust
// src-tauri/src/commands/config.rs

use crate::services::config::config_service::ConfigService;
use crate::services::config::types::*;
use tauri::State;
use std::sync::Arc;
use tokio::sync::Mutex;

type ConfigServiceState = State<'_, Arc<Mutex<ConfigService>>>;

#[tauri::command]
pub async fn query_config(
    service: ConfigServiceState,
    paths: Vec<String>,
) -> Result<Vec<String>, String> {
    let service = service.lock().await;
    service
        .query_configs(paths)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn add_config(
    service: ConfigServiceState,
    paths: Vec<String>,
) -> Result<(), String> {
    let service = service.lock().await;
    service
        .add_config(paths)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn remove_config(
    service: ConfigServiceState,
    paths: Vec<String>,
) -> Result<(), String> {
    let service = service.lock().await;
    service
        .remove_config(paths)
        .await
        .map_err(|e| e.to_string())
}
```

## 迁移步骤

### 步骤 1: 基础实现（3-5 天）

- [ ] 创建模块结构
- [ ] 实现配置读写
- [ ] 实现 Tauri 命令

### 步骤 2: 批量操作（2-3 天）

- [ ] 实现批量查询
- [ ] 实现批量添加/删除
- [ ] 性能优化

### 步骤 3: 缓存和优化（2-3 天）

- [ ] 实现配置缓存
- [ ] 错误处理完善
- [ ] 测试验证

## 预计时间

**总计：1-2 周**

## 注意事项

1. **文件锁定**：处理并发写入时的文件锁定
2. **性能优化**：批量操作时的性能考虑
3. **错误恢复**：配置文件损坏时的恢复机制
4. **兼容性**：确保与现有配置文件格式兼容

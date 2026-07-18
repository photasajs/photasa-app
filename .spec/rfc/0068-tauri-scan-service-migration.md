# RFC 0068: 扫描服务迁移到 Tauri

- **作者**: AI Assistant
- **状态**: ✅ 已完成（本文档 2026-07-18 重写，对齐实际实现 — 见下方「Rewrite note」）
- **创建日期**: 2025-01-02
- **关联 RFC**: [RFC 0067: 创建 Tauri 应用 Photasa](./0067-tauri-app-photasa.md)
- **后续（crate 拆分）**: [0132](./completed/0132-tauri-photasa-scan-crate.md)（scan → `photasa-types` + `photasa-scan` crate，✅ Implemented）

## Implementation principle (Photasa / Tauri)

> **Rust rewrite, not TypeScript copy.** Policy: [./TAURI_RUST_REWRITE_POLICY.md](./TAURI_RUST_REWRITE_POLICY.md).

- Electron/Node code is a **behavioral specification** only—not a library for Photasa.
- Implement in `apps/photasa/src-tauri` and `crates/`; **do not** import `@photasa/scan`, `@photasa/import`, or other Node packages from Tauri.
- **1:1 parity** = same IPC/events/on-disk formats; **not** porting TypeScript source.

## Rewrite note（2026-07-18）

本文档原版（2025-01-02）设想了一套 `services/scan/{scan_service,scanner,worker,helpers,cleanup}.rs` 架构、`ScanService` struct + `tokio::spawn` + `mpsc` 通道、`infer` crate 做 MIME 检测、三态 `ScanStrategy::{Skip,Incremental,Full}`。**这套设计从未被构建。**

实际实现已拆入 `crates/photasa-scan`（见 [0132](./completed/0132-tauri-photasa-scan-crate.md)），`walkdir` 遍历 + 扩展名分类统一使用 `photasa-import::path_filter::classify_media`（见 [0131](./completed/0131-tauri-photasa-import-crate.md)）。策略只有 **SKIP/FULL 两态**——`Incremental` 在 Electron 源码里本身就是死代码，从未被 `decideScanStrategy` 返回过（见 [0117](./0117-tauri-scan-pipeline-parity.md) 的详细表格）。

真正的行为规格、文件清单、测试策略以 [0105](./0105-tauri-scan-incremental-cache.md)（增量缓存）/ [0111](./0111-tauri-scan-notify-status-bridge.md)（notify:status）/ [0116](./0116-tauri-photasa-config-thumbnail-parity.md)（config/thumbnail 路径）/ [0117](./0117-tauri-scan-pipeline-parity.md)（完整流水线 parity，含逐函数对照表）为准——本文档下方「摘要」及「Tauri Rust 迁移计划」章节的具体代码示例已过时，仅保留作历史记录，**不要**按其内容实施。

## 实际架构（Actual, 2026-07-18）

```
apps/photasa/src-tauri/src/commands/
├── scan_runner.rs     (~713 LOC) — orchestration + emit + thumbnail dispatch（Tauri-coupled）
├── scan_cache.rs      (~384 LOC) — .photasa-folder.json + IncrementalCacheManager 等价物（零 Tauri）
├── scan_media.rs      (~348 LOC) — walkdir 遍历；耦合 photasa_config（零 Tauri）
├── scan_notify.rs     (~348 LOC) — notify:status payload builder（零 Tauri，见 0111）
├── scan_strategy.rs   (~288 LOC) — SKIP/FULL 决策 + should_process_file（零 Tauri，见 0117）
└── scan_cleanup.rs    (~160 LOC) — orphan 缓存清理（零 Tauri；无 live caller，见 0117）
```

真实依赖：`walkdir`、`sha2`（`compute_folder_hash`）、无 `infer`。异步模式：**Tauri command 边界为 `async fn`**（`stubs.rs::scan_photos`），内部 `spawn_scan_job`（`pub fn`，非 async）调用 `tokio::spawn(async move { spawn_blocking(sync_fn).await })` 把实际遍历/IO 丢进阻塞线程池；`scan_strategy.rs`/`scan_cache.rs`/`scan_media.rs`/`scan_notify.rs`/`scan_cleanup.rs` 全部是**纯同步函数**，零 `async fn`，这正是 0132 想抽进 crate 的部分——同步纯函数无需 Tauri runtime 即可单测。已核实（2026-07-18）：此模式正确，无需重新设计。

**状态**：纯算法文件已拆入零-Tauri workspace crate `crates/photasa-scan`（见 [0132](./completed/0132-tauri-photasa-scan-crate.md)），共享 DTO 在 `crates/photasa-types`；`scan_runner.rs`（含 `tokio::spawn`/`AppHandle` 编排层）在 v1 拆分中保留在 `src-tauri`。

---

## 摘要（原版，2025-01-02，已过时，仅存档）

本文档详细说明如何将 Electron 的扫描服务迁移到 Tauri Rust 实现。扫描服务是 Photasa 的核心功能，负责发现、索引和管理照片/视频文件。

## 概述

本文档详细说明如何将 Electron 的扫描服务迁移到 Tauri Rust 实现。扫描服务是 Photasa 的核心功能，负责发现、索引和管理照片/视频文件。

## 当前架构分析

### Electron 实现结构

```
apps/desktop/src/main/scan/
├── scan-service.ts        # 主服务（IPC 处理、Worker 管理）
├── scan-photos.ts         # 核心扫描逻辑（Observable 模式）
├── scan-worker.ts         # Worker 线程实现
├── scan-helpers.ts        # 辅助函数
├── scan-cleanup.ts        # 清理功能
├── cache/
│   └── incremental-cache-manager.ts  # 增量缓存管理
├── strategy/
│   └── scan-strategy.ts   # 扫描策略决策（SKIP/INCREMENTAL/FULL）
└── worker/
    └── pool-manager.ts    # Worker 池管理
```

### 核心功能

1. **IPC 通信**
    - `picasa:scan-photos`：renderer 使用 `ipcRenderer.send` 发送，参数 `{ requestId: string, scanAction: ScanAction }`；主进程 `ipcMain.on` 接收，无返回值。
    - `picasa:find-photo`：主进程向 renderer `webContents.send` 发送扫描进度/结果/错误。

2. **Worker 线程**
    - 使用 Node.js Worker Threads
    - 处理扫描任务，避免阻塞主进程

3. **扫描策略**
    - SKIP: 目录无变化，从缓存恢复
    - INCREMENTAL: 部分变化，只处理新文件
    - FULL: 完整重新扫描

4. **增量缓存**
    - `.photasa-folder.json` - 目录缓存
    - 支持断点续扫

5. **文件遍历**
    - 使用 `klaw` 库递归遍历
    - 过滤隐藏文件和系统文件

6. **缩略图生成**
    - Worker 池并行处理
    - 集成缩略图服务

## Tauri Rust 迁移计划

### 阶段 1: 基础架构搭建

#### 1.1 创建 Rust 模块结构

```
apps/photasa/src-tauri/src/
├── services/
│   └── scan/
│       ├── mod.rs                    # 模块导出
│       ├── scan_service.rs          # 主服务（行为规格参考：scan-service.ts，Rust 独立实现）
│       ├── scanner.rs                # 核心扫描逻辑（行为规格参考：scan-photos.ts，Rust 独立实现）
│       ├── worker.rs                 # 异步任务处理（行为规格参考：scan-worker.ts，Rust 独立实现）
│       ├── helpers.rs                # 辅助函数（行为规格参考：scan-helpers.ts，Rust 独立实现）
│       ├── cleanup.rs                # 清理功能（行为规格参考：scan-cleanup.ts，Rust 独立实现）
│       ├── cache/
│       │   └── incremental_cache.rs  # 增量缓存管理
│       ├── strategy/
│       │   └── scan_strategy.rs      # 扫描策略决策
│       └── types.rs                  # 类型定义
```

#### 1.2 依赖添加

在 `Cargo.toml` 中添加：

```toml
[dependencies]
# 异步运行时
tokio = { version = "1.0", features = ["full"] }

# 文件系统操作
walkdir = "2.0"           # 目录遍历（替代 klaw）
notify = "6.0"            # 文件系统监听

# 序列化
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"

# 路径处理
pathdiff = "0.2"          # 路径差异计算

# 文件类型检测
infer = "0.13"            # MIME 类型检测（替代 is-image/is-video）

# 错误处理
anyhow = "1.0"
thiserror = "1.0"

# 日志
log = "0.4"
env_logger = "0.11"       # 可选，用于调试
```

### 阶段 2: 类型定义迁移

#### 2.1 创建 Rust 类型

```rust
// src-tauri/src/services/scan/types.rs

use serde::{Deserialize, Serialize};

/// 扫描动作类型
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ScanActionType {
    #[serde(rename = "scan")]
    Scan,
    #[serde(rename = "rescan")]
    Rescan,
    #[serde(rename = "current")]
    Current,
}

/// 操作类型
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum OperationType {
    #[serde(rename = "file")]
    File,
    #[serde(rename = "directory")]
    Directory,
}

/// 扫描动作配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScanAction {
    pub path: String,
    pub operation_type: OperationType,
    pub action: ScanActionType,
    pub thumbnail_size: Option<u32>,
}

/// 扫描策略
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ScanStrategy {
    #[serde(rename = "skip")]
    Skip,
    #[serde(rename = "incremental")]
    Incremental,
    #[serde(rename = "full")]
    Full,
}

/// 扫描决策
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScanDecision {
    pub strategy: ScanStrategy,
    pub reason: String,
}

/// 照片文件请求
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PhotoFileRequest {
    pub path: String,
    pub thumbnail: String,
    pub is_image: bool,
    pub is_video: bool,
    pub is_directory: bool,
}

/// 扫描进度
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScanProgress {
    pub processed: usize,
    pub total: usize,
    pub current_file: Option<String>,
}

/// 扫描结果
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScanResult {
    pub request_id: String,
    pub action: ScanAction,
    pub files: Vec<PhotoFileRequest>,
    pub progress: ScanProgress,
}
```

### 阶段 3: 核心功能实现

#### 3.1 文件遍历（替代 klaw）

```rust
// src-tauri/src/services/scan/scanner.rs

use walkdir::WalkDir;
use std::path::{Path, PathBuf};
use crate::services::scan::types::*;

/// 遍历文件夹中的媒体文件
/// 行为规格参考 scan-photos.ts — Rust 独立实现， walkthroughPhotosInFolder
pub fn walkthrough_photos_in_folder(
    source: &ScanAction,
    depth_limit: Option<usize>,
) -> Result<Vec<PhotoFileRequest>, anyhow::Error> {
    let path = Path::new(&source.path);

    // 检查路径是否存在
    if !path.exists() {
        return Err(anyhow::anyhow!("Path does not exist: {}", source.path));
    }

    let mut files = Vec::new();

    // 单文件扫描
    if matches!(source.operation_type, OperationType::File) || path.is_file() {
        if is_media_file(path)? {
            files.push(PhotoFileRequest {
                path: source.path.clone(),
                thumbnail: build_thumbnail_path(&source.path),
                is_image: is_image_file(path)?,
                is_video: is_video_file(path)?,
                is_directory: false,
            });
        }
        return Ok(files);
    }

    // 目录扫描
    if !path.is_dir() {
        return Err(anyhow::anyhow!("Expected directory but got file: {}", source.path));
    }

    // 使用 walkdir 遍历目录
    let walker = WalkDir::new(path)
        .max_depth(depth_limit.unwrap_or(usize::MAX))
        .into_iter()
        .filter_entry(|e| {
            // 过滤隐藏文件和系统文件
            !is_hidden_file(e.path()) && !should_ignore_photasa_path(e.path())
        });

    for entry in walker {
        let entry = entry?;
        let entry_path = entry.path();

        if entry_path.is_file() && is_media_file(entry_path)? {
            files.push(PhotoFileRequest {
                path: entry_path.to_string_lossy().to_string(),
                thumbnail: build_thumbnail_path(&entry_path.to_string_lossy()),
                is_image: is_image_file(entry_path)?,
                is_video: is_video_file(entry_path)?,
                is_directory: false,
            });
        }
    }

    Ok(files)
}

/// 检查是否为媒体文件
fn is_media_file(path: &Path) -> Result<bool, anyhow::Error> {
    Ok(is_image_file(path)? || is_video_file(path)?)
}

/// 检查是否为图片文件
fn is_image_file(path: &Path) -> Result<bool, anyhow::Error> {
    // 使用 infer 库检测 MIME 类型
    if let Some(kind) = infer::get_from_path(path)? {
        Ok(kind.mime_type().starts_with("image/"))
    } else {
        // 回退到扩展名检查
        Ok(path.extension()
            .and_then(|ext| ext.to_str())
            .map(|ext| matches!(ext.to_lowercase().as_str(),
                "jpg" | "jpeg" | "png" | "gif" | "bmp" | "webp" | "heic" | "heif"))
            .unwrap_or(false))
    }
}

/// 检查是否为视频文件
fn is_video_file(path: &Path) -> Result<bool, anyhow::Error> {
    if let Some(kind) = infer::get_from_path(path)? {
        Ok(kind.mime_type().starts_with("video/"))
    } else {
        Ok(path.extension()
            .and_then(|ext| ext.to_str())
            .map(|ext| matches!(ext.to_lowercase().as_str(),
                "mp4" | "mov" | "avi" | "mkv" | "webm" | "m4v"))
            .unwrap_or(false))
    }
}

/// 检查是否为隐藏文件
fn is_hidden_file(path: &Path) -> bool {
    path.file_name()
        .and_then(|name| name.to_str())
        .map(|name| name.starts_with('.'))
        .unwrap_or(false)
}

/// 检查是否应该忽略 Photasa 路径
fn should_ignore_photasa_path(path: &Path) -> bool {
    path.file_name()
        .and_then(|name| name.to_str())
        .map(|name| name == ".photasa" || name.starts_with(".photasa"))
        .unwrap_or(false)
}

/// 构建缩略图路径
fn build_thumbnail_path(file_path: &str) -> String {
    // 实现路径转换逻辑
    // 对应 @shared/path-util 中的 buildThumbnailPath
    format!("{}.thumb", file_path) // 简化示例
}
```

#### 3.2 扫描策略决策

```rust
// src-tauri/src/services/scan/strategy/scan_strategy.rs

use crate::services::scan::types::*;
use std::path::Path;
use std::fs;
use anyhow::Result;

/// 决定扫描策略
/// 行为规格参考 scan-strategy.ts — Rust 独立实现， decideScanStrategy
pub async fn decide_scan_strategy(
    path: &str,
    action: &ScanActionType,
) -> Result<ScanDecision> {
    let cache_path = Path::new(path).join(".photasa-folder.json");

    // 检查缓存文件是否存在
    if !cache_path.exists() {
        return Ok(ScanDecision {
            strategy: ScanStrategy::Full,
            reason: "No cache file found".to_string(),
        });
    }

    // 读取缓存文件
    let cache_content = fs::read_to_string(&cache_path)?;
    let cache: serde_json::Value = serde_json::from_str(&cache_content)?;

    // 检查目录修改时间
    let dir_metadata = fs::metadata(path)?;
    let dir_mtime = dir_metadata.modified()?;

    // 检查缓存时间戳
    if let Some(cache_timestamp) = cache.get("lastScanTime").and_then(|v| v.as_u64()) {
        let cache_time = std::time::UNIX_EPOCH
            + std::time::Duration::from_secs(cache_timestamp);

        // 如果目录未修改，使用 SKIP 策略
        if dir_mtime <= cache_time {
            return Ok(ScanDecision {
                strategy: ScanStrategy::Skip,
                reason: "Directory unchanged since last scan".to_string(),
            });
        }
    }

    // 检查是否有新文件（简化版，实际需要更复杂的比较）
    if cache.get("processedFiles").is_some() {
        return Ok(ScanDecision {
            strategy: ScanStrategy::Incremental,
            reason: "Partial changes detected".to_string(),
        });
    }

    Ok(ScanDecision {
        strategy: ScanStrategy::Full,
        reason: "Full scan required".to_string(),
    })
}
```

#### 3.3 增量缓存管理

```rust
// src-tauri/src/services/scan/cache/incremental_cache.rs

use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use std::fs;
use anyhow::Result;

#[derive(Debug, Serialize, Deserialize)]
pub struct IncrementalCache {
    pub processed_files: Vec<String>,
    pub pending_files: Vec<String>,
    pub last_scan_time: u64,
    pub in_progress: bool,
}

pub struct IncrementalCacheManager {
    cache_path: PathBuf,
    cache: IncrementalCache,
}

impl IncrementalCacheManager {
    pub fn new(folder_path: &str) -> Self {
        let cache_path = Path::new(folder_path).join(".photasa-folder.json");
        Self {
            cache_path,
            cache: IncrementalCache {
                processed_files: Vec::new(),
                pending_files: Vec::new(),
                last_scan_time: 0,
                in_progress: false,
            },
        }
    }

    /// 初始化缓存
    pub async fn initialize(&mut self) -> Result<&IncrementalCache> {
        if self.cache_path.exists() {
            let content = fs::read_to_string(&self.cache_path)?;
            self.cache = serde_json::from_str(&content)?;
        }
        Ok(&self.cache)
    }

    /// 记录文件已处理
    pub async fn record_file_processed(&mut self, file_path: &str) -> Result<()> {
        if !self.cache.processed_files.contains(&file_path.to_string()) {
            self.cache.processed_files.push(file_path.to_string());
        }
        Ok(())
    }

    /// 标记扫描完成
    pub async fn mark_scan_complete(&mut self) -> Result<()> {
        self.cache.in_progress = false;
        self.cache.last_scan_time = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)?
            .as_secs();
        self.save().await
    }

    /// 保存缓存
    async fn save(&self) -> Result<()> {
        let content = serde_json::to_string_pretty(&self.cache)?;
        fs::write(&self.cache_path, content)?;
        Ok(())
    }

    /// 检查文件是否已处理
    pub fn is_file_processed(&self, file_path: &str) -> bool {
        self.cache.processed_files.contains(&file_path.to_string())
    }
}
```

#### 3.4 主扫描服务

```rust
// src-tauri/src/services/scan/scan_service.rs

use crate::services::scan::types::*;
use crate::services::scan::scanner::*;
use crate::services::scan::strategy::scan_strategy::*;
use crate::services::scan::cache::incremental_cache::*;
use tauri::Window;
use tokio::sync::mpsc;

/// 扫描服务
pub struct ScanService {
    // 可以添加服务状态
}

impl ScanService {
    pub fn new() -> Self {
        Self {}
    }

    /// 执行扫描
    pub async fn scan_photos(
        &self,
        request_id: String,
        scan_action: ScanAction,
        window: Window,
    ) -> Result<(), anyhow::Error> {
        // 创建进度通道
        let (tx, mut rx) = mpsc::unbounded_channel::<ScanProgress>();

        // 在后台任务中执行扫描
        let scan_action_clone = scan_action.clone();
        let request_id_clone = request_id.clone();
        let window_clone = window.clone();

        tokio::spawn(async move {
            // 决定扫描策略
            let decision = decide_scan_strategy(&scan_action_clone.path, &scan_action_clone.action)
                .await
                .unwrap_or_else(|_| ScanDecision {
                    strategy: ScanStrategy::Full,
                    reason: "Strategy decision failed".to_string(),
                });

            match decision.strategy {
                ScanStrategy::Skip => {
                    // 从缓存恢复
                    // TODO: 实现缓存恢复逻辑
                }
                ScanStrategy::Incremental | ScanStrategy::Full => {
                    // 执行扫描
                    let files = walkthrough_photos_in_folder(&scan_action_clone, None)?;

                    // 发送进度更新
                    for (idx, file) in files.iter().enumerate() {
                        let progress = ScanProgress {
                            processed: idx + 1,
                            total: files.len(),
                            current_file: Some(file.path.clone()),
                        };

                        // 发送到前端
                        window_clone.emit("picasa:find-photo", serde_json::json!({
                            "type": "progress",
                            "requestId": request_id_clone,
                            "action": scan_action_clone,
                            "progress": progress,
                            "file": file,
                        }))?;
                    }

                    // 发送完成信号
                    window_clone.emit("picasa:find-photo", serde_json::json!({
                        "type": "complete",
                        "requestId": request_id_clone,
                        "action": scan_action_clone,
                        "paths": files.iter().map(|f| f.path.clone()).collect::<Vec<_>>(),
                    }))?;
                }
            }

            Ok::<(), anyhow::Error>(())
        });

        Ok(())
    }
}
```

#### 3.5 Tauri 命令接口

```rust
// src-tauri/src/commands/scan.rs

use crate::services::scan::scan_service::ScanService;
use crate::services::scan::types::*;
use tauri::{Window, State};
use std::sync::Arc;
use tokio::sync::Mutex;

type ScanServiceState = State<'_, Arc<Mutex<ScanService>>>;

/// 扫描照片命令
#[tauri::command]
pub async fn scan_photos(
    window: Window,
    service: ScanServiceState,
    request_id: String,
    scan_action: ScanAction,
) -> Result<(), String> {
    let service = service.lock().await;
    service
        .scan_photos(request_id, scan_action, window)
        .await
        .map_err(|e| e.to_string())
}
```

### 阶段 4: 集成和测试

#### 4.1 注册服务

```rust
// src-tauri/src/main.rs

use crate::services::scan::scan_service::ScanService;
use std::sync::Arc;
use tokio::sync::Mutex;

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            // 初始化扫描服务
            app.manage(Arc::new(Mutex::new(ScanService::new())));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            crate::commands::scan::scan_photos,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

#### 4.2 前端适配

```typescript
// apps/photasa/src/api/scan.ts

import { invoke } from "@tauri-apps/api/tauri";
import { listen } from "@tauri-apps/api/event";

export const scanApi = {
    // 扫描照片
    scanPhotos: async (requestId: string, scanAction: ScanAction) => {
        await invoke("scan_photos", { requestId, scanAction });
    },

    // 监听扫描结果
    onScanResult: (callback: (result: any) => void) => {
        return listen("picasa:find-photo", (event) => {
            callback(event.payload);
        });
    },
};
```

## 迁移步骤总结

### 步骤 1: 基础结构（1-2 天）

- [ ] 创建 Rust 模块结构
- [ ] 添加依赖到 Cargo.toml
- [ ] 定义类型系统

### 步骤 2: 核心功能（3-5 天）

- [ ] 实现文件遍历（walkthrough_photos_in_folder）
- [ ] 实现文件类型检测
- [ ] 实现路径处理工具函数

### 步骤 3: 扫描策略（2-3 天）

- [ ] 实现扫描策略决策
- [ ] 实现增量缓存管理
- [ ] 实现缓存恢复逻辑

### 步骤 4: 服务集成（2-3 天）

- [ ] 实现主扫描服务
- [ ] 创建 Tauri 命令
- [ ] 实现事件发送

### 步骤 5: 前端适配（1-2 天）

- [ ] 创建前端 API 适配层
- [ ] 更新现有代码调用
- [ ] 测试集成

### 步骤 6: 测试和优化（2-3 天）

- [ ] 单元测试
- [ ] 集成测试
- [ ] 性能优化
- [ ] 错误处理完善

## 关键技术点

### 1. Observable → Rust Stream

Electron 使用 RxJS Observable，Rust 可以使用：

- `tokio_stream` - 异步流
- `futures::stream` - 流处理
- `mpsc::channel` - 通道通信

### 2. Worker Threads → Tokio Tasks

Electron 使用 Node.js Worker Threads，Rust 使用：

- `tokio::spawn` - 异步任务
- `tokio::task::spawn_blocking` - CPU 密集型任务

### 3. 文件系统操作

- `walkdir` - 替代 `klaw`
- `std::fs` - 文件操作
- `notify` - 文件系统监听

### 4. 类型检测

- `infer` - MIME 类型检测
- 扩展名回退机制

## 注意事项

1. **异步处理**: Rust 使用 async/await，需要正确处理异步上下文
2. **错误处理**: 使用 `Result<T, E>` 和 `anyhow` 进行错误处理
3. **内存管理**: Rust 的所有权系统，注意生命周期
4. **性能优化**: 使用并行处理（tokio::spawn）提高性能
5. **兼容性**: 保持与 Electron 版本的 API 兼容

## 后续优化

1. **并行扫描**: 使用 `rayon` 进行并行文件遍历
2. **流式处理**: 使用流式 API 减少内存占用
3. **缓存优化**: 优化缓存数据结构
4. **错误恢复**: 增强错误处理和恢复机制

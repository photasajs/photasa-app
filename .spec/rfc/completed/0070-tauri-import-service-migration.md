# RFC 0070: 导入服务迁移到 Tauri

- **作者**: AI Assistant
- **状态**: ✅ Completed（2026-07-18）；核心执行流已在 Rust 落地（`execute_import` / `cancel_import` / `pause_import` / `resume_import`、`ImportSessionStore` 历史与撤销）；与 legacy-api 全量特性对拍见 [RFC 0097](../0097-tauri-legacy-api-deferred-surface.md)
- **创建日期**: 2025-01-02
- **关联 RFC**: [RFC 0067: 创建 Tauri 应用 Photasa](../0067-tauri-app-photasa.md)

## Implementation principle (Photasa / Tauri)

> **Rust rewrite, not TypeScript copy.** Policy: [ROADMAP.md](../../../ROADMAP.md).

- contract reference/Node code is a **behavioral specification** only—not a library for Photasa.
- Implement in `apps/photasa/src-tauri` and `crates/`; **do not** import `@photasa/scan`, `@photasa/import`, or other Node packages from Tauri.
- **1:1 parity** = same IPC/events/on-disk formats; **not** porting TypeScript source.

## 当前实现（2026-07-18）

实际落地点不是早期草稿中的 `services/import/*` 目录，而是：

- `crates/photasa-import/`：可测试的导入算法，包括文件收集、复制循环、日期目录、重复策略、历史、撤销、崩溃恢复 journal。
- `apps/photasa/src-tauri/src/commands/import_*.rs`：Tauri 命令壳，负责 `scan_directories` / `preview_import` / `execute_import` / `cancel_import` / `pause_import` / `resume_import` / history / undo。
- `apps/photasa/src/api/legacy-api.ts` 与 `apps/photasa/src/api/import.adapter.ts`：前端兼容层，保持 `window.api` 形状。

当前 public `ImportConfig` 以 `packages/common/src/import-types.ts` 为准：`sourcePaths`、`targetPath`、`filters`、`duplicateStrategy`、`fileGroups`、`selectedFiles`、`allowDuplicateRename`。早期草稿中的 `file_naming`、`copy_mode` 不是当前 Photasa/Tauri 契约；当前导入行为是复制，不暴露 move 模式。

## 摘要

本文档详细说明如何将 contract reference 的导入服务迁移到 Tauri Rust 实现。导入服务负责管理照片从外部源导入到目标目录的完整流程。

## 当前架构分析

### 旧实现结构

```
historical main/import/
├── import-service.ts # 主服务（IPC 处理、会话管理）
├── import-worker.ts # Worker 线程实现
├── import-handler.ts # 导入处理逻辑
├── batch-processor.ts # 批量处理
├── duplicate-handler.ts # 重复文件处理
├── history-manager.ts # 导入历史管理
└── file-groups/ # 文件分组逻辑
```

### 核心功能

1. **IPC 通信**（通道名以 `packages/common` 的 `ImportEvents` 为准，主进程 `import-service.ts` 使用 `ipc.handle`）

- Invoke：`import:scan-directories`, `import:preview`, `import:execute`, `import:cancel`, `import:pause`, `import:resume`, `import:get-progress`, `import:get-history`, `import:get-details`, `import:preview-undo`, `import:undo`, `import:choose-directories`, `import:extract-metadata`
- Main→Renderer 事件：`import:progress`, `import:complete`, `import:error`

2. **导入流程**

- 扫描源目录
- 文件分组和去重
- 元数据提取
- 文件复制/移动
- 进度跟踪
- 历史记录

3. **Worker 线程**

- 使用 Node.js Worker Threads
- 处理导入任务

## Tauri Rust 迁移计划

### 阶段 1: 基础架构

#### 1.1 Rust 模块结构（早期草稿）

```
apps/photasa/src-tauri/src/
├── services/
│ └── import/
│ ├── mod.rs # 模块导出
│ ├── import_service.rs # 主服务
│ ├── scanner.rs # 目录扫描
│ ├── processor.rs # 导入处理
│ ├── duplicate_detector.rs # 重复检测
│ ├── history.rs # 历史管理
│ ├── file_groups.rs # 文件分组
│ └── types.rs # 类型定义
```

#### 1.2 依赖添加

```toml
[dependencies]
# 文件操作
walkdir = "2.0"
fs_extra = "1.3" # 扩展文件操作

# 异步处理
tokio = { version = "1.0", features = ["full"] }

# 元数据提取
exif = "0.7" # EXIF 数据读取

# 哈希计算（用于重复检测）
sha2 = "0.10"
blake3 = "1.5"

# 序列化
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
```

### 阶段 2: 类型定义

以 `packages/common/src/import-types.ts` 的 `ImportConfig` / `ImportProgress` / `ImportResult` 为准；Rust 命令内部使用 `serde_json::Value` 接收该公共契约，算法类型集中在 `crates/photasa-import`。

### 阶段 3: 核心功能实现

#### 3.1 目录扫描

```rust
// src-tauri/src/services/import/scanner.rs

use walkdir::WalkDir;
use std::path::Path;
use anyhow::Result;

pub struct ImportScanner;

impl ImportScanner {
 /// 扫描目录，查找媒体文件
 pub async fn scan_directory(
 &self,
 path: &str,
 filters: Option<ImportFilters>,
 ) -> Result<Vec<ScannedFile>> {
 let mut files = Vec::new();

 for entry in WalkDir::new(path) {
 let entry = entry?;
 let path = entry.path();

 if path.is_file() && self.is_media_file(path)? {
 let metadata = self.extract_metadata(path).await?;
 files.push(ScannedFile {
 path: path.to_string_lossy().to_string(),
 size: entry.metadata()?.len(),
 metadata,
 });
 }
 }

 Ok(files)
 }

 fn is_media_file(&self, path: &Path) -> Result<bool> {
 // 使用 infer 库检测文件类型
 Ok(infer::get_from_path(path)?
 .map(|kind| kind.mime_type().starts_with("image/") || kind.mime_type().starts_with("video/"))
 .unwrap_or(false))
 }
}
```

#### 3.2 导入处理

```rust
// src-tauri/src/services/import/processor.rs

use tokio::fs;
use tokio::io;
use anyhow::Result;

pub struct ImportProcessor;

impl ImportProcessor {
 /// 执行导入操作
 pub async fn execute_import(
 &self,
 config: ImportConfig,
 progress_callback: impl Fn(ImportProgress),
 ) -> Result<()> {
 // 1. 扫描源目录
 let files = self.scan_source_directories(&config).await?;

 // 2. 文件分组和去重
 let groups = self.group_files(files, &config).await?;

 // 3. 处理每个文件
 for (idx, group) in groups.iter().enumerate() {
 progress_callback(ImportProgress {
 processed: idx,
 total: groups.len(),
 current_file: Some(group.path.clone()),
 status: ImportStatus::Processing,
 });

 self.process_file_group(group, &config).await?;
 }

 Ok(())
 }

 async fn process_file_group(
 &self,
 group: &FileGroup,
 config: &ImportConfig,
 ) -> Result<()> {
 let target_path = self.build_target_path(group, config)?;

 match config.copy_mode {
 CopyMode::Copy => {
 fs::copy(&group.path, &target_path).await?;
 }
 CopyMode::Move => {
 fs::rename(&group.path, &target_path).await?;
 }
 }

 Ok(())
 }
}
```

### 阶段 4: Tauri 命令

```rust
// src-tauri/src/commands/import.rs

use crate::services::import::import_service::ImportService;
use crate::services::import::types::*;
use tauri::{Window, State};
use std::sync::Arc;
use tokio::sync::Mutex;

type ImportServiceState = State<'_, Arc<Mutex<ImportService>>>;

#[tauri::command]
pub async fn scan_directories(
 service: ImportServiceState,
 paths: Vec<String>,
 filters: Option<ImportFilters>,
) -> Result<Vec<ScannedFile>, String> {
 let service = service.lock().await;
 service
 .scan_directories(paths, filters)
 .await
 .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn execute_import(
 window: Window,
 service: ImportServiceState,
 config: ImportConfig,
) -> Result<String, String> {
 let service = service.lock().await;
 let import_id = service
 .start_import(config, move |progress| {
 // 发送进度事件到前端
 let _ = window.emit("import:progress", progress);
 })
 .await
 .map_err(|e| e.to_string())?;

 Ok(import_id)
}
```

## 迁移步骤

### 步骤 1: 基础实现（1 周）

- [ ] 创建模块结构
- [ ] 实现目录扫描
- [ ] 实现基础导入流程

### 步骤 2: 高级功能（1 周）

- [ ] 文件分组和去重
- [ ] 元数据提取
- [ ] 进度跟踪

### 步骤 3: 完善功能（1 周）

- [ ] 导入历史管理
- [ ] 撤销功能
- [ ] 暂停/恢复
- [ ] 错误处理

## 预计时间

**总计：2-3 周**

## 注意事项

1. **文件操作**：需要处理大文件复制，注意内存使用
2. **进度跟踪**：实时更新进度，避免阻塞
3. **错误恢复**：导入失败时的回滚机制
4. **性能优化**：并行处理多个文件

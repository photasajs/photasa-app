# RFC 0071: 配置服务迁移到 Tauri

- **作者**: AI Assistant
- **状态**: Draft
- **创建日期**: 2025-01-02
- **关联 RFC**: [RFC 0067: 创建 Tauri 应用 Photasa](./0067-tauri-app-photasa.md)

## 摘要

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

1. **IPC 通信**
   - `picasa:query-config` - 查询配置
   - `picasa:add-config` - 添加配置
   - `picasa:remove-config` - 移除配置

2. **配置管理**
   - 读取/写入 `.photasa.json` 文件
   - 批量操作
   - 缓存管理

3. **Worker 线程**
   - 使用 Node.js Worker Threads
   - 处理配置操作，避免阻塞主进程

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

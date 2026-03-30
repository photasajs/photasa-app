use async_trait::async_trait;
use serde_json::Value;
use std::collections::HashMap;
use std::sync::Arc;
use thiserror::Error;

use crate::types::ExecutionContext;

// ============================================================
// AdapterError — 适配器错误类型
// ============================================================

#[derive(Debug, Error)]
pub enum AdapterError {
    #[error("adapter not found: {0}")]
    NotFound(String),

    #[error("invalid input: {0}")]
    InvalidInput(String),

    #[error("action not supported: {0}")]
    UnsupportedAction(String),

    #[error("io error: {0}")]
    Io(#[from] std::io::Error),

    #[error("serialization error: {0}")]
    Serialization(String),

    #[error("internal error: {0}")]
    Internal(String),
}

// ============================================================
// Adapter trait — 所有适配器必须实现
// ============================================================

#[async_trait]
pub trait Adapter: Send + Sync {
    /// 适配器名称，对应工作流中的 service 字段
    fn name(&self) -> &str;

    /// 执行指定动作
    async fn execute(
        &self,
        action: &str,
        input: Value,
        ctx: &ExecutionContext,
    ) -> Result<Value, AdapterError>;

    /// 声明支持的动作列表（可选，用于校验）
    fn supported_actions(&self) -> &[&str] {
        &[]
    }
}

// ============================================================
// AdapterRegistry — 运行时注册中心
// ============================================================

#[derive(Default)]
pub struct AdapterRegistry {
    adapters: HashMap<String, Arc<dyn Adapter>>,
}

impl AdapterRegistry {
    pub fn new() -> Self {
        Self::default()
    }

    /// 注册一个适配器
    pub fn register(&mut self, adapter: Arc<dyn Adapter>) {
        self.adapters.insert(adapter.name().to_string(), adapter);
    }

    /// 按名称查找适配器
    pub fn get(&self, name: &str) -> Option<&Arc<dyn Adapter>> {
        self.adapters.get(name)
    }

    /// 列出所有已注册的适配器名称
    pub fn names(&self) -> Vec<&str> {
        self.adapters.keys().map(|s| s.as_str()).collect()
    }
}

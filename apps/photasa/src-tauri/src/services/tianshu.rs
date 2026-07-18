/*!
 * 天枢服务（TianshuService）
 *
 * 负责：
 * 1. 启动时从 bundle resources 加载所有 .zouwu 工作流文件
 * 2. 构建 AdapterRegistry，注入各 Adapter
 * 3. 管理 ZouwuEngine 实例生命周期
 * 4. 提供 execute_intent 接口给 Tauri 命令层调用
 */
use serde_json::Value;
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use tauri::Manager;
use tokio::sync::RwLock;

use zouwu_builtin::BuiltinAdapter;
use zouwu_core::adapter::Adapter;
use zouwu_core::adapter::AdapterRegistry;
use zouwu_core::engine::{EngineError, WorkflowResolver, ZouwuEngine};
use zouwu_core::parser::parse_workflow;
use zouwu_core::types::WorkflowDefinition;

use crate::adapters::{
    ConfigAdapter, PreferencesAdapter, ScanAdapter, SimingAdapter, TaibaijinxingAdapter,
    TaiyiAdapter,
};

// ============================================================
// TianshuError
// ============================================================

#[derive(Debug, thiserror::Error)]
pub enum TianshuError {
    #[error("workflow not found: {0}")]
    WorkflowNotFound(String),

    #[error("engine error: {0}")]
    Engine(#[from] EngineError),

    #[error("io error: {0}")]
    Io(#[from] std::io::Error),

    #[error("parse error: {0}")]
    Parse(String),
}

impl serde::Serialize for TianshuError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

// ============================================================
// WorkflowStore — 内存中的工作流字典（intent → definition）
// ============================================================

struct WorkflowStore {
    /// 按 intent 索引（trigger.intent 字段）
    by_intent: HashMap<String, WorkflowDefinition>,
    /// 按 id 索引
    by_id: HashMap<String, WorkflowDefinition>,
}

impl WorkflowStore {
    fn new() -> Self {
        Self {
            by_intent: HashMap::new(),
            by_id: HashMap::new(),
        }
    }

    fn insert(&mut self, wf: WorkflowDefinition) {
        // 按 triggers.intent 注册
        if let Some(triggers) = &wf.triggers {
            for trigger in triggers {
                if let Some(intent) = &trigger.intent {
                    self.by_intent.insert(intent.clone(), wf.clone());
                }
            }
        }
        self.by_id.insert(wf.id.clone(), wf);
    }

    fn get_by_intent(&self, intent: &str) -> Option<&WorkflowDefinition> {
        self.by_intent
            .get(intent)
            .or_else(|| self.get_by_id(intent))
    }

    fn get_by_id(&self, id: &str) -> Option<&WorkflowDefinition> {
        self.by_id.get(id)
    }
}

// ============================================================
// SubWorkflowResolver — 让引擎能调用子工作流
// ============================================================

struct SubWorkflowResolver {
    store: Arc<RwLock<WorkflowStore>>,
}

#[async_trait::async_trait]
impl WorkflowResolver for SubWorkflowResolver {
    async fn resolve(&self, workflow_id: &str) -> Option<WorkflowDefinition> {
        let store = self.store.read().await;
        store.get_by_id(workflow_id).cloned()
    }
}

// ============================================================
// TianshuService
// ============================================================

pub struct TianshuService {
    engine: ZouwuEngine,
    store: Arc<RwLock<WorkflowStore>>,
}

impl TianshuService {
    /// 初始化天枢服务
    ///
    /// - `workflows_dir`: 工作流文件所在目录（开发期用源码路径，生产用 resource_dir）
    /// - `app_handle`: Tauri AppHandle，注入给需要推送事件的 Adapter
    pub async fn new(
        workflows_dir: PathBuf,
        app_handle: tauri::AppHandle,
    ) -> Result<Self, TianshuError> {
        // 1. 加载所有工作流文件
        let store = Arc::new(RwLock::new(WorkflowStore::new()));
        load_workflows(&workflows_dir, &store).await?;

        let loaded = store.read().await.by_id.len();
        log::info!("🌌 天枢天书已载入 {loaded} 卷工作流典籍");

        // 2. 构建 AdapterRegistry（含太乙路由层）
        let builtin = Arc::new(BuiltinAdapter::new());
        let config = Arc::new(ConfigAdapter::new());
        let preferences =
            Arc::new(PreferencesAdapter::new().await.map_err(|e| {
                TianshuError::Parse(format!("preferences adapter init error: {e}"))
            })?);
        let scan = Arc::new(ScanAdapter::new(app_handle.clone()));
        let siming = Arc::new(SimingAdapter::new());
        let taibaijinxing = Arc::new(TaibaijinxingAdapter::new(app_handle));

        let mut taiyi_engines: HashMap<String, Arc<dyn Adapter>> = HashMap::new();
        taiyi_engines.insert("builtin".to_string(), builtin.clone() as Arc<dyn Adapter>);
        taiyi_engines.insert("config".to_string(), config.clone() as Arc<dyn Adapter>);
        taiyi_engines.insert(
            "wenchang".to_string(),
            preferences.clone() as Arc<dyn Adapter>,
        );
        taiyi_engines.insert("qianliyan".to_string(), scan.clone() as Arc<dyn Adapter>);
        taiyi_engines.insert("siming".to_string(), siming.clone() as Arc<dyn Adapter>);
        taiyi_engines.insert(
            "taibaijinxing".to_string(),
            taibaijinxing.clone() as Arc<dyn Adapter>,
        );

        let taiyi = Arc::new(TaiyiAdapter::new(taiyi_engines));

        let mut registry = AdapterRegistry::new();
        registry.register(builtin);
        registry.register(config);
        registry.register(preferences);
        registry.register(scan);
        registry.register(siming);
        registry.register(taibaijinxing);
        registry.register(taiyi);

        // 3. 构建引擎，注入子工作流解析器
        let resolver = Arc::new(SubWorkflowResolver {
            store: Arc::clone(&store),
        });
        let engine = ZouwuEngine::new(registry).with_resolver(resolver);

        Ok(Self { engine, store })
    }

    /// 按 intent 执行工作流
    pub async fn execute_intent(&self, intent: &str, inputs: Value) -> Result<Value, TianshuError> {
        let store = self.store.read().await;
        let wf = store
            .get_by_intent(intent)
            .ok_or_else(|| TianshuError::WorkflowNotFound(intent.to_string()))?
            .clone();
        drop(store);

        log::debug!("🌌 召唤仙家：天枢施展「{intent}」之术");
        let result = self.engine.execute(&wf, inputs).await?;
        log::debug!("🌌 仙术成功：「{intent}」大功告成");
        Ok(result.output)
    }

    /// 按工作流 id 直接执行（调试 / 后续 IPC 扩展）
    #[allow(dead_code)]
    pub async fn execute_by_id(
        &self,
        workflow_id: &str,
        inputs: Value,
    ) -> Result<Value, TianshuError> {
        let store = self.store.read().await;
        let wf = store
            .get_by_id(workflow_id)
            .ok_or_else(|| TianshuError::WorkflowNotFound(workflow_id.to_string()))?
            .clone();
        drop(store);

        let result = self.engine.execute(&wf, inputs).await?;
        Ok(result.output)
    }

    /// 返回已加载的工作流数量和 id 列表
    pub async fn status(&self) -> Value {
        let store = self.store.read().await;
        let ids: Vec<&str> = store.by_id.keys().map(|s| s.as_str()).collect();
        serde_json::json!({
            "workflows": store.by_id.len(),
            "status": "ready",
            "ids": ids
        })
    }
}

// ============================================================
// 工作流文件加载
// ============================================================

/// 递归扫描目录，解析所有 .zouwu 文件并存入 WorkflowStore
async fn load_workflows(
    dir: &Path,
    store: &Arc<RwLock<WorkflowStore>>,
) -> Result<(), TianshuError> {
    let mut stack = vec![dir.to_path_buf()];

    while let Some(current) = stack.pop() {
        let mut entries = tokio::fs::read_dir(&current)
            .await
            .map_err(TianshuError::Io)?;

        while let Some(entry) = entries.next_entry().await.map_err(TianshuError::Io)? {
            let path = entry.path();
            if path.is_dir() {
                stack.push(path);
            } else if path.extension().is_some_and(|e| e == "zouwu") {
                let content = tokio::fs::read_to_string(&path)
                    .await
                    .map_err(TianshuError::Io)?;

                match parse_workflow(&content) {
                    Ok(wf) => {
                        log::debug!(
                            "📜 载入典籍：{} ({})",
                            wf.id,
                            path.file_name().unwrap_or_default().to_string_lossy()
                        );
                        store.write().await.insert(wf);
                    }
                    Err(e) => {
                        log::warn!("⚠️ 典籍有误，跳过：{} — {e}", path.display());
                    }
                }
            }
        }
    }

    Ok(())
}

// ============================================================
// 辅助：获取工作流目录路径
// ============================================================

/// 在开发模式下使用源码路径，在生产模式下使用 bundle resource 路径
pub fn resolve_workflows_dir(app: &tauri::AppHandle) -> PathBuf {
    // 生产：使用 Tauri resource_dir
    if let Ok(resource_dir) = app.path().resource_dir() {
        let prod_path = resource_dir.join("workflows");
        if prod_path.exists() {
            return prod_path;
        }
    }

    // 开发：相对于 src-tauri 目录找到源码工作流路径
    let dev_path = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .and_then(|p| p.parent())
        .and_then(|p| p.parent())
        .map(|root| root.join("apps/desktop/src/main/engines/tianshu/workflows"))
        .unwrap_or_default();

    dev_path
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn get_by_intent_falls_back_to_workflow_id() {
        let mut store = WorkflowStore::new();
        let wf = WorkflowDefinition {
            id: "add_scan_action".to_string(),
            name: "添加扫描任务".to_string(),
            version: "1.0.0".to_string(),
            description: None,
            inputs: None,
            input_schema: None,
            outputs: None,
            output_schema: None,
            variables: None,
            triggers: None,
            timeout: None,
            enabled: None,
            tags: None,
            error_handling: None,
            on_error: None,
            priority: None,
            retry_on_error: None,
            steps: vec![],
        };
        store.insert(wf);

        assert!(store.get_by_intent("add_scan_action").is_some());
        assert!(store.get_by_intent("missing_intent").is_none());
    }
}

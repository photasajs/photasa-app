/*!
 * TaiyiAdapter（太乙 Adapter）
 *
 * 对齐 Electron `TaiyiService` 对 `service: "taiyi"` + `action: "callEngine"` 的路由语义，
 * 将工作流中的 engineName/methodName 转发到已注册的子适配器。
 */
use async_trait::async_trait;
use serde_json::Value;
use std::collections::HashMap;
use std::sync::Arc;

use zouwu_core::adapter::{Adapter, AdapterError};
use zouwu_core::types::ExecutionContext;

const SERVICE_TAIYI: &str = "taiyi";
const ACTION_CALL_ENGINE: &str = "callEngine";
const FIELD_ENGINE_NAME: &str = "engineName";
const FIELD_METHOD_NAME: &str = "methodName";
const FIELD_PARAMS: &str = "params";
const FIELD_ARGS: &str = "args";

pub struct TaiyiAdapter {
    engines: HashMap<String, Arc<dyn Adapter>>,
}

impl TaiyiAdapter {
    pub fn new(engines: HashMap<String, Arc<dyn Adapter>>) -> Self {
        Self { engines }
    }

    fn resolve_call_input(params: &Value) -> Value {
        match params {
            Value::Array(items) if items.is_empty() => Value::Object(Default::default()),
            Value::Array(items) if items.len() == 1 => items[0].clone(),
            other => other.clone(),
        }
    }
}

#[async_trait]
impl Adapter for TaiyiAdapter {
    fn name(&self) -> &str {
        SERVICE_TAIYI
    }

    fn supported_actions(&self) -> &[&str] {
        &[ACTION_CALL_ENGINE]
    }

    async fn execute(
        &self,
        action: &str,
        input: Value,
        ctx: &ExecutionContext,
    ) -> Result<Value, AdapterError> {
        if action != ACTION_CALL_ENGINE {
            return Err(AdapterError::UnsupportedAction(action.to_string()));
        }

        let engine_name = input
            .get(FIELD_ENGINE_NAME)
            .and_then(|v| v.as_str())
            .ok_or_else(|| AdapterError::InvalidInput("missing engineName".to_string()))?;

        let method_name = input
            .get(FIELD_METHOD_NAME)
            .and_then(|v| v.as_str())
            .ok_or_else(|| AdapterError::InvalidInput("missing methodName".to_string()))?;

        let params = input
            .get(FIELD_PARAMS)
            .or_else(|| input.get(FIELD_ARGS))
            .cloned()
            .unwrap_or(Value::Array(vec![]));

        let adapter = self
            .engines
            .get(engine_name)
            .ok_or_else(|| AdapterError::NotFound(format!("engine '{engine_name}'")))?;

        let call_input = Self::resolve_call_input(&params);
        adapter.execute(method_name, call_input, ctx).await
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use async_trait::async_trait;
    use serde_json::json;

    struct MockEngine {
        name: &'static str,
        result: Value,
    }

    #[async_trait]
    impl Adapter for MockEngine {
        fn name(&self) -> &str {
            self.name
        }

        async fn execute(
            &self,
            _action: &str,
            _input: Value,
            _ctx: &ExecutionContext,
        ) -> Result<Value, AdapterError> {
            Ok(self.result.clone())
        }
    }

    #[tokio::test]
    async fn call_engine_routes_to_child_adapter() {
        let mut engines = HashMap::new();
        engines.insert(
            "siming".to_string(),
            Arc::new(MockEngine {
                name: "siming",
                result: json!({ "currentFolder": "/photos" }),
            }) as Arc<dyn Adapter>,
        );
        let taiyi = TaiyiAdapter::new(engines);
        let result = taiyi
            .execute(
                ACTION_CALL_ENGINE,
                json!({
                    "engineName": "siming",
                    "methodName": "restoreAppState",
                    "params": []
                }),
                &ExecutionContext::new(json!({})),
            )
            .await
            .unwrap();
        assert_eq!(result["currentFolder"], "/photos");
    }
}

use async_trait::async_trait;
use serde_json::{json, Value};
use zouwu_core::adapter::{Adapter, AdapterError};
use zouwu_core::types::ExecutionContext;

/// BuiltinAdapter — 通过 Adapter trait 暴露内置操作
///
/// 使 builtin 操作可以被 action 步骤调用（service: "builtin"）。
/// 支持的 action: return、log、delay、calculate、compile、transform（供工作流直接调用）
pub struct BuiltinAdapter;

impl BuiltinAdapter {
    pub fn new() -> Self {
        Self
    }
}

impl Default for BuiltinAdapter {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl Adapter for BuiltinAdapter {
    fn name(&self) -> &str {
        "builtin"
    }

    fn supported_actions(&self) -> &[&str] {
        &["return", "log", "delay", "calculate", "compile", "transform"]
    }

    async fn execute(
        &self,
        action: &str,
        input: Value,
        _ctx: &ExecutionContext,
    ) -> Result<Value, AdapterError> {
        match action {
            // 透传输入作为输出（action 步骤调用 builtin.return 的兼容写法）
            "return" => Ok(input),

            // 日志输出
            "log" => {
                let msg = input
                    .get("message")
                    .and_then(|v| v.as_str())
                    .unwrap_or("(no message)");
                println!("[BUILTIN LOG] {msg}");
                Ok(json!({ "logged": true }))
            }

            // 延迟：与引擎 BuiltinStep 的 delay 一致，兼容 ms / milliseconds
            "delay" => {
                let ms = input
                    .get("ms")
                    .and_then(|v| v.as_u64())
                    .or_else(|| input.get("milliseconds").and_then(|v| v.as_u64()))
                    .unwrap_or(0);
                let started = std::time::Instant::now();
                if ms > 0 {
                    tokio::time::sleep(std::time::Duration::from_millis(ms)).await;
                }
                let actual_delay = started.elapsed().as_millis() as u64;
                Ok(json!({
                    "success": true,
                    "actualDelay": actual_delay,
                    "requestedDelay": ms
                }))
            }

            // 统计计算：接收任意对象，返回统计摘要
            // 主要用于 engine_status_check.zouwu 中的 calculate 步骤
            "calculate" => {
                let total = if let Some(Value::Object(map)) = input.get("allStatus") {
                    map.len()
                } else {
                    0
                };

                let ready = if let Some(Value::Array(arr)) = input.get("availableList") {
                    arr.len()
                } else {
                    0
                };

                let ts = std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .map(|d| d.as_millis() as u64)
                    .unwrap_or(0);

                Ok(json!({
                    "result": {
                        "totalEngines": total,
                        "readyEngines": ready,
                        "timestamp": ts
                    },
                    "success": true,
                    "timestamp": ts
                }))
            }

            // 编译报告：将多个输入合并成一个报告对象
            "compile" => {
                let ts = std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .map(|d| d.as_millis() as u64)
                    .unwrap_or(0);

                Ok(json!({
                    "result": input,
                    "success": true,
                    "timestamp": ts
                }))
            }

            // 转换：透传输入
            "transform" => Ok(input),

            _ => Err(AdapterError::UnsupportedAction(action.to_string())),
        }
    }
}

// ============================================================
// 测试
// ============================================================

#[cfg(test)]
mod tests {
    use super::*;
    use zouwu_core::types::ExecutionContext;
    use serde_json::json;

    fn ctx() -> ExecutionContext {
        ExecutionContext::new(json!({}))
    }

    #[tokio::test]
    async fn test_return_action() {
        let adapter = BuiltinAdapter::new();
        let input = json!({ "success": true, "data": [1, 2, 3] });
        let result = adapter.execute("return", input.clone(), &ctx()).await.unwrap();
        assert_eq!(result, input);
    }

    #[tokio::test]
    async fn test_log_action() {
        let adapter = BuiltinAdapter::new();
        let result = adapter
            .execute("log", json!({ "message": "test log" }), &ctx())
            .await
            .unwrap();
        assert_eq!(result["logged"], json!(true));
    }

    #[tokio::test]
    async fn test_delay_action_ms() {
        let adapter = BuiltinAdapter::new();
        let result = adapter
            .execute("delay", json!({ "ms": 15 }), &ctx())
            .await
            .unwrap();
        assert_eq!(result["success"], json!(true));
        assert!(result["actualDelay"].as_u64().unwrap_or(0) >= 15);
    }

    #[tokio::test]
    async fn test_delay_action_milliseconds_alias() {
        let adapter = BuiltinAdapter::new();
        let result = adapter
            .execute("delay", json!({ "milliseconds": 10 }), &ctx())
            .await
            .unwrap();
        assert_eq!(result["success"], json!(true));
        assert!(result["actualDelay"].as_u64().unwrap_or(0) >= 10);
    }

    #[tokio::test]
    async fn test_calculate_action() {
        let adapter = BuiltinAdapter::new();
        let input = json!({
            "allStatus": { "engine1": {}, "engine2": {} },
            "availableList": ["engine1"]
        });
        let result = adapter.execute("calculate", input, &ctx()).await.unwrap();
        assert_eq!(result["result"]["totalEngines"], json!(2));
        assert_eq!(result["result"]["readyEngines"], json!(1));
        assert_eq!(result["success"], json!(true));
    }

    #[tokio::test]
    async fn test_unsupported_action() {
        let adapter = BuiltinAdapter::new();
        let result = adapter
            .execute("nonexistent", json!({}), &ctx())
            .await;
        assert!(matches!(result, Err(AdapterError::UnsupportedAction(_))));
    }
}

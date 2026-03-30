/**
 * WASM 命令接口
 *
 * 提供 Tauri 命令来调用 WASM 模块中的函数
 * 这是过渡方案，最终这些功能将完全重写为 Rust
 */

use crate::utils::wasm::WasmModuleCache;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::Mutex;
use tauri::State;

/// WASM 模块缓存状态
type WasmCacheState = State<'_, Arc<Mutex<WasmModuleCache>>>;

/// 调用 WASM 函数的参数
#[derive(Debug, Deserialize)]
pub struct WasmCallParams {
    pub module: String,
    pub function: String,
    pub args: Vec<serde_json::Value>,
}

/// 调用 WASM 函数的结果
#[derive(Debug, Serialize)]
pub struct WasmCallResult {
    pub success: bool,
    pub result: Option<serde_json::Value>,
    pub error: Option<String>,
}

/// 加载 WASM 模块
#[tauri::command]
pub async fn load_wasm_module(
    cache: WasmCacheState,
    name: String,
    path: String,
) -> Result<(), String> {
    let mut cache = cache.lock().await;
    cache
        .load_module(name, &path)
        .await
        .map_err(|e| format!("Failed to load WASM module: {}", e))
}

/// 调用 WASM 函数
#[tauri::command]
pub async fn call_wasm_function(
    cache: WasmCacheState,
    params: WasmCallParams,
) -> Result<WasmCallResult, String> {
    // 将 JSON 参数转换为 wasmtime::Val
    // 注意：这是一个简化版本，实际使用时需要更完善的类型转换
    let wasm_args: Vec<wasmtime::Val> = params
        .args
        .iter()
        .filter_map(|v| {
            if let Some(n) = v.as_i64() {
                Some(wasmtime::Val::I32(n as i32))
            } else if let Some(n) = v.as_f64() {
                Some(wasmtime::Val::F64(n))
            } else {
                None
            }
        })
        .collect();

    let mut cache = cache.lock().await;
    match cache
        .call_cached_function(&params.module, &params.function, &wasm_args)
        .await
    {
        Ok(results) => {
            // 将结果转换回 JSON
            // 注意：这是一个简化版本，实际使用时需要更完善的类型转换
            let result_value = if results.len() == 1 {
                match results[0] {
                    wasmtime::Val::I32(n) => Some(serde_json::json!(n)),
                    wasmtime::Val::I64(n) => Some(serde_json::json!(n)),
                    wasmtime::Val::F32(n) => Some(serde_json::json!(n)),
                    wasmtime::Val::F64(n) => Some(serde_json::json!(n)),
                    _ => None,
                }
            } else {
                None
            };

            Ok(WasmCallResult {
                success: true,
                result: result_value,
                error: None,
            })
        }
        Err(e) => Ok(WasmCallResult {
            success: false,
            result: None,
            error: Some(format!("{}", e)),
        }),
    }
}

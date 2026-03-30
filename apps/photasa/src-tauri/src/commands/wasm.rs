/*!
 * WASM 命令（已清空）
 *
 * wasmtime 依赖已移除。工作流引擎由 zouwu-core 提供，通过 tianshu_command 调用。
 * 此文件保留空命令占位，待 main.rs 清理后删除。
 */
use crate::utils::wasm::WasmModuleCache;
use std::sync::Arc;
use tokio::sync::Mutex;

/// 加载 WASM 模块（已废弃，保留签名防止 main.rs 编译报错）
#[tauri::command]
pub async fn load_wasm_module(
    _cache: tauri::State<'_, Arc<Mutex<WasmModuleCache>>>,
    _name: String,
    _path: String,
) -> Result<(), String> {
    Ok(())
}

/// 调用 WASM 函数（已废弃）
#[derive(Debug, serde::Deserialize)]
pub struct WasmCallParams {
    pub module: String,
    pub function: String,
    pub args: Vec<serde_json::Value>,
}

#[derive(Debug, serde::Serialize)]
pub struct WasmCallResult {
    pub success: bool,
    pub result: Option<serde_json::Value>,
    pub error: Option<String>,
}

#[tauri::command]
pub async fn call_wasm_function(
    _cache: tauri::State<'_, Arc<Mutex<WasmModuleCache>>>,
    _params: WasmCallParams,
) -> Result<WasmCallResult, String> {
    Ok(WasmCallResult {
        success: false,
        result: None,
        error: Some("WASM 命令已废弃，请使用 tianshu_command".to_string()),
    })
}

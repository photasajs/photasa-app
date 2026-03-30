/*!
 * WASM 工具模块（已清空）
 *
 * wasmtime 依赖已移除，工作流引擎由 zouwu-core Rust crate 提供。
 * 此文件保留空结构体，防止 main.rs 引用报错，后续清理。
 */

/// WASM 模块缓存（占位，不再使用）
pub struct WasmModuleCache;

impl WasmModuleCache {
    pub fn new() -> Self {
        Self
    }
}

impl Default for WasmModuleCache {
    fn default() -> Self {
        Self::new()
    }
}

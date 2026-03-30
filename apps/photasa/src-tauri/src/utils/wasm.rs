/**
 * WASM 运行时工具
 *
 * 过渡方案：在 Rust 中加载和运行编译为 WASM 的 TypeScript/JavaScript 代码
 * 最终目标：将这些功能完全重写为 Rust
 */

use anyhow::{Context, Result};
use wasmtime::*;
use std::sync::Arc;

/// WASM 运行时管理器
pub struct WasmRuntime {
    engine: Engine,
    store: Store<()>,
}

impl WasmRuntime {
    /// 创建新的 WASM 运行时
    pub fn new() -> Result<Self> {
        let engine = Engine::default();
        let mut store = Store::new(&engine, ());

        Ok(Self { engine, store })
    }

    /// 从文件加载 WASM 模块
    pub async fn load_module(&mut self, wasm_path: &str) -> Result<Module> {
        let wasm_bytes = tokio::fs::read(wasm_path)
            .await
            .with_context(|| format!("Failed to read WASM file: {}", wasm_path))?;

        Module::new(&self.engine, wasm_bytes)
            .with_context(|| "Failed to compile WASM module")
    }

    /// 从字节数组加载 WASM 模块
    pub fn load_module_from_bytes(&self, wasm_bytes: &[u8]) -> Result<Module> {
        Module::new(&self.engine, wasm_bytes)
            .with_context(|| "Failed to compile WASM module from bytes")
    }

    /// 执行 WASM 函数
    pub async fn call_function(
        &mut self,
        module: &Module,
        function_name: &str,
        args: &[wasmtime::Val],
    ) -> Result<Vec<wasmtime::Val>> {
        let instance = Instance::new(&mut self.store, module, &[])?;

        let func = instance
            .get_func(&mut self.store, function_name)
            .with_context(|| format!("Function '{}' not found", function_name))?;

        let mut results = vec![wasmtime::Val::I32(0); func.ty(&self.store).results().len()];
        func.call(&mut self.store, args, &mut results)?;

        Ok(results)
    }

    /// 获取 WASM 模块的导出函数列表
    pub fn list_exports(module: &Module) -> Vec<String> {
        module
            .exports()
            .filter_map(|export| {
                if let ExternType::Func(_) = export.ty() {
                    Some(export.name().to_string())
                } else {
                    None
                }
            })
            .collect()
    }
}

impl Default for WasmRuntime {
    fn default() -> Self {
        Self::new().expect("Failed to create WASM runtime")
    }
}

/// WASM 模块缓存
pub struct WasmModuleCache {
    runtime: Arc<tokio::sync::Mutex<WasmRuntime>>,
    modules: std::collections::HashMap<String, Module>,
}

impl WasmModuleCache {
    pub fn new() -> Self {
        Self {
            runtime: Arc::new(tokio::sync::Mutex::new(
                WasmRuntime::new().expect("Failed to create WASM runtime"),
            )),
            modules: std::collections::HashMap::new(),
        }
    }

    /// 加载并缓存 WASM 模块
    pub async fn load_module(&mut self, name: String, wasm_path: &str) -> Result<()> {
        let mut runtime = self.runtime.lock().await;
        let module = runtime.load_module(wasm_path).await?;
        self.modules.insert(name, module);
        Ok(())
    }

    /// 执行缓存的模块中的函数
    pub async fn call_cached_function(
        &mut self,
        module_name: &str,
        function_name: &str,
        args: &[wasmtime::Val],
    ) -> Result<Vec<wasmtime::Val>> {
        let module = self
            .modules
            .get(module_name)
            .with_context(|| format!("Module '{}' not found in cache", module_name))?;

        let mut runtime = self.runtime.lock().await;
        runtime.call_function(module, function_name, args).await
    }
}

impl Default for WasmModuleCache {
    fn default() -> Self {
        Self::new()
    }
}

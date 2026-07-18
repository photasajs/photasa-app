// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod services;
mod utils;

use commands::{window, wasm};
use utils::wasm::WasmModuleCache;
use std::sync::Arc;
use tokio::sync::Mutex;

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            // 设置窗口
            let window = app.get_window("main").unwrap();
            
            // 初始化 WASM 模块缓存（过渡方案）
            app.manage(Arc::new(Mutex::new(WasmModuleCache::new())));
            
            // 可以在这里初始化服务
            // 例如：初始化服务注册表
            
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // 窗口命令
            window::minimize_window,
            window::maximize_window,
            window::unmaximize_window,
            window::close_window,
            window::is_maximized,
            // WASM 命令（过渡方案）
            wasm::load_wasm_module,
            wasm::call_wasm_function,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

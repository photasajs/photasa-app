// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod adapters;
mod commands;
mod services;
mod utils;

use commands::{
    config, directory, extract_metadata, import_execute, import_legacy, import_preview,
    import_session_store, log_viewer, menu, path, platform, shell, stubs, thumbnail, update, wasm, watch,
    window,
};
#[cfg(not(any(target_os = "android", target_os = "ios")))]
use commands::log_toggle_shortcut;
use commands::update::UpdateState;
use services::{TianshuService, tianshu::resolve_workflows_dir};
use commands::import_execute::ImportTaskRegistry;
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use tauri::Emitter;
use tauri::Manager;
use tokio::sync::{Mutex as TokioMutex, RwLock};
use utils::wasm::WasmModuleCache;

/// 与 `tauri.conf.json` 首窗默认 label 一致（未显式写 `label` 时为 `main`）
const MAIN_WEBVIEW_LABEL: &str = "main";

/// macOS Dock 重开且无可见窗口：恢复或按配置重建主窗（RFC 0100）
#[cfg(target_os = "macos")]
fn restore_main_window(app: &tauri::AppHandle) {
    if let Some(w) = app.get_webview_window(MAIN_WEBVIEW_LABEL) {
        let _ = w.unminimize();
        let _ = w.show();
        let _ = w.set_focus();
        log::info!("🌌 Dock 重开：已恢复主窗口");
        return;
    }
    if let Some(cfg) = app.config().app.windows.first() {
        match tauri::WebviewWindowBuilder::from_config(app, cfg).and_then(|b| b.build()) {
            Ok(_) => log::info!("🌌 Dock 重开：已按配置重建主窗口"),
            Err(e) => log::warn!("⚠️ Dock 重开：重建主窗口失败：{e}"),
        }
    } else {
        log::warn!("⚠️ Dock 重开：无窗口配置可重建");
    }
}

fn main() {
    let mut builder = tauri::Builder::default();

    // RFC 0100：须尽早注册；第二实例被插件终止前，首实例在此回调聚焦主窗
    #[cfg(not(any(target_os = "android", target_os = "ios")))]
    {
        builder = builder.plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
            if let Some(w) = app.get_webview_window(MAIN_WEBVIEW_LABEL) {
                let _ = w.unminimize();
                let _ = w.show();
                let _ = w.set_focus();
                log::info!("🌌 单实例：再次启动已转交首实例，主窗口已聚焦");
            } else {
                log::warn!("⚠️ 单实例回调：主窗口尚未就绪，跳过聚焦");
            }
        }));
    }

    builder = builder
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init());

    // MCP 调试桥：仅 debug 构建启用，供 @hypothesi/tauri-mcp-server 通过 WebSocket 连本应用
    #[cfg(debug_assertions)]
    {
        builder = builder.plugin(tauri_plugin_mcp_bridge::init());
    }

    #[cfg(not(any(target_os = "android", target_os = "ios")))]
    {
        builder = builder
            .plugin(tauri_plugin_updater::Builder::new().build())
            .plugin(tauri_plugin_global_shortcut::Builder::new().build());
    }

    builder
        .setup(|app| {
            log_viewer::init_log_emit_bridge(&app.handle());
            #[cfg(not(any(target_os = "android", target_os = "ios")))]
            log_toggle_shortcut::register_log_toggle_shortcut(&app.handle());

            // RFC 0101：尽早向 Splash 报告启动进度（对齐 Electron SplashWindow.updateStatus/updateProgress）
            if let Some(splash) = app.get_webview_window("splash") {
                let _ = splash.emit("splash:status-update", "启动应用程序...");
                let _ = splash.emit("splash:progress-update", -1);
            }

            // 目录存储与文件监视状态
            app.manage(directory::DirectoryStore(Mutex::new(HashMap::new())));
            app.manage(watch::WatchState::new());
            app.manage(Arc::new(ImportTaskRegistry::default()));

            if let Some(splash) = app.get_webview_window("splash") {
                let _ = splash.emit("splash:status-update", "初始化核心服务...");
                let _ = splash.emit("splash:progress-update", 25);
            }
            let app_dir = app.path().app_data_dir().map_err(|e| {
                log::error!("❌ 无法解析应用数据目录：{e}");
                e
            })?;
            std::fs::create_dir_all(&app_dir).map_err(|e| {
                log::error!("❌ 无法创建应用数据目录：{e}");
                e
            })?;
            app.manage(Arc::new(
                import_session_store::ImportSessionStore::load_or_new(app_dir),
            ));
            app.manage(UpdateState::default());
            // WASM 缓存占位（已废弃，保留防止命令签名报错）
            app.manage(Arc::new(TokioMutex::new(WasmModuleCache::new())));

            // 先注册占位，保证命令提取 State 不 panic
            let tianshu_slot: Arc<RwLock<Option<TianshuService>>> =
                Arc::new(RwLock::new(None));
            app.manage(tianshu_slot.clone());

            // 异步初始化天枢服务，完成后填入 slot
            let handle = app.handle().clone();
            if let Some(splash) = app.get_webview_window("splash") {
                let _ = splash.emit("splash:status-update", "载入天枢典籍...");
                let _ = splash.emit("splash:progress-update", 55);
            }
            let workflows_dir = resolve_workflows_dir(&handle);
            log::info!("🌌 天枢开坛，工作流典籍路径：{}", workflows_dir.display());

            tauri::async_runtime::spawn(async move {
                match TianshuService::new(workflows_dir, handle.clone()).await {
                    Ok(service) => {
                        let slot = handle.state::<Arc<RwLock<Option<TianshuService>>>>();
                        *slot.write().await = Some(service);
                        log::info!("🌌 天枢天书已开启，万仙归位");
                        if let Some(splash) = handle.get_webview_window("splash") {
                            let _ = splash.emit("splash:status-update", "加载用户界面...");
                            let _ = splash.emit("splash:progress-update", 80);
                        }
                    }
                    Err(e) => {
                        log::error!("❌ 天枢初始化失败：{e}");
                        if let Some(splash) = handle.get_webview_window("splash") {
                            let _ = splash.emit("splash:status-update", "天枢初始化失败");
                            let _ = splash.emit("splash:progress-update", -1);
                        }
                    }
                }
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // 窗口命令
            window::minimize_window,
            window::maximize_window,
            window::unmaximize_window,
            window::close_window,
            window::is_maximized,
            window::reload_window,
            window::close_splashscreen,
            // Shell 命令
            shell::show_in_folder,
            shell::open_external,
            // 配置命令
            config::query_config,
            config::add_config,
            config::remove_config,
            config::get_photasa_config,
            config::add_to_photo_list,
            config::remove_from_photo_list,
            config::reset_photasa_config,
            config::fix_photasa_config,
            // 平台
            platform::get_platform,
            platform::get_app_version,
            // 路径工具
            path::get_separator,
            path::normalize_path,
            path::merge_path,
            path::to_file_name,
            path::to_dir_name,
            path::is_hidden_file,
            path::resolve_path,
            path::relative_path,
            path::is_file_under_folder,
            path::get_path_root,
            path::is_video_file,
            path::is_image_file,
            path::get_image_type,
            path::file_url_from_path,
            path::get_file_metadata,
            // 目录与对话框
            directory::choose_directory,
            directory::choose_directories,
            directory::get_directory,
            directory::set_directory,
            directory::sub_folders,
            directory::check_photasa_config,
            // 旧版导入（RFC 0093，纯 Rust）
            import_legacy::import_photos_legacy,
            import_preview::preview_import,
            // 文件监视
            watch::start_file_watch,
            watch::stop_file_watch,
            // 缩略图
            thumbnail::create_thumbnail,
            thumbnail::remove_thumbnail,
            // 系统菜单
            menu::apply_system_menu,
            // WASM（已废弃，保留命令签名）
            wasm::load_wasm_module,
            wasm::call_wasm_function,
            // 天枢命令（真实引擎）
            tianshu_command,
            tianshu_status,
            // Stub 命令（待逐步替换）
            stubs::scan_photos,
            stubs::scan_directories,
            import_execute::execute_import,
            import_execute::cancel_import,
            import_execute::pause_import,
            import_execute::resume_import,
            import_session_store::get_import_history,
            import_session_store::get_import_details,
            import_session_store::get_import_progress,
            import_session_store::preview_undo_import,
            import_session_store::undo_import_execute,
            extract_metadata::extract_metadata,
            // 日志查看器（RFC 0088、0089）
            log_viewer::log_viewer_open,
            log_viewer::log_viewer_close,
            // 自动更新（RFC 0090）
            update::check_for_updates,
            update::download_update,
            update::install_update,
            update::get_update_status,
            update::update_auto_update_config,
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app_handle, event| {
            #[cfg(target_os = "macos")]
            {
                if let tauri::RunEvent::Reopen {
                    has_visible_windows,
                    ..
                } = event
                {
                    if !has_visible_windows {
                        restore_main_window(app_handle);
                    }
                }
            }
            #[cfg(not(target_os = "macos"))]
            {
                let _ = (app_handle, event);
            }
        });
}

// ============================================================
// 天枢命令（替换 stubs）
// ============================================================

#[derive(Debug, serde::Deserialize)]
struct TianshuCommandInput {
    pub intent: Option<String>,
    pub inputs: Option<serde_json::Value>,
}

#[derive(Debug, serde::Serialize)]
struct TianshuResponse {
    pub success: bool,
    pub result: Option<serde_json::Value>,
    pub error: Option<String>,
}

/// 天枢命令 — 通过 intent 路由到对应工作流
#[tauri::command]
async fn tianshu_command(
    service: tauri::State<'_, Arc<RwLock<Option<TianshuService>>>>,
    command: serde_json::Value,
) -> Result<TianshuResponse, String> {
    let input: TianshuCommandInput = serde_json::from_value(command)
        .map_err(|e| format!("invalid command: {e}"))?;

    let intent = input
        .intent
        .ok_or_else(|| "missing intent field".to_string())?;

    let inputs = input.inputs.unwrap_or(serde_json::json!({}));

    let guard = service.read().await;
    match guard.as_ref() {
        None => Ok(TianshuResponse {
            success: false,
            result: None,
            error: Some("天枢服务尚未就绪".to_string()),
        }),
        Some(svc) => match svc.execute_intent(&intent, inputs).await {
            Ok(result) => Ok(TianshuResponse {
                success: true,
                result: Some(result),
                error: None,
            }),
            Err(e) => Ok(TianshuResponse {
                success: false,
                result: None,
                error: Some(e.to_string()),
            }),
        },
    }
}

/// 天枢状态查询
#[tauri::command]
async fn tianshu_status(
    service: tauri::State<'_, Arc<RwLock<Option<TianshuService>>>>,
) -> Result<serde_json::Value, String> {
    match service.try_read() {
        Ok(guard) => match guard.as_ref() {
            None => Ok(serde_json::json!({ "status": "initializing", "workflows": 0 })),
            Some(svc) => Ok(svc.status().await),
        },
        Err(_) => Ok(serde_json::json!({ "status": "initializing", "workflows": 0 })),
    }
}

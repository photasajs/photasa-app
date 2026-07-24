// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod macos_display_name;
mod utils;

use commands::import_execute::ImportTaskRegistry;
#[cfg(not(any(target_os = "android", target_os = "ios")))]
use commands::log_toggle_shortcut;
use commands::stubs::ScanWorker;
use commands::update::UpdateState;
#[cfg(not(any(target_os = "android", target_os = "ios")))]
use commands::update_periodic::UpdatePeriodicHandle;
use commands::{
    config, directory, engine_status, extract_metadata, import_execute, import_legacy,
    import_preview, import_scan_directories, import_session_store, log_viewer, menu, path,
    platform, preferences, scan_queue, shell, folder_tree, splash_bridge, stubs, thumbnail, update,
    watch, window,
};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use tauri::Manager;
use utils::scan_queue_repository::{ScanQueueRepository, ScanQueueRepositoryHandle};

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
    macos_display_name::apply_process_display_name_early();

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
            if let Some(name) = app.config().product_name.as_deref() {
                macos_display_name::apply_process_display_name(name);
            }

            log_viewer::init_log_emit_bridge(app.handle());
            #[cfg(not(any(target_os = "android", target_os = "ios")))]
            log_toggle_shortcut::register_log_toggle_shortcut(app.handle());

            let app_handle = app.handle().clone();
            engine_status::emit_engine_status(&app_handle, "initializing");

            // RFC 0101：尽早向 Splash 报告启动进度与系统主题
            splash_bridge::sync_splash_theme(&app_handle);
            splash_bridge::emit_splash_status(&app_handle, "启动应用程序...");
            splash_bridge::emit_splash_progress(&app_handle, -1);

            // 目录存储与文件监视状态
            app.manage(directory::DirectoryStore(Mutex::new(HashMap::new())));
            app.manage(watch::WatchState::new());
            match ScanQueueRepository::load_default() {
                Ok(repo) => {
                    log::info!(
                        "🌌 扫描队列仓库已加载: {}",
                        repo.queue_path().display()
                    );
                    app.manage(Arc::new(repo) as ScanQueueRepositoryHandle);
                }
                Err(error) => {
                    log::warn!("⚠️ 扫描队列加载失败，使用空队列: {error}");
                    let repo = ScanQueueRepository::empty_at(
                        utils::scan_queue_storage::scanning_queue_path(),
                    );
                    app.manage(Arc::new(repo) as ScanQueueRepositoryHandle);
                }
            }
            app.manage(Arc::new(ImportTaskRegistry::default()));
            app.manage(ScanWorker::new(app.handle().clone()).map_err(|error| {
                log::error!("❌ 无法启动扫描线程：{error}");
                std::io::Error::other(error)
            })?);

            splash_bridge::emit_splash_status(&app_handle, "初始化核心服务...");
            splash_bridge::emit_splash_progress(&app_handle, 25);
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
            let update_state = UpdateState::default();
            commands::update_config::sync_update_state_from_preferences(&update_state);
            app.manage(update_state);
            let preferences_state = tauri::async_runtime::block_on(preferences::PreferencesState::initialize())
                .map_err(|e| {
                    log::error!("❌ 偏好存储初始化失败：{e}");
                    std::io::Error::other(e)
                })?;
            app.manage(preferences_state);
            #[cfg(not(any(target_os = "android", target_os = "ios")))]
            {
                let periodic =
                    commands::update_periodic::spawn_periodic_update_checker(app.handle().clone());
                app.manage(periodic);
            }

            engine_status::emit_engine_status(&app_handle, "ready");
            splash_bridge::emit_splash_status(&app_handle, "加载用户界面...");
            splash_bridge::emit_splash_progress(&app_handle, 80);

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
            scan_queue::scan_queue_get,
            scan_queue::scan_queue_add_actions,
            scan_queue::scan_queue_remove_action,
            scan_queue::scan_queue_update_action_status,
            folder_tree::folder_tree_update,
            folder_tree::app_state_restore,
            preferences::preferences_get,
            preferences::preferences_update,
            thumbnail::create_thumbnail,
            thumbnail::remove_thumbnail,
            // 系统菜单
            menu::apply_system_menu,
            // Stub 命令（待逐步替换）
            stubs::scan_photos,
            import_scan_directories::scan_directories,
            import_execute::execute_import,
            import_execute::cancel_import,
            import_execute::pause_import,
            import_execute::resume_import,
            import_session_store::get_import_history,
            import_session_store::get_import_details,
            import_session_store::get_import_progress,
            import_session_store::get_recoverable_imports,
            import_session_store::cleanup_recoverable_import,
            import_session_store::keep_recoverable_import,
            import_session_store::preview_undo_import,
            import_session_store::undo_import_execute,
            extract_metadata::extract_metadata,
            // 日志查看器（RFC 0088、0089）
            log_viewer::log_viewer_open,
            log_viewer::log_viewer_close,
            log_viewer::log_from_renderer,
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
            if let tauri::RunEvent::ExitRequested { .. } = event {
                // RFC 0162：退出前刷尽防抖落盘队列，避免丢 scanning.json
                if let Some(repo) = app_handle.try_state::<ScanQueueRepositoryHandle>() {
                    tauri::async_runtime::block_on(async {
                        if let Err(error) = repo.flush_persist().await {
                            log::warn!("⚠️ 退出前扫描队列落盘失败: {error}");
                        }
                    });
                }
                #[cfg(not(any(target_os = "android", target_os = "ios")))]
                if let Some(periodic) = app_handle.try_state::<UpdatePeriodicHandle>() {
                    periodic.stop();
                }
            }
            if let tauri::RunEvent::WindowEvent {
                event: tauri::WindowEvent::ThemeChanged(theme),
                ..
            } = event
            {
                splash_bridge::emit_splash_theme(app_handle, theme);
            }
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

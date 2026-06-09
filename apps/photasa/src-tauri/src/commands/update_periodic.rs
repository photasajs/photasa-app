//! 自动更新后台定时检查（RFC 0106 — 对齐 Electron UpdateService）

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Duration;

use log::{info, warn};
use tauri::{AppHandle, Manager};

use super::update::{perform_check_for_updates, UpdateState};

/// 启动后首次检查延迟（秒），与 Electron `setTimeout(..., 5000)` 一致
pub const STARTUP_CHECK_DELAY_SECS: u64 = 5;

/// 将小时转为秒，至少 1 小时
pub fn check_interval_secs(interval_hours: u32) -> u64 {
    interval_hours.max(1) as u64 * 3600
}

/// 控制后台定时任务生命周期（`RunEvent::ExitRequested` 时取消）
pub struct UpdatePeriodicHandle {
    cancel: Arc<AtomicBool>,
}

impl UpdatePeriodicHandle {
    pub fn stop(&self) {
        self.cancel.store(true, Ordering::SeqCst);
    }
}

/// 在 `setup` 中启动；桌面端才有 `tauri-plugin-updater`
#[cfg(not(any(target_os = "android", target_os = "ios")))]
pub fn spawn_periodic_update_checker(app: AppHandle) -> UpdatePeriodicHandle {
    let cancel = Arc::new(AtomicBool::new(false));
    let token = Arc::clone(&cancel);
    tauri::async_runtime::spawn(async move {
        run_periodic_update_loop(app, token).await;
    });
    UpdatePeriodicHandle { cancel }
}

#[cfg(not(any(target_os = "android", target_os = "ios")))]
async fn run_periodic_update_loop(app: AppHandle, cancel: Arc<AtomicBool>) {
    info!("🌌 更新定时检查：{} 秒后执行启动检查", STARTUP_CHECK_DELAY_SECS);
    if sleep_or_cancel(STARTUP_CHECK_DELAY_SECS, &cancel).await {
        return;
    }

    run_startup_check(&app).await;

    loop {
        let (enabled, interval_secs) = read_auto_update_schedule(&app);
        info!(
            "🌌 更新定时检查：{} 小时后再次轮询（enabled={}）",
            interval_secs / 3600,
            enabled
        );
        if sleep_or_cancel(interval_secs, &cancel).await {
            return;
        }
        if enabled {
            run_scheduled_check(&app).await;
        }
    }
}

#[cfg(not(any(target_os = "android", target_os = "ios")))]
async fn sleep_or_cancel(secs: u64, cancel: &Arc<AtomicBool>) -> bool {
    let mut remaining = secs;
    while remaining > 0 {
        if cancel.load(Ordering::SeqCst) {
            info!("🌌 更新定时检查：已取消");
            return true;
        }
        let step = remaining.min(1);
        tokio::time::sleep(Duration::from_secs(step)).await;
        remaining -= step;
    }
    cancel.load(Ordering::SeqCst)
}

#[cfg(not(any(target_os = "android", target_os = "ios")))]
fn read_auto_update_schedule(app: &AppHandle) -> (bool, u64) {
    let state = app.state::<UpdateState>();
    let cfg = match state.auto_config.lock() {
        Ok(guard) => guard.clone(),
        Err(e) => {
            warn!("🌌 更新定时检查：读取配置失败 {e}");
            return (false, check_interval_secs(24));
        }
    };
    (cfg.enabled, check_interval_secs(cfg.check_interval))
}

#[cfg(not(any(target_os = "android", target_os = "ios")))]
async fn run_startup_check(app: &AppHandle) {
    let state = app.state::<UpdateState>();
    match perform_check_for_updates(app, &state).await {
        Ok(result) => info!("🌌 启动更新检查完成: {result}"),
        Err(e) => warn!("🌌 启动更新检查失败: {e}"),
    }
}

#[cfg(not(any(target_os = "android", target_os = "ios")))]
async fn run_scheduled_check(app: &AppHandle) {
    let state = app.state::<UpdateState>();
    match perform_check_for_updates(app, &state).await {
        Ok(result) => info!("🌌 定时更新检查完成: {result}"),
        Err(e) => warn!("🌌 定时更新检查失败: {e}"),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::commands::update::AutoUpdateConfigState;

    #[test]
    fn check_interval_secs_minimum_one_hour() {
        assert_eq!(check_interval_secs(0), 3600);
        assert_eq!(check_interval_secs(1), 3600);
        assert_eq!(check_interval_secs(24), 86400);
    }

    #[test]
    fn read_schedule_uses_enabled_and_interval_from_config_state() {
        let cfg = AutoUpdateConfigState {
            enabled: true,
            check_interval: 6,
            allow_prerelease: false,
            auto_install: false,
        };
        assert!(cfg.enabled);
        assert_eq!(check_interval_secs(cfg.check_interval), 6 * 3600);
    }
}

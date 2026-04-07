# RFC 0106 – Tauri updater: background periodic check timer

**Status**: Draft  
**Created**: 2026-04-05  
**Area**: Tauri / Update

---

## Problem

The Electron `UpdateService` runs a `setInterval` background timer that
periodically calls `checkForUpdates()` based on the user's configured
`checkInterval` (in hours):

```ts
private startPeriodicCheck(): void {
    const intervalMs = this.config.checkInterval * 60 * 60 * 1000;
    this.checkTimer = setInterval(() => {
        this.checkForUpdates().catch(…);
    }, intervalMs);
}
```

It also fires a one-time check 5 seconds after startup:

```ts
setTimeout(() => { this.checkForUpdates(); }, 5000);
```

The Rust `update.rs` stores `check_interval` in `AutoUpdateConfigState` but
**never starts a background loop**.  `check_for_updates` is only called when
the frontend explicitly invokes the Tauri command.  Automatic background
update checking is therefore absent from the Tauri build.

---

## Decision

Wire a background Tokio task in `apps/photasa/src-tauri/src/main.rs` (inside
`setup`) that:

1. **Initial delay**: `tokio::time::sleep(Duration::from_secs(5))` before the
   first check, matching the Electron 5-second startup delay.
2. **Periodic loop**: after each check, sleep for
   `auto_config.check_interval` hours (default `24`) before re-checking.
3. **Config-driven**: read `auto_config.enabled` and `auto_config.check_interval`
   from `UpdateState` each iteration.  If `enabled == false`, skip that cycle
   but keep the loop alive so it picks up future config changes.
4. **Shutdown on app exit**: use a `CancellationToken` (or `tauri::async_runtime::handle()
   .spawn`) tied to the `RunEvent::ExitRequested` handler so the background
   task terminates cleanly.

### Pseudo-code sketch

```rust
tauri::async_runtime::spawn(async move {
    tokio::time::sleep(Duration::from_secs(5)).await;
    loop {
        let (enabled, interval_h) = {
            let cfg = update_state.auto_config.lock().unwrap();
            (cfg.enabled, cfg.check_interval.max(1))
        };
        if enabled {
            // invoke check_for_updates logic inline or via Arc<UpdateState>
            let _ = do_check_for_updates(&app_handle, &update_state).await;
        }
        tokio::time::sleep(Duration::from_secs(interval_h as u64 * 3600)).await;
    }
});
```

### `get_app_version` command

The Electron service also exposes `picasa:get-app-version`.  The Rust
equivalent should be wired in `generate_handler![]` if not already present:

```rust
#[tauri::command]
pub fn get_app_version(app: AppHandle) -> String {
    app.package_info().version.to_string()
}
```

---

## Impact

- Users with auto-update enabled will receive update notifications without
  manually opening Settings, matching Electron behaviour.
- The background task is cheap (sleeps most of the time) and uses the existing
  `tauri-plugin-updater` machinery already wired.

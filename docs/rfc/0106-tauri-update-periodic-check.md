# RFC 0106 – Tauri updater: background periodic check timer


## Implementation principle (Photasa / Tauri)

> **Rust rewrite, not TypeScript copy.** Policy: [./TAURI_RUST_REWRITE_POLICY.md](./TAURI_RUST_REWRITE_POLICY.md).

- Electron/Node code is a **behavioral specification** only—not a library for Photasa.
- Implement in `apps/photasa/src-tauri` and `crates/`; **do not** import `@photasa/scan`, `@photasa/import`, or other Node packages from Tauri.
- **1:1 parity** = same IPC/events/on-disk formats; **not** porting TypeScript source.

**Status**: ✅ Implemented  
**Created**: 2026-04-05  
**Last updated**: 2026-06-06  
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

Already wired in `commands/platform.rs` and registered in `main.rs` as `platform::get_app_version` (returns `CARGO_PKG_VERSION`).

---

## Verification (2026-06-06)

Implemented in Rust:

- `commands/update.rs` — `perform_check_for_updates` shared by command + background task
- `commands/update_periodic.rs` — Tokio loop (5s startup check, then interval sleep; skips check when `enabled == false`)
- `main.rs` — spawns checker in `setup`, stops on `RunEvent::ExitRequested`

```bash
cd apps/photasa/src-tauri && cargo test update_periodic
cd apps/photasa/src-tauri && cargo build -p photasa
```

---

## Impact

- Users with auto-update enabled will receive update notifications without
  manually opening Settings, matching Electron behaviour.
- The background task is cheap (sleeps most of the time) and uses the existing
  `tauri-plugin-updater` machinery already wired.

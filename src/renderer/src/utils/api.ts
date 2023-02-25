import type { WatchConfig, WatchCallback } from "src/preload/index.d";

export function startWatching(config: WatchConfig, callback: WatchCallback): void {
    window.api.startWatching(config, callback);
}

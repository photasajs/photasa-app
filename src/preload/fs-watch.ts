import type { WatchConfig, WatchCallback } from "./index.d";
import { electronAPI } from "@electron-toolkit/preload";
const { ipcRenderer } = electronAPI;

export function startWatching(config: WatchConfig, callback: WatchCallback): void {
    // Start file watching
    ipcRenderer?.send("picasa:start-file-watch", {
        paths: JSON.parse(JSON.stringify(config.paths)),
    });

    // Response to event then save to pinia store
    ipcRenderer?.on("picasa:file-add", (_, { isFile, path }) => {
        callback({ action: "add", isFile, path });
    });
    ipcRenderer?.on("picasa:file-change", (_, { isFile, path }) => {
        callback({ action: "change", isFile, path });
    });
    ipcRenderer?.on("picasa:file-unlink", (_, { isFile, path }) => {
        callback({ action: "unlink", isFile, path });
    });
    ipcRenderer?.on("picasa:file-error", (_, { error }) => {
        callback({
            action: "error",
            error,
        });
    });
    ipcRenderer?.on("picasa:file-ready", () => {
        callback({
            action: "ready",
        });
    });
    ipcRenderer?.on("picasa:file-raw", (_, { isFile, path }) => {
        callback({ action: "raw", isFile, path });
    });
}

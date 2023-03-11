import type { WatchConfig, WatchCallback } from "./index.d";
import { electronAPI } from "@electron-toolkit/preload";
import isImage from "is-image";
import isVideo from "is-video";
import path from "path";

const { ipcRenderer } = electronAPI;

function invokeCallback(args, callback: WatchCallback): void {
    if (args.isFile) {
        // Use file name to check if it is a video or image
        args.isVideo = isVideo(args.path);
        args.isImage = isImage(args.path);

        // Prepare thumbnail path for image
        const dir = path.join(path.dirname(args.path), ".picasaoriginals");
        const thumbnail = path.join(dir, `thumbnail-${path.basename(args.path)}`);
        args.thumbnail = thumbnail;
    }

    callback(args);
}

export function stopWatching(): Promise<void> {
    // Stop file watching
    return ipcRenderer?.invoke("picasa:stop-file-watch");
}

export function startWatching(config: WatchConfig, callback: WatchCallback): void {
    // Start file watching
    ipcRenderer?.send("picasa:start-file-watch", {
        paths: JSON.parse(JSON.stringify(config.paths)),
        options: {
            ignored: ".picasaoriginals",
        },
    });

    // Response to event then save to pinia store
    ipcRenderer?.on("picasa:file-add", (_, { isFile, path }) => {
        invokeCallback({ action: "add", isFile, path }, callback);
    });
    ipcRenderer?.on("picasa:file-change", (_, { isFile, path }) => {
        invokeCallback({ action: "change", isFile, path }, callback);
    });
    ipcRenderer?.on("picasa:file-unlink", (_, { isFile, path }) => {
        invokeCallback({ action: "delete", isFile, path }, callback);
    });
    ipcRenderer?.on("picasa:file-raw", (_, { isFile, path }) => {
        invokeCallback({ action: "raw", isFile, path }, callback);
    });

    // Notify
    ipcRenderer?.on("picasa:file-error", (_, { error }) => {
        invokeCallback(
            {
                action: "error",
                error,
                isNotify: true,
            },
            callback,
        );
    });
    ipcRenderer?.on("picasa:file-ready", () => {
        invokeCallback(
            {
                action: "ready",
                isNotify: true,
            },
            callback,
        );
    });
}

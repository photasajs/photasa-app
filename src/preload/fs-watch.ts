import type { WatchConfig, WatchCallback } from "./index.d";
import { electronAPI } from "@electron-toolkit/preload";
import { isImage } from "./image-helper";
import isVideo from "is-video";
import path from "path";

const { ipcRenderer } = electronAPI;

function invokeCallback(args, callback: WatchCallback): void {
    isImage(args.path).then((image) => {
        // Notify only action is error or ready
        if (args.isNotify) {
            callback(args);
        }

        // Skip any thing start with dot
        if (path.basename(args.path).startsWith(".")) {
            return;
        }

        // Only notify image and video
        args.isVideo = isVideo(args.path);
        args.isImage = image;
        if (args.isImage || args.isVideo) {
            callback(args);
        }
    });
}

export function startWatching(config: WatchConfig, callback: WatchCallback): void {
    // Start file watching
    ipcRenderer?.send("picasa:start-file-watch", {
        paths: JSON.parse(JSON.stringify(config.paths)),
    });

    // Response to event then save to pinia store
    ipcRenderer?.on("picasa:file-add", (_, { isFile, path }) => {
        invokeCallback({ action: "add", isFile, path }, callback);
    });
    ipcRenderer?.on("picasa:file-change", (_, { isFile, path }) => {
        invokeCallback({ action: "change", isFile, path }, callback);
    });
    ipcRenderer?.on("picasa:file-unlink", (_, { isFile, path }) => {
        invokeCallback({ action: "unlink", isFile, path }, callback);
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

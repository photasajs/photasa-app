import type { WatchConfig, WatchCallback, WatchState, WatchAction } from "./types";
import { electronAPI } from "@electron-toolkit/preload";
import isImage from "is-image";
import isVideo from "is-video";
import { buildThumbnailPath } from "./image-helper";

const { ipcRenderer } = electronAPI;

function invoke(args: WatchState, callback: WatchCallback): void {
    if (args.isFile && args.path) {
        // Use file name to check if it is a video or image
        args.isVideo = isVideo(args.path);
        args.isImage = isImage(args.path);

        // Prepare thumbnail path for image
        const thumbnail = buildThumbnailPath(args.path);
        args.thumbnail = thumbnail;
    }

    callback(args);
}

const listeners: WatchCallback[] = [];

function notifyAction(action: WatchAction, isFile: boolean, path: string): void {
    listeners.forEach((callback) => {
        invoke(
            {
                action,
                isFile,
                path,
                isImage: false,
                isVideo: false,
                thumbnail: "",
            },
            callback,
        );
    });
}
function notifyError(action: WatchAction, error: Error, isNotify: boolean): void {
    listeners.forEach((callback) => {
        callback({
            action,
            error,
            isNotify,
            isImage: false,
            isVideo: false,
            thumbnail: "",
        });
    });
}
function notifyReady(action: WatchAction, isNotify: boolean): void {
    listeners.forEach((callback) => {
        callback({
            action,
            isNotify,
            isImage: false,
            isVideo: false,
            thumbnail: "",
        });
    });
}
// Response to event then save to pinia store
ipcRenderer?.on("picasa:file-add", (_, { isFile, path }) => {
    notifyAction("add", isFile, path);
});
ipcRenderer?.on("picasa:file-change", (_, { isFile, path }) => {
    notifyAction("change", isFile, path);
});
ipcRenderer?.on("picasa:file-unlink", (_, { isFile, path }) => {
    notifyAction("delete", isFile, path);
});
ipcRenderer?.on("picasa:file-raw", (_, { isFile, path }) => {
    notifyAction("raw", isFile, path);
});

// Notify
ipcRenderer?.on("picasa:file-error", (_, { error }) => {
    notifyError("error", error, true);
});
ipcRenderer?.on("picasa:file-ready", () => {
    notifyReady("ready", true);
});

export function startWatching(config: WatchConfig, callback: WatchCallback): void {
    if (listeners.indexOf(callback) < 0) {
        listeners.push(callback);
    }
    // Start file watching
    ipcRenderer?.send("picasa:start-file-watch", {
        paths: JSON.parse(JSON.stringify(config.paths)),
        options: {
            ignored: /(^|[/\\])\../,
            ignoreInitial: true,
        },
    });
}

export function stopWatching(): Promise<void> {
    // Stop file watching
    return ipcRenderer?.invoke("picasa:stop-file-watch");
}

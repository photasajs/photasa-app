import type { WatchConfig, WatchCallback, WatchState, WatchAction } from "@common/watch-types";
import { electronAPI } from "@electron-toolkit/preload";
import isImage from "is-image";
import isVideo from "is-video";
import { buildThumbnailPath } from "@shared/path-util";
import { WatchServiceEvent } from "@common/watch-types";

const { ipcRenderer } = electronAPI;

/**
 * 调用回调函数
 * @param args - 参数
 * @param callback - 回调函数
 */
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

/**
 * 通知操作
 * @param action - 操作
 * @param isFile - 是否是文件
 * @param path - 路径
 */
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

/**
 * 通知错误
 * @param action - 操作
 * @param error - 错误
 * @param _isNotify - 是否通知
 */
function notifyError(action: WatchAction, error: Error): void {
    listeners.forEach((callback) => {
        invoke(
            {
                action,
                isFile: false,
                path: "",
                error,
                isImage: false,
                isVideo: false,
                thumbnail: "",
            },
            callback,
        );
    });
}

/**
 * 通知准备就绪
 * @param action - 操作
 * @param _isNotify - 是否通知
 */
function notifyReady(action: WatchAction): void {
    listeners.forEach((callback) => {
        invoke(
            {
                action,
                isFile: false,
                path: "",
                isImage: false,
                isVideo: false,
                thumbnail: "",
            },
            callback,
        );
    });
}

/**
 * 响应事件
 * @param action - 操作
 * @param isFile - 是否是文件
 * @param path - 路径
 */
ipcRenderer?.on(WatchServiceEvent.add, (_, { isFile, path }) => {
    notifyAction("add", isFile, path);
});

/**
 * 响应文件变化
 * @param action - 操作
 * @param isFile - 是否是文件
 * @param path - 路径
 */
ipcRenderer?.on(WatchServiceEvent.change, (_, { isFile, path }) => {
    notifyAction("change", isFile, path);
});

/**
 * 响应文件删除
 * @param action - 操作
 * @param isFile - 是否是文件
 * @param path - 路径
 */
ipcRenderer?.on(WatchServiceEvent.unlink, (_, { isFile, path }) => {
    notifyAction("delete", isFile, path);
});

/**
 * 响应文件原始事件
 * @param action - 操作
 * @param isFile - 是否是文件
 * @param path - 路径
 */
ipcRenderer?.on(WatchServiceEvent.raw, (_, { isFile, path }) => {
    notifyAction("raw", isFile, path);
});

/**
 * 响应文件错误
 * @param action - 操作
 * @param error - 错误
 */
ipcRenderer?.on(WatchServiceEvent.error, (_, { error }) => {
    notifyError("error", error);
});

/**
 * 响应文件准备就绪
 * @param action - 操作
 */
ipcRenderer?.on(WatchServiceEvent.ready, () => {
    notifyReady("ready");
});

/**
 * 开始监听文件
 * @param config - 配置
 * @param callback - 回调函数
 */
export function startWatching(config: WatchConfig, callback: WatchCallback): void {
    if (listeners.indexOf(callback) < 0) {
        listeners.push(callback);
    }
    // Start file watching
    ipcRenderer?.send(WatchServiceEvent.start, {
        paths: JSON.parse(JSON.stringify(config.paths)),
        options: {
            ignored: /(^|[/\\])\../,
            ignoreInitial: true,
            awaitWriteFinish: true, // Wait file be written, then fire add/change event
        },
    });
}

/**
 * 停止监听文件
 */
export function stopWatching(): Promise<void> {
    // Stop file watching
    return ipcRenderer?.invoke(WatchServiceEvent.stop);
}

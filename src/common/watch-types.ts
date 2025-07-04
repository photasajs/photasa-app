/**
 * 监听事件类型
 */
export const WatchServiceEvent = {
    start: "picasa:start-file-watch",
    stop: "picasa:stop-file-watch",
    add: "picasa:file-add",
    addDir: "picasa:file-add-dir",
    change: "picasa:file-change",
    unlink: "picasa:file-unlink",
    unlinkDir: "picasa:file-unlink-dir",
    error: "picasa:file-error",
    ready: "picasa:file-ready",
    raw: "picasa:file-raw",
};

/**
 * 监听动作
 */
export type WatchAction = "add" | "change" | "delete" | "error" | "ready" | "raw";

/**
 * 监听配置
 */
export interface WatchConfig {
    path: string;
    recursive: boolean;
    paths: string[];
    options: {
        ignored: RegExp;
        ignoreInitial: boolean;
        awaitWriteFinish: boolean;
    };
}

/**
 * 监听状态
 */
export interface WatchState {
    action: WatchAction; // 监听动作
    isFile: boolean; // 是否为文件
    path: string; // 路径
    error?: Error; // 错误
    isImage: boolean; // 是否为图片
    isVideo: boolean; // 是否为视频
    thumbnail: string; // 缩略图路径
    isNotify?: boolean; // 是否通知
}

/**
 * 监听回调
 */
export type WatchCallback = (state: WatchState) => void;

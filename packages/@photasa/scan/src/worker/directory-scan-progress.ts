import fs from "fs-extra";
import path from "path";

/** 与 scan-worker 中增量缓存文件名一致 */
export const PHOTASA_FOLDER_CACHE_FILE = ".photasa-folder.json";

/**
 * 读取目录下 `.photasa-folder.json` 的 processed/pending 计数，用于进度条。
 * 读失败或非目录扫描上下文时由调用方使用 `processedFallback`。
 */
export function mergeDirectoryScanProgressWithCache(
    scanRootPath: string,
    processedFallback: number,
    logDebug: (message: string) => void,
): { processed: number; total: number } {
    let progressData = { processed: processedFallback, total: 0 };
    try {
        const cacheFilePath = path.join(scanRootPath, PHOTASA_FOLDER_CACHE_FILE);
        if (fs.existsSync(cacheFilePath)) {
            const cacheContent = fs.readFileSync(cacheFilePath, "utf8");
            const cache = JSON.parse(cacheContent) as {
                processedFiles?: unknown[];
                pendingFiles?: unknown[];
            };

            if (Array.isArray(cache?.processedFiles)) {
                const processedCount = cache.processedFiles.length;
                const pendingCount = Array.isArray(cache.pendingFiles)
                    ? cache.pendingFiles.length
                    : 0;

                progressData = {
                    processed: processedCount,
                    total: processedCount + pendingCount,
                };

                logDebug(
                    `Cache stats from file: processed=${processedCount}, total=${processedCount + pendingCount}`,
                );
            }
        }
    } catch (error) {
        logDebug(`Could not read cache file for progress: ${error}`);
    }
    return progressData;
}

/**
 * 构造发往主进程的 directory 扫描 progress 消息体（纯数据，无 postMessage）。
 */
export function buildDirectoryScanProgressMessage(params: {
    requestId: string;
    scanFallbackPath: string;
    action: { path?: string; isDirectory?: boolean } | null | undefined;
    progress: { processed: number; total: number };
}): {
    type: "progress";
    requestId: string;
    action: { path: string; isDirectory: boolean };
    progress: { processed: number; total: number };
    currentFile: string | undefined;
} {
    const { requestId, scanFallbackPath, action, progress } = params;
    const actPath = action?.path || scanFallbackPath;
    const isDir = action?.isDirectory || false;
    return {
        type: "progress",
        requestId,
        action: {
            path: actPath,
            isDirectory: isDir,
        },
        progress,
        currentFile: action?.path && !action?.isDirectory ? path.basename(action.path) : undefined,
    };
}

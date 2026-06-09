import { parentPort } from "worker_threads";
import type { ScanAction } from "@photasa/common";
import {
    scanPhotos,
    processMediaFile,
    getWorkerPool,
    mergeDirectoryScanProgressWithCache,
    buildDirectoryScanProgressMessage,
} from "@photasa/scan";
import { loggers } from "@photasa/common";
import fs from "fs-extra";
import {
    createWorkerLogViewerBridge,
    handleLogViewerStatusMessage,
} from "../workers/worker-log-viewer-bridge";
import { isPhotasaMediaFile } from "../workers/media-file-guard";

const logger = loggers.scan;

const SCAN_WORKER_THREAD_ID = "scan-worker";

const port = parentPort;
if (!port) {
    throw new Error("IllegalState");
}

const scanLogBridge = createWorkerLogViewerBridge({
    port,
    baseLogger: {
        debug: (m) => logger.debug(m),
        info: (m) => logger.info(m),
        warn: (m) => logger.warn(m),
        error: (m) => logger.error(m),
    },
    threadId: SCAN_WORKER_THREAD_ID,
});
const { workerLog } = scanLogBridge;

/**
 * 注意：Worker 池现在由 scan-photos.ts 统一管理
 * 这里不再需要独立的 Worker 池配置，避免资源重复
 */

/**
 * 发送消息
 * @param message - 消息
 */
function postMessage(message: any): void {
    // Only log message type and requestId to avoid logging large objects
    workerLog(
        "debug",
        "scan-worker",
        `Posting message: type=${message.type}, requestId=${message.requestId}`,
    );
    port?.postMessage(message);
}

/**
 * 执行目录扫描
 * @param requestId - 请求ID
 * @param scan - 扫描动作
 */
function executeDirectoryScan(requestId: string, scan: ScanAction): void {
    let processed = 0;
    const foundPaths: string[] = [];

    workerLog(
        "info",
        "scan-worker",
        `executeDirectoryScan: 开始扫描目录: ${scan.path}, operationType: ${scan.operationType}`,
    );

    // 添加目录存在性检查
    if (!fs.existsSync(scan.path)) {
        workerLog("error", "scan-worker", `executeDirectoryScan: 目录不存在: ${scan.path}`);
        postMessage({
            type: "error",
            requestId,
            error: `Directory does not exist: ${scan.path}`,
        });
        return;
    }

    // 执行目录扫描
    const workerPool = getWorkerPool(logger);
    scanPhotos(scan, logger, workerPool).subscribe({
        next: (action) => {
            processed++;
            if (action && action.path && action.isDirectory) {
                foundPaths.push(action.path);
            }

            let progressData = { processed, total: 0 };
            if (scan.operationType === "directory") {
                const logDbg = (msg: string) => workerLog("debug", "scan-worker", msg);
                progressData = mergeDirectoryScanProgressWithCache(scan.path, processed, logDbg);
            }

            postMessage(
                buildDirectoryScanProgressMessage({
                    requestId,
                    scanFallbackPath: scan.path,
                    action,
                    progress: progressData,
                }),
            );
        },
        error: (error) => {
            workerLog(
                "error",
                "scan-worker",
                `executeDirectoryScan: 增量缓存目录扫描失败: ${scan.path}, error: ${error}`,
            );
            postMessage({
                type: "error",
                requestId,
                error,
            });
        },
        complete: () => {
            workerLog(
                "info",
                "scan-worker",
                `executeDirectoryScan: 增量缓存目录扫描完成: ${scan.path}, 总共处理 ${processed} 个文件`,
            );
            postMessage({
                type: "complete",
                requestId,
                action: { path: scan.path, isDirectory: true },
                paths: foundPaths,
            });
        },
    });
}

/**
 * 执行文件操作
 * @param requestId - 请求ID
 * @param scan - 扫描动作
 */
async function executeFileOperation(requestId: string, scan: ScanAction): Promise<void> {
    const filePath = scan.path;
    workerLog("debug", "scan-worker", `Executing file operation: ${scan.action} for ${filePath}`);

    try {
        const isMediaFile = isPhotasaMediaFile(filePath);

        if (!isMediaFile) {
            // Non-media file, complete immediately
            postMessage({
                type: "complete",
                requestId,
                action: { path: filePath, isDirectory: false },
            });
            return;
        }

        // Process media file using unified function from @photasa/scan
        const workerPool = getWorkerPool(logger);
        await processMediaFile(filePath, scan, workerPool, logger);

        postMessage({
            type: "complete",
            requestId,
            action: { path: filePath, isDirectory: false },
        });
    } catch (error) {
        workerLog("error", "scan-worker", `Error processing media file: ${error}`);
        postMessage({
            type: "error",
            requestId,
            error,
        });
    }
}

/**
 * 注意：processMediaFile 函数已移动到 scan-photos.ts 中统一管理
 * 现在使用统一的处理逻辑，避免代码重复
 */

/**
 * 执行扫描
 * @param requestId - 请求ID
 * @param scan - 扫描动作
 */
export async function execute(requestId: string, scan: ScanAction): Promise<void> {
    workerLog(
        "debug",
        "scan-worker",
        `Executing: requestId=${requestId}, path=${scan.path}, operationType=${scan.operationType}`,
    );

    try {
        // Route based on operation type
        if (scan.operationType === "file") {
            await executeFileOperation(requestId, scan);
        } else {
            executeDirectoryScan(requestId, scan);
        }
    } catch (error) {
        workerLog("error", "scan-worker", `Error in execute: ${error}`);
        postMessage({
            type: "error",
            requestId,
            error,
        });
    }
}

/**
 * 处理来自主进程的消息
 * @param message - 消息
 */
port.on("message", async (message: any) => {
    if (handleLogViewerStatusMessage(message, scanLogBridge, SCAN_WORKER_THREAD_ID)) {
        return;
    }

    let parsedResult;
    try {
        parsedResult = message;
        workerLog(
            "debug",
            "scan-worker",
            `Received message: action=${parsedResult.action}, requestId=${parsedResult.requestId || "N/A"}`,
        );
        switch (parsedResult.action) {
            case "scan":
                workerLog(
                    "debug",
                    "scan-worker",
                    `Starting scan for request: ${parsedResult.requestId}`,
                );
                await execute(parsedResult.requestId, parsedResult.scan);
                return;
            default:
                workerLog("error", "scan-worker", `Unknown action: ${parsedResult.action}`);
                throw new Error("IllegalAction");
        }
    } catch (error) {
        workerLog("error", "scan-worker", `Error processing message: ${error}`);
        postMessage({
            type: "error",
            requestId: parsedResult?.requestId,
            error,
        });
    }
});

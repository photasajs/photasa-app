import { parentPort } from "worker_threads";
import type { ScanAction } from "@common/scan-types";
import { scanPhotos } from "./scan-photos";
import { loggers } from "@common/logger";
import isImage from "is-image";
import isVideo from "is-video";
import fs from "fs-extra";
import path from "path";
import { buildThumbnailPath, normalizePath } from "@shared/path-util";
import { shouldProcessFile } from "./scan-strategy";
import { addToPhotasaConfig, removeFromPhotoList } from "../config/config-storage";
import { WorkerPool } from "../workers/worker-pool";
import type { ThumbnailRequest, ThumbnailResponse } from "@common/thumbnail-types";
import createWorker from "../thumbnail/thumbnail-worker?nodeWorker";
import type { WorkerOptions } from "worker_threads";

const logger = loggers.scan;

const port = parentPort;
if (!port) {
    throw new Error("IllegalState");
}

// 日志查看器状态
let logViewerActive = false;

// 包装日志函数以支持日志查看器
function workerLog(level: "debug" | "info" | "warn" | "error", category: string, message: string) {
    // 正常输出到控制台
    logger[level](message);

    // 仅在日志查看器激活时上报
    if (logViewerActive && port) {
        port.postMessage({
            type: "worker:log",
            entry: {
                timestamp: new Date().toISOString(),
                level,
                category,
                message,
                source: "worker",
                threadId: "scan-worker",
            },
        });
    }
}

// Thumbnail worker configuration
const THUMBNAIL_WORKER_CONFIG = {
    minWorkers: 2,
    maxWorkers: 4,
    createWorker: (options?: unknown) => {
        return createWorker({
            ...(options as WorkerOptions),
            env: {
                ...process.env,
                APP_PATH: process.env.APP_PATH || process.cwd(),
            },
        });
    },
};

let workerPoolInstance: WorkerPool<ThumbnailRequest, ThumbnailResponse> | null = null;

function getWorkerPool(): WorkerPool<ThumbnailRequest, ThumbnailResponse> {
    if (!workerPoolInstance) {
        workerPoolInstance = new WorkerPool(THUMBNAIL_WORKER_CONFIG, logger);
    }
    return workerPoolInstance;
}

/**
 * 发送消息
 * @param message - 消息
 */
function postMessage(message): void {
    // Only log message type and requestId to avoid logging large objects
    workerLog(
        "debug",
        "scan-worker",
        `Posting message: type=${message.type}, requestId=${message.requestId}`,
    );
    port?.postMessage(message);
}

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

    scanPhotos(scan, logger).subscribe({
        next: (action) => {
            processed++;
            if (action && action.path && action.isDirectory) {
                foundPaths.push(action.path);
            }

            // 尝试从缓存文件读取真实的增量缓存统计信息
            let progressData = { processed, total: 0 };

            if (scan.operationType === "directory") {
                try {
                    const cacheFilePath = path.join(scan.path, ".photasa-folder.json");
                    if (fs.existsSync(cacheFilePath)) {
                        const cacheContent = fs.readFileSync(cacheFilePath, "utf8");
                        const cache = JSON.parse(cacheContent);

                        if (cache && cache.processedFiles && Array.isArray(cache.processedFiles)) {
                            const processedCount = cache.processedFiles.length;
                            const pendingCount = cache.pendingFiles ? cache.pendingFiles.length : 0;

                            progressData = {
                                processed: processedCount,
                                total: processedCount + pendingCount,
                            };

                            workerLog(
                                "debug",
                                "scan-worker",
                                `Cache stats from file: processed=${processedCount}, total=${processedCount + pendingCount}`,
                            );
                        }
                    }
                } catch (error) {
                    workerLog(
                        "debug",
                        "scan-worker",
                        `Could not read cache file for progress: ${error}`,
                    );
                    // 使用基础计数器作为后备
                    progressData = { processed, total: 0 };
                }
            }

            postMessage({
                type: "progress",
                requestId,
                action: { path: scan.path, isDirectory: true }, // Use scan folder path for UI matching
                progress: progressData,
                currentFile: action?.path ? path.basename(action.path) : undefined, // 添加当前处理的文件名
            });
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

async function executeFileOperation(requestId: string, scan: ScanAction): Promise<void> {
    const filePath = scan.path;
    workerLog("debug", "scan-worker", `Executing file operation: ${scan.action} for ${filePath}`);

    try {
        const isMediaFile = isImage(filePath) || isVideo(filePath);

        if (!isMediaFile) {
            // Non-media file, complete immediately
            postMessage({
                type: "complete",
                requestId,
                action: { path: filePath, isDirectory: false },
            });
            return;
        }

        // Process media file based on action type
        await processMediaFile(filePath, scan);

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

async function processMediaFile(filePath: string, scan: ScanAction): Promise<void> {
    // 使用统一的路径处理API规范化路径
    const normalizedFilePath = normalizePath(filePath);
    const thumbnailPath = buildThumbnailPath(normalizedFilePath);
    const workerPool = getWorkerPool();

    switch (scan.action) {
        case "scan":
            // Add operation: create thumbnail if needed and add to config
            const shouldProcess = await shouldProcessFile(normalizedFilePath, scan.action, logger);
            if (!shouldProcess) {
                return;
            }

            const thumbnailExists = fs.existsSync(thumbnailPath);
            if (!thumbnailExists) {
                await workerPool.addTask("create", {
                    path: normalizedFilePath,
                    thumbnail: thumbnailPath,
                    width: scan.thumbnailSize,
                    height: scan.thumbnailSize,
                    withoutEnlargement: true,
                    preview: thumbnailPath,
                    always: false,
                });
            }

            await addToPhotasaConfig(
                {
                    queueId: 0,
                    paths: [normalizedFilePath],
                },
                () => {},
                logger,
            );
            break;

        case "rescan":
            // Change operation: recreate thumbnail and update config
            await workerPool.addTask("create", {
                path: normalizedFilePath,
                thumbnail: thumbnailPath,
                width: scan.thumbnailSize,
                height: scan.thumbnailSize,
                withoutEnlargement: true,
                preview: thumbnailPath,
                always: true, // Always recreate for change operations
            });

            await addToPhotasaConfig(
                {
                    queueId: 0,
                    paths: [normalizedFilePath],
                },
                () => {},
                logger,
            );
            break;

        case "current":
            // Delete operation: remove thumbnail and remove from config
            if (fs.existsSync(thumbnailPath)) {
                await fs.unlink(thumbnailPath);
            }

            await removeFromPhotoList(filePath, logger);
            break;

        default:
            workerLog("warn", "scan-worker", `Unknown scan action: ${scan.action} for ${filePath}`);
    }
}

port.on("message", async (message: any) => {
    // 处理日志查看器状态消息
    if (message.type === "log:viewer-status") {
        logViewerActive = message.active;
        workerLog(
            "debug",
            "scan-worker",
            `Log viewer ${logViewerActive ? "activated" : "deactivated"}`,
        );
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

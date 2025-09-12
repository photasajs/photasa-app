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
import { getAppPath } from "@shared/path-util";
import { app } from "electron";
import type { WorkerOptions } from "worker_threads";

const logger = loggers.worker;

const port = parentPort;
if (!port) {
    throw new Error("IllegalState");
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
                APP_PATH: getAppPath(app),
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
    logger.debug(`Worker posting message: type=${message.type}, requestId=${message.requestId}`);
    port?.postMessage(message);
}

export async function execute(requestId: string, scan: ScanAction): Promise<void> {
    logger.debug(
        `Worker executing: requestId=${requestId}, path=${scan.path}, operationType=${scan.operationType}`,
    );

    try {
        // Route based on operation type
        if (scan.operationType === "file") {
            await executeFileOperation(requestId, scan);
        } else {
            executeDirectoryScan(requestId, scan);
        }
    } catch (error) {
        logger.error("Error in execute:", error);
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

                            logger.debug(
                                `Cache stats from file: processed=${processedCount}, total=${processedCount + pendingCount}`,
                            );
                        }
                    }
                } catch (error) {
                    logger.debug("Could not read cache file for progress:", error);
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
            logger.error(`[executeDirectoryScan] 增量缓存目录扫描失败: ${scan.path}`, error);
            postMessage({
                type: "error",
                requestId,
                error,
            });
        },
        complete: () => {
            logger.info(
                `[executeDirectoryScan] 增量缓存目录扫描完成: ${scan.path}, 总共处理 ${processed} 个文件`,
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
    logger.debug(`Executing file operation: ${scan.action} for ${filePath}`);

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
        logger.error("Error processing media file:", error);
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
            logger.warn(`Unknown scan action: ${scan.action} for ${filePath}`);
    }
}

port.on("message", async (message) => {
    let parsedResult;
    try {
        parsedResult = message;
        logger.debug(
            `Worker received message: action=${parsedResult.action}, requestId=${parsedResult.requestId || "N/A"}`,
        );
        switch (parsedResult.action) {
            case "scan":
                logger.debug(`Starting scan for request: ${parsedResult.requestId}`);
                await execute(parsedResult.requestId, parsedResult.scan);
                return;
            default:
                logger.error("Unknown action:", parsedResult.action);
                throw new Error("IllegalAction");
        }
    } catch (error) {
        logger.error("Error processing message:", error);
        postMessage({
            type: "error",
            requestId: parsedResult?.requestId,
            error,
        });
    }
});

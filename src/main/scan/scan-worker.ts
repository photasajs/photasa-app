import { parentPort } from "worker_threads";
import type { ScanAction } from "@common/scan-types";
import { scanPhotos } from "./scan-photos";
import { loggers } from "@common/logger";
import isImage from "is-image";
import isVideo from "is-video";
import fs from "fs-extra";
import { buildThumbnailPath } from "@shared/path-util";
import { shouldProcessFile } from "./scan-photos";
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
            postMessage({
                type: "progress",
                requestId,
                action,
                progress: { processed, total: 0 },
            });
        },
        error: (error) => {
            logger.error("Directory scan failed:", error);
            postMessage({
                type: "error",
                requestId,
                error,
            });
        },
        complete: () => {
            logger.debug("Directory scan completed successfully");
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
    const thumbnailPath = buildThumbnailPath(filePath);
    const workerPool = getWorkerPool();

    switch (scan.action) {
        case "scan":
            // Add operation: create thumbnail if needed and add to config
            const shouldProcess = await shouldProcessFile(filePath, scan.action);
            if (!shouldProcess) {
                return;
            }

            const thumbnailExists = fs.existsSync(thumbnailPath);
            if (!thumbnailExists) {
                await workerPool.addTask("create", {
                    path: filePath,
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
                    paths: [filePath],
                },
                () => {},
                logger,
            );
            break;

        case "rescan":
            // Change operation: recreate thumbnail and update config
            await workerPool.addTask("create", {
                path: filePath,
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
                    paths: [filePath],
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

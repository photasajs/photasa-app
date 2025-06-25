import klaw from "klaw";
import { Observable, Subscriber, concatMap } from "rxjs";
import isImage from "is-image";
import isVideo from "is-video";
import { shouldIgnorePhotasaPath, isHiddenFile } from "../common";
import type { PhotoPath, ScanAction } from "@common/types";
import { addToPhotasaConfig, getPhotasaConfig } from "./config/config-storage";
import type { Logger } from "log4js";
import { buildThumbnailPath } from "../common";
import fs from "fs-extra";
import path from "path";
import { WorkerPool } from "./worker-pool";
import log4js from "log4js";
import createWorker from "./workers/thumbnail-worker?nodeWorker";

const THUMBNAIL_WORKER_CONFIG = {
    minWorkers: 2,
    maxWorkers: 4,
    createWorker: (options?: unknown) => createWorker(options as WorkerOptions),
};

let workerPool: WorkerPool | null = null;

function initializeWorkerPool(logger: Logger): WorkerPool {
    if (!workerPool) {
        workerPool = new WorkerPool(THUMBNAIL_WORKER_CONFIG, logger);
    }
    return workerPool;
}

/**
 * Whether only scan current folder or scan all sub folders.
 */
function shouldScanOneLevel(action: string): boolean {
    return action == "current" || action == "rescan" || action == "scan";
}

/**
 * Check if a file needs to be processed based on its existence in the config
 */
async function shouldProcessFile(filePath: string, action: string): Promise<boolean> {
    // Always process for rescan
    if (action === "rescan") {
        return true;
    }

    // Check if .photasa.json exists
    const dir = path.dirname(filePath);
    const configPath = path.join(dir, ".photasa.json");

    if (!fs.existsSync(configPath)) {
        return true;
    }

    // Check if file is already in config
    const logger: Logger = log4js.getLogger("scan-photos");
    const config = await getPhotasaConfig(dir, logger);
    const fileName = path.basename(filePath);
    return !config.photoList.some((photo) => photo.path === fileName);
}

/**
 * Walk through files in a folder and ignore hidden files, photasa files and sub folders.
 */
export function walkthroughPhotos(source: ScanAction): Observable<PhotoPath> {
    return new Observable<PhotoPath>((subscriber: Subscriber<PhotoPath>) => {
        // Only scan current folder
        const option = {
            depthLimit: shouldScanOneLevel(source.action) ? 0 : -1,
            filter: (item: string): boolean => {
                return (
                    !shouldIgnorePhotasaPath(item) && // Skip ignored path
                    !isHiddenFile(item) // Skip hidden file
                );
            },
        };
        klaw(source.path, option)
            .on("data", (item) => {
                const video = isVideo(item.path);
                const image = isImage(item.path);
                if (
                    !item.stats.isDirectory() && // Skip directory
                    item.path !== source.path && //  Skip self
                    (video || image) // Skip non image or video
                ) {
                    subscriber.next({
                        path: item.path,
                        thumbnail: buildThumbnailPath(item.path),
                        isImage: image,
                        isVideo: video,
                    });
                }
            })
            .on("end", () => {
                subscriber.complete();
            });
    });
}

export function scanPhotos(scan: ScanAction, logger: Logger): Observable<PhotoPath> {
    const workerPool = initializeWorkerPool(logger);

    return walkthroughPhotos(scan).pipe(
        concatMap(async (action: PhotoPath) => {
            // Check if file needs processing
            const shouldProcess = await shouldProcessFile(action.path, scan.action);
            if (!shouldProcess) {
                logger.debug(`Skipping ${action.path} - already in config`);
                return action;
            }

            // Check if thumbnail exists
            const thumbnailExists = fs.existsSync(action.thumbnail);
            if (!thumbnailExists || scan.action === "rescan") {
                logger.debug(`Creating thumbnail for ${action.path}`);
                await workerPool.addTask({
                    file: action.path,
                    size: scan.thumbnailSize,
                    quality: 80,
                });
            } else {
                logger.debug(`Using existing thumbnail for ${action.path}`);
            }

            // Add to config
            await addToPhotasaConfig(
                {
                    queueId: 0,
                    paths: [action.path],
                },
                (msg) => logger.debug("Config update:", msg),
                logger,
            );

            return action;
        }),
    );
}

// Cleanup function to be called when the app is shutting down
export async function cleanup(): Promise<void> {
    if (workerPool) {
        await workerPool.shutdown();
        workerPool = null;
    }
}

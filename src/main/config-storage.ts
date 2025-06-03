/*
 * config-storage.ts
 *
 * This module manages the reading, writing, and updating of the .photasa.json configuration files
 * for photo and video management. It provides functions to add, remove, batch process, and fix
 * photo entries, as well as to handle concurrency and error reporting for bulk operations.
 */

import fs from "fs-extra";
import path from "path";
import type { PhotasaConfig, PhotasaConfigResult } from "../preload/types";
import * as R from "ramda";
import { toRelativeThumbnailPath, toFileName, shortenThumbnailName } from "../common";
import { Logger } from "log4js";
import { concatMap, from } from "rxjs";
import isVideo from "is-video";
import { debounce } from "lodash";

// Types for improved type safety
interface QueueItem {
    queueId: number;
    paths: string[];
}

interface ConfigMetadata {
    data: string;
    dir: string;
}

const PHOTASA_VERSION = "1.0";
const QUEUE_CONCURRENCY = 6; // Increased from 4 to 6 for better throughput
const QUEUE_BREAK_THRESHOLD = 100; // Increased from 60 to handle larger batches
const DEBOUNCE_DELAY = 50; // Reduced from 100ms to process faster
const QUEUE_TIMEOUT = 60000; // Keep 1 minute timeout
const QUEUE_INTERVAL = 250; // Reduced from 500ms to process more frequently
const QUEUE_INTERVAL_CAP = 60; // Increased from 40 to process more tasks per interval

/**
 * Ensures the .photasa.json config file exists for a given photo or directory.
 * Returns the path to the config file.
 */
async function ensureConfig(photo: string, isFile: boolean): Promise<string> {
    const dir = isFile ? path.dirname(photo) : photo;
    const configPath = path.join(dir, ".photasa.json");
    await fs.ensureFile(configPath);
    return configPath;
}

/**
 * Reads the .photasa.json config file for a given photo or directory.
 * Returns the file contents and directory.
 */
async function readConfig(photo: string, isFile: boolean): Promise<ConfigMetadata> {
    const dir = await ensureConfig(photo, isFile);
    const data = (await fs.readFile(dir, "utf-8")) ?? "{}";
    return {
        dir,
        data: data ? data : "{}",
    };
}

/**
 * Writes the PhotasaConfig object to the specified config file path.
 * Updates the lastModified timestamp.
 */
async function writeConfig(configPath: string, photoConfig: PhotasaConfig): Promise<void> {
    photoConfig.lastModified = Date.now();
    const data = JSON.stringify(photoConfig, null, 4);
    await fs.writeFile(configPath, data, { encoding: "utf8", flag: "w" });
}

/**
 * Safely parses a JSON string into a PhotasaConfig object.
 * Returns an empty config if parsing fails.
 */
function fromJson(data: string): PhotasaConfig {
    try {
        return <PhotasaConfig>JSON.parse(data);
    } catch {
        return <PhotasaConfig>{};
    }
}

/**
 * Ensures the config object has required fields and sets defaults if missing.
 */
function normalizeConfig(config: PhotasaConfig): PhotasaConfig {
    if (!config.photoList) {
        config.photoList = [];
    }
    if (!config.version) {
        config.version = PHOTASA_VERSION;
    }
    return config;
}

// Compose parsing and normalization for config loading
const parseConfig = R.compose(normalizeConfig, fromJson);

/**
 * Batch add multiple photo paths to the .photasa.json config for a parent directory.
 * Updates or creates photo entries as needed.
 */
export async function batchAddToPhotoList(
    parent: string,
    photoPaths: string[],
): Promise<PhotasaConfigResult> {
    const meta = await readConfig(parent, false);
    const photasaConfig = parseConfig(meta.data);

    photoPaths.forEach((photoPath) => {
        const fileName = toFileName(photoPath);
        const photo = photasaConfig.photoList.find((p) => p.path === fileName);
        const thumbnailName = toRelativeThumbnailPath(photoPath);
        if (!photo) {
            photasaConfig.photoList.push({
                path: fileName,
                thumbnail: thumbnailName,
                history: [],
                isVideo: isVideo(fileName),
            });
        } else if (!photo.thumbnail) {
            photo.thumbnail = thumbnailName;
        }
    });

    await writeConfig(meta.dir, photasaConfig);

    return {
        path: meta.dir,
        config: photasaConfig,
    };
}

/**
 * Add a single photo to its corresponding .photasa.json config file.
 * If the photo already exists, updates its thumbnail if missing.
 */
export const addToPhotoList = debounce(async (photoPath: string): Promise<PhotasaConfigResult> => {
    const meta = await readConfig(photoPath, true);
    const photasaConfig = parseConfig(meta.data);

    const fileName = toFileName(photoPath);
    const photo = photasaConfig.photoList.find((p) => p.path === fileName);
    const thumbnailName = toRelativeThumbnailPath(photoPath);
    if (!photo) {
        photasaConfig.photoList.push({
            path: fileName,
            thumbnail: thumbnailName,
            history: [],
            isVideo: isVideo(fileName),
        });
        await writeConfig(meta.dir, photasaConfig);
    } else if (!photo.thumbnail) {
        photo.thumbnail = thumbnailName;
        await writeConfig(meta.dir, photasaConfig);
    }
    return {
        path: meta.dir,
        config: photasaConfig,
    };
}, DEBOUNCE_DELAY);

/**
 * Remove a photo from its .photasa.json config file.
 * If the photo is not found, does nothing.
 */
export async function removeFromPhotoList(photoPath: string): Promise<PhotasaConfigResult> {
    const meta = await readConfig(photoPath, true);
    const photasaConfig = parseConfig(meta.data);

    const fileName = toFileName(photoPath);
    const photoIndex = photasaConfig.photoList.findIndex((p) => p.path === fileName);

    if (photoIndex >= 0) {
        photasaConfig.photoList.splice(photoIndex, 1);
        await writeConfig(meta.dir, photasaConfig);
    }
    return {
        path: meta.dir,
        config: photasaConfig,
    };
}

/**
 * Loads the PhotasaConfig for a given folder.
 */
export async function getPhotasaConfig(folder: string): Promise<PhotasaConfig> {
    const meta = await readConfig(folder, false);
    return parseConfig(meta.data);
}

/**
 * Resets the photo list in the .photasa.json config for a folder.
 * Leaves other config fields intact.
 */
export async function resetPhotasaConfig(folder: string): Promise<PhotasaConfig> {
    const meta = await readConfig(folder, false);
    const photasaConfig = parseConfig(meta.data);
    photasaConfig.photoList = [];
    await writeConfig(meta.dir, photasaConfig);
    return photasaConfig;
}

/**
 * Fixes the paths and thumbnail names in the .photasa.json config for a folder.
 * Useful for migration or correcting legacy data.
 */
export async function fixPhotasaConfig(folder: string): Promise<PhotasaConfig> {
    const meta = await readConfig(folder, false);
    const config = parseConfig(meta.data);

    config.photoList.forEach((photo) => {
        photo.path = toFileName(photo.path);
        photo.thumbnail = shortenThumbnailName(photo.thumbnail);
    });

    await writeConfig(meta.dir, config);

    return config;
}

// --- Bulk Add Queue and Task Management ---

// Queue for pending add operations, grouped by directory
let addPathQueue: Record<string, string[]> = {};
let lastQueuedCount = 0;

// Create a queue with concurrency control and backpressure
let queue: any = null;

async function initializeQueue() {
    const PQueue = (await import("p-queue")).default;
    queue = new PQueue({
        concurrency: QUEUE_CONCURRENCY,
        autoStart: true,
        intervalCap: QUEUE_INTERVAL_CAP,
        interval: QUEUE_INTERVAL,
        timeout: QUEUE_TIMEOUT,
        throwOnTimeout: false, // Don't crash on timeout
    });
    return queue;
}

// Monitor queue size and emit events
let queueLogger: Logger | null = null;

function setupQueueEvents(logger: Logger): void {
    queueLogger = logger;
    queue.on("idle", () => {
        queueLogger?.info("config-queue", {
            action: "idle",
            timestamp: Date.now(),
            queueSize: queue.size,
            pending: queue.pending,
            isPaused: queue.isPaused,
        });
    });

    queue.on("error", (error) => {
        queueLogger?.error("config-queue", {
            action: "error",
            error: error.message,
            timestamp: Date.now(),
            queueSize: queue.size,
            pending: queue.pending,
        });
        // Don't crash, just log the error and continue
        queue.start(); // Restart queue if it was paused
    });

    queue.on("add", () => {
        queueLogger?.debug("config-queue", {
            action: "add",
            size: queue.size,
            pending: queue.pending,
            timestamp: Date.now(),
            isPaused: queue.isPaused,
        });
    });

    queue.on("active", () => {
        queueLogger?.debug("config-queue", {
            action: "active",
            size: queue.size,
            pending: queue.pending,
            timestamp: Date.now(),
            isPaused: queue.isPaused,
        });
    });

    queue.on("completed", (result) => {
        queueLogger?.debug("config-queue", {
            action: "completed",
            size: queue.size,
            pending: queue.pending,
            timestamp: Date.now(),
            isPaused: queue.isPaused,
        });
    });
}

/**
 * Returns the total number of files currently waiting in the add queue.
 */
function waitedFilesCount(): number {
    return Object.entries<string[]>(addPathQueue).reduce((acc, entry) => acc + entry[1].length, 0);
}

/**
 * Internal: Processes the add queue, batching files by directory and updating configs.
 * Notifies via postMessage and logs progress/errors.
 */
function addConfig(
    request: QueueItem,
    logger: Logger,
    postMessage: (message: string) => void,
    done: () => void,
): void {
    const queued = Object.entries<string[]>(addPathQueue);
    addPathQueue = {};
    const totalFiles = queued.reduce((acc, entry) => acc + entry[1].length, 0);

    if (totalFiles > 0) {
        logger.info("config-update", {
            action: "add",
            photoCount: totalFiles,
            queueSize: waitedFilesCount(),
            timestamp: Date.now(),
        });
    }

    from(queued)
        .pipe(concatMap(([key, value]) => batchAddToPhotoList(key, value)))
        .subscribe({
            next: (result: PhotasaConfigResult) => {
                postMessage(
                    JSON.stringify({
                        action: "next",
                        queueId: request.queueId,
                        from: "add",
                        ...result,
                    }),
                );
            },
            error: (err) => {
                logger.error("config-error", {
                    action: "error",
                    error: err.message,
                    timestamp: Date.now(),
                });
                postMessage(
                    JSON.stringify({
                        action: "error",
                        queueId: request.queueId,
                        from: "add",
                        err,
                    }),
                );
                done();
            },
            complete: () => {
                postMessage(
                    JSON.stringify({
                        action: "complete",
                        queueId: request.queueId,
                        from: "add",
                    }),
                );
                // Write to disk is time consuming, so we delay the notification so we can handle more saving
                const handlerId = setInterval(() => {
                    const count = waitedFilesCount();
                    if (count > 0) {
                        logger.info("config-queue", {
                            action: "waiting",
                            count,
                            timestamp: Date.now(),
                        });
                    }
                    // if count isn't changed then process it
                    if (count >= QUEUE_BREAK_THRESHOLD || count === lastQueuedCount) {
                        lastQueuedCount = 0;
                        clearInterval(handlerId);
                        done();
                    } else {
                        lastQueuedCount = count;
                    }
                }, config.DELAY_NOTIFY_DONE);
            },
        });
}

/**
 * Public API: Adds multiple photo paths to their respective configs in a queued, batched manner.
 * Notifies via postMessage and logs progress/errors.
 */
export function addToPhotasaConfig(
    request: QueueItem,
    postMessage: (message: string) => void,
    logger: Logger,
): void {
    // Setup queue events if not already done
    if (!queueLogger) {
        setupQueueEvents(logger);
    }

    request.paths.forEach((p) => {
        const dir = path.dirname(p);
        addPathQueue[dir] = addPathQueue[dir] || [];
        addPathQueue[dir].push(p);
    });

    // Initialize queue if not already done
    if (!queue) {
        initializeQueue().then((q) => {
            queue = q;
            addTaskToQueue(request, postMessage, logger);
        });
    } else {
        addTaskToQueue(request, postMessage, logger);
    }
}

function addTaskToQueue(
    request: QueueItem,
    postMessage: (message: string) => void,
    logger: Logger,
): void {
    // Add task to queue with priority based on queue size
    const priority = queue.size > 100 ? 1 : 0; // Higher priority for larger queues
    queue.add(
        () => {
            return new Promise<void>((resolve) => {
                addConfig(request, logger, postMessage, resolve);
            });
        },
        { priority },
    );
}

/**
 * Cleans up the queue for a removed folder and its subdirectories
 */
export function cleanupQueueForFolder(folderPath: string): void {
    // Remove all queued paths that are under the removed folder
    Object.keys(addPathQueue).forEach((dir) => {
        if (dir.startsWith(folderPath)) {
            delete addPathQueue[dir];
        }
    });

    // Clear the last queued count to ensure proper queue processing
    lastQueuedCount = 0;
}

export const config = {
    DELAY_NOTIFY_DONE: 3000,
};

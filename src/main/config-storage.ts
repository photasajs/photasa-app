/*
 * config-storage.ts
 *
 * This module manages the reading, writing, and updating of the .photasa.json configuration files
 * for photo and video management. It provides functions to add, remove, batch process, and fix
 * photo entries, as well as to handle concurrency and error reporting for bulk operations.
 */

import fs from "node:fs/promises";
import path from "path";
import type { PhotasaConfig, PhotasaConfigResult } from "@common/types";
import * as R from "ramda";
import { toRelativeThumbnailPath, toFileName, shortenThumbnailName } from "../common";
import { Logger } from "log4js";
import { concatMap, from } from "rxjs";
import isVideo from "is-video";
import { debounce } from "lodash";
import { FileSystemError, ConfigError, handleError, retryOperation } from "@common/error-handler";

// Add cache for config files with TTL
const configCache = new Map<string, { config: PhotasaConfig; timestamp: number }>();
const CACHE_TTL = 5000; // Cache for 5 seconds

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
const QUEUE_CONCURRENCY = 10; // Increased from 6 to 10 for better throughput
const QUEUE_BREAK_THRESHOLD = 200; // Increased from 100 to handle larger batches
const DEBOUNCE_DELAY = 30; // Reduced from 50ms to process faster
const QUEUE_TIMEOUT = 60000; // Keep 1 minute timeout
const QUEUE_INTERVAL = 100; // Reduced from 250ms to process more frequently
const QUEUE_INTERVAL_CAP = 100; // Increased from 60 to process more tasks per interval

// Add write batching
const writeBatch = new Map<string, { data: string; timestamp: number }>();
const WRITE_BATCH_INTERVAL = 100; // Batch writes every 100ms

// Add read batching
const readBatch = new Map<string, Promise<ConfigMetadata>>();
const READ_BATCH_INTERVAL = 50; // Batch reads every 50ms

/**
 * Ensures the .photasa.json config file exists for a given photo or directory.
 * Returns the path to the config file.
 */
async function ensureConfig(photo: string, isFile: boolean, logger: Logger): Promise<string> {
    const dir = isFile ? path.dirname(photo) : photo;
    const configPath = path.join(dir, ".photasa.json");
    try {
        await fs.access(configPath);
    } catch (error) {
        logger.warn(`[ensureConfig] 配置文件不存在，自动创建: ${configPath}`);
        try {
            await fs.writeFile(configPath, "{}", "utf8");
            logger.info(`[ensureConfig] 已自动创建空配置文件: ${configPath}`);
        } catch (writeError) {
            logger.error(`[ensureConfig] 创建配置文件失败: ${configPath}`, writeError);
            throw handleError(
                new FileSystemError(`Failed to create config file at ${configPath}`, {
                    error: writeError,
                }),
                logger,
                "ensureConfig",
            );
        }
    }
    return configPath;
}

/**
 * Batched write operation that combines multiple writes into a single operation
 */
async function batchedWrite(logger: Logger): Promise<void> {
    if (writeBatch.size === 0) return;

    const batch = Array.from(writeBatch.entries());
    writeBatch.clear();

    // Group writes by directory to reduce disk operations
    const dirGroups = new Map<string, string[]>();
    for (const [filePath, { data }] of batch) {
        const dir = path.dirname(filePath);
        if (!dirGroups.has(dir)) {
            dirGroups.set(dir, []);
        }
        dirGroups.get(dir)?.push(data);
    }

    // Write each directory's files in parallel
    await Promise.all(
        Array.from(dirGroups.entries()).map(async ([dir, dataArray]) => {
            try {
                await retryOperation(
                    () => fs.writeFile(dir, dataArray.join("\n"), { encoding: "utf8", flag: "w" }),
                    3,
                    1000,
                    logger,
                    "batchedWrite",
                );
            } catch (error) {
                handleError(
                    new FileSystemError(`Error writing to ${dir}`, { error }),
                    logger,
                    "batchedWrite",
                );
            }
        }),
    );
}

/**
 * Batched read operation that combines multiple reads into a single operation
 */
async function batchedRead(path: string, logger: Logger): Promise<ConfigMetadata> {
    if (readBatch.has(path)) {
        return readBatch.get(path) || { dir: "", data: "{}" };
    }

    const promise = (async () => {
        const dir = await ensureConfig(path, true, logger);

        // Check cache first
        const cached = configCache.get(dir);
        if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
            return {
                dir,
                data: JSON.stringify(cached.config),
            };
        }

        let data = "{}";
        try {
            data = await retryOperation(
                () => fs.readFile(dir, "utf-8"),
                3,
                1000,
                logger,
                "batchedRead",
            ).catch(() => "{}");
        } catch (error) {
            logger.error(`[batchedRead] 读取配置文件失败: ${dir}`, error);
            throw handleError(
                new FileSystemError(`Failed to read config file at ${dir}`, { error }),
                logger,
                "batchedRead",
            );
        }

        // 尝试解析配置，如失败则自动重建
        let config;
        try {
            config = parseConfig(data);
        } catch (parseError) {
            logger.error(`[batchedRead] 配置文件损坏，自动重建: ${dir}`, parseError);
            // 自动重建默认配置
            config = { photoList: [], version: PHOTASA_VERSION };
            await fs.writeFile(dir, JSON.stringify(config, null, 4), "utf8");
        }

        // Update cache
        configCache.set(dir, { config, timestamp: Date.now() });

        return {
            dir,
            data: JSON.stringify(config),
        };
    })();

    readBatch.set(path, promise);

    // Clear the batch after the interval
    setTimeout(() => {
        readBatch.delete(path);
    }, READ_BATCH_INTERVAL);

    return promise;
}

/**
 * Updates the readConfig function to use batched reads
 */
async function readConfig(
    photo: string,
    _isFile: boolean,
    logger: Logger,
): Promise<ConfigMetadata> {
    return batchedRead(photo, logger);
}

/**
 * Updates the writeConfig function to use batched writes
 */
async function writeConfig(
    configPath: string,
    photoConfig: PhotasaConfig,
    logger: Logger,
): Promise<void> {
    logger.info(`[writeConfig] 写入配置文件: ${configPath}`);
    photoConfig.lastModified = Date.now();
    const data = JSON.stringify(photoConfig, null, 4);
    logger.debug(`[writeConfig] 写入内容摘要: ${data.slice(0, 128)}...`);
    // Add to write batch
    writeBatch.set(configPath, { data, timestamp: Date.now() });
    // Update cache
    configCache.set(configPath, { config: photoConfig, timestamp: Date.now() });
    logger.info(`[writeConfig] 写入完成: ${configPath}`);
}

/**
 * Safely parses a JSON string into a PhotasaConfig object.
 * Returns an empty config if parsing fails.
 */
function fromJson(data: string): PhotasaConfig {
    try {
        return <PhotasaConfig>JSON.parse(data);
    } catch (error) {
        throw new ConfigError("Failed to parse config JSON", { error, data });
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
 * Batch process multiple photos to add them to the photo list.
 * Uses a queue system with concurrency control and progress tracking.
 */
export async function batchAddToPhotoList(
    photos: string[],
    logger: Logger,
    onProgress?: (progress: number) => void,
    onError?: (error: Error) => void,
): Promise<PhotasaConfigResult> {
    const startTime = Date.now();
    const total = photos.length;
    let processed = 0;
    let failed = 0;
    let lastProgressUpdate = 0;
    let lastResult: PhotasaConfigResult | null = null;

    // Process photos in chunks for better performance
    const chunkSize = QUEUE_CONCURRENCY * 2;
    for (let i = 0; i < photos.length; i += chunkSize) {
        const chunk = photos.slice(i, i + chunkSize);
        await Promise.allSettled(
            chunk.map(async (photo) => {
                try {
                    const result = await addToPhotoList(photo, logger);
                    lastResult = result;
                    processed++;

                    // Update progress less frequently for better performance
                    const now = Date.now();
                    if (now - lastProgressUpdate > 100) {
                        // Update every 100ms
                        lastProgressUpdate = now;
                        onProgress?.(processed / total);
                    }
                    return result;
                } catch (error) {
                    failed++;
                    onError?.(error as Error);
                    throw error;
                }
            }),
        );

        // Check for timeout
        if (Date.now() - startTime > QUEUE_TIMEOUT) {
            throw new ConfigError(`Batch processing timed out after ${QUEUE_TIMEOUT}ms`, {
                processed,
                failed,
                total,
            });
        }
    }

    // Final progress update
    onProgress?.(1);

    // Return the last successful result or throw if no successful results
    if (!lastResult) {
        throw new ConfigError("No successful results in batch processing", {
            processed,
            failed,
            total,
        });
    }
    return lastResult;
}

/**
 * Add a single photo to its corresponding .photasa.json config file.
 * If the photo already exists, updates its thumbnail if missing.
 */
export const addToPhotoList = debounce(
    async (photoPath: string, logger: Logger): Promise<PhotasaConfigResult> => {
        try {
            const meta = await readConfig(photoPath, true, logger);
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
                await writeConfig(meta.dir, photasaConfig, logger);
            } else if (!photo.thumbnail) {
                photo.thumbnail = thumbnailName;
                await writeConfig(meta.dir, photasaConfig, logger);
            }
            return {
                path: meta.dir,
                config: photasaConfig,
            };
        } catch (error) {
            throw handleError(
                new ConfigError(`Failed to add photo to list: ${photoPath}`, { error }),
                logger,
                "addToPhotoList",
            );
        }
    },
    DEBOUNCE_DELAY,
);

/**
 * Remove a photo from its .photasa.json config file.
 * If the photo is not found, does nothing.
 */
export async function removeFromPhotoList(
    photoPath: string,
    logger: Logger,
): Promise<PhotasaConfigResult> {
    try {
        const meta = await readConfig(photoPath, true, logger);
        const photasaConfig = parseConfig(meta.data);

        const fileName = toFileName(photoPath);
        const photoIndex = photasaConfig.photoList.findIndex((p) => p.path === fileName);

        if (photoIndex >= 0) {
            photasaConfig.photoList.splice(photoIndex, 1);
            await writeConfig(meta.dir, photasaConfig, logger);
        }
        return {
            path: meta.dir,
            config: photasaConfig,
        };
    } catch (error) {
        throw handleError(
            new ConfigError(`Failed to remove photo from list: ${photoPath}`, { error }),
            logger,
            "removeFromPhotoList",
        );
    }
}

/**
 * Loads the PhotasaConfig for a given folder.
 */
export async function getPhotasaConfig(folder: string, logger: Logger): Promise<PhotasaConfig> {
    try {
        logger.debug(`[getPhotasaConfig] 读取配置: ${folder}`);
        const meta = await readConfig(folder, false, logger);
        return parseConfig(meta.data);
    } catch (error) {
        logger.error(`[getPhotasaConfig] 读取配置失败: ${folder}`, error);
        throw handleError(
            new ConfigError(`Failed to get config for folder: ${folder}`, { error }),
            logger,
            "getPhotasaConfig",
        );
    }
}

/**
 * Resets the photo list in the .photasa.json config for a folder.
 * Leaves other config fields intact.
 */
export async function resetPhotasaConfig(folder: string, logger: Logger): Promise<PhotasaConfig> {
    try {
        const meta = await readConfig(folder, false, logger);
        const photasaConfig = parseConfig(meta.data);
        photasaConfig.photoList = [];
        await writeConfig(meta.dir, photasaConfig, logger);
        return photasaConfig;
    } catch (error) {
        throw handleError(
            new ConfigError(`Failed to reset config for folder: ${folder}`, { error }),
            logger,
            "resetPhotasaConfig",
        );
    }
}

/**
 * Fixes the paths and thumbnail names in the .photasa.json config for a folder.
 * Useful for migration or correcting legacy data.
 */
export async function fixPhotasaConfig(folder: string, logger: Logger): Promise<PhotasaConfig> {
    try {
        const meta = await readConfig(folder, false, logger);
        const config = parseConfig(meta.data);

        config.photoList.forEach((photo) => {
            photo.path = toFileName(photo.path);
            photo.thumbnail = shortenThumbnailName(photo.thumbnail);
        });

        await writeConfig(meta.dir, config, logger);

        return config;
    } catch (error) {
        throw handleError(
            new ConfigError(`Failed to fix config for folder: ${folder}`, { error }),
            logger,
            "fixPhotasaConfig",
        );
    }
}

// --- Bulk Add Queue and Task Management ---

// Queue for pending add operations, grouped by directory
let addPathQueue: Record<string, string[]> = {};
let lastQueuedCount = 0;

// Create a queue with concurrency control and backpressure
let queue: any = null;

async function initializeQueue(logger: Logger) {
    try {
        const PQueue = (await import("p-queue")).default;
        const newQueue = new PQueue({
            concurrency: QUEUE_CONCURRENCY,
            autoStart: true,
            intervalCap: QUEUE_INTERVAL_CAP,
            interval: QUEUE_INTERVAL,
            timeout: QUEUE_TIMEOUT,
            throwOnTimeout: false, // Don't crash on timeout
        });
        return newQueue;
    } catch (error) {
        throw handleError(
            new ConfigError("Failed to initialize queue", { error }),
            logger,
            "initializeQueue",
        );
    }
}

// Monitor queue size and emit events
let queueLogger: Logger | null = null;

// 节流工具函数：每 key 每 interval 只允许一次输出
const eventThrottleMap: Record<string, number> = {};
function throttleLog(key: string, interval: number, logFn: () => void) {
    const now = Date.now();
    if (!eventThrottleMap[key] || now - eventThrottleMap[key] > interval) {
        eventThrottleMap[key] = now;
        logFn();
    }
}

// 记录已注册队列，防止重复注册事件
const registeredQueues = new WeakSet<any>();

function setupQueueEvents(logger: Logger, queue: any): void {
    if (!queue) {
        logger.error("Cannot setup queue events: queue is null");
        return;
    }
    // 防止重复注册
    if (registeredQueues.has(queue)) return;
    registeredQueues.add(queue);

    queueLogger = logger;
    try {
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
            handleError(new ConfigError("Queue error", { error }), queueLogger!, "queueEvents");
            // Don't crash, just log the error and continue
            queue.start(); // Restart queue if it was paused
        });

        // 高频 routine 日志节流（如每 1000ms 最多输出一次）
        queue.on("add", () => {
            throttleLog("queue-add", 1000, () => {
                queueLogger?.debug("config-queue", {
                    action: "add",
                    size: queue.size,
                    pending: queue.pending,
                    timestamp: Date.now(),
                    isPaused: queue.isPaused,
                });
            });
        });

        queue.on("active", () => {
            throttleLog("queue-active", 1000, () => {
                queueLogger?.debug("config-queue", {
                    action: "active",
                    size: queue.size,
                    pending: queue.pending,
                    timestamp: Date.now(),
                    isPaused: queue.isPaused,
                });
            });
        });
        // 其他 routine 事件可按需添加节流或关闭
    } catch (error) {
        handleError(
            new ConfigError("Failed to setup queue events", { error }),
            logger,
            "setupQueueEvents",
        );
    }
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
        .pipe(concatMap(([, value]) => batchAddToPhotoList(value, logger)))
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
                handleError(
                    new ConfigError("Error processing add queue", { error: err }),
                    logger,
                    "addConfig",
                );
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
    request.paths.forEach((p) => {
        const dir = path.dirname(p);
        addPathQueue[dir] = addPathQueue[dir] || [];
        addPathQueue[dir].push(p);
    });

    // Initialize queue if not already done
    if (!queue) {
        initializeQueue(logger)
            .then((newQueue) => {
                queue = newQueue;
                setupQueueEvents(logger, queue);
                addTaskToQueue(request, postMessage, logger);
            })
            .catch((error) => {
                handleError(
                    new ConfigError("Failed to initialize queue", { error }),
                    logger,
                    "addToPhotasaConfig",
                );
                postMessage(
                    JSON.stringify({
                        action: "error",
                        queueId: request.queueId,
                        error: "Failed to initialize queue",
                    }),
                );
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

/**
 * Clears the config cache for a specific folder
 */
export function clearConfigCache(folderPath: string): void {
    configCache.delete(folderPath);
}

/**
 * Clears the entire config cache
 */
export function clearAllConfigCache(): void {
    configCache.clear();
}

// Start the write batch interval
setInterval(() => {
    if (queueLogger) {
        batchedWrite(queueLogger);
    }
}, WRITE_BATCH_INTERVAL);

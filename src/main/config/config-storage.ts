/*
 * config-storage.ts
 *
 * 本模块负责 .photasa.json 配置文件的读写、批量处理、照片/视频批量增删、修复、并发与错误处理等核心逻辑。
 * 提供批量添加、移除、修复、重置等操作，支持高并发队列与详细日志。
 */

import fs from "node:fs/promises";
import path from "path";
import type { PhotasaConfig, PhotasaConfigResult } from "@common/config-types";
import * as R from "ramda";
import type { PhotasaLogger } from "@common/logger";
import { shortenThumbnailName } from "@shared/path-util";
import { concatMap, from } from "rxjs";
import isVideo from "is-video";
// import { debounce } from "lodash"; // Temporarily removed for debugging
import { FileSystemError, ConfigError, handleError, retryOperation } from "@common/error-handler";
import { CACHE_TTL, configCache } from "./config-cache";
import { toRelativeThumbnailPath, toFileName } from "@shared/path-util";

export {
    getConfigCache,
    setConfigCache,
    clearConfigCache,
    clearAllConfigCache,
} from "./config-cache";

// Types for improved type safety
// 类型声明：队列项
interface QueueItem {
    queueId: number;
    paths: string[];
}

// 类型声明：配置元数据
interface ConfigMetadata {
    data: string; // 配置文件内容
    configPath: string; // 配置文件路径
}

// 配置常量
const PHOTASA_VERSION = "1.0"; // 配置文件版本
const QUEUE_CONCURRENCY = 10; // 队列并发数
const QUEUE_BREAK_THRESHOLD = 200; // 队列分批阈值
// const DEBOUNCE_DELAY = 30; // 防抖延迟 - 暂时未使用
const QUEUE_TIMEOUT = 60000; // 队列超时时间
const QUEUE_INTERVAL = 100; // 队列处理间隔
const QUEUE_INTERVAL_CAP = 100; // 队列每周期最大处理数

// 写入批处理队列
const writeBatch = new Map<string, { data: string; timestamp: number }>();
const WRITE_BATCH_INTERVAL = 100; // 写入批处理间隔

// 读取批处理队列
const readBatch = new Map<string, Promise<ConfigMetadata>>();
const READ_BATCH_INTERVAL = 50; // 读取批处理间隔

/**
 * 确保指定照片/目录下的 .photasa.json 配置文件存在，返回配置文件路径。
 * @param photo - 照片/目录路径
 * @param isFile - 是否是文件
 * @param logger - 日志记录器
 * @returns Promise<string> 配置文件路径
 */
async function ensureConfig(
    photo: string,
    isFile: boolean,
    logger: PhotasaLogger,
): Promise<string> {
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
 * 批量写入操作，将多次写入合并为一次磁盘操作。
 */
async function batchedWrite(logger: PhotasaLogger): Promise<void> {
    // 如果写入批处理为空，则直接返回
    if (writeBatch.size === 0) return;

    // 获取写入批处理 writeBatch是Map 获取 entries 每个entries就是配置文件路径
    // value 是 { data: string; timestamp: number }
    const batch = Array.from(writeBatch.entries());
    writeBatch.clear();

    // 将写入批处理按配置文件路径分组, 每个配置文件路径对应一个数组
    const dirGroups = new Map<string, string[]>();
    for (const [filePath, { data }] of batch) {
        if (!dirGroups.has(filePath)) {
            dirGroups.set(filePath, []);
        }
        dirGroups.get(filePath)?.push(data);
    }

    // Write each directory's files in parallel
    await Promise.all(
        Array.from(dirGroups.entries()).map(async ([dir, dataArray]) => {
            try {
                // 重试写入配置文件
                logger.debug(`[batchedWrite] 写入配置文件: ${dir}`);
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
 * 批量读取操作，将多次读取合并为一次磁盘操作。
 */
async function batchedRead(path: string, logger: PhotasaLogger): Promise<ConfigMetadata> {
    if (readBatch.has(path)) {
        return readBatch.get(path) || { configPath: "", data: "{}" };
    }

    // 使用 async/await 包装，避免 Promise 嵌套
    const promise = (async () => {
        // 确保配置文件存在
        const configPath = await ensureConfig(path, true, logger);

        // 检查缓存，如果缓存存在且未过期，则直接返回
        const cached = configCache.get(configPath);
        if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
            return {
                configPath,
                data: JSON.stringify(cached.config),
            };
        }

        // 读取配置文件
        let data = "{}";
        try {
            // 重试读取配置文件
            data = await retryOperation(
                () => fs.readFile(configPath, "utf-8"),
                3,
                1000,
                logger,
                "batchedRead",
            ).catch(() => "{}");
        } catch (error) {
            logger.error(`[batchedRead] 读取配置文件失败: ${configPath}`, error);
            throw handleError(
                new FileSystemError(`Failed to read config file at ${configPath}`, { error }),
                logger,
                "batchedRead",
            );
        }

        // 尝试解析配置，如失败则自动重建
        let config;
        try {
            config = parseConfig(data);
        } catch (parseError) {
            logger.error(`[batchedRead] 配置文件损坏，自动重建: ${configPath}`, parseError);
            // 自动重建默认配置
            config = { photoList: [], version: PHOTASA_VERSION };
            await fs.writeFile(configPath, JSON.stringify(config, null, 4), "utf8");
        }

        // Update cache
        configCache.set(configPath, { config, timestamp: Date.now() });

        return {
            configPath, // 配置文件路径
            data: JSON.stringify(config), // 配置文件内容
        };
    })();

    // 设置批处理 在 READ_BATCH_INTERVAL 期间，如果再次读取，则直接返回等待的 promise
    // 以此避免重复读取配置文件
    readBatch.set(path, promise);

    // 每间隔 READ_BATCH_INTERVAL 毫秒清除批处理，避免内存泄漏
    setTimeout(() => {
        readBatch.delete(path);
    }, READ_BATCH_INTERVAL);

    return promise;
}

/**
 * 读取配置文件，使用批量读取。
 */
async function readConfig(
    photo: string,
    _isFile: boolean,
    logger: PhotasaLogger,
): Promise<ConfigMetadata> {
    logger.info(`[readConfig] 读取配置文件: ${photo}`);
    return batchedRead(photo, logger);
}

/**
 * 写入配置文件，使用批量写入。
 */
async function writeConfig(
    configPath: string, // 配置文件路径
    photoConfig: PhotasaConfig, // 配置对象
    logger: PhotasaLogger,
): Promise<void> {
    logger.info(`[writeConfig] 写入配置文件: ${configPath}`);
    photoConfig.lastModified = Date.now();
    const data = JSON.stringify(photoConfig, null, 4);
    // 输出日志：内容摘要 128个字符
    logger.debug(`[writeConfig] 写入内容摘要: ${data.length} 字符`);
    // 添加到写入批处理
    writeBatch.set(configPath, { data, timestamp: Date.now() });
    // 更新缓存
    configCache.set(configPath, { config: photoConfig, timestamp: Date.now() });
    logger.info(`[writeConfig] 写入完成: ${configPath}`);
}

/**
 * 安全解析 JSON 字符串为 PhotasaConfig 对象。
 */
function fromJson(data: string): PhotasaConfig {
    try {
        return <PhotasaConfig>JSON.parse(data);
    } catch (error) {
        throw new ConfigError("Failed to parse config JSON", { error, data });
    }
}

/**
 * 规范化配置对象，补全缺失字段。
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

// 组合解析与规范化
const parseConfig = R.compose(normalizeConfig, fromJson);

/**
 * 批量将多张照片添加到配置文件，支持并发与进度回调。
 */
export async function batchAddToPhotoList(
    photos: string[],
    logger: PhotasaLogger,
    onProgress?: (progress: number) => void,
    onError?: (error: Error) => void,
): Promise<PhotasaConfigResult> {
    logger.info(`[batchAddToPhotoList] 批量添加照片到配置文件: ${photos.length}`);
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
        const results = await Promise.allSettled(
            chunk.map(async (photo) => {
                try {
                    logger.info(`[batchAddToPhotoList] 添加照片到配置文件: ${photo}`);
                    const result = await addToPhotoList(photo, logger);
                    return { success: true, result, photo };
                } catch (error) {
                    logger.error(`[batchAddToPhotoList] 处理照片失败: ${photo}`, error);
                    onError?.(error as Error);
                    return { success: false, error, photo };
                }
            }),
        );

        // 处理 settled 结果
        results.forEach((result, index) => {
            if (result.status === "fulfilled") {
                const { success, result: photoResult, error, photo } = result.value;
                if (success && photoResult) {
                    lastResult = photoResult;
                    processed++;
                } else {
                    failed++;
                    const errorMsg =
                        error instanceof Error ? error.message : error || "Unknown error";
                    logger.error(
                        `[batchAddToPhotoList] 照片处理失败: ${photo} - ${errorMsg}`,
                        error instanceof Error ? error : { error: errorMsg },
                    );
                }
            } else {
                failed++;
                logger.error(`[batchAddToPhotoList] 照片处理失败: ${chunk[index]}`, result.reason);
            }
        });

        // Update progress less frequently for better performance
        const now = Date.now();
        if (now - lastProgressUpdate > 100) {
            // Update every 100ms
            lastProgressUpdate = now;
            onProgress?.(processed / total);
        }

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

    // 记录最终统计信息
    logger.info(
        `[batchAddToPhotoList] 批量处理完成: 成功=${processed}, 失败=${failed}, 总计=${total}`,
    );

    // Return the last successful result or throw if no successful results
    if (!lastResult) {
        const errorMsg = `No successful results in batch processing: processed=${processed}, failed=${failed}, total=${total}`;
        logger.error(`[batchAddToPhotoList] ${errorMsg}`);
        throw new ConfigError(errorMsg, {
            processed,
            failed,
            total,
        });
    }
    return lastResult;
}

/**
 * 单张照片添加到配置文件，若已存在则补全缩略图。
 */
export const addToPhotoList = async (
    photoPath: string,
    logger: PhotasaLogger,
): Promise<PhotasaConfigResult> => {
    logger.info(`[addToPhotoList] 添加照片到配置文件: ${photoPath}`);
    try {
        // 检查文件路径中的特殊字符
        if (photoPath.includes("#")) {
            logger.debug(`[addToPhotoList] 检测到特殊字符文件名: ${photoPath}`);
        }

        logger.debug(`[addToPhotoList] 步骤1: 读取配置文件`);
        const meta = await readConfig(photoPath, true, logger);

        logger.debug(`[addToPhotoList] 步骤2: 解析配置数据`);
        const photasaConfig = parseConfig(meta.data);

        logger.debug(`[addToPhotoList] 步骤3: 提取文件名`);
        const fileName = toFileName(photoPath);
        logger.debug(`[addToPhotoList] 文件名: ${fileName}`);

        const photo = photasaConfig.photoList.find((p) => p.path === fileName);

        logger.debug(`[addToPhotoList] 步骤4: 生成缩略图路径`);
        const thumbnailName = toRelativeThumbnailPath(photoPath);
        logger.debug(`[addToPhotoList] 缩略图路径: ${thumbnailName}`);

        if (!photo) {
            logger.debug(`[addToPhotoList] 步骤5: 添加新照片记录`);
            photasaConfig.photoList.push({
                path: fileName,
                thumbnail: thumbnailName,
                history: [],
                isVideo: isVideo(fileName),
            });
            logger.debug(`[addToPhotoList] 步骤6: 写入配置文件`);
            await writeConfig(meta.configPath, photasaConfig, logger);
        } else if (!photo.thumbnail) {
            logger.debug(`[addToPhotoList] 步骤5: 更新现有照片的缩略图`);
            photo.thumbnail = thumbnailName;
            logger.debug(`[addToPhotoList] 步骤6: 写入配置文件`);
            await writeConfig(meta.configPath, photasaConfig, logger);
        } else {
            logger.debug(`[addToPhotoList] 照片已存在且有缩略图，跳过`);
        }

        logger.debug(`[addToPhotoList] 步骤7: 返回结果`);
        return {
            path: meta.configPath,
            config: photasaConfig,
        };
    } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        logger.error(`[addToPhotoList] 添加照片到配置文件失败: ${photoPath} - ${errorMsg}`, error);
        throw handleError(
            new ConfigError(`Failed to add photo to list: ${photoPath}`, { error }),
            logger,
            "addToPhotoList",
        );
    }
};

/**
 * 从配置文件移除指定照片。
 */
export async function removeFromPhotoList(
    photoPath: string,
    logger: PhotasaLogger,
): Promise<PhotasaConfigResult> {
    try {
        const meta = await readConfig(photoPath, true, logger);
        const photasaConfig = parseConfig(meta.data);

        const fileName = toFileName(photoPath);
        const photoIndex = photasaConfig.photoList.findIndex((p) => p.path === fileName);

        if (photoIndex >= 0) {
            photasaConfig.photoList.splice(photoIndex, 1);
            await writeConfig(meta.configPath, photasaConfig, logger);
        }
        return {
            path: meta.configPath,
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
 * 读取指定目录的 PhotasaConfig。
 */
export async function getPhotasaConfig(
    folder: string,
    logger: PhotasaLogger,
): Promise<PhotasaConfig> {
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
 * 重置指定目录的配置文件，仅清空 photoList。
 */
export async function resetPhotasaConfig(
    folder: string,
    logger: PhotasaLogger,
): Promise<PhotasaConfig> {
    try {
        const meta = await readConfig(folder, false, logger);
        const photasaConfig = parseConfig(meta.data);
        photasaConfig.photoList = [];
        await writeConfig(meta.configPath, photasaConfig, logger);
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
 * 修复指定目录的配置文件路径与缩略图名。
 */
export async function fixPhotasaConfig(
    folder: string,
    logger: PhotasaLogger,
): Promise<PhotasaConfig> {
    try {
        const meta = await readConfig(folder, false, logger);
        const config = parseConfig(meta.data);

        config.photoList.forEach((photo) => {
            photo.path = toFileName(photo.path);
            photo.thumbnail = shortenThumbnailName(photo.thumbnail);
        });

        await writeConfig(meta.configPath, config, logger);

        return config;
    } catch (error) {
        throw handleError(
            new ConfigError(`Failed to fix config for folder: ${folder}`, { error }),
            logger,
            "fixPhotasaConfig",
        );
    }
}

// --- 批量添加队列与任务管理 ---

// 待添加操作的队列，按目录分组
let addPathQueue: Record<string, string[]> = {};
let lastQueuedCount = 0;

interface RequestQueue {
    add: (task: () => void, options?: { priority?: number }) => void;
    size: number;
    pending: number;
    isPaused: boolean;
    start: () => void;
    on: (event: string, callback: (...args: any[]) => void) => void;
}

// 并发队列实例
let globalQueue: RequestQueue | null = null;

/**
 * 初始化并发队列，支持最大并发与超时。
 */
async function initializeQueue(logger: PhotasaLogger) {
    if (!globalQueue) {
        try {
            const PQueue = (await import("p-queue")).default;
            globalQueue = new PQueue({
                concurrency: QUEUE_CONCURRENCY,
                autoStart: true,
                intervalCap: QUEUE_INTERVAL_CAP,
                interval: QUEUE_INTERVAL,
                timeout: QUEUE_TIMEOUT,
                throwOnTimeout: false, // Don't crash on timeout
            }) as unknown as RequestQueue;
            setupQueueEvents(logger, globalQueue);
        } catch (error) {
            throw handleError(
                new ConfigError("Failed to initialize queue", { error }),
                logger,
                "initializeQueue",
            );
        }
    }
    return globalQueue;
}

// 队列日志与事件节流
let queueLogger: PhotasaLogger | null = null;
const eventThrottleMap: Record<string, number> = {};
function throttleLog(key: string, interval: number, logFn: () => void) {
    const now = Date.now();
    if (!eventThrottleMap[key] || now - eventThrottleMap[key] > interval) {
        eventThrottleMap[key] = now;
        logFn();
    }
}

// 已注册队列集合，防止重复注册
const registeredQueues = new WeakSet<any>();

/**
 * 注册队列事件，输出队列状态日志。
 */
function setupQueueEvents(logger: PhotasaLogger, queue: RequestQueue): void {
    if (!queue) {
        logger.error("Cannot setup queue events: queue is null");
        return;
    }
    // 防止重复注册
    if (registeredQueues.has(queue)) {
        return;
    }

    // 注册队列
    registeredQueues.add(queue);

    queueLogger = logger;
    try {
        // 队列空闲时
        queue.on("idle", () => {
            queueLogger?.info(
                `[config-queue] Queue idle - size: ${queue.size}, pending: ${queue.pending}`,
            );
        });

        // 队列错误时
        queue.on("error", (error) => {
            handleError(
                new ConfigError("Queue error", { error }),
                queueLogger as PhotasaLogger,
                "queueEvents",
            );
            // Don't crash, just log the error and continue
            queue.start(); // Restart queue if it was paused
        });

        // 队列添加时 高频 routine 日志节流（如每 1000ms 最多输出一次）
        queue.on("add", () => {
            throttleLog("queue-add", 1000, () => {
                queueLogger?.debug(
                    `[config-queue] Item added - size: ${queue.size}, pending: ${queue.pending}`,
                );
            });
        });

        // 队列活跃时 高频 routine 日志节流（如每 1000ms 最多输出一次）
        queue.on("active", () => {
            throttleLog("queue-active", 1000, () => {
                queueLogger?.debug(
                    `[config-queue] Queue active - size: ${queue.size}, pending: ${queue.pending}`,
                );
            });
        });
        // 其他 routine 事件可按需添加节流或关闭
    } catch (error) {
        // 注册队列失败时 输出错误日志
        handleError(
            new ConfigError("Failed to setup queue events", { error }),
            logger,
            "setupQueueEvents",
        );
    }
}

/**
 * 获取当前待处理文件总数。
 */
function waitedFilesCount(): number {
    return Object.entries<string[]>(addPathQueue).reduce((acc, entry) => acc + entry[1].length, 0);
}

/**
 * 内部：处理添加队列，按目录批量更新配置。
 */
function addConfig(
    request: QueueItem,
    logger: PhotasaLogger,
    postMessage: (message: string) => void,
    done: () => void,
): void {
    const queued = Object.entries<string[]>(addPathQueue);
    addPathQueue = {};
    const totalFiles = queued.reduce((acc, entry) => acc + entry[1].length, 0);

    if (totalFiles > 0) {
        logger.info(
            `config-update: action=add, photoCount=${totalFiles}, queueSize=${waitedFilesCount()}, timestamp=${Date.now()}`,
        );
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
                        logger.info(
                            `config-queue: action=waiting, count=${count}, timestamp=${Date.now()}`,
                        );
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
 * 添加任务到并发队列，支持优先级。
 */
function addTaskToQueue(
    request: QueueItem,
    postMessage: (message: string) => void,
    logger: PhotasaLogger,
): Promise<void> {
    return new Promise((resolve) => {
        // Add task to queue with priority based on queue size
        const priority = globalQueue?.size && globalQueue.size > 100 ? 1 : 0; // Higher priority for larger queues
        globalQueue?.add(
            () => {
                addConfig(request, logger, postMessage, resolve);
            },
            { priority },
        );
    });
}

/**
 * 公共 API：批量添加照片路径到队列，异步批量处理。
 */
export async function addToPhotasaConfig(
    request: QueueItem,
    postMessage: (message: string) => void,
    logger: PhotasaLogger,
): Promise<void> {
    // 将路径添加到队列中，按目录分组
    request.paths.forEach((p) => {
        const dir = path.dirname(p);
        addPathQueue[dir] = addPathQueue[dir] || [];
        addPathQueue[dir].push(p);
    });
    // 获取队列
    await initializeQueue(logger);
    // 添加任务到队列
    try {
        await addTaskToQueue(request, postMessage, logger);
    } catch (error) {
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
    }
}

/**
 * 清理指定目录及子目录的队列。
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

// 队列通知延迟配置
export const config = {
    DELAY_NOTIFY_DONE: 3000,
};

// 启动写入批处理定时器
setInterval(() => {
    if (queueLogger) {
        batchedWrite(queueLogger);
    }
}, WRITE_BATCH_INTERVAL);

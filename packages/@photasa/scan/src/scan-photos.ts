/**
 * 扫描照片模块 - 核心扫描功能实现
 *
 * 本模块负责照片和视频文件的扫描处理，支持以下功能：
 * - 智能扫描策略决策（跳过/增量/完整扫描）
 * - 增量缓存机制，支持断点续扫
 * - 多线程缩略图生成
 * - 子目录递归扫描
 * - 文件类型过滤和验证
 *
 * 主要组件：
 * - walkthroughPhotosInFolder: 遍历文件夹中的媒体文件
 * - scanPhotos: 主扫描函数，支持策略决策和增量缓存
 * - scanSubdirectories: 子目录递归扫描
 * - extendedCleanup: 扩展清理功能
 *
 * @author Photasa Team
 * @version 1.6.0
 * @since RFC 0007 - 智能扫描决策与缓存优化
 */

import klaw from "klaw";
import { Observable, Subscriber, concatMap } from "rxjs";
import isImage from "is-image";
import isVideo from "is-video";
import fs from "fs-extra";
import path from "path";
import { shouldIgnorePhotasaPath } from "@photasa/common";
import { buildThumbnailPath, isHiddenFile } from "./utils/path-utils";
import type { ScanAction, PhotoFileRequest } from "@photasa/common";

import type { ThumbnailRequest, ThumbnailResponse } from "@photasa/common";
import type { WorkerPool } from "./scan-helpers";
import {
    processPhotoFile,
    createSubscriptionHandlers,
    validateScanParams,
    isDirectoryScan,
    restoreCachedFiles,
} from "./scan-helpers";
import { IncrementalCacheManager } from "./cache/incremental-cache";
import {
    shouldScanOneLevel,
    shouldProcessFile,
    decideScanStrategy,
} from "./strategy/scan-strategy";
import { loggers, PhotasaLogger } from "@photasa/common";

const logger = loggers.scan;

/**
 * 遍历文件夹中的媒体文件
 *
 * 使用 klaw 库递归遍历指定路径下的所有文件，过滤出图片和视频文件。
 * 支持单文件扫描和目录扫描两种模式，自动忽略隐藏文件和系统文件。
 *
 * @param source - 扫描动作配置，包含路径、操作类型等信息
 * @returns Observable<PhotoFileRequest> - 媒体文件请求流
 */
export function walkthroughPhotosInFolder(source: ScanAction): Observable<PhotoFileRequest> {
    return new Observable<PhotoFileRequest>((subscriber: Subscriber<PhotoFileRequest>) => {
        // 首先检查路径是否存在
        if (!fs.existsSync(source.path)) {
            subscriber.error(new Error(`Path does not exist: ${source.path}`));
            return;
        }

        // 检查路径类型：文件还是目录
        const stats = fs.statSync(source.path);
        const isDirectory = stats.isDirectory();
        const isFile = stats.isFile();

        // Handle single file scanning (enhanced functionality for unified queue)
        if (source.operationType === "file" || (isFile && source.operationType !== "directory")) {
            const isVideoFile = isVideo(source.path);
            const isImageFile = isImage(source.path);

            // Only process media files with enhanced validation
            if (isVideoFile || isImageFile) {
                subscriber.next({
                    path: source.path,
                    thumbnail: buildThumbnailPath(source.path),
                    isImage: isImageFile,
                    isVideo: isVideoFile,
                    isDirectory: false,
                });
            } else {
                logger.debug(`Skipping non-media file: ${source.path}`);
            }
            subscriber.complete();
            return;
        }

        // Directory scanning - 确保路径是目录
        if (!isDirectory) {
            subscriber.error(new Error(`Expected directory but got file: ${source.path}`));
            return;
        }

        // 根据扫描动作决定扫描深度
        const option = {
            depthLimit: shouldScanOneLevel(source.action) ? 0 : -1,
            filter: (item: string): boolean => {
                return (
                    !shouldIgnorePhotasaPath(item) && // Skip ignored path
                    !isHiddenFile(item) // Skip hidden file
                );
            },
        };

        // 遍历所有照片文件，忽略隐藏文件、photasa 文件和子文件夹
        klaw(source.path, option)
            .on("data", (item) => {
                const video = isVideo(item.path);
                const image = isImage(item.path);

                if (video || image) {
                    subscriber.next({
                        path: item.path,
                        thumbnail: buildThumbnailPath(item.path),
                        isImage: image,
                        isVideo: video,
                        isDirectory: item.stats.isDirectory(),
                    });
                }
            })
            .on("end", () => {
                subscriber.complete();
            })
            .on("error", (error) => {
                logger.error(`[walkthroughPhotosInFolder] 扫描文件夹失败: ${source.path}`, error);
                subscriber.error(error);
            });
    });
}

/**
 * 主扫描函数 - 智能扫描策略与增量缓存
 *
 * @param scan - 扫描动作配置，包含路径、操作类型、动作类型等
 * @param logger - 日志记录器，用于记录扫描过程和状态
 * @returns Observable<PhotoFileRequest> - 扫描结果流，包含所有发现的媒体文件
 *
 * @since RFC 0007 - 智能扫描决策与缓存优化
 */
export function scanPhotos(
    scan: ScanAction,
    logger: PhotasaLogger,
    workerPool?: WorkerPool<ThumbnailRequest, ThumbnailResponse>,
): Observable<PhotoFileRequest> {
    return new Observable<PhotoFileRequest>((subscriber) => {
        // 参数验证
        const validation = validateScanParams(scan);
        if (!validation.isValid) {
            subscriber.error(new Error(`参数验证失败: ${validation.error}`));
            return;
        }

        // 对于目录扫描，先进行策略决策
        if (isDirectoryScan(scan)) {
            logger.info(
                `[scanPhotos] 开始目录扫描: ${scan.path}, operationType: ${scan.operationType}`,
            );

            // 进行扫描策略决策（异步处理）
            decideScanStrategy(scan.path, logger, scan.action)
                .then(async (scanDecision) => {
                    // RFC 0015 验证日志：扫描策略决策
                    logger.info(`[RFC0015验证] 扫描策略决策: ${scanDecision.strategy}`);
                    logger.info(`[RFC0015验证] 决策原因: ${scanDecision.reason}`);

                    logger.info(
                        `[scanPhotos] 扫描策略决策: ${scanDecision.strategy}, 原因: ${scanDecision.reason}`,
                    );

                    // 根据策略决策选择处理路径
                    if (scanDecision.strategy === "skip") {
                        // 跳过扫描，直接从 .photasa.json 恢复文件列表
                        logger.info(`[scanPhotos] 跳过扫描，从缓存恢复文件列表: ${scan.path}`);

                        // 确保 .photasa-folder.json 缓存文件存在且同步
                        const cacheManager = new IncrementalCacheManager(scan.path, logger);
                        await cacheManager.initialize();
                        await cacheManager.markScanComplete();

                        // RFC 0015 验证日志：缓存恢复
                        logger.info(`[scanPhotos] 开始恢复缓存文件`);
                        // 修复：正确绑定 subscriber 上下文，避免 this 丢失
                        await restoreCachedFiles(
                            scan.path,
                            {
                                next: (value) => subscriber.next(value),
                                error: (error) => subscriber.error(error),
                            },
                            logger,
                        );

                        // 修复：即使当前目录被跳过，仍需要扫描子目录
                        logger.info(`[scanPhotos] 开始扫描子目录: ${scan.path}`);
                        await scanSubdirectories(scan, subscriber, logger, workerPool);

                        // 重要修复：在所有操作完成后才调用 complete
                        logger.info(`[scanPhotos] SKIP策略处理完成: ${scan.path}`);
                        subscriber.complete();
                        return;
                    }

                    // 需要扫描，使用增量缓存机制
                    logger.info(
                        `[scanPhotos] 开始增量缓存扫描: ${scan.path}, operationType: ${scan.operationType}`,
                    );

                    // 创建增量缓存管理器
                    const cacheManager = new IncrementalCacheManager(scan.path, logger);

                    // 初始化缓存并开始扫描
                    cacheManager
                        .initialize()
                        .then(async (cache) => {
                            // 检查是否为断点续扫
                            if (cache.inProgress && cache.processedFiles.length > 0) {
                                logger.info(
                                    `[scanPhotosWithIncrementalCache] 检测到未完成扫描，已处理 ${cache.processedFiles.length} 个文件，准备断点续扫`,
                                );

                                // 获取所有文件列表
                                const allFiles: PhotoFileRequest[] = [];

                                // 收集所有文件
                                walkthroughPhotosInFolder(scan).subscribe({
                                    next: (file) => allFiles.push(file),
                                    complete: () => {
                                        // 过滤出未处理的文件
                                        const unprocessedFiles = allFiles.filter(
                                            (file) => !cacheManager.isFileProcessed(file.path),
                                        );

                                        logger.info(
                                            `[scanPhotosWithIncrementalCache] 断点续扫：总文件 ${allFiles.length}，已处理 ${cache.processedFiles.length}，待处理 ${unprocessedFiles.length}`,
                                        );

                                        // 更新待处理文件列表
                                        cacheManager.setPendingFiles(
                                            unprocessedFiles.map((f) => f.path),
                                        );

                                        // 处理未完成的文件
                                        processFileList(
                                            unprocessedFiles,
                                            scan,
                                            cacheManager,
                                            workerPool,
                                            logger,
                                            subscriber,
                                        );
                                    },
                                    error: (error) => {
                                        logger.error(
                                            "[scanPhotosWithIncrementalCache] 获取文件列表失败",
                                            error,
                                        );
                                        subscriber.error(error);
                                    },
                                });
                            } else {
                                // 全新扫描
                                logger.info(
                                    `[scanPhotosWithIncrementalCache] 开始全新扫描: ${scan.path}`,
                                );

                                walkthroughPhotosInFolder(scan)
                                    .pipe(
                                        concatMap(async (action: PhotoFileRequest) => {
                                            const shouldProcess = await shouldProcessFile(
                                                action.path,
                                                scan.action,
                                                logger,
                                            );

                                            if (shouldProcess) {
                                                // 实时记录文件处理进度
                                                await cacheManager.recordFileProcessed(action);
                                            }

                                            return processPhotoFile(
                                                action,
                                                scan,
                                                shouldProcess,
                                                workerPool,
                                                logger,
                                            );
                                        }),
                                    )
                                    .subscribe({
                                        ...createSubscriptionHandlers(
                                            subscriber,
                                            logger,
                                            scan.path,
                                        ),
                                        complete: async () => {
                                            try {
                                                // 标记扫描完成并等待所有写入操作完成
                                                await cacheManager.markScanComplete();
                                                logger.info(
                                                    `[scanPhotosWithIncrementalCache] 全新扫描完成: ${scan.path}`,
                                                );

                                                // 确保所有配置文件都已写入后再发送完成信号
                                                await new Promise((resolve) =>
                                                    setTimeout(resolve, 50),
                                                );
                                            } catch (error) {
                                                logger.warn(
                                                    `[scanPhotosWithIncrementalCache] 完成标记失败`,
                                                    error,
                                                );
                                            }
                                            subscriber.complete();
                                        },
                                    });
                            }
                        })
                        .catch((error) => {
                            logger.error(
                                `[scanPhotosWithIncrementalCache] 初始化增量缓存失败: ${scan.path}`,
                                error,
                            );

                            // 降级到传统扫描（不使用增量缓存）
                            logger.warn(`[scanPhotos] 降级到传统扫描模式`);
                            walkthroughPhotosInFolder(scan)
                                .pipe(
                                    concatMap(async (action: PhotoFileRequest) => {
                                        const shouldProcess = await shouldProcessFile(
                                            action.path,
                                            scan.action,
                                            logger,
                                        );
                                        return processPhotoFile(
                                            action,
                                            scan,
                                            shouldProcess,
                                            workerPool,
                                            logger,
                                        );
                                    }),
                                )
                                .subscribe(
                                    createSubscriptionHandlers(subscriber, logger, scan.path),
                                );
                        });
                })
                .catch((error) => {
                    logger.error(`[scanPhotos] 扫描策略决策失败: ${scan.path}`, error);
                    subscriber.error(error);
                });
        } else {
            // 单文件扫描，使用传统方式（不需要增量缓存）
            walkthroughPhotosInFolder(scan)
                .pipe(
                    concatMap(async (action: PhotoFileRequest) => {
                        const shouldProcess = await shouldProcessFile(
                            action.path,
                            scan.action,
                            logger,
                        );
                        return processPhotoFile(action, scan, shouldProcess, workerPool, logger);
                    }),
                )
                .subscribe(createSubscriptionHandlers(subscriber, logger, scan.path));
        }
    });
}

/**
 * 处理文件列表（断点续扫专用）
 *
 * @param files - 待处理的文件列表
 * @param scan - 扫描动作配置
 * @param cacheManager - 增量缓存管理器
 * @param workerPool - Worker 池实例
 * @param logger - 日志记录器
 * @param subscriber - Observable 订阅器，用于发送处理结果
 *
 * @internal 此函数为内部使用，不对外暴露
 */
async function processFileList(
    files: PhotoFileRequest[],
    scan: ScanAction,
    cacheManager: IncrementalCacheManager,
    workerPool: WorkerPool<ThumbnailRequest, ThumbnailResponse> | undefined,
    logger: PhotasaLogger,
    subscriber: Subscriber<PhotoFileRequest>,
) {
    for (const file of files) {
        try {
            const shouldProcess = await shouldProcessFile(file.path, scan.action, logger);

            if (shouldProcess) {
                await processPhotoFile(file, scan, shouldProcess, workerPool, logger);
                await cacheManager.recordFileProcessed(file);
            }

            subscriber.next(file);
        } catch (error) {
            logger.error(`[processFileList] 处理文件失败: ${file.path}`, error);
        }
    }

    try {
        await cacheManager.markScanComplete();
        logger.info(`[processFileList] 断点续扫完成: ${scan.path}`);

        // 确保所有配置文件都已写入后再发送完成信号
        await new Promise((resolve) => setTimeout(resolve, 50));
    } catch (error) {
        logger.warn(`[processFileList] 完成标记失败`, error);
    }

    subscriber.complete();
}

/**
 * 扩展清理功能
 *
 * @param basePath - 基础路径，指定清理范围（可选）
 * @param options - 清理选项配置（可选）
 * @returns Promise<CleanupStats> - 清理统计信息
 */
export async function extendedCleanup(
    basePath?: string,
    options?: import("./scan-cleanup").CleanupOptions,
): Promise<import("./scan-cleanup").CleanupStats> {
    // 验证选项
    if (options) {
        if (typeof options !== "object") {
            throw new Error("清理选项验证失败");
        }
        // 检查无效的数值
        if (options.workerShutdownTimeout && options.workerShutdownTimeout < 0) {
            throw new Error("清理选项验证失败");
        }
        if (options.maxCacheAge && options.maxCacheAge < 0) {
            throw new Error("清理选项验证失败");
        }
    }

    const startTime = Date.now();
    const { cleanupInvalidCaches } = await import("./scan-cleanup");

    const result = await cleanupInvalidCaches(
        basePath || "",
        7 * 24 * 60 * 60 * 1000,
        loggers.scan,
    );

    const endTime = Date.now();
    const duration = endTime - startTime;

    return {
        startTime,
        endTime,
        duration,
        workerPoolShutdown: false,
        cacheFilesProcessed: result.processed,
        invalidCacheFilesRemoved: result.removed,
        memoryFreed: 0,
        errors: result.errors,
    };
}

/**
 * 处理媒体文件（统一处理函数）
 *
 * @param filePath - 媒体文件路径
 * @param scan - 扫描动作配置
 * @param workerPool - Worker 池实例
 * @param logger - 日志记录器
 */
export async function processMediaFile(
    filePath: string,
    scan: ScanAction,
    workerPool: WorkerPool<ThumbnailRequest, ThumbnailResponse> | undefined,
    logger: PhotasaLogger,
): Promise<void> {
    const { addToPhotasaConfig, removeFromPhotoList } = await import("@photasa/config-core");
    const { shouldProcessFile } = await import("./strategy/scan-strategy");

    // 使用统一的路径处理API规范化路径
    const normalizedFilePath = filePath;
    const thumbnailPath = buildThumbnailPath(normalizedFilePath);

    switch (scan.action) {
        case "scan": {
            // 扫描操作：创建缩略图（如果需要）并添加到配置
            const shouldProcess = await shouldProcessFile(normalizedFilePath, scan.action, logger);
            if (!shouldProcess) {
                return;
            }

            const thumbnailExists = fs.existsSync(thumbnailPath);
            if (!thumbnailExists && workerPool) {
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
        }

        case "rescan":
            // 重新扫描操作：强制重新创建缩略图并更新配置
            if (workerPool) {
                await workerPool.addTask("create", {
                    path: normalizedFilePath,
                    thumbnail: thumbnailPath,
                    width: scan.thumbnailSize,
                    height: scan.thumbnailSize,
                    withoutEnlargement: true,
                    preview: thumbnailPath,
                    always: true, // 强制重新创建
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

        case "current":
            // 删除操作：移除缩略图和配置
            if (fs.existsSync(thumbnailPath)) {
                await fs.unlink(thumbnailPath);
            }

            await removeFromPhotoList(filePath, logger);
            break;

        default:
            logger.warn(`[processMediaFile] 未知的扫描操作: ${scan.action} for ${filePath}`);
    }
}

/**
 * 扫描子目录（递归扫描）
 *
 * @param scan - 扫描动作配置，包含父目录路径等信息
 * @param subscriber - Observable 订阅器，用于接收扫描结果
 * @param logger - 日志记录器，用于记录扫描过程
 * @param workerPool - Worker 池实例
 *
 * @internal 此函数为内部使用，由 scanPhotos 函数调用
 */
async function scanSubdirectories(
    scan: ScanAction,
    subscriber: Subscriber<PhotoFileRequest>,
    logger: PhotasaLogger,
    workerPool?: WorkerPool<ThumbnailRequest, ThumbnailResponse>,
): Promise<void> {
    try {
        logger.debug(`[scanSubdirectories] 开始扫描子目录: ${scan.path}`);

        // 获取当前目录下的所有子目录
        const entries = await fs.readdir(scan.path, { withFileTypes: true });
        const subdirectories = entries
            .filter((entry) => entry.isDirectory())
            .filter((entry) => !shouldIgnorePhotasaPath(entry.name))
            .filter((entry) => !isHiddenFile(entry.name));

        logger.info(`[scanSubdirectories] 发现 ${subdirectories.length} 个子目录`);

        // 对每个子目录递归应用扫描策略
        for (const subdir of subdirectories) {
            const subdirPath = path.join(scan.path, subdir.name);

            try {
                logger.debug(`[scanSubdirectories] 处理子目录: ${subdirPath}`);

                // 为子目录创建新的扫描动作
                const subdirScan: ScanAction = {
                    ...scan,
                    path: subdirPath,
                };

                // 递归调用 scanPhotos 处理子目录
                await new Promise<void>((resolve, reject) => {
                    scanPhotos(subdirScan, logger, workerPool).subscribe({
                        next: (photoRequest) => {
                            subscriber.next(photoRequest);
                        },
                        error: (error) => {
                            logger.error(
                                `[scanSubdirectories] 子目录扫描失败: ${subdirPath}`,
                                error,
                            );
                            reject(error);
                        },
                        complete: () => {
                            logger.debug(`[scanSubdirectories] 子目录扫描完成: ${subdirPath}`);
                            resolve();
                        },
                    });
                });
            } catch (error) {
                logger.error(`[scanSubdirectories] 处理子目录失败: ${subdirPath}`, error);
                // 继续处理其他子目录，不中断整个流程
            }
        }

        logger.info(`[scanSubdirectories] 子目录扫描完成: ${scan.path}`);
    } catch (error) {
        logger.error(`[scanSubdirectories] 扫描子目录失败: ${scan.path}`, error);
        throw error;
    }
}

/**
 * 导出扫描策略相关函数
 */
export {
    shouldProcessFile,
    shouldScanOneLevel,
    decideScanStrategy,
} from "./strategy/scan-strategy";

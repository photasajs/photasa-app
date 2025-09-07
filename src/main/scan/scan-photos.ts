import klaw from "klaw";
import { Observable, Subscriber, concatMap } from "rxjs";
import isImage from "is-image";
import isVideo from "is-video";
import { shouldIgnorePhotasaPath } from "@common/utils";
import { buildThumbnailPath, isHiddenFile } from "@shared/path-util";
import type { ScanAction, PhotoFileRequest } from "@common/scan-types";

import type { ThumbnailRequest, ThumbnailResponse } from "@common/thumbnail-types";
import {
    processPhotoFile,
    createSubscriptionHandlers,
    validateScanParams,
    isDirectoryScan,
} from "./scan-helpers";
import { IncrementalCacheManager } from "./incremental-cache";
import { shouldScanOneLevel, shouldProcessFile } from "./scan-strategy";
import { WorkerPool } from "../workers/worker-pool";
import createWorker from "../thumbnail/thumbnail-worker?nodeWorker";
import { loggers, PhotasaLogger } from "@common/logger";
import type { WorkerOptions } from "worker_threads";
import { getAppPath } from "@shared/path-util";
import { app } from "electron";
const logger = loggers.scan;

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

/**
 * 初始化缩略图 worker 池
 * @param logger - 日志记录器
 * @returns 缩略图 worker 池
 */
let workerPoolInstance: WorkerPool<ThumbnailRequest, ThumbnailResponse> | null = null;

/**
 * 初始化缩略图 worker 池
 * @param logger - 日志记录器
 * @returns 缩略图 worker 池
 */
function getWorkerPool(logger: PhotasaLogger): WorkerPool<ThumbnailRequest, ThumbnailResponse> {
    if (!workerPoolInstance) {
        workerPoolInstance = new WorkerPool(THUMBNAIL_WORKER_CONFIG, logger);
    }
    return workerPoolInstance;
}

/**
 * 遍历文件夹，忽略隐藏文件、photasa 文件和子文件夹
 * @param source - 扫描动作
 * @returns 照片路径
 */
export function walkthroughPhotos(source: ScanAction): Observable<PhotoFileRequest> {
    return new Observable<PhotoFileRequest>((subscriber: Subscriber<PhotoFileRequest>) => {
        // Handle single file scanning (enhanced functionality for unified queue)
        if (source.operationType === "file") {
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

        // Directory scanning (existing logic with error handling)
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

                // 只推送图片/视频文件节点，不再推送目录节点
                if (
                    !item.stats.isDirectory() && // 只处理文件
                    item.path !== source.path && //  Skip self
                    (video || image) // 只处理图片或视频
                ) {
                    subscriber.next({
                        path: item.path,
                        thumbnail: buildThumbnailPath(item.path),
                        isImage: image,
                        isVideo: video,
                        isDirectory: false,
                    });
                }
                // 目录节点不再推送
            })
            .on("end", () => {
                subscriber.complete();
            })
            .on("error", (error) => {
                logger.error("Error during directory walkthrough:", error);
                subscriber.error(error);
            });
    });
}

/**
 * 扫描照片函数 - 支持增量缓存和可恢复扫描
 * RFC 0007: 集成增量缓存机制，实现断点续扫
 * @param scan - 扫描动作
 * @param logger - 日志记录器
 * @returns 照片路径
 */
export function scanPhotos(scan: ScanAction, logger: PhotasaLogger): Observable<PhotoFileRequest> {
    return new Observable<PhotoFileRequest>((subscriber) => {
        // 参数验证
        const validation = validateScanParams(scan);
        if (!validation.isValid) {
            subscriber.error(new Error(`参数验证失败: ${validation.error}`));
            return;
        }

        const workerPool = getWorkerPool(logger);

        // 对于目录扫描，使用增量缓存机制
        if (isDirectoryScan(scan)) {
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
                        walkthroughPhotos(scan).subscribe({
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
                                cacheManager.setPendingFiles(unprocessedFiles.map((f) => f.path));

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
                        logger.info(`[scanPhotosWithIncrementalCache] 开始全新扫描: ${scan.path}`);

                        walkthroughPhotos(scan)
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
                                ...createSubscriptionHandlers(subscriber, logger, scan.path),
                                complete: async () => {
                                    try {
                                        // 标记扫描完成
                                        await cacheManager.markScanComplete();
                                        logger.info(
                                            `[scanPhotosWithIncrementalCache] 全新扫描完成: ${scan.path}`,
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
                    walkthroughPhotos(scan)
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
                        .subscribe(createSubscriptionHandlers(subscriber, logger, scan.path));
                });
        } else {
            // 单文件扫描，使用传统方式（不需要增量缓存）
            walkthroughPhotos(scan)
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
 * 处理文件列表（用于断点续扫）
 */
async function processFileList(
    files: PhotoFileRequest[],
    scan: ScanAction,
    cacheManager: IncrementalCacheManager,
    workerPool: WorkerPool<ThumbnailRequest, ThumbnailResponse>,
    logger: PhotasaLogger,
    subscriber: any,
) {
    try {
        for (const file of files) {
            const shouldProcess = await shouldProcessFile(file.path, scan.action, logger);

            if (shouldProcess) {
                // 实时记录文件处理进度
                await cacheManager.recordFileProcessed(file);
            }

            const processedFile = await processPhotoFile(
                file,
                scan,
                shouldProcess,
                workerPool,
                logger,
            );
            subscriber.next(processedFile);
        }

        // 标记扫描完成
        await cacheManager.markScanComplete();
        logger.info(`[processFileList] 断点续扫完成`);
        subscriber.complete();
    } catch (error) {
        logger.error(`[processFileList] 处理文件列表失败`, error);
        subscriber.error(error);
    }
}

/**
 * 基础清理函数，向后兼容
 * 当应用关闭时调用
 */
export async function cleanup(): Promise<void> {
    if (workerPoolInstance) {
        await workerPoolInstance.shutdown();
        workerPoolInstance = null;
    }
}

/**
 * RFC 0007 扩展清理函数
 * 提供更全面的资源清理和缓存维护
 * @param basePath - 扫描基础路径，用于缓存清理
 * @param options - 清理选项配置
 * @returns 清理统计结果
 */
export async function extendedCleanup(
    basePath?: string,
    options?: import("./scan-cleanup").CleanupOptions,
): Promise<import("./scan-cleanup").CleanupStats> {
    const { performExtendedCleanup, DEFAULT_CLEANUP_OPTIONS } = await import("./scan-cleanup");

    const cleanupOptions = options || DEFAULT_CLEANUP_OPTIONS;
    const scanBasePath = basePath || process.cwd();

    const stats = await performExtendedCleanup(
        workerPoolInstance,
        scanBasePath,
        cleanupOptions,
        logger,
    );

    // 清理完成后重置Worker Pool实例
    if (workerPoolInstance && stats.workerPoolShutdown) {
        workerPoolInstance = null;
    }

    return stats;
}

// 重新导出scan-strategy中的函数，供其他模块使用
export { shouldProcessFile, shouldScanOneLevel, decideScanStrategy } from "./scan-strategy";

// 导出增量缓存相关功能
export { IncrementalCacheManager, withIncrementalCache } from "./incremental-cache";

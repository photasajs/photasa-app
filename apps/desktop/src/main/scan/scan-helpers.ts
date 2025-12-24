/*
 * scan-helpers.ts
 *
 * 扫描功能的纯函数工具模块
 * 遵循纯函数设计原则，提高测试覆盖率和代码可维护性
 */

import fs from "fs-extra";
import path from "path";
import { Subscriber as _Subscriber } from "rxjs";
import type { ScanAction, PhotoFileRequest } from "@common/scan-types";
import type { ThumbnailRequest, ThumbnailResponse } from "@common/thumbnail-types";
import { WorkerPool } from "../workers/worker-pool";
import { PhotasaLogger } from "@common/logger";
import { addToPhotasaConfig } from "../config/config-storage";
import { buildThumbnailPath } from "@shared/path-util";

/**
 * 纯函数：检查缩略图是否需要创建
 * @param thumbnailPath - 缩略图路径
 * @param scanAction - 扫描动作
 * @returns boolean - 是否需要创建缩略图
 */
export function shouldCreateThumbnail(thumbnailPath: string, scanAction: string): boolean {
    const thumbnailExists = fs.existsSync(thumbnailPath);
    return !thumbnailExists || scanAction === "rescan";
}

/**
 * 纯函数：构建缩略图创建任务参数
 * @param action - 照片文件请求
 * @param scan - 扫描动作
 * @returns ThumbnailRequest - 缩略图请求参数
 */
export function buildThumbnailRequest(
    action: PhotoFileRequest,
    scan: ScanAction,
): ThumbnailRequest {
    return {
        path: action.path,
        thumbnail: action.thumbnail,
        width: scan.thumbnailSize,
        height: scan.thumbnailSize,
        withoutEnlargement: true,
        preview: action.thumbnail,
        always: scan.action === "rescan",
    };
}

/**
 * 纯函数：构建配置更新参数
 * @param filePath - 文件路径
 * @returns 配置更新参数
 */
export function buildConfigUpdateRequest(filePath: string) {
    return {
        queueId: 0,
        paths: [filePath],
    };
}

/**
 * 纯函数：处理单个照片文件（异步）
 * @param action - 照片文件请求
 * @param scan - 扫描动作
 * @param shouldProcess - 是否需要处理
 * @param workerPool - 工作池
 * @param logger - 日志记录器
 * @returns Promise<PhotoFileRequest> - 处理后的文件请求
 */
export async function processPhotoFile(
    action: PhotoFileRequest,
    scan: ScanAction,
    shouldProcess: boolean,
    workerPool: WorkerPool<ThumbnailRequest, ThumbnailResponse>,
    logger: PhotasaLogger,
): Promise<PhotoFileRequest> {
    // 如果文件不需要处理，直接返回
    if (!shouldProcess) {
        return action;
    }

    // 创建缩略图（如果需要）
    if (shouldCreateThumbnail(action.thumbnail, scan.action)) {
        const thumbnailRequest = buildThumbnailRequest(action, scan);
        if (workerPool) {
            await workerPool.addTask("create", thumbnailRequest);
        } else {
            logger.debug("[processPhotoFile] 跳过缩略图创建（无 Worker 池）");
        }
    }

    // 更新配置
    const configRequest = buildConfigUpdateRequest(action.path);
    await addToPhotasaConfig(configRequest, () => {}, logger);

    return action;
}

/**
 * 纯函数：创建扫描完成后的缓存更新数据
 * @param folderPath - 目录路径
 * @param startTime - 开始时间
 * @param fileCount - 文件数量（可选）
 * @returns 缓存更新所需的数据
 */
export function createCacheUpdateData(folderPath: string, startTime: number, fileCount = 0) {
    return {
        folderPath,
        duration: Date.now() - startTime,
        scanTime: Date.now(),
        fileCount,
    };
}

/**
 * 纯函数：构建扫描日志信息
 * @param strategy - 扫描策略
 * @param folderPath - 目录路径
 * @returns 日志消息对象
 */
export function buildScanLogMessages(strategy: string, folderPath: string) {
    return {
        skipMessage: `[scanPhotos] 跳过未变化目录: ${folderPath}`,
        startMessage: `[scanPhotos] 开始${strategy === "full" ? "完整" : "增量"}扫描: ${folderPath}`,
        cacheUpdateMessage: (duration: number) =>
            `[scanPhotos] 缓存已更新: ${folderPath}, 耗时: ${duration}ms`,
        cacheFailMessage: `[scanPhotos] 更新缓存失败: ${folderPath}`,
        fallbackMessage: `[scanPhotos] 智能决策失败，使用传统扫描: ${folderPath}`,
    };
}

/**
 * 纯函数：创建错误处理配置
 * @param folderPath - 目录路径
 * @returns 错误处理配置
 */
export function createErrorHandlers(folderPath: string) {
    return {
        scanError: (_error: unknown) => `[scanPhotos] 扫描过程出错: ${folderPath}`,
        decisionError: (_error: unknown) => `[scanPhotos] 扫描决策失败: ${folderPath}`,
    };
}

/**
 * 纯函数：验证扫描参数
 * @param scan - 扫描动作
 * @returns 验证结果
 */
export function validateScanParams(scan: ScanAction): { isValid: boolean; error?: string } {
    if (!scan.path) {
        return { isValid: false, error: "扫描路径不能为空" };
    }

    if (!scan.action) {
        return { isValid: false, error: "扫描动作不能为空" };
    }

    if (!scan.thumbnailSize || scan.thumbnailSize <= 0) {
        return { isValid: false, error: "缩略图尺寸必须大于0" };
    }

    // 检查路径是否存在
    if (!fs.existsSync(scan.path)) {
        return { isValid: false, error: `路径不存在: ${scan.path}` };
    }

    // 如果operationType明确指定，验证路径类型是否匹配
    try {
        if (scan.operationType === "file") {
            const stats = fs.statSync(scan.path);
            if (!stats.isFile()) {
                return { isValid: false, error: `期望文件但得到目录: ${scan.path}` };
            }
        } else if (scan.operationType === "directory") {
            const stats = fs.statSync(scan.path);
            if (!stats.isDirectory()) {
                return { isValid: false, error: `期望目录但得到文件: ${scan.path}` };
            }
        }
    } catch (error) {
        return { isValid: false, error: `路径不存在或无法访问: ${scan.path}` };
    }

    return { isValid: true };
}

/**
 * 纯函数：判断是否为目录扫描
 * @param scan - 扫描动作
 * @returns boolean - 是否为目录扫描
 */
export function isDirectoryScan(scan: ScanAction): boolean {
    return scan.operationType !== "file";
}

/**
 * 纯函数：创建Observable订阅处理器配置
 * @param subscriber - Observable订阅器
 * @param logger - 日志记录器
 * @param folderPath - 目录路径
 * @returns 订阅处理器配置
 */
export function createSubscriptionHandlers<T>(
    subscriber: { next: (value: T) => void; error: (error: unknown) => void; complete: () => void },
    logger: PhotasaLogger,
    folderPath: string,
) {
    const errorHandlers = createErrorHandlers(folderPath);

    return {
        next: (action: T) => subscriber.next(action),
        error: (error: unknown) => {
            logger.error(errorHandlers.scanError(error), error);
            subscriber.error(error);
        },
        complete: () => subscriber.complete(),
    };
}

export type ScanSubscriber<PhotoFileRequest> = {
    next: (value: PhotoFileRequest) => void;
    error: (error: unknown) => void;
};

/**
 * RFC 0007: 从缓存中恢复已扫描的文件列表
 * 当扫描策略为SKIP时，从.photasa.json配置文件中恢复已扫描的文件
 *
 * 注意：此函数不会调用 subscriber.complete()，订阅器的生命周期
 * 应由调用方（scanPhotos）统一管理，以确保子目录扫描能正常进行。
 *
 * @param folderPath - 目录路径
 * @param subscriber - Observable订阅器
 * @param logger - 日志记录器
 */
export async function restoreCachedFiles(
    folderPath: string,
    subscriber: ScanSubscriber<PhotoFileRequest>,
    logger: PhotasaLogger,
): Promise<void> {
    try {
        logger.debug(`[restoreCachedFiles] 开始从缓存恢复文件列表: ${folderPath}`);

        // 读取.photasa.json配置文件
        const configPath = path.join(folderPath, ".photasa.json");
        const configExists = await fs.pathExists(configPath);

        if (!configExists) {
            logger.warn(`[restoreCachedFiles] 配置文件不存在: ${configPath}`);
            // 不调用 subscriber.complete()，让调用方控制订阅器生命周期
            return;
        }

        const configContent = await fs.readFile(configPath, "utf8");

        // RFC 0015 修复：增强JSON解析错误处理
        let config: any;
        try {
            config = JSON.parse(configContent);
        } catch (parseError) {
            logger.error(`[restoreCachedFiles] JSON解析失败: ${configPath}`, parseError);
            logger.info(`[restoreCachedFiles] 文件内容长度: ${configContent.length} 字节`);
            logger.debug(`[restoreCachedFiles] 文件内容预览: ${configContent.substring(0, 200)}`);

            // JSON解析失败时，标记文件需要重新扫描
            logger.warn(`[restoreCachedFiles] 配置文件损坏，将触发完整重新扫描: ${configPath}`);
            // 不调用 subscriber.complete()，让调用方控制订阅器生命周期
            return;
        }

        if (!config.photoList || !Array.isArray(config.photoList)) {
            logger.warn(`[restoreCachedFiles] 配置文件格式无效: ${configPath}`);
            // 不调用 subscriber.complete()，让调用方控制订阅器生命周期
            return;
        }

        logger.info(`[restoreCachedFiles] 从缓存恢复 ${config.photoList.length} 个文件`);

        // 将已扫描的文件重新推送给订阅者
        for (const photo of config.photoList) {
            if (photo && photo.path) {
                // photo.path 存储的是文件名，需要构建完整路径
                const fullPath = path.join(folderPath, photo.path);
                const photoRequest: PhotoFileRequest = {
                    path: fullPath,
                    thumbnail: photo.thumbnail || buildThumbnailPath(fullPath),
                    isImage: photo.isImage || false,
                    isVideo: photo.isVideo || false,
                    isDirectory: false,
                };
                subscriber.next(photoRequest);
            }
        }

        logger.info(`[restoreCachedFiles] 缓存恢复完成: ${config.photoList.length} 个文件`);
        // 不调用 subscriber.complete()，让调用方控制订阅器生命周期
    } catch (error) {
        logger.error(`[restoreCachedFiles] 恢复缓存失败: ${folderPath}`, error);
        subscriber.error(error);
    }
}

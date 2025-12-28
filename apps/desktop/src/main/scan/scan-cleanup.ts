/*
 * scan-cleanup.ts
 *
 * RFC 0007 Milestone 3: 扫描清理机制
 * 提供扫描完成后的资源清理、内存优化和缓存维护功能
 *
 * 职责:
 * - Worker Pool 资源清理
 * - 缓存文件清理和维护
 * - 内存管理优化
 * - 清理过程监控和报告
 */

import fs from "fs-extra";
import path from "path";
import { PhotasaLogger } from "@photasa/common";
import type { WorkerPool } from "../workers/worker-pool";
import type { ThumbnailRequest, ThumbnailResponse } from "@photasa/common";
import { cleanupWorkerPool } from "./worker/pool-manager";

// Re-export for backward compatibility
export { cleanupWorkerPool };

/**
 * 清理统计接口
 */
export interface CleanupStats {
    startTime: number;
    endTime: number;
    duration: number;
    workerPoolShutdown: boolean;
    cacheFilesProcessed: number;
    invalidCacheFilesRemoved: number;
    memoryFreed: number; // KB
    errors: string[];
}

/**
 * 清理选项配置
 */
export interface CleanupOptions {
    // Worker清理选项
    shutdownWorkerPool: boolean;
    workerShutdownTimeout: number; // ms

    // 缓存清理选项
    cleanupInvalidCaches: boolean;
    maxCacheAge: number; // ms, 缓存文件的最大保留时间
    cleanupOrphanCaches: boolean; // 清理没有对应目录的缓存文件

    // 内存优化选项
    forceGarbageCollection: boolean;
    clearInternalCaches: boolean;

    // 报告选项
    generateReport: boolean;
    logLevel: "minimal" | "detailed";
}

/**
 * 默认清理配置
 */
export const DEFAULT_CLEANUP_OPTIONS: CleanupOptions = {
    shutdownWorkerPool: true,
    workerShutdownTimeout: 5000,
    cleanupInvalidCaches: true,
    maxCacheAge: 30 * 24 * 60 * 60 * 1000, // 30天
    cleanupOrphanCaches: true,
    forceGarbageCollection: true,
    clearInternalCaches: true,
    generateReport: true,
    logLevel: "minimal",
};

/**
 * 纯函数：验证清理选项
 * @param options - 清理选项
 * @returns 验证结果
 */
export function validateCleanupOptions(options: CleanupOptions): {
    isValid: boolean;
    error?: string;
} {
    if (options.workerShutdownTimeout < 0) {
        return { isValid: false, error: "Worker关闭超时时间不能为负数" };
    }

    if (options.maxCacheAge < 0) {
        return { isValid: false, error: "缓存最大保留时间不能为负数" };
    }

    if (!["minimal", "detailed"].includes(options.logLevel)) {
        return { isValid: false, error: "日志级别必须为 'minimal' 或 'detailed'" };
    }

    return { isValid: true };
}

/**
 * 纯函数：创建初始清理统计
 * @returns 初始清理统计对象
 */
export function createInitialCleanupStats(): CleanupStats {
    return {
        startTime: Date.now(),
        endTime: 0,
        duration: 0,
        workerPoolShutdown: false,
        cacheFilesProcessed: 0,
        invalidCacheFilesRemoved: 0,
        memoryFreed: 0,
        errors: [],
    };
}

/**
 * 清理无效的缓存文件
 * @param basePath - 基础扫描路径
 * @param maxAge - 最大缓存年龄（毫秒）
 * @param logger - 日志记录器
 * @returns 清理统计
 */
export async function cleanupInvalidCaches(
    basePath: string,
    maxAge: number,
    logger: PhotasaLogger,
): Promise<{ processed: number; removed: number; errors: string[] }> {
    const stats = {
        processed: 0,
        removed: 0,
        errors: [] as string[],
    };

    try {
        const cacheFiles = await findCacheFiles(basePath);
        stats.processed = cacheFiles.length;

        logger.debug(`[cleanupInvalidCaches] 找到 ${cacheFiles.length} 个缓存文件`);

        for (const cacheFile of cacheFiles) {
            try {
                const shouldRemove = await shouldRemoveCacheFile(cacheFile, maxAge);

                if (shouldRemove) {
                    await fs.remove(cacheFile);
                    stats.removed++;
                    logger.debug(`[cleanupInvalidCaches] 已删除过期缓存: ${cacheFile}`);
                }
            } catch (error) {
                const errorMsg = `删除缓存文件失败: ${cacheFile} - ${error}`;
                stats.errors.push(errorMsg);
                logger.warn(`[cleanupInvalidCaches] ${errorMsg}`);
            }
        }

        logger.info(
            `[cleanupInvalidCaches] 缓存清理完成: 处理 ${stats.processed} 个文件，删除 ${stats.removed} 个过期缓存`,
        );
    } catch (error) {
        const errorMsg = `缓存清理失败: ${error}`;
        stats.errors.push(errorMsg);
        logger.error(`[cleanupInvalidCaches] ${errorMsg}`);
    }

    return stats;
}

/**
 * 查找所有缓存文件
 * @param basePath - 基础路径
 * @returns 缓存文件路径数组
 */
async function findCacheFiles(basePath: string): Promise<string[]> {
    const cacheFiles: string[] = [];

    async function scanDirectory(dirPath: string) {
        try {
            const entries = await fs.readdir(dirPath, { withFileTypes: true });

            for (const entry of entries) {
                const fullPath = path.join(dirPath, entry.name);

                if (entry.isDirectory()) {
                    await scanDirectory(fullPath);
                } else if (entry.name === ".photasa-folder.json") {
                    cacheFiles.push(fullPath);
                }
            }
        } catch (error) {
            // 忽略无法访问的目录
        }
    }

    await scanDirectory(basePath);
    return cacheFiles;
}

/**
 * 判断是否应该删除缓存文件
 * @param cacheFilePath - 缓存文件路径
 * @param maxAge - 最大年龄
 * @returns 是否应该删除
 */
async function shouldRemoveCacheFile(cacheFilePath: string, maxAge: number): Promise<boolean> {
    try {
        // 检查缓存文件是否过期
        const stats = await fs.stat(cacheFilePath);
        const age = Date.now() - stats.mtime.getTime();

        if (age > maxAge) {
            return true;
        }

        // 检查对应的目录是否还存在
        const dirPath = path.dirname(cacheFilePath);
        const dirExists = await fs.pathExists(dirPath);

        if (!dirExists) {
            return true;
        }

        // 检查缓存文件格式是否有效
        const content = await fs.readFile(cacheFilePath, "utf8");
        const cache = JSON.parse(content);

        // 基本格式验证
        if (!cache.version || !cache.folderHash) {
            return true;
        }

        return false;
    } catch (error) {
        // 如果无法读取或解析，认为是无效缓存，应该删除
        return true;
    }
}

/**
 * 内存清理优化
 * @param logger - 日志记录器
 * @returns 估算的释放内存量（KB）
 */
export function optimizeMemory(logger: PhotasaLogger): number {
    let memoryFreed = 0;

    try {
        // 获取清理前的内存使用情况
        const beforeMemory = process.memoryUsage();

        // 强制垃圾回收（如果可用）
        if (global.gc) {
            logger.debug("[optimizeMemory] 执行强制垃圾回收");
            global.gc();
            memoryFreed += 100; // 估算值
        }

        // 清理可能的内部缓存（如果有的话）
        // 这里可以添加应用特定的缓存清理逻辑

        const afterMemory = process.memoryUsage();
        const actualFreed = Math.max(0, beforeMemory.heapUsed - afterMemory.heapUsed) / 1024; // KB

        memoryFreed = Math.max(memoryFreed, actualFreed);

        logger.debug(`[optimizeMemory] 内存优化完成，估算释放: ${memoryFreed.toFixed(2)}KB`);
    } catch (error) {
        logger.warn("[optimizeMemory] 内存优化失败", error);
    }

    return memoryFreed;
}

/**
 * 生成清理报告
 * @param stats - 清理统计
 * @param options - 清理选项
 * @param logger - 日志记录器
 */
export function generateCleanupReport(
    stats: CleanupStats,
    options: CleanupOptions,
    logger: PhotasaLogger,
): void {
    if (!options.generateReport) {
        return;
    }

    const report = {
        summary: {
            duration: `${stats.duration}ms`,
            success: stats.errors.length === 0,
            errorsCount: stats.errors.length,
        },
        details: {
            workerPoolShutdown: stats.workerPoolShutdown,
            cacheFilesProcessed: stats.cacheFilesProcessed,
            invalidCacheFilesRemoved: stats.invalidCacheFilesRemoved,
            memoryFreed: `${stats.memoryFreed.toFixed(2)}KB`,
        },
        errors: stats.errors,
    };

    if (options.logLevel === "detailed") {
        logger.info("[CleanupReport] 详细清理报告", report);
    } else {
        logger.info(
            `[CleanupReport] 清理完成: 耗时${report.summary.duration}, ` +
                `处理缓存${report.details.cacheFilesProcessed}个, ` +
                `删除无效缓存${report.details.invalidCacheFilesRemoved}个, ` +
                `释放内存${report.details.memoryFreed}`,
        );
    }

    if (report.summary.errorsCount > 0) {
        logger.warn(
            `[CleanupReport] 清理过程中发生 ${report.summary.errorsCount} 个错误`,
            stats.errors,
        );
    }
}

/**
 * 主要的扩展清理函数
 * RFC 0007 Milestone 3 的核心实现
 *
 * @param workerPool - Worker Pool实例
 * @param basePath - 扫描基础路径
 * @param options - 清理选项
 * @param logger - 日志记录器
 * @returns 清理统计结果
 */
export async function performExtendedCleanup(
    workerPool: WorkerPool<ThumbnailRequest, ThumbnailResponse> | null,
    basePath: string,
    options: CleanupOptions = DEFAULT_CLEANUP_OPTIONS,
    logger: PhotasaLogger,
): Promise<CleanupStats> {
    // 验证选项
    const validation = validateCleanupOptions(options);
    if (!validation.isValid) {
        throw new Error(`清理选项验证失败: ${validation.error}`);
    }

    const stats = createInitialCleanupStats();
    logger.info("[performExtendedCleanup] 开始扩展清理流程");

    try {
        // 1. Worker Pool 清理
        if (options.shutdownWorkerPool) {
            stats.workerPoolShutdown = await cleanupWorkerPool(
                workerPool,
                options.workerShutdownTimeout,
                logger,
            );
        }

        // 2. 缓存文件清理
        if (options.cleanupInvalidCaches || options.cleanupOrphanCaches) {
            const cacheStats = await cleanupInvalidCaches(basePath, options.maxCacheAge, logger);
            stats.cacheFilesProcessed = cacheStats.processed;
            stats.invalidCacheFilesRemoved = cacheStats.removed;
            stats.errors.push(...cacheStats.errors);
        }

        // 3. 内存优化
        if (options.forceGarbageCollection || options.clearInternalCaches) {
            stats.memoryFreed = optimizeMemory(logger);
        }

        stats.endTime = Date.now();
        stats.duration = stats.endTime - stats.startTime;

        // 4. 生成报告
        generateCleanupReport(stats, options, logger);

        logger.info(`[performExtendedCleanup] 扩展清理流程完成，耗时: ${stats.duration}ms`);
    } catch (error) {
        const errorMsg = `扩展清理流程失败: ${error}`;
        stats.errors.push(errorMsg);
        logger.error(`[performExtendedCleanup] ${errorMsg}`);

        stats.endTime = Date.now();
        stats.duration = stats.endTime - stats.startTime;
    }

    return stats;
}

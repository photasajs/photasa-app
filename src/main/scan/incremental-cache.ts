/*
 * incremental-cache.ts
 *
 * 增量缓存机制 - 实时保存扫描进度，支持断点续扫
 * 解决大文件夹扫描中断后需要重新开始的问题
 */

import fs from "fs-extra";
import path from "path";
import { PhotasaLogger } from "@common/logger";
import { FolderCache, createDefaultCache } from "./folder-cache-manager";
import type { PhotoFileRequest } from "@common/scan-types";

/**
 * 增量缓存接口 - 扩展基础缓存，添加进度跟踪
 */
export interface IncrementalCache extends FolderCache {
    // 已处理的文件列表（只存储文件名，不存储完整路径）
    processedFiles: string[];
    // 待处理的文件列表（用于断点续扫）
    pendingFiles?: string[];
    // 上次更新时间
    lastUpdate: number;
    // 是否正在扫描中
    inProgress: boolean;
    // 扫描开始时间
    scanStartTime?: number;
    // 总文件数（用于进度计算）
    totalFiles?: number;
    // 文件夹路径（用于重建完整路径）
    folderPath?: string;
}

/**
 * 增量缓存管理器
 */
export class IncrementalCacheManager {
    private cache: IncrementalCache | null = null;
    private cacheFilePath: string;
    private updateTimer: NodeJS.Timeout | null = null;
    private pendingUpdates = false;
    private readonly UPDATE_INTERVAL = 5000; // 5秒批量更新一次，减少磁盘IO频率
    private readonly MIN_BATCH_SIZE = 20; // 最小批量大小
    private readonly MAX_BATCH_SIZE = 200; // 最大批量大小
    private processedSinceLastUpdate = 0; // 自上次更新后处理的文件数
    private folderPath: string;

    constructor(
        folderPath: string,
        private logger: PhotasaLogger,
    ) {
        this.folderPath = folderPath;
        this.cacheFilePath = path.join(folderPath, ".photasa-folder.json");
    }

    /**
     * 初始化或恢复缓存
     */
    async initialize(): Promise<IncrementalCache> {
        try {
            // 尝试读取现有缓存
            if (await fs.pathExists(this.cacheFilePath)) {
                const content = await fs.readFile(this.cacheFilePath, "utf8");
                const existingCache = JSON.parse(content) as IncrementalCache;

                // 如果上次扫描未完成，准备断点续扫
                if (existingCache.inProgress && existingCache.processedFiles) {
                    this.logger.info(
                        `[IncrementalCache] 检测到未完成的扫描，已处理 ${existingCache.processedFiles.length} 个文件`,
                    );
                    this.cache = existingCache;
                    this.cache.scanStartTime = Date.now(); // 重置开始时间
                    return this.cache;
                }
            }
        } catch (error) {
            this.logger.warn(`[IncrementalCache] 读取缓存失败: ${error}`);
        }

        // 创建新缓存
        this.cache = this.createNewCache();
        this.logger.info(`[IncrementalCache] 创建新增量缓存文件: ${this.cacheFilePath}`);
        await this.saveCache();
        return this.cache;
    }

    /**
     * 创建新的增量缓存
     */
    private createNewCache(): IncrementalCache {
        const baseCache = createDefaultCache("", 0);
        const now = Date.now();
        return {
            ...baseCache,
            processedFiles: [],
            pendingFiles: [],
            lastUpdate: now,
            inProgress: true,
            scanStartTime: now,
            totalFiles: 0,
            folderPath: this.folderPath,
        };
    }

    /**
     * 计算动态批量大小
     * 基于文件夹大小和已处理文件数量动态调整
     */
    private calculateDynamicBatchSize(): number {
        const cache = this.cache;
        if (!cache) {
            return this.MIN_BATCH_SIZE;
        }

        const processedCount = cache.processedFiles.length;
        const totalFiles = cache.totalFiles || processedCount;

        // 基于总文件数量动态调整批量大小
        if (totalFiles < 100) {
            return this.MIN_BATCH_SIZE; // 小文件夹使用小批量
        } else if (totalFiles < 1000) {
            return Math.min(50, this.MAX_BATCH_SIZE); // 中等文件夹
        } else {
            return this.MAX_BATCH_SIZE; // 大文件夹使用大批量
        }
    }

    /**
     * 记录文件已处理 - 智能批量更新进度
     */
    async recordFileProcessed(file: PhotoFileRequest): Promise<void> {
        if (!this.cache) {
            await this.initialize();
        }

        const cache = this.cache;
        if (!cache) {
            throw new Error("Failed to initialize cache");
        }

        // 只存储文件名，不存储完整路径（节省空间）
        const fileName = path.basename(file.path);
        cache.processedFiles.push(fileName);
        cache.fileCount = cache.processedFiles.length;
        cache.lastUpdate = Date.now();
        this.processedSinceLastUpdate++;

        // 如果是缩略图生成成功，增加计数
        if (file.thumbnail) {
            cache.thumbnailsGenerated++;
        }

        // 标记需要更新
        this.pendingUpdates = true;

        // 动态批量大小策略
        const dynamicBatchSize = this.calculateDynamicBatchSize();
        const shouldForceUpdate = this.processedSinceLastUpdate >= dynamicBatchSize;

        if (shouldForceUpdate) {
            // 达到动态批量大小，立即更新
            this.logger.debug(
                `[IncrementalCache] 达到动态批量大小 ${dynamicBatchSize}，立即更新缓存`,
            );
            await this.flushUpdates();
        } else if (!this.updateTimer) {
            // 设置定时器，避免频繁IO
            this.updateTimer = setTimeout(() => {
                this.flushUpdates();
            }, this.UPDATE_INTERVAL);
        }

        this.logger.debug(
            `[IncrementalCache] 已处理: ${fileName}, 总进度: ${cache.processedFiles.length}, 批量计数: ${this.processedSinceLastUpdate}/${dynamicBatchSize}`,
        );
    }

    /**
     * 批量刷新更新到磁盘
     */
    private async flushUpdates(): Promise<void> {
        this.logger.debug(
            `[IncrementalCache] flushUpdates 被调用, pendingUpdates: ${this.pendingUpdates}, cache存在: ${!!this.cache}`,
        );

        if (this.pendingUpdates && this.cache) {
            try {
                this.logger.debug(`[IncrementalCache] 开始刷新更新到磁盘`);
                await this.saveCache();
                this.pendingUpdates = false;
                this.processedSinceLastUpdate = 0; // 重置批量计数器
                this.logger.debug(
                    `[IncrementalCache] 缓存已更新, 已处理 ${this.cache.processedFiles.length} 个文件`,
                );
            } catch (error) {
                this.logger.error(`[IncrementalCache] 保存缓存失败: ${error}`);
            }
        } else {
            this.logger.debug(`[IncrementalCache] flushUpdates 跳过 - 无待处理更新或缓存不存在`);
        }
        this.updateTimer = null;
    }

    /**
     * 检查文件是否已处理（用于断点续扫）
     */
    isFileProcessed(filePath: string): boolean {
        if (!this.cache) {
            return false;
        }
        const fileName = path.basename(filePath);
        return this.cache.processedFiles.includes(fileName);
    }

    /**
     * 获取待处理文件列表（断点续扫）
     */
    getPendingFiles(): string[] {
        return this.cache?.pendingFiles || [];
    }

    /**
     * 设置待处理文件列表
     */
    async setPendingFiles(files: string[]): Promise<void> {
        if (!this.cache) {
            await this.initialize();
        }

        const cache = this.cache;
        if (!cache) {
            throw new Error("Failed to initialize cache");
        }

        cache.pendingFiles = files;
        // 设置总文件数用于进度计算
        cache.totalFiles = cache.processedFiles.length + files.length;
        await this.saveCache();
    }

    /**
     * 标记扫描完成
     */
    async markScanComplete(): Promise<void> {
        if (!this.cache) {
            return;
        }

        this.cache.inProgress = false;
        this.cache.scanCompleted = true;
        this.cache.scanDuration = Date.now() - (this.cache.scanStartTime || Date.now());
        this.cache.lastScan = Date.now();
        this.cache.pendingFiles = []; // 清空待处理列表

        // 立即保存最终状态
        await this.flushUpdates();
        await this.saveCache();

        this.logger.info(
            `[IncrementalCache] 扫描完成: 处理 ${this.cache.processedFiles.length} 个文件, ` +
                `耗时 ${this.cache.scanDuration}ms`,
        );
    }

    /**
     * 记录错误
     */
    async recordError(error: string): Promise<void> {
        if (!this.cache) {
            await this.initialize();
        }

        const cache = this.cache;
        if (!cache) {
            throw new Error("Failed to initialize cache");
        }

        cache.errors.push(error);
        this.pendingUpdates = true;
    }

    /**
     * 保存缓存到文件
     */
    private async saveCache(): Promise<void> {
        if (!this.cache) {
            this.logger.warn(`[IncrementalCache] saveCache 被调用但 cache 为空`);
            return;
        }

        try {
            this.logger.debug(`[IncrementalCache] 准备保存缓存到: ${this.cacheFilePath}`);
            // 使用紧凑的JSON格式，不包含缩进和换行，减少文件大小
            const content = JSON.stringify(this.cache);
            this.logger.debug(`[IncrementalCache] 缓存内容长度: ${content.length} 字符`);

            // 确保目录存在
            const cacheDir = path.dirname(this.cacheFilePath);
            await fs.ensureDir(cacheDir);
            this.logger.debug(`[IncrementalCache] 确保目录存在: ${cacheDir}`);

            // 使用原子写入，避免损坏
            const tempFile = `${this.cacheFilePath}.tmp`;
            this.logger.debug(`[IncrementalCache] 写入临时文件: ${tempFile}`);
            await fs.writeFile(tempFile, content, "utf8");

            // 验证临时文件是否成功写入
            const tempExists = await fs.pathExists(tempFile);
            if (!tempExists) {
                throw new Error(`临时文件写入失败: ${tempFile}`);
            }

            this.logger.debug(`[IncrementalCache] 重命名到最终文件: ${this.cacheFilePath}`);
            try {
                await fs.rename(tempFile, this.cacheFilePath);
            } catch (renameError) {
                this.logger.warn(`[IncrementalCache] 原子重命名失败，使用备用方法: ${renameError}`);
                // 备用策略：直接写入最终文件，然后删除临时文件
                try {
                    await fs.copy(tempFile, this.cacheFilePath, { overwrite: true });
                    await fs.remove(tempFile);
                    this.logger.debug(`[IncrementalCache] 使用复制+删除策略成功保存缓存`);
                } catch (copyError) {
                    this.logger.warn(`[IncrementalCache] 复制策略也失败，直接写入: ${copyError}`);
                    // 最后的备用策略：直接写入（不是原子的，但总比失败好）
                    await fs.writeFile(this.cacheFilePath, content, "utf8");
                    // 尝试清理临时文件
                    try {
                        await fs.remove(tempFile);
                    } catch {
                        // 忽略清理失败
                    }
                }
            }

            // 验证文件是否真的存在
            const exists = await fs.pathExists(this.cacheFilePath);
            this.logger.info(
                `[IncrementalCache] 缓存文件保存${exists ? "成功" : "失败"}: ${this.cacheFilePath}`,
            );

            // Windows下隐藏文件
            if (process.platform === "win32") {
                try {
                    const { exec } = await import("child_process");
                    const { promisify } = await import("util");
                    const execAsync = promisify(exec);
                    await execAsync(`attrib +H "${this.cacheFilePath}"`);
                } catch {
                    // 忽略隐藏失败
                }
            }
        } catch (error) {
            this.logger.error(`[IncrementalCache] 保存缓存失败: ${error}`);
            throw error;
        }
    }

    /**
     * 清理资源
     */
    async cleanup(): Promise<void> {
        // 清除定时器
        if (this.updateTimer) {
            clearTimeout(this.updateTimer);
            this.updateTimer = null;
        }

        // 保存最后的更新
        await this.flushUpdates();
    }

    /**
     * 获取扫描进度百分比
     */
    getProgress(): number {
        if (!this.cache) {
            return 0;
        }

        // 使用 totalFiles 进行进度计算（如果可用）
        const total =
            this.cache.totalFiles ||
            this.cache.processedFiles.length + (this.cache.pendingFiles?.length || 0);

        if (total === 0) {
            return 0;
        }
        return Math.round((this.cache.processedFiles.length / total) * 100);
    }

    /**
     * 获取缓存统计信息
     */
    getStats(): {
        processedCount: number;
        pendingCount: number;
        errorCount: number;
        duration: number;
        progress: number;
        performanceMetrics: {
            updateFrequency: number; // 更新频率（次/秒）
            avgBatchSize: number; // 平均批量大小
            cacheFileSize: number; // 缓存文件大小（字节）
        };
    } {
        if (!this.cache) {
            return {
                processedCount: 0,
                pendingCount: 0,
                errorCount: 0,
                duration: 0,
                progress: 0,
                performanceMetrics: {
                    updateFrequency: 0,
                    avgBatchSize: 0,
                    cacheFileSize: 0,
                },
            };
        }

        const duration = Date.now() - (this.cache.scanStartTime || Date.now());
        const processedCount = this.cache.processedFiles.length;

        return {
            processedCount,
            pendingCount: this.cache.pendingFiles?.length || 0,
            errorCount: this.cache.errors.length,
            duration,
            progress: this.getProgress(),
            performanceMetrics: {
                updateFrequency: duration > 0 ? processedCount / (duration / 1000) : 0,
                avgBatchSize: this.calculateDynamicBatchSize(),
                cacheFileSize: JSON.stringify(this.cache).length,
            },
        };
    }
}

/**
 * 集成到现有扫描流程的辅助函数
 */
export async function withIncrementalCache<T>(
    folderPath: string,
    logger: PhotasaLogger,
    scanFunction: (cacheManager: IncrementalCacheManager) => Promise<T>,
): Promise<T> {
    const cacheManager = new IncrementalCacheManager(folderPath, logger);

    try {
        await cacheManager.initialize();
        const result = await scanFunction(cacheManager);
        await cacheManager.markScanComplete();
        return result;
    } catch (error) {
        logger.error(`[withIncrementalCache] 扫描失败: ${error}`);
        throw error;
    } finally {
        await cacheManager.cleanup();
    }
}

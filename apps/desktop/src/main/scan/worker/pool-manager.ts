/**
 * pool-manager.ts
 *
 * 统一的Worker池管理器
 * RFC 0029: Worker池管理统一化
 *
 * 功能：
 * - 提供全局唯一的Worker池实例
 * - 统一的Worker池配置管理
 * - 优化的错误处理和超时机制
 * - 完整的生命周期管理
 * - 详细的统计信息和监控
 */

import { WorkerPool } from "../../workers/worker-pool";
import type { ThumbnailRequest, ThumbnailResponse } from "@photasa/common";
import type { WorkerOptions } from "worker_threads";
import type { Worker as NodeWorker } from "worker_threads";
import { PhotasaLogger } from "@photasa/common";
import { cpus } from "os";
import createWorker from "../../thumbnail/thumbnail-worker?nodeWorker";

/**
 * 缩略图Worker池配置
 */
export interface ThumbnailWorkerConfig {
    /** Worker实例的最小数量 */
    minWorkers: number;
    /** Worker实例的最大数量 */
    maxWorkers: number;
    /** Worker工厂函数 */
    createWorker: (options?: unknown) => NodeWorker;
    /** Worker配置选项 */
    workerOptions?: WorkerOptions;
    /** 任务队列最大长度 */
    maxQueueSize?: number;
    /** Worker空闲超时时间（毫秒） */
    idleTimeout?: number;
}

/**
 * Worker池状态枚举
 */
export enum PoolStatus {
    UNINITIALIZED = "uninitialized",
    INITIALIZING = "initializing",
    RUNNING = "running",
    SHUTTING_DOWN = "shutting_down",
    SHUTDOWN = "shutdown",
    ERROR = "error",
}

/**
 * Worker池统计信息
 */
export interface PoolStats {
    /** 池状态 */
    status: PoolStatus;
    /** 活跃Worker数量 */
    activeWorkers: number;
    /** 空闲Worker数量 */
    idleWorkers: number;
    /** 队列中的任务数量 */
    queuedTasks: number;
    /** 已完成的任务总数 */
    completedTasks: number;
    /** 失败的任务总数 */
    failedTasks: number;
    /** 创建时间 */
    createdAt: number;
    /** 最后活跃时间 */
    lastActiveAt: number;
}

/**
 * 默认缩略图Worker池配置
 */
export const DEFAULT_THUMBNAIL_WORKER_CONFIG: ThumbnailWorkerConfig = {
    minWorkers: 1,
    maxWorkers: Math.min(4, Math.max(2, Math.floor((cpus()?.length || 4) / 2))),
    createWorker: (options?: unknown) => createWorker(options as WorkerOptions),
    workerOptions: {
        resourceLimits: {
            maxOldGenerationSizeMb: 100,
            maxYoungGenerationSizeMb: 50,
        },
    },
    maxQueueSize: 1000,
    idleTimeout: 30000, // 30秒
};

/**
 * Worker池管理器类
 *
 * 提供全局唯一的Worker池管理，确保资源的合理利用和统一的生命周期管理
 */
class WorkerPoolManager {
    private static instance: WorkerPoolManager | null = null;
    private workerPool: WorkerPool<ThumbnailRequest, ThumbnailResponse> | null = null;
    private status: PoolStatus = PoolStatus.UNINITIALIZED;
    private stats: PoolStats;
    private logger: PhotasaLogger | null = null;
    private config: ThumbnailWorkerConfig = DEFAULT_THUMBNAIL_WORKER_CONFIG;

    private constructor() {
        this.stats = {
            status: PoolStatus.UNINITIALIZED,
            activeWorkers: 0,
            idleWorkers: 0,
            queuedTasks: 0,
            completedTasks: 0,
            failedTasks: 0,
            createdAt: Date.now(),
            lastActiveAt: Date.now(),
        };
    }

    /**
     * 获取Worker池管理器单例实例
     */
    public static getInstance(): WorkerPoolManager {
        if (!WorkerPoolManager.instance) {
            WorkerPoolManager.instance = new WorkerPoolManager();
        }
        return WorkerPoolManager.instance;
    }

    /**
     * 获取Worker池实例
     *
     * @param logger - 日志记录器
     * @param config - 可选的配置覆盖
     * @returns Worker池实例，测试环境下返回null
     */
    public getWorkerPool(
        logger: PhotasaLogger,
        config?: Partial<ThumbnailWorkerConfig>,
    ): WorkerPool<ThumbnailRequest, ThumbnailResponse> {
        this.logger = logger;

        // 应用配置覆盖
        if (config) {
            this.config = { ...this.config, ...config };
        }

        // 如果已经 shutdown，尝试重新初始化
        if (this.status === PoolStatus.SHUTDOWN) {
            logger.info("[WorkerPoolManager] Worker池已关闭，尝试重新初始化");
            this.status = PoolStatus.UNINITIALIZED;
            this.workerPool = null;
        }

        // 懒加载：仅在首次调用时创建Worker池
        if (!this.workerPool && this.status === PoolStatus.UNINITIALIZED) {
            this.initializeWorkerPool(logger);
        }

        // Worker池必须存在，如果不存在说明初始化失败，抛出错误
        if (!this.workerPool) {
            const error = new Error(
                "[WorkerPoolManager] Worker池初始化失败：无法创建Worker池实例。这通常表示系统资源不足或Worker模块加载失败。",
            );
            logger.error(error.message);
            throw error;
        }

        return this.workerPool;
    }

    /**
     * 初始化Worker池
     */
    private initializeWorkerPool(logger: PhotasaLogger): void {
        try {
            this.status = PoolStatus.INITIALIZING;
            this.stats.status = PoolStatus.INITIALIZING;

            logger.info("[WorkerPoolManager] 创建新的Worker池实例", {
                maxWorkers: this.config.maxWorkers,
                maxQueueSize: this.config.maxQueueSize,
                idleTimeout: this.config.idleTimeout,
            });

            this.workerPool = new WorkerPool(this.config, logger);

            this.status = PoolStatus.RUNNING;
            this.stats.status = PoolStatus.RUNNING;
            this.stats.lastActiveAt = Date.now();

            logger.info("[WorkerPoolManager] Worker池初始化成功");
        } catch (error) {
            this.status = PoolStatus.ERROR;
            this.stats.status = PoolStatus.ERROR;
            logger.error("[WorkerPoolManager] Worker池初始化失败", error);
            throw error;
        }
    }

    /**
     * 关闭Worker池
     *
     * @param timeout - 关闭超时时间（毫秒）
     * @returns 关闭是否成功
     */
    public async shutdownWorkerPool(timeout = 5000): Promise<boolean> {
        if (!this.workerPool || this.status === PoolStatus.SHUTDOWN) {
            return true;
        }

        try {
            this.status = PoolStatus.SHUTTING_DOWN;
            this.stats.status = PoolStatus.SHUTTING_DOWN;

            this.logger?.debug("[WorkerPoolManager] 开始关闭Worker池");

            // 使用超时机制确保关闭不会无限等待
            const shutdownPromise = this.workerPool.shutdown();
            const timeoutPromise = new Promise<boolean>((resolve) =>
                setTimeout(() => resolve(false), timeout),
            );

            const result = await Promise.race([shutdownPromise, timeoutPromise]);

            if (result === false) {
                // 超时情况
                this.status = PoolStatus.ERROR;
                this.stats.status = PoolStatus.ERROR;
                this.logger?.warn("[WorkerPoolManager] Worker池关闭超时");
                return false;
            }

            this.status = PoolStatus.SHUTDOWN;
            this.stats.status = PoolStatus.SHUTDOWN;
            this.workerPool = null;

            this.logger?.info("[WorkerPoolManager] Worker池已成功关闭");
            return true;
        } catch (error) {
            this.status = PoolStatus.ERROR;
            this.stats.status = PoolStatus.ERROR;
            this.logger?.error("[WorkerPoolManager] Worker池关闭失败", error);
            return false;
        }
    }

    /**
     * 检查Worker池是否可用
     */
    public isWorkerPoolAvailable(): boolean {
        return this.workerPool !== null && this.status === PoolStatus.RUNNING;
    }

    /**
     * 获取Worker池状态
     */
    public getStatus(): PoolStatus {
        return this.status;
    }

    /**
     * 获取Worker池统计信息
     */
    public getStats(): PoolStats {
        // 如果Worker池可用，更新实时统计信息
        if (this.workerPool && this.status === PoolStatus.RUNNING) {
            // 这里可以从WorkerPool实例获取更详细的统计信息
            // 目前先更新时间戳
            this.stats.lastActiveAt = Date.now();
        }

        return { ...this.stats };
    }

    /**
     * 重置Worker池管理器
     * 主要用于测试和异常恢复
     */
    public async reset(): Promise<void> {
        if (this.workerPool) {
            await this.shutdownWorkerPool();
        }

        this.status = PoolStatus.UNINITIALIZED;
        this.stats = {
            status: PoolStatus.UNINITIALIZED,
            activeWorkers: 0,
            idleWorkers: 0,
            queuedTasks: 0,
            completedTasks: 0,
            failedTasks: 0,
            createdAt: Date.now(),
            lastActiveAt: Date.now(),
        };

        this.logger?.info("[WorkerPoolManager] Worker池管理器已重置");
    }

    /**
     * 更新配置
     * 注意：只能在Worker池未初始化时更新配置
     */
    public updateConfig(config: Partial<ThumbnailWorkerConfig>): boolean {
        if (this.status !== PoolStatus.UNINITIALIZED) {
            this.logger?.warn("[WorkerPoolManager] 无法更新配置：Worker池已初始化");
            return false;
        }

        this.config = { ...this.config, ...config };
        this.logger?.debug("[WorkerPoolManager] 配置已更新", config);
        return true;
    }

    /**
     * 获取当前配置
     */
    public getConfig(): ThumbnailWorkerConfig {
        return { ...this.config };
    }
}

// 导出便利函数

/**
 * 获取Worker池实例
 * 这是最常用的API，提供简洁的访问方式
 */
export function getWorkerPool(
    logger: PhotasaLogger,
    config?: Partial<ThumbnailWorkerConfig>,
): WorkerPool<ThumbnailRequest, ThumbnailResponse> {
    return WorkerPoolManager.getInstance().getWorkerPool(logger, config);
}

/**
 * 关闭Worker池
 */
export async function shutdownWorkerPool(timeout = 5000): Promise<boolean> {
    return WorkerPoolManager.getInstance().shutdownWorkerPool(timeout);
}

/**
 * 检查Worker池是否可用
 */
export function isWorkerPoolAvailable(): boolean {
    return WorkerPoolManager.getInstance().isWorkerPoolAvailable();
}

/**
 * 获取Worker池状态
 */
export function getWorkerPoolStatus(): PoolStatus {
    return WorkerPoolManager.getInstance().getStatus();
}

/**
 * 获取Worker池统计信息
 */
export function getWorkerPoolStats(): PoolStats {
    return WorkerPoolManager.getInstance().getStats();
}

/**
 * 重置Worker池管理器（主要用于测试）
 */
export async function resetWorkerPoolManager(): Promise<void> {
    return WorkerPoolManager.getInstance().reset();
}

/**
 * 更新Worker池配置
 */
export function updateWorkerPoolConfig(config: Partial<ThumbnailWorkerConfig>): boolean {
    return WorkerPoolManager.getInstance().updateConfig(config);
}

/**
 * 获取Worker池配置
 */
export function getWorkerPoolConfig(): ThumbnailWorkerConfig {
    return WorkerPoolManager.getInstance().getConfig();
}

// 导出清理相关的函数（从scan-cleanup.ts迁移）

/**
 * Worker池清理函数
 * 从scan-cleanup.ts迁移而来，现在使用统一的Worker池管理器
 */
export async function cleanupWorkerPool(
    workerPool: WorkerPool<ThumbnailRequest, ThumbnailResponse> | null,
    timeout: number,
    logger: PhotasaLogger,
): Promise<boolean> {
    // 如果传入了具体的workerPool实例，直接使用该实例的关闭方法
    if (workerPool) {
        try {
            logger.debug("[cleanupWorkerPool] 开始关闭传入的Worker池实例");

            const shutdownPromise = workerPool.shutdown();
            const timeoutPromise = new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error("Worker池关闭超时")), timeout),
            );

            await Promise.race([shutdownPromise, timeoutPromise]);

            logger.info("[cleanupWorkerPool] Worker池已成功关闭");
            return true;
        } catch (error) {
            logger.error("[cleanupWorkerPool] Worker池关闭失败", error);
            return false;
        }
    }

    // 否则使用全局的Worker池管理器
    const manager = WorkerPoolManager.getInstance();
    // 如果管理器没有worker池，直接返回true（表示清理成功）
    if (!manager.isWorkerPoolAvailable()) {
        logger.debug("[cleanupWorkerPool] 没有可用的Worker池需要清理");
        return true;
    }

    return manager.shutdownWorkerPool(timeout);
}

export { WorkerPoolManager };
export default WorkerPoolManager;

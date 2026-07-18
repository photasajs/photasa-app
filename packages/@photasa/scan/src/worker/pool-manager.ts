/**
 * pool-manager.ts
 *
 * @photasa/scan 包内的 Worker池管理器接口存根
 *
 * 注意：实际的 WorkerPoolManager（依赖 Electron 的 ?nodeWorker Vite 导入）
 * 位于 apps/desktop。本文件仅提供类型和轻量实现供 scan 包内部使用，
 * 不依赖任何 Electron 或 Vite 特定 API。
 */

import type { ThumbnailRequest, ThumbnailResponse } from "@photasa/common";
import type { WorkerPool } from "../scan-helpers";

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
    status: PoolStatus;
    activeWorkers: number;
    idleWorkers: number;
    queuedTasks: number;
    completedTasks: number;
    failedTasks: number;
    createdAt: number;
    lastActiveAt: number;
}

/**
 * 缩略图Worker池配置
 */
export interface ThumbnailWorkerConfig {
    minWorkers: number;
    maxWorkers: number;
    createWorker: (options?: unknown) => unknown;
    maxQueueSize?: number;
    idleTimeout?: number;
}

/**
 * 获取Worker池实例的便利函数类型
 * 实际实现在 apps/desktop 中；此签名用于测试类型兼容性
 */
export function getWorkerPool(
    _logger: unknown,
    _config?: Partial<ThumbnailWorkerConfig>,
): WorkerPool<ThumbnailRequest, ThumbnailResponse> {
    throw new Error(
        "getWorkerPool 不可在 @photasa/scan 包内直接调用；请使用 apps/desktop 中的实现",
    );
}

export async function shutdownWorkerPool(_timeout?: number): Promise<boolean> {
    return true;
}

export function isWorkerPoolAvailable(): boolean {
    return false;
}

export function getWorkerPoolStatus(): PoolStatus {
    return PoolStatus.UNINITIALIZED;
}

export function getWorkerPoolStats(): PoolStats {
    return {
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

export async function resetWorkerPoolManager(): Promise<void> {
    // 存根：实际实现在 apps/desktop
}

export function updateWorkerPoolConfig(_config: Partial<ThumbnailWorkerConfig>): boolean {
    return false;
}

export function getWorkerPoolConfig(): ThumbnailWorkerConfig {
    return {
        minWorkers: 1,
        maxWorkers: 4,
        createWorker: () => {
            throw new Error("存根实现");
        },
    };
}

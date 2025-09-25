/**
 * pool-manager.test.ts
 *
 * Worker池管理器统一测试
 * RFC 0029: Worker池管理统一化
 *
 * 测试覆盖：
 * - 单例模式行为验证
 * - Worker池生命周期管理
 * - 配置管理和更新
 * - 状态和统计信息
 * - 错误处理和超时机制
 * - 测试环境兼容性
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
    getWorkerPool,
    shutdownWorkerPool,
    isWorkerPoolAvailable,
    getWorkerPoolStatus,
    getWorkerPoolStats,
    resetWorkerPoolManager,
    updateWorkerPoolConfig,
    getWorkerPoolConfig,
    cleanupWorkerPool,
    PoolStatus,
    DEFAULT_THUMBNAIL_WORKER_CONFIG,
    type ThumbnailWorkerConfig,
} from "../pool-manager";
import { PhotasaLogger } from "@common/logger";

// Mock dependencies
vi.mock("../../workers/worker-pool", () => ({
    WorkerPool: vi.fn().mockImplementation(() => ({
        shutdown: vi.fn().mockResolvedValue(void 0),
        addTask: vi.fn().mockResolvedValue({}),
        getStats: vi.fn().mockReturnValue({
            activeWorkers: 2,
            idleWorkers: 1,
            queuedTasks: 0,
        }),
    })),
}));

vi.mock("../../thumbnail/thumbnail-worker?nodeWorker", () => ({
    default: vi.fn().mockReturnValue({}),
}));

vi.mock("os", () => ({
    cpus: vi.fn().mockReturnValue([{}, {}, {}, {}]), // 模拟4核CPU
}));

describe("WorkerPoolManager", () => {
    let mockLogger: PhotasaLogger;

    beforeEach(async () => {
        // 重置Worker池管理器状态
        await resetWorkerPoolManager();

        // 创建mock logger
        mockLogger = {
            debug: vi.fn(),
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
        } as any;

        // 重置环境变量
        delete process.env.NODE_ENV;
        delete process.env.VITEST;
    });

    afterEach(async () => {
        // 清理Worker池管理器
        await resetWorkerPoolManager();
        vi.clearAllMocks();
    });

    describe("单例模式", () => {
        it("应该返回相同的Worker池实例", () => {
            const pool1 = getWorkerPool(mockLogger);
            const pool2 = getWorkerPool(mockLogger);

            expect(pool1).toBe(pool2);
        });

        it("测试环境下应该返回null", () => {
            process.env.NODE_ENV = "test";
            const pool = getWorkerPool(mockLogger);

            expect(pool).toBeNull();
            expect(mockLogger.debug).toHaveBeenCalledWith(
                expect.stringContaining("跳过Worker池创建（测试环境）"),
            );
        });

        it("VITEST环境下应该返回null", () => {
            process.env.VITEST = "true";
            const pool = getWorkerPool(mockLogger);

            expect(pool).toBeNull();
        });
    });

    describe("配置管理", () => {
        it("应该返回默认配置", () => {
            const config = getWorkerPoolConfig();

            expect(config).toEqual(DEFAULT_THUMBNAIL_WORKER_CONFIG);
            expect(config.maxWorkers).toBeGreaterThan(0);
            expect(config.maxQueueSize).toBeGreaterThan(0);
            expect(config.idleTimeout).toBeGreaterThan(0);
        });

        it("应该能更新配置（未初始化状态）", () => {
            const customConfig: Partial<ThumbnailWorkerConfig> = {
                maxWorkers: 8,
                maxQueueSize: 2000,
                idleTimeout: 60000,
            };

            const result = updateWorkerPoolConfig(customConfig);
            expect(result).toBe(true);

            const updatedConfig = getWorkerPoolConfig();
            expect(updatedConfig.maxWorkers).toBe(8);
            expect(updatedConfig.maxQueueSize).toBe(2000);
            expect(updatedConfig.idleTimeout).toBe(60000);
        });

        it("初始化后不应该能更新配置", () => {
            // 先初始化Worker池
            getWorkerPool(mockLogger);

            const customConfig: Partial<ThumbnailWorkerConfig> = {
                maxWorkers: 8,
            };

            const result = updateWorkerPoolConfig(customConfig);
            expect(result).toBe(false);
            expect(mockLogger.warn).toHaveBeenCalledWith(
                expect.stringContaining("无法更新配置：Worker池已初始化"),
            );
        });
    });

    describe("状态管理", () => {
        it("初始状态应该是UNINITIALIZED", () => {
            const status = getWorkerPoolStatus();
            expect(status).toBe(PoolStatus.UNINITIALIZED);
        });

        it("获取Worker池后状态应该是RUNNING", () => {
            getWorkerPool(mockLogger);
            const status = getWorkerPoolStatus();
            expect(status).toBe(PoolStatus.RUNNING);
        });

        it("测试环境下状态应该保持UNINITIALIZED", () => {
            process.env.NODE_ENV = "test";
            getWorkerPool(mockLogger);
            const status = getWorkerPoolStatus();
            expect(status).toBe(PoolStatus.UNINITIALIZED);
        });

        it("应该正确检查Worker池可用性", async () => {
            expect(isWorkerPoolAvailable()).toBe(false);

            getWorkerPool(mockLogger);
            expect(isWorkerPoolAvailable()).toBe(true);

            process.env.NODE_ENV = "test";
            await resetWorkerPoolManager();
            getWorkerPool(mockLogger);
            expect(isWorkerPoolAvailable()).toBe(false);
        });
    });

    describe("统计信息", () => {
        it("应该返回初始统计信息", () => {
            const stats = getWorkerPoolStats();

            expect(stats.status).toBe(PoolStatus.UNINITIALIZED);
            expect(stats.activeWorkers).toBe(0);
            expect(stats.idleWorkers).toBe(0);
            expect(stats.queuedTasks).toBe(0);
            expect(stats.completedTasks).toBe(0);
            expect(stats.failedTasks).toBe(0);
            expect(stats.createdAt).toBeGreaterThan(0);
            expect(stats.lastActiveAt).toBeGreaterThan(0);
        });

        it("Worker池运行时应该更新lastActiveAt", () => {
            getWorkerPool(mockLogger);

            const stats1 = getWorkerPoolStats();
            const initialTime = stats1.lastActiveAt;

            // 稍等一下然后再次获取统计
            setTimeout(() => {
                const stats2 = getWorkerPoolStats();
                expect(stats2.lastActiveAt).toBeGreaterThanOrEqual(initialTime);
            }, 10);
        });
    });

    describe("生命周期管理", () => {
        it("应该能正常关闭Worker池", async () => {
            const pool = getWorkerPool(mockLogger);
            expect(pool).not.toBeNull();

            const result = await shutdownWorkerPool();
            expect(result).toBe(true);

            expect(getWorkerPoolStatus()).toBe(PoolStatus.SHUTDOWN);
            expect(isWorkerPoolAvailable()).toBe(false);
        });

        it("关闭不存在的Worker池应该返回true", async () => {
            const result = await shutdownWorkerPool();
            expect(result).toBe(true);
        });

        it("应该能处理关闭超时", async () => {
            const { WorkerPool } = await import("../../../workers/worker-pool");
            const mockWorkerPool = new (WorkerPool as any)();

            // Mock shutdown方法返回永不resolve的Promise
            mockWorkerPool.shutdown = vi.fn(() => new Promise(() => {}));

            // Mock getWorkerPool返回这个会超时的实例
            vi.doMock("../pool-manager", async () => {
                const actual = await vi.importActual("../pool-manager");
                return {
                    ...actual,
                    getWorkerPool: () => mockWorkerPool,
                };
            });

            const result = await shutdownWorkerPool(100); // 100ms超时
            expect(result).toBe(false);
        }, 1000);

        it("应该能重置Worker池管理器", async () => {
            // 初始化Worker池
            getWorkerPool(mockLogger);
            expect(getWorkerPoolStatus()).toBe(PoolStatus.RUNNING);

            // 重置
            await resetWorkerPoolManager();

            expect(getWorkerPoolStatus()).toBe(PoolStatus.UNINITIALIZED);
            expect(isWorkerPoolAvailable()).toBe(false);
        });
    });

    describe("清理功能", () => {
        it("应该能清理空的Worker池", async () => {
            const result = await cleanupWorkerPool(null, 5000, mockLogger);
            expect(result).toBe(true);
        });

        it("应该能清理现有的Worker池", async () => {
            const pool = getWorkerPool(mockLogger);
            const result = await cleanupWorkerPool(pool, 5000, mockLogger);

            expect(result).toBe(true);
            expect(mockLogger.debug).toHaveBeenCalledWith(
                expect.stringContaining("开始关闭传入的Worker池实例"),
            );
            expect(mockLogger.info).toHaveBeenCalledWith(
                expect.stringContaining("Worker池已成功关闭"),
            );
        });

        it("清理失败时应该正确处理错误", async () => {
            const mockPool = {
                shutdown: vi.fn().mockRejectedValue(new Error("清理失败")),
            };

            const result = await cleanupWorkerPool(mockPool as any, 5000, mockLogger);

            expect(result).toBe(false);
            expect(mockLogger.error).toHaveBeenCalledWith(
                expect.stringContaining("Worker池关闭失败"),
                expect.any(Error),
            );
        });
    });

    describe("默认配置", () => {
        it("应该有合理的默认Worker数量", () => {
            const config = DEFAULT_THUMBNAIL_WORKER_CONFIG;

            expect(config.maxWorkers).toBeGreaterThanOrEqual(2);
            expect(config.maxWorkers).toBeLessThanOrEqual(4);
        });

        it("应该有合理的资源限制", () => {
            const config = DEFAULT_THUMBNAIL_WORKER_CONFIG;

            expect(config.workerOptions?.resourceLimits?.maxOldGenerationSizeMb).toBe(100);
            expect(config.workerOptions?.resourceLimits?.maxYoungGenerationSizeMb).toBe(50);
        });

        it("应该有合理的队列和超时配置", () => {
            const config = DEFAULT_THUMBNAIL_WORKER_CONFIG;

            expect(config.maxQueueSize).toBe(1000);
            expect(config.idleTimeout).toBe(30000); // 30秒
        });
    });

    describe("错误处理", () => {
        it("应该处理Worker池创建失败", async () => {
            // 模拟createWorker函数抛出错误
            const originalCreateWorker = vi.fn();
            vi.doMock("../../thumbnail/thumbnail-worker?nodeWorker", () => ({
                default: originalCreateWorker,
            }));

            originalCreateWorker.mockImplementationOnce(() => {
                throw new Error("Worker池创建失败");
            });

            expect(() => getWorkerPool(mockLogger)).toThrow("Worker池创建失败");
            expect(getWorkerPoolStatus()).toBe(PoolStatus.ERROR);
        });
    });
});

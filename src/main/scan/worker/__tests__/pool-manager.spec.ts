/**
 * pool-manager.spec.ts
 *
 * Worker池管理器Jest测试
 * 基于实际pool-manager.ts实现的简化测试
 */

// Jest globals are available without import when Jest types are configured
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
    WorkerPoolManager,
} from "../pool-manager";
import { PhotasaLogger } from "@common/logger";

// Mock thumbnail-worker?nodeWorker
// Use a manual mock that intercepts the import
const mockCreateWorker = jest.fn(() => ({
    postMessage: jest.fn(),
    on: jest.fn(),
    terminate: jest.fn(),
    ref: jest.fn(),
    unref: jest.fn(),
}));

// Mock the module before importing pool-manager
jest.mock(
    "../../thumbnail/thumbnail-worker",
    () => ({
        __esModule: true,
        default: mockCreateWorker,
    }),
    { virtual: true },
);

// Mock dependencies
jest.mock("../../../workers/worker-pool", () => ({
    WorkerPool: jest.fn().mockImplementation(() => ({
        shutdown: jest.fn().mockImplementation(() => Promise.resolve()),
        addTask: jest.fn().mockImplementation(() => Promise.resolve({})),
        getStats: jest.fn().mockReturnValue({
            activeWorkers: 2,
            idleWorkers: 1,
            queuedTasks: 0,
        }),
    })),
}));

jest.mock("os", () => ({
    cpus: jest.fn().mockReturnValue([{}, {}, {}, {}]), // 模拟4核CPU
}));

describe("WorkerPoolManager", () => {
    let mockLogger: PhotasaLogger;

    beforeEach(async () => {
        // 使用fake timers专注于逻辑测试
        jest.useFakeTimers();

        // 重置Worker池管理器状态
        await resetWorkerPoolManager();

        // 创建mock logger
        mockLogger = {
            info: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
            debug: jest.fn(),
        } as any;
    });

    afterEach(async () => {
        // 恢复真实timers
        jest.useRealTimers();

        // 清理测试环境
        await resetWorkerPoolManager();
    });

    describe("单例模式", () => {
        it("应该返回相同的实例", () => {
            const instance1 = WorkerPoolManager.getInstance();
            const instance2 = WorkerPoolManager.getInstance();
            expect(instance1).toBe(instance2);
        });

        it("应该能重置单例状态", async () => {
            await resetWorkerPoolManager();
            expect(getWorkerPoolStatus()).toBe(PoolStatus.UNINITIALIZED);
        });
    });

    describe("Worker池生命周期", () => {
        it("应该能创建Worker池（测试环境返回null）", async () => {
            const pool = await getWorkerPool(mockLogger);
            expect(pool).toBeNull();
            expect(isWorkerPoolAvailable()).toBe(false);
            expect(getWorkerPoolStatus()).toBe(PoolStatus.UNINITIALIZED);
        });

        it("应该能关闭Worker池", async () => {
            await getWorkerPool(mockLogger);
            expect(isWorkerPoolAvailable()).toBe(false);

            const result = await shutdownWorkerPool();
            expect(result).toBe(true);
            expect(isWorkerPoolAvailable()).toBe(false);
        });

        it("关闭不存在的Worker池应该返回true", async () => {
            const result = await shutdownWorkerPool();
            expect(result).toBe(true);
        });

        it("应该能重置Worker池管理器", async () => {
            await resetWorkerPoolManager();
            expect(getWorkerPoolStatus()).toBe(PoolStatus.UNINITIALIZED);
            expect(isWorkerPoolAvailable()).toBe(false);
        });
    });

    describe("配置管理", () => {
        it("应该能获取默认配置", () => {
            const config = getWorkerPoolConfig();
            expect(config).toBeDefined();
            expect(config.maxWorkers).toBeGreaterThan(0);
            expect(config.idleTimeout).toBeGreaterThan(0);
        });

        it("应该能更新配置", async () => {
            const newConfig = {
                maxWorkers: 3,
                minWorkers: 1,
                idleTimeout: 1000,
            };

            const result = updateWorkerPoolConfig(newConfig);
            expect(result).toBe(true);

            const updatedConfig = getWorkerPoolConfig();
            expect(updatedConfig.maxWorkers).toBe(3);
            expect(updatedConfig.idleTimeout).toBe(1000);
        });
    });

    describe("状态和统计", () => {
        it("应该能获取Worker池状态", () => {
            const status = getWorkerPoolStatus();
            expect(Object.values(PoolStatus)).toContain(status);
        });

        it("应该能获取Worker池统计信息", () => {
            const stats = getWorkerPoolStats();
            expect(stats).toBeDefined();
            expect(typeof stats.activeWorkers).toBe("number");
            expect(typeof stats.idleWorkers).toBe("number");
            expect(typeof stats.queuedTasks).toBe("number");
            expect(typeof stats.lastActiveAt).toBe("number");
        });
    });

    describe("错误处理", () => {
        it("应该处理Worker池创建失败", async () => {
            expect(() => getWorkerPool(mockLogger)).not.toThrow();
            expect(getWorkerPoolStatus()).toBe(PoolStatus.UNINITIALIZED);
        });
    });

    describe("清理功能", () => {
        it("应该能清理空的Worker池", async () => {
            const result = await cleanupWorkerPool(null, 100, mockLogger);
            expect(result).toBe(true);
        });

        it("应该能清理现有的Worker池", async () => {
            const mockPool = {
                shutdown: jest.fn().mockImplementation(() => Promise.resolve(true)),
            } as any;

            const result = await cleanupWorkerPool(mockPool, 100, mockLogger);
            expect(result).toBe(true);
            expect(mockPool.shutdown).toHaveBeenCalled();
        });

        it("清理失败时应该正确处理错误", async () => {
            const mockPool = {
                shutdown: jest.fn().mockImplementation(() => Promise.reject(new Error("清理失败"))),
            } as any;

            const result = await cleanupWorkerPool(mockPool, 100, mockLogger);
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

        it("应该有合理的默认空闲超时", () => {
            const config = DEFAULT_THUMBNAIL_WORKER_CONFIG;
            expect(config.idleTimeout).toBeGreaterThanOrEqual(30000);
            expect(config.idleTimeout).toBeLessThanOrEqual(300000);
        });
    });
});

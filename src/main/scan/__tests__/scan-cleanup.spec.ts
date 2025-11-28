import { describe, it, expect, beforeEach, afterEach, jest } from "@jest/globals";
import fs from "fs-extra";
import {
    validateCleanupOptions,
    createInitialCleanupStats,
    cleanupWorkerPool,
    cleanupInvalidCaches,
    optimizeMemory,
    generateCleanupReport,
    performExtendedCleanup,
    DEFAULT_CLEANUP_OPTIONS,
    type CleanupOptions,
} from "../scan-cleanup";
import type { PhotasaLogger } from "@common/logger";

// Mock pool-manager to avoid ?nodeWorker import issue
jest.mock("../worker/pool-manager", () => ({
    cleanupWorkerPool: jest.fn().mockResolvedValue(undefined),
    getWorkerPool: jest.fn(),
    shutdownWorkerPool: jest.fn(),
    isWorkerPoolAvailable: jest.fn(),
    getWorkerPoolStatus: jest.fn(),
    getWorkerPoolStats: jest.fn(),
    resetWorkerPoolManager: jest.fn(),
    updateWorkerPoolConfig: jest.fn(),
    getWorkerPoolConfig: jest.fn(),
    PoolStatus: {},
    DEFAULT_THUMBNAIL_WORKER_CONFIG: {},
    WorkerPoolManager: jest.fn(),
}), { virtual: true });

// Mock external dependencies
jest.mock("fs-extra");

const mockFs = fs as any;
const mockLogger: PhotasaLogger = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
} as any;

// Mock WorkerPool
const mockWorkerPool = {
    shutdown: jest.fn(),
};

describe("scan-cleanup", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.clearAllTimers();
        jest.useRealTimers();
    });

    describe("validateCleanupOptions", () => {
        it("应该验证有效的清理选项", () => {
            const result = validateCleanupOptions(DEFAULT_CLEANUP_OPTIONS);
            expect(result.isValid).toBe(true);
            expect(result.error).toBeUndefined();
        });

        it("应该拒绝负数的Worker关闭超时", () => {
            const options = { ...DEFAULT_CLEANUP_OPTIONS, workerShutdownTimeout: -1000 };
            const result = validateCleanupOptions(options);

            expect(result.isValid).toBe(false);
            expect(result.error).toBe("Worker关闭超时时间不能为负数");
        });

        it("应该拒绝负数的缓存保留时间", () => {
            const options = { ...DEFAULT_CLEANUP_OPTIONS, maxCacheAge: -1000 };
            const result = validateCleanupOptions(options);

            expect(result.isValid).toBe(false);
            expect(result.error).toBe("缓存最大保留时间不能为负数");
        });

        it("应该拒绝无效的日志级别", () => {
            const options = { ...DEFAULT_CLEANUP_OPTIONS, logLevel: "invalid" as any };
            const result = validateCleanupOptions(options);

            expect(result.isValid).toBe(false);
            expect(result.error).toBe("日志级别必须为 'minimal' 或 'detailed'");
        });
    });

    describe("createInitialCleanupStats", () => {
        it("应该创建正确的初始统计对象", () => {
            const stats = createInitialCleanupStats();

            expect(stats.startTime).toBeGreaterThan(0);
            expect(stats.endTime).toBe(0);
            expect(stats.duration).toBe(0);
            expect(stats.workerPoolShutdown).toBe(false);
            expect(stats.cacheFilesProcessed).toBe(0);
            expect(stats.invalidCacheFilesRemoved).toBe(0);
            expect(stats.memoryFreed).toBe(0);
            expect(stats.errors).toEqual([]);
        });
    });

    describe("cleanupWorkerPool", () => {
        it("应该在没有Worker Pool时返回true", async () => {
            const result = await cleanupWorkerPool(null, 5000, mockLogger);
            expect(result).toBe(true);
        });

        it("应该成功关闭Worker Pool", async () => {
            (mockWorkerPool.shutdown as jest.MockedFunction<() => Promise<void>>).mockResolvedValue(
                undefined,
            );

            const result = await cleanupWorkerPool(mockWorkerPool as any, 5000, mockLogger);

            expect(result).toBe(true);
            expect(mockWorkerPool.shutdown).toHaveBeenCalled();
            expect(mockLogger.info).toHaveBeenCalledWith("[cleanupWorkerPool] Worker池已成功关闭");
        });

        it("应该处理Worker Pool关闭失败", async () => {
            const error = new Error("Shutdown failed");
            (mockWorkerPool.shutdown as jest.MockedFunction<() => Promise<void>>).mockRejectedValue(
                error,
            );

            const result = await cleanupWorkerPool(mockWorkerPool as any, 5000, mockLogger);

            expect(result).toBe(false);
            expect(mockLogger.error).toHaveBeenCalledWith(
                "[cleanupWorkerPool] Worker池关闭失败",
                error,
            );
        });

        it("应该处理超时情况", async () => {
            // 模拟一个延时很长的Promise来触发超时
            mockWorkerPool.shutdown.mockImplementation(
                () =>
                    new Promise((resolve) => {
                        setTimeout(() => resolve(undefined), 5000); // 5秒后才解决，但超时是100ms
                    }),
            );

            // 启动cleanup并立即推进所有计时器
            const cleanupPromise = cleanupWorkerPool(mockWorkerPool as any, 100, mockLogger);
            await jest.runAllTimersAsync();
            const result = await cleanupPromise;

            expect(result).toBe(false);
            expect(mockLogger.error).toHaveBeenCalledWith(
                "[cleanupWorkerPool] Worker池关闭失败",
                expect.any(Error),
            );
        });
    });

    describe("cleanupInvalidCaches", () => {
        beforeEach(() => {
            // Mock fs.readdir to return empty results for most paths
            mockFs.readdir.mockResolvedValue([]);
        });

        it("应该处理没有缓存文件的情况", async () => {
            const result = await cleanupInvalidCaches("/test/path", 86400000, mockLogger);

            expect(result.processed).toBe(0);
            expect(result.removed).toBe(0);
            expect(result.errors).toEqual([]);
        });

        it("应该删除过期的缓存文件", async () => {
            // 模拟找到缓存文件
            mockFs.readdir
                .mockResolvedValueOnce([
                    { name: ".photasa-folder.json", isDirectory: () => false, isFile: () => true },
                ])
                .mockResolvedValue([]); // 其他调用返回空

            // 模拟过期的缓存文件
            const oldDate = new Date(Date.now() - 100000000); // 很久以前
            mockFs.stat.mockResolvedValue({ mtime: oldDate });
            mockFs.pathExists.mockResolvedValue(true);
            mockFs.readFile.mockResolvedValue('{"version": "1.0", "folderHash": "test"}');
            mockFs.remove.mockResolvedValue(undefined);

            const result = await cleanupInvalidCaches("/test/path", 86400000, mockLogger);

            expect(result.processed).toBe(1);
            expect(result.removed).toBe(1);
            expect(mockFs.remove).toHaveBeenCalled();
        });

        it("应该处理缓存文件删除错误", async () => {
            mockFs.readdir
                .mockResolvedValueOnce([
                    { name: ".photasa-folder.json", isDirectory: () => false, isFile: () => true },
                ])
                .mockResolvedValue([]);

            const oldDate = new Date(Date.now() - 100000000);
            mockFs.stat.mockResolvedValue({ mtime: oldDate });
            mockFs.pathExists.mockResolvedValue(true);
            mockFs.readFile.mockResolvedValue('{"version": "1.0", "folderHash": "test"}');
            mockFs.remove.mockRejectedValue(new Error("Delete failed"));

            const result = await cleanupInvalidCaches("/test/path", 86400000, mockLogger);

            expect(result.errors).toHaveLength(1);
            expect(result.errors[0]).toContain("Delete failed");
        });
    });

    describe("optimizeMemory", () => {
        it("应该执行内存优化", () => {
            // 模拟global.gc存在
            (global as any).gc = jest.fn();

            const result = optimizeMemory(mockLogger);

            expect(result).toBeGreaterThan(0);
            expect((global as any).gc).toHaveBeenCalled();
            expect(mockLogger.debug).toHaveBeenCalledWith(
                expect.stringContaining("[optimizeMemory]"),
            );
        });

        it("应该处理没有gc函数的情况", () => {
            // 确保global.gc不存在
            delete (global as any).gc;

            const result = optimizeMemory(mockLogger);

            expect(result).toBeGreaterThanOrEqual(0);
        });
    });

    describe("generateCleanupReport", () => {
        const mockStats = {
            startTime: Date.now() - 5000,
            endTime: Date.now(),
            duration: 5000,
            workerPoolShutdown: true,
            cacheFilesProcessed: 10,
            invalidCacheFilesRemoved: 3,
            memoryFreed: 150.5,
            errors: [],
        };

        it("应该生成最小化报告", () => {
            const options = { ...DEFAULT_CLEANUP_OPTIONS, logLevel: "minimal" as const };

            generateCleanupReport(mockStats, options, mockLogger);

            expect(mockLogger.info).toHaveBeenCalledWith(
                expect.stringContaining("[CleanupReport] 清理完成"),
            );
        });

        it("应该生成详细报告", () => {
            const options = { ...DEFAULT_CLEANUP_OPTIONS, logLevel: "detailed" as const };

            generateCleanupReport(mockStats, options, mockLogger);

            expect(mockLogger.info).toHaveBeenCalledWith(
                "[CleanupReport] 详细清理报告",
                expect.any(Object),
            );
        });

        it("应该报告错误信息", () => {
            const statsWithErrors = {
                ...mockStats,
                errors: ["Error 1", "Error 2"],
            };

            generateCleanupReport(statsWithErrors, DEFAULT_CLEANUP_OPTIONS, mockLogger);

            expect(mockLogger.warn).toHaveBeenCalledWith(
                expect.stringContaining("清理过程中发生 2 个错误"),
                statsWithErrors.errors,
            );
        });

        it("应该在报告禁用时跳过", () => {
            const options = { ...DEFAULT_CLEANUP_OPTIONS, generateReport: false };

            generateCleanupReport(mockStats, options, mockLogger);

            expect(mockLogger.info).not.toHaveBeenCalled();
        });
    });

    describe("performExtendedCleanup", () => {
        it("应该验证清理选项", async () => {
            const invalidOptions: CleanupOptions = {
                ...DEFAULT_CLEANUP_OPTIONS,
                workerShutdownTimeout: -1000,
            };

            await expect(
                performExtendedCleanup(null, "/test/path", invalidOptions, mockLogger),
            ).rejects.toThrow("清理选项验证失败");
        });

        it("应该执行完整的清理流程", async () => {
            (mockWorkerPool.shutdown as jest.MockedFunction<() => Promise<void>>).mockResolvedValue(
                undefined,
            );
            mockFs.readdir.mockResolvedValue([]);

            const result = await performExtendedCleanup(
                mockWorkerPool as any,
                "/test/path",
                DEFAULT_CLEANUP_OPTIONS,
                mockLogger,
            );

            expect(result.startTime).toBeGreaterThan(0);
            expect(result.endTime).toBeGreaterThanOrEqual(result.startTime);
            expect(result.duration).toBeGreaterThanOrEqual(0);
            expect(mockLogger.info).toHaveBeenCalledWith(
                "[performExtendedCleanup] 开始扩展清理流程",
            );
        });

        it.skip("应该处理清理过程中的错误", async () => {
            const options = {
                ...DEFAULT_CLEANUP_OPTIONS,
                shutdownWorkerPool: false,
                cleanupInvalidCaches: true, // 确保启用缓存清理以触发错误
            };
            // 模拟缓存清理失败 - 让findCacheFiles返回一些文件，但删除时失败
            mockFs.readdir.mockResolvedValue([
                { name: ".photasa-folder.json", isDirectory: () => false, isFile: () => true },
            ]);
            mockFs.stat.mockResolvedValue({
                mtime: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
            }); // 8天前
            mockFs.remove.mockRejectedValue(new Error("Delete failed"));

            const result = await performExtendedCleanup(null, "/test/path", options, mockLogger);

            expect(result.errors.length).toBeGreaterThan(0);
            expect(result.duration).toBeGreaterThanOrEqual(0);
        });
    });

    describe("DEFAULT_CLEANUP_OPTIONS", () => {
        it("应该有合理的默认值", () => {
            expect(DEFAULT_CLEANUP_OPTIONS.shutdownWorkerPool).toBe(true);
            expect(DEFAULT_CLEANUP_OPTIONS.workerShutdownTimeout).toBe(5000);
            expect(DEFAULT_CLEANUP_OPTIONS.cleanupInvalidCaches).toBe(true);
            expect(DEFAULT_CLEANUP_OPTIONS.maxCacheAge).toBe(30 * 24 * 60 * 60 * 1000); // 30天
            expect(DEFAULT_CLEANUP_OPTIONS.cleanupOrphanCaches).toBe(true);
            expect(DEFAULT_CLEANUP_OPTIONS.forceGarbageCollection).toBe(true);
            expect(DEFAULT_CLEANUP_OPTIONS.clearInternalCaches).toBe(true);
            expect(DEFAULT_CLEANUP_OPTIONS.generateReport).toBe(true);
            expect(DEFAULT_CLEANUP_OPTIONS.logLevel).toBe("minimal");
        });
    });
});

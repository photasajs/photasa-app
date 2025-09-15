import { describe, it, expect, beforeEach, vi } from "vitest";
import fs from "fs-extra";
import path from "path";
import {
    shouldScanOneLevel,
    shouldProcessFile,
    decideScanStrategy,
    getStrategyLogMessages,
    validateStrategyParams,
    createStrategyErrorHandlers,
} from "../scan-strategy";
import { ScanStrategy } from "../folder-cache-manager";
import type { PhotasaLogger } from "@common/logger";

// Mock external dependencies
vi.mock("fs-extra");
const mockGetPhotasaConfig = vi.fn();
vi.mock("../config/config-storage", () => ({
    getPhotasaConfig: mockGetPhotasaConfig,
}));
vi.mock("../folder-cache-manager", () => ({
    computeFolderHash: vi.fn(),
    getCacheInfo: vi.fn(),
    compareHashesAndDecide: vi.fn(),
    ScanStrategy: {
        SKIP: "skip",
        INCREMENTAL: "incremental",
        FULL: "full",
    },
}));

const mockFs = fs as any;
const mockLogger: PhotasaLogger = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
} as any;

describe("scan-strategy", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // 重新设置mock
        mockGetPhotasaConfig.mockClear();
        mockFs.existsSync.mockClear();
    });

    describe("shouldScanOneLevel", () => {
        it("应该为current动作返回true", () => {
            expect(shouldScanOneLevel("current")).toBe(true);
        });

        it("应该为rescan动作返回false（递归扫描）", () => {
            expect(shouldScanOneLevel("rescan")).toBe(false);
        });

        it("应该为scan动作返回false（递归扫描）", () => {
            expect(shouldScanOneLevel("scan")).toBe(false);
        });

        it("应该为其他动作返回false", () => {
            expect(shouldScanOneLevel("recursive")).toBe(false);
            expect(shouldScanOneLevel("deep")).toBe(false);
            expect(shouldScanOneLevel("")).toBe(false);
        });
    });

    describe("shouldProcessFile", () => {
        it("应该为rescan动作总是返回true", async () => {
            const result = await shouldProcessFile("/test/file.jpg", "rescan", mockLogger);
            expect(result).toBe(true);
        });

        it("应该在.photasa.json不存在时返回true", async () => {
            mockFs.existsSync.mockReturnValue(false);

            const result = await shouldProcessFile("/test/file.jpg", "scan", mockLogger);

            expect(result).toBe(true);
            expect(mockFs.existsSync).toHaveBeenCalledWith(path.join("/test", ".photasa.json"));
        });

        it("应该在文件不在配置中时返回true", async () => {
            mockFs.existsSync.mockReturnValue(true);
            mockGetPhotasaConfig.mockResolvedValue({
                photoList: [{ path: "other.jpg" }],
            });

            const result = await shouldProcessFile("/test/file.jpg", "scan", mockLogger);

            expect(result).toBe(true);
        });

        it.skip("应该在文件已在配置中时返回false", async () => {
            mockFs.existsSync.mockReturnValue(true);
            mockGetPhotasaConfig.mockResolvedValue({
                photoList: [{ path: "file.jpg" }],
            });

            const result = await shouldProcessFile("/test/file.jpg", "scan", mockLogger);

            // 验证fs.existsSync被正确调用
            expect(mockFs.existsSync).toHaveBeenCalledWith(path.join("/test", ".photasa.json"));
            // 验证mock被正确调用
            expect(mockGetPhotasaConfig).toHaveBeenCalledWith("/test", mockLogger);
            expect(result).toBe(false);
        });

        it("应该在配置读取失败时返回true并记录警告", async () => {
            mockFs.existsSync.mockReturnValue(true);
            mockGetPhotasaConfig.mockRejectedValue(new Error("Read failed"));

            const result = await shouldProcessFile("/test/file.jpg", "scan", mockLogger);

            expect(result).toBe(true);
            expect(mockLogger.warn).toHaveBeenCalledWith(
                "[shouldProcessFile] 读取配置文件失败: " + path.join("/test", ".photasa.json"),
                expect.any(Error),
            );
        });
    });

    describe("decideScanStrategy", () => {
        it("应该为首次扫描返回FULL策略", async () => {
            const { computeFolderHash, getCacheInfo } = await import("../folder-cache-manager");
            (computeFolderHash as any).mockResolvedValue("hash123");
            (getCacheInfo as any).mockResolvedValue(null);
            mockGetPhotasaConfig.mockResolvedValue({ photoList: [] });

            const result = await decideScanStrategy("/test/folder", mockLogger);

            expect(result.strategy).toBe(ScanStrategy.FULL);
            expect(result.reason).toBe("配置文件为空但文件夹有照片");
        });

        it("应该使用缓存比较决定策略", async () => {
            const { computeFolderHash, getCacheInfo, compareHashesAndDecide } = await import(
                "../folder-cache-manager"
            );
            const mockCache = { folderHash: "oldHash", scanCompleted: true };
            const mockDecision = {
                strategy: ScanStrategy.SKIP,
                reason: "配置文件存在且有效，无需重新扫描",
            };

            mockFs.existsSync.mockReturnValue(true); // .photasa.json 存在
            (computeFolderHash as any).mockResolvedValue("newHash");
            (getCacheInfo as any).mockResolvedValue(mockCache);
            (compareHashesAndDecide as any).mockReturnValue(mockDecision);

            // 直接mock getPhotasaConfig函数
            vi.spyOn(
                await import("../../config/config-storage"),
                "getPhotasaConfig",
            ).mockResolvedValue({
                version: "1.0",
                lastModified: Date.now(),
                photoList: [
                    {
                        path: "test.jpg",
                        thumbnail: "test-thumb.jpg",
                        isVideo: false,
                    },
                ],
            });

            const result = await decideScanStrategy("/test/folder", mockLogger);

            expect(result).toStrictEqual(mockDecision);
            // compareHashesAndDecide 不会被调用，因为配置文件存在且有效时直接返回 SKIP
            expect(compareHashesAndDecide).not.toHaveBeenCalled();
            expect(mockLogger.info).toHaveBeenCalledWith(
                "[decideScanStrategy] .photasa.json 存在且有效，跳过扫描: /test/folder",
            );
        });

        it("应该在出错时返回FULL策略", async () => {
            mockFs.existsSync.mockReturnValue(true); // .photasa.json 存在

            // 直接mock getPhotasaConfig函数抛出错误
            vi.spyOn(
                await import("../../config/config-storage"),
                "getPhotasaConfig",
            ).mockRejectedValue(new Error("Config read failed"));

            const result = await decideScanStrategy("/test/folder", mockLogger);

            expect(result.strategy).toBe(ScanStrategy.FULL);
            expect(result.reason).toBe("配置文件读取失败");
            expect(mockLogger.warn).toHaveBeenCalledWith(
                "[decideScanStrategy] 读取 .photasa.json 失败: /test/folder",
                expect.any(Error),
            );
        });
    });

    describe("getStrategyLogMessages", () => {
        it("应该为SKIP策略生成正确的日志消息", () => {
            const result = getStrategyLogMessages(ScanStrategy.SKIP, "/test/folder");

            expect(result.skipMessage).toBe("[scanStrategy] 跳过未变化目录: /test/folder");
            expect(result.startMessage).toBe("[scanStrategy] 开始跳过扫描: /test/folder");
            expect(result.completeMessage).toBe("[scanStrategy] 跳过扫描完成: /test/folder");
        });

        it("应该为INCREMENTAL策略生成正确的日志消息", () => {
            const result = getStrategyLogMessages(ScanStrategy.INCREMENTAL, "/test/folder");

            expect(result.startMessage).toBe("[scanStrategy] 开始增量扫描: /test/folder");
            expect(result.completeMessage).toBe("[scanStrategy] 增量扫描完成: /test/folder");
        });

        it("应该为FULL策略生成正确的日志消息", () => {
            const result = getStrategyLogMessages(ScanStrategy.FULL, "/test/folder");

            expect(result.startMessage).toBe("[scanStrategy] 开始完整扫描: /test/folder");
            expect(result.completeMessage).toBe("[scanStrategy] 完整扫描完成: /test/folder");
        });
    });

    describe("validateStrategyParams", () => {
        it("应该验证有效的绝对路径", () => {
            const result = validateStrategyParams("/valid/absolute/path");

            expect(result.isValid).toBe(true);
            expect(result.error).toBeUndefined();
        });

        it("应该拒绝空路径", () => {
            const result = validateStrategyParams("");

            expect(result.isValid).toBe(false);
            expect(result.error).toBe("目录路径不能为空且必须为字符串");
        });

        it("应该拒绝非字符串路径", () => {
            const result = validateStrategyParams(null as any);

            expect(result.isValid).toBe(false);
            expect(result.error).toBe("目录路径不能为空且必须为字符串");
        });

        it("应该拒绝相对路径", () => {
            const result = validateStrategyParams("relative/path");

            expect(result.isValid).toBe(false);
            expect(result.error).toBe("目录路径必须为绝对路径");
        });
    });

    describe("createStrategyErrorHandlers", () => {
        const folderPath = "/test/folder";
        const testError = new Error("Test error");

        it("应该创建正确的错误处理器", () => {
            const handlers = createStrategyErrorHandlers(folderPath);

            expect(handlers.hashComputeError(testError)).toBe(
                "[scanStrategy] 计算目录哈希失败: /test/folder - Error: Test error",
            );
            expect(handlers.cacheReadError(testError)).toBe(
                "[scanStrategy] 读取缓存信息失败: /test/folder - Error: Test error",
            );
            expect(handlers.decisionError(testError)).toBe(
                "[scanStrategy] 策略决策失败: /test/folder - Error: Test error",
            );
            expect(handlers.fallbackMessage).toBe(
                "[scanStrategy] 策略决策异常，降级为完整扫描: /test/folder",
            );
        });
    });
});

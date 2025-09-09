import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "fs-extra";
import path from "path";
import crypto from "crypto";
import {
    computeFolderHash,
    getCacheInfo,
    saveCacheInfo,
    compareHashesAndDecide,
    hideConfigFile,
    validateHiddenStatus,
    createDefaultCache,
    ScanStrategy,
    type FolderCache,
} from "../folder-cache-manager";
import { loggers } from "@common/logger";

// Mock external dependencies
vi.mock("fs-extra");
vi.mock("is-image");
vi.mock("is-video");
vi.mock("@common/logger", () => ({
    loggers: {
        scan: {
            debug: vi.fn(),
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
        },
    },
}));

const mockFs = fs as any;
const mockLogger = loggers.scan as any;

describe("folder-cache-manager", () => {
    const testFolderPath = "/test/folder";
    const cacheFilePath = path.join(testFolderPath, ".photasa-folder.json");

    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe("computeFolderHash", () => {
        it("应该为空目录返回空哈希", async () => {
            // 模拟空目录
            mockFs.readdir.mockResolvedValue([]);

            const result = await computeFolderHash(testFolderPath);

            expect(result).toBe(crypto.createHash("sha256").update("").digest("hex"));
            expect(mockFs.readdir).toHaveBeenCalledWith(testFolderPath, { withFileTypes: true });
        });

        it("应该为包含媒体文件的目录计算正确哈希", async () => {
            const mockFiles = [
                {
                    name: "image1.jpg",
                    isFile: () => true,
                },
                {
                    name: "video1.mp4",
                    isFile: () => true,
                },
                {
                    name: "document.txt",
                    isFile: () => true,
                },
                {
                    name: "subfolder",
                    isFile: () => false,
                },
            ];

            const mockStats = {
                size: 1024,
                mtimeMs: 1640995200000,
            };

            mockFs.readdir.mockResolvedValue(mockFiles);
            mockFs.stat.mockResolvedValue(mockStats);

            // Mock isImage and isVideo
            const { default: isImage } = await import("is-image");
            const { default: isVideo } = await import("is-video");
            (isImage as any).mockImplementation((filepath: string) => filepath.endsWith(".jpg"));
            (isVideo as any).mockImplementation((filepath: string) => filepath.endsWith(".mp4"));

            const result = await computeFolderHash(testFolderPath);

            // 验证只处理媒体文件
            expect(mockFs.stat).toHaveBeenCalledTimes(2); // 只调用两次：image1.jpg 和 video1.mp4
            expect(result).toBeTruthy();
            expect(result).toHaveLength(64); // SHA256 哈希长度
        });

        it("应该处理目录不可读的情况", async () => {
            mockFs.readdir.mockRejectedValue(new Error("Permission denied"));

            const result = await computeFolderHash(testFolderPath);

            expect(result).toBe("");
        });

        it("应该按文件名排序确保哈希一致性", async () => {
            const mockFiles1 = [
                { name: "b.jpg", isFile: () => true },
                { name: "a.jpg", isFile: () => true },
            ];

            const mockFiles2 = [
                { name: "a.jpg", isFile: () => true },
                { name: "b.jpg", isFile: () => true },
            ];

            const mockStats = { size: 100, mtimeMs: 1000 };

            // Mock isImage
            const { default: isImage } = await import("is-image");
            (isImage as any).mockReturnValue(true);

            mockFs.stat.mockResolvedValue(mockStats);

            // 测试第一种文件顺序
            mockFs.readdir.mockResolvedValueOnce(mockFiles1);
            const hash1 = await computeFolderHash(testFolderPath);

            // 测试第二种文件顺序
            mockFs.readdir.mockResolvedValueOnce(mockFiles2);
            const hash2 = await computeFolderHash(testFolderPath);

            // 不管文件顺序如何，哈希应该相同
            expect(hash1).toBe(hash2);
        });
    });

    describe("getCacheInfo", () => {
        it("应该返回null如果缓存文件不存在", async () => {
            mockFs.pathExists.mockResolvedValue(false);

            const result = await getCacheInfo(testFolderPath, mockLogger);

            expect(result).toBeNull();
            expect(mockFs.pathExists).toHaveBeenCalledWith(cacheFilePath);
        });

        it("应该返回缓存信息如果文件存在且版本正确", async () => {
            const mockCache: FolderCache = {
                version: "1.0",
                lastScan: Date.now(),
                fileCount: 10,
                folderHash: "test-hash",
                scanCompleted: true,
                scanDuration: 5000,
                thumbnailsGenerated: 8,
                errors: [],
                incrementalSupported: true,
            };

            mockFs.pathExists.mockResolvedValue(true);
            mockFs.readFile.mockResolvedValue(JSON.stringify(mockCache));

            const result = await getCacheInfo(testFolderPath, mockLogger);

            expect(result).toEqual(mockCache);
            expect(mockFs.readFile).toHaveBeenCalledWith(cacheFilePath, "utf8");
        });

        it("应该返回null如果缓存版本不匹配", async () => {
            const mockCache = {
                version: "0.9", // 错误版本
                lastScan: Date.now(),
                fileCount: 10,
                folderHash: "test-hash",
                scanCompleted: true,
                scanDuration: 5000,
                thumbnailsGenerated: 8,
                errors: [],
                incrementalSupported: true,
            };

            mockFs.pathExists.mockResolvedValue(true);
            mockFs.readFile.mockResolvedValue(JSON.stringify(mockCache));

            const result = await getCacheInfo(testFolderPath, mockLogger);

            expect(result).toBeNull();
            expect(mockLogger.warn).toHaveBeenCalledWith(
                `[getCacheInfo] 缓存版本不匹配: ${cacheFilePath}`,
            );
        });

        it("应该处理JSON解析错误", async () => {
            mockFs.pathExists.mockResolvedValue(true);
            mockFs.readFile.mockResolvedValue("invalid json");

            const result = await getCacheInfo(testFolderPath, mockLogger);

            expect(result).toBeNull();
            expect(mockLogger.error).toHaveBeenCalledWith(
                `[getCacheInfo] 读取缓存文件失败: ${cacheFilePath}`,
                expect.any(Error),
            );
        });
    });

    describe("saveCacheInfo", () => {
        const mockCache: FolderCache = createDefaultCache("test-hash", 5);

        it("应该成功保存缓存信息", async () => {
            mockFs.writeFile.mockResolvedValue(undefined);

            // Mock hideConfigFile to avoid platform-specific logic
            const hideConfigFileSpy = vi.fn().mockResolvedValue(undefined);
            vi.doMock("../folder-cache-manager", async () => {
                const actual = await vi.importActual("../folder-cache-manager");
                return {
                    ...actual,
                    hideConfigFile: hideConfigFileSpy,
                };
            });

            await saveCacheInfo(testFolderPath, mockCache, mockLogger);

            expect(mockFs.writeFile).toHaveBeenCalledWith(
                cacheFilePath,
                JSON.stringify(mockCache, null, 2),
                "utf8",
            );
            expect(mockLogger.debug).toHaveBeenCalledWith(
                `[saveCacheInfo] 缓存文件已保存: ${cacheFilePath}`,
            );
        });

        it("应该处理写入失败的情况", async () => {
            const writeError = new Error("Write failed");
            mockFs.writeFile.mockRejectedValue(writeError);

            await expect(saveCacheInfo(testFolderPath, mockCache, mockLogger)).rejects.toThrow(
                "Write failed",
            );

            expect(mockLogger.error).toHaveBeenCalledWith(
                `[saveCacheInfo] 保存缓存文件失败: ${cacheFilePath}`,
                writeError,
            );
        });
    });

    describe("compareHashesAndDecide", () => {
        const mockCache: FolderCache = {
            ...createDefaultCache("cached-hash", 10),
            scanCompleted: true,
        };

        it("应该返回SKIP策略当哈希匹配且扫描已完成", () => {
            const result = compareHashesAndDecide("cached-hash", "cached-hash", mockCache);

            expect(result.strategy).toBe(ScanStrategy.SKIP);
            expect(result.reason).toBe("目录内容无变化且上次扫描已完成");
        });

        it("应该返回FULL策略当缓存哈希为空", () => {
            const result = compareHashesAndDecide("", "current-hash");

            expect(result.strategy).toBe(ScanStrategy.FULL);
            expect(result.reason).toBe("首次扫描或缓存无效");
        });

        it("应该返回FULL策略当缓存哈希不存在", () => {
            const result = compareHashesAndDecide(undefined as any, "current-hash");

            expect(result.strategy).toBe(ScanStrategy.FULL);
            expect(result.reason).toBe("首次扫描或缓存无效");
        });

        it("应该返回INCREMENTAL策略当哈希不匹配", () => {
            const result = compareHashesAndDecide("cached-hash", "different-hash", mockCache);

            expect(result.strategy).toBe(ScanStrategy.INCREMENTAL);
            expect(result.reason).toBe("检测到文件变化，执行增量扫描");
        });

        it("应该返回FULL策略当扫描未完成", () => {
            const incompleteCache = { ...mockCache, scanCompleted: false };
            const result = compareHashesAndDecide("cached-hash", "cached-hash", incompleteCache);

            expect(result.strategy).toBe(ScanStrategy.FULL);
            expect(result.reason).toBe("上次扫描未完成，需要重新扫描");
        });
    });

    describe("hideConfigFile", () => {
        const testFilePath = "/test/path/.photasa-folder.json";

        it("应该在Windows上使用attrib命令隐藏文件", async () => {
            // Mock Windows platform
            Object.defineProperty(process, "platform", { value: "win32" });

            // Mock child_process and util
            const mockExecAsync = vi.fn().mockResolvedValue({ stdout: "", stderr: "" });
            vi.doMock("child_process", () => ({
                exec: vi.fn(),
            }));
            vi.doMock("util", () => ({
                promisify: vi.fn().mockReturnValue(mockExecAsync),
            }));

            await hideConfigFile(testFilePath, mockLogger);

            expect(mockExecAsync).toHaveBeenCalledWith(`attrib +H "${testFilePath}"`);
            expect(mockLogger.debug).toHaveBeenCalledWith(
                `[hideConfigFile] Windows文件隐藏成功: ${testFilePath}`,
            );
        });

        it("应该在Unix系统上记录自动隐藏", async () => {
            // Mock Unix platform
            Object.defineProperty(process, "platform", { value: "darwin" });

            await hideConfigFile(testFilePath, mockLogger);

            expect(mockLogger.debug).toHaveBeenCalledWith(
                `[hideConfigFile] Unix系统文件自动隐藏: ${testFilePath}`,
            );
        });

        it("应该处理Windows attrib命令失败", async () => {
            Object.defineProperty(process, "platform", { value: "win32" });

            const mockExecAsync = vi.fn().mockRejectedValue(new Error("Command failed"));
            vi.doMock("child_process", () => ({ exec: vi.fn() }));
            vi.doMock("util", () => ({ promisify: vi.fn().mockReturnValue(mockExecAsync) }));

            // 应该不抛出错误，只记录警告
            await expect(hideConfigFile(testFilePath, mockLogger)).resolves.toBeUndefined();

            expect(mockLogger.warn).toHaveBeenCalledWith(
                `[hideConfigFile] Windows文件隐藏失败: ${testFilePath}`,
                expect.any(Error),
            );
        });
    });

    describe("validateHiddenStatus", () => {
        const testFilePath = "/test/path/.photasa-folder.json";

        it("应该在Unix系统上返回true", async () => {
            Object.defineProperty(process, "platform", { value: "linux" });

            const result = await validateHiddenStatus(testFilePath, mockLogger);

            expect(result).toBe(true);
        });

        it("应该在Windows上检查attrib输出", async () => {
            Object.defineProperty(process, "platform", { value: "win32" });

            const mockExecAsync = vi.fn().mockResolvedValue({
                stdout: "A  H     C:\\test\\path\\.photasa-folder.json",
                stderr: "",
            });
            vi.doMock("child_process", () => ({ exec: vi.fn() }));
            vi.doMock("util", () => ({ promisify: vi.fn().mockReturnValue(mockExecAsync) }));

            const result = await validateHiddenStatus(testFilePath, mockLogger);

            expect(result).toBe(true);
            expect(mockExecAsync).toHaveBeenCalledWith(`attrib "${testFilePath}"`);
            expect(mockLogger.debug).toHaveBeenCalledWith(
                `[validateHiddenStatus] ${testFilePath} 隐藏状态: true`,
            );
        });

        it("应该处理Windows attrib命令失败", async () => {
            Object.defineProperty(process, "platform", { value: "win32" });

            const mockExecAsync = vi.fn().mockRejectedValue(new Error("Command failed"));
            vi.doMock("child_process", () => ({ exec: vi.fn() }));
            vi.doMock("util", () => ({ promisify: vi.fn().mockReturnValue(mockExecAsync) }));

            const result = await validateHiddenStatus(testFilePath, mockLogger);

            expect(result).toBe(false);
            expect(mockLogger.warn).toHaveBeenCalledWith(
                `[validateHiddenStatus] 检查隐藏状态失败: ${testFilePath}`,
                expect.any(Error),
            );
        });
    });

    describe("createDefaultCache", () => {
        it("应该创建带有正确默认值的缓存对象", () => {
            const folderHash = "test-hash-123";
            const fileCount = 42;

            const result = createDefaultCache(folderHash, fileCount);

            expect(result).toEqual({
                version: "1.0",
                lastScan: expect.any(Number),
                fileCount: 42,
                folderHash: "test-hash-123",
                scanCompleted: false,
                scanDuration: 0,
                thumbnailsGenerated: 0,
                errors: [],
                incrementalSupported: true,
            });

            // 验证lastScan是一个合理的时间戳
            expect(result.lastScan).toBeGreaterThan(Date.now() - 1000);
            expect(result.lastScan).toBeLessThanOrEqual(Date.now());
        });
    });

    describe("ScanStrategy 枚举", () => {
        it("应该有正确的策略值", () => {
            expect(ScanStrategy.SKIP).toBe("skip");
            expect(ScanStrategy.INCREMENTAL).toBe("incremental");
            expect(ScanStrategy.FULL).toBe("full");
        });
    });
});

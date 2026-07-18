import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import fs from "fs-extra";
import {
    shouldCreateThumbnail,
    buildThumbnailRequest,
    buildConfigUpdateRequest,
    processPhotoFile,
    createCacheUpdateData,
    buildScanLogMessages,
    createErrorHandlers,
    validateScanParams,
    isDirectoryScan,
    createSubscriptionHandlers,
} from "../scan-helpers";
import type { ScanAction, PhotoFileRequest } from "@photasa/common";
import type { PhotasaLogger } from "@photasa/common";

// Mock external dependencies
jest.mock("fs-extra");
jest.mock("@photasa/config-core", () => ({
    addToPhotasaConfig: jest.fn(),
}));

const mockFs = fs as any;

describe("scan-helpers", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe("shouldCreateThumbnail", () => {
        it("应该在缩略图不存在时返回true", () => {
            mockFs.existsSync.mockReturnValue(false);

            const result = shouldCreateThumbnail("/path/to/thumbnail.jpg", "scan");

            expect(result).toBe(true);
            expect(mockFs.existsSync).toHaveBeenCalledWith("/path/to/thumbnail.jpg");
        });

        it("应该在缩略图存在但动作为rescan时返回true", () => {
            mockFs.existsSync.mockReturnValue(true);

            const result = shouldCreateThumbnail("/path/to/thumbnail.jpg", "rescan");

            expect(result).toBe(true);
        });

        it("应该在缩略图存在且动作不为rescan时返回false", () => {
            mockFs.existsSync.mockReturnValue(true);

            const result = shouldCreateThumbnail("/path/to/thumbnail.jpg", "scan");

            expect(result).toBe(false);
        });
    });

    describe("buildThumbnailRequest", () => {
        it("应该构建正确的缩略图请求对象", () => {
            const action: PhotoFileRequest = {
                path: "/path/to/photo.jpg",
                thumbnail: "/path/to/thumbnail.jpg",
                isImage: true,
                isVideo: false,
                isDirectory: false,
            };

            const scan: ScanAction = {
                path: "/scan/path",
                action: "scan",
                operationType: "directory",
                thumbnailSize: 200,
            };

            const result = buildThumbnailRequest(action, scan);

            expect(result).toEqual({
                path: "/path/to/photo.jpg",
                thumbnail: "/path/to/thumbnail.jpg",
                width: 200,
                height: 200,
                withoutEnlargement: true,
                preview: "/path/to/thumbnail.jpg",
                always: false,
            });
        });

        it("应该在rescan动作时设置always为true", () => {
            const action: PhotoFileRequest = {
                path: "/path/to/photo.jpg",
                thumbnail: "/path/to/thumbnail.jpg",
                isImage: true,
                isVideo: false,
                isDirectory: false,
            };

            const scan: ScanAction = {
                path: "/scan/path",
                action: "rescan",
                operationType: "directory",
                thumbnailSize: 150,
            };

            const result = buildThumbnailRequest(action, scan);

            expect(result.always).toBe(true);
            expect(result.width).toBe(150);
            expect(result.height).toBe(150);
        });
    });

    describe("buildConfigUpdateRequest", () => {
        it("应该构建正确的配置更新请求", () => {
            const filePath = "/path/to/photo.jpg";

            const result = buildConfigUpdateRequest(filePath);

            expect(result).toEqual({
                queueId: 0,
                paths: ["/path/to/photo.jpg"],
            });
        });
    });

    describe("processPhotoFile", () => {
        let mockWorkerPool: any;
        let mockLogger: any;

        beforeEach(() => {
            mockWorkerPool = {
                addTask: jest.fn(),
            };
            mockLogger = {
                debug: jest.fn(),
                info: jest.fn(),
                warn: jest.fn(),
                error: jest.fn(),
            };
        });

        it("应该在不需要处理时直接返回", async () => {
            const action: PhotoFileRequest = {
                path: "/path/to/photo.jpg",
                thumbnail: "/path/to/thumbnail.jpg",
                isImage: true,
                isVideo: false,
                isDirectory: false,
            };

            const scan: ScanAction = {
                path: "/scan/path",
                action: "scan",
                operationType: "directory",
                thumbnailSize: 200,
            };

            const result = await processPhotoFile(action, scan, false, mockWorkerPool, mockLogger);

            expect(result).toBe(action);
            expect(mockWorkerPool.addTask).not.toHaveBeenCalled();
        });

        it("应该在需要创建缩略图时调用worker池", async () => {
            mockFs.existsSync.mockReturnValue(false);

            const action: PhotoFileRequest = {
                path: "/path/to/photo.jpg",
                thumbnail: "/path/to/thumbnail.jpg",
                isImage: true,
                isVideo: false,
                isDirectory: false,
            };

            const scan: ScanAction = {
                path: "/scan/path",
                action: "scan",
                operationType: "directory",
                thumbnailSize: 200,
            };

            const result = await processPhotoFile(action, scan, true, mockWorkerPool, mockLogger);

            expect(result).toBe(action);
            expect(mockWorkerPool.addTask).toHaveBeenCalledWith("create", {
                path: "/path/to/photo.jpg",
                thumbnail: "/path/to/thumbnail.jpg",
                width: 200,
                height: 200,
                withoutEnlargement: true,
                preview: "/path/to/thumbnail.jpg",
                always: false,
            });
        });

        it("应该在缩略图存在时跳过创建", async () => {
            mockFs.existsSync.mockReturnValue(true);

            const action: PhotoFileRequest = {
                path: "/path/to/photo.jpg",
                thumbnail: "/path/to/thumbnail.jpg",
                isImage: true,
                isVideo: false,
                isDirectory: false,
            };

            const scan: ScanAction = {
                path: "/scan/path",
                action: "scan",
                operationType: "directory",
                thumbnailSize: 200,
            };

            await processPhotoFile(action, scan, true, mockWorkerPool, mockLogger);

            expect(mockWorkerPool.addTask).not.toHaveBeenCalled();
        });
    });

    describe("createCacheUpdateData", () => {
        it("应该创建正确的缓存更新数据", () => {
            const folderPath = "/test/folder";
            const startTime = Date.now() - 5000;
            const fileCount = 10;

            const result = createCacheUpdateData(folderPath, startTime, fileCount);

            expect(result.folderPath).toBe(folderPath);
            expect(result.fileCount).toBe(fileCount);
            expect(result.duration).toBeGreaterThan(4900);
            expect(result.duration).toBeLessThan(5100);
            expect(result.scanTime).toBeGreaterThan(Date.now() - 100);
        });

        it("应该使用默认文件数量0", () => {
            const folderPath = "/test/folder";
            const startTime = Date.now() - 1000;

            const result = createCacheUpdateData(folderPath, startTime);

            expect(result.fileCount).toBe(0);
        });
    });

    describe("buildScanLogMessages", () => {
        it("应该构建正确的日志消息对象", () => {
            const strategy = "full";
            const folderPath = "/test/folder";

            const result = buildScanLogMessages(strategy, folderPath);

            expect(result.skipMessage).toBe("[scanPhotos] 跳过未变化目录: /test/folder");
            expect(result.startMessage).toBe("[scanPhotos] 开始完整扫描: /test/folder");
            expect(result.cacheUpdateMessage(5000)).toBe(
                "[scanPhotos] 缓存已更新: /test/folder, 耗时: 5000ms",
            );
            expect(result.cacheFailMessage).toBe("[scanPhotos] 更新缓存失败: /test/folder");
            expect(result.fallbackMessage).toBe(
                "[scanPhotos] 智能决策失败，使用传统扫描: /test/folder",
            );
        });

        it("应该为增量扫描生成正确的开始消息", () => {
            const strategy = "incremental";
            const folderPath = "/test/folder";

            const result = buildScanLogMessages(strategy, folderPath);

            expect(result.startMessage).toBe("[scanPhotos] 开始增量扫描: /test/folder");
        });
    });

    describe("createErrorHandlers", () => {
        it("应该创建正确的错误处理器配置", () => {
            const folderPath = "/test/folder";

            const result = createErrorHandlers(folderPath);

            expect(result.scanError(new Error("test error"))).toBe(
                "[scanPhotos] 扫描过程出错: /test/folder",
            );
            expect(result.decisionError(new Error("decision error"))).toBe(
                "[scanPhotos] 扫描决策失败: /test/folder",
            );
        });
    });

    describe("validateScanParams", () => {
        it("应该验证有效的扫描参数", () => {
            // 模拟fs.statSync返回目录统计信息
            mockFs.statSync.mockReturnValue({
                isDirectory: () => true,
                isFile: () => false,
            });

            const validScan: ScanAction = {
                path: "/test/path",
                action: "scan",
                operationType: "directory",
                thumbnailSize: 200,
            };

            const result = validateScanParams(validScan);

            expect(result.isValid).toBe(true);
            expect(result.error).toBeUndefined();
        });

        it("应该拒绝空路径", () => {
            const invalidScan: ScanAction = {
                path: "",
                action: "scan",
                operationType: "directory",
                thumbnailSize: 200,
            };

            const result = validateScanParams(invalidScan);

            expect(result.isValid).toBe(false);
            expect(result.error).toBe("扫描路径不能为空");
        });

        it("应该拒绝空动作", () => {
            const invalidScan: ScanAction = {
                path: "/test/path",
                action: "" as any,
                operationType: "directory",
                thumbnailSize: 200,
            };

            const result = validateScanParams(invalidScan);

            expect(result.isValid).toBe(false);
            expect(result.error).toBe("扫描动作不能为空");
        });

        it("应该拒绝无效的缩略图尺寸", () => {
            const invalidScan1: ScanAction = {
                path: "/test/path",
                action: "scan",
                operationType: "directory",
                thumbnailSize: 0,
            };

            const result1 = validateScanParams(invalidScan1);

            expect(result1.isValid).toBe(false);
            expect(result1.error).toBe("缩略图尺寸必须大于0");

            const invalidScan2: ScanAction = {
                path: "/test/path",
                action: "scan",
                operationType: "directory",
                thumbnailSize: -100,
            };

            const result2 = validateScanParams(invalidScan2);

            expect(result2.isValid).toBe(false);
            expect(result2.error).toBe("缩略图尺寸必须大于0");
        });

        it("应该拒绝未定义的缩略图尺寸", () => {
            const invalidScan: any = {
                path: "/test/path",
                action: "scan",
                operationType: "directory",
                // thumbnailSize 未定义
            };

            const result = validateScanParams(invalidScan);

            expect(result.isValid).toBe(false);
            expect(result.error).toBe("缩略图尺寸必须大于0");
        });
    });

    describe("isDirectoryScan", () => {
        it("应该为文件扫描返回false", () => {
            const fileScan: ScanAction = {
                path: "/test/file.jpg",
                action: "scan",
                operationType: "file",
                thumbnailSize: 200,
            };

            const result = isDirectoryScan(fileScan);

            expect(result).toBe(false);
        });

        it("应该为目录扫描返回true", () => {
            const directoryScan: ScanAction = {
                path: "/test/directory",
                action: "scan",
                operationType: "directory",
                thumbnailSize: 200,
            };

            const result = isDirectoryScan(directoryScan);

            expect(result).toBe(true);
        });
    });

    describe("createSubscriptionHandlers", () => {
        it("应该创建正确的订阅处理器", () => {
            const mockSubscriber = {
                next: jest.fn(),
                error: jest.fn(),
                complete: jest.fn(),
            };

            const mockLogger: PhotasaLogger = {
                debug: jest.fn(),
                info: jest.fn(),
                warn: jest.fn(),
                error: jest.fn(),
            } as any;

            const folderPath = "/test/folder";

            const handlers = createSubscriptionHandlers(mockSubscriber, mockLogger, folderPath);

            // 测试next处理器
            const testAction = { path: "/test/action" };
            handlers.next(testAction);
            expect(mockSubscriber.next).toHaveBeenCalledWith(testAction);

            // 测试error处理器
            const testError = new Error("test error");
            handlers.error(testError);
            expect(mockLogger.error).toHaveBeenCalledWith(
                "[scanPhotos] 扫描过程出错: /test/folder",
                testError,
            );
            expect(mockSubscriber.error).toHaveBeenCalledWith(testError);

            // 测试complete处理器
            handlers.complete();
            expect(mockSubscriber.complete).toHaveBeenCalled();
        });
    });
});

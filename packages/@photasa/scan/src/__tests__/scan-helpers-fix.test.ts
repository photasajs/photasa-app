/**
 * 扫描辅助函数修复测试
 *
 * 测试 restoreCachedFiles 函数的修复，验证正确处理 .photasa.json 中
 * 存储的文件名格式，构建正确的完整路径
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "fs-extra";
import path from "path";
import os from "os";
import { restoreCachedFiles } from "../scan-helpers";
import type { PhotasaLogger } from "@photasa/common";
import { Subscriber } from "rxjs";
// Mock buildThumbnailPath
import { buildThumbnailPath } from "../utils/path-utils";
// Mock external dependencies
vi.mock("fs-extra");
vi.mock("@shared/path-util");

const mockFs = fs as any;
const mockLogger: PhotasaLogger = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
} as any;

describe("scan-helpers-fix", () => {
    let tempDir: string;
    let testFolder: string;
    let mockSubscriber: Subscriber<any>;

    beforeEach(async () => {
        tempDir = path.join(os.tmpdir(), `picasa-scan-helpers-test-${Date.now()}`);
        testFolder = path.join(tempDir, "test-folder");
        await fs.ensureDir(testFolder);

        // 创建 mock subscriber
        mockSubscriber = {
            next: vi.fn(),
            error: vi.fn(),
            complete: vi.fn(),
        } as any;

        vi.clearAllMocks();
    });

    afterEach(async () => {
        await fs.remove(tempDir);
    });

    describe("restoreCachedFiles 修复测试", () => {
        it("应该正确构建完整路径从文件名", async () => {
            // 创建包含文件名的 .photasa.json
            const configPath = path.join(testFolder, ".photasa.json");
            const config = {
                version: "1.0",
                photoList: [
                    {
                        path: "photo1.jpg", // 只有文件名，没有完整路径
                        thumbnail: ".photasaoriginals/thumb1.jpg",
                        isImage: true,
                        isVideo: false,
                    },
                    {
                        path: "photo2.heic",
                        thumbnail: ".photasaoriginals/thumb2.heic",
                        isImage: true,
                        isVideo: false,
                    },
                ],
            };
            await fs.writeFile(configPath, JSON.stringify(config, null, 2));

            vi.mocked(buildThumbnailPath).mockImplementation((filePath) =>
                filePath.replace(/\.[^/.]+$/, ".png"),
            );

            // Mock fs.pathExists 返回 true
            mockFs.pathExists.mockResolvedValue(true);

            // Mock fs.readFile
            mockFs.readFile.mockResolvedValue(JSON.stringify(config));

            await restoreCachedFiles(testFolder, mockSubscriber, mockLogger);

            // 验证 next 被调用了正确的次数
            expect(mockSubscriber.next).toHaveBeenCalledTimes(2);

            // 验证第一个文件的路径构建
            const firstCall = (mockSubscriber.next as any).mock.calls[0][0];
            expect(firstCall.path).toBe(path.join(testFolder, "photo1.jpg"));
            expect(firstCall.thumbnail).toBe(".photasaoriginals/thumb1.jpg");
            expect(firstCall.isImage).toBe(true);
            expect(firstCall.isVideo).toBe(false);
            expect(firstCall.isDirectory).toBe(false);

            // 验证第二个文件的路径构建
            const secondCall = (mockSubscriber.next as any).mock.calls[1][0];
            expect(secondCall.path).toBe(path.join(testFolder, "photo2.heic"));
            expect(secondCall.thumbnail).toBe(".photasaoriginals/thumb2.heic");
            expect(secondCall.isImage).toBe(true);
            expect(secondCall.isVideo).toBe(false);
            expect(secondCall.isDirectory).toBe(false);

            // 验证 complete 没有被调用（由调用方控制订阅器生命周期）
            expect(mockSubscriber.complete).not.toHaveBeenCalled();

            // 验证日志记录
            expect(mockLogger.info).toHaveBeenCalledWith(
                `[restoreCachedFiles] 从缓存恢复 ${config.photoList.length} 个文件`,
            );
            expect(mockLogger.info).toHaveBeenCalledWith(
                `[restoreCachedFiles] 缓存恢复完成: ${config.photoList.length} 个文件`,
            );
        });

        it("应该处理没有缩略图路径的情况", async () => {
            const configPath = path.join(testFolder, ".photasa.json");
            const config = {
                version: "1.0",
                photoList: [
                    {
                        path: "photo1.jpg",
                        // 没有 thumbnail 字段
                        isImage: true,
                        isVideo: false,
                    },
                ],
            };
            await fs.writeFile(configPath, JSON.stringify(config, null, 2));

            // Mock buildThumbnailPath
            const { buildThumbnailPath } = await import("@shared/path-util");
            vi.mocked(buildThumbnailPath).mockReturnValue("generated-thumb.jpg");

            mockFs.pathExists.mockResolvedValue(true);
            mockFs.readFile.mockResolvedValue(JSON.stringify(config));

            await restoreCachedFiles(testFolder, mockSubscriber, mockLogger);

            const call = (mockSubscriber.next as any).mock.calls[0][0];
            expect(call.thumbnail).toBe("generated-thumb.jpg");
            expect(buildThumbnailPath).toHaveBeenCalledWith(path.join(testFolder, "photo1.jpg"));
        });

        it("应该处理配置文件不存在的情况", async () => {
            mockFs.pathExists.mockResolvedValue(false);

            await restoreCachedFiles(testFolder, mockSubscriber, mockLogger);

            expect(mockSubscriber.next).not.toHaveBeenCalled();
            expect(mockSubscriber.complete).not.toHaveBeenCalled();
            expect(mockLogger.warn).toHaveBeenCalledWith(
                `[restoreCachedFiles] 配置文件不存在: ${path.join(testFolder, ".photasa.json")}`,
            );
        });

        it("应该处理配置文件格式无效的情况", async () => {
            const configPath = path.join(testFolder, ".photasa.json");
            const invalidConfig = {
                version: "1.0",
                // 缺少 photoList 字段
            };
            await fs.writeFile(configPath, JSON.stringify(invalidConfig, null, 2));

            mockFs.pathExists.mockResolvedValue(true);
            mockFs.readFile.mockResolvedValue(JSON.stringify(invalidConfig));

            await restoreCachedFiles(testFolder, mockSubscriber, mockLogger);

            expect(mockSubscriber.next).not.toHaveBeenCalled();
            expect(mockSubscriber.complete).not.toHaveBeenCalled();
            expect(mockLogger.warn).toHaveBeenCalledWith(
                `[restoreCachedFiles] 配置文件格式无效: ${configPath}`,
            );
        });

        it("应该处理空照片列表的情况", async () => {
            const configPath = path.join(testFolder, ".photasa.json");
            const emptyConfig = {
                version: "1.0",
                photoList: [],
            };
            await fs.writeFile(configPath, JSON.stringify(emptyConfig, null, 2));

            mockFs.pathExists.mockResolvedValue(true);
            mockFs.readFile.mockResolvedValue(JSON.stringify(emptyConfig));

            await restoreCachedFiles(testFolder, mockSubscriber, mockLogger);

            expect(mockSubscriber.next).not.toHaveBeenCalled();
            expect(mockSubscriber.complete).not.toHaveBeenCalled();
            expect(mockLogger.info).toHaveBeenCalledWith(
                `[restoreCachedFiles] 从缓存恢复 0 个文件`,
            );
        });

        it("应该处理读取配置文件失败的情况", async () => {
            mockFs.pathExists.mockResolvedValue(true);
            mockFs.readFile.mockRejectedValue(new Error("读取失败"));

            await restoreCachedFiles(testFolder, mockSubscriber, mockLogger);

            expect(mockSubscriber.error).toHaveBeenCalledWith(expect.any(Error));
            expect(mockLogger.error).toHaveBeenCalledWith(
                `[restoreCachedFiles] 恢复缓存失败: ${testFolder}`,
                expect.any(Error),
            );
        });

        it("应该跳过无效的照片记录", async () => {
            const configPath = path.join(testFolder, ".photasa.json");
            const config = {
                version: "1.0",
                photoList: [
                    {
                        path: "photo1.jpg",
                        thumbnail: "thumb1.jpg",
                        isImage: true,
                        isVideo: false,
                    },
                    null, // 无效记录
                    {
                        // 缺少 path 字段
                        thumbnail: "thumb2.jpg",
                        isImage: true,
                        isVideo: false,
                    },
                    {
                        path: "photo3.jpg",
                        thumbnail: "thumb3.jpg",
                        isImage: true,
                        isVideo: false,
                    },
                ],
            };
            await fs.writeFile(configPath, JSON.stringify(config, null, 2));

            mockFs.pathExists.mockResolvedValue(true);
            mockFs.readFile.mockResolvedValue(JSON.stringify(config));

            await restoreCachedFiles(testFolder, mockSubscriber, mockLogger);

            // 只应该处理有效的记录
            expect(mockSubscriber.next).toHaveBeenCalledTimes(2);
            expect(mockSubscriber.complete).not.toHaveBeenCalled();
        });

        it("应该处理混合媒体类型", async () => {
            const configPath = path.join(testFolder, ".photasa.json");
            const config = {
                version: "1.0",
                photoList: [
                    {
                        path: "photo1.jpg",
                        thumbnail: "thumb1.jpg",
                        isImage: true,
                        isVideo: false,
                    },
                    {
                        path: "video1.mp4",
                        thumbnail: "thumb2.jpg",
                        isImage: false,
                        isVideo: true,
                    },
                ],
            };
            await fs.writeFile(configPath, JSON.stringify(config, null, 2));

            mockFs.pathExists.mockResolvedValue(true);
            mockFs.readFile.mockResolvedValue(JSON.stringify(config));

            await restoreCachedFiles(testFolder, mockSubscriber, mockLogger);

            expect(mockSubscriber.next).toHaveBeenCalledTimes(2);

            const imageCall = (mockSubscriber.next as any).mock.calls[0][0];
            expect(imageCall.isImage).toBe(true);
            expect(imageCall.isVideo).toBe(false);

            const videoCall = (mockSubscriber.next as any).mock.calls[1][0];
            expect(videoCall.isImage).toBe(false);
            expect(videoCall.isVideo).toBe(true);
        });
    });

    describe("性能测试", () => {
        it("应该快速处理大量照片记录", async () => {
            const largePhotoList = Array.from({ length: 1000 }, (_, i) => ({
                path: `photo${i}.jpg`,
                thumbnail: `thumb${i}.jpg`,
                isImage: true,
                isVideo: false,
            }));

            const configPath = path.join(testFolder, ".photasa.json");
            const config = {
                version: "1.0",
                photoList: largePhotoList,
            };
            await fs.writeFile(configPath, JSON.stringify(config, null, 2));

            mockFs.pathExists.mockResolvedValue(true);
            mockFs.readFile.mockResolvedValue(JSON.stringify(config));

            const startTime = Date.now();
            await restoreCachedFiles(testFolder, mockSubscriber, mockLogger);
            const endTime = Date.now();

            expect(mockSubscriber.next).toHaveBeenCalledTimes(1000);
            expect(endTime - startTime).toBeLessThan(500); // 应该在500ms内完成
        });
    });
});

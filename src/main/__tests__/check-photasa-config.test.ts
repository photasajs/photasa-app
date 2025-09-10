/**
 * check-photasa-config API 测试
 *
 * 测试主进程中的 check-photasa-config IPC 处理函数
 * 验证配置文件检查的各种场景
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "fs-extra";
import path from "path";

// Mock fs-extra
vi.mock("fs-extra");
const mockFs = vi.mocked(fs);

// Mock electron
const mockIpcMain = {
    handle: vi.fn(),
};

vi.mock("electron", () => ({
    ipcMain: mockIpcMain,
}));

// 导入实际的 handler 函数
import { checkPhotasaConfig } from "../index";

describe("check-photasa-config API", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.resetAllMocks();
    });

    describe("配置文件存在且有效", () => {
        it("应该返回 hasConfig: true 和正确的照片数量", async () => {
            const testFolder = "/test/folder";
            const validConfig = {
                version: "1.0",
                lastModified: Date.now(),
                photoList: [
                    { path: "/test/folder/photo1.jpg", name: "photo1.jpg" },
                    { path: "/test/folder/photo2.jpg", name: "photo2.jpg" },
                ],
            };

            // Mock fs.existsSync 返回 true
            mockFs.existsSync.mockReturnValue(true);
            // Mock fs.readFile 返回配置内容
            mockFs.readFile.mockResolvedValue(JSON.stringify(validConfig));

            // 模拟 IPC 处理函数
            const handler = vi.fn();
            mockIpcMain.handle.mockImplementation((channel, callback) => {
                if (channel === "picasa:check-photasa-config") {
                    handler.mockImplementation(callback);
                }
            });

            // 调用处理函数
            const result = await checkPhotasaConfig(testFolder);

            expect(result).toEqual({
                hasConfig: true,
                photoCount: 2,
                reason: "配置文件存在且有效",
            });
            expect(mockFs.existsSync).toHaveBeenCalledWith(path.join(testFolder, ".photasa.json"));
            expect(mockFs.readFile).toHaveBeenCalledWith(
                path.join(testFolder, ".photasa.json"),
                "utf8",
            );
        });

        it("应该处理空照片列表", async () => {
            const testFolder = "/test/folder";
            const emptyConfig = {
                version: "1.0",
                lastModified: Date.now(),
                photoList: [],
            };

            mockFs.existsSync.mockReturnValue(true);
            mockFs.readFile.mockResolvedValue(JSON.stringify(emptyConfig));

            const handler = vi.fn();
            mockIpcMain.handle.mockImplementation((channel, callback) => {
                if (channel === "picasa:check-photasa-config") {
                    handler.mockImplementation(callback);
                }
            });

            const result = await handler(testFolder);

            expect(result).toEqual({
                hasConfig: false,
                reason: "照片列表为空",
            });
        });
    });

    describe("配置文件不存在", () => {
        it("应该返回 hasConfig: false", async () => {
            const testFolder = "/test/folder";

            mockFs.existsSync.mockReturnValue(false);

            const handler = vi.fn();
            mockIpcMain.handle.mockImplementation((channel, callback) => {
                if (channel === "picasa:check-photasa-config") {
                    handler.mockImplementation(callback);
                }
            });

            const result = await handler(testFolder);

            expect(result).toEqual({
                hasConfig: false,
                reason: "配置文件不存在",
            });
            expect(mockFs.existsSync).toHaveBeenCalledWith(path.join(testFolder, ".photasa.json"));
            expect(mockFs.readFile).not.toHaveBeenCalled();
        });
    });

    describe("配置文件格式错误", () => {
        it("应该处理无效的 JSON 格式", async () => {
            const testFolder = "/test/folder";

            mockFs.existsSync.mockReturnValue(true);
            mockFs.readFile.mockResolvedValue("invalid json");

            const handler = vi.fn();
            mockIpcMain.handle.mockImplementation((channel, callback) => {
                if (channel === "picasa:check-photasa-config") {
                    handler.mockImplementation(callback);
                }
            });

            const result = await handler(testFolder);

            expect(result).toEqual({
                hasConfig: false,
                reason: "配置文件格式错误",
            });
        });

        it("应该处理缺少 photoList 字段的配置", async () => {
            const testFolder = "/test/folder";
            const invalidConfig = {
                version: "1.0",
                lastModified: Date.now(),
                // 缺少 photoList 字段
            };

            mockFs.existsSync.mockReturnValue(true);
            mockFs.readFile.mockResolvedValue(JSON.stringify(invalidConfig));

            const handler = vi.fn();
            mockIpcMain.handle.mockImplementation((channel, callback) => {
                if (channel === "picasa:check-photasa-config") {
                    handler.mockImplementation(callback);
                }
            });

            const result = await handler(testFolder);

            expect(result).toEqual({
                hasConfig: false,
                reason: "配置文件格式错误",
            });
        });

        it("应该处理 photoList 不是数组的情况", async () => {
            const testFolder = "/test/folder";
            const invalidConfig = {
                version: "1.0",
                lastModified: Date.now(),
                photoList: "not an array",
            };

            mockFs.existsSync.mockReturnValue(true);
            mockFs.readFile.mockResolvedValue(JSON.stringify(invalidConfig));

            const handler = vi.fn();
            mockIpcMain.handle.mockImplementation((channel, callback) => {
                if (channel === "picasa:check-photasa-config") {
                    handler.mockImplementation(callback);
                }
            });

            const result = await handler(testFolder);

            expect(result).toEqual({
                hasConfig: false,
                reason: "配置文件格式错误",
            });
        });
    });

    describe("文件系统错误", () => {
        it("应该处理文件读取错误", async () => {
            const testFolder = "/test/folder";

            mockFs.existsSync.mockReturnValue(true);
            mockFs.readFile.mockRejectedValue(new Error("读取失败"));

            const handler = vi.fn();
            mockIpcMain.handle.mockImplementation((channel, callback) => {
                if (channel === "picasa:check-photasa-config") {
                    handler.mockImplementation(callback);
                }
            });

            const result = await handler(testFolder);

            expect(result).toEqual({
                hasConfig: false,
                reason: "文件系统错误",
            });
        });

        it("应该处理文件存在性检查错误", async () => {
            const testFolder = "/test/folder";

            mockFs.existsSync.mockImplementation(() => {
                throw new Error("检查失败");
            });

            const handler = vi.fn();
            mockIpcMain.handle.mockImplementation((channel, callback) => {
                if (channel === "picasa:check-photasa-config") {
                    handler.mockImplementation(callback);
                }
            });

            const result = await handler(testFolder);

            expect(result).toEqual({
                hasConfig: false,
                reason: "文件系统错误",
            });
        });
    });

    describe("边界情况", () => {
        it("应该处理空字符串路径", async () => {
            const testFolder = "";

            const handler = vi.fn();
            mockIpcMain.handle.mockImplementation((channel, callback) => {
                if (channel === "picasa:check-photasa-config") {
                    handler.mockImplementation(callback);
                }
            });

            const result = await handler(testFolder);

            expect(result).toEqual({
                hasConfig: false,
                reason: "路径无效",
            });
        });

        it("应该处理 null 路径", async () => {
            const testFolder = null;

            const handler = vi.fn();
            mockIpcMain.handle.mockImplementation((channel, callback) => {
                if (channel === "picasa:check-photasa-config") {
                    handler.mockImplementation(callback);
                }
            });

            const result = await handler(testFolder);

            expect(result).toEqual({
                hasConfig: false,
                reason: "路径无效",
            });
        });

        it("应该处理包含特殊字符的路径", async () => {
            const testFolder = "/test/folder with spaces & symbols!";

            mockFs.existsSync.mockReturnValue(false);

            const handler = vi.fn();
            mockIpcMain.handle.mockImplementation((channel, callback) => {
                if (channel === "picasa:check-photasa-config") {
                    handler.mockImplementation(callback);
                }
            });

            const result = await handler(testFolder);

            expect(result).toEqual({
                hasConfig: false,
                reason: "配置文件不存在",
            });
            expect(mockFs.existsSync).toHaveBeenCalledWith(path.join(testFolder, ".photasa.json"));
        });
    });

    describe("性能测试", () => {
        it("应该快速处理大量照片的配置文件", async () => {
            const testFolder = "/test/folder";
            const largePhotoList = Array.from({ length: 1000 }, (_, i) => ({
                path: `/test/folder/photo${i}.jpg`,
                name: `photo${i}.jpg`,
            }));
            const largeConfig = {
                version: "1.0",
                lastModified: Date.now(),
                photoList: largePhotoList,
            };

            mockFs.existsSync.mockReturnValue(true);
            mockFs.readFile.mockResolvedValue(JSON.stringify(largeConfig));

            const handler = vi.fn();
            mockIpcMain.handle.mockImplementation((channel, callback) => {
                if (channel === "picasa:check-photasa-config") {
                    handler.mockImplementation(callback);
                }
            });

            const startTime = Date.now();
            const result = await handler(testFolder);
            const endTime = Date.now();

            expect(result).toEqual({
                hasConfig: true,
                photoCount: 1000,
                reason: "配置文件存在且有效",
            });
            expect(endTime - startTime).toBeLessThan(100); // 应该在100ms内完成
        });
    });
});

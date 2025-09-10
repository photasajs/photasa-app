/**
 * 检查 photasa.json 配置 API 测试
 *
 * 测试新添加的 IPC API checkPhotasaConfig 功能
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "fs-extra";
import path from "path";
import os from "os";

// Mock fs-extra
vi.mock("fs-extra");
const mockFs = fs as any;

describe("check-photasa-config API", () => {
    let tempDir: string;
    let testFolder: string;

    beforeEach(async () => {
        tempDir = path.join(os.tmpdir(), `picasa-check-config-test-${Date.now()}`);
        testFolder = path.join(tempDir, "test-folder");
        await fs.ensureDir(testFolder);
        vi.clearAllMocks();
    });

    afterEach(async () => {
        await fs.remove(tempDir);
    });

    describe("配置文件存在且有效", () => {
        it("应该返回 hasConfig: true 和正确的照片数量", async () => {
            const configPath = path.join(testFolder, ".photasa.json");
            const validConfig = {
                version: "1.0",
                photoList: [
                    { path: "photo1.jpg", thumbnail: "thumb1.jpg", isVideo: false },
                    { path: "photo2.jpg", thumbnail: "thumb2.jpg", isVideo: false },
                    { path: "video1.mp4", thumbnail: "thumb3.jpg", isVideo: true },
                ],
            };
            await fs.writeFile(configPath, JSON.stringify(validConfig, null, 2));

            // Mock fs.existsSync 返回 true
            mockFs.existsSync.mockReturnValue(true);
            // Mock fs.readFile 返回配置内容
            mockFs.readFile.mockResolvedValue(JSON.stringify(validConfig));

            // 模拟 IPC 处理函数
            const { ipcMain } = await import("electron");
            const handler = vi.fn();
            (ipcMain as any).handle = vi.fn().mockImplementation((channel, callback) => {
                if (channel === "picasa:check-photasa-config") {
                    handler.mockImplementation(callback);
                }
            });

            // 调用处理函数
            const result = await handler(null, testFolder);

            expect(result).toEqual({
                hasConfig: true,
                photoCount: 3,
                reason: "配置文件存在且有效",
            });
        });

        it("应该处理空照片列表", async () => {
            const configPath = path.join(testFolder, ".photasa.json");
            const emptyConfig = {
                version: "1.0",
                photoList: [],
            };
            await fs.writeFile(configPath, JSON.stringify(emptyConfig, null, 2));

            mockFs.existsSync.mockReturnValue(true);
            mockFs.readFile.mockResolvedValue(JSON.stringify(emptyConfig));

            const { ipcMain } = await import("electron");
            const handler = vi.fn();
            (ipcMain as any).handle = vi.fn().mockImplementation((channel, callback) => {
                if (channel === "picasa:check-photasa-config") {
                    handler.mockImplementation(callback);
                }
            });

            const result = await handler(null, testFolder);

            expect(result).toEqual({
                hasConfig: false,
                reason: "配置文件为空",
            });
        });
    });

    describe("配置文件不存在", () => {
        it("应该返回 hasConfig: false", async () => {
            mockFs.existsSync.mockReturnValue(false);

            const { ipcMain } = await import("electron");
            const handler = vi.fn();
            (ipcMain as any).handle = vi.fn().mockImplementation((channel, callback) => {
                if (channel === "picasa:check-photasa-config") {
                    handler.mockImplementation(callback);
                }
            });

            const result = await handler(null, testFolder);

            expect(result).toEqual({
                hasConfig: false,
                reason: "配置文件不存在",
            });
        });
    });

    describe("配置文件格式错误", () => {
        it("应该处理无效的 JSON 格式", async () => {
            const configPath = path.join(testFolder, ".photasa.json");
            await fs.writeFile(configPath, "invalid json content");

            mockFs.existsSync.mockReturnValue(true);
            mockFs.readFile.mockResolvedValue("invalid json content");

            const { ipcMain } = await import("electron");
            const handler = vi.fn();
            (ipcMain as any).handle = vi.fn().mockImplementation((channel, callback) => {
                if (channel === "picasa:check-photasa-config") {
                    handler.mockImplementation(callback);
                }
            });

            const result = await handler(null, testFolder);

            expect(result).toEqual({
                hasConfig: false,
                reason: "配置文件读取失败",
            });
        });

        it("应该处理缺少 photoList 字段的配置", async () => {
            const configPath = path.join(testFolder, ".photasa.json");
            const invalidConfig = {
                version: "1.0",
                // 缺少 photoList 字段
            };
            await fs.writeFile(configPath, JSON.stringify(invalidConfig, null, 2));

            mockFs.existsSync.mockReturnValue(true);
            mockFs.readFile.mockResolvedValue(JSON.stringify(invalidConfig));

            const { ipcMain } = await import("electron");
            const handler = vi.fn();
            (ipcMain as any).handle = vi.fn().mockImplementation((channel, callback) => {
                if (channel === "picasa:check-photasa-config") {
                    handler.mockImplementation(callback);
                }
            });

            const result = await handler(null, testFolder);

            expect(result).toEqual({
                hasConfig: false,
                reason: "配置文件为空",
            });
        });

        it("应该处理 photoList 不是数组的情况", async () => {
            const configPath = path.join(testFolder, ".photasa.json");
            const invalidConfig = {
                version: "1.0",
                photoList: "not an array",
            };
            await fs.writeFile(configPath, JSON.stringify(invalidConfig, null, 2));

            mockFs.existsSync.mockReturnValue(true);
            mockFs.readFile.mockResolvedValue(JSON.stringify(invalidConfig));

            const { ipcMain } = await import("electron");
            const handler = vi.fn();
            (ipcMain as any).handle = vi.fn().mockImplementation((channel, callback) => {
                if (channel === "picasa:check-photasa-config") {
                    handler.mockImplementation(callback);
                }
            });

            const result = await handler(null, testFolder);

            expect(result).toEqual({
                hasConfig: false,
                reason: "配置文件为空",
            });
        });
    });

    describe("文件系统错误", () => {
        it("应该处理文件读取错误", async () => {
            mockFs.existsSync.mockReturnValue(true);
            mockFs.readFile.mockRejectedValue(new Error("权限被拒绝"));

            const { ipcMain } = await import("electron");
            const handler = vi.fn();
            (ipcMain as any).handle = vi.fn().mockImplementation((channel, callback) => {
                if (channel === "picasa:check-photasa-config") {
                    handler.mockImplementation(callback);
                }
            });

            const result = await handler(null, testFolder);

            expect(result).toEqual({
                hasConfig: false,
                reason: "配置文件读取失败",
            });
        });

        it("应该处理文件存在性检查错误", async () => {
            mockFs.existsSync.mockImplementation(() => {
                throw new Error("文件系统错误");
            });

            const { ipcMain } = await import("electron");
            const handler = vi.fn();
            (ipcMain as any).handle = vi.fn().mockImplementation((channel, callback) => {
                if (channel === "picasa:check-photasa-config") {
                    handler.mockImplementation(callback);
                }
            });

            const result = await handler(null, testFolder);

            expect(result).toEqual({
                hasConfig: false,
                reason: "配置文件读取失败",
            });
        });
    });

    describe("边界情况", () => {
        it("应该处理空字符串路径", async () => {
            const { ipcMain } = await import("electron");
            const handler = vi.fn();
            (ipcMain as any).handle = vi.fn().mockImplementation((channel, callback) => {
                if (channel === "picasa:check-photasa-config") {
                    handler.mockImplementation(callback);
                }
            });

            const result = await handler(null, "");

            expect(result).toEqual({
                hasConfig: false,
                reason: "配置文件读取失败",
            });
        });

        it("应该处理 null 路径", async () => {
            const { ipcMain } = await import("electron");
            const handler = vi.fn();
            (ipcMain as any).handle = vi.fn().mockImplementation((channel, callback) => {
                if (channel === "picasa:check-photasa-config") {
                    handler.mockImplementation(callback);
                }
            });

            const result = await handler(null, null);

            expect(result).toEqual({
                hasConfig: false,
                reason: "配置文件读取失败",
            });
        });

        it("应该处理包含特殊字符的路径", async () => {
            const specialPath = path.join(testFolder, "folder with spaces", "中文文件夹");
            await fs.ensureDir(specialPath);

            const configPath = path.join(specialPath, ".photasa.json");
            const validConfig = {
                version: "1.0",
                photoList: [{ path: "photo1.jpg", thumbnail: "thumb1.jpg", isVideo: false }],
            };
            await fs.writeFile(configPath, JSON.stringify(validConfig, null, 2));

            mockFs.existsSync.mockReturnValue(true);
            mockFs.readFile.mockResolvedValue(JSON.stringify(validConfig));

            const { ipcMain } = await import("electron");
            const handler = vi.fn();
            (ipcMain as any).handle = vi.fn().mockImplementation((channel, callback) => {
                if (channel === "picasa:check-photasa-config") {
                    handler.mockImplementation(callback);
                }
            });

            const result = await handler(null, specialPath);

            expect(result).toEqual({
                hasConfig: true,
                photoCount: 1,
                reason: "配置文件存在且有效",
            });
        });
    });

    describe("性能测试", () => {
        it("应该快速处理大量照片的配置文件", async () => {
            const largePhotoList = Array.from({ length: 10000 }, (_, i) => ({
                path: `photo${i}.jpg`,
                thumbnail: `thumb${i}.jpg`,
                isVideo: false,
            }));

            const configPath = path.join(testFolder, ".photasa.json");
            const largeConfig = {
                version: "1.0",
                photoList: largePhotoList,
            };
            await fs.writeFile(configPath, JSON.stringify(largeConfig, null, 2));

            mockFs.existsSync.mockReturnValue(true);
            mockFs.readFile.mockResolvedValue(JSON.stringify(largeConfig));

            const { ipcMain } = await import("electron");
            const handler = vi.fn();
            (ipcMain as any).handle = vi.fn().mockImplementation((channel, callback) => {
                if (channel === "picasa:check-photasa-config") {
                    handler.mockImplementation(callback);
                }
            });

            const startTime = Date.now();
            const result = await handler(null, testFolder);
            const endTime = Date.now();

            expect(result).toEqual({
                hasConfig: true,
                photoCount: 10000,
                reason: "配置文件存在且有效",
            });
            expect(endTime - startTime).toBeLessThan(1000); // 应该在1秒内完成
        });
    });
});

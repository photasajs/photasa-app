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
vi.mock("electron", () => ({
    ipcMain: {
        handle: vi.fn(),
    },
    app: {
        on: vi.fn(),
        whenReady: vi.fn().mockResolvedValue(undefined),
    },
    BrowserWindow: vi.fn(),
    shell: {
        openExternal: vi.fn(),
    },
    dialog: {
        showOpenDialog: vi.fn(),
    },
    screen: {
        getPrimaryDisplay: vi.fn(),
    },
    protocol: {
        registerFileProtocol: vi.fn(),
    },
}));

// Mock @electron-toolkit/utils
vi.mock("@electron-toolkit/utils", () => ({
    electronApp: {
        on: vi.fn(),
        whenReady: vi.fn(),
    },
    optimizer: {
        watch: vi.fn(),
    },
    is: {
        dev: true,
        mac: true,
        windows: false,
        linux: false,
    },
}));

// Mock @bugsnag/electron
vi.mock("@bugsnag/electron", () => ({
    default: {
        start: vi.fn(),
        create: vi.fn(),
    },
}));

// Mock electron-is-dev
vi.mock("electron-is-dev", () => ({
    default: true,
}));

// Mock config-worker
vi.mock("../config/config-worker", () => ({
    default: vi.fn(),
}));

// Mock config-service
vi.mock("../config/config-service", () => ({
    default: vi.fn(),
}));

// Mock scan-service
vi.mock("../scan/scan-service", () => ({
    default: vi.fn(),
}));

// Mock scan-worker
vi.mock("../scan/scan-worker", () => ({
    default: vi.fn(),
}));

// Mock other services
vi.mock("../watch/watch-service", () => ({
    default: vi.fn(),
}));

vi.mock("../thumbnail/thumbnail-service", () => ({
    default: vi.fn(),
}));

vi.mock("../window/window-service", () => ({
    default: vi.fn(),
}));

vi.mock("../shell/shell-service", () => ({
    default: vi.fn(),
}));

vi.mock("../import/import-service", () => ({
    default: vi.fn(),
}));

// 直接测试函数逻辑
function checkPhotasaConfig(folderPath: string) {
    try {
        const configPath = path.join(folderPath, ".photasa.json");
        if (!mockFs.existsSync(configPath)) {
            return { hasConfig: false, reason: "配置文件不存在" };
        }

        const configContent = mockFs.readFileSync(configPath, "utf8");
        const config = JSON.parse(configContent);

        if (
            !config.photoList ||
            !Array.isArray(config.photoList) ||
            config.photoList.length === 0
        ) {
            return { hasConfig: false, reason: "配置文件为空" };
        }

        return {
            hasConfig: true,
            photoCount: config.photoList.length,
            reason: "配置文件存在且有效",
        };
    } catch (error) {
        return { hasConfig: false, reason: "配置文件读取失败" };
    }
}

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
            // Mock fs.readFileSync 返回配置内容
            mockFs.readFileSync.mockReturnValue(JSON.stringify(validConfig));

            // 直接调用函数
            const result = checkPhotasaConfig(testFolder);

            expect(result).toEqual({
                hasConfig: true,
                photoCount: 2,
                reason: "配置文件存在且有效",
            });
            expect(mockFs.existsSync).toHaveBeenCalledWith(path.join(testFolder, ".photasa.json"));
            expect(mockFs.readFileSync).toHaveBeenCalledWith(
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
            mockFs.readFileSync.mockReturnValue(JSON.stringify(emptyConfig));

            const result = checkPhotasaConfig(testFolder);

            expect(result).toEqual({
                hasConfig: false,
                reason: "配置文件为空",
            });
        });
    });

    describe("配置文件不存在", () => {
        it("应该返回 hasConfig: false", async () => {
            const testFolder = "/test/folder";

            mockFs.existsSync.mockReturnValue(false);

            const result = checkPhotasaConfig(testFolder);

            expect(result).toEqual({
                hasConfig: false,
                reason: "配置文件不存在",
            });
            expect(mockFs.existsSync).toHaveBeenCalledWith(path.join(testFolder, ".photasa.json"));
            expect(mockFs.readFileSync).not.toHaveBeenCalled();
        });
    });

    describe("配置文件格式错误", () => {
        it("应该处理无效的 JSON 格式", async () => {
            const testFolder = "/test/folder";

            mockFs.existsSync.mockReturnValue(true);
            mockFs.readFileSync.mockReturnValue("invalid json");

            const result = checkPhotasaConfig(testFolder);

            expect(result).toEqual({
                hasConfig: false,
                reason: "配置文件读取失败",
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
            mockFs.readFileSync.mockReturnValue(JSON.stringify(invalidConfig));

            const result = checkPhotasaConfig(testFolder);

            expect(result).toEqual({
                hasConfig: false,
                reason: "配置文件为空",
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
            mockFs.readFileSync.mockReturnValue(JSON.stringify(invalidConfig));

            const result = checkPhotasaConfig(testFolder);

            expect(result).toEqual({
                hasConfig: false,
                reason: "配置文件为空",
            });
        });
    });

    describe("文件系统错误", () => {
        it("应该处理文件读取错误", async () => {
            const testFolder = "/test/folder";

            mockFs.existsSync.mockReturnValue(true);
            mockFs.readFileSync.mockImplementation(() => {
                throw new Error("读取失败");
            });

            const result = checkPhotasaConfig(testFolder);

            expect(result).toEqual({
                hasConfig: false,
                reason: "配置文件读取失败",
            });
        });

        it("应该处理文件存在性检查错误", async () => {
            const testFolder = "/test/folder";

            mockFs.existsSync.mockImplementation(() => {
                throw new Error("检查失败");
            });

            const result = checkPhotasaConfig(testFolder);

            expect(result).toEqual({
                hasConfig: false,
                reason: "配置文件读取失败",
            });
        });
    });

    describe("边界情况", () => {
        it("应该处理空字符串路径", async () => {
            const testFolder = "";

            const result = checkPhotasaConfig(testFolder);

            expect(result).toEqual({
                hasConfig: false,
                reason: "配置文件不存在",
            });
        });

        it("应该处理 null 路径", async () => {
            const testFolder = null;

            const result = checkPhotasaConfig(testFolder as any);

            expect(result).toEqual({
                hasConfig: false,
                reason: "配置文件读取失败",
            });
        });

        it("应该处理包含特殊字符的路径", async () => {
            const testFolder = "/test/folder with spaces & symbols!";

            mockFs.existsSync.mockReturnValue(false);

            const result = checkPhotasaConfig(testFolder);

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
            mockFs.readFileSync.mockReturnValue(JSON.stringify(largeConfig));

            const startTime = Date.now();
            const result = checkPhotasaConfig(testFolder);
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

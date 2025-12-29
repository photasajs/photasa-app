/**
 * HeicBrush 单元测试
 */

import { HeicBrush, HeicProcessingError } from "../HeicBrush";
import { describe, test, beforeEach, afterEach, expect, vi } from "vitest";
import * as heifModuleMock from "@photasa/maliang-bundle";

// Mock the bundle
vi.mock("@photasa/maliang-bundle", () => ({
    initializeHeifModule: vi.fn(),
    resetHeifModule: vi.fn(),
}));
import fs from "fs-extra";
import sharp from "sharp";
import exifreader from "exifreader";

// Mock依赖
vi.mock("../../../wasm/heif-module");
vi.mock("fs-extra");
vi.mock("sharp");
vi.mock("exifreader");

describe("HeicBrush", () => {
    let heicBrush: HeicBrush;
    let mockLogger: any;
    let mockHeifModule: any;

    beforeEach(() => {
        heicBrush = new HeicBrush();
        vi.clearAllMocks();

        // 创建mock logger
        mockLogger = {
            debug: vi.fn(),
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
        };

        // Mock HEIF模块
        mockHeifModule = {
            decode: vi.fn().mockReturnValue({
                width: 1920,
                height: 1080,
                channels: 4,
                data: new Uint8Array(1920 * 1080 * 4),
            }),
        };

        // 设置默认mock行为
        (heifModuleMock.initializeHeifModule as any).mockResolvedValue(mockHeifModule);
        (fs.readFile as any).mockResolvedValue(Buffer.from("mock heic data"));
        (fs.pathExists as any).mockResolvedValue(true);
    });

    afterEach(() => {
        (heifModuleMock.resetHeifModule as any)();
    });

    describe("基本属性", () => {
        test("应该有正确的名称和支持格式", () => {
            expect(heicBrush.name).toBe("HeicBrush");
            expect(heicBrush.supportedFormats).toEqual(["heic", "heif"]);
            expect(heicBrush.capabilities).toEqual([
                "extractMetadata",
                "generateThumbnail",
                "convertFormat",
            ]);
        });
    });

    describe("initialize", () => {
        test("应该成功初始化HEIF模块", async () => {
            await heicBrush.initialize({}, mockLogger);

            expect(heifModuleMock.initializeHeifModule).toHaveBeenCalled();
            expect(mockLogger.info).toHaveBeenCalledWith(
                expect.stringContaining("HeicBrush initialized successfully"),
            );
        });

        test("应该处理初始化失败", async () => {
            const error = new Error("HEIF module failed to load");
            (heifModuleMock.initializeHeifModule as any).mockRejectedValue(error);

            await expect(heicBrush.initialize({}, mockLogger)).rejects.toThrow(HeicProcessingError);

            expect(mockLogger.error).toHaveBeenCalledWith(
                expect.stringContaining("HeicBrush failed to initialize"),
                error,
            );
        });

        test("应该跳过重复初始化", async () => {
            await heicBrush.initialize({}, mockLogger);
            await heicBrush.initialize({}, mockLogger);

            expect(heifModuleMock.initializeHeifModule).toHaveBeenCalledTimes(1);
            expect(mockLogger.debug).toHaveBeenCalledWith(
                expect.stringContaining("HeicBrush already initialized"),
            );
        });
    });

    describe("createMiniature", () => {
        const mockSharpInstance = {
            rotate: vi.fn().mockReturnThis(),
            resize: vi.fn().mockReturnThis(),
            toFormat: vi.fn().mockReturnThis(),
            toFile: vi.fn().mockImplementation(() => Promise.resolve()),
            toBuffer: vi.fn().mockImplementation(() => Promise.resolve(Buffer.from("thumbnail"))),
        } as any;

        beforeEach(() => {
            (sharp as unknown as ReturnType<typeof vi.fn>).mockReturnValue(mockSharpInstance);
        });

        test("应该成功创建缩略图文件", async () => {
            const filePath = "/path/to/test.heic";
            const options = {
                width: 200,
                height: 150,
                outputPath: "/path/to/thumbnail.png",
                format: "png" as const,
            };

            const result = await heicBrush.createMiniature(filePath, options, mockLogger);

            expect(result).toBe("/path/to/thumbnail.png");
            expect(mockHeifModule.decode).toHaveBeenCalled();
            expect(mockSharpInstance.resize).toHaveBeenCalledWith(200, 150, {
                fit: "inside",
                background: { r: 255, g: 255, b: 255, alpha: 1 },
                withoutEnlargement: true,
            });
            expect(mockSharpInstance.toFormat).toHaveBeenCalledWith("png", {
                quality: 90,
            });
            expect(mockSharpInstance.toFile).toHaveBeenCalledWith("/path/to/thumbnail.png");
        });

        test("应该成功创建缩略图Buffer", async () => {
            const filePath = "/path/to/test.heic";
            const options = {
                width: 200,
                height: 150,
                format: "jpeg" as const,
            };

            const result = await heicBrush.createMiniature(filePath, options, mockLogger);

            expect(result).toEqual(Buffer.from("thumbnail"));
            expect(mockSharpInstance.toFormat).toHaveBeenCalledWith("jpeg", {
                quality: 90,
            });
            expect(mockSharpInstance.toBuffer).toHaveBeenCalled();
        });

        test("应该处理HEIC解码失败", async () => {
            const filePath = "/path/to/test.heic";
            const options = {
                width: 200,
                height: 150,
                outputPath: "/path/to/thumbnail.png",
                format: "png" as const,
            };

            const error = new Error("HEIC decode failed");
            mockHeifModule.decode.mockImplementation(() => {
                throw error;
            });

            await expect(heicBrush.createMiniature(filePath, options, mockLogger)).rejects.toThrow(
                HeicProcessingError,
            );

            expect(mockLogger.error).toHaveBeenCalledWith(
                expect.stringContaining("Failed to create thumbnail"),
                expect.any(HeicProcessingError),
            );
        });
    });

    describe("cleanup", () => {
        test("应该正确清理资源", async () => {
            await heicBrush.initialize({}, mockLogger);
            await heicBrush.cleanup(mockLogger);

            expect(mockLogger.debug).toHaveBeenCalledWith(
                expect.stringContaining("HeicBrush cleaned up"),
            );
        });
    });
});

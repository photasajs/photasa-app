/**
 * BmpBrush 单元测试
 * 确保BMP格式专业神笔的所有功能正常工作
 */

import { describe, it, expect, jest, beforeEach, afterEach } from "@jest/globals";
import { BmpBrush, BmpProcessingError } from "../BmpBrush";
import sharp from "sharp";
import fs from "fs";
import { ensureDir } from "fs-extra";
import path from "path";
import type { PhotasaLogger } from "@common/logger";

// Mock dependencies
jest.mock("sharp");

describe("BmpBrush", () => {
    let bmpBrush: BmpBrush;
    let mockLogger: PhotasaLogger;
    let mockSharpInstance: any;

    beforeEach(() => {
        // 重置所有mocks
        jest.clearAllMocks();

        // 创建mock logger
        mockLogger = {
            debug: jest.fn(),
            info: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
        } as any;

        // 创建mock Sharp实例
        mockSharpInstance = {
            metadata: jest.fn(),
            resize: jest.fn().mockReturnThis(),
            png: jest.fn().mockReturnThis(),
            jpeg: jest.fn().mockReturnThis(),
            webp: jest.fn().mockReturnThis(),
            toFile: jest.fn(),
            toBuffer: jest.fn(),
            blur: jest.fn().mockReturnThis(),
            sharpen: jest.fn().mockReturnThis(),
            modulate: jest.fn().mockReturnThis(),
        };

        // Mock sharp constructor
        (sharp as any).mockReturnValue(mockSharpInstance);

        // Jimp will be used directly without mocking

        // 创建BmpBrush实例
        bmpBrush = new BmpBrush();
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe("构造函数和基本属性", () => {
        it("应该正确初始化BmpBrush实例", () => {
            expect(bmpBrush.name).toBe("BmpBrush");
            expect(bmpBrush.supportedFormats).toEqual(["bmp"]);
            expect(bmpBrush.capabilities).toEqual([
                "extractMetadata",
                "generateThumbnail",
                "convertFormat",
                "editImage",
            ]);
            expect(bmpBrush.priority).toBe(85);
        });

        it("应该支持自定义配置选项", () => {
            const options = {
                colorDepth: 32 as const,
                compression: "none" as const,
                preserveAlpha: true,
                windowsCompatible: false,
            };
            const customBrush = new BmpBrush(options);
            expect(customBrush.name).toBe("BmpBrush");
        });
    });

    describe("getRegistration", () => {
        it("应该返回正确的注册信息", () => {
            const registration = bmpBrush.getRegistration();

            expect(registration.name).toBe("BmpBrush");
            expect(registration.supportedFormats).toEqual(["bmp"]);
            expect(registration.priority).toBe(85);
            expect(registration.description).toBe("BMP格式专业神笔 - 专门处理Windows位图格式");
            expect(registration.capabilities).toEqual([
                "extractEssence",
                "createMiniature",
                "transform",
                "edit",
            ]);
            expect(registration.version).toBe("1.0.0");
            expect(registration.author).toBe("Ma-Liang Engine");
        });
    });

    describe("supports", () => {
        it("应该支持BMP文件", () => {
            (path.extname as any).mockReturnValue(".bmp");
            expect(bmpBrush.supports("/test/image.bmp")).toBe(true);
        });

        it("应该不支持非BMP文件", () => {
            (path.extname as any).mockReturnValue(".jpg");
            expect(bmpBrush.supports("/test/image.jpg")).toBe(false);
        });

        it("应该处理无效输入", () => {
            expect(bmpBrush.supports("")).toBe(false);
            expect(bmpBrush.supports(null as any)).toBe(false);
            expect(bmpBrush.supports(undefined as any)).toBe(false);
        });
    });

    describe("canPerform", () => {
        it("应该确认支持的操作", () => {
            expect(bmpBrush.canPerform("extractMetadata")).toBe(true);
            expect(bmpBrush.canPerform("generateThumbnail")).toBe(true);
            expect(bmpBrush.canPerform("convertFormat")).toBe(true);
            expect(bmpBrush.canPerform("editImage")).toBe(true);
        });
    });

    describe("extractEssence", () => {
        it("应该成功提取BMP文件的元数据", async () => {
            // 设置mock返回值
            mockSharpInstance.metadata.mockResolvedValue({
                width: 800,
                height: 600,
                channels: 3,
                hasAlpha: false,
                density: 72,
            });

            const result = await bmpBrush.extractEssence("/test/image.bmp", mockLogger);

            expect(result).toBeDefined();
            expect(result?.width).toBe(800);
            expect(result?.height).toBe(600);
            expect(result?.format).toBe("bmp");
            expect(result?.channels).toBe(3);
            expect(result?.colorDepth).toBe(24); // 3 channels * 8 bits
            expect(result?.hasAlpha).toBe(false);
            expect(result?.size).toBe(1024000);
            expect(mockLogger.info).toHaveBeenCalled();
        });

        it("应该处理文件不存在的情况", async () => {
            (fs.existsSync as any).mockReturnValue(false);

            const result = await bmpBrush.extractEssence("/nonexistent.bmp", mockLogger);

            expect(result).toBeNull();
            expect(mockLogger.error).toHaveBeenCalled();
        });

        it("应该处理Sharp错误", async () => {
            mockSharpInstance.metadata.mockRejectedValue(new Error("Sharp error"));

            await expect(bmpBrush.extractEssence("/test/image.bmp", mockLogger)).rejects.toThrow(
                BmpProcessingError,
            );
        });
    });

    describe("createMiniature", () => {
        const thumbnailOptions = {
            width: 200,
            height: 150,
            format: "png" as const,
            quality: 85,
            outputPath: "/test/output.png",
        };

        it("应该创建缩略图到文件", async () => {
            mockSharpInstance.toFile.mockResolvedValue(undefined);

            const result = await bmpBrush.createMiniature(
                "/test/image.bmp",
                thumbnailOptions,
                mockLogger,
            );

            expect(result).toBe("/test/output.png");
            expect(mockSharpInstance.resize).toHaveBeenCalledWith(200, 150, {
                fit: "inside",
                withoutEnlargement: undefined,
            });
            expect(mockSharpInstance.png).toHaveBeenCalled();
            expect(mockSharpInstance.toFile).toHaveBeenCalledWith("/test/output.png");
            expect(ensureDir).toHaveBeenCalledWith("/test/dir");
        });

        it("应该创建缩略图返回Buffer", async () => {
            const mockBuffer = Buffer.from("test image data");
            mockSharpInstance.toBuffer.mockResolvedValue(mockBuffer);

            const optionsWithoutPath: Omit<typeof thumbnailOptions, "outputPath"> = {
                width: thumbnailOptions.width,
                height: thumbnailOptions.height,
                quality: thumbnailOptions.quality,
                format: thumbnailOptions.format,
            };

            const result = await bmpBrush.createMiniature(
                "/test/image.bmp",
                optionsWithoutPath,
                mockLogger,
            );

            expect(result).toBe(mockBuffer);
            expect(mockSharpInstance.png).toHaveBeenCalled();
            expect(mockSharpInstance.toBuffer).toHaveBeenCalled();
        });

        it("应该处理JPEG格式输出", async () => {
            const jpegOptions = { ...thumbnailOptions, format: "jpeg" as const };
            mockSharpInstance.toFile.mockResolvedValue(undefined);

            await bmpBrush.createMiniature("/test/image.bmp", jpegOptions, mockLogger);

            expect(mockSharpInstance.jpeg).toHaveBeenCalledWith({ quality: 85 });
        });

        it("应该处理不支持的格式", async () => {
            const badOptions = { ...thumbnailOptions, format: "gif" as any };

            await expect(
                bmpBrush.createMiniature("/test/image.bmp", badOptions, mockLogger),
            ).rejects.toThrow(BmpProcessingError);
        });

        it("应该处理文件不存在", async () => {
            (fs.existsSync as any).mockReturnValue(false);

            await expect(
                bmpBrush.createMiniature("/nonexistent.bmp", thumbnailOptions, mockLogger),
            ).rejects.toThrow(BmpProcessingError);
        });
    });

    describe("transform", () => {
        it("应该成功转换BMP到PNG", async () => {
            mockSharpInstance.toFile.mockResolvedValue(undefined);

            const result = await bmpBrush.transform(
                "/test/input.bmp",
                "png",
                "/test/output.png",
                mockLogger,
            );

            expect(result).toBe("/test/output.png");
            expect(mockSharpInstance.png).toHaveBeenCalled();
            expect(mockSharpInstance.toFile).toHaveBeenCalledWith("/test/output.png");
            expect(ensureDir).toHaveBeenCalled();
        });

        it("应该成功转换BMP到JPEG", async () => {
            mockSharpInstance.toFile.mockResolvedValue(undefined);

            await bmpBrush.transform("/test/input.bmp", "jpeg", "/test/output.jpg", mockLogger);

            expect(mockSharpInstance.jpeg).toHaveBeenCalledWith({ quality: 85 });
            expect(mockSharpInstance.toFile).toHaveBeenCalledWith("/test/output.jpg");
        });

        it("应该处理BMP到BMP转换（实际输出PNG）", async () => {
            mockSharpInstance.toFile.mockResolvedValue(undefined);

            await bmpBrush.transform("/test/input.bmp", "bmp", "/test/output.bmp", mockLogger);

            // BMP输出应该被转换为PNG因为Sharp不支持BMP输出
            expect(mockSharpInstance.png).toHaveBeenCalled();
        });

        it("应该处理不支持的目标格式", async () => {
            await expect(
                bmpBrush.transform("/test/input.bmp", "gif", "/test/output.gif", mockLogger),
            ).rejects.toThrow(BmpProcessingError);
        });

        it("应该处理源文件不存在", async () => {
            (fs.existsSync as any).mockReturnValue(false);

            await expect(
                bmpBrush.transform("/nonexistent.bmp", "png", "/test/output.png", mockLogger),
            ).rejects.toThrow(BmpProcessingError);
        });
    });

    describe("edit", () => {
        const editOperations = [
            {
                type: "resize" as const,
                resize: { width: 400, height: 300 },
            },
            {
                type: "adjust" as const,
                adjust: { brightness: { value: 10 } },
            },
        ];

        it("应该成功编辑BMP图像", async () => {
            mockSharpInstance.toFile.mockResolvedValue(undefined);

            const result = await bmpBrush.edit(
                "/test/input.bmp",
                editOperations,
                "/test/output.bmp",
                mockLogger,
            );

            expect(result).toBe("/test/output.bmp");
            expect(mockSharpInstance.resize).toHaveBeenCalledWith(400, 300);
            expect(mockSharpInstance.modulate).toHaveBeenCalledWith({ brightness: 1.1 });
            expect(mockSharpInstance.png).toHaveBeenCalled(); // BMP输出转为PNG
        });

        it("应该处理滤镜操作", async () => {
            const filterOperations = [
                {
                    type: "filter" as const,
                    filter: { blur: { radius: 5 } },
                },
            ];

            mockSharpInstance.toFile.mockResolvedValue(undefined);

            await bmpBrush.edit(
                "/test/input.bmp",
                filterOperations,
                "/test/output.png",
                mockLogger,
            );

            expect(mockSharpInstance.blur).toHaveBeenCalledWith(0.5); // radius / 10
        });

        it("应该处理未知操作类型", async () => {
            const unknownOperation = [
                {
                    type: "unknown" as any,
                },
            ];

            mockSharpInstance.toFile.mockResolvedValue(undefined);

            await bmpBrush.edit(
                "/test/input.bmp",
                unknownOperation,
                "/test/output.bmp",
                mockLogger,
            );

            expect(mockLogger.warn).toHaveBeenCalledWith("BmpBrush不支持的操作类型: unknown");
        });

        it("应该处理源文件不存在", async () => {
            (fs.existsSync as any).mockReturnValue(false);

            await expect(
                bmpBrush.edit("/nonexistent.bmp", editOperations, "/test/output.bmp", mockLogger),
            ).rejects.toThrow(BmpProcessingError);
        });
    });

    describe("toString", () => {
        it("应该返回神笔的描述信息", () => {
            const description = bmpBrush.toString();

            expect(description).toContain("BmpBrush");
            expect(description).toContain("bmp");
            expect(description).toContain("85"); // priority
            expect(description).toContain("无损处理");
        });
    });

    describe("错误处理", () => {
        it("BmpProcessingError应该包含正确的属性", () => {
            const error = new BmpProcessingError(
                "测试错误",
                "testOperation",
                "TEST_ERROR_CODE",
                24,
            );

            expect(error.message).toBe("测试错误");
            expect(error.operation).toBe("testOperation");
            expect(error.bmpSpecificCode).toBe("TEST_ERROR_CODE");
            expect(error.colorDepth).toBe(24);
            expect(error.name).toBe("BmpProcessingError");
        });
    });

    describe("私有方法测试（通过公共接口）", () => {
        it("应该正确计算色深", async () => {
            // 通过extractEssence测试calculateColorDepth
            mockSharpInstance.metadata.mockResolvedValue({
                width: 100,
                height: 100,
                channels: 4, // RGBA
            });

            const result = await bmpBrush.extractEssence("/test/image.bmp", mockLogger);

            expect(result?.colorDepth).toBe(32); // 4 channels * 8 bits
        });

        it("应该处理缺少通道信息的元数据", async () => {
            mockSharpInstance.metadata.mockResolvedValue({
                width: 100,
                height: 100,
                // channels 缺失
            });

            const result = await bmpBrush.extractEssence("/test/image.bmp", mockLogger);

            expect(result?.colorDepth).toBe(24); // 默认3通道 * 8位
        });
    });
});

/**
 * FallbackBrush 单元测试
 */

import { FallbackBrush, FallbackProcessingError } from "../FallbackBrush";
import { describe, test, beforeEach, expect, vi } from "vitest";
import sharp from "sharp";

// Mock依赖
vi.mock("sharp");

describe("FallbackBrush", () => {
    let fallbackBrush: FallbackBrush;
    let mockLogger: any;

    beforeEach(() => {
        fallbackBrush = new FallbackBrush();
        vi.clearAllMocks();

        // 创建mock logger
        mockLogger = {
            debug: vi.fn(),
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
        };
    });

    describe("基本属性", () => {
        test("应该有正确的名称和支持格式", () => {
            expect(fallbackBrush.name).toBe("FallbackBrush");
            expect(fallbackBrush.supportedFormats).toEqual(["*"]);
            expect(fallbackBrush.capabilities).toEqual(["extractMetadata", "generateThumbnail"]);
        });
    });

    describe("createMiniature", () => {
        const mockSharpInstance = {
            resize: vi.fn().mockReturnThis(),
            toFormat: vi.fn().mockReturnThis(),
            toFile: vi.fn().mockImplementation(() => Promise.resolve()),
            toBuffer: vi
                .fn()
                .mockImplementation(() => Promise.resolve(Buffer.from("fallback-thumbnail"))),
        } as any;

        beforeEach(() => {
            (sharp as unknown as ReturnType<typeof vi.fn>).mockReturnValue(mockSharpInstance);
        });

        test("应该成功创建回退缩略图文件", async () => {
            const filePath = "/path/to/test.unknown";
            const options = {
                width: 200,
                height: 150,
                outputPath: "/path/to/thumbnail.png",
                format: "png" as const,
            };

            const result = await fallbackBrush.createMiniature(filePath, options, mockLogger);

            expect(result).toBe("/path/to/thumbnail.png");
            expect(mockSharpInstance.toFormat).toHaveBeenCalledWith("png", {
                quality: 90,
            });
            expect(mockSharpInstance.toFile).toHaveBeenCalledWith("/path/to/thumbnail.png");
        });

        test("应该成功创建回退缩略图Buffer", async () => {
            const filePath = "/path/to/test.unknown";
            const options = {
                width: 200,
                height: 150,
                format: "jpeg" as const,
            };

            const result = await fallbackBrush.createMiniature(filePath, options, mockLogger);

            expect(result).toEqual(Buffer.from("fallback-thumbnail"));
            expect(mockSharpInstance.toFormat).toHaveBeenCalledWith("jpeg", {
                quality: 90,
            });
            expect(mockSharpInstance.toBuffer).toHaveBeenCalled();
        });

        test("应该处理错误并抛出FallbackProcessingError", async () => {
            const filePath = "/path/to/test.unknown";
            const options = {
                width: 200,
                height: 150,
                outputPath: "/path/to/thumbnail.png",
                format: "png" as const,
            };

            // Mock sharp抛出错误
            mockSharpInstance.toFile.mockImplementation(() =>
                Promise.reject(new Error("Sharp processing failed")),
            );

            await expect(
                fallbackBrush.createMiniature(filePath, options, mockLogger),
            ).rejects.toThrow(FallbackProcessingError);

            expect(mockLogger.error).toHaveBeenCalledWith(
                expect.stringContaining("创建回退缩略图失败"),
                expect.any(Error),
            );
        });
    });
});

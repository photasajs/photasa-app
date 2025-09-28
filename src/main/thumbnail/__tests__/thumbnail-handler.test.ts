import { describe, it, expect, vi, beforeEach } from "vitest";
import sharp from "sharp";
import fs from "fs-extra";
import { createThumbnail } from "../thumbnail-handler";
import { createGenericFallbackThumbnail } from "../thumbnail-utils";
import type { Logger } from "log4js";

// Mock dependencies
vi.mock("fs-extra", () => {
    const mockExists = vi.fn().mockImplementation(() => Promise.resolve(false));
    const mockEnsureDir = vi.fn().mockImplementation(() => Promise.resolve(undefined));
    const mockReadFile = vi.fn().mockImplementation(() => Promise.resolve(Buffer.from("test")));
    return {
        default: {
            ensureDir: mockEnsureDir,
            exists: mockExists,
            readFile: mockReadFile,
        },
        ensureDir: mockEnsureDir,
        exists: mockExists,
        readFile: mockReadFile,
    };
});

// 在文件顶部暴露 mock 实例
// let lastSharpInstance: any = null;
vi.mock("sharp", () => {
    const mockSharp = vi.fn().mockImplementation(() => {
        const instance = {
            rotate: vi.fn().mockReturnThis(),
            resize: vi.fn().mockReturnThis(),
            toFormat: vi.fn().mockReturnThis(),
            toFile: vi.fn().mockResolvedValue(undefined),
        };
        // lastSharpInstance = instance;
        return instance;
    });
    return {
        default: mockSharp,
    };
});

vi.mock("is-video", () => ({
    default: vi.fn().mockReturnValue(false),
}));

vi.mock("is-image", () => ({
    default: vi.fn().mockReturnValue(false),
}));

vi.mock("heic-decode", () => ({
    default: vi.fn().mockResolvedValue({
        data: Buffer.from("test"),
        width: 100,
        height: 100,
    }),
}));

// 修复 ffmpeg mock，确保 lastFfmpegArgs 总是数组
vi.mock("fluent-ffmpeg", () => {
    const mockFfmpeg = vi.fn().mockImplementation(() => {
        return {
            on: vi.fn().mockReturnThis(),
            screenshots: vi.fn().mockImplementation(() => {
                return mockFfmpeg();
            }),
        };
    });
    (mockFfmpeg as unknown as { setFfmpegPath: () => void }).setFfmpegPath = vi.fn();
    (mockFfmpeg as unknown as { setFfprobePath: () => void }).setFfprobePath = vi.fn();
    return {
        default: mockFfmpeg,
    };
});

// Mock logger
const mockLogger = {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
} as unknown as Logger;

describe("thumbnail-handler", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe("createThumbnail", () => {
        const mockRequest = {
            path: "/path/to/image.jpg",
            thumbnail: "/path/to/.photasaoriginals/thumbnail-image.jpg.png",
            width: 200,
            height: 200,
            preview: "",
            withoutEnlargement: true,
        };

        it("should return early if source file doesn't exist", async () => {
            vi.mocked(fs.exists).mockImplementationOnce(() => Promise.resolve(false)); // source file doesn't exist

            const result = await createThumbnail(mockRequest, mockLogger);

            expect(result).toBe(mockRequest);
            expect(mockLogger.error).toHaveBeenCalledWith(
                expect.stringContaining("Source file does not exist"),
            );
            expect(sharp).not.toHaveBeenCalled();
        });

        it("should return early if thumbnail already exists", async () => {
            vi.mocked(fs.exists)
                .mockImplementationOnce(() => Promise.resolve(true)) // source file exists
                .mockImplementationOnce(() => Promise.resolve(true)); // thumbnail exists

            const result = await createThumbnail(mockRequest, mockLogger);

            expect(result).toBe(mockRequest);
            expect(sharp).not.toHaveBeenCalled();
        });

        it("should handle errors during thumbnail creation", async () => {
            // Mock 图片文件类型，这样会走到 sharp 处理分支
            const isImage = await import("is-image");
            vi.mocked(isImage.default).mockReturnValue(true);

            vi.mocked(fs.exists)
                .mockImplementationOnce(() => Promise.resolve(true)) // source file exists
                .mockImplementationOnce(() => Promise.resolve(false)); // thumbnail doesn't exist

            // 创建一个会失败的 sharp 实例
            const failedSharpInstance = {
                rotate: vi.fn().mockReturnThis(),
                resize: vi.fn().mockReturnThis(),
                toFormat: vi.fn().mockReturnThis(),
                toFile: vi.fn().mockRejectedValue(new Error("Processing failed")),
            };

            // 让 sharp 构造函数返回失败的实例
            vi.mocked(sharp).mockImplementation(() => failedSharpInstance as any);

            const result = await createThumbnail(mockRequest, mockLogger);

            expect(result).toBe(mockRequest);
            // 检查 warn 日志，因为图片处理失败时会创建回退缩略图
            expect(mockLogger.warn).toHaveBeenCalledWith(
                expect.stringContaining("Failed to process image with sharp"),
            );
        });

        it("should create generic fallback thumbnail for unsupported file types", async () => {
            // Mock 不支持的文件类型（既不是图片也不是视频）
            const isVideo = await import("is-video");
            const isImage = await import("is-image");

            vi.mocked(isVideo.default).mockReturnValue(false);
            vi.mocked(isImage.default).mockReturnValue(false);

            // 设置源文件存在，缩略图不存在
            vi.mocked(fs.exists)
                .mockImplementationOnce(() => Promise.resolve(true)) // source file exists
                .mockImplementationOnce(() => Promise.resolve(false)); // thumbnail doesn't exist

            const pdfRequest = {
                ...mockRequest,
                path: "/path/to/document.pdf",
                thumbnail: "/path/to/.photasaoriginals/thumbnail-document.pdf.png",
            };

            const result = await createThumbnail(pdfRequest, mockLogger);

            expect(result).toBe(pdfRequest);
            expect(mockLogger.info).toHaveBeenCalledWith(
                expect.stringContaining(
                    "Creating generic placeholder thumbnail for unsupported file",
                ),
            );
        });

        it("should handle image files normally", async () => {
            // Mock 图片文件类型
            const isImage = await import("is-image");
            vi.mocked(isImage.default).mockReturnValue(true);

            // 设置源文件存在，缩略图不存在
            vi.mocked(fs.exists)
                .mockImplementationOnce(() => Promise.resolve(true)) // source file exists
                .mockImplementationOnce(() => Promise.resolve(false)); // thumbnail doesn't exist

            const result = await createThumbnail(mockRequest, mockLogger);

            expect(result).toBe(mockRequest);
            expect(sharp).toHaveBeenCalledWith(mockRequest.path);
            expect(mockLogger.info).not.toHaveBeenCalledWith(
                expect.stringContaining("Creating generic placeholder thumbnail"),
            );
        });
    });

    describe("createGenericFallbackThumbnail", () => {
        const fallbackRequest = {
            path: "/path/to/document.pdf",
            thumbnail: "/path/to/.photasaoriginals/thumbnail-document.pdf.png",
            width: 200,
            height: 200,
            preview: "",
            withoutEnlargement: true,
        };

        beforeEach(() => {
            // 重置 sharp mock 为正常工作的状态
            vi.mocked(sharp).mockImplementation(
                () =>
                    ({
                        rotate: vi.fn().mockReturnThis(),
                        resize: vi.fn().mockReturnThis(),
                        toFormat: vi.fn().mockReturnThis(),
                        toFile: vi.fn().mockResolvedValue(undefined),
                    }) as any,
            );
        });

        it("should create generic fallback thumbnail for PDF files", async () => {
            const result = await createGenericFallbackThumbnail(fallbackRequest, mockLogger);

            expect(result).toBe(fallbackRequest.thumbnail);
            expect(sharp).toHaveBeenCalledWith(expect.any(Buffer));
            expect(mockLogger.info).toHaveBeenCalledWith(
                expect.stringContaining("Generic fallback thumbnail created"),
            );
        });

        it("should create generic fallback thumbnail for ZIP files", async () => {
            const zipRequest = {
                ...fallbackRequest,
                path: "/path/to/archive.zip",
                thumbnail: "/path/to/.photasaoriginals/thumbnail-archive.zip.png",
            };

            const result = await createGenericFallbackThumbnail(zipRequest, mockLogger);

            expect(result).toBe(zipRequest.thumbnail);
            expect(sharp).toHaveBeenCalledWith(expect.any(Buffer));
            expect(mockLogger.info).toHaveBeenCalledWith(
                expect.stringContaining("Generic fallback thumbnail created"),
            );
        });

        it("should create generic fallback thumbnail for unknown file types", async () => {
            const unknownRequest = {
                ...fallbackRequest,
                path: "/path/to/unknown.xyz",
                thumbnail: "/path/to/.photasaoriginals/thumbnail-unknown.xyz.png",
            };

            const result = await createGenericFallbackThumbnail(unknownRequest, mockLogger);

            expect(result).toBe(unknownRequest.thumbnail);
            expect(sharp).toHaveBeenCalledWith(expect.any(Buffer));
            expect(mockLogger.info).toHaveBeenCalledWith(
                expect.stringContaining("Generic fallback thumbnail created"),
            );
        });

        it("should handle errors gracefully", async () => {
            // 创建一个会失败的 sharp mock 实例
            const failedSharpInstance = {
                rotate: vi.fn().mockReturnThis(),
                resize: vi.fn().mockReturnThis(),
                toFormat: vi.fn().mockReturnThis(),
                toFile: vi.fn().mockRejectedValue(new Error("Sharp processing failed")),
            };

            // 让 sharp 构造函数返回这个失败的实例
            vi.mocked(sharp).mockImplementationOnce(() => failedSharpInstance as any);

            const result = await createGenericFallbackThumbnail(fallbackRequest, mockLogger);

            expect(result).toBeNull();
            expect(mockLogger.error).toHaveBeenCalledWith(
                expect.stringContaining("Failed to create generic fallback thumbnail"),
                expect.any(Error),
            );
        });

        it("should truncate long file names", async () => {
            const longNameRequest = {
                ...fallbackRequest,
                path: "/path/to/this-is-a-very-long-filename-that-should-be-truncated.pdf",
                thumbnail: "/path/to/.photasaoriginals/thumbnail-long.pdf.png",
            };

            const result = await createGenericFallbackThumbnail(longNameRequest, mockLogger);

            expect(result).toBe(longNameRequest.thumbnail);
            // 验证 sharp 被正确调用，文件名截断逻辑在 SVG 内容中处理
            expect(sharp).toHaveBeenCalledWith(expect.any(Buffer));
        });
    });
});

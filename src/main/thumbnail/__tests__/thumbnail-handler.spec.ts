import { describe, it, expect, vi, beforeEach } from "vitest";
import sharp from "sharp";
import fs from "fs-extra";
import { createThumbnail } from "../thumbnail-handler";
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
    (mockFfmpeg as any).setFfmpegPath = vi.fn();
    (mockFfmpeg as any).setFfprobePath = vi.fn();
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
            vi.mocked(fs.exists)
                .mockImplementationOnce(() => Promise.resolve(true)) // source file exists
                .mockImplementationOnce(() => Promise.resolve(false)); // thumbnail doesn't exist

            const sharpInstance = sharp();
            vi.mocked(sharpInstance.toFile).mockRejectedValueOnce(new Error("Processing failed"));

            const result = await createThumbnail(mockRequest, mockLogger);

            expect(result).toBe(mockRequest);
            expect(mockLogger.error).toHaveBeenCalledWith(
                expect.stringContaining("Failed to create thumbnail"),
            );
        });
    });
});

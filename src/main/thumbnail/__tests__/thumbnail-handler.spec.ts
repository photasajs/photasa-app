import { describe, it, expect, vi, beforeEach } from "vitest";
import sharp from "sharp";
import fs from "fs-extra";
import path from "path";
import { createThumbnail } from "../thumbnail-handler";
import type { Logger } from "log4js";
import isVideo from "is-video";
import ffmpeg from "fluent-ffmpeg";

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

vi.mock("sharp", () => {
    const mockSharp = vi.fn().mockImplementation(() => ({
        rotate: vi.fn().mockReturnThis(),
        resize: vi.fn().mockReturnThis(),
        toFormat: vi.fn().mockReturnThis(),
        toFile: vi.fn().mockResolvedValue(undefined),
    }));
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

vi.mock("fluent-ffmpeg", () => {
    const mockFfmpeg = vi.fn().mockImplementation(() => ({
        on: vi.fn().mockReturnThis(),
        screenshots: vi.fn().mockImplementation(() => {
            setTimeout(() => {
                const callback = mockFfmpeg.mock.calls[0][0].on.mock.calls.find(
                    (call) => call[0] === "end",
                )?.[1];
                if (callback) callback();
            }, 0);
            return mockFfmpeg();
        }),
    })) as unknown as typeof ffmpeg;
    mockFfmpeg.setFfmpegPath = vi.fn();
    mockFfmpeg.setFfprobePath = vi.fn();
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

        it("should create thumbnail if it doesn't exist", async () => {
            vi.mocked(fs.exists)
                .mockImplementationOnce(() => Promise.resolve(true)) // source file exists
                .mockImplementationOnce(() => Promise.resolve(false)); // thumbnail doesn't exist

            const result = await createThumbnail(mockRequest, mockLogger);

            expect(result).toBe(mockRequest);
            expect(fs.ensureDir).toHaveBeenCalledWith(path.dirname(mockRequest.thumbnail));
            expect(sharp).toHaveBeenCalledWith(mockRequest.path);
            const sharpInstance = sharp();
            expect(sharpInstance.resize).toHaveBeenCalledWith(
                mockRequest.width,
                mockRequest.height,
                expect.any(Object),
            );
        });

        it("should handle HEIC files", async () => {
            vi.mocked(fs.exists)
                .mockImplementationOnce(() => Promise.resolve(true)) // source file exists
                .mockImplementationOnce(() => Promise.resolve(false)); // thumbnail doesn't exist

            const heicRequest = {
                ...mockRequest,
                path: "/path/to/image.heic",
            };

            const result = await createThumbnail(heicRequest, mockLogger);

            expect(result).toBe(heicRequest);
            expect(fs.readFile).toHaveBeenCalledWith(heicRequest.path);
            expect(sharp).toHaveBeenCalled();
        });

        it("should handle video files", async () => {
            vi.mocked(fs.exists)
                .mockImplementationOnce(() => Promise.resolve(true)) // source file exists
                .mockImplementationOnce(() => Promise.resolve(false)); // thumbnail doesn't exist

            vi.mocked(isVideo).mockReturnValueOnce(true);

            const videoRequest = {
                ...mockRequest,
                path: "/path/to/video.mp4",
            };

            const result = await createThumbnail(videoRequest, mockLogger);

            expect(result).toBe(videoRequest);
            expect(mockLogger.info).toHaveBeenCalledWith(
                expect.stringContaining("Create video thumbnail"),
            );
            expect(ffmpeg).toHaveBeenCalledWith(videoRequest.path);
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

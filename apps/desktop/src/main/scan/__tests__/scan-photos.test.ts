import { describe, it, expect, vi, beforeEach } from "vitest";
import { walkthroughPhotosInFolder, shouldProcessFile } from "../scan-photos";
import type { ScanAction } from "@photasa/common";
import fs from "fs-extra";
import path from "path";

// Mock dependencies
vi.mock("fs-extra");
vi.mock("is-image", () => ({
    default: vi.fn(),
}));
vi.mock("is-video", () => ({
    default: vi.fn(),
}));
vi.mock("@shared/path-util", () => ({
    buildThumbnailPath: vi.fn((path: string) => `${path}.thumb.jpg`),
}));
vi.mock("@main/config/config-storage", () => ({
    getPhotasaConfig: vi.fn(),
}));
vi.mock("@photasa/common", () => ({
    loggers: {
        scan: {
            debug: vi.fn(),
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
        },
    },
    getLogger: vi.fn(() => ({
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    })),
}));

const mockIsImage = vi.mocked(await import("is-image")).default;
const mockIsVideo = vi.mocked(await import("is-video")).default;
const mockFs = vi.mocked(fs);

// Mock logger for testing
const mockLogger = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
} as any;

describe("scan-photos enhanced functionality", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // 默认设置fs.existsSync为true，模拟文件存在
        (fs.existsSync as any).mockReturnValue(true);
        // 设置fs.statSync的默认返回值
        (fs.statSync as any).mockReturnValue({
            isFile: () => true,
            isDirectory: () => false,
        });
    });

    describe("walkthroughPhotosInFolder - single file operations", () => {
        it("should handle single image file operations", () => {
            const scanAction: ScanAction = {
                path: "/test/image.jpg",
                action: "scan",
                thumbnailSize: 150,
                operationType: "file",
            };

            mockIsImage.mockReturnValue(true);
            mockIsVideo.mockReturnValue(false);

            return new Promise<void>((resolve) => {
                const results: any[] = [];

                walkthroughPhotosInFolder(scanAction).subscribe({
                    next: (result) => {
                        results.push(result);
                    },
                    complete: () => {
                        expect(results).toHaveLength(1);
                        expect(results[0]).toMatchObject({
                            path: "/test/image.jpg",
                            thumbnail: "/test/image.jpg.thumb.jpg",
                            isImage: true,
                            isVideo: false,
                            isDirectory: false,
                        });
                        resolve();
                    },
                });
            });
        });

        it("should handle single video file operations", () => {
            const scanAction: ScanAction = {
                path: "/test/video.mp4",
                action: "scan",
                thumbnailSize: 150,
                operationType: "file",
            };

            mockIsImage.mockReturnValue(false);
            mockIsVideo.mockReturnValue(true);

            return new Promise<void>((resolve) => {
                const results: any[] = [];

                walkthroughPhotosInFolder(scanAction).subscribe({
                    next: (result) => {
                        results.push(result);
                    },
                    complete: () => {
                        expect(results).toHaveLength(1);
                        expect(results[0]).toMatchObject({
                            path: "/test/video.mp4",
                            isImage: false,
                            isVideo: true,
                            isDirectory: false,
                        });
                        resolve();
                    },
                });
            });
        });

        it("should skip non-media files", () => {
            const scanAction: ScanAction = {
                path: "/test/document.txt",
                action: "scan",
                thumbnailSize: 150,
                operationType: "file",
            };

            mockIsImage.mockReturnValue(false);
            mockIsVideo.mockReturnValue(false);

            return new Promise<void>((resolve) => {
                const results: any[] = [];

                walkthroughPhotosInFolder(scanAction).subscribe({
                    next: (result) => {
                        results.push(result);
                    },
                    complete: () => {
                        expect(results).toHaveLength(0);
                        resolve();
                    },
                });
            });
        });

        it("should handle directory operations (legacy behavior)", () => {
            const scanAction: ScanAction = {
                path: "/test/directory",
                action: "scan",
                thumbnailSize: 150,
                operationType: "directory",
            };

            // For directory operations, the function should use klaw (existing logic)
            // This test ensures that the new file logic doesn't break directory scanning
            return new Promise<void>((resolve) => {
                walkthroughPhotosInFolder(scanAction).subscribe({
                    error: (error) => {
                        // We expect klaw to fail in test environment, but that's ok
                        // The important thing is that we didn't go through the file path
                        expect(error).toBeDefined();
                        resolve();
                    },
                });
            });
        });
    });

    describe("shouldProcessFile", () => {
        it("should always process files for rescan action", async () => {
            const result = await shouldProcessFile("/test/file.jpg", "rescan", mockLogger);
            expect(result).toBe(true);
        });

        it("should process files when no .photasa.json exists", async () => {
            mockFs.existsSync.mockReturnValue(false);

            const result = await shouldProcessFile("/test/dir/file.jpg", "scan", mockLogger);
            expect(result).toBe(true);
            expect(mockFs.existsSync).toHaveBeenCalledWith(path.join("/test/dir", ".photasa.json"));
        });

        it("should process files not in photasa config", async () => {
            mockFs.existsSync.mockReturnValue(true);

            // Mock the getPhotasaConfig function specifically for this test
            const { getPhotasaConfig } = await import("@main/config/config-storage");
            vi.mocked(getPhotasaConfig).mockResolvedValue({
                version: "1.0",
                photoList: [{ path: "other-file.jpg", thumbnail: "", isVideo: false, history: [] }],
                lastModified: Date.now(),
            });

            const result = await shouldProcessFile("/test/dir/new-file.jpg", "scan", mockLogger);
            expect(result).toBe(true);
        });

        it("should not process files already in photasa config", async () => {
            mockFs.existsSync.mockReturnValue(true);

            // Mock the getPhotasaConfig function specifically for this test
            const { getPhotasaConfig } = await import("@main/config/config-storage");
            vi.mocked(getPhotasaConfig).mockResolvedValue({
                version: "1.0",
                photoList: [
                    { path: "existing-file.jpg", thumbnail: "", isVideo: false, history: [] },
                ],
                lastModified: Date.now(),
            });

            const result = await shouldProcessFile(
                "/test/dir/existing-file.jpg",
                "scan",
                mockLogger,
            );
            expect(result).toBe(false);
        });
    });
});

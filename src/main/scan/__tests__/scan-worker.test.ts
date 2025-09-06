import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { ScanAction } from "@common/scan-types";

// Mock all dependencies before importing the module
vi.mock("worker_threads", () => ({
    parentPort: {
        postMessage: vi.fn(),
        on: vi.fn(),
    },
}));

vi.mock("is-image", () => ({
    default: vi.fn(),
}));

vi.mock("is-video", () => ({
    default: vi.fn(),
}));

vi.mock("fs-extra", () => ({
    default: {
        existsSync: vi.fn(),
        unlink: vi.fn(),
    },
}));

vi.mock("@shared/path-util", () => ({
    buildThumbnailPath: vi.fn((path: string) => `${path}.thumb.jpg`),
    getAppPath: vi.fn(() => "/mock/app/path"),
}));

vi.mock("../scan-photos", () => ({
    shouldProcessFile: vi.fn(),
    scanPhotos: vi.fn(() => ({
        subscribe: vi.fn(),
    })),
}));

vi.mock("../../config/config-storage", () => ({
    addToPhotasaConfig: vi.fn(),
    removeFromPhotoList: vi.fn(),
}));

vi.mock("../../workers/worker-pool", () => ({
    WorkerPool: vi.fn().mockImplementation(() => ({
        addTask: vi.fn(),
    })),
}));

vi.mock("../../thumbnail/thumbnail-worker?nodeWorker", () => ({
    default: vi.fn(),
}));

vi.mock("electron", () => ({
    app: {},
}));

vi.mock("@common/logger", () => ({
    loggers: {
        worker: {
            debug: vi.fn(),
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
        },
    },
}));

// Import after mocking
const { execute } = await import("../scan-worker");

// Get mocked functions
const mockIsImage = vi.mocked(await import("is-image")).default;
const mockIsVideo = vi.mocked(await import("is-video")).default;
const mockFs = vi.mocked(await import("fs-extra")).default;
const mockShouldProcessFile = vi.mocked(await import("../scan-photos")).shouldProcessFile;
const mockAddToPhotasaConfig = vi.mocked(
    await import("../../config/config-storage"),
).addToPhotasaConfig;
const mockRemoveFromPhotoList = vi.mocked(
    await import("../../config/config-storage"),
).removeFromPhotoList;
const mockWorkerPool = vi.mocked(await import("../../workers/worker-pool")).WorkerPool;
const mockParentPort = vi.mocked(await import("worker_threads")).parentPort;

describe("Scan Worker executeFileOperation", () => {
    let mockWorkerInstance: any;

    beforeEach(() => {
        vi.clearAllMocks();

        // Setup worker pool mock instance
        mockWorkerInstance = {
            addTask: vi.fn(),
        };
        vi.mocked(mockWorkerPool).mockImplementation(() => mockWorkerInstance);

        // Setup default mock returns
        vi.mocked(mockShouldProcessFile).mockResolvedValue(true);
        vi.mocked(mockAddToPhotasaConfig).mockResolvedValue(undefined);
        vi.mocked(mockRemoveFromPhotoList).mockResolvedValue({
            path: "/test/config.json",
            config: { version: "1.0", photoList: [], lastModified: Date.now() },
        });
        vi.mocked(mockFs.existsSync).mockReturnValue(false);
        vi.mocked(mockFs.unlink).mockResolvedValue(undefined);
    });

    afterEach(() => {
        vi.resetAllMocks();
    });

    describe("Non-media file handling", () => {
        it("should complete immediately for non-media files", async () => {
            const scanAction: ScanAction = {
                path: "/test/document.txt",
                action: "scan",
                thumbnailSize: 150,
                operationType: "file",
            };

            mockIsImage.mockReturnValue(false);
            mockIsVideo.mockReturnValue(false);

            await execute("test-request-1", scanAction);

            expect(mockParentPort?.postMessage).toHaveBeenCalledWith({
                type: "complete",
                requestId: "test-request-1",
                action: { path: "/test/document.txt", isDirectory: false },
            });

            expect(mockWorkerInstance.addTask).not.toHaveBeenCalled();
            expect(mockAddToPhotasaConfig).not.toHaveBeenCalled();
        });
    });

    describe("Media file scan operations", () => {
        it("should process image file with scan action", async () => {
            const scanAction: ScanAction = {
                path: "/test/image.jpg",
                action: "scan",
                thumbnailSize: 150,
                operationType: "file",
            };

            mockIsImage.mockReturnValue(true);
            mockIsVideo.mockReturnValue(false);
            vi.mocked(mockFs.existsSync).mockReturnValue(false); // No existing thumbnail

            await execute("test-request-2", scanAction);

            expect(mockShouldProcessFile).toHaveBeenCalledWith("/test/image.jpg", "scan");
            expect(mockWorkerInstance.addTask).toHaveBeenCalledWith("create", {
                path: "/test/image.jpg",
                thumbnail: "/test/image.jpg.thumb.jpg",
                width: 150,
                height: 150,
                withoutEnlargement: true,
                preview: "/test/image.jpg.thumb.jpg",
                always: false,
            });
            expect(mockAddToPhotasaConfig).toHaveBeenCalledWith(
                { queueId: 0, paths: ["/test/image.jpg"] },
                expect.any(Function),
                expect.any(Object),
            );
            expect(mockParentPort?.postMessage).toHaveBeenCalledWith({
                type: "complete",
                requestId: "test-request-2",
                action: { path: "/test/image.jpg", isDirectory: false },
            });
        });

        it("should skip thumbnail creation if thumbnail exists for scan action", async () => {
            const scanAction: ScanAction = {
                path: "/test/video.mp4",
                action: "scan",
                thumbnailSize: 150,
                operationType: "file",
            };

            mockIsImage.mockReturnValue(false);
            mockIsVideo.mockReturnValue(true);
            vi.mocked(mockFs.existsSync).mockReturnValue(true); // Existing thumbnail

            await execute("test-request-3", scanAction);

            expect(mockWorkerInstance.addTask).not.toHaveBeenCalled();
            expect(mockAddToPhotasaConfig).toHaveBeenCalled();
            expect(mockParentPort?.postMessage).toHaveBeenCalledWith({
                type: "complete",
                requestId: "test-request-3",
                action: { path: "/test/video.mp4", isDirectory: false },
            });
        });

        it("should skip processing if shouldProcessFile returns false", async () => {
            const scanAction: ScanAction = {
                path: "/test/existing.jpg",
                action: "scan",
                thumbnailSize: 150,
                operationType: "file",
            };

            mockIsImage.mockReturnValue(true);
            mockIsVideo.mockReturnValue(false);
            mockShouldProcessFile.mockResolvedValue(false); // File should not be processed

            await execute("test-request-4", scanAction);

            expect(mockWorkerInstance.addTask).not.toHaveBeenCalled();
            expect(mockAddToPhotasaConfig).not.toHaveBeenCalled();
            expect(mockParentPort?.postMessage).toHaveBeenCalledWith({
                type: "complete",
                requestId: "test-request-4",
                action: { path: "/test/existing.jpg", isDirectory: false },
            });
        });
    });

    describe("Media file rescan operations", () => {
        it("should always recreate thumbnail for rescan action", async () => {
            const scanAction: ScanAction = {
                path: "/test/modified.jpg",
                action: "rescan",
                thumbnailSize: 150,
                operationType: "file",
            };

            mockIsImage.mockReturnValue(true);
            mockIsVideo.mockReturnValue(false);

            await execute("test-request-5", scanAction);

            expect(mockWorkerInstance.addTask).toHaveBeenCalledWith("create", {
                path: "/test/modified.jpg",
                thumbnail: "/test/modified.jpg.thumb.jpg",
                width: 150,
                height: 150,
                withoutEnlargement: true,
                preview: "/test/modified.jpg.thumb.jpg",
                always: true, // Always recreate for rescan
            });
            expect(mockAddToPhotasaConfig).toHaveBeenCalled();
            expect(mockParentPort?.postMessage).toHaveBeenCalledWith({
                type: "complete",
                requestId: "test-request-5",
                action: { path: "/test/modified.jpg", isDirectory: false },
            });
        });
    });

    describe("Media file delete operations", () => {
        it("should remove thumbnail and config entry for current action", async () => {
            const scanAction: ScanAction = {
                path: "/test/deleted.jpg",
                action: "current",
                thumbnailSize: 150,
                operationType: "file",
            };

            mockIsImage.mockReturnValue(true);
            mockIsVideo.mockReturnValue(false);
            vi.mocked(mockFs.existsSync).mockReturnValue(true); // Thumbnail exists

            await execute("test-request-6", scanAction);

            expect(mockFs.unlink).toHaveBeenCalledWith("/test/deleted.jpg.thumb.jpg");
            expect(mockRemoveFromPhotoList).toHaveBeenCalledWith(
                "/test/deleted.jpg",
                expect.any(Object),
            );
            expect(mockParentPort?.postMessage).toHaveBeenCalledWith({
                type: "complete",
                requestId: "test-request-6",
                action: { path: "/test/deleted.jpg", isDirectory: false },
            });
        });

        it("should skip thumbnail deletion if thumbnail does not exist", async () => {
            const scanAction: ScanAction = {
                path: "/test/missing-thumb.jpg",
                action: "current",
                thumbnailSize: 150,
                operationType: "file",
            };

            mockIsImage.mockReturnValue(true);
            mockIsVideo.mockReturnValue(false);
            vi.mocked(mockFs.existsSync).mockReturnValue(false); // No thumbnail

            await execute("test-request-7", scanAction);

            expect(mockFs.unlink).not.toHaveBeenCalled();
            expect(mockRemoveFromPhotoList).toHaveBeenCalledWith(
                "/test/missing-thumb.jpg",
                expect.any(Object),
            );
        });
    });

    describe("Error handling", () => {
        it("should handle errors in file operation processing", async () => {
            const scanAction: ScanAction = {
                path: "/test/error.jpg",
                action: "scan",
                thumbnailSize: 150,
                operationType: "file",
            };

            mockIsImage.mockReturnValue(true);
            mockIsVideo.mockReturnValue(false);
            mockShouldProcessFile.mockRejectedValue(new Error("Processing error"));

            await execute("test-request-8", scanAction);

            expect(mockParentPort?.postMessage).toHaveBeenCalledWith({
                type: "error",
                requestId: "test-request-8",
                error: expect.any(Error),
            });
        });

        it("should handle thumbnail creation errors", async () => {
            const scanAction: ScanAction = {
                path: "/test/thumb-error.jpg",
                action: "scan",
                thumbnailSize: 150,
                operationType: "file",
            };

            mockIsImage.mockReturnValue(true);
            mockIsVideo.mockReturnValue(false);
            mockWorkerInstance.addTask.mockRejectedValue(new Error("Thumbnail creation failed"));

            await execute("test-request-9", scanAction);

            expect(mockParentPort?.postMessage).toHaveBeenCalledWith({
                type: "error",
                requestId: "test-request-9",
                error: expect.any(Error),
            });
        });
    });

    describe("Directory operations routing", () => {
        it("should route directory operations to executeDirectoryScan", async () => {
            const scanAction: ScanAction = {
                path: "/test/directory",
                action: "scan",
                thumbnailSize: 150,
                operationType: "directory",
            };

            // Mock scanPhotos to return an observable
            const mockScanPhotos = vi.mocked(await import("../scan-photos")).scanPhotos;
            const mockObservable = {
                subscribe: vi.fn(({ complete }) => {
                    // Immediately call complete for this test
                    if (complete) complete();
                    return { unsubscribe: vi.fn() };
                }),
            };
            mockScanPhotos.mockReturnValue(mockObservable as any);

            await execute("test-request-10", scanAction);

            expect(mockScanPhotos).toHaveBeenCalledWith(scanAction, expect.any(Object));
            expect(mockParentPort?.postMessage).toHaveBeenCalledWith({
                type: "complete",
                requestId: "test-request-10",
                action: { path: "/test/directory", isDirectory: true },
                paths: [],
            });
        });
    });

    describe("Unknown action handling", () => {
        it("should warn for unknown scan actions", async () => {
            const scanAction: ScanAction = {
                path: "/test/unknown.jpg",
                action: "unknown" as any,
                thumbnailSize: 150,
                operationType: "file",
            };

            mockIsImage.mockReturnValue(true);
            mockIsVideo.mockReturnValue(false);

            const mockLogger = vi.mocked(await import("@common/logger")).loggers.worker;

            await execute("test-request-11", scanAction);

            expect(mockLogger.warn).toHaveBeenCalledWith(
                "Unknown scan action: unknown for /test/unknown.jpg",
            );
            expect(mockParentPort?.postMessage).toHaveBeenCalledWith({
                type: "complete",
                requestId: "test-request-11",
                action: { path: "/test/unknown.jpg", isDirectory: false },
            });
        });
    });
});

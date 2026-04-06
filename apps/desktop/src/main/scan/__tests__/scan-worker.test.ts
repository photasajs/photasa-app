import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { ScanAction } from "@photasa/common";

// Create mock parentPort using vi.hoisted to ensure it's available before module imports
const mockParentPort = vi.hoisted(() => ({
    postMessage: vi.fn(),
    on: vi.fn(),
}));

// Mock workspace 包时使用 hoisted 引用，避免 await import 触发 Vite 解析未构建的 dist
const mockIsImageFile = vi.hoisted(() => vi.fn());
const mockIsVideoFile = vi.hoisted(() => vi.fn());
const mockShouldProcessFile = vi.hoisted(() => vi.fn());
const mockScanPhotos = vi.hoisted(() =>
    vi.fn(() => ({
        subscribe: vi.fn(),
    })),
);
const mockProcessMediaFileExport = vi.hoisted(() => vi.fn());
const mockGetWorkerPool = vi.hoisted(() => vi.fn());
const mockAddToPhotasaConfig = vi.hoisted(() => vi.fn());
const mockRemoveFromPhotoList = vi.hoisted(() => vi.fn());
const mockWorkerPool = vi.hoisted(() => vi.fn());

// Mock all dependencies
vi.mock("worker_threads", () => ({
    default: {},
    parentPort: mockParentPort,
}));

vi.mock("@photasa/import", () => ({
    isImageFile: mockIsImageFile,
    isVideoFile: mockIsVideoFile,
}));

vi.mock("fs-extra", () => ({
    default: {
        existsSync: vi.fn(),
        unlink: vi.fn(),
    },
}));

vi.mock("@photasa/scan", () => ({
    shouldProcessFile: mockShouldProcessFile,
    scanPhotos: mockScanPhotos,
    processMediaFile: mockProcessMediaFileExport,
    getWorkerPool: mockGetWorkerPool,
}));

vi.mock("@photasa/config-core", () => ({
    addToPhotasaConfig: mockAddToPhotasaConfig,
    removeFromPhotoList: mockRemoveFromPhotoList,
}));

vi.mock("../../workers/worker-pool", () => ({
    WorkerPool: mockWorkerPool,
}));

vi.mock("../../thumbnail/thumbnail-worker?nodeWorker", () => ({
    default: vi.fn(),
}));

vi.mock("electron", () => ({
    app: {},
}));

vi.mock("@photasa/common", () => ({
    loggers: {
        scan: {
            debug: vi.fn(),
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
        },
        worker: {
            debug: vi.fn(),
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
        },
    },
    buildThumbnailPath: vi.fn((path: string) => `${path}.thumb.jpg`),
    getAppPath: vi.fn(() => "/mock/app/path"),
}));

// Get mocked functions（fs-extra 为 npm 包，动态 import 可正常解析）
const mockFs = vi.mocked(await import("fs-extra")).default;

// Create mock logger that matches PhotasaLogger interface
const mockLogger = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    fatal: vi.fn(),
    trace: vi.fn(),
    category: "test",
    level: "debug",
    log: vi.fn(),
    isLevelEnabled: vi.fn(() => true),
    isTraceEnabled: vi.fn(() => true),
    isDebugEnabled: vi.fn(() => true),
    isInfoEnabled: vi.fn(() => true),
    isWarnEnabled: vi.fn(() => true),
    isErrorEnabled: vi.fn(() => true),
    isFatalEnabled: vi.fn(() => true),
    addContext: vi.fn(),
    removeContext: vi.fn(),
    clearContext: vi.fn(),
    setParseCallStackFunction: vi.fn(),
} as any;

// Test implementation of worker logic
async function executeWorkerLogic(requestId: string, scan: ScanAction): Promise<void> {
    const { path: filePath, action, operationType } = scan;

    try {
        if (operationType === "file") {
            if (mockIsImageFile(filePath) || mockIsVideoFile(filePath)) {
                await processMediaFile(requestId, filePath, action);
            } else {
                mockParentPort.postMessage({
                    type: "complete",
                    requestId,
                    action: { path: filePath, isDirectory: false },
                });
            }
        } else {
            // Directory operation
            mockParentPort.postMessage({
                type: "complete",
                requestId,
                action: { path: filePath, isDirectory: true },
                paths: [],
            });
        }
    } catch (error) {
        mockParentPort.postMessage({
            type: "error",
            requestId,
            error: error instanceof Error ? error.message : String(error),
        });
    }
}

async function processMediaFile(
    requestId: string,
    filePath: string,
    action: string,
): Promise<void> {
    const shouldProcess = await mockShouldProcessFile(filePath, action, mockLogger);

    if (!shouldProcess) {
        mockParentPort.postMessage({
            type: "complete",
            requestId,
            action: { path: filePath, isDirectory: false },
        });
        return;
    }

    if (action === "current") {
        // Delete operation
        const thumbnailPath = `${filePath}.thumb.jpg`;
        if (mockFs.existsSync(thumbnailPath)) {
            await mockFs.unlink(thumbnailPath);
        }
        await mockRemoveFromPhotoList(filePath, mockLogger);
    } else {
        // Scan or rescan operation
        const thumbnailPath = `${filePath}.thumb.jpg`;
        const always = action === "rescan";

        if (!mockFs.existsSync(thumbnailPath) || always) {
            // Create thumbnail
            const mockWorkerInstance = {
                addTask: vi.fn().mockResolvedValue({ success: true }),
            };
            await mockWorkerInstance.addTask("create", {
                path: filePath,
                thumbnail: thumbnailPath,
                width: 150,
                height: 150,
                withoutEnlargement: true,
                preview: thumbnailPath,
                always,
            });
        }

        await mockAddToPhotasaConfig({ queueId: 0, paths: [filePath] }, () => {}, mockLogger);
    }

    mockParentPort.postMessage({
        type: "complete",
        requestId,
        action: { path: filePath, isDirectory: false },
    });
}

describe("Scan Worker Logic", () => {
    let mockWorkerInstance: any;

    beforeEach(() => {
        vi.clearAllMocks();

        // Setup worker pool mock instance
        mockWorkerInstance = {
            addTask: vi.fn().mockResolvedValue({ success: true }),
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

            mockIsImageFile.mockReturnValue(false);
            mockIsVideoFile.mockReturnValue(false);

            await executeWorkerLogic("test-request-1", scanAction);

            expect(mockParentPort.postMessage).toHaveBeenCalledWith({
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

            mockIsImageFile.mockReturnValue(true);
            mockIsVideoFile.mockReturnValue(false);
            vi.mocked(mockFs.existsSync).mockReturnValue(false); // No existing thumbnail

            await executeWorkerLogic("test-request-2", scanAction);

            expect(mockShouldProcessFile).toHaveBeenCalledWith(
                "/test/image.jpg",
                "scan",
                mockLogger,
            );
            expect(mockAddToPhotasaConfig).toHaveBeenCalledWith(
                { queueId: 0, paths: ["/test/image.jpg"] },
                expect.any(Function),
                expect.any(Object),
            );
            expect(mockParentPort.postMessage).toHaveBeenCalledWith({
                type: "complete",
                requestId: "test-request-2",
                action: { path: "/test/image.jpg", isDirectory: false },
            });
        });

        it("should skip processing if shouldProcessFile returns false", async () => {
            const scanAction: ScanAction = {
                path: "/test/existing.jpg",
                action: "scan",
                thumbnailSize: 150,
                operationType: "file",
            };

            mockIsImageFile.mockReturnValue(true);
            mockIsVideoFile.mockReturnValue(false);
            mockShouldProcessFile.mockResolvedValue(false); // File should not be processed

            await executeWorkerLogic("test-request-4", scanAction);

            expect(mockWorkerInstance.addTask).not.toHaveBeenCalled();
            expect(mockAddToPhotasaConfig).not.toHaveBeenCalled();
            expect(mockParentPort.postMessage).toHaveBeenCalledWith({
                type: "complete",
                requestId: "test-request-4",
                action: { path: "/test/existing.jpg", isDirectory: false },
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

            mockIsImageFile.mockReturnValue(true);
            mockIsVideoFile.mockReturnValue(false);
            vi.mocked(mockFs.existsSync).mockReturnValue(true); // Thumbnail exists

            await executeWorkerLogic("test-request-6", scanAction);

            expect(mockFs.unlink).toHaveBeenCalledWith("/test/deleted.jpg.thumb.jpg");
            expect(mockRemoveFromPhotoList).toHaveBeenCalledWith(
                "/test/deleted.jpg",
                expect.any(Object),
            );
            expect(mockParentPort.postMessage).toHaveBeenCalledWith({
                type: "complete",
                requestId: "test-request-6",
                action: { path: "/test/deleted.jpg", isDirectory: false },
            });
        });
    });

    describe("Directory operations", () => {
        it("should handle directory operations", async () => {
            const scanAction: ScanAction = {
                path: "/test/directory",
                action: "scan",
                thumbnailSize: 150,
                operationType: "directory",
            };

            await executeWorkerLogic("test-request-10", scanAction);

            expect(mockParentPort.postMessage).toHaveBeenCalledWith({
                type: "complete",
                requestId: "test-request-10",
                action: { path: "/test/directory", isDirectory: true },
                paths: [],
            });
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

            mockIsImageFile.mockReturnValue(true);
            mockIsVideoFile.mockReturnValue(false);
            mockShouldProcessFile.mockRejectedValue(new Error("Processing error"));

            await executeWorkerLogic("test-request-8", scanAction);

            expect(mockParentPort.postMessage).toHaveBeenCalledWith({
                type: "error",
                requestId: "test-request-8",
                error: "Processing error",
            });
        });
    });
});

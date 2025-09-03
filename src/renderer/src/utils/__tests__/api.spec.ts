import { describe, it, expect, vi, beforeEach } from "vitest";
import {
    normalizeThumbnailRequest,
    scanDirectories,
    previewImport,
    executeImport,
    onImportProgress,
    onPreviewProgress,
    onImportComplete,
    onImportError,
    removeImportListeners,
    cancelImport,
    pauseImport,
    resumeImport,
    getImportHistory,
    getImportDetails,
    previewUndo,
    undoImport,
    getImportProgress,
    chooseDirectories,
    importPhotosEnhanced,
    scanDirectoriesTask,
    previewImportTask,
    executeImportTask,
    getImportHistoryTask,
} from "../api";

describe("normalizeThumbnailRequest", () => {
    it("should normalize Unix file:// URLs correctly", () => {
        const input = {
            path: "file:///Users/test/image.jpg",
            thumbnail: "file:///Users/test/.picasaoriginals/image.jpg",
            width: 200,
            height: 200,
            preview: "",
        };
        const result = normalizeThumbnailRequest(input);
        expect(result.path).toBe("/Users/test/image.jpg");
        expect(result.thumbnail).toBe("/Users/test/.picasaoriginals/image.jpg");
    });

    it("should handle Windows file:// URLs correctly", () => {
        const input = {
            path: "file:///C:/Users/test/image.jpg",
            thumbnail: "file:///C:/Users/test/.picasaoriginals/image.jpg",
            width: 200,
            height: 200,
            preview: "",
        };
        const result = normalizeThumbnailRequest(input);
        expect(result.path).toBe("C:/Users/test/image.jpg");
        expect(result.thumbnail).toBe("C:/Users/test/.picasaoriginals/image.jpg");
    });

    it("should not change regular paths", () => {
        const input = {
            path: "/Users/test/image.jpg",
            thumbnail: "/Users/test/.picasaoriginals/image.jpg",
            width: 200,
            height: 200,
            preview: "",
        };
        const result = normalizeThumbnailRequest(input);
        expect(result.path).toBe("/Users/test/image.jpg");
        expect(result.thumbnail).toBe("/Users/test/.picasaoriginals/image.jpg");
    });

    it("should handle empty path and thumbnail", () => {
        const input = {
            path: "",
            thumbnail: "",
            width: 200,
            height: 200,
            preview: "",
        };
        const result = normalizeThumbnailRequest(input);
        expect(result.path).toBe("");
        expect(result.thumbnail).toBe("");
    });

    it("should fix Mac external volume file:// URLs", () => {
        const input = {
            path: "file://Volumes/SUCAI/Backup/image.heic",
            thumbnail: "file://Volumes/SUCAI/Backup/.photasaoriginals/image.heic.png",
            width: 200,
            height: 200,
            preview: "",
        };
        const result = normalizeThumbnailRequest(input);
        // 应该修复缺少前导斜杠的Mac外部卷路径
        expect(result.path).toBe("/Volumes/SUCAI/Backup/image.heic");
        expect(result.thumbnail).toBe("/Volumes/SUCAI/Backup/.photasaoriginals/image.heic.png");
    });
});

// Mock window.api
const mockWindowApi = {
    scanDirectories: vi.fn(),
    previewImport: vi.fn(),
    executeImport: vi.fn(),
    onImportProgress: vi.fn(),
    onPreviewProgress: vi.fn(),
    onImportComplete: vi.fn(),
    onImportError: vi.fn(),
    removeImportListeners: vi.fn(),
    cancelImport: vi.fn(),
    pauseImport: vi.fn(),
    resumeImport: vi.fn(),
    getImportHistory: vi.fn(),
    getImportDetails: vi.fn(),
    previewUndo: vi.fn(),
    undoImport: vi.fn(),
    getImportProgress: vi.fn(),
    chooseDirectories: vi.fn(),
    importPhotos: vi.fn(),
};

// Mock window object
Object.defineProperty(window, "api", {
    value: mockWindowApi,
    writable: true,
});

describe("Enhanced Import API Functions", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe("scanDirectories", () => {
        it("should call window.api.scanDirectories with correct parameters", async () => {
            const mockResult = [{ groupId: "test", files: [] }];
            mockWindowApi.scanDirectories.mockResolvedValue(mockResult);

            const paths = ["/test/path1", "/test/path2"];
            const filters = {
                fileTypes: ["image" as const],
                sizeRange: { min: 0, max: Number.MAX_SAFE_INTEGER },
                dateRange: { start: new Date(0), end: new Date() },
                includeSubfolders: true,
            };
            const result = await scanDirectories(paths, filters);

            expect(mockWindowApi.scanDirectories).toHaveBeenCalledWith(paths, filters);
            expect(result).toEqual(mockResult);
        });

        it("should work without filters parameter", async () => {
            const mockResult = [{ groupId: "test", files: [] }];
            mockWindowApi.scanDirectories.mockResolvedValue(mockResult);

            const paths = ["/test/path"];
            const result = await scanDirectories(paths);

            expect(mockWindowApi.scanDirectories).toHaveBeenCalledWith(paths, undefined);
            expect(result).toEqual(mockResult);
        });
    });

    describe("previewImport", () => {
        it("should call window.api.previewImport with correct config", async () => {
            const mockPreview = { totalFiles: 10, totalSize: 1000 };
            mockWindowApi.previewImport.mockResolvedValue(mockPreview);

            const config = {
                sourcePaths: ["/test"],
                targetPath: "/target",
                filters: {
                    fileTypes: ["all" as const],
                    sizeRange: { min: 0, max: Number.MAX_SAFE_INTEGER },
                    dateRange: { start: new Date(0), end: new Date() },
                    includeSubfolders: true,
                },
                duplicateStrategy: "rename" as const,
                fileGroups: [],
                selectedFiles: [],
                allowDuplicateRename: true,
            };

            const result = await previewImport(config);

            expect(mockWindowApi.previewImport).toHaveBeenCalledWith(config);
            expect(result).toEqual(mockPreview);
        });
    });

    describe("executeImport", () => {
        it("should call window.api.executeImport and return importId", async () => {
            const mockResult = { importId: "test-import-123" };
            mockWindowApi.executeImport.mockResolvedValue(mockResult);

            const config = {
                sourcePaths: ["/test"],
                targetPath: "/target",
                filters: {
                    fileTypes: ["all" as const],
                    sizeRange: { min: 0, max: Number.MAX_SAFE_INTEGER },
                    dateRange: { start: new Date(0), end: new Date() },
                    includeSubfolders: true,
                },
                duplicateStrategy: "rename" as const,
                fileGroups: [],
                selectedFiles: [],
                allowDuplicateRename: true,
            };

            const result = await executeImport(config);

            expect(mockWindowApi.executeImport).toHaveBeenCalledWith(config);
            expect(result).toEqual(mockResult);
        });
    });

    describe("Event listeners", () => {
        it("should setup import progress listener", () => {
            const mockCleanup = vi.fn();
            mockWindowApi.onImportProgress.mockReturnValue(mockCleanup);

            const callback = vi.fn();
            const cleanup = onImportProgress(callback);

            expect(mockWindowApi.onImportProgress).toHaveBeenCalledWith(callback);
            expect(cleanup).toBe(mockCleanup);
        });

        it("should setup preview progress listener", () => {
            const mockCleanup = vi.fn();
            mockWindowApi.onPreviewProgress.mockReturnValue(mockCleanup);

            const callback = vi.fn();
            const cleanup = onPreviewProgress(callback);

            expect(mockWindowApi.onPreviewProgress).toHaveBeenCalledWith(callback);
            expect(cleanup).toBe(mockCleanup);
        });

        it("should setup import complete listener", () => {
            const mockCleanup = vi.fn();
            mockWindowApi.onImportComplete.mockReturnValue(mockCleanup);

            const callback = vi.fn();
            const cleanup = onImportComplete(callback);

            expect(mockWindowApi.onImportComplete).toHaveBeenCalledWith(callback);
            expect(cleanup).toBe(mockCleanup);
        });

        it("should setup import error listener", () => {
            const mockCleanup = vi.fn();
            mockWindowApi.onImportError.mockReturnValue(mockCleanup);

            const callback = vi.fn();
            const cleanup = onImportError(callback);

            expect(mockWindowApi.onImportError).toHaveBeenCalledWith(callback);
            expect(cleanup).toBe(mockCleanup);
        });

        it("should remove all import listeners", () => {
            removeImportListeners();
            expect(mockWindowApi.removeImportListeners).toHaveBeenCalled();
        });
    });

    describe("Import control functions", () => {
        it("should cancel import", async () => {
            mockWindowApi.cancelImport.mockResolvedValue(true);

            const result = await cancelImport("test-id");

            expect(mockWindowApi.cancelImport).toHaveBeenCalledWith("test-id");
            expect(result).toBe(true);
        });

        it("should pause import", async () => {
            mockWindowApi.pauseImport.mockResolvedValue(true);

            const result = await pauseImport("test-id");

            expect(mockWindowApi.pauseImport).toHaveBeenCalledWith("test-id");
            expect(result).toBe(true);
        });

        it("should resume import", async () => {
            const mockResult = { success: true, importId: "test-id" };
            mockWindowApi.resumeImport.mockResolvedValue(mockResult);

            const result = await resumeImport("test-id");

            expect(mockWindowApi.resumeImport).toHaveBeenCalledWith("test-id");
            expect(result).toEqual(mockResult);
        });
    });

    describe("History and details functions", () => {
        it("should get import history with limit", async () => {
            const mockHistory = [{ id: "1", date: "2023-01-01" }];
            mockWindowApi.getImportHistory.mockResolvedValue(mockHistory);

            const result = await getImportHistory(10);

            expect(mockWindowApi.getImportHistory).toHaveBeenCalledWith(10);
            expect(result).toEqual(mockHistory);
        });

        it("should get import history without limit", async () => {
            const mockHistory = [{ id: "1", date: "2023-01-01" }];
            mockWindowApi.getImportHistory.mockResolvedValue(mockHistory);

            const result = await getImportHistory();

            expect(mockWindowApi.getImportHistory).toHaveBeenCalledWith(undefined);
            expect(result).toEqual(mockHistory);
        });

        it("should get import details", async () => {
            const mockDetails = { id: "test-id", files: [] };
            mockWindowApi.getImportDetails.mockResolvedValue(mockDetails);

            const result = await getImportDetails("test-id");

            expect(mockWindowApi.getImportDetails).toHaveBeenCalledWith("test-id");
            expect(result).toEqual(mockDetails);
        });

        it("should preview undo", async () => {
            const mockPreview = { affectedFiles: 10 };
            mockWindowApi.previewUndo.mockResolvedValue(mockPreview);

            const result = await previewUndo("test-id");

            expect(mockWindowApi.previewUndo).toHaveBeenCalledWith("test-id");
            expect(result).toEqual(mockPreview);
        });

        it("should undo import", async () => {
            const mockResult = { success: true, undoneFiles: 5 };
            mockWindowApi.undoImport.mockResolvedValue(mockResult);

            const result = await undoImport("test-id");

            expect(mockWindowApi.undoImport).toHaveBeenCalledWith("test-id");
            expect(result).toEqual(mockResult);
        });

        it("should get import progress", async () => {
            const mockProgress = { completed: 5, total: 10, currentFile: "test.jpg" };
            mockWindowApi.getImportProgress.mockResolvedValue(mockProgress);

            const result = await getImportProgress("test-id");

            expect(mockWindowApi.getImportProgress).toHaveBeenCalledWith("test-id");
            expect(result).toEqual(mockProgress);
        });
    });

    describe("chooseDirectories", () => {
        it("should call window.api.chooseDirectories with multiSelect true", async () => {
            const mockResult = { paths: ["/test/path"], cancelled: false };
            mockWindowApi.chooseDirectories.mockResolvedValue(mockResult);

            const result = await chooseDirectories(true);

            expect(mockWindowApi.chooseDirectories).toHaveBeenCalledWith(true);
            expect(result).toEqual(mockResult);
        });

        it("should default to multiSelect true when no parameter", async () => {
            const mockResult = { paths: ["/test/path"], cancelled: false };
            mockWindowApi.chooseDirectories.mockResolvedValue(mockResult);

            const result = await chooseDirectories();

            expect(mockWindowApi.chooseDirectories).toHaveBeenCalledWith(true);
            expect(result).toEqual(mockResult);
        });
    });

    describe("importPhotosEnhanced", () => {
        it("should use enhanced import for enhanced callback", () => {
            const mockExecuteImport = vi
                .spyOn(window.api, "executeImport")
                .mockResolvedValue({ importId: "test" });

            const enhancedCallback = {
                onProgress: vi.fn(),
                onComplete: vi.fn(),
            };

            importPhotosEnhanced(["/test/path"], "/target", enhancedCallback);

            expect(mockExecuteImport).toHaveBeenCalledWith({
                sourcePaths: ["/test/path"],
                targetPath: "/target",
                filters: {
                    fileTypes: ["all" as const],
                    sizeRange: { min: 0, max: Number.MAX_SAFE_INTEGER },
                    dateRange: { start: new Date(0), end: new Date() },
                    includeSubfolders: true,
                },
                duplicateStrategy: "rename",
                fileGroups: [],
                selectedFiles: [],
                allowDuplicateRename: true,
            });
        });

        it("should use legacy import for regular callback", () => {
            const regularCallback = vi.fn();

            importPhotosEnhanced(["/test/path"], "/target", regularCallback);

            expect(mockWindowApi.importPhotos).toHaveBeenCalledWith(
                ["/test/path"],
                "/target",
                regularCallback,
            );
        });

        it("should detect onDuplicateFound as enhanced callback", () => {
            const mockExecuteImport = vi
                .spyOn(window.api, "executeImport")
                .mockResolvedValue({ importId: "test" });

            const enhancedCallback = {
                onDuplicateFound: vi.fn(),
            };

            importPhotosEnhanced(["/test/path"], "/target", enhancedCallback);

            expect(mockExecuteImport).toHaveBeenCalled();
        });

        it("should detect onFileGroupDetected as enhanced callback", () => {
            const mockExecuteImport = vi
                .spyOn(window.api, "executeImport")
                .mockResolvedValue({ importId: "test" });

            const enhancedCallback = {
                onFileGroupDetected: vi.fn(),
            };

            importPhotosEnhanced(["/test/path"], "/target", enhancedCallback);

            expect(mockExecuteImport).toHaveBeenCalled();
        });
    });

    describe("vue-concurrency task wrappers", () => {
        it("should execute scanDirectoriesTask", async () => {
            const mockResult = [{ groupId: "test", files: [] }];
            mockWindowApi.scanDirectories.mockResolvedValue(mockResult);

            const paths = ["/test/path"];
            const filters = {
                fileTypes: ["image" as const],
                sizeRange: { min: 0, max: Number.MAX_SAFE_INTEGER },
                dateRange: { start: new Date(0), end: new Date() },
                includeSubfolders: true,
            };

            // 执行task
            await scanDirectoriesTask.perform(paths, filters);

            expect(mockWindowApi.scanDirectories).toHaveBeenCalledWith(paths, filters);
        });

        it("should execute previewImportTask", async () => {
            const mockPreview = { totalFiles: 5, totalSize: 500 };
            mockWindowApi.previewImport.mockResolvedValue(mockPreview);

            const config = {
                sourcePaths: ["/test"],
                targetPath: "/target",
                filters: {
                    fileTypes: ["all" as const],
                    sizeRange: { min: 0, max: Number.MAX_SAFE_INTEGER },
                    dateRange: { start: new Date(0), end: new Date() },
                    includeSubfolders: true,
                },
                duplicateStrategy: "rename" as const,
                fileGroups: [],
                selectedFiles: [],
                allowDuplicateRename: true,
            };

            // 执行task
            await previewImportTask.perform(config);

            expect(mockWindowApi.previewImport).toHaveBeenCalledWith(config);
        });

        it("should execute executeImportTask", async () => {
            const mockResult = { importId: "task-import-456" };
            mockWindowApi.executeImport.mockResolvedValue(mockResult);

            const config = {
                sourcePaths: ["/test"],
                targetPath: "/target",
                filters: {
                    fileTypes: ["all" as const],
                    sizeRange: { min: 0, max: Number.MAX_SAFE_INTEGER },
                    dateRange: { start: new Date(0), end: new Date() },
                    includeSubfolders: true,
                },
                duplicateStrategy: "rename" as const,
                fileGroups: [],
                selectedFiles: [],
                allowDuplicateRename: true,
            };

            // 执行task
            await executeImportTask.perform(config);

            expect(mockWindowApi.executeImport).toHaveBeenCalledWith(config);
        });

        it("should execute getImportHistoryTask with limit", async () => {
            const mockHistory = [{ id: "1", date: "2023-01-01" }];
            mockWindowApi.getImportHistory.mockResolvedValue(mockHistory);

            // 执行task
            await getImportHistoryTask.perform(20);

            expect(mockWindowApi.getImportHistory).toHaveBeenCalledWith(20);
        });

        it("should execute getImportHistoryTask without limit", async () => {
            const mockHistory = [{ id: "1", date: "2023-01-01" }];
            mockWindowApi.getImportHistory.mockResolvedValue(mockHistory);

            // 执行task
            await getImportHistoryTask.perform();

            expect(mockWindowApi.getImportHistory).toHaveBeenCalledWith(undefined);
        });
    });
});

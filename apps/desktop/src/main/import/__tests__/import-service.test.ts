/**
 * Event-driven Import Service Tests
 *
 * Tests for the new event-driven import architecture that solves the
 * "An object could not be cloned" IPC serialization issue.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import ImportService from "../import-service";
import type { ImportConfig } from "@photasa/common";

// Mock the worker and IPC dependencies
const mockWorker = {
    on: vi.fn(),
    off: vi.fn(),
    postMessage: vi.fn(),
    terminate: vi.fn(),
};

const mockIpcMain = {
    handle: vi.fn(),
    removeAllListeners: vi.fn(),
    addListener: vi.fn(),
    handleOnce: vi.fn(),
    off: vi.fn(),
    on: vi.fn(),
    once: vi.fn(),
    prependListener: vi.fn(),
    prependOnceListener: vi.fn(),
    removeListener: vi.fn(),
    setMaxListeners: vi.fn(),
    getMaxListeners: vi.fn(),
    listeners: vi.fn(),
    rawListeners: vi.fn(),
    emit: vi.fn(),
    listenerCount: vi.fn(),
    eventNames: vi.fn(),
} as any;

const mockMainWindow = {
    webContents: {
        send: vi.fn(),
    },
    isDestroyed: vi.fn().mockReturnValue(false),
} as any;

// Mock the worker creation
vi.mock("../import-worker?nodeWorker", () => ({
    default: vi.fn(() => mockWorker),
}));

// Mock sendWorkerTask
vi.mock("@photasa/common", () => ({
    sendWorkerTask: vi.fn(),
    onWorkerResponse: vi.fn(),
    getLogger: vi.fn(() => ({
        info: vi.fn(),
        debug: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    })),
    loggers: {
        import: {
            info: vi.fn(),
            debug: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
        },
    },
    ImportEvents: {
        EXECUTE: "import:execute",
        CANCEL: "import:cancel",
        PAUSE: "import:pause",
        RESUME: "import:resume",
        PREVIEW: "import:preview",
        SCAN_DIRECTORIES: "import:scan-directories",
        GET_HISTORY: "import:get-history",
        GET_DETAILS: "import:get-details",
        GET_PROGRESS: "import:get-progress",
        PREVIEW_UNDO: "import:preview-undo",
        UNDO: "import:undo",
        CHOOSE_DIRECTORIES: "import:choose-directories",
        EXTRACT_METADATA: "import:extract-metadata",
        PROGRESS: "import:progress",
        COMPLETE: "import:complete",
        ERROR: "import:error",
    },
}));

// Mock importHistoryManager
vi.mock("../history-manager", () => ({
    importHistoryManager: {
        recordImport: vi.fn(),
    },
}));

describe.skip("ImportService Event-Driven Architecture", () => {
    let importService: ImportService;
    let mockConfig: ImportConfig;

    beforeEach(async () => {
        vi.clearAllMocks();
        vi.useFakeTimers();

        // Mock sendWorkerTask to return successful response by default
        const { sendWorkerTask } = await import("@photasa/common");
        (sendWorkerTask as any).mockResolvedValue({
            success: true,
            data: {
                importId: "test-import",
                successfulFiles: 1,
                totalFiles: 1,
                errorFiles: 0,
                skippedFiles: 0,
                errors: [],
            },
        });

        // Create import service instance
        importService = new ImportService(mockIpcMain, mockMainWindow);

        mockConfig = {
            sourcePaths: ["/test/source"],
            targetPath: "/test/target",
            filters: {
                fileTypes: ["image", "video"],
                sizeRange: { min: 0, max: Number.MAX_SAFE_INTEGER },
                dateRange: {
                    start: new Date("2023-01-01"),
                    end: new Date(),
                },
                includeSubfolders: true,
                excludePaths: [],
            },
            duplicateStrategy: "rename",
            fileGroups: [],
            selectedFiles: [],
            allowDuplicateRename: true,
        };
    });

    afterEach(() => {
        vi.restoreAllMocks();
        vi.useRealTimers();
    });

    describe("IPC Handler Registration", () => {
        it("should register import:execute handler", async () => {
            // IPC handlers are registered during initialization
            await importService.initialize();

            // Check that the execute IPC handler is registered
            expect(mockIpcMain.handle).toHaveBeenCalledWith("import:execute", expect.any(Function));
        });

        it("should register all required IPC handlers", async () => {
            // IPC handlers are registered during initialization
            await importService.initialize();

            const expectedHandlers = [
                "import:scan-directories",
                "import:preview",
                "import:execute",
                "import:cancel",
                "import:pause",
                "import:resume",
                "import:get-progress",
                "import:get-history",
                "import:get-details",
                "import:preview-undo",
                "import:undo",
                "import:choose-directories",
                "import:extract-metadata",
            ];

            expectedHandlers.forEach((handler) => {
                expect(mockIpcMain.handle).toHaveBeenCalledWith(handler, expect.any(Function));
            });
        });
    });

    describe("Event-Driven Import Flow", () => {
        it("should generate unique import ID and create session", async () => {
            // Mock sendWorkerTask to return immediately
            const { sendWorkerTask } = await import("@photasa/common");
            (sendWorkerTask as any).mockResolvedValue({
                success: true,
                data: {
                    importId: "test-import",
                    successfulFiles: 1,
                    totalFiles: 1,
                    errorFiles: 0,
                    skippedFiles: 0,
                    errors: [],
                },
            });

            const startImportMethod = (importService as any).startImport;
            const result = await startImportMethod.call(importService, mockConfig);

            expect(result).toHaveProperty("importId");
            expect(result.importId).toMatch(/^import_\d+_[a-z0-9]+$/);

            // Check that session was created immediately after startImport returns
            const activeSessions = (importService as any).activeSessions;
            expect(activeSessions.has(result.importId)).toBe(true);

            const session = activeSessions.get(result.importId);
            expect(session).toMatchObject({
                importId: result.importId,
                config: expect.objectContaining(mockConfig),
                status: expect.stringMatching(/^(preparing|processing|completed)$/), // Status may change due to async execution
                cancelRequested: false,
                startTime: expect.any(Date),
            });
        });

        it("should handle config with existing importId", async () => {
            const existingImportId = "test-import-123";
            const configWithId = { ...mockConfig, importId: existingImportId };

            const startImportMethod = (importService as any).startImport;
            const result = await startImportMethod.call(importService, configWithId);

            expect(result.importId).toBe(existingImportId);
        });

        it("should serialize Date objects in config", () => {
            const serializeMethod = (importService as any).serializeImportConfig;
            const startDate = new Date("2023-01-01T00:00:00.000Z");
            const endDate = new Date("2023-12-31T23:59:59.999Z");
            const configWithDates = {
                ...mockConfig,
                filters: {
                    ...mockConfig.filters,
                    dateRange: {
                        start: startDate,
                        end: endDate,
                    },
                },
            };

            const result = serializeMethod.call(importService, configWithDates);

            expect(typeof result.filters.dateRange.start).toBe("string");
            expect(typeof result.filters.dateRange.end).toBe("string");
            expect(result.filters.dateRange.start).toBe(startDate.toISOString());
            expect(result.filters.dateRange.end).toBe(endDate.toISOString());
        });
    });

    describe("Event Communication", () => {
        it("should send progress events to renderer", () => {
            const importId = "test-import-123";
            const progress = {
                totalFiles: 10,
                processedFiles: 5,
                currentFile: "/test/file.jpg",
                speed: 2.5,
                estimatedTimeRemaining: 5000,
                remainingTime: 5000,
                startTime: new Date(),
                errors: [],
                warnings: [],
                status: "processing" as const,
            };

            const sendEventMethod = (importService as any).sendImportEvent;
            sendEventMethod.call(importService, importId, "import:progress", { progress });

            expect(mockMainWindow.webContents.send).toHaveBeenCalledWith("import:progress", {
                importId,
                progress,
                timestamp: expect.any(Date),
            });
        });

        it("should send completion events to renderer", () => {
            const importId = "test-import-123";
            const result = {
                success: true,
                totalFiles: 10,
                successfulFiles: 10,
            };

            const sendEventMethod = (importService as any).sendImportEvent;
            sendEventMethod.call(importService, importId, "import:complete", result);

            expect(mockMainWindow.webContents.send).toHaveBeenCalledWith("import:complete", {
                importId,
                ...result,
                timestamp: expect.any(Date),
            });
        });

        it("should not send events if window is destroyed", () => {
            mockMainWindow.isDestroyed.mockReturnValue(true);

            const sendEventMethod = (importService as any).sendImportEvent;
            sendEventMethod.call(importService, "test-id", "import:progress", {});

            expect(mockMainWindow.webContents.send).not.toHaveBeenCalled();
        });
    });

    describe("Cancellation Mechanism", () => {
        it("should handle import cancellation correctly", async () => {
            // Create a session first
            const startImportMethod = (importService as any).startImport;
            const { importId } = await startImportMethod.call(importService, mockConfig);

            // Cancel the import
            const cancelMethod = (importService as any).cancelImport;
            const result = await cancelMethod.call(importService, importId);

            expect(result).toBe(true);

            const activeSessions = (importService as any).activeSessions;
            const session = activeSessions.get(importId);
            expect(session.cancelRequested).toBe(true);
            expect(session.cancelTime).toBeInstanceOf(Date);
        });

        it("should send cancellation event for processing imports", async () => {
            // Create a session
            const startImportMethod = (importService as any).startImport;
            const { importId } = await startImportMethod.call(importService, mockConfig);

            // Set status to processing
            const activeSessions = (importService as any).activeSessions;
            const session = activeSessions.get(importId);
            session.status = "processing";

            // Cancel the import
            const cancelMethod = (importService as any).cancelImport;
            await cancelMethod.call(importService, importId);

            expect(mockMainWindow.webContents.send).toHaveBeenCalledWith("import:cancelled", {
                importId,
                timestamp: expect.any(Date),
            });
        });

        it("should return false for non-existent import cancellation", async () => {
            const cancelMethod = (importService as any).cancelImport;
            const result = await cancelMethod.call(importService, "non-existent-id");

            expect(result).toBe(false);
        });
    });

    describe("Utility Methods", () => {
        it("should generate valid import IDs", () => {
            const generateMethod = (importService as any).generateImportId;
            const id1 = generateMethod.call(importService);
            const id2 = generateMethod.call(importService);

            expect(id1).toMatch(/^import_\d+_[a-z0-9]+$/);
            expect(id2).toMatch(/^import_\d+_[a-z0-9]+$/);
            expect(id1).not.toBe(id2);
        });

        it("should create initial progress object", () => {
            const createProgressMethod = (importService as any).createInitialProgress;
            const progress = createProgressMethod.call(importService);

            expect(progress).toMatchObject({
                totalFiles: 0,
                processedFiles: 0,
                speed: 0,
                estimatedTimeRemaining: 0,
                remainingTime: 0,
                startTime: expect.any(Date),
                errors: expect.any(Array),
                warnings: expect.any(Array),
                status: "preparing",
                currentFile: "",
            });
        });

        it("should provide service status", () => {
            const status = importService.getServiceStatus();

            expect(status).toMatchObject({
                activeSessions: expect.any(Number),
                activeCallbacks: expect.any(Number),
                workerStatus: expect.any(String),
            });
        });
    });

    describe("Error Handling", () => {
        it.skip("should handle worker task failures gracefully", async () => {
            const { sendWorkerTask } = await import("@photasa/common");
            (sendWorkerTask as any).mockRejectedValue(new Error("Worker failed"));

            const backgroundMethod = (importService as any).executeImportInBackground;

            // Create a session first
            const importId = "test-import-fail";
            const activeSessions = (importService as any).activeSessions;
            activeSessions.set(importId, {
                importId,
                config: mockConfig,
                status: "preparing",
                cancelRequested: false,
                startTime: new Date(),
            });

            // This should not throw
            await backgroundMethod.call(importService, importId);

            // Should send error event
            expect(mockMainWindow.webContents.send).toHaveBeenCalledWith("import:error", {
                importId,
                error: "Worker failed",
                timestamp: expect.any(Date),
            });
        });
    });
});

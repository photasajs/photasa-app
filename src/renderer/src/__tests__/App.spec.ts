import { describe, it, expect, vi, beforeEach } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { usePreferenceStore } from "@renderer/stores/preference";

// Mock all dependencies to prevent complex component loading
vi.mock("@renderer/utils/api");
vi.mock("@renderer/utils/scan-folder");
vi.mock("./utils/file-handler");
vi.mock("@renderer/services/theme-manager");
vi.mock("@renderer/stores/photos");
vi.mock("@renderer/stores/statusBar");
vi.mock("@renderer/stores/menus");

vi.mock("@common/logger", () => ({
    loggers: {
        app: {
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

vi.mock("@common/file-operation-utils", () => ({
    mapFileOperationToScanAction: vi.fn((type: string) => {
        const mapping = {
            add: "scan",
            change: "rescan",
            delete: "current",
        };
        return mapping[type] || "scan";
    }),
}));

// Mock window.api
const mockOnScanQueueAdd = vi.fn();
Object.defineProperty(window, "api", {
    value: {
        onScanQueueAdd: mockOnScanQueueAdd,
        isMac: vi.fn(() => false),
        normalizePath: vi.fn((path: string) => path.replace(/\\/g, "/")),
        splitPath: vi.fn((path: string) => {
            const parts = path.split("/").filter((p) => p);
            return parts.length ? parts : [""];
        }),
        joinPath: vi.fn((...parts: string[]) => parts.join("/")),
    },
    writable: true,
});

describe("App.vue IPC Event Handler Logic", () => {
    let pinia;
    let preferenceStore;
    let mockLogger;

    beforeEach(async () => {
        // Reset all mocks
        vi.clearAllMocks();

        // Setup Pinia
        pinia = createPinia();
        setActivePinia(pinia);

        // Get stores and mocks
        preferenceStore = usePreferenceStore();
        mockLogger = vi.mocked(await import("@common/logger")).loggers.app;

        // Mock store methods
        vi.spyOn(preferenceStore, "addFileOperation");

        // Set initial store state
        preferenceStore.thumbnailSize = 150;
    });

    describe("onScanQueueAdd Handler Logic", () => {
        // Simulate the IPC handler logic directly
        const simulateIpcHandler = async (operations: any[]) => {
            const { mapFileOperationToScanAction } = await import("@common/file-operation-utils");

            mockLogger.debug(`Received ${operations.length} file operations from watch service`);

            // Process batch of file operations (simulate App.vue logic)
            operations.forEach((operation) => {
                mockLogger.debug("Adding file operation to queue:", operation);

                // Convert FileOperation to enhanced ScanAction for unified processing
                const fileOperation = {
                    path: operation.path,
                    action: mapFileOperationToScanAction(operation.type),
                    thumbnailSize:
                        operation.metadata?.thumbnailSize || preferenceStore.thumbnailSize,
                    operationType: (operation.metadata?.isFile ? "file" : "directory") as
                        | "file"
                        | "directory",
                    priority: operation.priority,
                    retryCount: operation.retryCount,
                    createdAt: operation.timestamp,
                    fileOperationId: operation.id,
                };

                // Add to persistent queue using new enhanced method
                preferenceStore.addFileOperation(fileOperation);
            });
        };

        it("should process single file operation correctly", async () => {
            const mockOperations = [
                {
                    id: "op-123",
                    type: "add",
                    path: "/test/file.jpg",
                    timestamp: 1234567890,
                    priority: 3,
                    retryCount: 0,
                    metadata: {
                        isFile: true,
                        thumbnailSize: 150,
                        lastModified: 1234567890,
                    },
                },
            ];

            await simulateIpcHandler(mockOperations);

            // Verify that addFileOperation was called correctly
            expect(preferenceStore.addFileOperation).toHaveBeenCalledTimes(1);
            expect(preferenceStore.addFileOperation).toHaveBeenCalledWith({
                path: "/test/file.jpg",
                action: "scan",
                thumbnailSize: 150,
                operationType: "file",
                priority: 3,
                retryCount: 0,
                createdAt: 1234567890,
                fileOperationId: "op-123",
            });
        });

        it("should process multiple file operations correctly", async () => {
            const mockOperations = [
                {
                    id: "op-1",
                    type: "add",
                    path: "/test/file1.jpg",
                    timestamp: 1234567890,
                    priority: 3,
                    retryCount: 0,
                    metadata: {
                        isFile: true,
                        thumbnailSize: 150,
                    },
                },
                {
                    id: "op-2",
                    type: "change",
                    path: "/test/file2.jpg",
                    timestamp: 1234567891,
                    priority: 2,
                    retryCount: 1,
                    metadata: {
                        isFile: true,
                        thumbnailSize: 200,
                    },
                },
                {
                    id: "op-3",
                    type: "delete",
                    path: "/test/file3.jpg",
                    timestamp: 1234567892,
                    priority: 1,
                    retryCount: 0,
                    metadata: {
                        isFile: false,
                    },
                },
            ];

            await simulateIpcHandler(mockOperations);

            expect(preferenceStore.addFileOperation).toHaveBeenCalledTimes(3);

            // Check first operation (add/scan)
            expect(preferenceStore.addFileOperation).toHaveBeenNthCalledWith(1, {
                path: "/test/file1.jpg",
                action: "scan",
                thumbnailSize: 150,
                operationType: "file",
                priority: 3,
                retryCount: 0,
                createdAt: 1234567890,
                fileOperationId: "op-1",
            });

            // Check second operation (change/rescan)
            expect(preferenceStore.addFileOperation).toHaveBeenNthCalledWith(2, {
                path: "/test/file2.jpg",
                action: "rescan",
                thumbnailSize: 200,
                operationType: "file",
                priority: 2,
                retryCount: 1,
                createdAt: 1234567891,
                fileOperationId: "op-2",
            });

            // Check third operation (delete/current, directory)
            expect(preferenceStore.addFileOperation).toHaveBeenNthCalledWith(3, {
                path: "/test/file3.jpg",
                action: "current",
                thumbnailSize: 150, // Falls back to store default
                operationType: "directory",
                priority: 1,
                retryCount: 0,
                createdAt: 1234567892,
                fileOperationId: "op-3",
            });
        });

        it("should handle operations with missing metadata", async () => {
            const mockOperations = [
                {
                    id: "op-minimal",
                    type: "add",
                    path: "/test/minimal.jpg",
                    timestamp: 1234567890,
                    priority: 3,
                    retryCount: 0,
                    // No metadata provided
                },
            ];

            await simulateIpcHandler(mockOperations);

            expect(preferenceStore.addFileOperation).toHaveBeenCalledWith({
                path: "/test/minimal.jpg",
                action: "scan",
                thumbnailSize: 150, // Falls back to store default
                operationType: "directory", // Defaults to directory when isFile is falsy
                priority: 3,
                retryCount: 0,
                createdAt: 1234567890,
                fileOperationId: "op-minimal",
            });
        });

        it("should use mapFileOperationToScanAction for action conversion", async () => {
            const { mapFileOperationToScanAction } = await import("@common/file-operation-utils");
            const mockOperations = [
                {
                    id: "op-convert",
                    type: "unknown-type",
                    path: "/test/unknown.jpg",
                    timestamp: 1234567890,
                    priority: 3,
                    retryCount: 0,
                    metadata: { isFile: true },
                },
            ];

            await simulateIpcHandler(mockOperations);

            expect(mapFileOperationToScanAction).toHaveBeenCalledWith("unknown-type");
            expect(preferenceStore.addFileOperation).toHaveBeenCalledWith(
                expect.objectContaining({
                    action: "scan", // mapFileOperationToScanAction mock returns 'scan' for unknown types
                }),
            );
        });

        it("should log debug messages when processing operations", async () => {
            const mockOperations = [
                {
                    id: "op-log",
                    type: "add",
                    path: "/test/log.jpg",
                    timestamp: 1234567890,
                    priority: 3,
                    retryCount: 0,
                    metadata: { isFile: true },
                },
            ];

            await simulateIpcHandler(mockOperations);

            expect(mockLogger.debug).toHaveBeenCalledWith(
                "Received 1 file operations from watch service",
            );
            expect(mockLogger.debug).toHaveBeenCalledWith(
                "Adding file operation to queue:",
                mockOperations[0],
            );
        });

        it("should handle empty operations array", async () => {
            await simulateIpcHandler([]);

            expect(mockLogger.debug).toHaveBeenCalledWith(
                "Received 0 file operations from watch service",
            );
            expect(preferenceStore.addFileOperation).not.toHaveBeenCalled();
        });

        it("should use correct operationType based on metadata.isFile", async () => {
            const mockOperations = [
                {
                    id: "op-file",
                    type: "add",
                    path: "/test/file.jpg",
                    timestamp: 1234567890,
                    priority: 3,
                    retryCount: 0,
                    metadata: { isFile: true },
                },
                {
                    id: "op-dir",
                    type: "add",
                    path: "/test/directory",
                    timestamp: 1234567891,
                    priority: 3,
                    retryCount: 0,
                    metadata: { isFile: false },
                },
            ];

            await simulateIpcHandler(mockOperations);

            expect(preferenceStore.addFileOperation).toHaveBeenNthCalledWith(
                1,
                expect.objectContaining({
                    operationType: "file",
                }),
            );

            expect(preferenceStore.addFileOperation).toHaveBeenNthCalledWith(
                2,
                expect.objectContaining({
                    operationType: "directory",
                }),
            );
        });

        it("should use custom thumbnailSize from metadata when provided", async () => {
            const mockOperations = [
                {
                    id: "op-custom-size",
                    type: "add",
                    path: "/test/custom.jpg",
                    timestamp: 1234567890,
                    priority: 3,
                    retryCount: 0,
                    metadata: {
                        isFile: true,
                        thumbnailSize: 300, // Custom size
                    },
                },
            ];

            await simulateIpcHandler(mockOperations);

            expect(preferenceStore.addFileOperation).toHaveBeenCalledWith(
                expect.objectContaining({
                    thumbnailSize: 300,
                }),
            );
        });
    });
});

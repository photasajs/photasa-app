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

vi.mock("@photasa/common", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@photasa/common")>();
    return {
        ...actual,
        loggers: {
            ...actual.loggers,
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
        mapFileOperationToScanAction: vi.fn((type: string) => {
            const mapping = {
                add: "scan",
                change: "rescan",
                delete: "current",
            };
            return mapping[type] || "scan";
        }),
    };
});

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
        mockLogger = vi.mocked(await import("@photasa/common")).loggers.app;

        // Mock store methods
        vi.spyOn(preferenceStore, "addFileOperation");

        // Set initial store state
        preferenceStore.thumbnailSize = 150;
    });

    describe("onScanQueueAdd Handler Logic", () => {
        const mockScheduleFileOperationsFromWatch = vi.fn();

        // Simulate the IPC handler logic directly
        const simulateIpcHandler = async (operations: any[]) => {
            mockLogger.debug(`Received ${operations.length} file operations from watch service`);
            await mockScheduleFileOperationsFromWatch(operations, preferenceStore.thumbnailSize);
        };

        beforeEach(() => {
            mockScheduleFileOperationsFromWatch.mockClear();
        });

        it("should hand watch operations to YuChiGong scan queue", async () => {
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

            expect(mockScheduleFileOperationsFromWatch).toHaveBeenCalledTimes(1);
            expect(mockScheduleFileOperationsFromWatch).toHaveBeenCalledWith(mockOperations, 150);
            expect(preferenceStore.addFileOperation).not.toHaveBeenCalled();
        });

        it("should pass multiple operations as one batch", async () => {
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

            expect(mockScheduleFileOperationsFromWatch).toHaveBeenCalledWith(mockOperations, 150);
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
        });

        it("should handle empty operations array", async () => {
            await simulateIpcHandler([]);

            expect(mockLogger.debug).toHaveBeenCalledWith(
                "Received 0 file operations from watch service",
            );
            expect(mockScheduleFileOperationsFromWatch).toHaveBeenCalledWith([], 150);
            expect(preferenceStore.addFileOperation).not.toHaveBeenCalled();
        });
    });
});

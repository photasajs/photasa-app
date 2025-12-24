import { describe, it, beforeEach, expect, vi } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { usePreferenceStore } from "../preference";

// Mock dependencies
vi.mock("@renderer/utils/path", () => ({
    normalizePath: vi.fn((path: string) => path.replace(/\\/g, "/")),
}));

vi.mock("@renderer/utils/folder-tree", () => ({
    addFolderToTree: vi.fn(),
    cleanDataNode: vi.fn(),
}));

vi.mock("@common/logger", () => ({
    loggers: {
        app: {
            debug: vi.fn(),
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
        },
        preference: {
            debug: vi.fn(),
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
        },
    },
}));

describe("preferenceStore.addFileOperation", () => {
    beforeEach(async () => {
        setActivePinia(createPinia());
        vi.clearAllMocks();
        // Reset normalizePath mock to default behavior
        const { normalizePath } = vi.mocked(await import("@renderer/utils/path"));
        normalizePath.mockImplementation((path: string) => path.replace(/\\/g, "/"));
    });

    it("should initialize scanningFolder array if it's not an array", async () => {
        const store = usePreferenceStore();
        // Simulate a corrupted state
        store.appState.scanningFolder = undefined as any;

        const operation = {
            path: "/test/file.jpg",
            action: "scan" as const,
            thumbnailSize: 150,
            operationType: "file" as const,
        };

        await store.addFileOperation(operation);

        expect(Array.isArray(store.scanningFolder)).toBe(true);
        expect(store.scanningFolder).toHaveLength(1);
    });

    it("should add new file operation to empty queue", async () => {
        const store = usePreferenceStore();
        const operation = {
            path: "/test/file.jpg",
            action: "scan" as const,
            thumbnailSize: 150,
            operationType: "file" as const,
            priority: 3,
            fileOperationId: "op-123",
        };

        await store.addFileOperation(operation);

        expect(store.scanningFolder).toHaveLength(1);
        expect(store.scanningFolder[0]).toMatchObject({
            path: "/test/file.jpg",
            action: "scan",
            thumbnailSize: 150,
            operationType: "file",
            priority: 3,
            retryCount: 0,
            fileOperationId: "op-123",
        });
        expect(store.scanningFolder[0].timestamp).toBeGreaterThan(0);
    });

    it("should normalize file paths", async () => {
        const store = usePreferenceStore();
        const { normalizePath } = vi.mocked(await import("@renderer/utils/path"));
        normalizePath.mockReturnValue("/test/normalized/file.jpg");

        const operation = {
            path: "/test/raw\\file.jpg",
            action: "scan" as const,
            thumbnailSize: 150,
            operationType: "file" as const,
        };

        await store.addFileOperation(operation);

        expect(normalizePath).toHaveBeenCalledWith("/test/raw\\file.jpg");
        expect(store.scanningFolder[0].path).toBe("/test/normalized/file.jpg");
    });

    it("should update existing file operation with same fileOperationId", async () => {
        const store = usePreferenceStore();
        const initialTime = Date.now() - 1000;

        // Add initial operation with normalized path
        const normalizedPath = "/test/file.jpg"; // Already normalized
        store.scanningFolder.push({
            path: normalizedPath,
            action: "scan",
            thumbnailSize: 150,
            operationType: "file",
            priority: 3,
            retryCount: 0,
            timestamp: initialTime,
            fileOperationId: "op-123",
        });

        // Update with same fileOperationId
        const updateOperation = {
            path: "/test/file.jpg",
            action: "rescan" as const,
            thumbnailSize: 200,
            operationType: "file" as const,
            priority: 1,
            retryCount: 2,
            fileOperationId: "op-123",
        };

        store.addFileOperation(updateOperation);

        expect(store.scanningFolder).toHaveLength(1);
        expect(store.scanningFolder[0]).toMatchObject({
            path: "/test/file.jpg",
            action: "rescan",
            thumbnailSize: 200,
            operationType: "file",
            priority: 1,
            retryCount: 2,
            fileOperationId: "op-123",
            timestamp: initialTime, // Should preserve original timestamp
        });
    });

    it("should add separate operations with different fileOperationIds", async () => {
        const store = usePreferenceStore();

        const operation1 = {
            path: "/test/file.jpg",
            action: "scan" as const,
            thumbnailSize: 150,
            operationType: "file" as const,
            fileOperationId: "op-123",
        };

        const operation2 = {
            path: "/test/file.jpg",
            action: "rescan" as const,
            thumbnailSize: 150,
            operationType: "file" as const,
            fileOperationId: "op-456",
        };

        await store.addFileOperation(operation1);
        await store.addFileOperation(operation2);

        expect(store.scanningFolder).toHaveLength(2);
        expect(store.scanningFolder.map((op) => op.fileOperationId)).toContain("op-123");
        expect(store.scanningFolder.map((op) => op.fileOperationId)).toContain("op-456");
    });

    it("should add directory operations without deduplication", async () => {
        const store = usePreferenceStore();

        const operation = {
            path: "/test/directory",
            action: "scan" as const,
            thumbnailSize: 150,
            operationType: "directory" as const,
        };

        await store.addFileOperation(operation);
        await store.addFileOperation(operation);

        expect(store.scanningFolder).toHaveLength(2);
        expect(store.scanningFolder[0].operationType).toBe("directory");
        expect(store.scanningFolder[1].operationType).toBe("directory");
    });

    it("should set default values for missing properties", async () => {
        const store = usePreferenceStore();

        const operation = {
            path: "/test/file.jpg",
            action: "scan" as const,
            thumbnailSize: 150,
            operationType: "file" as const,
            // Missing priority, retryCount, timestamp, fileOperationId
        };

        await store.addFileOperation(operation);

        expect(store.scanningFolder[0]).toMatchObject({
            path: "/test/file.jpg",
            action: "scan",
            thumbnailSize: 150,
            operationType: "file",
            priority: 3, // Default priority calculated by ensureCompleteScanAction
            retryCount: 0,
            fileOperationId: undefined,
        });
        expect(store.scanningFolder[0].timestamp).toBeGreaterThan(0);
    });

    it("should call updateFolderTree for directory operations", async () => {
        const store = usePreferenceStore();
        const { addFolderToTree } = vi.mocked(await import("@renderer/utils/folder-tree"));

        const operation = {
            path: "/test/directory",
            action: "scan" as const,
            thumbnailSize: 150,
            operationType: "directory" as const,
        };

        await store.addFileOperation(operation);

        expect(addFolderToTree).toHaveBeenCalledWith(store.folderTree, {
            path: "/test/directory",
            thumbnail: "",
            isVideo: false,
        });
    });

    it("should not call updateFolderTree for file operations", async () => {
        const store = usePreferenceStore();
        const { addFolderToTree } = vi.mocked(await import("@renderer/utils/folder-tree"));

        const operation = {
            path: "/test/file.jpg",
            action: "scan" as const,
            thumbnailSize: 150,
            operationType: "file" as const,
        };

        await store.addFileOperation(operation);

        expect(addFolderToTree).not.toHaveBeenCalled();
    });

    it("should not call updateFolderTree for file non-add operations", async () => {
        const store = usePreferenceStore();
        const { addFolderToTree } = vi.mocked(await import("@renderer/utils/folder-tree"));

        const operation = {
            path: "/test/file.jpg",
            action: "current" as const, // Delete operation
            thumbnailSize: 150,
            operationType: "file" as const,
        };

        await store.addFileOperation(operation);

        expect(addFolderToTree).not.toHaveBeenCalled();
    });

    it("should log debug messages during operation", async () => {
        const store = usePreferenceStore();
        const mockLogger = vi.mocked(await import("@common/logger")).loggers.chusuiliang;

        const operation = {
            path: "/test/file.jpg",
            action: "scan" as const,
            thumbnailSize: 150,
            operationType: "file" as const,
        };

        await store.addFileOperation(operation);

        expect(mockLogger.debug).toHaveBeenNthCalledWith(
            1,
            "Adding file operation to queue:",
            operation,
        );
        expect(mockLogger.debug).toHaveBeenNthCalledWith(
            2,
            "[PreferenceStore] Adding new file operation to queue:",
            "/test/file.jpg",
        );
    });

    it("should preserve existing timestamp when updating operation", async () => {
        const store = usePreferenceStore();
        const originalCreatedAt = 1234567890;

        store.scanningFolder.push({
            path: "/test/file.jpg",
            action: "scan",
            thumbnailSize: 150,
            operationType: "file",
            retryCount: 0,
            timestamp: originalCreatedAt,
            fileOperationId: "op-123",
        });

        const updateOperation = {
            path: "/test/file.jpg",
            action: "rescan" as const,
            thumbnailSize: 200,
            operationType: "file" as const,
            // Don't include timestamp - it should preserve existing value
            fileOperationId: "op-123",
        };

        store.addFileOperation(updateOperation);

        expect(store.scanningFolder[0].timestamp).toBe(originalCreatedAt);
    });
});

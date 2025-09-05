import { describe, it, beforeEach, expect, vi } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { usePreferenceStore } from "../preference";
import type { DataNode } from "ant-design-vue/lib/tree";
import type { ScanAction } from "@common/scan-types";

// Mock dependencies
vi.mock("@renderer/utils/path", () => ({
    normalizePath: vi.fn((path: string) => path.replace(/\\/g, "/")),
}));

vi.mock("@renderer/utils/folder-tree", () => ({
    buildDataNode: vi.fn(),
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
    },
}));

describe("preferenceStore.resetAllFolders", () => {
    beforeEach(() => {
        setActivePinia(createPinia());
        // mock window.api.resetPhotasaConfig
        (window as any).api = {
            resetPhotasaConfig: vi.fn(),
            normalizePath: (p: string) => (p.endsWith("/") ? p : p + "/"),
            mergePath: (l: string, r = "") => l + (r ? "/" + r : ""),
        };
    });

    it("should clear and rebuild all folders", async () => {
        const store = usePreferenceStore();
        store.paths = ["/a", "/b"];
        store.folderTree = [
            { path: "/a" } as unknown as DataNode,
            { path: "/b" } as unknown as DataNode,
        ];
        store.scanningFolder = [
            { path: "/a", action: "scan", thumbnailSize: 200 },
        ] as unknown as ScanAction[];
        const newDirs = ["/c", "/d"];
        await store.resetAllFolders(newDirs);
        // 修正断言，忽略末尾斜杠
        const trimRight = (s: string) => s.replace(/\/+$/, "");
        expect(store.paths.map(trimRight)).toEqual(["/c", "/d"]);
        // 修正断言，folderTree 应与 paths 一致
        expect(store.folderTree.map((x) => x.key)).toEqual(store.paths);
        expect(store.scanningFolder).toEqual([]);
        expect((window as any).api.resetPhotasaConfig).toHaveBeenCalledTimes(2);
        expect((window as any).api.resetPhotasaConfig).toHaveBeenCalledWith("/c");
        expect((window as any).api.resetPhotasaConfig).toHaveBeenCalledWith("/d");
    });
});

describe("preferenceStore.addFileOperation", () => {
    beforeEach(async () => {
        setActivePinia(createPinia());
        vi.clearAllMocks();
        // Reset normalizePath mock to default behavior
        const { normalizePath } = vi.mocked(await import("@renderer/utils/path"));
        normalizePath.mockImplementation((path: string) => path.replace(/\\/g, "/"));
    });

    it("should initialize scanningFolder array if it's not an array", () => {
        const store = usePreferenceStore();
        // Simulate a corrupted state
        store.scanningFolder = undefined as any;

        const operation = {
            path: "/test/file.jpg",
            action: "scan" as const,
            thumbnailSize: 150,
            operationType: "file" as const,
        };

        store.addFileOperation(operation);

        expect(Array.isArray(store.scanningFolder)).toBe(true);
        expect(store.scanningFolder).toHaveLength(1);
    });

    it("should add new file operation to empty queue", () => {
        const store = usePreferenceStore();
        const operation = {
            path: "/test/file.jpg",
            action: "scan" as const,
            thumbnailSize: 150,
            operationType: "file" as const,
            priority: 3,
            fileOperationId: "op-123",
        };

        store.addFileOperation(operation);

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
        expect(store.scanningFolder[0].createdAt).toBeGreaterThan(0);
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

        store.addFileOperation(operation);

        expect(normalizePath).toHaveBeenCalledWith("/test/raw\\file.jpg");
        expect(store.scanningFolder[0].path).toBe("/test/normalized/file.jpg");
    });

    it("should update existing file operation with same fileOperationId", () => {
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
            createdAt: initialTime,
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
            createdAt: initialTime, // Should preserve original createdAt
        });
    });

    it("should add separate operations with different fileOperationIds", () => {
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

        store.addFileOperation(operation1);
        store.addFileOperation(operation2);

        expect(store.scanningFolder).toHaveLength(2);
        expect(store.scanningFolder[0].fileOperationId).toBe("op-123");
        expect(store.scanningFolder[1].fileOperationId).toBe("op-456");
    });

    it("should add directory operations without deduplication", () => {
        const store = usePreferenceStore();

        const operation = {
            path: "/test/directory",
            action: "scan" as const,
            thumbnailSize: 150,
            operationType: "directory" as const,
        };

        store.addFileOperation(operation);
        store.addFileOperation(operation);

        expect(store.scanningFolder).toHaveLength(2);
        expect(store.scanningFolder[0].operationType).toBe("directory");
        expect(store.scanningFolder[1].operationType).toBe("directory");
    });

    it("should set default values for missing properties", () => {
        const store = usePreferenceStore();

        const operation = {
            path: "/test/file.jpg",
            action: "scan" as const,
            thumbnailSize: 150,
            operationType: "file" as const,
            // Missing priority, retryCount, createdAt, fileOperationId
        };

        store.addFileOperation(operation);

        expect(store.scanningFolder[0]).toMatchObject({
            path: "/test/file.jpg",
            action: "scan",
            thumbnailSize: 150,
            operationType: "file",
            priority: undefined, // Explicitly undefined as not provided
            retryCount: 0,
            fileOperationId: undefined,
        });
        expect(store.scanningFolder[0].createdAt).toBeGreaterThan(0);
    });

    it("should call updateFolderTree for directory operations", async () => {
        const store = usePreferenceStore();
        const { buildDataNode } = vi.mocked(await import("@renderer/utils/folder-tree"));

        const operation = {
            path: "/test/directory",
            action: "scan" as const,
            thumbnailSize: 150,
            operationType: "directory" as const,
        };

        store.addFileOperation(operation);

        expect(buildDataNode).toHaveBeenCalledWith(store.folderTree, {
            path: "/test/directory",
            thumbnail: "",
            isVideo: false,
        });
    });

    it("should call updateFolderTree for file add operations", async () => {
        const store = usePreferenceStore();
        const { buildDataNode } = vi.mocked(await import("@renderer/utils/folder-tree"));

        const operation = {
            path: "/test/file.jpg",
            action: "scan" as const,
            thumbnailSize: 150,
            operationType: "file" as const,
        };

        store.addFileOperation(operation);

        expect(buildDataNode).toHaveBeenCalledWith(store.folderTree, {
            path: "/test/file.jpg",
            thumbnail: "",
            isVideo: false,
        });
    });

    it("should not call updateFolderTree for file non-add operations", async () => {
        const store = usePreferenceStore();
        const { buildDataNode } = vi.mocked(await import("@renderer/utils/folder-tree"));

        const operation = {
            path: "/test/file.jpg",
            action: "current" as const, // Delete operation
            thumbnailSize: 150,
            operationType: "file" as const,
        };

        store.addFileOperation(operation);

        expect(buildDataNode).not.toHaveBeenCalled();
    });

    it("should log debug messages during operation", async () => {
        const store = usePreferenceStore();
        const mockLogger = vi.mocked(await import("@common/logger")).loggers.app;

        const operation = {
            path: "/test/file.jpg",
            action: "scan" as const,
            thumbnailSize: 150,
            operationType: "file" as const,
        };

        store.addFileOperation(operation);

        expect(mockLogger.debug).toHaveBeenNthCalledWith(
            1,
            "Adding file operation to queue:",
            operation,
        );
        expect(mockLogger.debug).toHaveBeenNthCalledWith(
            2,
            "Adding new file operation to queue:",
            "/test/file.jpg",
        );
    });

    it("should preserve existing createdAt when updating operation", () => {
        const store = usePreferenceStore();
        const originalCreatedAt = 1234567890;

        store.scanningFolder.push({
            path: "/test/file.jpg",
            action: "scan",
            thumbnailSize: 150,
            operationType: "file",
            retryCount: 0,
            createdAt: originalCreatedAt,
            fileOperationId: "op-123",
        });

        const updateOperation = {
            path: "/test/file.jpg",
            action: "rescan" as const,
            thumbnailSize: 200,
            operationType: "file" as const,
            // Don't include createdAt - it should preserve existing value
            fileOperationId: "op-123",
        };

        store.addFileOperation(updateOperation);

        expect(store.scanningFolder[0].createdAt).toBe(originalCreatedAt);
    });
});

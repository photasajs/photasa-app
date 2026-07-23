import "reflect-metadata";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { SimingAdapter } from "@photasa/siming";

// Mock SimingEngine
vi.mock("@photasa/siming", () => ({
    SimingEngine: vi.fn().mockImplementation(() => ({
        initialize: vi.fn().mockResolvedValue(undefined),
        shutdown: vi.fn().mockResolvedValue(undefined),
        persistFolderTree: vi.fn().mockResolvedValue(undefined),
        restoreFolderTree: vi.fn().mockResolvedValue([]),
        clearFolderTree: vi.fn().mockResolvedValue(undefined),
        restoreAppState: vi.fn().mockResolvedValue({}),
    })),
}));

describe("SimingAdapter", () => {
    let adapter: SimingAdapter;
    let mockEngine: any;

    beforeEach(() => {
        vi.clearAllMocks();
        adapter = new SimingAdapter();
        // Access private engine for testing
        mockEngine = (adapter as any).engine;
    });

    it("should initialize engine", async () => {
        await adapter.initialize();
        expect(mockEngine.initialize).toHaveBeenCalled();
    });

    it("should shutdown engine", async () => {
        await adapter.shutdown();
        expect(mockEngine.shutdown).toHaveBeenCalled();
    });

    it("should delegate persistFolderTree", async () => {
        const tree: any[] = [];
        await adapter.persistFolderTree(tree);
        expect(mockEngine.persistFolderTree).toHaveBeenCalledWith(tree);
    });

    it("should delegate restoreFolderTree", async () => {
        const tree: any[] = [];
        vi.mocked(mockEngine.restoreFolderTree).mockResolvedValueOnce(tree);
        const result = await adapter.restoreFolderTree();
        expect(result).toBe(tree);
    });

    it("should delegate clearFolderTree", async () => {
        await adapter.clearFolderTree();
        expect(mockEngine.clearFolderTree).toHaveBeenCalled();
    });

    it("should delegate restoreAppState", async () => {
        const state: any = {};
        vi.mocked(mockEngine.restoreAppState).mockResolvedValueOnce(state);
        const result = await adapter.restoreAppState();
        expect(result).toBe(state);
    });

    it("should be ready immediately", () => {
        expect(adapter.isReady()).toBe(true);
    });
});

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock @electron-toolkit/preload
const mockIpcRenderer = {
    on: vi.fn(),
    removeListener: vi.fn(),
    send: vi.fn(),
    invoke: vi.fn(),
    removeAllListeners: vi.fn(),
};

vi.mock("@electron-toolkit/preload", () => ({
    electronAPI: {
        ipcRenderer: mockIpcRenderer,
    },
}));

// Mock electron context bridge
const mockContextBridge = {
    exposeInMainWorld: vi.fn(),
};

vi.mock("electron", () => ({
    contextBridge: mockContextBridge,
}));

// Mock all the other preload modules to avoid complex dependencies
vi.mock("./fs-watch", () => ({
    startWatching: vi.fn(),
    stopWatching: vi.fn(),
}));

vi.mock("./photo-import", () => ({
    importPhotos: vi.fn(),
    scanPhotos: vi.fn(),
}));

vi.mock("./choose-directory", () => ({
    chooseDirectory: vi.fn(),
    getDirectory: vi.fn(),
}));

vi.mock("./image-helper", () => ({
    createThumbnail: vi.fn(),
    getImageType: vi.fn(),
    isImageFile: vi.fn(),
    isVideoFile: vi.fn(),
    removeThumbnail: vi.fn(),
    fileUrlFromPath: vi.fn(),
}));

vi.mock("./shell-helper", () => ({
    openInFinder: vi.fn(),
}));

vi.mock("./file-config", () => ({
    addToPhotoList: vi.fn(),
    removeFromPhotoList: vi.fn(),
    getPhotasaConfig: vi.fn(),
    fixPhotasaConfig: vi.fn(),
    resetPhotasaConfig: vi.fn(),
}));

vi.mock("./query-config", () => ({
    scanSubfolders: vi.fn(),
    cleanupScanQueue: vi.fn(),
}));

vi.mock("./path-helper", () => ({
    normalizePath: vi.fn((path: string) => path.replace(/\\/g, "/")),
    mergePath: vi.fn(),
    splitPath: vi.fn(),
    joinPath: vi.fn(),
    getSeparator: vi.fn(),
}));

vi.mock("@common/index", () => ({
    shouldIgnorePhotasaPath: vi.fn(),
}));

vi.mock("@shared/path-util", () => ({
    toThumbnailName: vi.fn(),
    shortenThumbnailName: vi.fn(),
    isFileUnderFolder: vi.fn(),
    toFileName: vi.fn(),
    isHiddenFile: vi.fn(),
    normalizePath: vi.fn((input) => input), // Mock normalizePath function
    removeFileProtocol: vi.fn((input) => input.replace(/^file:\/\//, "")), // Mock removeFileProtocol function
    toDirName: vi.fn((path: string) => path.split("/").slice(0, -1).join("/") || "/"), // Mock toDirName function
}));

// Mock process.contextIsolated
Object.defineProperty(process, "contextIsolated", {
    value: true,
    writable: true,
});

// Mock process.platform for isMac function
const originalPlatform = process.platform;
Object.defineProperty(process, "platform", {
    value: "darwin",
    writable: true,
    configurable: true,
});

describe("Preload onScanQueueAdd API", () => {
    let api: any;

    beforeEach(async () => {
        // 完全重置所有模拟
        vi.resetAllMocks();
        vi.resetModules();

        // 重新设置 process 属性
        Object.defineProperty(process, "contextIsolated", {
            value: true,
            writable: true,
        });

        // Import the preload module after mocks are set up
        await import("../index");

        // Get the API that was exposed to the main world
        const apiCall = mockContextBridge.exposeInMainWorld.mock.calls.find(
            (call) => call[0] === "api",
        );
        if (apiCall) {
            api = apiCall[1];
        }
    });

    afterEach(() => {
        vi.resetAllMocks();
    });

    describe("onScanQueueAdd", () => {
        it("should be defined in the API", () => {
            expect(api).toBeDefined();
            expect(api.onScanQueueAdd).toBeDefined();
            expect(typeof api.onScanQueueAdd).toBe("function");
        });

        it("should register IPC event listener when called", () => {
            const mockCallback = vi.fn();

            // 重置 mock 以确保计数正确
            mockIpcRenderer.on.mockClear();

            api.onScanQueueAdd(mockCallback);

            expect(mockIpcRenderer.on).toHaveBeenCalledTimes(1);
            expect(mockIpcRenderer.on).toHaveBeenCalledWith(
                "picasa:add-to-scan-queue",
                expect.any(Function),
            );
        });

        it("should return cleanup function", () => {
            const mockCallback = vi.fn();

            const cleanup = api.onScanQueueAdd(mockCallback);

            expect(cleanup).toBeDefined();
            expect(typeof cleanup).toBe("function");
        });

        it("should call cleanup function to remove listener", () => {
            const mockCallback = vi.fn();

            const cleanup = api.onScanQueueAdd(mockCallback);
            cleanup();

            expect(mockIpcRenderer.removeListener).toHaveBeenCalledTimes(1);
            expect(mockIpcRenderer.removeListener).toHaveBeenCalledWith(
                "picasa:add-to-scan-queue",
                expect.any(Function),
            );
        });

        it("should call callback with operations when IPC event is triggered", () => {
            const mockCallback = vi.fn();
            const mockOperations = [
                {
                    id: "op-1",
                    type: "add",
                    path: "/test/file1.jpg",
                    timestamp: 1234567890,
                    priority: 3,
                },
                {
                    id: "op-2",
                    type: "change",
                    path: "/test/file2.jpg",
                    timestamp: 1234567891,
                    priority: 2,
                },
            ];

            // 重置 mock 以确保计数正确
            mockIpcRenderer.on.mockClear();

            api.onScanQueueAdd(mockCallback);

            // Get the registered handler function
            const registeredHandler = mockIpcRenderer.on.mock.calls[0][1];

            // Simulate IPC event
            registeredHandler({}, mockOperations);

            expect(mockCallback).toHaveBeenCalledTimes(1);
            expect(mockCallback).toHaveBeenCalledWith(mockOperations);
        });

        it("should handle multiple callback registrations independently", () => {
            const mockCallback1 = vi.fn();
            const mockCallback2 = vi.fn();
            const mockOperations = [{ id: "op-1", type: "add", path: "/test/file.jpg" }];

            // 重置 mock 以确保计数正确
            mockIpcRenderer.on.mockClear();

            api.onScanQueueAdd(mockCallback1);
            api.onScanQueueAdd(mockCallback2);

            expect(mockIpcRenderer.on).toHaveBeenCalledTimes(2);

            // Get both registered handlers
            const handler1 = mockIpcRenderer.on.mock.calls[0][1];
            const handler2 = mockIpcRenderer.on.mock.calls[1][1];

            // Trigger first handler
            handler1({}, mockOperations);
            expect(mockCallback1).toHaveBeenCalledWith(mockOperations);
            expect(mockCallback2).not.toHaveBeenCalled();

            // Trigger second handler
            handler2({}, mockOperations);
            expect(mockCallback2).toHaveBeenCalledWith(mockOperations);
            expect(mockCallback1).toHaveBeenCalledTimes(1); // Still only called once
        });

        it("should handle empty operations array", () => {
            const mockCallback = vi.fn();

            // 重置 mock 以确保计数正确
            mockIpcRenderer.on.mockClear();

            api.onScanQueueAdd(mockCallback);
            const registeredHandler = mockIpcRenderer.on.mock.calls[0][1];

            registeredHandler({}, []);

            expect(mockCallback).toHaveBeenCalledTimes(1);
            expect(mockCallback).toHaveBeenCalledWith([]);
        });

        it("should handle complex operations with metadata", () => {
            const mockCallback = vi.fn();
            const complexOperations = [
                {
                    id: "op-complex",
                    type: "add",
                    path: "/test/complex/file.jpg",
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

            // 重置 mock 以确保计数正确
            mockIpcRenderer.on.mockClear();

            api.onScanQueueAdd(mockCallback);
            const registeredHandler = mockIpcRenderer.on.mock.calls[0][1];

            registeredHandler({}, complexOperations);

            expect(mockCallback).toHaveBeenCalledWith(complexOperations);
        });

        it("should cleanup properly when multiple handlers are registered", () => {
            const mockCallback1 = vi.fn();
            const mockCallback2 = vi.fn();

            const cleanup1 = api.onScanQueueAdd(mockCallback1);
            const cleanup2 = api.onScanQueueAdd(mockCallback2);

            // Cleanup first handler
            cleanup1();
            expect(mockIpcRenderer.removeListener).toHaveBeenCalledTimes(1);

            // Cleanup second handler
            cleanup2();
            expect(mockIpcRenderer.removeListener).toHaveBeenCalledTimes(2);
        });

        it("should not interfere with other IPC event listeners", () => {
            const mockCallback = vi.fn();

            // 重置 mock 以确保计数正确
            mockIpcRenderer.on.mockClear();

            // Register some other IPC listeners first
            mockIpcRenderer.on("other-event-1", vi.fn());
            mockIpcRenderer.on("other-event-2", vi.fn());

            // Register our onScanQueueAdd
            api.onScanQueueAdd(mockCallback);

            // Should have 3 total registrations now
            expect(mockIpcRenderer.on).toHaveBeenCalledTimes(3);
            expect(mockIpcRenderer.on).toHaveBeenCalledWith(
                "picasa:add-to-scan-queue",
                expect.any(Function),
            );
        });

        it("should work correctly when process is not context isolated", async () => {
            // Test the non-context-isolated path
            Object.defineProperty(process, "contextIsolated", {
                value: false,
                writable: true,
            });

            const mockWindow = {} as any;
            global.window = mockWindow;

            // Clear mocks and re-import
            vi.resetAllMocks();
            vi.resetModules();

            await import("../index");

            expect(mockWindow.api).toBeDefined();
            expect(mockWindow.api.onScanQueueAdd).toBeDefined();
            expect(typeof mockWindow.api.onScanQueueAdd).toBe("function");

            // 重置 mock 以确保计数正确
            mockIpcRenderer.on.mockClear();

            // Test the functionality
            const mockCallback = vi.fn();
            mockWindow.api.onScanQueueAdd(mockCallback);

            expect(mockIpcRenderer.on).toHaveBeenCalledWith(
                "picasa:add-to-scan-queue",
                expect.any(Function),
            );
        });
    });

    describe("Platform detection (isMac)", () => {
        it("should return true on darwin platform", async () => {
            Object.defineProperty(process, "platform", {
                value: "darwin",
                writable: true,
            });

            Object.defineProperty(process, "contextIsolated", {
                value: true,
                writable: true,
            });

            // 重置 mocks
            vi.resetAllMocks();
            vi.resetModules();

            await import("../index");

            const exposedApi = mockContextBridge.exposeInMainWorld.mock.calls.find(
                (call) => call[0] === "api",
            )?.[1];

            expect(exposedApi).toBeDefined();
            expect(exposedApi.isMac()).toBe(true);
        });

        it("should return false on non-darwin platforms", async () => {
            Object.defineProperty(process, "platform", {
                value: "win32",
                writable: true,
            });

            Object.defineProperty(process, "contextIsolated", {
                value: true,
                writable: true,
            });

            // 重置 mocks
            vi.resetAllMocks();
            vi.resetModules();

            await import("../index");

            const exposedApi = mockContextBridge.exposeInMainWorld.mock.calls.find(
                (call) => call[0] === "api",
            )?.[1];

            expect(exposedApi).toBeDefined();
            expect(exposedApi.isMac()).toBe(false);
        });
    });
});

// Restore original platform after all tests
afterAll(() => {
    Object.defineProperty(process, "platform", {
        value: originalPlatform,
        writable: true,
        configurable: true,
    });
});

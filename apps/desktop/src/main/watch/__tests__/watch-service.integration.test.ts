import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import WatchService from "../watch-service";
import type { BrowserWindow, IpcMain } from "electron";
import EventEmitter from "events";

const mockEngine = {
    initialize: vi.fn().mockResolvedValue(undefined),
    startWatching: vi.fn().mockResolvedValue(undefined),
    pause: vi.fn().mockResolvedValue(undefined),
    shutdown: vi.fn().mockResolvedValue(undefined),
    setCommandDispatcher: vi.fn(),
    onEvent: vi.fn(() => vi.fn()),
};

vi.mock("electron-is-dev", () => ({
    default: false,
}));

vi.mock("@photasa/shunfenger", () => ({
    createShunfengerEngine: vi.fn(() => mockEngine),
}));

vi.mock("@photasa/common", () => ({
    loggers: {
        watch: {
            info: vi.fn(),
            debug: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
        },
    },
    WatchServiceEvent: {
        start: "picasa:start-file-watch",
        stop: "picasa:stop-file-watch",
        error: "picasa:file-error",
        ready: "picasa:file-ready",
    },
    createFileOperation: vi.fn((type, path, isFile, thumbnailSize) => ({
        id: `mock-id-${Date.now()}`,
        type,
        path,
        timestamp: Date.now(),
        priority: type === "delete" ? 1 : 3,
        retryCount: 0,
        metadata: {
            thumbnailSize,
            isFile,
            lastModified: Date.now(),
        },
    })),
}));

describe("WatchService Integration Tests", () => {
    let watchService: WatchService;
    let mockIpcMain: IpcMain;
    let mockMainWindow: BrowserWindow;
    let mockWebContents: { send: ReturnType<typeof vi.fn> };
    let commandDispatcher: ((command: unknown) => void) | undefined;
    let engineEventListener: ((event: unknown) => void) | undefined;

    beforeEach(async () => {
        vi.useFakeTimers();
        commandDispatcher = undefined;
        engineEventListener = undefined;

        mockEngine.initialize.mockClear();
        mockEngine.startWatching.mockClear();
        mockEngine.pause.mockClear();
        mockEngine.shutdown.mockClear();
        mockEngine.setCommandDispatcher.mockImplementation((dispatcher) => {
            commandDispatcher = dispatcher;
        });
        mockEngine.onEvent.mockImplementation((listener) => {
            engineEventListener = listener;
            return vi.fn();
        });

        mockIpcMain = new EventEmitter() as IpcMain;
        mockIpcMain.handle = vi.fn();
        mockIpcMain.removeHandler = vi.fn();
        mockIpcMain.on = vi.fn();
        mockIpcMain.removeAllListeners = vi.fn();

        mockWebContents = { send: vi.fn() };
        mockMainWindow = { webContents: mockWebContents } as BrowserWindow;

        watchService = new WatchService(mockIpcMain, mockMainWindow);
        await watchService.initialize();
    });

    afterEach(async () => {
        await watchService.shutdown();
        vi.clearAllTimers();
        vi.useRealTimers();
        vi.clearAllMocks();
    });

    it("initializes shunfenger engine on startup", () => {
        expect(mockEngine.initialize).toHaveBeenCalledTimes(1);
        expect(mockEngine.setCommandDispatcher).toHaveBeenCalledTimes(1);
        expect(mockEngine.onEvent).toHaveBeenCalledTimes(1);
    });

    it("batches file-operation commands to scan queue IPC", async () => {
        commandDispatcher?.({
            type: "file-operation",
            payload: {
                operation: {
                    id: "op-1",
                    type: "add",
                    path: "/unique/path1.jpg",
                    timestamp: Date.now(),
                    priority: 3,
                    retryCount: 0,
                    metadata: { thumbnailSize: 150, isFile: true },
                },
            },
        });
        commandDispatcher?.({
            type: "file-operation",
            payload: {
                operation: {
                    id: "op-2",
                    type: "change",
                    path: "/unique/path2.jpg",
                    timestamp: Date.now(),
                    priority: 3,
                    retryCount: 0,
                    metadata: { thumbnailSize: 150, isFile: true },
                },
            },
        });

        await vi.runAllTimersAsync();

        expect(mockWebContents.send).toHaveBeenCalledWith("picasa:add-to-scan-queue", [
            expect.objectContaining({ path: "/unique/path1.jpg" }),
            expect.objectContaining({ path: "/unique/path2.jpg" }),
        ]);
    });

    it("converts scan-command to file operation for IPC compatibility", async () => {
        const { createFileOperation } = await import("@photasa/common");

        commandDispatcher?.({
            type: "scan-command",
            payload: {
                action: {
                    path: "/photos/album",
                    thumbnailSize: 150,
                    operationType: "directory",
                },
            },
        });

        await vi.runAllTimersAsync();

        expect(createFileOperation).toHaveBeenCalledWith("addDir", "/photos/album", false, 150);
        expect(mockWebContents.send).toHaveBeenCalled();
    });

    it("forwards engine ready status to renderer", () => {
        engineEventListener?.({
            type: "status",
            state: "ready",
            timestamp: Date.now(),
        });

        expect(mockWebContents.send).toHaveBeenCalledWith("picasa:file-ready", {});
    });

    it("forwards engine error status to renderer", () => {
        const error = new Error("watcher failed");

        engineEventListener?.({
            type: "status",
            state: "error",
            error,
            timestamp: Date.now(),
        });

        expect(mockWebContents.send).toHaveBeenCalledWith("picasa:file-error", { error });
    });

    it("flushes pending operations on shutdown", async () => {
        commandDispatcher?.({
            type: "file-operation",
            payload: {
                operation: {
                    id: "op-1",
                    type: "add",
                    path: "/test/file.jpg",
                    timestamp: Date.now(),
                    priority: 3,
                    retryCount: 0,
                    metadata: { thumbnailSize: 150, isFile: true },
                },
            },
        });

        await watchService.shutdown();

        expect(mockWebContents.send).toHaveBeenCalledWith(
            "picasa:add-to-scan-queue",
            expect.arrayContaining([expect.objectContaining({ path: "/test/file.jpg" })]),
        );
        expect(mockEngine.shutdown).toHaveBeenCalledTimes(1);
    });
});

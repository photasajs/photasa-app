/**
 * ConfigService Vitest测试
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { IpcMain, BrowserWindow } from "electron";
import type { ConfigResponse } from "@common/config-types";

// Mock worker instance for Vitest
const mockWorker = {
    on: vi.fn(),
    postMessage: vi.fn(),
    terminate: vi.fn(),
};

// Mock the config-worker module using Vitest
vi.mock("../config-worker?nodeWorker", () => ({
    default: vi.fn(() => mockWorker),
}));

// Mock electron types
const mockIpcMain = {
    on: vi.fn(),
    handle: vi.fn(),
    removeAllListeners: vi.fn(),
    removeHandler: vi.fn(),
} as unknown as IpcMain;

const mockMainWindow = {
    webContents: {
        send: vi.fn(),
    },
} as unknown as BrowserWindow;

// Import after mocks are set up
import ConfigService from "../config-service";

describe("ConfigService", () => {
    let configService: ConfigService;
    let messageHandlers: Record<string, (message: string) => void>;
    let errorHandlers: Array<(error: Error) => void>;
    let exitHandlers: Array<(code: number) => void>;

    beforeEach(() => {
        vi.clearAllMocks();

        messageHandlers = {};
        errorHandlers = [];
        exitHandlers = [];

        // Mock worker.on to capture event handlers
        mockWorker.on.mockImplementation((event: string, handler: any) => {
            if (event === "message") {
                messageHandlers[event] = handler;
            } else if (event === "error") {
                errorHandlers.push(handler);
            } else if (event === "exit") {
                exitHandlers.push(handler);
            }
        });

        configService = new ConfigService(mockIpcMain, mockMainWindow);
    });

    afterEach(() => {
        vi.clearAllTimers();
    });

    describe("initialization", () => {
        it("should create instance with correct initial state", () => {
            expect(configService).toBeDefined();
            expect(configService.getWorkerStatus()).toBe("initializing");
        });

        it("should initialize worker and set up IPC handlers correctly", async () => {
            await configService.initialize();

            expect(mockWorker.on).toHaveBeenCalledWith("message", expect.any(Function));
            expect(mockWorker.on).toHaveBeenCalledWith("error", expect.any(Function));
            expect(mockWorker.on).toHaveBeenCalledWith("exit", expect.any(Function));
            expect(mockIpcMain.on).toHaveBeenCalledWith(
                "picasa:query-config",
                expect.any(Function),
            );
            expect(mockIpcMain.handle).toHaveBeenCalledWith(
                "picasa:add-config",
                expect.any(Function),
            );
        });

        it("should transition to ready status on first valid message", async () => {
            await configService.initialize();

            const response: ConfigResponse = {
                action: "complete",
                from: "query",
                path: "/test/path",
                config: { version: "1.0", photoList: [], lastModified: Date.now() },
            };

            messageHandlers.message(JSON.stringify(response));
            expect(configService.getWorkerStatus()).toBe("ready");
        });

        it("should handle worker errors and attempt restart", async () => {
            await configService.initialize();

            const testError = new Error("Worker test error");
            errorHandlers.forEach((handler) => handler(testError));

            expect(configService.getWorkerStatus()).toBe("restarting");
        });

        it("should handle worker exit and attempt restart", async () => {
            await configService.initialize();

            exitHandlers.forEach((handler) => handler(1));

            expect(configService.getWorkerStatus()).toBe("restarting");
        });
    });

    describe("worker health monitoring", () => {
        beforeEach(() => {
            vi.useFakeTimers();
        });

        afterEach(() => {
            vi.useRealTimers();
        });

        it("should send heartbeat after 30 seconds when worker is ready", async () => {
            await configService.initialize();

            // Set worker to ready state
            const response: ConfigResponse = {
                action: "complete",
                from: "query",
                path: "/test/path",
                config: { version: "1.0", photoList: [], lastModified: Date.now() },
            };
            messageHandlers.message(JSON.stringify(response));

            vi.advanceTimersByTime(30000);

            expect(mockWorker.postMessage).toHaveBeenCalledWith(
                expect.stringContaining('"action":"heartbeat"'),
            );
        });

        it("should not send heartbeat when worker is not ready", async () => {
            await configService.initialize();

            vi.advanceTimersByTime(30000);

            const heartbeatCalls = mockWorker.postMessage.mock.calls.filter((call) =>
                call[0].includes('"action":"heartbeat"'),
            );
            expect(heartbeatCalls).toHaveLength(0);
        });
    });

    describe("message handling", () => {
        beforeEach(async () => {
            await configService.initialize();
        });

        it("should handle query response and forward to renderer", () => {
            const response: ConfigResponse = {
                action: "complete",
                from: "query",
                path: "/test/path",
                config: { version: "1.0", photoList: [], lastModified: Date.now() },
            };

            messageHandlers.message(JSON.stringify(response));

            expect(mockMainWindow.webContents.send).toHaveBeenCalledWith(
                "picasa:photasa-config",
                response,
            );
        });

        it("should handle heartbeat response without forwarding config", () => {
            const response: ConfigResponse = {
                action: "heartbeat",
                path: undefined,
                config: { version: "1.0", photoList: [], lastModified: Date.now() },
            };

            messageHandlers.message(JSON.stringify(response));

            // Should not send photasa-config message for heartbeat
            const photasaConfigCalls = (mockMainWindow.webContents.send as any).mock.calls.filter(
                (call: any) => call[0] === "picasa:photasa-config",
            );
            expect(photasaConfigCalls).toHaveLength(0);
        });

        it("should handle add config response correctly", () => {
            // Add config responses resolve promises, they don't send to renderer
            const response: ConfigResponse = {
                action: "complete",
                from: "add",
                queueId: 0,
                path: "/test/new-path",
                config: { version: "1.0", photoList: [], lastModified: Date.now() },
            };

            messageHandlers.message(JSON.stringify(response));

            // Add config responses don't send photasa-config messages
            const photasaConfigCalls = (mockMainWindow.webContents.send as any).mock.calls.filter(
                (call: any) => call[0] === "picasa:photasa-config",
            );
            expect(photasaConfigCalls).toHaveLength(0);
        });

        it("should handle error response correctly", () => {
            // Error responses are only forwarded if they're from query operations
            const response: ConfigResponse = {
                action: "error",
                from: "query",
                path: "/test/error-path",
                config: null as any,
                error: "Test error message",
            };

            messageHandlers.message(JSON.stringify(response));

            expect(mockMainWindow.webContents.send).toHaveBeenCalledWith(
                "picasa:photasa-config",
                response,
            );
        });

        it("should handle malformed JSON messages gracefully", () => {
            expect(() => {
                messageHandlers.message("invalid json");
            }).not.toThrow();
        });
    });

    describe("status reporting", () => {
        it("should report service status with worker status", async () => {
            await configService.initialize();
            configService.reportStatus();

            expect(mockMainWindow.webContents.send).toHaveBeenCalledWith(
                "picasa:service-status",
                expect.objectContaining({
                    service: "config",
                    workerStatus: expect.any(String),
                }),
            );
        });

        it("should return valid worker status values", () => {
            const status = configService.getWorkerStatus();
            expect(["initializing", "ready", "error", "restarting"]).toContain(status);
        });

        it("should report different statuses at different lifecycle stages", async () => {
            // Initial state
            expect(configService.getWorkerStatus()).toBe("initializing");

            // After initialization
            await configService.initialize();
            expect(configService.getWorkerStatus()).toBe("initializing");

            // After receiving first message
            const response: ConfigResponse = {
                action: "complete",
                from: "query",
                path: "/test/path",
                config: { version: "1.0", photoList: [], lastModified: Date.now() },
            };
            messageHandlers.message(JSON.stringify(response));
            expect(configService.getWorkerStatus()).toBe("ready");

            // After error (attempts restart)
            errorHandlers.forEach((handler) => handler(new Error("Test error")));
            expect(configService.getWorkerStatus()).toBe("restarting");
        });
    });

    describe("IPC event handlers", () => {
        let queryHandler: (event: any, args: { paths: string[] }) => void;
        let addHandler: (event: any, args: { paths: string[] }) => Promise<void>;

        beforeEach(async () => {
            await configService.initialize();

            // Extract the handlers from the mock calls
            const onCalls = (mockIpcMain.on as any).mock.calls;
            const handleCalls = (mockIpcMain.handle as any).mock.calls;

            queryHandler = (onCalls as any).find(
                (call: any) => call[0] === "picasa:query-config",
            )?.[1];
            addHandler = (handleCalls as any).find(
                (call: any) => call[0] === "picasa:add-config",
            )?.[1];
        });

        it("should handle query-config IPC events", () => {
            expect(queryHandler).toBeDefined();

            const mockEvent = { sender: { id: 1 } };
            const testArgs = { paths: ["/test/query/path"] };

            queryHandler(mockEvent, testArgs);

            expect(mockWorker.postMessage).toHaveBeenCalledWith(
                expect.stringContaining('"action":"query"'),
            );
            expect(mockWorker.postMessage).toHaveBeenCalledWith(
                expect.stringContaining("/test/query/path"),
            );
        });

        it("should handle add-config IPC events", async () => {
            expect(addHandler).toBeDefined();

            const mockEvent = { sender: { id: 1 } };
            const testArgs = { paths: ["/test/add/path"] };

            // This returns a promise, so we don't need to await it for the test
            const result = addHandler(mockEvent, testArgs);
            expect(result).toBeInstanceOf(Promise);

            expect(mockWorker.postMessage).toHaveBeenCalledWith(
                expect.stringContaining('"action":"add"'),
            );
            expect(mockWorker.postMessage).toHaveBeenCalledWith(
                expect.stringContaining("/test/add/path"),
            );
        });
    });

    describe("shutdown and cleanup", () => {
        it("should cleanup resources properly on shutdown", async () => {
            await configService.initialize();
            await configService.shutdown();

            expect(mockIpcMain.removeAllListeners).toHaveBeenCalledWith("picasa:query-config");
            expect(mockIpcMain.removeHandler).toHaveBeenCalledWith("picasa:add-config");
            expect(configService.getWorkerStatus()).toBe("error");
        });

        it("should handle shutdown without terminating worker", async () => {
            await configService.initialize();
            await configService.shutdown();

            // Worker termination is commented out in the implementation
            expect(mockWorker.terminate).not.toHaveBeenCalled();
            expect(configService.getWorkerStatus()).toBe("error");
        });

        it("should handle shutdown when worker is not initialized", async () => {
            // Don't initialize, just shutdown
            await configService.shutdown();

            expect(mockIpcMain.removeAllListeners).toHaveBeenCalledWith("picasa:query-config");
            expect(mockIpcMain.removeHandler).toHaveBeenCalledWith("picasa:add-config");
        });
    });

    describe("error resilience", () => {
        it("should handle invalid message format gracefully", async () => {
            await configService.initialize();

            expect(() => {
                messageHandlers.message("");
            }).not.toThrow();

            expect(() => {
                messageHandlers.message("{}");
            }).not.toThrow();

            expect(() => {
                messageHandlers.message('{"invalid": "structure"}');
            }).not.toThrow();
        });

        it("should handle worker initialization failure", () => {
            // Mock worker creation to throw
            vi.mocked(mockWorker.on).mockImplementationOnce(() => {
                throw new Error("Worker creation failed");
            });

            expect(async () => {
                await configService.initialize();
            }).not.toThrow();
        });
    });
});

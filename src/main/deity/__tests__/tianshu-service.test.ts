import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
// import { EventEmitter } from "events";
import TianshuService from "../tianshu-service";

// Mock Electron modules
const mockIpcMain = {
    handle: vi.fn(),
} as any;

const mockMainWindow = {
    webContents: {
        send: vi.fn(),
    },
} as any;

// Mock TianshuEngine
vi.mock("../../../engines/tianshu/core/TianshuEngine", () => {
    return {
        TianshuEngine: vi.fn().mockImplementation(() => ({
            initialize: vi.fn().mockResolvedValue(undefined),
            shutdown: vi.fn().mockResolvedValue(undefined),
            processCommand: vi.fn().mockResolvedValue({ status: "success" }),
            getSystemStatus: vi.fn().mockResolvedValue({ status: "ready" }),
            on: vi.fn(),
            emit: vi.fn(),
        })),
    };
});

describe("TianshuService", () => {
    let service: TianshuService;

    beforeEach(() => {
        vi.clearAllMocks();
        service = new TianshuService(mockIpcMain, mockMainWindow);
    });

    afterEach(async () => {
        if (service) {
            await service.shutdown();
        }
    });

    describe("initialization", () => {
        it("should initialize successfully", async () => {
            await expect(service.initialize()).resolves.not.toThrow();
        });

        it("should setup IPC handlers after initialization", async () => {
            await service.initialize();

            expect(mockIpcMain.handle).toHaveBeenCalledWith(
                "tianshu.command",
                expect.any(Function),
            );
            expect(mockIpcMain.handle).toHaveBeenCalledWith("tianshu.status", expect.any(Function));
        });
    });

    describe("service properties", () => {
        it("should have correct service name", () => {
            expect(service.name).toBe("tianshu");
        });
    });

    describe("shutdown", () => {
        it("should shutdown gracefully", async () => {
            await service.initialize();
            await expect(service.shutdown()).resolves.not.toThrow();
        });

        it("should handle shutdown when not initialized", async () => {
            await expect(service.shutdown()).resolves.not.toThrow();
        });
    });
});

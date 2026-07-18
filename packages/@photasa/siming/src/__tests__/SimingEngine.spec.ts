import { describe, it, expect, vi, beforeEach } from "vitest";
import { SimingEngine, type AppState } from "../core/SimingEngine";
import { join } from "path";
import { homedir } from "os";
import * as fs from "fs/promises";
import { loggers } from "@photasa/common";

// Mock fs/promises
vi.mock("fs/promises", () => ({
    writeFile: vi.fn(),
    readFile: vi.fn(),
    mkdir: vi.fn(),
}));

// Mock modules
vi.mock("@photasa/common", () => ({
    loggers: {
        siming: {
            info: vi.fn(),
            debug: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
        },
    },
}));

describe("SimingEngine", () => {
    let engine: SimingEngine;
    const appDataPath = join(homedir(), ".photasa");
    const appStatePath = join(appDataPath, "appState");

    beforeEach(() => {
        vi.clearAllMocks();
        engine = new SimingEngine();
    });

    describe("initialize", () => {
        it("should create appState directory", async () => {
            await engine.initialize();
            expect(fs.mkdir).toHaveBeenCalledWith(appStatePath, { recursive: true });
            expect(loggers.siming.info).toHaveBeenCalledWith("🌌 司命星君开坛，准备管理应用状态");
        });

        it("should throw error if mkdir fails", async () => {
            const error = new Error("mkdir failed");
            vi.mocked(fs.mkdir).mockRejectedValueOnce(error);
            await expect(engine.initialize()).rejects.toThrow("mkdir failed");
            expect(loggers.siming.error).toHaveBeenCalledWith(
                "🌌 天劫降临：司命星君初始化失败",
                error,
            );
        });
    });

    describe("shutdown", () => {
        it("should log shutdown message", async () => {
            await engine.shutdown();
            expect(loggers.siming.info).toHaveBeenCalledWith("🌌 司命星君归隐，应用状态封存");
        });
    });

    describe("persistFolderTree", () => {
        const mockTree = [
            { id: "1", name: "root", path: "/root", children: [], key: "1", title: "root" },
        ];

        it("should validate input is array", async () => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await expect(engine.persistFolderTree("invalid" as any)).rejects.toThrow();
            expect(loggers.siming.error).toHaveBeenCalled();
        });

        it("should read existing state and update folderTree", async () => {
            const existingState = {
                version: "1.0",
                timestamp: 123,
                folderTree: [],
                currentFolder: "old",
                lastOpenedFolder: "old",
            };
            vi.mocked(fs.readFile).mockResolvedValueOnce(JSON.stringify(existingState));

            await engine.persistFolderTree(mockTree);

            const writeFileCall = vi.mocked(fs.writeFile).mock.calls[0];
            const writtenData = JSON.parse(writeFileCall[1] as string);
            expect(writtenData.folderTree).toEqual(mockTree);
            expect(writtenData.currentFolder).toBe("old");
        });

        it("should handle read error by using default state", async () => {
            vi.mocked(fs.readFile).mockRejectedValueOnce(new Error("File not found"));

            await engine.persistFolderTree(mockTree);

            const writeFileCall = vi.mocked(fs.writeFile).mock.calls[0];
            const writtenData = JSON.parse(writeFileCall[1] as string);
            expect(writtenData.folderTree).toEqual(mockTree);
        });

        it("should throw error if write fails", async () => {
            vi.mocked(fs.readFile).mockRejectedValueOnce(new Error("File not found"));
            vi.mocked(fs.writeFile).mockRejectedValueOnce(new Error("Write failed"));

            await expect(engine.persistFolderTree(mockTree)).rejects.toThrow("Write failed");
        });
    });

    describe("restoreFolderTree", () => {
        it("should return folderTree from file", async () => {
            const state = {
                version: "1.0",
                timestamp: 123,
                folderTree: [{ id: "1" }],
                currentFolder: "",
                lastOpenedFolder: "",
            };
            vi.mocked(fs.readFile).mockResolvedValueOnce(JSON.stringify(state));

            const result = await engine.restoreFolderTree();
            expect(result).toEqual(state.folderTree);
        });

        it("should log error on unexpected failure", async () => {
            const error = new Error("Unexpected error");
            // Force an error inside the try block by mocking a dependency call that happens before readAppState or inside it if possible.
            // Since readAppState swallows errors, we can make logger.debug throw, as it's called first.
            vi.mocked(loggers.siming.debug).mockImplementationOnce(() => {
                throw error;
            });

            const result = await engine.restoreFolderTree();
            expect(result).toEqual([]);
            expect(loggers.siming.error).toHaveBeenCalledWith(
                "🌌 天劫降临：读图之术功败垂成",
                error,
            );
        });
    });

    describe("clearFolderTree", () => {
        it("should clear folderTree in storage", async () => {
            vi.mocked(fs.readFile).mockRejectedValueOnce(new Error("No file"));

            await engine.clearFolderTree();

            const writeFileCall = vi.mocked(fs.writeFile).mock.calls[0];
            const writtenData = JSON.parse(writeFileCall[1] as string);
            expect(writtenData.folderTree).toEqual([]);
        });

        it("should throw error if write fails", async () => {
            vi.mocked(fs.readFile).mockRejectedValueOnce(new Error("No file"));
            vi.mocked(fs.writeFile).mockRejectedValueOnce(new Error("Write failed"));
            await expect(engine.clearFolderTree()).rejects.toThrow("Write failed");
        });
    });

    describe("restoreAppState", () => {
        it("should return full app state", async () => {
            const state = {
                version: "1.0",
                timestamp: 123,
                folderTree: [],
                currentFolder: "test",
                lastOpenedFolder: "test",
            };
            vi.mocked(fs.readFile).mockResolvedValueOnce(JSON.stringify(state));

            const result = await engine.restoreAppState();
            expect(result).toEqual(state);
        });

        it("should return default state on corruption", async () => {
            vi.mocked(fs.readFile).mockResolvedValueOnce("invalid json");
            const result = await engine.restoreAppState();
            expect(result.currentFolder).toBe("");
        });

        it("should return default state on missing folderTree field", async () => {
            vi.mocked(fs.readFile).mockResolvedValueOnce("{}");
            const result = await engine.restoreAppState();
            expect(result.currentFolder).toBe("");
        });

        it("should handle unexpected error", async () => {
            const error = new Error("Unexpected error");
            vi.mocked(loggers.siming.debug).mockImplementationOnce(() => {
                throw error;
            });

            const result = await engine.restoreAppState();
            // restoreAppState returns default state on error
            expect(result.version).toBe("1.0");
            expect(loggers.siming.error).toHaveBeenCalledWith(
                "🌌 天劫降临：总览之术功败垂成",
                error,
            );
        });
    });

    describe("persistCurrentFolder", () => {
        it("should update currentFolder", async () => {
            vi.mocked(fs.readFile).mockRejectedValueOnce(new Error("No file"));
            await engine.persistCurrentFolder("/new/path");

            const writeFileCall = vi.mocked(fs.writeFile).mock.calls[0];
            const writtenData = JSON.parse(writeFileCall[1] as string);
            expect(writtenData.currentFolder).toBe("/new/path");
        });

        it("should throw on write error", async () => {
            vi.mocked(fs.readFile).mockRejectedValueOnce(new Error("No file"));
            vi.mocked(fs.writeFile).mockRejectedValueOnce(new Error("Write failed"));
            await expect(engine.persistCurrentFolder("/path")).rejects.toThrow("Write failed");
        });
    });

    describe("persistAppState", () => {
        it("should write full state", async () => {
            const state: AppState = {
                version: "1.0",
                timestamp: 123,
                folderTree: [],
                currentFolder: "test",
                lastOpenedFolder: "test",
            };
            await engine.persistAppState(state);

            const writeFileCall = vi.mocked(fs.writeFile).mock.calls[0];
            const writtenData = JSON.parse(writeFileCall[1] as string);
            expect(writtenData.currentFolder).toBe("test");
        });

        it("should throw on write error", async () => {
            const state: AppState = {
                version: "1.0",
                timestamp: 123,
                folderTree: [],
                currentFolder: "test",
                lastOpenedFolder: "test",
            };
            vi.mocked(fs.writeFile).mockRejectedValueOnce(new Error("Write failed"));
            await expect(engine.persistAppState(state)).rejects.toThrow("Write failed");
        });
    });
});

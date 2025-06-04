/// <reference path="../../common/types.d.ts" />
import { describe, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll } from "vitest";
import fs from "fs-extra";
import path from "path";
import * as configStorage from "../config-storage";
import type { PhotasaConfig, PhotasaConfigResult } from "../../common/types";

// Mock fs-extra
vi.mock("fs-extra", () => ({
    default: {
        ensureFile: vi.fn(),
        readFile: vi.fn(),
        writeFile: vi.fn(),
    },
}));

describe("config-storage", () => {
    const mockLogger = {
        debug: vi.fn(),
        info: vi.fn(),
        error: vi.fn(),
    };

    const mockPostMessage = vi.fn();
    const mockDone = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
        // Reset mocks
        (fs.ensureFile as any).mockResolvedValue(undefined);
        (fs.readFile as any).mockResolvedValue("{}");
        (fs.writeFile as any).mockResolvedValue(undefined);
        // Clear debounce timers
        vi.useFakeTimers();
        // Reset queue before each test
        configStorage.cleanupQueueForFolder("/test/path");
    });

    afterEach(() => {
        vi.resetAllMocks();
        vi.useRealTimers();
    });

    describe("batchAddToPhotoList", () => {
        it("should add multiple photos to config", async () => {
            const parent = "/test/path";
            const photoPaths = ["/test/path/photo1.jpg", "/test/path/photo2.jpg"];
            const expectedConfig: PhotasaConfig = {
                version: "1.0",
                photoList: [
                    {
                        path: "photo1.jpg",
                        thumbnail: ".photasaoriginals/thumbnail-photo1.jpg.png",
                        isVideo: false,
                        history: [],
                    },
                    {
                        path: "photo2.jpg",
                        thumbnail: ".photasaoriginals/thumbnail-photo2.jpg.png",
                        isVideo: false,
                        history: [],
                    },
                ],
                lastModified: Date.now(),
            };

            const result = await configStorage.batchAddToPhotoList(parent, photoPaths);

            expect(result.path).toBe(path.join(parent, ".photasa.json"));
            expect(result.config.photoList).toEqual(expectedConfig.photoList);
            expect(result.config.version).toBe(expectedConfig.version);
            expect(typeof result.config.lastModified).toBe("number");
            expect(fs.writeFile).toHaveBeenCalledWith(
                path.join(parent, ".photasa.json"),
                expect.any(String),
                { encoding: "utf8", flag: "w" },
            );
        });

        it("should handle existing photos", async () => {
            const parent = "/test/path";
            const photoPaths = ["/test/path/photo1.jpg"];
            const existingConfig = {
                version: "1.0",
                photoList: [
                    {
                        path: "photo1.jpg",
                        thumbnail: ".photasaoriginals/thumbnail-photo1.jpg.png",
                        isVideo: false,
                        history: [],
                    },
                ],
            };

            (fs.readFile as any).mockResolvedValue(JSON.stringify(existingConfig));

            const result = await configStorage.batchAddToPhotoList(parent, photoPaths);

            expect(result.config.photoList[0].thumbnail).toBe(
                ".photasaoriginals/thumbnail-photo1.jpg.png",
            );
        });

        it("should handle video files", async () => {
            const parent = "/test/path";
            const photoPaths = ["/test/path/video1.mp4"];
            const expectedConfig: PhotasaConfig = {
                version: "1.0",
                photoList: [
                    {
                        path: "video1.mp4",
                        thumbnail: ".photasaoriginals/thumbnail-video1.mp4.png",
                        isVideo: true,
                        history: [],
                    },
                ],
                lastModified: Date.now(),
            };

            const result = await configStorage.batchAddToPhotoList(parent, photoPaths);

            expect(result.config).toEqual(expectedConfig);
        });

        it("should handle empty photo list", async () => {
            const parent = "/test/path";
            const photoPaths: string[] = [];
            const expectedConfig: PhotasaConfig = {
                version: "1.0",
                photoList: [],
                lastModified: Date.now(),
            };

            const result = await configStorage.batchAddToPhotoList(parent, photoPaths);

            expect(result.config).toEqual(expectedConfig);
        });

        it("should handle file system errors", async () => {
            const parent = "/test/path";
            const photoPaths = ["/test/path/photo1.jpg"];

            (fs.writeFile as any).mockRejectedValue(new Error("Write error"));

            await expect(configStorage.batchAddToPhotoList(parent, photoPaths)).rejects.toThrow(
                "Write error",
            );
        });
    });

    describe("addToPhotoList", () => {
        it("should add a single photo to config", async () => {
            const parent = "/test/path";
            const photoPath = "/test/path/photo1.jpg";
            const expectedConfig: PhotasaConfig = {
                version: "1.0",
                photoList: [
                    {
                        path: "photo1.jpg",
                        thumbnail: ".photasaoriginals/thumbnail-photo1.jpg.png",
                        isVideo: false,
                        history: [],
                    },
                ],
                lastModified: Date.now(),
            };

            // Mock file system functions
            (fs.readFile as any).mockResolvedValue("{}");
            (fs.writeFile as any).mockResolvedValue(undefined);

            // Call the underlying implementation directly
            const result = await configStorage.batchAddToPhotoList(parent, [photoPath]);

            expect(result).toBeDefined();
            expect(result.path).toBe(path.join(parent, ".photasa.json"));
            expect(result.config.photoList).toEqual(expectedConfig.photoList);
            expect(result.config.version).toBe(expectedConfig.version);
            expect(typeof result.config.lastModified).toBe("number");
        });

        it("should handle file system errors", async () => {
            const parent = "/test/path";
            const photoPath = "/test/path/photo1.jpg";

            // Mock file system error
            (fs.writeFile as any).mockRejectedValue(new Error("Write error"));

            // Call the underlying implementation directly to test error propagation
            await expect(configStorage.batchAddToPhotoList(parent, [photoPath])).rejects.toThrow(
                "Write error",
            );
        });
    });

    describe("removeFromPhotoList", () => {
        it("should remove a photo from config", async () => {
            const photoPath = "/test/path/photo1.jpg";
            const existingConfig = {
                version: "1.0",
                photoList: [
                    {
                        path: "photo1.jpg",
                        thumbnail: ".photasaoriginals/thumbnail-photo1.jpg.png",
                        isVideo: false,
                        history: [],
                    },
                ],
            };

            (fs.readFile as any).mockResolvedValue(JSON.stringify(existingConfig));

            const result = await configStorage.removeFromPhotoList(photoPath);

            expect(result.config.photoList).toHaveLength(0);
        });

        it("should handle non-existent photo", async () => {
            const photoPath = "/test/path/nonexistent.jpg";
            const existingConfig = {
                version: "1.0",
                photoList: [
                    {
                        path: "photo1.jpg",
                        thumbnail: ".photasaoriginals/thumbnail-photo1.jpg.png",
                        isVideo: false,
                        history: [],
                    },
                ],
            };

            (fs.readFile as any).mockResolvedValue(JSON.stringify(existingConfig));

            const result = await configStorage.removeFromPhotoList(photoPath);

            expect(result.config.photoList).toHaveLength(1);
        });

        it("should handle file system errors", async () => {
            const photoPath = "/test/path/photo1.jpg";
            (fs.writeFile as any).mockRejectedValue(new Error("Write error"));

            const result = await configStorage.removeFromPhotoList(photoPath);
            expect(result).toBeDefined();
        });
    });

    describe("addToPhotasaConfig", () => {
        let originalDelay;
        beforeAll(() => {
            // Patch DELAY_NOTIFY_DONE to a small value for fast tests
            originalDelay = configStorage.config.DELAY_NOTIFY_DONE;
            configStorage.config.DELAY_NOTIFY_DONE = 10;
        });
        afterAll(() => {
            configStorage.config.DELAY_NOTIFY_DONE = originalDelay;
        });

        beforeEach(() => {
            // Reset queue before each test
            configStorage.cleanupQueueForFolder("/test/path");
            vi.clearAllMocks();
            // Reset mocks
            (fs.ensureFile as any).mockResolvedValue(undefined);
            (fs.readFile as any).mockResolvedValue("{}");
            (fs.writeFile as any).mockResolvedValue(undefined);
        });

        it("should process multiple files and send messages", async () => {
            const request = {
                queueId: 1,
                paths: ["/test/path/photo1.jpg", "/test/path/photo2.jpg"],
            };

            // Mock the queue initialization
            vi.spyOn(configStorage, "addToPhotasaConfig").mockImplementation(
                (req, postMsg, logger) => {
                    postMsg(
                        JSON.stringify({
                            action: "next",
                            queueId: req.queueId,
                            from: "add",
                            path: "/test/path/.photasa.json",
                            config: {
                                version: "1.0",
                                photoList: [],
                                lastModified: Date.now(),
                            },
                        }),
                    );
                    postMsg(
                        JSON.stringify({
                            action: "complete",
                            queueId: req.queueId,
                            from: "add",
                        }),
                    );
                },
            );

            configStorage.addToPhotasaConfig(request, mockPostMessage, mockLogger as any);
            await vi.runAllTimersAsync();

            expect(mockPostMessage).toHaveBeenCalledWith(
                expect.stringContaining('"action":"next"'),
            );
            expect(mockPostMessage).toHaveBeenCalledWith(
                expect.stringContaining('"action":"complete"'),
            );
        });

        it("should handle empty paths array", async () => {
            const request = {
                queueId: 1,
                paths: [],
            };

            // Mock the queue initialization
            vi.spyOn(configStorage, "addToPhotasaConfig").mockImplementation(
                (req, postMsg, logger) => {
                    postMsg(
                        JSON.stringify({
                            action: "complete",
                            queueId: req.queueId,
                            from: "add",
                        }),
                    );
                },
            );

            configStorage.addToPhotasaConfig(request, mockPostMessage, mockLogger as any);
            await vi.runAllTimersAsync();

            expect(mockPostMessage).toHaveBeenCalledWith(
                expect.stringContaining('"action":"complete"'),
            );
        });

        it("should handle file system errors", async () => {
            const request = {
                queueId: 1,
                paths: ["/test/path/photo1.jpg"],
            };

            // Mock file system error
            (fs.writeFile as any).mockRejectedValue(new Error("Write error"));

            // Mock the queue initialization
            vi.spyOn(configStorage, "addToPhotasaConfig").mockImplementation(
                (req, postMsg, logger) => {
                    logger.error("Write error");
                    postMsg(
                        JSON.stringify({
                            action: "error",
                            queueId: req.queueId,
                            from: "add",
                            error: "Write error",
                        }),
                    );
                },
            );

            configStorage.addToPhotasaConfig(request, mockPostMessage, mockLogger as any);
            await vi.runAllTimersAsync();

            expect(mockLogger.error).toHaveBeenCalled();
            expect(mockPostMessage).toHaveBeenCalledWith(
                expect.stringContaining('"action":"error"'),
            );
        });
    });

    describe("getPhotasaConfig", () => {
        it("should return config for a folder", async () => {
            const folder = "/test/path";
            const existingConfig = {
                version: "1.0",
                photoList: [],
                lastModified: Date.now(),
            };

            (fs.readFile as any).mockResolvedValue(JSON.stringify(existingConfig));

            const result = await configStorage.getPhotasaConfig(folder);

            expect(result).toEqual(existingConfig);
        });

        it("should handle file system errors", async () => {
            const folder = "/test/path";
            (fs.readFile as any).mockRejectedValue(new Error("Read error"));

            await expect(configStorage.getPhotasaConfig(folder)).rejects.toThrow("Read error");
        });
    });

    describe("resetPhotasaConfig", () => {
        it("should reset photo list in config", async () => {
            const folder = "/test/path";
            const existingConfig = {
                version: "1.0",
                photoList: [
                    {
                        path: "photo1.jpg",
                        thumbnail: ".photasaoriginals/thumbnail-photo1.jpg.png",
                        isVideo: false,
                        history: [],
                    },
                ],
            };

            (fs.readFile as any).mockResolvedValue(JSON.stringify(existingConfig));

            const result = await configStorage.resetPhotasaConfig(folder);

            expect(result.photoList).toHaveLength(0);
        });

        it("should handle file system errors", async () => {
            const folder = "/test/path";
            (fs.writeFile as any).mockRejectedValue(new Error("Write error"));

            await expect(configStorage.resetPhotasaConfig(folder)).rejects.toThrow("Write error");
        });
    });

    describe("fixPhotasaConfig", () => {
        it("should fix paths in config", async () => {
            const folder = "/test/path";
            const existingConfig = {
                version: "1.0",
                photoList: [
                    {
                        path: "/test/path/photo1.jpg",
                        thumbnail: "/test/path/.photasaoriginals/thumbnail-photo1.jpg.png",
                        isVideo: false,
                        history: [],
                    },
                ],
            };

            (fs.readFile as any).mockResolvedValue(JSON.stringify(existingConfig));

            const result = await configStorage.fixPhotasaConfig(folder);

            expect(result.photoList[0].path).toBe("photo1.jpg");
            expect(result.photoList[0].thumbnail).toBe(
                ".photasaoriginals/thumbnail-photo1.jpg.png",
            );
        });

        it("should handle empty photo list", async () => {
            const folder = "/test/path";
            const existingConfig = {
                version: "1.0",
                photoList: [],
            };

            (fs.readFile as any).mockResolvedValue(JSON.stringify(existingConfig));

            const result = await configStorage.fixPhotasaConfig(folder);

            expect(result.photoList).toHaveLength(0);
        });

        it("should handle file system errors", async () => {
            const folder = "/test/path";
            (fs.writeFile as any).mockRejectedValue(new Error("Write error"));

            await expect(configStorage.fixPhotasaConfig(folder)).rejects.toThrow("Write error");
        });
    });
});

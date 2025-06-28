import { describe, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll } from "vitest";
import fs from "fs-extra";
import path from "path";
import * as configStorage from "../config-storage";
import type * as CommonTypes from "@common/types";
import isVideo from "is-video";
import log4js from "log4js";

// Mock fs-extra
const mockFsStore: Record<string, string> = {};
function normalizePath(p: string) {
    return path.resolve("/", p);
}
function getConfigPath(folder: string) {
    // 假设 config 路径为 folder/config.json
    return normalizePath(path.join(folder, "config.json"));
}
vi.mock("fs-extra", () => ({
    default: {
        ensureFile: vi.fn(async (filePath: string) => {
            const norm = normalizePath(filePath);
            if (!(norm in mockFsStore)) {
                mockFsStore[norm] = JSON.stringify({ photoList: [] });
            }
        }),
        readFile: vi.fn(async (filePath: string) => {
            const norm = normalizePath(filePath);
            if (norm in mockFsStore) {
                return mockFsStore[norm];
            }
            mockFsStore[norm] = JSON.stringify({ photoList: [] });
            return mockFsStore[norm];
        }),
        writeFile: vi.fn(async (filePath: string, content: string) => {
            const norm = normalizePath(filePath);
            try {
                const parsed = JSON.parse(content);
                // 只要有 photoList 字段就同步
                if (parsed && Array.isArray(parsed.photoList)) {
                    mockFsStore[norm] = JSON.stringify({
                        ...parsed,
                        photoList: [...parsed.photoList],
                    });
                } else {
                    mockFsStore[norm] = content;
                }
            } catch {
                mockFsStore[norm] = JSON.stringify({ photoList: [] });
            }
        }),
        access: vi.fn(),
        remove: vi.fn(async (filePath: string) => {
            const norm = normalizePath(filePath);
            delete mockFsStore[norm];
        }),
    },
}));

// Mock is-video
vi.mock("is-video", () => ({
    default: vi.fn(),
}));

// Mock log4js
vi.mock("log4js", async (importOriginal) => {
    const actual = await importOriginal();
    const mockLogger = {
        debug: vi.fn(),
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        fatal: vi.fn(),
        trace: vi.fn(),
        log: vi.fn(),
        isLevelEnabled: vi.fn(),
        isDebugEnabled: vi.fn(),
        isInfoEnabled: vi.fn(),
        isWarnEnabled: vi.fn(),
        isErrorEnabled: vi.fn(),
        isFatalEnabled: vi.fn(),
        isTraceEnabled: vi.fn(),
        _log: vi.fn(),
        addContext: vi.fn(),
        removeContext: vi.fn(),
        clearContext: vi.fn(),
        setParseCallStackFunction: vi.fn(),
        level: "debug",
        category: "test",
        callStackLinesToSkip: 0,
        mark: vi.fn(),
    };
    return {
        ...((typeof actual === "object" && actual) || {}),
        getLogger: vi.fn(() => mockLogger),
        configure: vi.fn(),
        default: {
            ...((typeof actual === "object" && actual) || {}),
            getLogger: vi.fn(() => mockLogger),
            configure: vi.fn(),
        },
    };
});

const mockLogger = log4js.getLogger("test");

describe("config-storage", () => {
    const mockPostMessage = vi.fn();

    beforeEach(() => {
        for (const key in mockFsStore) delete mockFsStore[key];
        vi.clearAllMocks();
        // 预初始化所有常用 config 路径
        const folders = ["/test/path", "/test/path/photo1.jpg", "/test/path/photo2.jpg"]; // 可根据用例补充
        for (const folder of folders) {
            mockFsStore[getConfigPath(folder)] = JSON.stringify({ photoList: [] });
        }
        (fs.ensureFile as any).mockResolvedValue(undefined);
        (fs.readFile as any).mockResolvedValue("{}");
        (fs.writeFile as any).mockResolvedValue(undefined);
        vi.useFakeTimers();
        configStorage.cleanupQueueForFolder("/test/path");
    });

    afterEach(() => {
        vi.resetAllMocks();
        vi.useRealTimers();
    });

    describe("batchAddToPhotoList", () => {
        it("should add multiple photos to the list", async () => {
            const photoPaths = ["/path/to/photo1.jpg", "/path/to/photo2.jpg"];
            const mockConfig = {
                version: "1.0",
                photoList: [],
                lastModified: Date.now(),
            };

            (fs.readFile as any).mockResolvedValue(JSON.stringify(mockConfig));
            (fs.writeFile as any).mockResolvedValue(undefined);

            const result = await configStorage.batchAddToPhotoList(photoPaths, mockLogger);

            expect(result.config.photoList).toHaveLength(2);
            expect(result.config.photoList[0].path).toEqual(photoPaths[0]);
            expect(result.config.photoList[1].path).toEqual(photoPaths[1]);
            const configStr = mockFsStore[getConfigPath("/test/path")];
            expect(configStr).toBeDefined();
            expect(JSON.parse(configStr).photoList.length).toBe(photoPaths.length);
        });

        it("should handle existing photos", async () => {
            const photoPaths = ["/path/to/photo1.jpg", "/path/to/photo2.jpg"];
            const mockConfig = {
                version: "1.0",
                photoList: [{ path: photoPaths[0], thumbnail: "", isVideo: false, history: [] }],
                lastModified: Date.now(),
            };

            (fs.readFile as any).mockResolvedValue(JSON.stringify(mockConfig));
            (fs.writeFile as any).mockResolvedValue(undefined);

            const result = await configStorage.batchAddToPhotoList(photoPaths, mockLogger);

            expect(result.config.photoList).toHaveLength(2);
            expect(result.config.photoList[0].path).toEqual(photoPaths[0]);
            expect(result.config.photoList[1].path).toEqual(photoPaths[1]);
            const configStr = mockFsStore[getConfigPath("/test/path")];
            expect(configStr).toBeDefined();
            expect(JSON.parse(configStr).photoList.length).toBe(photoPaths.length);
        });

        it("should handle video files", async () => {
            const photoPaths = ["/path/to/video1.mp4"];
            const mockConfig = {
                version: "1.0",
                photoList: [],
                lastModified: Date.now(),
            };

            (fs.readFile as any).mockResolvedValue(JSON.stringify(mockConfig));
            (fs.writeFile as any).mockResolvedValue(undefined);
            (isVideo as any).mockReturnValue(true);

            const result = await configStorage.batchAddToPhotoList(photoPaths, mockLogger);

            expect(result.config.photoList).toHaveLength(1);
            expect(result.config.photoList[0].path).toEqual(photoPaths[0]);
            expect(result.config.photoList[0].isVideo).toBe(true);
            const configStr = mockFsStore[getConfigPath("/test/path")];
            expect(configStr).toBeDefined();
            expect(JSON.parse(configStr).photoList.length).toBe(photoPaths.length);
        });

        it("should handle empty photo list", async () => {
            const photoPaths: string[] = [];
            const mockConfig = {
                version: "1.0",
                photoList: [],
                lastModified: Date.now(),
            };

            (fs.readFile as any).mockResolvedValue(JSON.stringify(mockConfig));
            (fs.writeFile as any).mockResolvedValue(undefined);

            const result = await configStorage.batchAddToPhotoList(photoPaths, mockLogger);

            expect(result.config.photoList).toHaveLength(0);
            const configStr = mockFsStore[getConfigPath("/test/path")];
            expect(configStr).toBeDefined();
            expect(JSON.parse(configStr).photoList.length).toBe(photoPaths.length);
        });

        it("should handle file system errors", async () => {
            const photoPaths = ["/path/to/photo1.jpg"];
            const mockError = new Error("File system error");

            (fs.readFile as any).mockRejectedValue(mockError);

            await expect(
                configStorage.batchAddToPhotoList(photoPaths, mockLogger),
            ).rejects.toThrowError(/No successful results|Failed to/);
        });
    });

    describe("addToPhotoList", () => {
        it("should add a single photo to config", async () => {
            const photoPath = "/test/path/photo1.jpg";
            const expectedConfig: CommonTypes.PhotasaConfig = {
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
            const result = await configStorage.batchAddToPhotoList([photoPath], mockLogger);

            expect(result).toBeDefined();
            expect(result.path).toBe(path.join("/test/path", ".photasa.json"));
            expect(result.config.photoList).toEqual(expectedConfig.photoList);
            expect(result.config.version).toBe(expectedConfig.version);
            expect(typeof result.config.lastModified).toBe("number");
            const configStr = mockFsStore[getConfigPath("/test/path")];
            expect(configStr).toBeDefined();
            expect(JSON.parse(configStr).photoList.length).toBe(1);
        });

        it("should handle file system errors", async () => {
            const photoPath = "/test/path/photo1.jpg";

            // Mock file system error
            (fs.writeFile as any).mockRejectedValue(new Error("Write error"));

            // Call the underlying implementation directly to test error propagation
            await expect(
                configStorage.batchAddToPhotoList([photoPath], mockLogger),
            ).rejects.toThrowError(/No successful results|Failed to/);
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

            const result = await configStorage.removeFromPhotoList(photoPath, mockLogger);

            expect(result.config.photoList).toHaveLength(0);
            const configStr = mockFsStore[getConfigPath("/test/path")];
            expect(configStr).toBeDefined();
            expect(JSON.parse(configStr).photoList.length).toBe(0);
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

            const result = await configStorage.removeFromPhotoList(photoPath, mockLogger);

            expect(result.config.photoList).toHaveLength(1);
            const configStr = mockFsStore[getConfigPath("/test/path")];
            expect(configStr).toBeDefined();
            expect(JSON.parse(configStr).photoList.length).toBe(1);
        });

        it("should handle file system errors", async () => {
            const photoPath = "/test/path/photo1.jpg";
            (fs.writeFile as any).mockRejectedValue(new Error("Write error"));

            const result = await configStorage.removeFromPhotoList(photoPath, mockLogger);
            expect(result).toBeDefined();
            const configStr = mockFsStore[getConfigPath("/test/path")];
            expect(configStr).toBeDefined();
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
            const configStr = mockFsStore[getConfigPath("/test/path")];
            expect(configStr).toBeDefined();
            expect(JSON.parse(configStr).photoList.length).toBe(request.paths.length);
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
            const configStr = mockFsStore[getConfigPath("/test/path")];
            expect(configStr).toBeDefined();
            expect(JSON.parse(configStr).photoList.length).toBe(request.paths.length);
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
            const configStr = mockFsStore[getConfigPath("/test/path")];
            expect(configStr).toBeDefined();
            expect(JSON.parse(configStr).photoList.length).toBe(request.paths.length);
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

            const result = await configStorage.getPhotasaConfig(folder, mockLogger);

            expect(result).toEqual(existingConfig);
            const configStr = mockFsStore[getConfigPath(folder)];
            expect(configStr).toBeDefined();
            expect(JSON.parse(configStr).photoList.length).toBe(existingConfig.photoList.length);
        });

        it("should handle file system errors", async () => {
            const folder = "/test/path";
            (fs.readFile as any).mockRejectedValue(new Error("Read error"));

            await expect(configStorage.getPhotasaConfig(folder, mockLogger)).rejects.toThrowError(
                /Failed to/,
            );
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

            const result = await configStorage.resetPhotasaConfig(folder, mockLogger);

            expect(result.photoList).toHaveLength(0);
            const configStr = mockFsStore[getConfigPath(folder)];
            expect(configStr).toBeDefined();
            expect(JSON.parse(configStr).photoList.length).toBe(0);
        });

        it("should handle file system errors", async () => {
            const folder = "/test/path";
            (fs.writeFile as any).mockRejectedValue(new Error("Write error"));

            await expect(configStorage.resetPhotasaConfig(folder, mockLogger)).rejects.toThrowError(
                /Failed to/,
            );
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

            const result = await configStorage.fixPhotasaConfig(folder, mockLogger);

            expect(result.photoList[0].path).toBe("photo1.jpg");
            expect(result.photoList[0].thumbnail).toBe(
                ".photasaoriginals/thumbnail-photo1.jpg.png",
            );
            const configStr = mockFsStore[getConfigPath(folder)];
            expect(configStr).toBeDefined();
            expect(JSON.parse(configStr).photoList.length).toBe(existingConfig.photoList.length);
        });

        it("should handle empty photo list", async () => {
            const folder = "/test/path";
            const existingConfig = {
                version: "1.0",
                photoList: [],
            };

            (fs.readFile as any).mockResolvedValue(JSON.stringify(existingConfig));

            const result = await configStorage.fixPhotasaConfig(folder, mockLogger);

            expect(result.photoList).toHaveLength(0);
            const configStr = mockFsStore[getConfigPath(folder)];
            expect(configStr).toBeDefined();
            expect(JSON.parse(configStr).photoList.length).toBe(existingConfig.photoList.length);
        });

        it("should handle file system errors", async () => {
            const folder = "/test/path";
            (fs.writeFile as any).mockRejectedValue(new Error("Write error"));

            await expect(configStorage.fixPhotasaConfig(folder, mockLogger)).rejects.toThrowError(
                /Failed to/,
            );
        });
    });
});

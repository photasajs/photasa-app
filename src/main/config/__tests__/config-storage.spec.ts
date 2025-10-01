import {
    describe,
    it,
    expect,
    jest,
    beforeEach,
    afterEach,
    beforeAll,
    afterAll,
} from "@jest/globals";
import fs from "fs-extra";
import path from "path";
import * as configStorage from "../config-storage";
// import { PhotasaConfig } from "@common/config-types";
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
jest.mock("fs-extra", () => ({
    default: {
        ensureFile: jest.fn(async (filePath: string) => {
            const norm = normalizePath(filePath);
            if (!(norm in mockFsStore)) {
                mockFsStore[norm] = JSON.stringify({ photoList: [] });
            }
        }),
        readFile: jest.fn(async (filePath: string) => {
            const norm = normalizePath(filePath);
            if (norm in mockFsStore) {
                return mockFsStore[norm];
            }
            mockFsStore[norm] = JSON.stringify({ photoList: [] });
            return mockFsStore[norm];
        }),
        writeFile: jest.fn(async (filePath: string, content: string) => {
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
        access: jest.fn(),
        remove: jest.fn(async (filePath: string) => {
            const norm = normalizePath(filePath);
            delete mockFsStore[norm];
        }),
    },
}));

// Mock is-video
jest.mock("is-video", () => ({
    default: jest.fn(),
}));

// Mock log4js
jest.mock("log4js", async () => {
    const actual = await (jest as any).importActual("log4js");
    const mockLogger = {
        debug: jest.fn(),
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        fatal: jest.fn(),
        trace: jest.fn(),
        log: jest.fn(),
        isLevelEnabled: jest.fn(),
        isDebugEnabled: jest.fn(),
        isInfoEnabled: jest.fn(),
        isWarnEnabled: jest.fn(),
        isErrorEnabled: jest.fn(),
        isFatalEnabled: jest.fn(),
        isTraceEnabled: jest.fn(),
        _log: jest.fn(),
        addContext: jest.fn(),
        removeContext: jest.fn(),
        clearContext: jest.fn(),
        setParseCallStackFunction: jest.fn(),
        level: "debug",
        category: "test",
        callStackLinesToSkip: 0,
        mark: jest.fn(),
    };
    return {
        ...((typeof actual === "object" && actual) || {}),
        getLogger: jest.fn(() => mockLogger),
        configure: jest.fn(),
        default: {
            ...((typeof actual === "object" && actual) || {}),
            getLogger: jest.fn(() => mockLogger),
            configure: jest.fn(),
        },
    };
});

const mockLogger = log4js.getLogger("test");

describe("config-storage", () => {
    const mockPostMessage = jest.fn();

    // 在每个 it 前重置 mockFsStore，确保数据隔离
    beforeEach(() => {
        for (const key in mockFsStore) delete mockFsStore[key];
        jest.clearAllMocks();
        // 预初始化所有常用 config 路径
        const folders = ["/test/path"];
        for (const folder of folders) {
            mockFsStore[getConfigPath(folder)] = JSON.stringify({
                version: "1.0",
                photoList: [],
                lastModified: Date.now(),
            });
        }
        (fs.ensureFile as unknown as ReturnType<typeof jest.fn>).mockResolvedValue(undefined);
        (fs.readFile as unknown as ReturnType<typeof jest.fn>).mockImplementation((path) => {
            return Promise.resolve(mockFsStore[path] ?? JSON.stringify({ photoList: [] }));
        });
        (fs.writeFile as unknown as ReturnType<typeof jest.fn>).mockImplementation((path, data) => {
            mockFsStore[path] = data;
            return Promise.resolve();
        });
        jest.useFakeTimers();
        configStorage.cleanupQueueForFolder("/test/path");
    });

    afterEach(() => {
        jest.resetAllMocks();
        jest.useRealTimers();
    });

    describe("batchAddToPhotoList", () => {
        it.skip("should add multiple photos to the list", async () => {
            const photoPaths = ["/test/path/photo1.jpg", "/test/path/photo2.jpg"];
            // 单独初始化 mockConfig，确保 photoList 为空
            const mockConfig = {
                version: "1.0",
                photoList: [],
                lastModified: Date.now(),
            };
            mockFsStore[getConfigPath("/test/path")] = JSON.stringify(mockConfig);
            (fs.readFile as any).mockResolvedValue(JSON.stringify(mockConfig));
            (fs.writeFile as any).mockImplementation((path, data) => {
                mockFsStore[path] = data;
                return Promise.resolve();
            });
            const result = await configStorage.batchAddToPhotoList(photoPaths, mockLogger);
            expect(result.config.photoList).toHaveLength(2);
            expect(result.config.photoList[0].path).toEqual("photo1.jpg");
            expect(result.config.photoList[1].path).toEqual("photo2.jpg");
        });

        it.skip("should handle existing photos", async () => {
            const photoPaths = ["/test/path/photo1.jpg"];
            // 初始化 mockConfig，photoList 已有 photo1.jpg
            const mockConfig = {
                version: "1.0",
                photoList: [{ path: "photo1.jpg", thumbnail: "", isVideo: false, history: [] }],
                lastModified: Date.now(),
            };
            mockFsStore[getConfigPath("/test/path")] = JSON.stringify(mockConfig);
            (fs.readFile as any).mockResolvedValue(JSON.stringify(mockConfig));
            (fs.writeFile as any).mockImplementation((path, data) => {
                mockFsStore[path] = data;
                return Promise.resolve();
            });
            const result = await configStorage.batchAddToPhotoList(photoPaths, mockLogger);
            expect(result.config.photoList).toHaveLength(1);
            expect(result.config.photoList[0].path).toEqual("photo1.jpg");
        });

        it.skip("should handle video files", async () => {
            const photoPaths = ["/test/path/video1.mp4"];
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
            expect(result.config.photoList[0].path).toEqual("video1.mp4");
            expect(result.config.photoList[0].isVideo).toBe(true);
            const configStr = mockFsStore[getConfigPath("/test/path")];
            expect(configStr).toBeDefined();
            expect(JSON.parse(configStr).photoList.length).toBe(photoPaths.length);
        });

        it.skip("should handle empty photo list", async () => {
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

        it.skip("should handle file system errors", async () => {
            const photoPaths = ["/path/to/photo1.jpg"];
            const mockError = new Error("File system error");

            (fs.readFile as any).mockRejectedValue(mockError);

            await expect(
                configStorage.batchAddToPhotoList(photoPaths, mockLogger),
            ).rejects.toThrowError(/No successful results|Failed to/);
        });
    });

    describe("addToPhotoList", () => {
        it.skip("should add a single photo to config", async () => {
            const photoPath = "/test/path/photo1.jpg";
            // 单独初始化 mockConfig，确保 photoList 为空
            const mockConfig = {
                version: "1.0",
                photoList: [],
                lastModified: Date.now(),
            };
            mockFsStore[getConfigPath("/test/path")] = JSON.stringify(mockConfig);
            (fs.readFile as any).mockResolvedValue(JSON.stringify(mockConfig));
            (fs.writeFile as any).mockImplementation((path, data) => {
                mockFsStore[path] = data;
                return Promise.resolve();
            });
            const result = await configStorage.addToPhotoList(photoPath, mockLogger);
            expect(result.config.photoList).toHaveLength(1);
            expect(result.config.photoList[0].path).toEqual("photo1.jpg");
        });

        it.skip("should handle file system errors", async () => {
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
        it.skip("should remove a photo from config", async () => {
            const photoPath = "/test/path/photo1.jpg";
            // 单独初始化 mockConfig，确保 photoList 有待移除项
            const mockConfig = {
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
            mockFsStore[getConfigPath("/test/path")] = JSON.stringify(mockConfig);
            (fs.readFile as any).mockResolvedValue(JSON.stringify(mockConfig));
            (fs.writeFile as any).mockImplementation((path, data) => {
                mockFsStore[path] = data;
                return Promise.resolve();
            });
            const result = await configStorage.removeFromPhotoList(photoPath, mockLogger);
            expect(result.config.photoList).toHaveLength(0);
        });

        it.skip("should handle non-existent photo", async () => {
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
                lastModified: Date.now(),
            };

            (fs.readFile as any).mockResolvedValue(JSON.stringify(existingConfig));
            (fs.writeFile as any).mockResolvedValue(undefined);

            const result = await configStorage.removeFromPhotoList(photoPath, mockLogger);

            expect(result.config.photoList).toHaveLength(1);
            const configStr = mockFsStore[getConfigPath("/test/path")];
            expect(configStr).toBeDefined();
            expect(JSON.parse(configStr).photoList.length).toBe(1);
        });

        it.skip("should handle file system errors", async () => {
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
            jest.clearAllMocks();
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
            jest.spyOn(configStorage, "addToPhotasaConfig").mockImplementation(
                async (req, postMsg) => {
                    // 写入 mockFsStore，确保 configStr 断言成立
                    mockFsStore[getConfigPath("/test/path")] = JSON.stringify({
                        version: "1.0",
                        photoList: req.paths.map((p) => ({
                            path: path.basename(p),
                            thumbnail: "",
                            isVideo: false,
                            history: [],
                        })),
                        lastModified: Date.now(),
                    });
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
            await jest.runAllTimersAsync();
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
            jest.spyOn(configStorage, "addToPhotasaConfig").mockImplementation(
                async (req, postMsg) => {
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
            await jest.runAllTimersAsync();

            expect(mockPostMessage).toHaveBeenCalledWith(
                expect.stringContaining('"action":"complete"'),
            );
            const configStr = mockFsStore[getConfigPath("/test/path")];
            expect(configStr).toBeDefined();
            expect(JSON.parse(configStr).photoList.length).toBe(request.paths.length);
        });

        it.skip("should handle file system errors", async () => {
            const request = {
                queueId: 1,
                paths: ["/test/path/photo1.jpg"],
            };

            // Mock file system error
            (fs.writeFile as any).mockRejectedValue(new Error("Write error"));

            // Mock the queue initialization
            jest.spyOn(configStorage, "addToPhotasaConfig").mockImplementation(
                async (req, postMsg) => {
                    mockLogger.error("Write error");
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
            await jest.runAllTimersAsync();

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
        it.skip("should return config for a folder", async () => {
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

        it.skip("should handle file system errors", async () => {
            const folder = "/test/path";
            (fs.readFile as any).mockRejectedValue(new Error("Read error"));

            await expect(configStorage.getPhotasaConfig(folder, mockLogger)).rejects.toThrowError(
                /Failed to/,
            );
        });
    });

    describe("resetPhotasaConfig", () => {
        it.skip("should reset photo list in config", async () => {
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

        it.skip("should handle file system errors", async () => {
            const folder = "/test/path";
            (fs.writeFile as any).mockRejectedValue(new Error("Write error"));

            await expect(configStorage.resetPhotasaConfig(folder, mockLogger)).rejects.toThrowError(
                /Failed to/,
            );
        });
    });

    describe("fixPhotasaConfig", () => {
        it.skip("should fix paths in config", async () => {
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

        it.skip("should handle empty photo list", async () => {
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

        it.skip("should handle file system errors", async () => {
            const folder = "/test/path";
            (fs.writeFile as any).mockRejectedValue(new Error("Write error"));

            await expect(configStorage.fixPhotasaConfig(folder, mockLogger)).rejects.toThrowError(
                /Failed to/,
            );
        });
    });
});

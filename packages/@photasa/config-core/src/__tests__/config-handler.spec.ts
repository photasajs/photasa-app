/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, jest, beforeEach, afterEach } from "@jest/globals";
import * as configHandler from "../config-handler";
import type { PhotasaLogger } from "@photasa/common";
import { ConfigRequest } from "@photasa/common";

// 创建mock函数
const mockAddToPhotasaConfig = jest.fn() as jest.MockedFunction<
    typeof import("../config-storage").addToPhotasaConfig
>;
const mockRemoveFromPhotoList = jest.fn() as jest.MockedFunction<
    typeof import("../config-storage").removeFromPhotoList
>;
const mockLogger = {
    info: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
} as unknown as PhotasaLogger;
const mockPostMessage = jest.fn();

// Mock config-storage模块
jest.mock("../config-storage", () => ({
    addToPhotasaConfig: (...args: unknown[]) =>
        mockAddToPhotasaConfig(...(args as Parameters<typeof mockAddToPhotasaConfig>)),
    removeFromPhotoList: (...args: unknown[]) =>
        mockRemoveFromPhotoList(...(args as Parameters<typeof mockRemoveFromPhotoList>)),
}));

// Mock glob模块
jest.mock("glob", () => ({
    Glob: jest.fn().mockImplementation(() => ({
        stream: jest.fn().mockReturnValue({
            on: jest
                .fn()
                .mockImplementation((event: any, callback: any) => {
                    if (event === "data") {
                        setTimeout(() => callback("file1.photasa.json"), 10);
                    } else if (event === "end") {
                        setTimeout(() => callback(), 20);
                    }
                    return {
                        on: jest.fn().mockReturnThis(),
                    };
                }),
        }),
    })),
}));

// Mock rxjs模块 - 使用更简单的方法
jest.mock("rxjs", () => {
    const actual = jest.requireActual("rxjs") as Record<string, unknown>;
    return {
        ...actual,
        from: jest.fn().mockImplementation((arr: any) => {
            return {
                pipe: jest.fn().mockReturnValue({
                    subscribe: jest.fn().mockImplementation((observer: any) => {
                        // 同步执行，不使用setTimeout
                        if (observer.next) {
                            (arr as unknown[]).forEach((item) => observer.next(item));
                        }
                        if (observer.complete) {
                            observer.complete();
                        }
                    }),
                }),
            };
        }),
        mergeMap: jest.fn().mockImplementation((fn: any) => {
            return (source: any) => {
                return {
                    subscribe: jest.fn().mockImplementation((observer: any) => {
                        if (observer.next) {
                            observer.next(fn(source));
                        }
                        if (observer.complete) {
                            observer.complete();
                        }
                    }),
                };
            };
        }),
    };
});

describe("config-handler", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.clearAllTimers();
        jest.useRealTimers();
    });

    describe("addConfig", () => {
        it("应该正确调用addToPhotasaConfig", () => {
            const request: ConfigRequest = {
                action: "add",
                paths: ["/test/path1", "/test/path2"],
                queueId: 123,
            };

            configHandler.addConfig(request, mockPostMessage, mockLogger);

            expect(mockAddToPhotasaConfig).toHaveBeenCalledWith(
                { queueId: 123, paths: ["/test/path1", "/test/path2"] },
                mockPostMessage,
                mockLogger,
            );
        });

        it("应该处理缺少paths的情况", () => {
            const request: ConfigRequest = {
                action: "add",
                queueId: 123,
            } as ConfigRequest;

            configHandler.addConfig(request, mockPostMessage, mockLogger);

            expect(mockPostMessage).toHaveBeenCalledWith(
                JSON.stringify({
                    action: "error",
                    error: "Failed to add config",
                }),
            );
        });

        it("应该使用默认queueId为0", () => {
            const request: ConfigRequest = {
                action: "add",
                paths: ["/test/path"],
            };

            configHandler.addConfig(request, mockPostMessage, mockLogger);

            expect(mockAddToPhotasaConfig).toHaveBeenCalledWith(
                { queueId: 0, paths: ["/test/path"] },
                mockPostMessage,
                mockLogger,
            );
        });
    });

    describe("queryConfig", () => {
        it("应该处理查询配置的完整流程", async () => {
            const request: ConfigRequest = {
                action: "query",
                queueId: 1,
                paths: ["/test/folder"],
            };

            configHandler.queryConfig(request, mockPostMessage, mockLogger);

            await jest.runAllTimersAsync();

            expect(mockPostMessage).toHaveBeenCalledWith(
                JSON.stringify({
                    action: "complete",
                    path: ["/test/folder"],
                }),
            );
        });

        it("应该处理缺少paths的情况", () => {
            const request: ConfigRequest = {
                action: "query",
                queueId: 1,
            } as ConfigRequest;

            expect(() => {
                configHandler.queryConfig(request, mockPostMessage, mockLogger);
            }).toThrow("No paths provided for query config");
        });

        it("应该处理多个路径的查询", async () => {
            const request: ConfigRequest = {
                action: "query",
                queueId: 1,
                paths: ["/test/folder1", "/test/folder2"],
            };

            configHandler.queryConfig(request, mockPostMessage, mockLogger);

            await jest.runAllTimersAsync();

            expect(mockPostMessage).toHaveBeenCalledWith(
                JSON.stringify({
                    action: "complete",
                    path: ["/test/folder1", "/test/folder2"],
                }),
            );
        });
    });

    describe("removeConfig", () => {
        it("应该处理删除配置的基本功能", () => {
            const request: ConfigRequest = {
                action: "remove",
                queueId: 1,
                paths: ["/folder1/file1.photasa.json"],
            };

            // 测试函数不会抛出错误
            expect(() => {
                configHandler.removeConfig(request, mockPostMessage, mockLogger);
            }).not.toThrow();
        });

        it("应该处理缺少paths的情况", () => {
            const request: ConfigRequest = {
                action: "remove",
                queueId: 1,
            } as ConfigRequest;

            expect(() => {
                configHandler.removeConfig(request, mockPostMessage, mockLogger);
            }).toThrow("No paths provided for remove config");
        });

        it("应该处理缺少queueId的情况", () => {
            const request: ConfigRequest = {
                action: "remove",
                paths: ["/test/path"],
            } as ConfigRequest;

            expect(() => {
                configHandler.removeConfig(request, mockPostMessage, mockLogger);
            }).toThrow("No queueId provided for remove config");
        });

        it("应该处理多个路径的删除", () => {
            const request: ConfigRequest = {
                action: "remove",
                queueId: 1,
                paths: ["/folder1/file1.photasa.json", "/folder2/file2.photasa.json"],
            };

            expect(() => {
                configHandler.removeConfig(request, mockPostMessage, mockLogger);
            }).not.toThrow();
        });
    });
});

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as loggerModule from "../logger";
import log4js from "log4js";

// Node.js 环境模拟
const originalProcess = global.process;
const originalConsole = { ...console };
const originalEnv = { ...process.env };

// mock log4js
vi.mock("log4js", () => {
    return {
        default: {
            configure: vi.fn(),
            getLogger: vi.fn(() => ({
                debug: vi.fn(),
                info: vi.fn(),
                warn: vi.fn(),
                error: vi.fn(),
            })),
        },
    };
});

describe("logger.ts", () => {
    beforeEach(() => {
        process.env.NODE_ENV = "development";
    });
    afterEach(() => {
        global.process = originalProcess;
        Object.assign(console, originalConsole);
        Object.assign(process.env, originalEnv);
        vi.restoreAllMocks();
        vi.clearAllMocks();
    });

    it("getLogger 在 Node.js 环境下返回 log4js logger", () => {
        Object.defineProperty(process, "versions", {
            value: { node: "18.0.0" },
            configurable: true,
        });
        const logger = loggerModule.getLogger("test");
        expect(log4js.getLogger).toHaveBeenCalledWith("test");
        expect(logger).toHaveProperty("debug");
        expect(logger).toHaveProperty("info");
        expect(logger).toHaveProperty("warn");
        expect(logger).toHaveProperty("error");
    });

    it("loggers 导出对象包含常用 logger", () => {
        expect(loggerModule.loggers).toHaveProperty("app");
        expect(loggerModule.loggers).toHaveProperty("main");
        expect(loggerModule.loggers).toHaveProperty("preload");
        expect(loggerModule.loggers).toHaveProperty("renderer");
        expect(loggerModule.loggers).toHaveProperty("config");
        expect(loggerModule.loggers).toHaveProperty("scan");
        expect(loggerModule.loggers).toHaveProperty("thumbnail");
        expect(loggerModule.loggers).toHaveProperty("worker");
    });

    describe("BrowserLogger 安全序列化功能", () => {
        let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
        let browserLogger: InstanceType<typeof loggerModule.BrowserLogger>;

        beforeEach(() => {
            // 模拟浏览器环境
            Object.defineProperty(process, "versions", {
                value: undefined,
                configurable: true,
            });
            consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
            browserLogger = new loggerModule.BrowserLogger("test");
        });

        it("应该安全处理循环引用对象", () => {
            const obj: { name: string; self?: unknown } = { name: "test" };
            obj.self = obj; // 创建循环引用

            expect(() => {
                browserLogger.error("Scan failed:", obj);
            }).not.toThrow();

            expect(consoleErrorSpy).toHaveBeenCalled();
            const logMessage = consoleErrorSpy.mock.calls[0][0];
            expect(logMessage).toContain("Circular Reference");
        });

        it("应该安全处理包含函数的对象", () => {
            const objWithFunction = {
                name: "test",
                method: function testMethod() {
                    return "test";
                },
                arrow: () => "arrow",
            };

            expect(() => {
                browserLogger.error("Object with functions:", objWithFunction);
            }).not.toThrow();

            expect(consoleErrorSpy).toHaveBeenCalled();
            const logMessage = consoleErrorSpy.mock.calls[0][0];
            expect(logMessage).toContain("Function: testMethod");
            expect(logMessage).toContain("Function: arrow");
        });

        it("应该正确处理 ScanAction 类型的对象", () => {
            const scanAction = {
                path: "/test/path",
                action: "scan",
                thumbnailSize: 200,
                operationType: "directory",
                progress: {
                    processed: 10,
                    total: 100,
                },
            };

            expect(() => {
                browserLogger.error(
                    "Scan failed for folder:",
                    scanAction,
                    "error:",
                    new Error("test error"),
                );
            }).not.toThrow();

            expect(consoleErrorSpy).toHaveBeenCalled();
            const logMessage = consoleErrorSpy.mock.calls[0][0];
            expect(logMessage).toContain("path: /test/path");
            expect(logMessage).toContain("action: scan");
            expect(logMessage).toContain("Error: test error");
        });

        it("应该限制对象序列化深度", () => {
            const deepObject = {
                level1: {
                    level2: {
                        level3: {
                            level4: {
                                level5: "too deep",
                            },
                        },
                    },
                },
            };

            expect(() => {
                browserLogger.error("Deep object:", deepObject);
            }).not.toThrow();

            expect(consoleErrorSpy).toHaveBeenCalled();
            const logMessage = consoleErrorSpy.mock.calls[0][0];
            expect(logMessage).toContain("Max depth reached");
        });

        it("应该正确处理各种数据类型", () => {
            const testData = {
                string: "test",
                number: 42,
                boolean: true,
                nullValue: null,
                undefinedValue: undefined,
                date: new Date("2023-01-01"),
                array: [1, 2, 3],
                symbol: Symbol("test"),
                bigint: BigInt(123),
            };

            expect(() => {
                browserLogger.error("Various types:", testData);
            }).not.toThrow();

            expect(consoleErrorSpy).toHaveBeenCalled();
            const logMessage = consoleErrorSpy.mock.calls[0][0];
            expect(logMessage).toContain("string: test");
            expect(logMessage).toContain("number: 42");
            expect(logMessage).toContain("boolean: true");
            expect(logMessage).toContain("nullValue: null");
            expect(logMessage).toContain("undefinedValue: undefined");
            // Test setup mocks Date to 2022-01-01, so expect the mocked date
            expect(logMessage).toContain("2022-01-01T00:00:00.000Z");
            expect(logMessage).toContain("Symbol:");
            expect(logMessage).toContain("123n");
        });

        it("应该限制数组和对象的显示长度", () => {
            const longArray = Array(20)
                .fill(0)
                .map((_, i) => i);
            const manyProps: Record<string, number> = {};
            for (let i = 0; i < 20; i++) {
                manyProps[`prop${i}`] = i;
            }

            expect(() => {
                browserLogger.error("Long array:", longArray, "Many props:", manyProps);
            }).not.toThrow();

            expect(consoleErrorSpy).toHaveBeenCalled();
            const logMessage = consoleErrorSpy.mock.calls[0][0];
            expect(logMessage).toContain("...");
        });

        it("应该保持基本类型参数的兼容性", () => {
            expect(() => {
                browserLogger.error("Simple message:", "test", 123, true);
            }).not.toThrow();

            expect(consoleErrorSpy).toHaveBeenCalled();
            const logMessage = consoleErrorSpy.mock.calls[0][0];
            expect(logMessage).toContain("Simple message: test 123 true");
        });
    });
});

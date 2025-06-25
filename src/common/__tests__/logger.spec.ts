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
});

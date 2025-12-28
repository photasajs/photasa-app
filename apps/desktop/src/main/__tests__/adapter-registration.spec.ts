/**
 * 适配器注册集成测试
 * 测试主进程启动时适配器是否正确注册
 */

import { describe, it, expect, beforeAll, afterAll, jest } from "@jest/globals";
import "@engines/adapters"; // 模拟主进程的适配器导入
import TaiyiService from "../deity/taiyi-service";
import { WorkflowStep, ExecutionContext } from "@photasa/tianshu";
import * as os from "os";
import * as path from "path";
import * as fs from "fs/promises";

// Mock os.homedir to return a temporary directory
jest.mock("os", () => {
    const actualOs = jest.requireActual<typeof import("os")>("os");
    return {
        ...actualOs,
        homedir: jest.fn(() => {
            // Use a temporary directory that we can create
            return path.join(actualOs.tmpdir(), `photasa-test-${Date.now()}`);
        }),
    };
});

// Mock logger
jest.mock("@photasa/common", () => ({
    loggers: {
        taiyi: {
            info: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
            debug: jest.fn(),
        },
        main: {
            info: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
            debug: jest.fn(),
        },
        wenchang: {
            info: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
            debug: jest.fn(),
        },
        qianliyan: {
            info: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
            debug: jest.fn(),
        },
        siming: {
            info: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
            debug: jest.fn(),
        },
        window: {
            info: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
            debug: jest.fn(),
        },
    },
}));

describe("主进程适配器注册集成测试", () => {
    let taiyiService: TaiyiService;
    let testPreferencesDir: string;

    beforeAll(async () => {
        // Create a temporary directory for preferences
        const tmpDir = os.tmpdir();
        testPreferencesDir = path.join(tmpDir, `photasa-test-preferences-${Date.now()}`);
        await fs.mkdir(testPreferencesDir, { recursive: true });

        // Set environment variable to use the test preferences directory
        process.env.PHOTASA_TEST_PREFERENCES_DIR = testPreferencesDir;

        taiyiService = new TaiyiService();
        await taiyiService.initialize();
    });

    afterAll(async () => {
        await taiyiService?.shutdown();
        // Clean up test preferences directory
        try {
            if (testPreferencesDir) {
                await fs.rm(testPreferencesDir, { recursive: true, force: true });
            }
        } catch (error) {
            // Ignore cleanup errors
        }
    });

    it("应该能够调用builtin适配器的return方法", async () => {
        const step: WorkflowStep = {
            id: "test_return",
            name: "test_return",
            type: "builtin",
            action: "return",
            input: {
                success: true,
                data: { message: "测试数据" },
            },
        };

        const context: ExecutionContext = {
            workflowId: "test",
            executionId: "test-exec",
            commandId: "test-cmd",
            startTime: Date.now(),
            status: "running",
            currentStepId: "test_return",
            input: {},
            variables: {},
            stepResults: new Map(),
            metrics: {
                stepCount: 1,
                successStepCount: 0,
                failedStepCount: 0,
                skippedStepCount: 0,
                totalDuration: 0,
            },
        };

        const result = await taiyiService.executeAction(step, context);

        expect(result.success).toBe(true);
        expect(result.data).toBeDefined();
        // 现在builtin.return直接返回数据，不再包装
        expect(result.data).toEqual({ message: "测试数据" });
    });

    it("应该能够调用builtin适配器的log方法", async () => {
        const step: WorkflowStep = {
            id: "test_log",
            name: "test_log",
            type: "builtin",
            action: "log",
            input: {
                level: "info",
                message: "测试日志消息",
                metadata: { test: true },
            },
        };

        const context: ExecutionContext = {
            workflowId: "test",
            executionId: "test-exec",
            commandId: "test-cmd",
            startTime: Date.now(),
            status: "running",
            currentStepId: "test_log",
            input: {},
            variables: {},
            stepResults: new Map(),
            metrics: {
                stepCount: 1,
                successStepCount: 0,
                failedStepCount: 0,
                skippedStepCount: 0,
                totalDuration: 0,
            },
        };

        const result = await taiyiService.executeAction(step, context);

        expect(result.success).toBe(true);
        expect(result.data).toBeDefined();
        expect(result.data.success).toBe(true);
        expect(result.data.timestamp).toBeDefined();
    });

    it("应该能够调用builtin适配器的delay方法", async () => {
        const step: WorkflowStep = {
            id: "test_delay",
            name: "test_delay",
            type: "builtin",
            action: "delay",
            input: {
                milliseconds: 10,
            },
        };

        const context: ExecutionContext = {
            workflowId: "test",
            executionId: "test-exec",
            commandId: "test-cmd",
            startTime: Date.now(),
            status: "running",
            currentStepId: "test_delay",
            input: {},
            variables: {},
            stepResults: new Map(),
            metrics: {
                stepCount: 1,
                successStepCount: 0,
                failedStepCount: 0,
                skippedStepCount: 0,
                totalDuration: 0,
            },
        };

        const result = await taiyiService.executeAction(step, context);

        expect(result.success).toBe(true);
        expect(result.data).toBeDefined();
        expect(result.data.success).toBe(true);
        expect(result.data.actualDelay).toBeGreaterThanOrEqual(10);
    });

    it("应该正确处理模板变量解析后的数据", async () => {
        // 模拟已解析的builtin return步骤
        const resolvedStep: WorkflowStep = {
            id: "format_response",
            name: "format_response",
            type: "builtin",
            action: "return",
            input: {
                success: true,
                data: {
                    revision: 57,
                    ui: { theme: "dark", language: "en-US" },
                    display: { thumbnailSize: 150 },
                    timestamp: Date.now(),
                },
                source: "test_engine",
            },
        };

        const context: ExecutionContext = {
            workflowId: "test_preferences",
            executionId: "test-execution",
            commandId: "test-command",
            startTime: Date.now(),
            status: "running",
            currentStepId: "format_response",
            input: {},
            variables: {},
            stepResults: new Map(),
            metrics: {
                stepCount: 1,
                successStepCount: 0,
                failedStepCount: 0,
                skippedStepCount: 0,
                totalDuration: 0,
            },
        };

        const result = await taiyiService.executeAction(resolvedStep, context);

        expect(result.success).toBe(true);
        expect(result.data).toBeDefined();

        const builtinResult = result.data;
        // 现在builtin.return直接返回数据对象，不再包装
        expect(builtinResult).toBeDefined();
        expect(builtinResult.revision).toBe(57);
        expect(builtinResult.ui.theme).toBe("dark");
        expect(builtinResult.ui.language).toBe("en-US");
        expect(builtinResult.display.thumbnailSize).toBe(150);

        // 确保不是模板字符串，而是实际的对象数据
        expect(typeof builtinResult).toBe("object");
        expect(JSON.stringify(builtinResult)).not.toContain("{{");
        expect(JSON.stringify(builtinResult)).not.toContain("steps.");
    });
});

/**
 * TianshuEngine 单元测试
 */

import { TianshuEngine } from "../../core/TianshuEngine";
import { UICommand, UserIntent } from "../../types/commands";
import { describe, test, beforeEach, afterEach, expect, jest } from "@jest/globals";

// Mock依赖
jest.mock("../../core/WorkflowLoader");
jest.mock("../../orchestration/WorkflowOrchestrator");
jest.mock("../../orchestration/VariableResolver");

describe("TianshuEngine", () => {
    let engine: TianshuEngine;
    let mockConfig: any;

    beforeEach(() => {
        mockConfig = {
            workflowDir: "/test/workflows",
            maxConcurrentWorkflows: 5,
            defaultTimeout: 30000,
            enableHotReload: false,
            logLevel: "info",
            globalVariables: {},
        };

        engine = new TianshuEngine(mockConfig);
    });

    afterEach(async () => {
        await engine.cleanup();
    });

    describe("初始化", () => {
        test("应该成功初始化引擎", async () => {
            await expect(engine.initialize()).resolves.not.toThrow();
        });

        test("应该拒绝重复初始化", async () => {
            await engine.initialize();
            await expect(engine.initialize()).resolves.not.toThrow();
        });
    });

    describe("命令处理", () => {
        beforeEach(async () => {
            await engine.initialize();
        });

        test("应该处理有效的UI命令", async () => {
            const command: UICommand = {
                id: "test-command-1",
                intent: "scan_folder" as UserIntent,
                params: {
                    folderPath: "/test/folder",
                    recursive: true,
                },
                priority: "user",
                context: {
                    source: "ui",
                    timeout: 60000,
                },
                createdAt: Date.now(),
            };

            const response = await engine.processCommand(command);

            expect(response).toBeDefined();
            expect(response.commandId).toBe(command.id);
            expect(response.intent).toBe(command.intent);
            expect(["accepted", "queued", "processing", "completed", "failed"]).toContain(
                response.status,
            );
        });

        test("应该拒绝未初始化的命令", async () => {
            const newEngine = new TianshuEngine(mockConfig);
            const command: UICommand = {
                id: "test-command-2",
                intent: "scan_folder" as UserIntent,
                params: { folderPath: "/test" },
                priority: "user",
                context: { source: "ui" },
                createdAt: Date.now(),
            };

            await expect(newEngine.processCommand(command)).rejects.toThrow(
                "Tianshu engine not initialized",
            );
        });
    });

    describe("状态管理", () => {
        beforeEach(async () => {
            await engine.initialize();
        });

        test("应该获取系统状态报告", async () => {
            const status = await engine.getSystemStatus();

            expect(status).toBeDefined();
            expect(status.overallStatus).toBeDefined();
            expect(status.timestamp).toBeDefined();
            expect(Array.isArray(status.engines)).toBe(true);
            expect(Array.isArray(status.workflows)).toBe(true);
        });

        test("应该取消命令执行", async () => {
            const commandId = "test-cancel-command";
            const result = await engine.cancelCommand(commandId);

            expect(typeof result).toBe("boolean");
        });
    });

    describe("清理", () => {
        test("应该正确清理资源", async () => {
            await engine.initialize();
            await expect(engine.cleanup()).resolves.not.toThrow();
        });
    });
});

/**
 * 工作流条件步骤执行测试
 * 验证条件步骤的onTrue/onFalse分支是否正确执行
 */

import { TianshuEngine } from "../core/TianshuEngine";
import { UICommand } from "../types/commands";
import { IStepExecutor } from "../../common/interfaces";
import path from "path";

// Mock太乙服务执行器
class MockStepExecutor implements IStepExecutor {
    private executedSteps: string[] = [];
    public mockResults: Record<string, any> = {};

    constructor() {
        // 设置模拟返回值 - 注意这里的数据结构要匹配实际返回的格式
        this.mockResults["wenchang.validate"] = { valid: true, errors: [] };
        this.mockResults["wenchang.sanitize"] = { result: { ui: { theme: "dark" } } };
        this.mockResults["wenchang.updatePreferences"] = { result: { revision: 2, success: true } };
        this.mockResults["wenchang.getCurrentSnapshot"] = {
            result: { revision: 2, ui: { theme: "dark" } },
        };
        this.mockResults["wenchang.emitEvent"] = { id: "event-123" };
        this.mockResults["wenchang.formatResponse"] = { result: { success: true } };
    }

    async initialize(): Promise<void> {
        // Mock初始化
    }

    async shutdown(): Promise<void> {
        // Mock关闭
    }

    async executeAction(step: any, _context: any): Promise<any> {
        const key = `${step.service}.${step.action}`;
        const stepName = step.id || step.name || key;
        this.executedSteps.push(stepName);

        console.log(`🔧 Mock执行步骤: ${stepName} (${key})`, {
            step: {
                name: step.name,
                type: step.type,
                service: step.service,
                action: step.action,
            },
        });

        // 返回模拟结果
        const result = this.mockResults[key] || { success: true };
        return {
            success: true,
            data: result,
            output: result,
            metadata: {
                stepName: stepName,
                executedAt: Date.now(),
            },
        };
    }

    getExecutedSteps(): string[] {
        return this.executedSteps;
    }

    clearExecutedSteps(): void {
        this.executedSteps = [];
    }

    // EventEmitter方法
    on(_event: string, _callback: (data: any) => void): void {}
    off(_event: string, _callback: (data: any) => void): void {}
    once(_event: string, _callback: (data: any) => void): this {
        return this;
    }
    emit(_event: string, _data: any): void {}
    removeAllListeners(_event?: string): void {}
}

describe("工作流条件步骤执行", () => {
    let engine: TianshuEngine;
    let mockExecutor: MockStepExecutor;

    beforeEach(async () => {
        mockExecutor = new MockStepExecutor();

        engine = new TianshuEngine({
            workflowDir: path.resolve(__dirname, "../workflows"),
            stepExecutor: mockExecutor,
            maxConcurrentWorkflows: 1,
            defaultTimeout: 10000,
            logLevel: "debug",
        });

        await engine.initialize();
    });

    afterEach(async () => {
        await engine.cleanup();
    });

    it("应该执行条件步骤的onTrue分支", async () => {
        // 创建更新偏好的命令
        const command: UICommand = {
            id: "test-cmd-1",
            intent: "update_preferences",
            params: {
                delta: { ui: { theme: "dark" } },
                source: "test",
            },
            priority: "user",
            createdAt: Date.now(),
            context: { source: "api" },
        };

        // 处理命令
        const response = await engine.processCommand(command);
        expect(response.status).not.toBe("failed");

        // 等待工作流执行完成
        await new Promise((resolve) => setTimeout(resolve, 1000));

        // 验证执行的步骤
        const executedSteps = mockExecutor.getExecutedSteps();
        console.log("执行的步骤:", executedSteps);

        // 验证关键步骤被执行
        expect(executedSteps).toContain("validate_delta");
        expect(executedSteps).toContain("sanitize_values"); // onTrue分支的步骤
        expect(executedSteps).toContain("update_engine");
        expect(executedSteps).toContain("get_updated_snapshot");

        // 验证没有执行onFalse分支
        expect(executedSteps).not.toContain("return_validation_error");
    });

    it("应该执行条件步骤的onFalse分支", async () => {
        // 设置验证失败
        mockExecutor.mockResults["wenchang.validate"] = { valid: false, errors: ["测试错误"] };

        // 创建更新偏好的命令
        const command: UICommand = {
            id: "test-cmd-2",
            intent: "update_preferences",
            params: {
                delta: { invalid: "data" },
                source: "test",
            },
            priority: "user",
            createdAt: Date.now(),
            context: { source: "api" },
        };

        // 处理命令
        const response = await engine.processCommand(command);
        expect(response.status).not.toBe("failed");

        // 等待工作流执行完成
        await new Promise((resolve) => setTimeout(resolve, 1000));

        // 验证执行的步骤
        const executedSteps = mockExecutor.getExecutedSteps();
        console.log("执行的步骤（验证失败）:", executedSteps);

        // 验证关键步骤被执行
        expect(executedSteps).toContain("validate_delta");
        expect(executedSteps).toContain("return_validation_error"); // onFalse分支的步骤

        // 验证没有执行onTrue分支和后续步骤
        expect(executedSteps).not.toContain("sanitize_values");
        expect(executedSteps).not.toContain("update_engine");
    });
});

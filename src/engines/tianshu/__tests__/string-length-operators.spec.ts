/**
 * 字符串长度操作符测试
 * 测试新增的字符串长度验证操作符
 */

import { WorkflowOrchestrator } from "../orchestration/WorkflowOrchestrator";
import { ExecutionContext } from "../types/workflows";
import { IStepExecutor } from "../../common/interfaces";

// Mock步骤执行器
class MockStepExecutor implements IStepExecutor {
    async initialize(): Promise<void> {}
    async shutdown(): Promise<void> {}
    async executeAction(_step: any, _context: any): Promise<any> {
        return { success: true, data: {} };
    }
    on(_event: string, _callback: (data: any) => void): this {
        return this;
    }
    once(_event: string, _callback: (data: any) => void): this {
        return this;
    }
    off(_event: string, _callback: (data: any) => void): void {}
    emit(_event: string, _data: any): void {}
    removeAllListeners(_event?: string): void {}
}

describe("字符串长度操作符测试", () => {
    let orchestrator: WorkflowOrchestrator;
    let mockExecutor: MockStepExecutor;

    beforeEach(() => {
        mockExecutor = new MockStepExecutor();
        orchestrator = new WorkflowOrchestrator({
            maxConcurrency: 1,
            defaultTimeout: 10000,
            stepExecutor: mockExecutor,
        });
    });

    afterEach(() => {
        orchestrator.cleanup();
    });

    describe("string_maxlen 操作符", () => {
        it("应该通过长度在限制内的字符串", () => {
            const context: ExecutionContext = {
                executionId: "test-1",
                workflowId: "test-workflow",
                commandId: "test-cmd",
                startTime: Date.now(),
                status: "running",
                input: { name: "test" },
                variables: {},
                stepResults: new Map(),
                metrics: {
                    stepCount: 0,
                    successStepCount: 0,
                    failedStepCount: 0,
                    skippedStepCount: 0,
                    totalDuration: 0,
                },
            };

            // 测试字符串长度不超过限制
            const result1 = orchestrator["evaluateCondition"](
                { field: "inputs.name", operator: "string_maxlen", value: 10 },
                context,
            );
            expect(result1).toBe(true);

            // 测试字符串长度等于限制
            const result2 = orchestrator["evaluateCondition"](
                { field: "inputs.name", operator: "string_maxlen", value: 4 },
                context,
            );
            expect(result2).toBe(true);
        });

        it("应该拒绝长度超过限制的字符串", () => {
            const context: ExecutionContext = {
                executionId: "test-2",
                workflowId: "test-workflow",
                commandId: "test-cmd",
                startTime: Date.now(),
                status: "running",
                input: { name: "very long name" },
                variables: {},
                stepResults: new Map(),
                metrics: {
                    stepCount: 0,
                    successStepCount: 0,
                    failedStepCount: 0,
                    skippedStepCount: 0,
                    totalDuration: 0,
                },
            };

            const result = orchestrator["evaluateCondition"](
                { field: "inputs.name", operator: "string_maxlen", value: 5 },
                context,
            );
            expect(result).toBe(false);
        });

        it("应该拒绝非字符串类型", () => {
            const context: ExecutionContext = {
                executionId: "test-3",
                workflowId: "test-workflow",
                commandId: "test-cmd",
                startTime: Date.now(),
                status: "running",
                input: { count: 123 },
                variables: {},
                stepResults: new Map(),
                metrics: {
                    stepCount: 0,
                    successStepCount: 0,
                    failedStepCount: 0,
                    skippedStepCount: 0,
                    totalDuration: 0,
                },
            };

            const result = orchestrator["evaluateCondition"](
                { field: "inputs.count", operator: "string_maxlen", value: 10 },
                context,
            );
            expect(result).toBe(false);
        });
    });

    describe("string_minlen 操作符", () => {
        it("应该通过长度满足最小要求的字符串", () => {
            const context: ExecutionContext = {
                executionId: "test-4",
                workflowId: "test-workflow",
                commandId: "test-cmd",
                startTime: Date.now(),
                status: "running",
                input: { password: "password123" },
                variables: {},
                stepResults: new Map(),
                metrics: {
                    stepCount: 0,
                    successStepCount: 0,
                    failedStepCount: 0,
                    skippedStepCount: 0,
                    totalDuration: 0,
                },
            };

            const result = orchestrator["evaluateCondition"](
                { field: "inputs.password", operator: "string_minlen", value: 8 },
                context,
            );
            expect(result).toBe(true);
        });

        it("应该拒绝长度不满足最小要求的字符串", () => {
            const context: ExecutionContext = {
                executionId: "test-5",
                workflowId: "test-workflow",
                commandId: "test-cmd",
                startTime: Date.now(),
                status: "running",
                input: { password: "123" },
                variables: {},
                stepResults: new Map(),
                metrics: {
                    stepCount: 0,
                    successStepCount: 0,
                    failedStepCount: 0,
                    skippedStepCount: 0,
                    totalDuration: 0,
                },
            };

            const result = orchestrator["evaluateCondition"](
                { field: "inputs.password", operator: "string_minlen", value: 8 },
                context,
            );
            expect(result).toBe(false);
        });
    });

    describe("optional_string_maxlen 操作符", () => {
        it("应该通过不存在的字段", () => {
            const context: ExecutionContext = {
                executionId: "test-6",
                workflowId: "test-workflow",
                commandId: "test-cmd",
                startTime: Date.now(),
                status: "running",
                input: {},
                variables: {},
                stepResults: new Map(),
                metrics: {
                    stepCount: 0,
                    successStepCount: 0,
                    failedStepCount: 0,
                    skippedStepCount: 0,
                    totalDuration: 0,
                },
            };

            const result = orchestrator["evaluateCondition"](
                { field: "inputs.description", operator: "optional_string_maxlen", value: 100 },
                context,
            );
            expect(result).toBe(true);
        });

        it("应该通过null字段", () => {
            const context: ExecutionContext = {
                executionId: "test-7",
                workflowId: "test-workflow",
                commandId: "test-cmd",
                startTime: Date.now(),
                status: "running",
                input: { description: null },
                variables: {},
                stepResults: new Map(),
                metrics: {
                    stepCount: 0,
                    successStepCount: 0,
                    failedStepCount: 0,
                    skippedStepCount: 0,
                    totalDuration: 0,
                },
            };

            const result = orchestrator["evaluateCondition"](
                { field: "inputs.description", operator: "optional_string_maxlen", value: 100 },
                context,
            );
            expect(result).toBe(true);
        });

        it("应该通过undefined字段", () => {
            const context: ExecutionContext = {
                executionId: "test-8",
                workflowId: "test-workflow",
                commandId: "test-cmd",
                startTime: Date.now(),
                status: "running",
                input: { description: undefined },
                variables: {},
                stepResults: new Map(),
                metrics: {
                    stepCount: 0,
                    successStepCount: 0,
                    failedStepCount: 0,
                    skippedStepCount: 0,
                    totalDuration: 0,
                },
            };

            const result = orchestrator["evaluateCondition"](
                { field: "inputs.description", operator: "optional_string_maxlen", value: 100 },
                context,
            );
            expect(result).toBe(true);
        });

        it("应该通过长度在限制内的字符串", () => {
            const context: ExecutionContext = {
                executionId: "test-9",
                workflowId: "test-workflow",
                commandId: "test-cmd",
                startTime: Date.now(),
                status: "running",
                input: { description: "short desc" },
                variables: {},
                stepResults: new Map(),
                metrics: {
                    stepCount: 0,
                    successStepCount: 0,
                    failedStepCount: 0,
                    skippedStepCount: 0,
                    totalDuration: 0,
                },
            };

            const result = orchestrator["evaluateCondition"](
                { field: "inputs.description", operator: "optional_string_maxlen", value: 100 },
                context,
            );
            expect(result).toBe(true);
        });

        it("应该拒绝长度超过限制的字符串", () => {
            const context: ExecutionContext = {
                executionId: "test-10",
                workflowId: "test-workflow",
                commandId: "test-cmd",
                startTime: Date.now(),
                status: "running",
                input: { description: "very long description that exceeds the limit" },
                variables: {},
                stepResults: new Map(),
                metrics: {
                    stepCount: 0,
                    successStepCount: 0,
                    failedStepCount: 0,
                    skippedStepCount: 0,
                    totalDuration: 0,
                },
            };

            const result = orchestrator["evaluateCondition"](
                { field: "inputs.description", operator: "optional_string_maxlen", value: 20 },
                context,
            );
            expect(result).toBe(false);
        });
    });

    describe("optional_string_minlen 操作符", () => {
        it("应该通过不存在的字段", () => {
            const context: ExecutionContext = {
                executionId: "test-11",
                workflowId: "test-workflow",
                commandId: "test-cmd",
                startTime: Date.now(),
                status: "running",
                input: {},
                variables: {},
                stepResults: new Map(),
                metrics: {
                    stepCount: 0,
                    successStepCount: 0,
                    failedStepCount: 0,
                    skippedStepCount: 0,
                    totalDuration: 0,
                },
            };

            const result = orchestrator["evaluateCondition"](
                { field: "inputs.title", operator: "optional_string_minlen", value: 3 },
                context,
            );
            expect(result).toBe(true);
        });

        it("应该通过长度满足最小要求的字符串", () => {
            const context: ExecutionContext = {
                executionId: "test-12",
                workflowId: "test-workflow",
                commandId: "test-cmd",
                startTime: Date.now(),
                status: "running",
                input: { title: "Good Title" },
                variables: {},
                stepResults: new Map(),
                metrics: {
                    stepCount: 0,
                    successStepCount: 0,
                    failedStepCount: 0,
                    skippedStepCount: 0,
                    totalDuration: 0,
                },
            };

            const result = orchestrator["evaluateCondition"](
                { field: "inputs.title", operator: "optional_string_minlen", value: 3 },
                context,
            );
            expect(result).toBe(true);
        });

        it("应该拒绝长度不满足最小要求的字符串", () => {
            const context: ExecutionContext = {
                executionId: "test-13",
                workflowId: "test-workflow",
                commandId: "test-cmd",
                startTime: Date.now(),
                status: "running",
                input: { title: "Hi" },
                variables: {},
                stepResults: new Map(),
                metrics: {
                    stepCount: 0,
                    successStepCount: 0,
                    failedStepCount: 0,
                    skippedStepCount: 0,
                    totalDuration: 0,
                },
            };

            const result = orchestrator["evaluateCondition"](
                { field: "inputs.title", operator: "optional_string_minlen", value: 3 },
                context,
            );
            expect(result).toBe(false);
        });
    });

    describe("边界情况测试", () => {
        it("应该处理空字符串", () => {
            const context: ExecutionContext = {
                executionId: "test-14",
                workflowId: "test-workflow",
                commandId: "test-cmd",
                startTime: Date.now(),
                status: "running",
                input: { name: "" },
                variables: {},
                stepResults: new Map(),
                metrics: {
                    stepCount: 0,
                    successStepCount: 0,
                    failedStepCount: 0,
                    skippedStepCount: 0,
                    totalDuration: 0,
                },
            };

            // 空字符串长度应该满足string_minlen(0)
            const result1 = orchestrator["evaluateCondition"](
                { field: "inputs.name", operator: "string_minlen", value: 0 },
                context,
            );
            expect(result1).toBe(true);

            // 空字符串长度应该不满足string_minlen(1)
            const result2 = orchestrator["evaluateCondition"](
                { field: "inputs.name", operator: "string_minlen", value: 1 },
                context,
            );
            expect(result2).toBe(false);
        });

        it("应该处理非字符串类型", () => {
            const context: ExecutionContext = {
                executionId: "test-15",
                workflowId: "test-workflow",
                commandId: "test-cmd",
                startTime: Date.now(),
                status: "running",
                input: { data: { nested: "value" } },
                variables: {},
                stepResults: new Map(),
                metrics: {
                    stepCount: 0,
                    successStepCount: 0,
                    failedStepCount: 0,
                    skippedStepCount: 0,
                    totalDuration: 0,
                },
            };

            // 对象类型应该被拒绝
            const result = orchestrator["evaluateCondition"](
                { field: "inputs.data", operator: "string_maxlen", value: 10 },
                context,
            );
            expect(result).toBe(false);
        });
    });
});

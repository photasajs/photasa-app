import { TianshuEngine } from "../core/TianshuEngine";
import { UICommand } from "../types/commands";
import { IStepExecutor } from "../common/interfaces";
import path from "path";
import fs from "fs-extra";
import os from "os";

// Mock太乙服务执行器
class MockStepExecutor implements IStepExecutor {
    private executedSteps: string[] = [];
    public mockResults: Record<string, any> = {};

    constructor() {
        // 设置模拟返回值
        this.mockResults["wenchang.validate"] = { result: { valid: true, errors: [] } };
        this.mockResults["wenchang.sanitize"] = { result: { ui: { theme: "dark" } } };
    }

    async initialize(): Promise<void> {}
    async shutdown(): Promise<void> {}

    async executeAction(step: any, _context: any): Promise<any> {
        const key = `${step.service}.${step.action}`;
        const stepName = step.id || step.name || key;
        this.executedSteps.push(stepName);

        const baseResult = this.mockResults[key] || { success: true };

        return {
            success: true,
            data: {
                result: baseResult.result, // Adapt structure for variable access
                success: true,
            },
            output: baseResult.result, // Direct output for steps.stepId access
            metadata: { stepName, executedAt: Date.now() },
        };
    }

    getExecutedSteps(): string[] {
        return this.executedSteps;
    }
    clearExecutedSteps(): void {
        this.executedSteps = [];
    }

    on() {}
    off() {}
    once() {
        return this;
    }
    emit() {}
    removeAllListeners() {}
}

const WORKFLOW_YAML = `
id: "update_preferences"
name: "Test Update Preferences"
version: "1.0.0"
triggers:
  - intent: "update_preferences"
inputs:
  force_failure:
    type: "boolean"
    default: false
  delta:
    type: "object"
    default: {}
  source:
    type: "string"
    default: ""
steps:
  - id: "validate_delta"
    type: "builtin"
    action: "log"
    input: { message: "start" }

  - id: "check_validation"
    name: "Check"
    type: "condition"
    dependsOn: ["validate_delta"]
    condition:
      field: "inputs.force_failure"
      operator: "eq"
      value: false
      test: null
    onTrue:
      - id: "sanitize_values"
        name: "Sanitize"
        type: "builtin"
        action: "log"
        input: { message: "sanitize" }
    onFalse:
      - id: "return_validation_error"
        type: "builtin"
        action: "return"
        input:
          success: false
          error: "Validation Failed"
`;

describe("工作流条件步骤执行", () => {
    let engine: TianshuEngine;
    let mockExecutor: MockStepExecutor;
    let tempDir: string;

    beforeEach(async () => {
        // Create temp dir and write workflow file
        tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "tianshu-test-"));
        const workflowPath = path.join(tempDir, "update_preferences.yml");
        await fs.writeFile(workflowPath, WORKFLOW_YAML);
        console.log("Written workflow to:", workflowPath);

        mockExecutor = new MockStepExecutor();
        engine = new TianshuEngine({
            workflowDir: tempDir,
            stepExecutor: mockExecutor,
            maxConcurrentWorkflows: 1,
            defaultTimeout: 10000,
            logLevel: "debug",
        });

        await engine.initialize();
    });

    afterEach(async () => {
        await engine.cleanup();
        await fs.remove(tempDir);
    });

    it("应该执行条件步骤的onTrue分支", async () => {
        // force_failure = false (default) -> condition true -> execute sanitize_values
        const command: UICommand = {
            id: "test-cmd-1",
            intent: "update_preferences",
            params: { force_failure: false, delta: {}, source: "test" },
            priority: "user",
            createdAt: Date.now(),
            context: { source: "api" },
        };

        const response = await engine.processCommand(command);
        expect(response.status).not.toBe("failed");

        // Wait for execution
        await new Promise((resolve) => setTimeout(resolve, 1000));

        const executed = mockExecutor.getExecutedSteps();

        expect(executed).toContain("validate_delta");
        // onTrue branch
        expect(executed).toContain("sanitize_values");
        expect(executed).not.toContain("return_validation_error");
    });

    it("应该执行条件步骤的onFalse分支", async () => {
        // force_failure = true -> condition false -> execute return_validation_error
        const command: UICommand = {
            id: "test-cmd-2",
            intent: "update_preferences",
            params: { force_failure: true, delta: {}, source: "test" },
            priority: "user",
            createdAt: Date.now(),
            context: { source: "api" },
        };

        const response = await engine.processCommand(command);
        expect(response.status).not.toBe("failed");

        await new Promise((resolve) => setTimeout(resolve, 1000));

        const executed = mockExecutor.getExecutedSteps();

        expect(executed).toContain("validate_delta");
        // onFalse branch
        expect(executed).toContain("return_validation_error");
        expect(executed).not.toContain("sanitize_values");
    });
});

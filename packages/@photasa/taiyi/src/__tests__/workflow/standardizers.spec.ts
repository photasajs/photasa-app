import { describe, it, expect } from "vitest";
import {
    normalizeWorkflowStepOutput,
    calculateDuration,
    isValidEngineResult,
    EngineCallResult,
} from "../../core/workflow/standardizers";

describe("Workflow Standardizers", () => {
    describe("calculateDuration", () => {
        it("should calculate duration correctly", () => {
            const startTime = Date.now() - 100;
            const duration = calculateDuration(startTime);
            expect(duration).toBeGreaterThanOrEqual(100);
        });
    });

    describe("isValidEngineResult", () => {
        it("should return true for valid result", () => {
            const validResult: EngineCallResult = {
                success: true,
                result: "data",
                timestamp: Date.now(),
                engineName: "test",
            };
            expect(isValidEngineResult(validResult)).toBe(true);
        });

        it("should return false for invalid result", () => {
            expect(isValidEngineResult(null)).toBe(false);
            expect(isValidEngineResult({})).toBe(false);
            expect(isValidEngineResult({ success: true })).toBe(false); // missing timestamp/engineName
        });
    });

    describe("normalizeWorkflowStepOutput", () => {
        it("should normalize success result", () => {
            const engineResult: EngineCallResult<string> = {
                success: true,
                result: "test-data",
                timestamp: 1000,
                engineName: "test-engine",
            };
            const startTime = Date.now() - 50;
            const output = normalizeWorkflowStepOutput(engineResult, "step-1", startTime);

            expect(output.success).toBe(true);
            expect(output.data).toBe("test-data");
            expect(output.metadata.stepId).toBe("step-1");
            expect(output.metadata.engineName).toBe("test-engine");
            expect(output.metadata.executedAt).toBe(1000);
            expect(output.metadata.duration).toBeGreaterThanOrEqual(50);
        });

        it("should normalize error result with Error object", () => {
            const error = new Error("Test error");
            const engineResult: EngineCallResult<string> = {
                success: false,
                error: error,
                timestamp: 1000,
                engineName: "test-engine",
            };
            const startTime = Date.now() - 50;
            const output = normalizeWorkflowStepOutput(engineResult, "step-1", startTime);

            expect(output.success).toBe(false);
            expect(output.data).toBeNull();
            expect(output.error).toBe("Test error");
            expect(output.metadata.stepId).toBe("step-1");
        });

        it("should normalize error result with undefined error", () => {
            const engineResult: EngineCallResult<string> = {
                success: false,
                timestamp: 1000,
                engineName: "test-engine",
            };
            const startTime = Date.now() - 50;
            const output = normalizeWorkflowStepOutput(engineResult, "step-1", startTime);

            expect(output.success).toBe(false);
            expect(output.error).toBe("Unknown error");
        });
    });
});

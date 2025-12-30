import { describe, it, expect } from "vitest";
import * as TaiyiPackage from "../index";

describe("Taiyi Package Exports", () => {
    it("should export TaiyiEngine", () => {
        expect(TaiyiPackage.TaiyiEngine).toBeDefined();
    });

    it("should export Adapter decorators", () => {
        expect(TaiyiPackage.Adapter).toBeDefined();
        expect(TaiyiPackage.AdapterPriority).toBeDefined();
    });

    it("should export workflow types", () => {
        // Types are erased at runtime but we can check values if any
        // normalizeWorkflowStepOutput is function
        expect(TaiyiPackage.normalizeWorkflowStepOutput).toBeDefined();
    });
});

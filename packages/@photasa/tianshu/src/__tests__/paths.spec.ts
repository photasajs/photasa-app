import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { resolveTianshuWorkflowsDir } from "../paths";

describe("resolveTianshuWorkflowsDir", () => {
    it("应指向包内 workflows 目录且包含上下文文件", () => {
        const workflowsDir = resolveTianshuWorkflowsDir();

        expect(fs.existsSync(workflowsDir)).toBe(true);
        expect(fs.existsSync(path.join(workflowsDir, "tianshu-context.json"))).toBe(true);
    });
});

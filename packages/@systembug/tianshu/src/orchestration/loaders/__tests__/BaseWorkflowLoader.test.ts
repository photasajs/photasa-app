/**
 * WorkflowLoader 单元测试
 */

import { BaseWorkflowLoader, WorkflowData } from "../BaseWorkflowLoader";
import { describe, expect, vi, beforeEach, test } from "vitest";
import { Logger } from "@systembug/logger";

// Mock具体实现类
class MockLoader extends BaseWorkflowLoader {
    async load(source: string): Promise<WorkflowData> {
        return this.loadFromContent(source);
    }
}

describe("BaseWorkflowLoader", () => {
    let loader: MockLoader;
    let logger: any;

    beforeEach(() => {
        logger = {
            debug: vi.fn(),
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
        };
        loader = new MockLoader(logger as Logger);
    });

    describe("loadFromContent", () => {
        test("应该能解析JSON字符串", async () => {
            const json = JSON.stringify({
                id: "test-workflow",
                name: "Test Workflow",
                version: "1.0.0",
                steps: [
                    { id: "step1", type: "builtin", action: "log", input: { message: "hello" } },
                ],
            });

            const workflow = await loader.loadFromContent(json);
            expect(workflow.id).toBe("test-workflow");
            expect(workflow.steps).toHaveLength(1);
        });

        test("应该能解析YAML字符串", async () => {
            const yaml = `
id: test-workflow
name: Test Workflow
version: 1.0.0
steps:
  - id: step1
    type: builtin
    action: log
    input:
      message: hello
`;
            const workflow = await loader.loadFromContent(yaml);
            expect(workflow.id).toBe("test-workflow");
            expect(workflow.steps).toHaveLength(1);
        });

        test("应该能处理对象输入", async () => {
            const obj = {
                id: "test-workflow",
                name: "Test Workflow",
                version: "1.0.0",
                steps: [
                    { id: "step1", type: "builtin", action: "log", input: { message: "hello" } },
                ],
            };

            const workflow = await loader.loadFromContent(obj);
            expect(workflow.id).toBe("test-workflow");
        });

        test("验证失败时应该抛出错误", async () => {
            const invalid = {
                id: "invalid",
                // 缺少steps和version
            };

            await expect(loader.loadFromContent(invalid)).rejects.toThrow(
                "Workflow loading failed: Workflow validation failed",
            );
            expect(logger.error).toHaveBeenCalled();
        });
    });

    describe("normalizeSteps", () => {
        test("应该自动为步骤生成ID", async () => {
            const yaml = `
id: test
name: Test
version: 1.0.0
steps:
  - type: builtin
    action: log
    input: { message: 1 }
  - type: builtin
    action: delay
    input: { duration: 100 }
`;
            const workflow = await loader.loadFromContent(yaml);
            expect(workflow.steps[0].id).toBe("step_1");
            expect(workflow.steps[1].id).toBe("step_2");
        });

        test("应该递归处理子步骤ID", async () => {
            const yaml = `
id: test
name: Test
version: 1.0.0
inputs:
  items:
    type: array
steps:
  - id: loop1
    type: loop
    iterator:
      source: "{{inputs.items}}"
      variable: "item"
    steps:
      - type: builtin
        action: log
        input: { message: loop }
`;
            const workflow = await loader.loadFromContent(yaml);
            expect((workflow.steps[0] as any).steps[0].id).toBe("step_1");
        });
    });
});

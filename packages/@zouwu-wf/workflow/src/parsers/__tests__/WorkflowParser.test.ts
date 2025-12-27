import { describe, it, expect } from "vitest";
import { WorkflowParser } from "../index";

describe("WorkflowParser", () => {
    const parser = new WorkflowParser();

    it("should parse valid YAML content", () => {
        const yamlContent = `
id: test_workflow
name: Test Workflow
version: 1.0.0
steps:
  - id: step1
    type: builtin
    action: log
    input:
      message: "Hello"
`;
        const workflow = parser.parse(yamlContent);
        expect(workflow.id).toBe("test_workflow");
        expect(workflow.steps).toHaveLength(1);
    });

    it("should parse valid JSON content", () => {
        const jsonContent = JSON.stringify({
            id: "test_json_workflow",
            name: "Test JSON Workflow",
            version: "1.0.0",
            steps: [
                {
                    id: "step1",
                    type: "builtin",
                    action: "log",
                    input: { message: "Hello" },
                },
            ],
        });
        const workflow = parser.parse(jsonContent);
        expect(workflow.id).toBe("test_json_workflow");
    });

    it("should throw error for invalid YAML", () => {
        const invalidYaml = `
id: test_workflow
steps:
  - id: step1
    type: unknown_type
`;
        expect(() => parser.parse(invalidYaml)).toThrow("Workflow validation failed");
    });

    it("should normalize steps (add missing IDs)", () => {
        const yamlContent = `
id: test_normalize
name: Test Normalize
version: 1.0.0
steps:
  - type: builtin
    action: log
`;
        const workflow = parser.parse(yamlContent);
        expect(workflow.steps[0].id).toBe("step_1");
    });
});

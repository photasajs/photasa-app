import yaml from "js-yaml";
import { WorkflowValidator } from "../validators";
import { WorkflowDefinition } from "../types";

/**
 * 📜 驺吾工作流解析器
 *
 * 🌌 仙术功能：将字符串内容解析为工作流定义对象
 * 🔧 工作流操作：处理YAML/JSON解析和基础验证
 */
export class WorkflowParser {
    private validator: WorkflowValidator;

    constructor() {
        this.validator = new WorkflowValidator();
    }

    /**
     * 📜 解析工作流内容
     * @param content YAML或JSON字符串
     * @returns 解析并验证后的工作流定义
     */
    parse(content: string | object): WorkflowDefinition {
        let workflow: any;

        try {
            // 1. 解析内容
            if (typeof content === "string") {
                const trimmed = content.trim();
                if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
                    // JSON格式
                    workflow = JSON.parse(content);
                } else {
                    // YAML格式
                    workflow = yaml.load(content);
                }
            } else {
                // 对象格式
                workflow = content;
            }

            // 2. 规范化步骤 (确保都有ID)
            if (Array.isArray(workflow.steps)) {
                this.normalizeSteps(workflow.steps);
            }

            // 3. 验证结构
            const validationResult = this.validator.validate(workflow);
            if (!validationResult.valid) {
                const errorMessage = validationResult.errors
                    .map((e) => `${e.path}: ${e.message}`)
                    .join("; ");
                throw new Error(`Workflow validation failed: ${errorMessage}`);
            }

            return workflow as WorkflowDefinition;
        } catch (error) {
            if (error instanceof Error) {
                // 保留原始错误信息如果是我们抛出的验证错误
                if (error.message.startsWith("Workflow validation failed")) {
                    throw error;
                }
                throw new Error(`Failed to parse workflow: ${error.message}`);
            }
            throw new Error(`Failed to parse workflow: ${String(error)}`);
        }
    }

    /**
     * 规范化步骤 (确保都有ID)
     */
    private normalizeSteps(steps: any[]): void {
        if (!steps) return;

        steps.forEach((step, index) => {
            // 确保有ID
            if (!step.id) {
                step.id = `step_${index + 1}`;
            }

            // 递归处理子步骤
            if (step.onTrue) this.normalizeSteps(step.onTrue);
            if (step.onFalse) this.normalizeSteps(step.onFalse);
            if (step.loop && step.loop.steps) this.normalizeSteps(step.loop.steps);
            if (step.type === "loop" && step.steps) this.normalizeSteps(step.steps);
            if (step.parallel && step.parallel.branches) {
                step.parallel.branches.forEach((branch: any) => {
                    if (branch.steps) this.normalizeSteps(branch.steps);
                });
            }
        });
    }
}

/**
 * 🌌 便捷解析函数
 */
export function parseWorkflow(content: string | object): WorkflowDefinition {
    const parser = new WorkflowParser();
    return parser.parse(content);
}

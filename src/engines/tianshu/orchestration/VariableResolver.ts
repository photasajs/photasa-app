/**
 * 变量解析器
 * 负责工作流中的变量解析、替换和动态计算
 */

import { WorkflowStep, ExecutionContext } from "../types/workflows";

/**
 * 变量解析器配置
 */
export interface VariableResolverConfig {
    /** 全局变量 */
    globalVariables: Record<string, any>;
    /** 是否启用严格模式 */
    strictMode?: boolean;
    /** 变量前缀 */
    variablePrefix?: string;
}

/**
 * 变量解析器
 */
export class VariableResolver {
    private config: VariableResolverConfig;
    private isInitialized = false;

    constructor(config: VariableResolverConfig) {
        this.config = {
            variablePrefix: "${",
            strictMode: false,
            ...config,
        };
    }

    /**
     * 初始化解析器
     */
    async initialize(): Promise<void> {
        this.isInitialized = true;
    }

    /**
     * 解析工作流步骤
     */
    async resolveStep(step: WorkflowStep, context: ExecutionContext): Promise<WorkflowStep> {
        if (!this.isInitialized) {
            throw new Error("VariableResolver not initialized");
        }

        // 深拷贝步骤以避免修改原始对象
        const resolvedStep = JSON.parse(JSON.stringify(step));

        // 解析步骤的各个属性
        if (resolvedStep.input) {
            resolvedStep.input = this.resolveObject(resolvedStep.input, context);
        }

        if (resolvedStep.output) {
            resolvedStep.output = this.resolveObject(resolvedStep.output, context);
        }

        if (resolvedStep.condition) {
            resolvedStep.condition = this.resolveCondition(resolvedStep.condition, context);
        }

        if (resolvedStep.loop) {
            resolvedStep.loop = this.resolveLoop(resolvedStep.loop, context);
        }

        if (resolvedStep.parallel) {
            resolvedStep.parallel = this.resolveParallel(resolvedStep.parallel, context);
        }

        if (resolvedStep.retry) {
            resolvedStep.retry = this.resolveRetry(resolvedStep.retry, context);
        }

        return resolvedStep;
    }

    /**
     * 解析对象中的变量
     */
    resolveObject(obj: any, context: ExecutionContext): any {
        if (obj === null || obj === undefined) {
            return obj;
        }

        if (typeof obj === "string") {
            return this.resolveString(obj, context);
        }

        if (Array.isArray(obj)) {
            return obj.map((item) => this.resolveObject(item, context));
        }

        if (typeof obj === "object") {
            const resolved: any = {};
            for (const [key, value] of Object.entries(obj)) {
                resolved[key] = this.resolveObject(value, context);
            }
            return resolved;
        }

        return obj;
    }

    /**
     * 解析字符串中的变量
     */
    resolveString(str: string, context: ExecutionContext): string {
        if (typeof str !== "string") {
            return str;
        }

        const prefix = this.config.variablePrefix || "$";
        const suffix = "}";

        let result = str;
        let startIndex = 0;

        while (true) {
            const start = result.indexOf(prefix, startIndex);
            if (start === -1) {
                break;
            }

            const end = result.indexOf(suffix, start + prefix.length);
            if (end === -1) {
                break;
            }

            const variableName = result.substring(start + prefix.length, end);
            const value = this.resolveVariable(variableName, context);

            result =
                result.substring(0, start) + String(value) + result.substring(end + suffix.length);
            startIndex = start + String(value).length;
        }

        return result;
    }

    /**
     * 解析变量值
     */
    resolveVariable(variableName: string, context: ExecutionContext): any {
        // 处理特殊变量
        if (variableName.startsWith("$")) {
            return this.resolveSpecialVariable(variableName, context);
        }

        // 处理路径变量（如 input.name, variables.count）
        if (variableName.includes(".")) {
            return this.resolvePathVariable(variableName, context);
        }

        // 处理简单变量
        return this.resolveSimpleVariable(variableName, context);
    }

    /**
     * 解析特殊变量
     */
    private resolveSpecialVariable(variableName: string, context: ExecutionContext): any {
        switch (variableName) {
            case "$timestamp":
                return Date.now();
            case "$date":
                return new Date().toISOString();
            case "$executionId":
                return context.executionId;
            case "$workflowId":
                return context.workflowId;
            case "$commandId":
                return context.commandId;
            case "$random":
                return Math.random();
            case "$uuid":
                return this.generateUUID();
            default:
                if (this.config.strictMode) {
                    throw new Error(`Unknown special variable: ${variableName}`);
                }
                return variableName;
        }
    }

    /**
     * 解析路径变量
     */
    private resolvePathVariable(variableName: string, context: ExecutionContext): any {
        const parts = variableName.split(".");
        const root = parts[0];

        let value: any;
        switch (root) {
            case "input":
                value = context.input;
                break;
            case "variables":
                value = context.variables;
                break;
            case "global":
                value = this.config.globalVariables;
                break;
            case "step":
                value = this.getStepOutputs(context);
                break;
            default:
                if (this.config.strictMode) {
                    throw new Error(`Unknown variable root: ${root}`);
                }
                return variableName;
        }

        // 遍历路径
        for (let i = 1; i < parts.length; i++) {
            if (value && typeof value === "object" && parts[i] in value) {
                value = value[parts[i]];
            } else {
                if (this.config.strictMode) {
                    throw new Error(`Variable path not found: ${variableName}`);
                }
                return variableName;
            }
        }

        return value;
    }

    /**
     * 解析简单变量
     */
    private resolveSimpleVariable(variableName: string, context: ExecutionContext): any {
        // 首先检查上下文变量
        if (variableName in context.variables) {
            return context.variables[variableName];
        }

        // 然后检查全局变量
        if (variableName in this.config.globalVariables) {
            return this.config.globalVariables[variableName];
        }

        // 最后检查输入参数
        if (variableName in context.input) {
            return context.input[variableName];
        }

        if (this.config.strictMode) {
            throw new Error(`Variable not found: ${variableName}`);
        }

        return variableName;
    }

    /**
     * 解析条件表达式
     */
    private resolveCondition(condition: any, context: ExecutionContext): any {
        if (!condition || typeof condition !== "object") {
            return condition;
        }

        return {
            field: this.resolveString(condition.field, context),
            operator: condition.operator,
            value: this.resolveObject(condition.value, context),
            customFunction: condition.customFunction,
        };
    }

    /**
     * 解析循环配置
     */
    private resolveLoop(loop: any, context: ExecutionContext): any {
        if (!loop || typeof loop !== "object") {
            return loop;
        }

        return {
            variable: loop.variable,
            count: this.resolveObject(loop.count, context),
            steps: loop.steps.map((step: WorkflowStep) => this.resolveStep(step, context)),
        };
    }

    /**
     * 解析并行配置
     */
    private resolveParallel(parallel: any, context: ExecutionContext): any {
        if (!parallel || typeof parallel !== "object") {
            return parallel;
        }

        return {
            maxConcurrency: this.resolveObject(parallel.maxConcurrency, context),
            steps: parallel.steps.map((step: WorkflowStep) => this.resolveStep(step, context)),
        };
    }

    /**
     * 解析重试配置
     */
    private resolveRetry(retry: any, context: ExecutionContext): any {
        if (!retry || typeof retry !== "object") {
            return retry;
        }

        return {
            maxAttempts: this.resolveObject(retry.maxAttempts, context),
            delay: this.resolveObject(retry.delay, context),
            backoff: retry.backoff,
            retryCondition: retry.retryCondition
                ? this.resolveCondition(retry.retryCondition, context)
                : undefined,
        };
    }

    /**
     * 获取步骤输出
     */
    private getStepOutputs(context: ExecutionContext): Record<string, any> {
        const outputs: Record<string, any> = {};

        for (const [stepId, result] of Array.from(context.stepResults.entries())) {
            if (result.output !== undefined) {
                outputs[stepId] = result.output;
            }
        }

        return outputs;
    }

    /**
     * 生成UUID
     */
    private generateUUID(): string {
        return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
            const r = (Math.random() * 16) | 0;
            const v = c === "x" ? r : (r & 0x3) | 0x8;
            return v.toString(16);
        });
    }

    /**
     * 清理资源
     */
    async cleanup(): Promise<void> {
        this.isInitialized = false;
    }
}

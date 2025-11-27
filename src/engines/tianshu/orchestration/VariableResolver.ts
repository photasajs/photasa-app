/**
 * 变量解析器
 * 负责工作流中的变量解析、替换和动态计算
 */

import { WorkflowStep, ExecutionContext } from "../types/workflows";
import { isObject } from "radash";
import { generateUUID } from "./utils";

/**
 * TaiyiEngine 包装结构类型
 */
interface TaiyiEngineResult {
    success: boolean;
    result: unknown;
    timestamp: number;
    engineName: string;
}

/**
 * 类型守卫：检查是否为 TaiyiEngine 包装结构
 */
function isTaiyiEngineResult(obj: unknown): obj is TaiyiEngineResult {
    return (
        isObject(obj) &&
        "success" in obj &&
        "result" in obj &&
        "timestamp" in obj &&
        "engineName" in obj
    );
}

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
    /** 工作流步骤定义（用于output_schema验证） */
    workflowSteps?: WorkflowStep[];
}

/**
 * 变量解析器
 */
export class VariableResolver {
    public config: VariableResolverConfig;

    constructor(config: VariableResolverConfig) {
        this.config = {
            variablePrefix: "{{",
            strictMode: true, // 默认启用严格模式，确保output_schema验证失败时抛出错误
            ...config,
        };
    }

    /**
     * 解析工作流步骤
     */
    async resolveStep(step: WorkflowStep, context: ExecutionContext): Promise<WorkflowStep> {
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

        if (isObject(obj)) {
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
    resolveString(str: string, context: ExecutionContext): any {
        if (typeof str !== "string") {
            return str;
        }

        const prefix = this.config.variablePrefix || "{{";
        const suffix = "}}";

        // 检查是否整个字符串就是一个变量模板
        const trimmedStr = str.trim();
        if (trimmedStr.startsWith(prefix) && trimmedStr.endsWith(suffix)) {
            const innerContent = trimmedStr
                .substring(prefix.length, trimmedStr.length - suffix.length)
                .trim();
            // 如果没有其他文本，直接返回解析后的值（保持原始类型）
            if (!innerContent.includes(prefix)) {
                const resolvedValue = this.resolveVariable(innerContent, context);
                return resolvedValue;
            }
        }

        // 处理字符串中的多个变量或混合文本
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

            const variableName = result.substring(start + prefix.length, end).trim();
            const value = this.resolveVariable(variableName, context);

            // 对于混合文本，需要转换为字符串
            const valueStr = typeof value === "string" ? value : JSON.stringify(value);
            result = result.substring(0, start) + valueStr + result.substring(end + suffix.length);
            startIndex = start + valueStr.length;
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

        // 处理函数调用（如 now()）
        if (variableName.includes("(") && variableName.includes(")")) {
            return this.resolveFunctionCall(variableName, context);
        }

        // 处理路径变量（如 input.name, variables.count）
        if (variableName.includes(".")) {
            return this.resolvePathVariable(variableName, context);
        }

        // 处理简单变量
        return this.resolveSimpleVariable(variableName, context);
    }

    /**
     * 解析函数调用
     */
    private resolveFunctionCall(variableName: string, _context: ExecutionContext): any {
        // 提取函数名和参数
        const match = variableName.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\((.*)\)$/);
        if (!match) {
            return variableName;
        }

        const functionName = match[1];

        switch (functionName) {
            case "now":
                return Date.now();
            case "timestamp":
                return Date.now();
            case "date":
                return new Date().toISOString();
            default:
                if (this.config.strictMode) {
                    throw new Error(`🌌 【符咒解析】未知仙法「${functionName}」`);
                }
                return variableName;
        }
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
                return generateUUID();
            default:
                if (this.config.strictMode) {
                    throw new Error(`🌌 【符咒解析】未知天机「${variableName}」`);
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
        let isInputPath = false; // 标记是否为 input/inputs 路径

        switch (root) {
            case "inputs": // 支持inputs和input两种格式
                value = context.input;
                isInputPath = true; // inputs/input 字段是用户输入，可能不存在
                break;
            case "variables":
                value = context.variables;
                break;
            case "global":
                value = this.config.globalVariables;
                break;
            case "steps": // 修正：应该是"steps"而不是"step"
                value = this.getStepOutputs(context);
                // 注意：output_schema验证应该在步骤执行完成后进行（WorkflowOrchestrator负责），
                // 而不是在变量解析时验证。这里只负责获取数据。
                break;
            default:
                if (this.config.strictMode) {
                    throw new Error(`🌌 【符咒解析】未知仙域「${root}」`);
                }
                return variableName;
        }

        // 遍历路径
        for (let i = 1; i < parts.length; i++) {
            // ✅ 修复：支持数组属性访问（如 array.length）
            // isObject() 可能排除数组，需要单独检查数组
            const isArray = Array.isArray(value);
            const isPlainObject = isObject(value);
            const hasProperty = parts[i] in value;

            if (value && (isArray || isPlainObject) && hasProperty) {
                value = value[parts[i]];
            } else {
                // 对于 inputs/input 路径，即使字段不存在也返回 undefined，不抛错
                // 因为这些是用户输入，可能是 optional 的
                if (isInputPath) {
                    return undefined;
                }
                if (this.config.strictMode) {
                    throw new Error(`🌌 【符咒解析】仙径未寻「${variableName}」`);
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
            throw new Error(`🌌 【符咒解析】仙符未现「${variableName}」`);
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
            // 🎯 简化包装：直接暴露引擎的原始返回值
            // 如果 TaiyiService 处理了 output 定义，直接使用处理后的数据
            if (isObject(result.output)) {
                // 检查是否是 TaiyiEngine 的包装结构
                if (isTaiyiEngineResult(result.output)) {
                    // 这是 TaiyiEngine 的包装，直接暴露 result 字段
                    outputs[stepId] = result.output.result;
                } else {
                    // 这是已经处理过的数据，直接使用
                    outputs[stepId] = result.output;
                }
            } else {
                // 兜底：使用原始输出
                outputs[stepId] = result.output;
            }
        }

        return outputs;
    }

    /**
     * 清理资源
     */
    async cleanup(): Promise<void> {
        // No cleanup needed
    }
}

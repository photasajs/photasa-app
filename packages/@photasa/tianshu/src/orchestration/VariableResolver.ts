/**
 * 驺吾变量解析器
 * 负责工作流中的变量解析、替换和动态计算
 *
 * 平台中立：不依赖Node.js或浏览器特定API
 */

import { IVariableResolver, Logger } from "../types/runtime-interfaces";
import { parseExpressionToAST, evaluateAST, EvaluationContext } from "@zouwu-wf/expression-parser";

/**
 * 变量解析器配置
 */
export interface VariableResolverConfig {
    /** 全局变量 */
    globalVariables?: Record<string, any>;
    /** 是否启用严格模式 */
    strictMode?: boolean;
    /** 变量前缀 */
    variablePrefix?: string;
    /** 日志器（可选，平台提供） */
    logger?: Logger;
}

/**
 * 生成UUID的辅助函数（平台中立）
 */
function generateUUID(): string {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === "x" ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
}

/**
 * 检查是否为对象
 */
function isObject(value: any): value is Record<string, any> {
    return value !== null && typeof value === "object" && !Array.isArray(value);
}

/**
 * 变量解析器
 */
export class VariableResolver implements IVariableResolver {
    private config: Required<Omit<VariableResolverConfig, "logger">> & { logger?: Logger };
    // private logger?: Logger;

    public getConfig() {
        return this.config;
    }

    constructor(config: VariableResolverConfig = {}) {
        const { logger, ...otherConfig } = config;
        this.config = {
            globalVariables: {},
            variablePrefix: "{{",
            strictMode: true,
            ...otherConfig,
            logger,
        };
        // this.logger = logger;
    }

    /**
     * 解析模板字符串中的变量
     */
    resolve(template: string, context: any): any {
        return this.resolveString(template, context);
    }

    /**
     * 解析对象中的所有变量
     */
    resolveObject(obj: any, context: any): any {
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
    private resolveString(str: string, context: any): any {
        if (typeof str !== "string") {
            return str;
        }

        const prefix = this.config.variablePrefix;
        const suffix = "}}";

        // 快速检查
        if (!str.includes(prefix)) {
            return str;
        }

        const trimmedStr = str.trim();

        // 尝试提取模板表达式以进行快速检查或完整解析
        try {
            // 如果只有一对 {{}} 且包裹了整个字符串，则作为单个表达式求值（保留类型）
            if (trimmedStr.startsWith(prefix) && trimmedStr.endsWith(suffix)) {
                const content = trimmedStr.slice(prefix.length, -suffix.length);
                // 简单的去壳检查，这比正则更快
                if (!content.includes(prefix) && !content.includes(suffix)) {
                    try {
                        return this.evaluateExpression(content, context);
                    } catch (e) {
                        if (this.config.strictMode) throw e;
                        return str;
                    }
                }
            }

            // 混合字符串模式： "Hello {{name}}!"
            let result = str;
            let startIndex = 0;

            while (true) {
                const start = result.indexOf(prefix, startIndex);
                if (start === -1) break;

                const end = result.indexOf(suffix, start + prefix.length);
                if (end === -1) break;

                const expression = result.substring(start + prefix.length, end).trim();
                let value;

                try {
                    value = this.evaluateExpression(expression, context);
                } catch (e) {
                    if (this.config.strictMode) throw e;
                    value = prefix + expression + suffix; // 出错时保留原文
                }

                // 字符串插值总是转为 string
                const valueStr =
                    typeof value === "object"
                        ? JSON.stringify(value)
                        : typeof value === "string"
                          ? value
                          : String(value ?? "");

                result =
                    result.substring(0, start) + valueStr + result.substring(end + suffix.length);
                startIndex = start + valueStr.length;
            }

            return result;
        } catch (e) {
            if (this.config.strictMode) throw e;
            return str;
        }
    }

    private evaluateExpression(expression: string, context: any): any {
        // 使用 Parser 解析
        const ast = parseExpressionToAST(expression);
        const evalContext = this.createEvaluationContext(context);
        return evaluateAST(ast, evalContext);
    }

    private createEvaluationContext(context: any): EvaluationContext {
        return {
            getVariable: (name: string) => this.resolveRootVariable(name, context),
            callFunction: (name: string, args: any[]) =>
                this.resolveFunctionCall(name, args, context),
            getProperty: (obj: any, prop: string | number) => {
                if (obj === undefined || obj === null) return undefined;
                return obj[prop];
            },
        };
    }

    /**
     * 解析顶级变量 (Identifier)
     */
    private resolveRootVariable(name: string, context: any): any {
        // Roots
        if (name === "inputs" || name === "input") return context.input || context.inputs;
        if (name === "variables") return context.variables;
        if (name === "global") return this.config.globalVariables;
        if (name === "steps" || name === "step") return this.getStepOutputs(context);
        if (name === "loopContext") return context.loopContext;
        if (name === "branchContext") return context.branchContext;

        // Special Variables
        if (name.startsWith("$")) {
            return this.resolveSpecialVariable(name, context);
        }

        // Simple Variable Lookup (fallback for non-rooted vars)
        if (context.variables && name in context.variables) {
            return context.variables[name];
        }

        // Global variables check
        if (name in this.config.globalVariables) {
            return this.config.globalVariables[name];
        }

        // Input parameters check
        const input = context.input || context.inputs;
        if (input && name in input) {
            return input[name];
        }

        // Not found
        throw new Error(`Variable not found: ${name}`);
    }

    /**
     * 解析函数调用
     */
    private resolveFunctionCall(name: string, args: any[], _context: any): any {
        switch (name) {
            case "now":
            case "timestamp":
                return Date.now();
            case "date":
                return new Date().toISOString();
            case "uuid":
                return generateUUID();
            case "max":
                return Math.max(...args);
            case "min":
                return Math.min(...args);
            case "abs":
                return Math.abs(args[0]);
            case "round":
                return Math.round(args[0]);
            case "floor":
                return Math.floor(args[0]);
            case "ceil":
                return Math.ceil(args[0]);
            default:
                throw new Error(`Unknown function: ${name}`);
        }
    }

    /**
     * 解析特殊变量
     */
    private resolveSpecialVariable(variableName: string, context: any): any {
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
                throw new Error(`Unknown special variable: ${variableName}`);
        }
    }

    /**
     * 获取步骤输出
     */
    private getStepOutputs(context: any): Record<string, any> {
        const outputs: Record<string, any> = {};

        if (!context.stepResults) {
            return outputs;
        }

        // 支持Map或普通对象
        const entries =
            context.stepResults instanceof Map
                ? Array.from((context.stepResults as Map<string, any>).entries())
                : Object.entries(context.stepResults);

        for (const [stepId, result] of entries) {
            if (result && typeof result === "object" && "output" in result) {
                outputs[stepId] = result.output;
            } else {
                outputs[stepId] = result;
            }
        }

        return outputs;
    }
}

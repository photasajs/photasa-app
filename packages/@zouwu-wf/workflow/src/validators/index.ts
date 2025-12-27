/**
 * 📜 驺吾工作流验证器统一导出模块
 *
 * 🌌 仙术功能：提供运行时工作流验证能力
 * 🔧 工作流操作：基于 RFC 0037 的双阶段验证策略，确保工作流结构和语法的正确性
 */

import { ValidationResult, ValidationError, ValidationOptions } from "../types";
import { getWorkflowSchema, getStepTypesSchema } from "../schemas";
import { validateTemplateExpressionsInObject } from "@zouwu-wf/expression-parser";
import Ajv from "ajv";
import addFormats from "ajv-formats";

export class WorkflowValidator {
    private options: ValidationOptions;
    private ajv: Ajv;

    constructor(options: ValidationOptions = {}) {
        this.options = options;
        this.ajv = new Ajv({
            allErrors: true,
            strict: false,
            validateFormats: true,
        });
        addFormats(this.ajv);

        // 注册基础Schema
        this.ajv.addSchema(getStepTypesSchema(), "step-types");

        // 如果有扩展Schema，也一并注册或合并
        if (this.options.extensionSchema) {
            this.ajv.addSchema(this.options.extensionSchema, "extension");
        }
    }

    /**
     * 📜 验证工作流定义
     */
    validate(workflow: any): ValidationResult {
        const errors: ValidationError[] = [];

        try {
            // 1. JSON Schema 验证 (结构、必需字段、格式、枚举等)
            this.validateJsonSchema(workflow, errors);

            // 如果基本结构都有问题，就不必进行更深层的逻辑验证了
            if (errors.length > 0 && this.options.strict) {
                return { valid: false, errors, data: workflow };
            }

            // 2. 深度逻辑验证 (JSON Schema 无法覆盖的部分)

            // 步骤 ID 唯一性及步骤内部验证
            this.validateSteps(workflow.steps || [], errors);

            // 依赖关系验证 (引用完整性、循环依赖)
            this.validateDependencies(workflow.steps || [], errors);

            // 变量引用验证 (表达式解析与作用域)
            this.validateVariableReferences(workflow, errors);

            // 3. 严格格式验证 (RFC 0037/0045)
            this.validateStrictFormatting(workflow, errors);

            return {
                valid: errors.length === 0,
                errors,
                data: workflow,
            };
        } catch (error) {
            errors.push({
                path: "root",
                message: `验证过程发生错误: ${error}`,
                value: workflow,
            });

            return {
                valid: false,
                errors,
                data: workflow,
            };
        }
    }

    /**
     * 🌌 验证步骤定义
     */
    private validateSteps(steps: any[], errors: ValidationError[]): void {
        const stepIds = new Set<string>();

        for (const [index, step] of steps.entries()) {
            const stepPath = `steps[${index}]`;

            // 我们假设 JSON Schema 已经验证了必填字段 (id, type)
            if (!step.id) continue;

            // ID唯一性验证 (核心逻辑，Schema 无法交叉验证)
            if (stepIds.has(step.id)) {
                errors.push({
                    path: `${stepPath}.id`,
                    message: `步骤ID重复: ${step.id}`,
                    value: step.id,
                });
            } else {
                stepIds.add(step.id);
            }

            // 特定类型验证 (递归、复杂逻辑)
            this.validateStepType(step, stepPath, errors);
        }
    }

    /**
     * 📜 验证特定步骤类型
     */
    private validateStepType(step: any, stepPath: string, errors: ValidationError[]): void {
        switch (step.type) {
            case "action":
                this.validateActionStep(step, stepPath, errors);
                break;
            case "builtin":
                this.validateBuiltinStep(step, stepPath, errors);
                break;
            case "condition":
                this.validateConditionStep(step, stepPath, errors);
                break;
            case "loop":
                this.validateLoopStep(step, stepPath, errors);
                break;
            case "parallel":
                this.validateParallelStep(step, stepPath, errors);
                break;
            case "workflow":
                this.validateWorkflowCallStep(step, stepPath, errors);
                break;
        }
    }

    /**
     * 🔧 验证动作步骤
     */
    private validateActionStep(step: any, stepPath: string, errors: ValidationError[]): void {
        // service/action 存在性由 Schema 保证
        // 这里验证 option 中指定的 supportedServices
        if (step.service && this.options.supportedServices) {
            if (!this.options.supportedServices.includes(step.service)) {
                errors.push({
                    path: `${stepPath}.service`,
                    message: `无效的服务名称: ${step.service}。支持的服务: ${this.options.supportedServices.join(", ")}`,
                    value: step.service,
                });
            }
        }
    }

    /**
     * 🌌 验证内置操作步骤
     */
    private validateBuiltinStep(step: any, stepPath: string, errors: ValidationError[]): void {
        // action 存在性由 Schema 保证
        if (step.action && this.options.supportedBuiltinActions) {
            if (!this.options.supportedBuiltinActions.includes(step.action)) {
                errors.push({
                    path: `${stepPath}.action`,
                    message: `无效的内置操作: ${step.action}。支持的操作: ${this.options.supportedBuiltinActions.join(", ")}`,
                    value: step.action,
                });
            }
        }
    }

    /**
     * 📜 验证条件步骤
     */
    private validateConditionStep(step: any, stepPath: string, errors: ValidationError[]): void {
        if (!step.condition) {
            errors.push({
                path: `${stepPath}.condition`,
                message: "condition步骤缺少condition字段",
                value: step,
            });
        } else {
            this.validateCondition(step.condition, `${stepPath}.condition`, errors);
        }
    }

    /**
     * 🔧 验证条件表达式
     */
    private validateCondition(
        condition: any,
        conditionPath: string,
        errors: ValidationError[],
    ): void {
        if (!condition.operator) {
            errors.push({
                path: `${conditionPath}.operator`,
                message: "条件缺少operator字段",
                value: condition,
            });
            return;
        }

        // 如果支持操作符白名单
        if (this.options.supportedOperators) {
            if (!this.options.supportedOperators.includes(condition.operator)) {
                // 检查是否在内置操作符中
                const internalOperators = [
                    "eq",
                    "ne",
                    "gt",
                    "gte",
                    "lt",
                    "lte",
                    "in",
                    "nin",
                    "exists",
                    "not_exists",
                    "matches",
                    "and",
                    "or",
                ];
                if (!internalOperators.includes(condition.operator)) {
                    errors.push({
                        path: `${conditionPath}.operator`,
                        message: `无效的条件操作符: ${condition.operator}`,
                        value: condition.operator,
                    });
                }
            }
        }

        // 复杂条件验证
        if (["and", "or"].includes(condition.operator)) {
            if (!condition.conditions || !Array.isArray(condition.conditions)) {
                errors.push({
                    path: `${conditionPath}.conditions`,
                    message: `${condition.operator}操作符需要conditions数组`,
                    value: condition.conditions,
                });
            } else {
                condition.conditions.forEach((subCondition: any, index: number) => {
                    this.validateCondition(
                        subCondition,
                        `${conditionPath}.conditions[${index}]`,
                        errors,
                    );
                });
            }
        } else {
            // 简单条件深度验证 (Schema 已经保证了 operator 存在)
            // 这里主要验证左操作数和右操作数的逻辑组合
            const hasValue = condition.value !== undefined;
            const hasField = condition.field !== undefined;
            const hasTest = condition.test !== undefined;

            // 1. 必须有左操作数（value 或 field）
            if (!hasValue && !hasField) {
                errors.push({
                    path: `${conditionPath}`,
                    message: "简单条件缺少左操作数 (value 或 field)",
                    value: condition,
                });
            }

            // 2. 必须有右操作数 (除了 exists/not_exists)
            if (!["exists", "not_exists"].includes(condition.operator)) {
                let hasRightOperand = false;
                if (hasField) {
                    hasRightOperand = hasTest || hasValue; // field 配合 test 或 value (天枢格式)
                } else if (hasValue) {
                    hasRightOperand = hasTest; // 标准 value 配合 test
                }

                if (!hasRightOperand) {
                    errors.push({
                        path: `${conditionPath}`,
                        message: `操作符 ${condition.operator} 缺少右操作数 (test 或 value)`,
                        value: condition,
                    });
                }
            }
        }
    }

    /**
     * 🌌 验证循环步骤
     */
    private validateLoopStep(step: any, stepPath: string, errors: ValidationError[]): void {
        // iterator 字段存在性由 Schema 保证
        if (step.iterator) {
            if (!step.iterator.source) {
                errors.push({
                    path: `${stepPath}.iterator.source`,
                    message: "循环迭代器缺少 source 字段",
                    value: step.iterator,
                });
            }
            if (!step.iterator.variable) {
                errors.push({
                    path: `${stepPath}.iterator.variable`,
                    message: "循环迭代器缺少 variable 字段",
                    value: step.iterator,
                });
            }
        }

        if (!step.steps || !Array.isArray(step.steps) || step.steps.length === 0) {
            errors.push({
                path: `${stepPath}.steps`,
                message: "loop步骤需要非空的steps数组",
                value: step.steps,
            });
        } else {
            this.validateSteps(step.steps, errors);
        }
    }

    /**
     * 📜 验证并行步骤
     */
    private validateParallelStep(step: any, stepPath: string, errors: ValidationError[]): void {
        if (!step.branches || !Array.isArray(step.branches) || step.branches.length < 2) {
            errors.push({
                path: `${stepPath}.branches`,
                message: "parallel步骤需要至少2个分支",
                value: step.branches,
            });
        } else {
            step.branches.forEach((branch: any, index: number) => {
                const branchPath = `${stepPath}.branches[${index}]`;

                if (!branch.name) {
                    errors.push({
                        path: `${branchPath}.name`,
                        message: "并行分支缺少name字段",
                        value: branch,
                    });
                }

                if (!branch.steps || !Array.isArray(branch.steps) || branch.steps.length === 0) {
                    errors.push({
                        path: `${branchPath}.steps`,
                        message: "并行分支需要非空的steps数组",
                        value: branch.steps,
                    });
                } else {
                    this.validateSteps(branch.steps, errors);
                }
            });
        }
    }

    /**
     * 🔧 验证工作流调用步骤
     */
    private validateWorkflowCallStep(step: any, stepPath: string, errors: ValidationError[]): void {
        if (!step.workflowId) {
            errors.push({
                path: `${stepPath}.workflowId`,
                message: "workflow步骤缺少workflowId字段",
                value: step,
            });
        }
    }

    /**
     * 🌌 验证步骤依赖关系
     */
    private validateDependencies(steps: any[], errors: ValidationError[]): void {
        const stepIds = new Set(steps.map((step) => step.id).filter(Boolean));

        for (const [index, step] of steps.entries()) {
            if (!step.dependsOn) continue;

            const stepPath = `steps[${index}]`;
            const dependencies = Array.isArray(step.dependsOn) ? step.dependsOn : [step.dependsOn];

            for (const dep of dependencies) {
                if (typeof dep !== "string") {
                    errors.push({
                        path: `${stepPath}.dependsOn`,
                        message: "依赖项必须是字符串",
                        value: dep,
                    });
                    continue;
                }

                if (!stepIds.has(dep)) {
                    errors.push({
                        path: `${stepPath}.dependsOn`,
                        message: `引用了不存在的步骤: ${dep}`,
                        value: dep,
                    });
                }

                if (dep === step.id) {
                    errors.push({
                        path: `${stepPath}.dependsOn`,
                        message: `步骤不能依赖自己: ${dep}`,
                        value: dep,
                    });
                }
            }
        }

        // 检查循环依赖
        this.validateCircularDependencies(steps, errors);
    }

    /**
     * 📜 验证循环依赖
     */
    private validateCircularDependencies(steps: any[], errors: ValidationError[]): void {
        const graph = new Map<string, string[]>();
        const stepById = new Map<string, any>();

        // 构建依赖图
        for (const step of steps) {
            if (!step.id) continue;

            stepById.set(step.id, step);
            const dependencies = step.dependsOn
                ? Array.isArray(step.dependsOn)
                    ? step.dependsOn
                    : [step.dependsOn]
                : [];
            graph.set(
                step.id,
                dependencies.filter((dep: any) => typeof dep === "string"),
            );
        }

        // 检测循环依赖
        const visited = new Set<string>();
        const recursionStack = new Set<string>();

        const hasCycle = (nodeId: string): boolean => {
            visited.add(nodeId);
            recursionStack.add(nodeId);

            const dependencies = graph.get(nodeId) || [];
            for (const dep of dependencies) {
                if (!visited.has(dep)) {
                    if (hasCycle(dep)) return true;
                } else if (recursionStack.has(dep)) {
                    return true;
                }
            }

            recursionStack.delete(nodeId);
            return false;
        };

        for (const stepId of graph.keys()) {
            if (!visited.has(stepId)) {
                if (hasCycle(stepId)) {
                    const step = stepById.get(stepId);
                    const stepIndex = steps.findIndex((s) => s.id === stepId);
                    errors.push({
                        path: `steps[${stepIndex}].dependsOn`,
                        message: `检测到循环依赖，涉及步骤: ${stepId}`,
                        value: step?.dependsOn,
                    });
                }
            }
        }
    }

    /**
     * 🔧 验证变量引用
     */
    private validateVariableReferences(workflow: any, errors: ValidationError[]): void {
        // 收集所有可用的变量
        const availableVariables = new Set<string>();

        // 添加输入变量
        if (workflow.inputs) {
            // inputs 是对象 map，key 是参数名
            for (const inputName of Object.keys(workflow.inputs)) {
                availableVariables.add(`inputs.${inputName}`);
            }
        }

        // 添加工作流变量
        if (workflow.variables) {
            for (const varName of Object.keys(workflow.variables)) {
                availableVariables.add(`variables.${varName}`);
            }
        }

        // 添加步骤输出变量
        if (workflow.steps) {
            for (const step of workflow.steps) {
                if (step.id) {
                    // 支持直连引用 (steps.id) 和 .output 引用
                    availableVariables.add(`steps.${step.id}`);
                    availableVariables.add(`steps.${step.id}.output`);
                    availableVariables.add(`steps.${step.id}.result`);
                    availableVariables.add(`steps.${step.id}.data`);

                    // 递归添加 output_schema 中定义的路径
                    if (step.output_schema) {
                        this.addPathsFromSchema(
                            availableVariables,
                            `steps.${step.id}`,
                            step.output_schema,
                        );
                        // 同时也支持 .result 和 .output 前缀下的路径
                        this.addPathsFromSchema(
                            availableVariables,
                            `steps.${step.id}.result`,
                            step.output_schema,
                        );
                        this.addPathsFromSchema(
                            availableVariables,
                            `steps.${step.id}.output`,
                            step.output_schema,
                        );
                    }
                }
            }
        }

        // 使用表达式解析器验证模板变量引用
        const validationResult = validateTemplateExpressionsInObject(
            workflow,
            availableVariables,
            "root",
        );

        if (!validationResult.valid) {
            for (const error of validationResult.errors) {
                errors.push({
                    path: error.path,
                    message: error.message,
                    value: error.value,
                });
            }
        }
    }

    /**
     * 🔧 使用 JSON Schema 进行验证
     */
    private validateJsonSchema(workflow: any, errors: ValidationError[]): void {
        const baseSchema = getWorkflowSchema();
        let validate;

        if (this.options.extensionSchema) {
            // 如果有扩展Schema，尝试合并验证
            // 这里简单处理：先验证基础，再验证扩展（如果扩展是一个完整的Schema）
            // 或者可以使用 allOf 组合
            const combinedSchema = {
                allOf: [{ $ref: "workflow-base" }, { $ref: "extension" }],
            };

            if (!this.ajv.getSchema("workflow-base")) {
                this.ajv.addSchema(baseSchema, "workflow-base");
            }

            validate = this.ajv.compile(combinedSchema);
        } else {
            validate = this.ajv.getSchema("workflow-base") || this.ajv.compile(baseSchema);
            if (!this.ajv.getSchema("workflow-base")) {
                this.ajv.addSchema(baseSchema, "workflow-base");
                validate = this.ajv.getSchema("workflow-base")!;
            }
        }

        const valid = validate(workflow);
        if (!valid && validate.errors) {
            for (const err of validate.errors) {
                // 转换 Ajv 错误消息为更友好的格式
                let message = err.message || "JSON Schema 验证错误";
                if (err.keyword === "enum") {
                    message = `值不合法，必须是以下之一: ${err.params.allowedValues.join(", ")}`;
                } else if (err.keyword === "required") {
                    message = `缺少必需属性: ${err.params.missingProperty}`;
                }

                errors.push({
                    path: err.instancePath
                        ? err.instancePath.substring(1).replace(/\//g, ".")
                        : "root",
                    message: message,
                    value: err.data,
                    schema: err.schemaPath,
                });
            }
        }
    }

    /**
     * 📜 验证严格格式规范 (RFC 0037 / RFC 0045)
     */
    private validateStrictFormatting(workflow: any, errors: ValidationError[]): void {
        const content = JSON.stringify(workflow);

        // RFC 0037: 占位符必须使用 {{}}，严禁使用 ${}
        const dollarBraceMatches = content.match(/\$\{[^}]*\}/g);
        if (dollarBraceMatches) {
            errors.push({
                path: "global",
                message: `发现不合典制的符咒格式 "${dollarBraceMatches.join(", ")}"。驺吾(Zouwu) RFC 0037 典制要求使用双花括号 {{}} 而非美元符号 \${}`,
                value: dollarBraceMatches,
            });
        }

        // RFC 0045: YAML中不应显式出现 .output（这是内部实现细节）
        const explicitOutputMatches = content.match(
            /\{\{steps\.[a-zA-Z0-9_-]+\.output(\.[^}]*)?\}\}/g,
        );
        if (explicitOutputMatches) {
            errors.push({
                path: "global",
                message: `检测到显式使用 .output「${explicitOutputMatches.join(", ")}」。根据 RFC 0045，.output 是内部实现细节，YAML 中应直接使用 steps.步骤名 或 steps.步骤名.字段`,
                value: explicitOutputMatches,
            });
        }
    }

    /**
     * 🔧 从 Schema 中提取所有可能的路径并添加到可用变量集合中
     */
    private addPathsFromSchema(set: Set<string>, prefix: string, schema: any, depth = 0): void {
        if (depth > 5 || !schema || typeof schema !== "object") return; // 防止无限递归

        // 处理数组类型
        if (schema.type === "array") {
            set.add(`${prefix}.length`);
            return;
        }

        // 标准格式：有 properties 字段
        if (schema.properties) {
            for (const key of Object.keys(schema.properties)) {
                const path = `${prefix}.${key}`;
                set.add(path);
                this.addPathsFromSchema(set, path, schema.properties[key], depth + 1);
            }
            return;
        }

        // 开放对象（type: object 但无 properties）
        if (schema.type === "object" && !schema.properties) {
            return;
        }

        // 非标准格式：直接定义属性（如 { valid: { type: boolean }, errors: { type: array } }）
        // 检测：如果对象的值看起来像 schema 定义，则将键视为属性名
        const keys = Object.keys(schema);

        for (const key of keys) {
            const value = schema[key];
            if (typeof value === "object" && value !== null) {
                // 如果值有 type、properties、items 等 schema 特征，认为这是一个属性定义
                if (value.type || value.properties || value.items || value.$ref) {
                    const path = `${prefix}.${key}`;
                    set.add(path);
                    this.addPathsFromSchema(set, path, value, depth + 1);
                }
            }
        }
    }
}

/**
 * 🌌 便捷验证函数
 */
export function validateWorkflow(workflow: any, options?: ValidationOptions): ValidationResult {
    const validator = new WorkflowValidator(options);
    return validator.validate(workflow);
}

/**
 * 📜 快速验证函数
 */
export function isValidWorkflow(workflow: any): boolean {
    const result = validateWorkflow(workflow);
    return result.valid;
}

/**
 * 🔧 严格验证函数
 */
export function validateWorkflowStrict(workflow: any): any {
    const result = validateWorkflow(workflow);

    if (!result.valid) {
        const errorMessage = result.errors.map((e) => `${e.path}: ${e.message}`).join("; ");
        throw new Error(`【符咒解析】工作流验证失败: ${errorMessage}`);
    }

    return result.data;
}

// 导出验证器类和相关类型（WorkflowValidator 已在类定义时导出）
export type { ValidationResult, ValidationError };

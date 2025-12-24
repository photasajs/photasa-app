/**
 * 📜 驺吾工作流验证器统一导出模块
 *
 * 🌌 仙术功能：提供运行时工作流验证能力
 * 🔧 工作流操作：确保工作流结构和语法的正确性
 */

import { ValidationResult, ValidationError } from '../types';
import { getWorkflowSchema, getStepTypesSchema } from '../schemas';
import { validateTemplateExpressionsInObject } from '@systembug/zouwu-expression-parser';

/**
 * 🌌 基础验证器类
 */
export class WorkflowValidator {
    private workflowSchema: any;
    private stepTypesSchema: any;

    constructor() {
        this.workflowSchema = getWorkflowSchema();
        this.stepTypesSchema = getStepTypesSchema();
    }

    /**
     * 📜 验证工作流定义
     */
    validate(workflow: any): ValidationResult {
        const errors: ValidationError[] = [];

        try {
            // 基本结构验证
            this.validateBasicStructure(workflow, errors);

            // 步骤验证
            this.validateSteps(workflow.steps || [], errors);

            // 依赖关系验证
            this.validateDependencies(workflow.steps || [], errors);

            // 变量引用验证
            this.validateVariableReferences(workflow, errors);

            return {
                valid: errors.length === 0,
                errors,
                data: workflow,
            };
        } catch (error) {
            errors.push({
                path: 'root',
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
     * 🔧 验证基本结构
     */
    private validateBasicStructure(workflow: any, errors: ValidationError[]): void {
        // 必需字段检查
        const requiredFields = ['id', 'name', 'version', 'steps'];
        for (const field of requiredFields) {
            if (!workflow[field]) {
                errors.push({
                    path: field,
                    message: `缺少必需字段: ${field}`,
                    value: workflow[field],
                });
            }
        }

        // ID格式验证
        if (workflow.id && !/^[a-zA-Z0-9_-]+$/.test(workflow.id)) {
            errors.push({
                path: 'id',
                message: 'ID只能包含字母、数字、下划线和连字符',
                value: workflow.id,
            });
        }

        // 版本格式验证
        if (workflow.version && !/^\d+\.\d+\.\d+$/.test(workflow.version)) {
            errors.push({
                path: 'version',
                message: '版本号必须符合语义版本格式 (x.y.z)',
                value: workflow.version,
            });
        }

        // 步骤数组验证
        if (workflow.steps && !Array.isArray(workflow.steps)) {
            errors.push({
                path: 'steps',
                message: 'steps必须是数组类型',
                value: workflow.steps,
            });
        } else if (workflow.steps && workflow.steps.length === 0) {
            errors.push({
                path: 'steps',
                message: 'steps不能为空数组',
                value: workflow.steps,
            });
        }
    }

    /**
     * 🌌 验证步骤定义
     */
    private validateSteps(steps: any[], errors: ValidationError[]): void {
        const stepIds = new Set<string>();

        for (const [index, step] of steps.entries()) {
            const stepPath = `steps[${index}]`;

            // 基本字段验证
            if (!step.id) {
                errors.push({
                    path: `${stepPath}.id`,
                    message: '步骤缺少id字段',
                    value: step,
                });
                continue;
            }

            if (!step.type) {
                errors.push({
                    path: `${stepPath}.type`,
                    message: '步骤缺少type字段',
                    value: step,
                });
                continue;
            }

            // ID唯一性验证
            if (stepIds.has(step.id)) {
                errors.push({
                    path: `${stepPath}.id`,
                    message: `步骤ID重复: ${step.id}`,
                    value: step.id,
                });
            } else {
                stepIds.add(step.id);
            }

            // ID格式验证
            if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(step.id)) {
                errors.push({
                    path: `${stepPath}.id`,
                    message: '步骤ID必须以字母或下划线开头，只能包含字母、数字和下划线',
                    value: step.id,
                });
            }

            // 步骤类型验证
            const validTypes = ['condition', 'action', 'builtin', 'loop', 'parallel', 'workflow'];
            if (!validTypes.includes(step.type)) {
                errors.push({
                    path: `${stepPath}.type`,
                    message: `无效的步骤类型: ${step.type}。支持的类型: ${validTypes.join(', ')}`,
                    value: step.type,
                });
            }

            // 特定类型验证
            this.validateStepType(step, stepPath, errors);
        }
    }

    /**
     * 📜 验证特定步骤类型
     */
    private validateStepType(step: any, stepPath: string, errors: ValidationError[]): void {
        switch (step.type) {
            case 'action':
                this.validateActionStep(step, stepPath, errors);
                break;
            case 'builtin':
                this.validateBuiltinStep(step, stepPath, errors);
                break;
            case 'condition':
                this.validateConditionStep(step, stepPath, errors);
                break;
            case 'loop':
                this.validateLoopStep(step, stepPath, errors);
                break;
            case 'parallel':
                this.validateParallelStep(step, stepPath, errors);
                break;
            case 'workflow':
                this.validateWorkflowCallStep(step, stepPath, errors);
                break;
        }
    }

    /**
     * 🔧 验证动作步骤
     */
    private validateActionStep(step: any, stepPath: string, errors: ValidationError[]): void {
        if (!step.service) {
            errors.push({
                path: `${stepPath}.service`,
                message: 'action步骤缺少service字段',
                value: step,
            });
        } else {
            const validServices = ['taiyi', 'wenchang', 'qianliyan', 'maliang'];
            if (!validServices.includes(step.service)) {
                errors.push({
                    path: `${stepPath}.service`,
                    message: `无效的服务名称: ${step.service}。支持的服务: ${validServices.join(', ')}`,
                    value: step.service,
                });
            }
        }

        if (!step.action) {
            errors.push({
                path: `${stepPath}.action`,
                message: 'action步骤缺少action字段',
                value: step,
            });
        }
    }

    /**
     * 🌌 验证内置操作步骤
     */
    private validateBuiltinStep(step: any, stepPath: string, errors: ValidationError[]): void {
        if (!step.action) {
            errors.push({
                path: `${stepPath}.action`,
                message: 'builtin步骤缺少action字段',
                value: step,
            });
        } else {
            const validActions = ['return', 'setVariable', 'log', 'delay', 'transform', 'error'];
            if (!validActions.includes(step.action)) {
                errors.push({
                    path: `${stepPath}.action`,
                    message: `无效的内置操作: ${step.action}。支持的操作: ${validActions.join(', ')}`,
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
                message: 'condition步骤缺少condition字段',
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
        errors: ValidationError[]
    ): void {
        if (!condition.operator) {
            errors.push({
                path: `${conditionPath}.operator`,
                message: '条件缺少operator字段',
                value: condition,
            });
            return;
        }

        const validOperators = [
            'eq',
            'ne',
            'gt',
            'gte',
            'lt',
            'lte',
            'in',
            'nin',
            'exists',
            'not_exists',
            'matches',
            'and',
            'or',
        ];

        if (!validOperators.includes(condition.operator)) {
            errors.push({
                path: `${conditionPath}.operator`,
                message: `无效的条件操作符: ${condition.operator}。支持的操作符: ${validOperators.join(', ')}`,
                value: condition.operator,
            });
        }

        // 复杂条件验证
        if (['and', 'or'].includes(condition.operator)) {
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
                        errors
                    );
                });
            }
        } else {
            // 简单条件需要value和test字段
            if (condition.value === undefined) {
                errors.push({
                    path: `${conditionPath}.value`,
                    message: '简单条件缺少value字段',
                    value: condition.value,
                });
            }

            if (
                condition.test === undefined &&
                !['exists', 'not_exists'].includes(condition.operator)
            ) {
                errors.push({
                    path: `${conditionPath}.test`,
                    message: '条件缺少test字段',
                    value: condition.test,
                });
            }
        }
    }

    /**
     * 🌌 验证循环步骤
     */
    private validateLoopStep(step: any, stepPath: string, errors: ValidationError[]): void {
        if (!step.iterator) {
            errors.push({
                path: `${stepPath}.iterator`,
                message: 'loop步骤缺少iterator字段',
                value: step,
            });
        } else {
            if (!step.iterator.source) {
                errors.push({
                    path: `${stepPath}.iterator.source`,
                    message: '循环迭代器缺少source字段',
                    value: step.iterator,
                });
            }

            if (!step.iterator.variable) {
                errors.push({
                    path: `${stepPath}.iterator.variable`,
                    message: '循环迭代器缺少variable字段',
                    value: step.iterator,
                });
            }
        }

        if (!step.steps || !Array.isArray(step.steps) || step.steps.length === 0) {
            errors.push({
                path: `${stepPath}.steps`,
                message: 'loop步骤需要非空的steps数组',
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
                message: 'parallel步骤需要至少2个分支',
                value: step.branches,
            });
        } else {
            step.branches.forEach((branch: any, index: number) => {
                const branchPath = `${stepPath}.branches[${index}]`;

                if (!branch.name) {
                    errors.push({
                        path: `${branchPath}.name`,
                        message: '并行分支缺少name字段',
                        value: branch,
                    });
                }

                if (!branch.steps || !Array.isArray(branch.steps) || branch.steps.length === 0) {
                    errors.push({
                        path: `${branchPath}.steps`,
                        message: '并行分支需要非空的steps数组',
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
                message: 'workflow步骤缺少workflowId字段',
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
                if (typeof dep !== 'string') {
                    errors.push({
                        path: `${stepPath}.dependsOn`,
                        message: '依赖项必须是字符串',
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
                dependencies.filter((dep: any) => typeof dep === 'string')
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
            for (const input of workflow.inputs) {
                if (input.name) {
                    availableVariables.add(`inputs.${input.name}`);
                }
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
                    availableVariables.add(`steps.${step.id}.output`);
                }
            }
        }

        // 使用表达式解析器验证模板变量引用
        const validationResult = validateTemplateExpressionsInObject(
            workflow,
            availableVariables,
            'root'
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
}

/**
 * 🌌 便捷验证函数
 */
export function validateWorkflow(workflow: any): ValidationResult {
    const validator = new WorkflowValidator();
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
        const errorMessage = result.errors.map((e) => `${e.path}: ${e.message}`).join('; ');
        throw new Error(`【符咒解析】工作流验证失败: ${errorMessage}`);
    }

    return result.data;
}

// 导出验证器类和相关类型（WorkflowValidator 已在类定义时导出）
export type { ValidationResult, ValidationError };

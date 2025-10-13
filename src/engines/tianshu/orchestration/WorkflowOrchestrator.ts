/**
 * 工作流编排器
 * 负责工作流的执行调度、步骤依赖管理和并行/串行控制
 */

import { EventEmitter } from "events";
import { UICommand } from "../types/commands";
import {
    WorkflowDefinition,
    ExecutionContext,
    WorkflowStep,
    StepResult,
    WorkflowExecutionOptions,
} from "../types/workflows";
import { VariableResolver } from "./VariableResolver";
import { IStepExecutor } from "@engines/common/interfaces";
import { loggers } from "@common/logger";
import { validateStepOutput, type ValidationResult } from "./schema-validator";
import { extractOutputFromStep, generateExecutionId } from "./utils";

const logger = loggers.tianshu;

/**
 * 编排器配置
 */
export interface OrchestratorConfig {
    /** 最大并发数 */
    maxConcurrency: number;
    /** 默认超时时间（毫秒） */
    defaultTimeout: number;
    /** 步骤执行超时时间（毫秒） */
    stepTimeout?: number;
    /** 重试配置 */
    retryConfig?: {
        maxAttempts: number;
        delay: number;
        backoff: "linear" | "exponential";
    };
    /** 步骤执行器 */
    stepExecutor: IStepExecutor;
    variableResolver?: VariableResolver;
}

/**
 * 工作流编排器
 */
export class WorkflowOrchestrator extends EventEmitter {
    // private config: OrchestratorConfig;
    private stepExecutor: IStepExecutor;
    private variableResolver: VariableResolver;
    private activeExecutions = new Map<string, ExecutionContext>();
    private executionQueue: Array<{
        workflow: WorkflowDefinition;
        command: UICommand;
        options: WorkflowExecutionOptions;
    }> = [];
    private isProcessing = false;

    constructor(config: OrchestratorConfig) {
        super();
        // 使用传入的配置，如果没有传入，则使用默认的配置
        // this.config = {
        //     stepTimeout: 10000,
        //     retryConfig: {
        //         maxAttempts: 3,
        //         delay: 1000,
        //         backoff: "exponential",
        //     },
        //     ...config,
        // };

        // 使用传入的步骤执行器，必须提供外部步骤执行器
        if (!config.stepExecutor) {
            throw new Error("stepExecutor is required in WorkflowOrchestrator config");
        }
        this.stepExecutor = config.stepExecutor;

        // 使用传入的变量解析器，如果没有传入，则使用默认的变量解析器
        this.variableResolver =
            config.variableResolver ||
            new VariableResolver({
                globalVariables: {},
            });

        // 确保variableResolver存在
        if (!this.variableResolver) {
            throw new Error("WorkflowOrchestrator requires a valid VariableResolver");
        }

        this.setupEventHandlers();
    }

    /**
     * 初始化编排器
     */
    async initialize(): Promise<void> {
        logger.info("🌌 初始化编排器");
        if (this.stepExecutor.initialize) {
            await this.stepExecutor.initialize();
        }
        logger.info("🌌 编排器初始化完成");
    }

    /**
     * 执行工作流
     */
    async executeWorkflow(
        workflow: WorkflowDefinition,
        command: UICommand,
        options: WorkflowExecutionOptions = {},
    ): Promise<string> {
        const executionId = generateExecutionId();

        // 更新变量解析器配置，传入工作流步骤定义用于output_schema验证
        this.variableResolver = new VariableResolver({
            globalVariables: this.variableResolver.config.globalVariables,
            strictMode: this.variableResolver.config.strictMode,
            variablePrefix: this.variableResolver.config.variablePrefix,
            workflowSteps: workflow.steps,
        });

        // 创建执行上下文
        const context: ExecutionContext = {
            executionId,
            workflowId: workflow.id,
            commandId: command.id,
            startTime: Date.now(),
            status: "pending",
            input: command.params,
            variables: {
                ...workflow.variables,
                ...options.variables,
            },
            stepResults: new Map(),
            metrics: {
                stepCount: workflow.steps.length,
                successStepCount: 0,
                failedStepCount: 0,
                skippedStepCount: 0,
                totalDuration: 0,
            },
        };

        // 添加到队列
        this.executionQueue.push({ workflow, command, options });
        this.activeExecutions.set(command.id, context);

        // 开始处理队列
        this.processQueue();

        return executionId;
    }

    /**
     * 取消工作流执行
     */
    async cancelExecution(executionId: string): Promise<boolean> {
        const context = this.activeExecutions.get(executionId);
        if (!context) {
            return false;
        }

        context.status = "cancelled";
        this.activeExecutions.delete(executionId);

        this.emit("workflowCancelled", { executionId });
        return true;
    }

    /**
     * 获取执行上下文
     */
    getExecutionContext(executionId: string): ExecutionContext | undefined {
        return this.activeExecutions.get(executionId);
    }

    /**
     * 获取所有活跃执行
     */
    getAllActiveExecutions(): ExecutionContext[] {
        return Array.from(this.activeExecutions.values());
    }

    /**
     * 清理资源
     */
    async cleanup(): Promise<void> {
        // 取消所有活跃执行
        for (const executionId of this.activeExecutions.keys()) {
            await this.cancelExecution(executionId);
        }

        // 清理组件
        // 注意：IStepExecutor接口没有cleanup方法，不需要调用
        await this.variableResolver.cleanup();

        this.executionQueue = [];
        this.isProcessing = false;
    }

    /**
     * 设置事件处理器
     * 如果步骤执行器有事件处理器，则将事件处理器绑定到编排器
     * 否则，则不绑定事件处理器
     * 绑定的事件处理器包括：
     * - stepStarted
     * - stepCompleted
     * - stepFailed
     * - stepProgress
     */
    private setupEventHandlers(): void {
        this.stepExecutor.on("stepStarted", (data) => {
            this.emit("stepStarted", data);
        });

        this.stepExecutor.on("stepCompleted", (data) => {
            this.emit("stepCompleted", data);
        });

        this.stepExecutor.on("stepFailed", (data) => {
            this.emit("stepFailed", data);
        });

        this.stepExecutor.on("stepProgress", (data) => {
            this.emit("stepProgress", data);
        });
    }

    /**
     * 处理执行队列
     */
    private async processQueue(): Promise<void> {
        if (this.isProcessing || this.executionQueue.length === 0) {
            return;
        }

        this.isProcessing = true;

        while (this.executionQueue.length > 0) {
            const execution = this.executionQueue.shift();
            if (!execution) continue;
            const { workflow, command, options } = execution;
            await this.executeWorkflowInternal(workflow, command, options);
        }

        this.isProcessing = false;
    }

    /**
     * 内部工作流执行
     */
    private async executeWorkflowInternal(
        workflow: WorkflowDefinition,
        command: UICommand,
        _options: WorkflowExecutionOptions,
    ): Promise<void> {
        const context = this.activeExecutions.get(command.id);
        logger.info("🌌 内部工作流执行", { workflowId: workflow.id });
        if (!context) {
            logger.error("🌌 内部工作流执行失败", { workflowId: workflow.id });
            return;
        }

        try {
            context.status = "running";
            this.emit("workflowStarted", context);

            // 执行工作流步骤
            await this.executeSteps(workflow.steps, context);

            // 检查执行结果
            if (context.status === "running") {
                context.status = "completed";
                context.metrics.totalDuration = Date.now() - context.startTime;

                // 收集工作流输出结果
                context.output = this.collectWorkflowOutput(workflow, context);

                this.emit("workflowCompleted", context);
            }
        } catch (error) {
            context.status = "failed";
            context.error = (error as Error).message;
            context.metrics.totalDuration = Date.now() - context.startTime;
            this.emit("workflowFailed", context);
        } finally {
            this.activeExecutions.delete(command.id);
        }
    }

    /**
     * 执行工作流步骤
     */
    private async executeSteps(steps: WorkflowStep[], context: ExecutionContext): Promise<void> {
        for (const step of steps) {
            if (context.status !== "running") {
                break;
            }

            try {
                // 检查步骤依赖
                if (!this.checkStepDependencies(step, context)) {
                    continue;
                }

                // 解析步骤变量
                const resolvedStep = await this.variableResolver.resolveStep(step, context);

                // 执行步骤
                const result = await this.executeStep(resolvedStep, context);

                // 更新上下文 - 使用step.id作为主键，因为依赖关系使用的是id
                const stepKey = step.id || step.name || `step_${context.stepResults.size}`;
                context.stepResults.set(stepKey, result);
                context.currentStepId = stepKey;

                // 更新指标
                if (result.status === "completed") {
                    context.metrics.successStepCount++;
                } else if (result.status === "failed") {
                    context.metrics.failedStepCount++;
                } else if (result.skipped) {
                    context.metrics.skippedStepCount++;
                }

                // 处理步骤输出
                if (result.output && step.output) {
                    this.mergeStepOutput(result.output, step.output, context);
                }

                // 发送进度更新
                this.emitProgressUpdate(context);
            } catch (error) {
                const result: StepResult = {
                    stepId: step.id || step.name || "unknown",
                    status: "failed",
                    startTime: Date.now(),
                    endTime: Date.now(),
                    duration: 0,
                    error: (error as Error).message,
                    retryCount: 0,
                    skipped: false,
                };

                const stepKey = step.id || step.name || `step_${context.stepResults.size}`;
                context.stepResults.set(stepKey, result);
                context.metrics.failedStepCount++;

                // 如果步骤不允许忽略错误，停止执行
                if (!step.ignoreError) {
                    throw error;
                }
            }
        }
    }

    /**
     * 执行单个步骤
     */
    private async executeStep(step: WorkflowStep, context: ExecutionContext): Promise<StepResult> {
        const result: StepResult = {
            stepId: step.id || step.name || "unknown",
            status: "pending",
            startTime: Date.now(),
            retryCount: 0,
            skipped: false,
        };

        try {
            result.status = "running";
            this.emit("stepStarted", { step, context });

            // 根据步骤类型选择处理器
            if (step.type === "condition") {
                result.output = await this.executeConditionStep(step, context);
            } else if (step.type === "loop") {
                result.output = await this.executeLoopStep(step, context);
            } else {
                // action, builtin等步骤交给外部stepExecutor处理
                const stepExecutionResult = await this.stepExecutor.executeAction(step, context);

                // 检查执行结果
                if (stepExecutionResult.success) {
                    result.output = stepExecutionResult.data;
                } else {
                    throw new Error(stepExecutionResult.error || "Step execution failed");
                }
            }

            // 验证步骤输出是否匹配 output_schema (JSON Schema)
            if (step.output_schema) {
                const validationResult: ValidationResult = validateStepOutput(
                    result.output,
                    step.output_schema,
                    step.id || "unknown",
                );

                if (validationResult.valid === false) {
                    // 类型守卫：validationResult.valid === false 时，errors属性存在
                    const errorMsg =
                        `🌌 步骤「${step.id}」输出数据不符合output_schema:\n` +
                        validationResult.errors.map((e: string) => `  - ${e}`).join("\n") +
                        `\n实际输出: ${JSON.stringify(result.output, null, 2)}` +
                        `\n预期schema: ${JSON.stringify(step.output_schema, null, 2)}`;

                    logger.error(errorMsg);
                    throw new Error(errorMsg);
                }

                logger.info(`🌌 步骤「${step.id}」输出数据验证通过`);
            }

            result.status = "completed";
            result.endTime = Date.now();
            result.duration = result.endTime - result.startTime;

            this.emit("stepCompleted", { step, result, context });
        } catch (error) {
            result.status = "failed";
            result.endTime = Date.now();
            result.duration = result.endTime - result.startTime;
            result.error = (error as Error).message;

            this.emit("stepFailed", { step, result, context, error });
            throw error;
        }

        return result;
    }

    /**
     * 执行条件步骤
     */
    private async executeConditionStep(
        step: WorkflowStep,
        context: ExecutionContext,
    ): Promise<any> {
        if (!step.condition) {
            throw new Error(`Condition step ${step.id || step.name} missing condition expression`);
        }

        const conditionResult = this.evaluateCondition(step.condition, context);

        logger.info(`🌌 条件评估: ${step.id || step.name} = ${conditionResult}`, {
            stepId: step.id || step.name,
            condition: step.condition,
            result: conditionResult,
        });

        // 执行条件分支中的步骤
        const branchResults: any[] = [];
        logger.info(
            `🌌 条件分支检查: conditionResult=${conditionResult}, hasOnTrue=${!!step.onTrue}, hasOnFalse=${!!step.onFalse}`,
        );

        if (conditionResult && step.onTrue) {
            logger.info(
                `🌌 执行条件真分支: ${step.id || step.name}, 包含 ${step.onTrue.length} 个步骤`,
            );
            // 执行 onTrue 分支中的所有步骤
            for (const subStep of step.onTrue) {
                if (!this.variableResolver) {
                    throw new Error(
                        "WorkflowOrchestrator variableResolver is undefined in onTrue branch",
                    );
                }
                const resolvedStep = await this.variableResolver.resolveStep(subStep, context);
                const result = await this.executeStep(resolvedStep, context);
                branchResults.push(result);
                // 将子步骤结果存储到context中 - 使用id作为主键
                const subStepKey = subStep.id || subStep.name;
                if (subStepKey) {
                    context.stepResults.set(subStepKey, result);
                }
            }
        } else if (!conditionResult && step.onFalse) {
            logger.info(`🌌 执行条件假分支: ${step.id || step.name}`);
            // 执行 onFalse 分支中的所有步骤
            for (const subStep of step.onFalse) {
                if (!this.variableResolver) {
                    throw new Error(
                        "WorkflowOrchestrator variableResolver is undefined in onFalse branch",
                    );
                }
                const resolvedStep = await this.variableResolver.resolveStep(subStep, context);
                const result = await this.executeStep(resolvedStep, context);
                branchResults.push(result);
                // 将子步骤结果存储到context中 - 使用id作为主键
                const subStepKey = subStep.id || subStep.name;
                if (subStepKey) {
                    context.stepResults.set(subStepKey, result);
                }
            }
        }

        return {
            success: true,
            result: conditionResult,
            branchResults: branchResults,
            stepType: "condition",
            stepId: step.id || step.name,
        };
    }

    /**
     * 执行循环步骤
     */
    private async executeLoopStep(step: WorkflowStep, context: ExecutionContext): Promise<any> {
        if (!step.loop) {
            throw new Error(`Loop step ${step.id || step.name} missing loop configuration`);
        }

        const loopConfig = step.loop;
        const iterationResults: any[] = [];

        // 解析循环次数或数组
        let iterations: any[] = [];
        if (typeof loopConfig.count === "number") {
            iterations = Array.from({ length: loopConfig.count }, (_, i) => i);
        } else if (Array.isArray(loopConfig.count)) {
            iterations = loopConfig.count;
        } else {
            // 动态解析循环计数
            const resolvedCount = this.variableResolver.resolveObject(loopConfig.count, context);
            if (typeof resolvedCount === "number") {
                iterations = Array.from({ length: resolvedCount }, (_, i) => i);
            } else if (Array.isArray(resolvedCount)) {
                iterations = resolvedCount;
            } else {
                throw new Error(
                    `Invalid loop count in step ${step.id || step.name}: ${JSON.stringify(resolvedCount)}`,
                );
            }
        }

        // 执行循环
        for (let i = 0; i < iterations.length; i++) {
            const iterationValue = iterations[i];

            // 创建循环变量上下文
            const loopContext = {
                ...context,
                variables: {
                    ...context.variables,
                    [loopConfig.variable]: iterationValue,
                    [`${loopConfig.variable}_index`]: i,
                },
            };

            // 执行循环步骤
            if (loopConfig.steps && loopConfig.steps.length > 0) {
                await this.executeSteps(loopConfig.steps, loopContext);

                // 收集循环结果
                const iterationResult = {
                    iteration: i,
                    value: iterationValue,
                    stepResults: Array.from(loopContext.stepResults.entries()),
                };
                iterationResults.push(iterationResult);
            }
        }

        logger.info(`🌌 循环执行完成: ${step.id || step.name}, 迭代次数: ${iterations.length}`, {
            stepId: step.id || step.name,
            iterationCount: iterations.length,
        });

        return {
            success: true,
            result: iterationResults,
            stepType: "loop",
            stepId: step.id || step.name,
            iterationCount: iterations.length,
        };
    }

    /**
     * 评估条件表达式
     */
    private evaluateCondition(condition: any, context: ExecutionContext): boolean {
        if (!condition || typeof condition !== "object") {
            return Boolean(condition);
        }

        const { field, operator, value, customFunction } = condition;

        logger.debug(`🌌 【条件评估】field=${field}, operator=${operator}, value=${value}`);

        // 自定义函数条件
        if (customFunction) {
            // 这里可以扩展自定义函数支持
            logger.warn(`🌌 自定义条件函数暂不支持: ${customFunction}`);
            return false;
        }

        // 如果field本身是模板字符串，需要先解析
        let resolvedField = field;
        if (typeof field === "string" && field.includes("{{")) {
            resolvedField = this.variableResolver.resolveString(field, context);
            logger.debug(`🌌 【条件评估】解析field模板: ${field} -> ${resolvedField}`);
        }

        // 获取字段值
        const fieldValue =
            typeof resolvedField === "string"
                ? this.getFieldValue(resolvedField, context)
                : resolvedField;

        logger.debug(
            `🌌 【条件评估】最终比较: fieldValue=${fieldValue} (type=${typeof fieldValue}) vs value=${value} (type=${typeof value})`,
        );

        // 根据操作符评估
        switch (operator) {
            case "eq":
            case "equals":
                const result = fieldValue === value;
                logger.debug(`🌌 【条件评估】结果: ${result}`);
                return result;
            case "ne":
            case "notEquals":
                return fieldValue !== value;
            case "gt":
                return fieldValue > value;
            case "gte":
                return fieldValue >= value;
            case "lt":
                return fieldValue < value;
            case "lte":
                return fieldValue <= value;
            case "in":
                return Array.isArray(value) && value.includes(fieldValue);
            case "notIn":
                return Array.isArray(value) && !value.includes(fieldValue);
            case "exists":
                return fieldValue !== undefined && fieldValue !== null;
            case "notExists":
                return fieldValue === undefined || fieldValue === null;
            case "startsWith":
                return typeof fieldValue === "string" && fieldValue.startsWith(String(value));
            case "endsWith":
                return typeof fieldValue === "string" && fieldValue.endsWith(String(value));
            case "contains":
                return typeof fieldValue === "string" && fieldValue.includes(String(value));
            case "isEmpty":
                return (
                    !fieldValue ||
                    (typeof fieldValue === "string" && fieldValue.trim() === "") ||
                    (Array.isArray(fieldValue) && fieldValue.length === 0) ||
                    (typeof fieldValue === "object" && Object.keys(fieldValue).length === 0)
                );
            case "isNotEmpty":
                return (
                    fieldValue &&
                    !(typeof fieldValue === "string" && fieldValue.trim() === "") &&
                    !(Array.isArray(fieldValue) && fieldValue.length === 0) &&
                    !(typeof fieldValue === "object" && Object.keys(fieldValue).length === 0)
                );
            case "string_maxlen":
                // 字符串最大长度验证：检查字段值是否为字符串且长度不超过指定值
                // 用途：验证输入字符串长度限制，防止过长输入
                // 示例：{ field: "inputs.name", operator: "string_maxlen", value: 50 }
                return typeof fieldValue === "string" && fieldValue.length <= value;
            case "string_minlen":
                // 字符串最小长度验证：检查字段值是否为字符串且长度不少于指定值
                // 用途：验证必填字段的最小长度要求
                // 示例：{ field: "inputs.password", operator: "string_minlen", value: 8 }
                return typeof fieldValue === "string" && fieldValue.length >= value;
            case "optional_string_maxlen":
                // 可选字符串最大长度验证：字段不存在时返回true，存在时检查长度限制
                // 用途：验证可选输入字段的长度限制，允许字段不存在
                // 示例：{ field: "inputs.description", operator: "optional_string_maxlen", value: 200 }
                // 逻辑：字段不存在/null/undefined -> true（可选通过）
                //      字段存在且为字符串 -> 检查长度 <= value
                if (fieldValue === undefined || fieldValue === null) {
                    return true;
                }
                return typeof fieldValue === "string" && fieldValue.length <= value;
            case "optional_string_minlen":
                // 可选字符串最小长度验证：字段不存在时返回true，存在时检查最小长度
                // 用途：验证可选输入字段的最小长度要求，允许字段不存在
                // 示例：{ field: "inputs.title", operator: "optional_string_minlen", value: 3 }
                // 逻辑：字段不存在/null/undefined -> true（可选通过）
                //      字段存在且为字符串 -> 检查长度 >= value
                if (fieldValue === undefined || fieldValue === null) {
                    return true;
                }
                return typeof fieldValue === "string" && fieldValue.length >= value;
            default:
                logger.warn(`🌌 未知条件操作符: ${operator}`);
                return false;
        }
    }

    /**
     * 获取字段值，支持嵌套路径
     *
     * 支持的路径格式：
     * - steps.stepId.field - 访问步骤结果（推荐，复数表示步骤集合）
     * - step.stepId.field - 向后兼容的单数形式
     * - inputs.field - 访问工作流输入参数
     * - variables.field - 访问执行上下文变量
     */
    private getFieldValue(fieldPath: string, context: ExecutionContext): any {
        if (!fieldPath) return undefined;

        // 支持 steps.stepId.field（推荐）和 step.stepId.field（兼容）
        // steps 复数形式语义：steps.validate_delta = "步骤集合中ID为validate_delta的步骤"
        if (fieldPath.startsWith("steps.") || fieldPath.startsWith("step.")) {
            const pathParts = fieldPath.split(".");
            if (pathParts.length >= 3) {
                const stepId = pathParts[1];
                const stepResult = context.stepResults.get(stepId);
                if (!stepResult) return undefined;

                let current = stepResult;
                for (let i = 2; i < pathParts.length; i++) {
                    current = current?.[pathParts[i]];
                }
                return current;
            }
        }

        // 支持input.field格式（用于访问执行上下文输入）
        if (fieldPath.startsWith("input.")) {
            const inputPath = fieldPath.substring(6); // 移除"input."
            return this.getNestedValue(context.input, inputPath);
        }

        // 支持inputs.field格式（用于访问工作流定义的输入参数）
        if (fieldPath.startsWith("inputs.")) {
            const inputPath = fieldPath.substring(7); // 移除"inputs."
            return this.getNestedValue(context.input, inputPath);
        }

        // 支持variables.field格式
        if (fieldPath.startsWith("variables.")) {
            const varPath = fieldPath.substring(10); // 移除"variables."
            return this.getNestedValue(context.variables, varPath);
        }

        // 直接字段访问
        return context.variables[fieldPath] || context.input?.[fieldPath];
    }

    /**
     * 检查步骤依赖
     */
    private checkStepDependencies(step: WorkflowStep, context: ExecutionContext): boolean {
        if (!step.dependsOn || step.dependsOn.length === 0) {
            return true;
        }

        for (const depStepId of step.dependsOn) {
            const depResult = context.stepResults.get(depStepId);
            if (!depResult || depResult.status !== "completed") {
                return false;
            }
        }

        return true;
    }

    /**
     * 合并步骤输出
     */
    private mergeStepOutput(
        output: any,
        outputMapping: Record<string, string>,
        context: ExecutionContext,
    ): void {
        for (const [key, path] of Object.entries(outputMapping)) {
            const value = this.getNestedValue(output, path);
            context.variables[key] = value;
        }
    }

    /**
     * 获取嵌套值
     */
    private getNestedValue(obj: any, path: string): any {
        return path.split(".").reduce((current, key) => current?.[key], obj);
    }

    /**
     * 发送进度更新
     */
    private emitProgressUpdate(context: ExecutionContext): void {
        const progress = this.calculateProgress(context);

        this.emit("stepProgress", {
            commandId: context.commandId,
            currentStep: context.metrics.successStepCount + context.metrics.failedStepCount,
            totalSteps: context.metrics.stepCount,
            progress,
            stepDescription: context.currentStepId || "Unknown",
            timestamp: Date.now(),
        });
    }

    /**
     * 计算进度
     */
    private calculateProgress(context: ExecutionContext): number {
        if (context.metrics.stepCount === 0) {
            return 0;
        }
        return (
            ((context.metrics.successStepCount + context.metrics.failedStepCount) /
                context.metrics.stepCount) *
            100
        );
    }

    /**
     * 收集工作流输出结果
     */
    private collectWorkflowOutput(
        workflow: WorkflowDefinition,
        context: ExecutionContext,
    ): Record<string, any> {
        const output: Record<string, any> = {};

        // 如果没有定义outputSchema，尝试从最后一步获取输出
        if (!workflow.outputSchema || Object.keys(workflow.outputSchema).length === 0) {
            const lastStep = workflow.steps[workflow.steps.length - 1];
            if (lastStep) {
                const lastStepResult = context.stepResults.get(lastStep.id || lastStep.name || "");
                if (lastStepResult && lastStepResult.output) {
                    // 如果最后一步有output定义，使用它
                    if (lastStep.output) {
                        return extractOutputFromStep(lastStep, lastStepResult, logger);
                    }
                    // 否则直接返回步骤输出
                    return lastStepResult.output;
                }
            }
            return output;
        }

        // 根据工作流定义的outputSchema收集数据
        for (const [outputKey, _outputDef] of Object.entries(workflow.outputSchema)) {
            try {
                // 尝试从最后一步获取对应的输出
                const lastStep = workflow.steps[workflow.steps.length - 1];
                if (lastStep) {
                    const lastStepResult = context.stepResults.get(
                        lastStep.id || lastStep.name || "",
                    );
                    if (lastStepResult && lastStepResult.output) {
                        // 根据输出键名从步骤输出中提取数据
                        output[outputKey] = this.extractOutputValue(
                            lastStepResult.output,
                            outputKey,
                        );
                    }
                }
            } catch (error) {
                logger.warn(`收集输出字段 ${outputKey} 失败:`, error);
                output[outputKey] = undefined;
            }
        }

        return output;
    }

    /**
     * 从步骤结果中提取输出值
     */
    private extractOutputValue(stepOutput: any, outputKey: string): any {
        // 如果步骤输出是对象，尝试直接获取对应字段
        if (typeof stepOutput === "object" && stepOutput !== null) {
            // 优先从data字段获取
            if (stepOutput.data && typeof stepOutput.data === "object") {
                return stepOutput.data[outputKey];
            }
            // 然后从根级别获取
            if (outputKey in stepOutput) {
                return stepOutput[outputKey];
            }
            // 最后尝试从result字段获取
            if (stepOutput.result && typeof stepOutput.result === "object") {
                return stepOutput.result[outputKey];
            }
        }

        // 如果无法提取特定字段，返回整个输出
        return stepOutput;
    }
}

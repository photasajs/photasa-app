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
import { StepExecutor } from "./StepExecutor";
import { VariableResolver } from "./VariableResolver";

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
}

/**
 * 工作流编排器
 */
export class WorkflowOrchestrator extends EventEmitter {
    private config: OrchestratorConfig;
    private stepExecutor: StepExecutor;
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
        this.config = {
            stepTimeout: 10000,
            retryConfig: {
                maxAttempts: 3,
                delay: 1000,
                backoff: "exponential",
            },
            ...config,
        };

        this.stepExecutor = new StepExecutor({
            timeout: this.config.stepTimeout || 10000,
            retryConfig: this.config.retryConfig || {
                maxAttempts: 3,
                delay: 1000,
                backoff: "exponential",
            },
        });

        this.variableResolver = new VariableResolver({
            globalVariables: {},
        });

        this.setupEventHandlers();
    }

    /**
     * 初始化编排器
     */
    async initialize(): Promise<void> {
        await this.stepExecutor.initialize();
        await this.variableResolver.initialize();
    }

    /**
     * 执行工作流
     */
    async executeWorkflow(
        workflow: WorkflowDefinition,
        command: UICommand,
        options: WorkflowExecutionOptions = {},
    ): Promise<string> {
        const executionId = this.generateExecutionId();

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
        this.activeExecutions.set(executionId, context);

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
        await this.stepExecutor.cleanup();
        await this.variableResolver.cleanup();

        this.executionQueue = [];
        this.isProcessing = false;
    }

    /**
     * 设置事件处理器
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
        _command: UICommand,
        _options: WorkflowExecutionOptions,
    ): Promise<void> {
        const context = this.activeExecutions.get(workflow.id);
        if (!context) {
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
                this.emit("workflowCompleted", context);
            }
        } catch (error) {
            context.status = "failed";
            context.error = (error as Error).message;
            context.metrics.totalDuration = Date.now() - context.startTime;
            this.emit("workflowFailed", context);
        } finally {
            this.activeExecutions.delete(workflow.id);
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

                // 更新上下文
                context.stepResults.set(step.id, result);
                context.currentStepId = step.id;

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
                    stepId: step.id,
                    status: "failed",
                    startTime: Date.now(),
                    endTime: Date.now(),
                    duration: 0,
                    error: (error as Error).message,
                    retryCount: 0,
                    skipped: false,
                };

                context.stepResults.set(step.id, result);
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
            stepId: step.id,
            status: "pending",
            startTime: Date.now(),
            retryCount: 0,
            skipped: false,
        };

        try {
            result.status = "running";
            this.emit("stepStarted", { step, context });

            // 根据步骤类型执行
            switch (step.type) {
                case "action":
                    result.output = await this.stepExecutor.executeAction(step, context);
                    break;
                case "condition":
                    result.output = await this.stepExecutor.executeCondition(step, context);
                    break;
                case "loop":
                    result.output = await this.stepExecutor.executeLoop(step, context);
                    break;
                case "parallel":
                    result.output = await this.stepExecutor.executeParallel(step, context);
                    break;
                case "sequence":
                    result.output = await this.stepExecutor.executeSequence(step, context);
                    break;
                case "delay":
                    result.output = await this.stepExecutor.executeDelay(step, context);
                    break;
                case "retry":
                    result.output = await this.stepExecutor.executeRetry(step, context);
                    break;
                case "error_handler":
                    result.output = await this.stepExecutor.executeErrorHandler(step, context);
                    break;
                default:
                    throw new Error(`Unknown step type: ${step.type}`);
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
     * 生成执行ID
     */
    private generateExecutionId(): string {
        return `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
}

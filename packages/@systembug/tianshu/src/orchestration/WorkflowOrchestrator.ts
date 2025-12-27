/**
 * 驺吾工作流编排器
 * 负责工作流的执行调度、步骤依赖管理和并行/串行控制
 *
 * 平台中立：不依赖Node.js或浏览器特定API
 */

import { EventEmitter } from "events";
import {
    type IWorkflowOrchestrator,
    type IStepExecutor,
    type WorkflowExecutionOptions,
} from "../types/runtime-interfaces";
import { VariableResolver } from "./VariableResolver";
import { ConditionExecutor } from "./executors/ConditionExecutor";
import { LoopExecutor } from "./executors/LoopExecutor";
import { createLogger, type Logger } from "@systembug/logger";
import type {
    WorkflowDefinition,
    WorkflowStep,
    ExecutionContext,
    StepResult,
    ConditionStep,
    LoopStep,
    Condition,
} from "@zouwu-wf/workflow";

const DEFAULT_CONFIG = {
    maxConcurrency: 10,
    defaultTimeout: 60000,
};

export interface OrchestratorConfig {
    maxConcurrency?: number;
    defaultTimeout?: number;
    stepExecutor: IStepExecutor;
    variableResolver?: VariableResolver;
    logger?: Logger;
}

export class WorkflowOrchestrator extends EventEmitter implements IWorkflowOrchestrator {
    private stepExecutor: IStepExecutor;
    private variableResolver: VariableResolver;
    private conditionExecutor: ConditionExecutor;
    private loopExecutor: LoopExecutor;
    private logger: Logger;
    // @ts-ignore - Config retained for future concurrency features
    private config: Required<Pick<OrchestratorConfig, "maxConcurrency" | "defaultTimeout">>;

    private activeExecutions = new Map<string, ExecutionContext>();
    private executionQueue: Array<{
        workflow: WorkflowDefinition;
        command: any;
        options: WorkflowExecutionOptions;
    }> = [];
    private isProcessing = false;

    constructor(config: OrchestratorConfig) {
        super();
        this.stepExecutor = config.stepExecutor;
        this.logger = config.logger || createLogger();
        this.variableResolver =
            config.variableResolver ||
            new VariableResolver({
                globalVariables: {},
                logger: this.logger,
            });
        this.conditionExecutor = new ConditionExecutor(this.logger);
        this.loopExecutor = new LoopExecutor(this.logger);
        this.config = {
            maxConcurrency: config.maxConcurrency || DEFAULT_CONFIG.maxConcurrency,
            defaultTimeout: config.defaultTimeout || DEFAULT_CONFIG.defaultTimeout,
        };
        this.setupEventHandlers();
    }

    async initialize(): Promise<void> {
        this.logger.info("🌌 初始化驺吾编排器");
        if (this.stepExecutor.initialize) {
            await this.stepExecutor.initialize();
        }
    }

    async executeWorkflow(
        workflow: WorkflowDefinition,
        command: any,
        options: WorkflowExecutionOptions = {},
    ): Promise<string> {
        const executionId = this.generateExecutionId();

        const context: ExecutionContext = {
            executionId,
            workflowId: workflow.id,
            commandId: command.id,
            startTime: Date.now(),
            status: "pending",
            input: command.params || {},
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

        this.executionQueue.push({ workflow, command, options });
        this.activeExecutions.set(executionId, context);

        this.processQueue().catch((err) => {
            this.logger.error("Error processing queue", err);
        });

        return executionId;
    }

    async cancelExecution(executionId: string): Promise<boolean> {
        const context = this.activeExecutions.get(executionId);
        if (!context) return false;
        context.status = "cancelled";
        this.activeExecutions.delete(executionId);
        this.emit("workflowCancelled", { executionId });
        return true;
    }

    getExecutionContext(executionId: string): ExecutionContext | undefined {
        return this.activeExecutions.get(executionId);
    }

    async cleanup(): Promise<void> {
        for (const executionId of this.activeExecutions.keys()) {
            await this.cancelExecution(executionId);
        }
        this.executionQueue = [];
        this.isProcessing = false;
    }

    private setupEventHandlers(): void {
        this.stepExecutor.on("stepStarted", (data) => this.emit("stepStarted", data));
        this.stepExecutor.on("stepCompleted", (data) => this.emit("stepCompleted", data));
        this.stepExecutor.on("stepFailed", (data) => this.emit("stepFailed", data));
        this.stepExecutor.on("stepProgress", (data) => this.emit("stepProgress", data));
    }

    private async processQueue(): Promise<void> {
        if (this.isProcessing || this.executionQueue.length === 0) return;
        this.isProcessing = true;

        while (this.executionQueue.length > 0) {
            const execution = this.executionQueue.shift();
            if (!execution) continue;

            for (const [_id, ctx] of this.activeExecutions.entries()) {
                if (
                    ctx.workflowId === execution.workflow.id &&
                    ctx.commandId === execution.command.id &&
                    ctx.status === "pending"
                ) {
                    await this.executeWorkflowInternal(execution.workflow, ctx, execution.options);
                    break;
                }
            }
        }
        this.isProcessing = false;
    }

    private async executeWorkflowInternal(
        workflow: WorkflowDefinition,
        context: ExecutionContext,
        _options: WorkflowExecutionOptions,
    ): Promise<void> {
        this.logger.info(`🌌 开始执行工作流: ${workflow.id}`, { executionId: context.executionId });

        try {
            context.status = "running";
            this.emit("workflowStarted", context);

            await this.executeSteps(workflow.steps, context);

            if (context.status === "running") {
                context.status = "completed";
                context.metrics.totalDuration = Date.now() - context.startTime;
                context.output = context.variables;
                this.emit("workflowCompleted", context);
            }
        } catch (error) {
            context.status = "failed";
            context.error = (error as Error).message;
            context.metrics.totalDuration = Date.now() - context.startTime;
            this.emit("workflowFailed", context);
            this.logger.error(`Workflow failed: ${context.workflowId}`, error);
        }
    }

    private async executeSteps(steps: WorkflowStep[], context: ExecutionContext): Promise<void> {
        for (const step of steps) {
            if (context.status !== "running") break;

            try {
                if (!this.checkStepDependencies(step, context)) continue;

                const resolvedStep = this.variableResolver.resolveObject(step, context);
                const result = await this.executeStep(resolvedStep, context);

                const stepKey = step.id || step.name || `step_${context.stepResults.size}`;
                context.stepResults.set(stepKey, result);
                context.currentStepId = stepKey;

                if (result.status === "completed") context.metrics.successStepCount++;
                else if (result.status === "failed") context.metrics.failedStepCount++;
                else if (result.skipped) context.metrics.skippedStepCount++;

                if ("output" in step && step.output && result.output) {
                    const outputMap = step.output as Record<string, string>;
                    for (const [key, path] of Object.entries(outputMap)) {
                        const val = this.getNestedValue(result.output, path);
                        context.variables[key] = val;
                    }
                }

                this.emitProgressUpdate(context);
            } catch (error) {
                const result: StepResult = {
                    stepId: step.id || step.name || "unknown",
                    status: "failed",
                    startTime: Date.now(),
                    endTime: Date.now(),
                    retryCount: 0,
                    skipped: false,
                    error: (error as Error).message,
                };
                const stepKey = step.id || step.name || `step_${context.stepResults.size}`;
                context.stepResults.set(stepKey, result);
                context.metrics.failedStepCount++;

                if (!step.ignoreError) throw error;
            }
        }
    }

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

            if (step.type === "condition") {
                const condResult = await this.executeConditionStep(step as ConditionStep, context);
                result.output = condResult;
                result.status = "completed";
            } else if (step.type === "loop") {
                const loopResult = await this.executeLoopStep(step as LoopStep, context);
                result.output = loopResult;
                result.status = "completed";
            } else {
                const execResult = await this.stepExecutor.executeAction(step, context);
                if (execResult.success) {
                    result.output = execResult.data;
                    result.status = "completed";
                } else {
                    result.error = execResult.error;
                    result.status = "failed";
                    throw new Error(execResult.error || "Step execution failed");
                }
            }

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

    private async executeConditionStep(
        step: ConditionStep,
        context: ExecutionContext,
    ): Promise<any> {
        if (!step.condition) throw new Error("Condition step missing condition");

        const result = this.evaluateConditionRef(step.condition, context);

        if (result && step.onTrue) {
            await this.executeSteps(step.onTrue, context);
        } else if (!result && step.onFalse) {
            await this.executeSteps(step.onFalse, context);
        }

        return { result };
    }

    private evaluateConditionRef(condition: Condition, context: ExecutionContext): boolean {
        if (condition.operator === "and" && Array.isArray(condition.conditions)) {
            return condition.conditions.every((c) => this.evaluateConditionRef(c, context));
        }
        if (condition.operator === "or" && Array.isArray(condition.conditions)) {
            return condition.conditions.some((c) => this.evaluateConditionRef(c, context));
        }

        let fieldValue: any;
        if (condition.field) {
            let expr = condition.field;
            if (typeof expr === "string" && !expr.includes("{{")) {
                expr = `{{${expr}}}`;
            }
            fieldValue = this.variableResolver.resolve(expr, context);
        }

        let expectedValue: any = condition.value;
        if (typeof expectedValue === "string" && expectedValue.includes("{{")) {
            expectedValue = this.variableResolver.resolve(expectedValue, context);
        }

        const leafCondition: Condition = { ...condition, value: expectedValue };
        return this.conditionExecutor.evaluateCondition(leafCondition, fieldValue);
    }

    private async executeLoopStep(step: LoopStep, context: ExecutionContext): Promise<any> {
        const sourceExpr = this.loopExecutor.getSource(step);
        let resolvedData: any = sourceExpr;

        if (typeof sourceExpr === "string" && sourceExpr.includes("{{")) {
            resolvedData = this.variableResolver.resolve(sourceExpr, context);
        } else if (typeof sourceExpr === "object") {
            resolvedData = this.variableResolver.resolveObject(sourceExpr, context);
        }

        const items = this.loopExecutor.prepareIterations(step, resolvedData);
        const iterations: any[] = [];

        const loopVarName = this.loopExecutor.getVariableName(step);
        const indexName = this.loopExecutor.getIndexName(step);

        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            context.variables[loopVarName] = item.value !== undefined ? item.value : item;
            context.variables[indexName] = i;
            if (item.key) context.variables["key"] = item.key;

            const loopSteps = step.steps || step.loop?.steps;
            if (loopSteps) {
                await this.executeSteps(loopSteps, context);
            }

            if (step.breakCondition) {
                if (this.evaluateConditionRef(step.breakCondition, context)) {
                    break;
                }
            }

            iterations.push({ index: i, result: "completed" });
        }

        return { iterations };
    }

    private checkStepDependencies(step: WorkflowStep, context: ExecutionContext): boolean {
        if (!step.dependsOn) return true;
        const deps = Array.isArray(step.dependsOn) ? step.dependsOn : [step.dependsOn];
        for (const depId of deps) {
            const res = context.stepResults.get(depId);
            if (!res || res.status !== "completed") return false;
        }
        return true;
    }

    private getNestedValue(obj: any, path: string): any {
        return path.split(".").reduce((current, key) => current?.[key], obj);
    }

    private generateExecutionId(): string {
        return `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

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

    private calculateProgress(context: ExecutionContext): number {
        if (context.metrics.stepCount === 0) return 0;
        const executed =
            context.metrics.successStepCount +
            context.metrics.failedStepCount +
            context.metrics.skippedStepCount;
        return Math.floor((executed / context.metrics.stepCount) * 100);
    }
}

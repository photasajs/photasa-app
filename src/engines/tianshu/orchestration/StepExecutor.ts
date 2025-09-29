/**
 * 步骤执行器
 * 负责单个工作流步骤的执行逻辑
 */

import { EventEmitter } from "events";
import { WorkflowStep, ExecutionContext } from "../types/workflows";

/**
 * 步骤执行器配置
 */
export interface StepExecutorConfig {
    /** 默认超时时间（毫秒） */
    timeout: number;
    /** 重试配置 */
    retryConfig: {
        maxAttempts: number;
        delay: number;
        backoff: "linear" | "exponential";
    };
}

/**
 * 步骤执行器
 */
export class StepExecutor extends EventEmitter {
    private _config: StepExecutorConfig;
    private isInitialized = false;

    constructor(config: StepExecutorConfig) {
        super();
        this._config = config;
    }

    /**
     * 初始化执行器
     */
    async initialize(): Promise<void> {
        this.isInitialized = true;
        // 使用配置进行初始化
        console.log("StepExecutor initialized with config:", this._config);
    }

    /**
     * 执行动作步骤
     */
    async executeAction(step: WorkflowStep, context: ExecutionContext): Promise<any> {
        if (!this.isInitialized) {
            throw new Error("StepExecutor not initialized");
        }

        // 模拟服务调用
        if (step.service && step.action) {
            return await this.callService(step.service, step.action, step.input || {}, context);
        }

        // 模拟简单动作
        return await this.executeSimpleAction(step, context);
    }

    /**
     * 执行条件步骤
     */
    async executeCondition(step: WorkflowStep, context: ExecutionContext): Promise<boolean> {
        if (!step.condition) {
            throw new Error("Condition step must have condition property");
        }

        const fieldValue = this.getFieldValue(step.condition.field, context);
        const result = this.evaluateCondition(
            fieldValue,
            step.condition.operator,
            step.condition.value,
        );

        return result;
    }

    /**
     * 执行循环步骤
     */
    async executeLoop(step: WorkflowStep, context: ExecutionContext): Promise<any[]> {
        if (!step.loop) {
            throw new Error("Loop step must have loop property");
        }

        const results: any[] = [];
        const { variable, count, steps } = step.loop;

        // 确定循环次数
        const loopCount = typeof count === "number" ? count : this.getFieldValue(count, context);

        for (let i = 0; i < loopCount; i++) {
            // 设置循环变量
            context.variables[variable] = i;

            // 执行循环体步骤
            const loopContext = { ...context, variables: { ...context.variables } };
            for (const loopStep of steps) {
                const result = await this.executeAction(loopStep, loopContext);
                results.push(result);
            }
        }

        return results;
    }

    /**
     * 执行并行步骤
     */
    async executeParallel(step: WorkflowStep, context: ExecutionContext): Promise<any[]> {
        if (!step.parallel) {
            throw new Error("Parallel step must have parallel property");
        }

        const { steps, maxConcurrency = 5 } = step.parallel;
        const results: any[] = [];

        // 分批执行并行步骤
        for (let i = 0; i < steps.length; i += maxConcurrency) {
            const batch = steps.slice(i, i + maxConcurrency);
            const batchPromises = batch.map((parallelStep) =>
                this.executeAction(parallelStep, context),
            );

            const batchResults = await Promise.all(batchPromises);
            results.push(...batchResults);
        }

        return results;
    }

    /**
     * 执行序列步骤
     */
    async executeSequence(step: WorkflowStep, context: ExecutionContext): Promise<any[]> {
        // 序列步骤实际上就是按顺序执行动作步骤
        return await this.executeAction(step, context);
    }

    /**
     * 执行延迟步骤
     */
    async executeDelay(step: WorkflowStep, _context: ExecutionContext): Promise<void> {
        const delay = step.input?.delay || 1000;
        await new Promise((resolve) => setTimeout(resolve, delay));
    }

    /**
     * 执行重试步骤
     */
    async executeRetry(step: WorkflowStep, context: ExecutionContext): Promise<any> {
        if (!step.retry) {
            throw new Error("Retry step must have retry property");
        }

        const { maxAttempts, delay, backoff } = step.retry;
        let lastError: Error | null = null;

        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                return await this.executeAction(step, context);
            } catch (error) {
                lastError = error as Error;

                if (attempt < maxAttempts) {
                    const retryDelay = this.calculateRetryDelay(delay, attempt, backoff);
                    await new Promise((resolve) => setTimeout(resolve, retryDelay));
                }
            }
        }

        throw lastError || new Error("Retry failed");
    }

    /**
     * 执行错误处理步骤
     */
    async executeErrorHandler(step: WorkflowStep, _context: ExecutionContext): Promise<any> {
        if (!step.errorHandler) {
            throw new Error("Error handler step must have errorHandler property");
        }

        // 模拟错误处理逻辑
        const { errorType, steps: handlerSteps, continue: _shouldContinue } = step.errorHandler;

        // 检查是否有匹配的错误
        const hasError = this.checkForError(_context, errorType);
        if (!hasError) {
            return null;
        }

        // 执行错误处理步骤
        const results: any[] = [];
        for (const handlerStep of handlerSteps) {
            const result = await this.executeAction(handlerStep, _context);
            results.push(result);
        }

        return results;
    }

    /**
     * 清理资源
     */
    async cleanup(): Promise<void> {
        this.isInitialized = false;
    }

    /**
     * 调用服务
     */
    private async callService(
        service: string,
        action: string,
        input: any,
        _context: ExecutionContext,
    ): Promise<any> {
        // 模拟服务调用
        // 在实际实现中，这里会调用承宣层的服务

        return new Promise((resolve, _reject) => {
            setTimeout(
                () => {
                    // 模拟服务响应
                    resolve({
                        service,
                        action,
                        input,
                        result: `Mock result from ${service}.${action}`,
                        timestamp: Date.now(),
                    });
                },
                Math.random() * 1000 + 100,
            ); // 模拟网络延迟
        });
    }

    /**
     * 执行简单动作
     */
    private async executeSimpleAction(
        step: WorkflowStep,
        _context: ExecutionContext,
    ): Promise<any> {
        // 模拟简单动作执行
        return {
            stepId: step.id,
            action: "simple_action",
            input: step.input,
            result: "Action completed successfully",
            timestamp: Date.now(),
        };
    }

    /**
     * 获取字段值
     */
    private getFieldValue(field: string, context: ExecutionContext): any {
        const parts = field.split(".");
        let value: any = context;

        for (const part of parts) {
            if (value && typeof value === "object" && part in value) {
                value = value[part];
            } else {
                return undefined;
            }
        }

        return value;
    }

    /**
     * 评估条件
     */
    private evaluateCondition(fieldValue: any, operator: string, expectedValue: any): boolean {
        switch (operator) {
            case "eq":
                return fieldValue === expectedValue;
            case "ne":
                return fieldValue !== expectedValue;
            case "gt":
                return fieldValue > expectedValue;
            case "gte":
                return fieldValue >= expectedValue;
            case "lt":
                return fieldValue < expectedValue;
            case "lte":
                return fieldValue <= expectedValue;
            case "in":
                return Array.isArray(expectedValue) && expectedValue.includes(fieldValue);
            case "nin":
                return Array.isArray(expectedValue) && !expectedValue.includes(fieldValue);
            case "exists":
                return fieldValue !== undefined && fieldValue !== null;
            case "nexists":
                return fieldValue === undefined || fieldValue === null;
            case "regex":
                return typeof fieldValue === "string" && new RegExp(expectedValue).test(fieldValue);
            default:
                return false;
        }
    }

    /**
     * 计算重试延迟
     */
    private calculateRetryDelay(baseDelay: number, attempt: number, backoff?: string): number {
        switch (backoff) {
            case "linear":
                return baseDelay * attempt;
            case "exponential":
                return baseDelay * Math.pow(2, attempt - 1);
            default:
                return baseDelay;
        }
    }

    /**
     * 检查错误
     */
    private checkForError(_context: ExecutionContext, errorType?: string): boolean {
        // 检查最近的步骤结果中是否有错误
        for (const result of Array.from(_context.stepResults.values())) {
            if (result.status === "failed") {
                if (!errorType || result.error?.includes(errorType)) {
                    return true;
                }
            }
        }
        return false;
    }
}

/**
 * StepExecutor接口定义
 * 天枢引擎通过此接口与太乙引擎建立双向通信
 */

import { WorkflowStep, ExecutionContext } from "../../tianshu/types/workflows";

/**
 * 步骤执行结果
 */
export interface StepExecutionResult {
    success: boolean;
    data?: any;
    error?: string;
    metadata?: {
        duration: number;
        engineName?: string;
        [key: string]: any;
    };
}

/**
 * 步骤执行进度回报
 */
export interface StepProgressReport {
    stepId: string;
    progress: number; // 0-100
    message?: string;
    currentPhase?: string;
}

/**
 * 步骤执行器接口
 * 专注于天枢-太乙双向通信：
 * 1. 天枢向太乙发送执行命令 (executeAction)
 * 2. 太乙向天枢回报执行状态和进度 (事件机制)
 */
export interface IStepExecutor {
    /**
     * 初始化
     */
    initialize(): Promise<void>;

    /**
     * 执行工作流步骤
     * 天枢 → 太乙：发送执行命令
     */
    executeAction(step: WorkflowStep, context: ExecutionContext): Promise<StepExecutionResult>;

    /**
     * 事件回报机制 (太乙 → 天枢)：
     * - 'stepStarted': 步骤开始执行
     * - 'stepProgress': 步骤执行进度更新
     * - 'stepCompleted': 步骤执行完成
     * - 'stepFailed': 步骤执行失败
     * - 'engineStatus': 引擎状态变化
     */
    on(event: string, callback: (data: any) => void): void;

    /**
     * 移除事件监听
     */
    off(event: string, callback: (data: any) => void): void;

    /**
     * 只触发一次事件
     */
    once(event: string, callback: (data: any) => void): this;

    /**
     * 移除所有事件监听
     */
    removeAllListeners(event?: string): void;
}

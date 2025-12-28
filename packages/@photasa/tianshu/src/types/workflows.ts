/**
 * Tianshu工作流类型定义
 *
 * 重新导出 @zouwu-wf/workflow 中的类型，并为遗留代码提供兼容层
 */

import { Condition } from "@zouwu-wf/workflow";

export type {
    WorkflowDefinition,
    WorkflowStep,
    ExecutionContext,
    StepResult,
    StepType,
    ConditionOperator,
    Condition,
    LoopStep,
    ConditionStep,
    ActionStep,
    BuiltinStep,
    ParallelStep,
    WorkflowCallStep,
} from "@zouwu-wf/workflow";

/**
 * 兼容性类型别名
 */
export type ConditionExpression = Condition;

/**
 * 步骤执行模式 (Zouwu中使用 async: boolean 控制，这里保留类型定义用于兼容)
 */
export type ExecutionMode = "sync" | "async" | "parallel";

/**
 * 工作流执行选项 (Zouwu未导出此类型，本地定义)
 */
export interface WorkflowExecutionOptions {
    /** 是否异步执行 */
    async?: boolean;
    /** 超时时间 */
    timeout?: number;
    /** 最大重试次数 */
    maxRetries?: number;
    /** 是否忽略错误 */
    ignoreErrors?: boolean;
    /** 执行标签 */
    tags?: string[];
    /** 自定义变量 */
    variables?: Record<string, any>;
}

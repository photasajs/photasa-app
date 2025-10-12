/**
 * 工作流标准类型定义
 * 定义所有工作流相关的标准类型和接口
 */

/**
 * 混元工作流步骤标准输出类型
 * 所有工作流步骤都应该遵循这个标准格式
 *
 * 寓意：混元代表混沌初开，符合工作流的初始化和执行
 */
export interface HunyuanWorkflowStepOutput<T = unknown> {
    /** 执行是否成功 */
    success: boolean;
    /** 步骤输出数据 */
    data: T;
    /** 错误信息（如果执行失败） */
    error?: string;
    /** 元数据信息 */
    metadata: {
        /** 步骤ID */
        stepId: string;
        /** 执行时间戳 */
        executedAt: number;
        /** 执行耗时（毫秒） */
        duration: number;
        /** 引擎名称 */
        engineName: string;
    };
}

/**
 * 工作流执行结果类型
 * 用于工作流整体执行结果的标准化
 */
export interface HunyuanWorkflowExecutionResult<T = unknown> {
    /** 执行是否成功 */
    success: boolean;
    /** 工作流输出数据 */
    data: T;
    /** 错误信息（如果执行失败） */
    error?: string;
    /** 执行元数据 */
    metadata: {
        /** 工作流ID */
        workflowId: string;
        /** 执行ID */
        executionId: string;
        /** 开始时间 */
        startTime: number;
        /** 结束时间 */
        endTime: number;
        /** 总耗时（毫秒） */
        totalDuration: number;
        /** 步骤数量 */
        stepCount: number;
        /** 成功步骤数量 */
        successStepCount: number;
        /** 失败步骤数量 */
        failedStepCount: number;
    };
}

/**
 * 工作流步骤状态类型
 */
export type WorkflowStepStatus =
    | "pending" // 等待执行
    | "running" // 正在执行
    | "completed" // 执行完成
    | "failed" // 执行失败
    | "skipped" // 跳过执行
    | "cancelled"; // 取消执行

/**
 * 工作流执行状态类型
 */
export type WorkflowExecutionStatus =
    | "pending" // 等待执行
    | "running" // 正在执行
    | "completed" // 执行完成
    | "failed" // 执行失败
    | "cancelled"; // 取消执行

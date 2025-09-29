/**
 * Tianshu工作流类型定义
 */

/**
 * 工作流步骤类型
 */
export type StepType =
    | "action"
    | "condition"
    | "loop"
    | "parallel"
    | "sequence"
    | "delay"
    | "retry"
    | "error_handler";

/**
 * 步骤执行模式
 */
export type ExecutionMode = "sync" | "async" | "parallel";

/**
 * 条件操作符
 */
export type ConditionOperator =
    | "eq" // 等于
    | "ne" // 不等于
    | "gt" // 大于
    | "gte" // 大于等于
    | "lt" // 小于
    | "lte" // 小于等于
    | "in" // 包含
    | "nin" // 不包含
    | "exists" // 存在
    | "nexists" // 不存在
    | "regex" // 正则匹配
    | "custom"; // 自定义

/**
 * 条件表达式
 */
export interface ConditionExpression {
    /** 字段路径 */
    field: string;
    /** 操作符 */
    operator: ConditionOperator;
    /** 比较值 */
    value: any;
    /** 自定义函数（当operator为custom时） */
    customFunction?: string;
}

/**
 * 工作流步骤
 */
export interface WorkflowStep {
    /** 步骤ID */
    id: string;
    /** 步骤名称 */
    name: string;
    /** 步骤类型 */
    type: StepType;
    /** 步骤描述 */
    description?: string;
    /** 执行模式 */
    mode?: ExecutionMode;
    /** 服务名称 */
    service?: string;
    /** 动作名称 */
    action?: string;
    /** 输入参数 */
    input?: Record<string, any>;
    /** 输出映射 */
    output?: Record<string, string>;
    /** 条件表达式（用于condition类型） */
    condition?: ConditionExpression;
    /** 循环配置（用于loop类型） */
    loop?: {
        /** 循环变量 */
        variable: string;
        /** 循环次数或数组 */
        count: number | string;
        /** 循环体步骤 */
        steps: WorkflowStep[];
    };
    /** 并行配置（用于parallel类型） */
    parallel?: {
        /** 最大并发数 */
        maxConcurrency?: number;
        /** 并行步骤 */
        steps: WorkflowStep[];
    };
    /** 重试配置 */
    retry?: {
        /** 最大重试次数 */
        maxAttempts: number;
        /** 重试间隔（毫秒） */
        delay: number;
        /** 退避策略 */
        backoff?: "linear" | "exponential";
        /** 重试条件 */
        retryCondition?: ConditionExpression;
    };
    /** 错误处理 */
    errorHandler?: {
        /** 错误类型 */
        errorType?: string;
        /** 处理步骤 */
        steps: WorkflowStep[];
        /** 是否继续执行 */
        continue?: boolean;
    };
    /** 超时时间（毫秒） */
    timeout?: number;
    /** 是否忽略错误 */
    ignoreError?: boolean;
    /** 依赖的步骤ID */
    dependsOn?: string[];
    /** 标签 */
    tags?: string[];
}

/**
 * 工作流定义
 */
export interface WorkflowDefinition {
    /** 工作流ID */
    id: string;
    /** 工作流名称 */
    name: string;
    /** 工作流描述 */
    description?: string;
    /** 工作流版本 */
    version: string;
    /** 工作流作者 */
    author?: string;
    /** 创建时间 */
    createdAt: number;
    /** 更新时间 */
    updatedAt: number;
    /** 工作流步骤 */
    steps: WorkflowStep[];
    /** 输入参数定义 */
    inputSchema?: Record<string, any>;
    /** 输出参数定义 */
    outputSchema?: Record<string, any>;
    /** 变量定义 */
    variables?: Record<string, any>;
    /** 工作流标签 */
    tags?: string[];
    /** 是否启用 */
    enabled: boolean;
    /** 超时时间（毫秒） */
    timeout?: number;
    /** 重试配置 */
    retry?: {
        maxAttempts: number;
        delay: number;
        backoff?: "linear" | "exponential";
    };
}

/**
 * 工作流执行上下文
 */
export interface ExecutionContext {
    /** 执行ID */
    executionId: string;
    /** 工作流ID */
    workflowId: string;
    /** 命令ID */
    commandId: string;
    /** 开始时间 */
    startTime: number;
    /** 当前步骤ID */
    currentStepId?: string;
    /** 执行状态 */
    status: "pending" | "running" | "completed" | "failed" | "cancelled";
    /** 输入参数 */
    input: Record<string, any>;
    /** 输出结果 */
    output?: Record<string, any>;
    /** 变量值 */
    variables: Record<string, any>;
    /** 步骤结果 */
    stepResults: Map<string, StepResult>;
    /** 错误信息 */
    error?: string;
    /** 执行指标 */
    metrics: {
        stepCount: number;
        successStepCount: number;
        failedStepCount: number;
        skippedStepCount: number;
        totalDuration: number;
    };
}

/**
 * 步骤执行结果
 */
export interface StepResult {
    /** 步骤ID */
    stepId: string;
    /** 执行状态 */
    status: "pending" | "running" | "completed" | "failed" | "skipped";
    /** 开始时间 */
    startTime: number;
    /** 结束时间 */
    endTime?: number;
    /** 执行耗时 */
    duration?: number;
    /** 输出结果 */
    output?: any;
    /** 错误信息 */
    error?: string;
    /** 重试次数 */
    retryCount: number;
    /** 是否被跳过 */
    skipped: boolean;
    /** 跳过原因 */
    skipReason?: string;
}

/**
 * 工作流执行选项
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

/**
 * 📜 天枢工作流类型定义统一导出模块
 *
 * 🌌 仙术功能：提供完整的TypeScript类型定义
 * 🔧 工作流操作：确保类型安全的工作流开发
 */

// 🌌 核心工作流类型定义
export interface WorkflowDefinition {
    /** 工作流唯一标识符 */
    id: string;
    /** 人类可读的工作流名称 */
    name: string;
    /** 工作流功能详细描述 */
    description?: string;
    /** 语义版本号 */
    version: string;
    /** 工作流创建者 */
    author?: string;
    /** 创建时间戳（毫秒） */
    createdAt?: number;
    /** 最后更新时间戳（毫秒） */
    updatedAt?: number;

    /** 工作流触发条件 */
    triggers?: WorkflowTrigger[];
    /** 输入参数定义 */
    inputs?: ParameterDefinition[];
    /** 输出结果定义 */
    outputs?: ParameterDefinition[];
    /** 工作流级变量 */
    variables?: Record<string, any>;
    /** 工作流步骤定义 */
    steps: WorkflowStep[];

    /** 全局错误处理配置 */
    error_handling?: Record<string, ErrorHandler>;
    /** 是否启用工作流 */
    enabled?: boolean;
    /** 工作流超时时间（毫秒） */
    timeout?: number;
    /** 执行优先级 */
    priority?: "system" | "user" | "background";
    /** 失败时是否重试 */
    retryOnFailure?: boolean;
    /** 最大重试次数 */
    maxRetries?: number;
    /** 工作流标签 */
    tags?: string[];
    /** 最大并发步骤数 */
    maxConcurrentSteps?: number;
    /** 资源配置 */
    resources?: ResourceConfiguration;

    /** 开发工具元数据 */
    metadata?: WorkflowMetadata;
    /** 测试配置 */
    testing?: TestingConfiguration;
    /** 调试配置 */
    debug?: DebugConfiguration;
}

// 📜 工作流触发器类型
export type WorkflowTrigger = { intent: string } | { event: string } | { schedule: string };

// 🔧 参数定义
export interface ParameterDefinition {
    /** 参数名称 */
    name: string;
    /** 参数类型 */
    type: "string" | "number" | "boolean" | "object" | "array";
    /** 是否必需 */
    required?: boolean;
    /** 参数描述 */
    description?: string;
    /** 默认值 */
    default?: any;
    /** 验证规则 */
    validation?: {
        schema?: any;
    };
}

// 🌌 工作流步骤基础类型
export interface BaseWorkflowStep {
    /** 步骤唯一标识符 */
    id: string;
    /** 步骤显示名称 */
    name?: string;
    /** 步骤类型 */
    type: StepType;
    /** 步骤功能说明 */
    description?: string;
    /** 依赖的步骤ID */
    dependsOn?: string | string[];
    /** 执行条件 */
    condition?: Condition;
    /** 步骤超时时间（毫秒） */
    timeout?: number;
    /** 执行优先级 */
    priority?: "low" | "normal" | "high";
    /** 是否异步执行 */
    async?: boolean;
    /** 错误处理策略 */
    onError?: ErrorHandler;
    /** 资源配置 */
    resources?: ResourceConfiguration;
    /** 输出结果schema，用于变量路径验证 */
    output_schema?: any;
}

// 📜 步骤类型枚举
export type StepType = "condition" | "action" | "builtin" | "loop" | "parallel" | "workflow";

// 🔧 条件定义
export interface Condition {
    /** 比较操作符 */
    operator: ConditionOperator;
    /** 左操作数，支持模板语法 */
    value?: any;
    /** 右操作数或测试值 */
    test?: any;
    /** 子条件列表（用于and/or操作符） */
    conditions?: Condition[];
}

// 🌌 条件操作符
export type ConditionOperator =
    | "eq"
    | "ne"
    | "gt"
    | "gte"
    | "lt"
    | "lte"
    | "in"
    | "nin"
    | "exists"
    | "not_exists"
    | "matches"
    | "and"
    | "or";

// 📜 条件步骤
export interface ConditionStep extends BaseWorkflowStep {
    type: "condition";
    /** 条件表达式 */
    condition: Condition;
    /** 条件为真时执行的步骤 */
    onTrue?: WorkflowStep[];
    /** 条件为假时执行的步骤 */
    onFalse?: WorkflowStep[];
}

// 🔧 动作步骤
export interface ActionStep extends BaseWorkflowStep {
    type: "action";
    /** 目标服务/引擎名称 */
    service: "taiyi" | "wenchang" | "qianliyan" | "maliang";
    /** 调用的方法名 */
    action: string;
    /** 输入数据，支持模板语法 */
    input?: Record<string, any>;
    /** 输出映射配置 */
    output?: Record<string, string>;
}

// 🌌 内置操作步骤
export interface BuiltinStep extends BaseWorkflowStep {
    type: "builtin";
    /** 内置操作类型 */
    action: BuiltinAction;
    /** 操作参数 */
    input?: Record<string, any>;
}

// 📜 内置操作类型
export type BuiltinAction = "return" | "setVariable" | "log" | "delay" | "transform" | "error";

// 🔧 循环步骤
export interface LoopStep extends BaseWorkflowStep {
    type: "loop";
    /** 迭代配置 */
    iterator: {
        /** 数据源，支持模板语法 */
        source: string;
        /** 循环变量名 */
        variable: string;
        /** 索引变量名 */
        index?: string;
        /** 最大迭代次数 */
        limit?: number;
    };
    /** 循环体步骤 */
    steps: WorkflowStep[];
    /** 退出条件 */
    breakCondition?: Condition;
    /** 继续条件 */
    continueCondition?: Condition;
    /** 是否并行执行 */
    parallel?: boolean;
    /** 并发数量 */
    concurrency?: number;
    /** 错误处理 */
    onError?: {
        type: "continue" | "break" | "fail";
        maxErrors?: number;
    };
}

// 🌌 并行步骤
export interface ParallelStep extends BaseWorkflowStep {
    type: "parallel";
    /** 并行分支 */
    branches: Array<{
        name: string;
        steps: WorkflowStep[];
    }>;
    /** 最大并发分支数 */
    maxConcurrency?: number;
    /** 完成策略 */
    waitFor?: "all" | "any" | "majority";
    /** 失败策略 */
    failOn?: "any" | "all" | "majority";
    /** 结果合并策略 */
    mergeStrategy?: "object" | "array" | "first";
    /** 输出映射 */
    output?: Record<string, string>;
}

// 📜 工作流调用步骤
export interface WorkflowCallStep extends BaseWorkflowStep {
    type: "workflow";
    /** 子工作流ID */
    workflowId: string;
    /** 传递给子工作流的输入 */
    input?: Record<string, any>;
}

// 🔧 工作流步骤联合类型
export type WorkflowStep =
    | ConditionStep
    | ActionStep
    | BuiltinStep
    | LoopStep
    | ParallelStep
    | WorkflowCallStep;

// 🌌 错误处理器
export interface ErrorHandler {
    /** 错误处理类型 */
    type:
        | "retry"
        | "graceful_failure"
        | "return_error"
        | "escalate"
        | "continue"
        | "break"
        | "fail";
    /** 最大重试次数 */
    maxRetries?: number;
    /** 退避策略 */
    backoff?: "linear" | "exponential" | "fixed";
    /** 初始延迟（毫秒） */
    delay?: number;
    /** 退避倍数 */
    multiplier?: number;
    /** 错误响应内容 */
    response?: any;
    /** 通知列表 */
    notify?: string[];
    /** 降级处理步骤 */
    fallback?: WorkflowStep[];
}

// 📜 资源配置
export interface ResourceConfiguration {
    /** 内存限制 */
    memory?: string;
    /** CPU限制 */
    cpu?: string;
    /** 存储限制 */
    storage?: string;
    /** 网络访问限制 */
    network?: "unlimited" | "limited" | "offline";
    /** 资源优先级 */
    priority?: "low" | "normal" | "high";
}

// 🔧 工作流元数据
export interface WorkflowMetadata {
    editor?: {
        autoComplete?: boolean;
        syntax?: string;
    };
    linter?: {
        rules?: string[];
    };
    debugger?: {
        breakpoints?: string[];
    };
}

// 🌌 测试配置
export interface TestingConfiguration {
    /** 模拟服务配置 */
    mocks?: Record<string, any>;
    /** 测试场景 */
    scenarios?: Array<{
        name: string;
        inputs?: any;
        expected?: any;
        expectedError?: string;
    }>;
}

// 📜 调试配置
export interface DebugConfiguration {
    enabled?: boolean;
    logLevel?: "debug" | "info" | "warn" | "error";
    traceSteps?: boolean;
    breakpoints?: string[];
    variables?: string[];
}

// 🔧 模板变量引用
export interface TemplateVariableReference {
    /** 变量类型 */
    type: "inputs" | "variables" | "steps" | "loopContext" | "branchContext";
    /** 变量路径 */
    path: string;
    /** 完整表达式 */
    expression: string;
    /** 是否包含默认值 */
    hasDefault: boolean;
    /** 默认值 */
    defaultValue?: any;
}

// 🌌 验证结果
export interface ValidationResult {
    /** 验证是否通过 */
    valid: boolean;
    /** 错误列表 */
    errors: ValidationError[];
    /** 验证后的数据 */
    data?: any;
}

// 📜 验证错误
export interface ValidationError {
    /** 错误路径 */
    path: string;
    /** 错误消息 */
    message: string;
    /** 错误值 */
    value?: any;
    /** 相关Schema */
    schema?: any;
}

// 🔧 生成器选项
export interface GeneratorOptions {
    /** 输入Schema文件路径 */
    schemaPath: string;
    /** 输出文件路径 */
    outputPath: string;
    /** 名称前缀 */
    namePrefix?: string;
    /** 是否生成验证器 */
    generateValidators?: boolean;
    /** 是否生成文档注释 */
    generateDocs?: boolean;
}

// 🌌 支持的功能特性
export interface SupportedFeatures {
    schemaVersion: string;
    packageVersion: string;
    features: {
        typeGeneration: boolean;
        validatorGeneration: boolean;
        templateSyntax: boolean;
        chineseErrorMessages: boolean;
        cliTools: boolean;
        batchProcessing: boolean;
    };
    stepTypes: readonly StepType[];
    services: readonly string[];
    operators: readonly ConditionOperator[];
    builtinActions: readonly BuiltinAction[];
}

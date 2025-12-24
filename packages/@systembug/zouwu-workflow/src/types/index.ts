/**
 * 📜 驺吾工作流类型定义统一导出模块
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
    triggers?: WorkflowTrigger[] | TriggerDefinition[];
    /** 输入参数定义（数组格式，兼容现有实现） */
    inputs?: ParameterDefinition[];
    /** 输入参数定义（Record格式，规范文档格式） */
    inputsRecord?: Record<string, InputDefinition>;
    /** 输出结果定义（数组格式，兼容现有实现） */
    outputs?: ParameterDefinition[];
    /** 输出结果定义（Record格式，规范文档格式） */
    outputsRecord?: Record<string, OutputDefinition>;
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
    priority?: 'system' | 'user' | 'background';
    /** 失败时是否重试 */
    retryOnFailure?: boolean;
    /** 最大重试次数 */
    maxRetries?: number;
    /** 重试配置（规范文档格式） */
    retry?: RetryConfig;
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
    type: 'string' | 'number' | 'boolean' | 'object' | 'array';
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
    /** 驺吾颜色标识（可选） */
    color?: 'blue' | 'red' | 'yellow' | 'white' | 'black';
    /** 依赖的步骤ID */
    dependsOn?: string | string[];
    /** 执行条件 */
    condition?: Condition;
    /** 步骤超时时间（毫秒） */
    timeout?: number;
    /** 执行优先级 */
    priority?: 'low' | 'normal' | 'high';
    /** 是否异步执行 */
    async?: boolean;
    /** 错误处理策略 */
    onError?: ErrorHandler;
    /** 错误处理器（规范文档格式） */
    errorHandler?: ErrorHandlerConfig;
    /** 是否忽略错误 */
    ignoreError?: boolean;
    /** 步骤标签 */
    tags?: string[];
    /** 资源配置 */
    resources?: ResourceConfiguration;
    /** 输出结果schema，用于变量路径验证 */
    output_schema?: any;
    /** 驺吾守护特性 */
    guardian?: GuardianConfig;
    /** 驺吾仁德特性 */
    benevolent?: BenevolentConfig;
    /** 驺吾双翼特性（并行专用） */
    wings?: WingsConfig;
    /** 驺吾长尾特性（链式专用） */
    tail?: TailConfig;
    /** 重试配置 */
    retry?: RetryConfig;
}

// 📜 步骤类型枚举
export type StepType =
    | 'condition' // 条件判断分支
    | 'action' // 调用业务适配器方法
    | 'builtin' // 内置操作
    | 'loop' // 循环执行
    | 'parallel' // 并行执行
    | 'sequence' // 序列执行
    | 'delay' // 延迟执行
    | 'retry' // 重试步骤
    | 'error_handler' // 错误处理
    | 'workflow'; // 工作流调用

// 🔧 条件定义（ConditionExpression）
export interface Condition {
    /** 字段路径（支持模板语法，如 "steps.stepId.output.field"） */
    field?: string;
    /** 比较操作符 */
    operator: ConditionOperator;
    /** 左操作数，支持模板语法 */
    value?: any;
    /** 右操作数或测试值 */
    test?: any;
    /** 子条件列表（用于and/or操作符） */
    conditions?: Condition[];
}

// 🌌 条件操作符（完整列表，匹配规范文档）
export type ConditionOperator =
    | 'eq' // 等于
    | 'ne' // 不等于
    | 'gt' // 大于
    | 'gte' // 大于等于
    | 'lt' // 小于
    | 'lte' // 小于等于
    | 'in' // 包含于数组
    | 'nin' // 不包含于数组
    | 'exists' // 字段存在
    | 'not_exists' // 字段不存在
    | 'startsWith' // 以...开始
    | 'endsWith' // 以...结束
    | 'contains' // 包含字符串
    | 'isEmpty' // 为空
    | 'isNotEmpty' // 不为空
    | 'string_maxlen' // 字符串最大长度
    | 'string_minlen' // 字符串最小长度
    | 'matches' // 正则匹配
    | 'and' // 逻辑与
    | 'or'; // 逻辑或

// 📜 条件步骤
export interface ConditionStep extends BaseWorkflowStep {
    type: 'condition';
    /** 条件表达式 */
    condition: Condition;
    /** 条件为真时执行的步骤 */
    onTrue?: WorkflowStep[];
    /** 条件为假时执行的步骤 */
    onFalse?: WorkflowStep[];
}

// 🔧 动作步骤
export interface ActionStep extends BaseWorkflowStep {
    type: 'action';
    /** 目标服务/引擎名称 */
    service: 'taiyi' | 'wenchang' | 'qianliyan' | 'maliang' | string;
    /** 调用的方法名 */
    action: string;
    /** 输入数据，支持模板语法 */
    input?: Record<string, any>;
    /** 输出映射配置 */
    output?: Record<string, string>;
}

// 🌌 内置操作步骤
export interface BuiltinStep extends BaseWorkflowStep {
    type: 'builtin';
    /** 内置操作类型 */
    action: BuiltinAction;
    /** 操作参数 */
    input?: Record<string, any>;
}

// 📜 内置操作类型
export type BuiltinAction = 'return' | 'setVariable' | 'log' | 'delay' | 'transform' | 'error';

// 🔧 循环步骤
export interface LoopStep extends BaseWorkflowStep {
    type: 'loop';
    /** 迭代配置（新格式） */
    iterator?: {
        /** 数据源，支持模板语法 */
        source: string;
        /** 循环变量名 */
        variable: string;
        /** 索引变量名 */
        index?: string;
        /** 最大迭代次数 */
        limit?: number;
    };
    /** 循环配置（规范文档格式，与 iterator 互斥） */
    loop?: LoopConfig;
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
        type: 'continue' | 'break' | 'fail';
        maxErrors?: number;
    };
}

// 🌌 并行步骤
export interface ParallelStep extends BaseWorkflowStep {
    type: 'parallel';
    /** 并行分支（新格式） */
    branches?: Array<{
        name: string;
        steps: WorkflowStep[];
    }>;
    /** 并行配置（规范文档格式，与 branches 互斥） */
    parallel?: ParallelConfig;
    /** 最大并发分支数 */
    maxConcurrency?: number;
    /** 完成策略 */
    waitFor?: 'all' | 'any' | 'majority';
    /** 失败策略 */
    failOn?: 'any' | 'all' | 'majority';
    /** 结果合并策略 */
    mergeStrategy?: 'object' | 'array' | 'first';
    /** 输出映射 */
    output?: Record<string, string>;
}

// 📜 工作流调用步骤
export interface WorkflowCallStep extends BaseWorkflowStep {
    type: 'workflow';
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
        | 'retry'
        | 'graceful_failure'
        | 'return_error'
        | 'escalate'
        | 'continue'
        | 'break'
        | 'fail';
    /** 最大重试次数 */
    maxRetries?: number;
    /** 退避策略 */
    backoff?: 'linear' | 'exponential' | 'fixed';
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
    network?: 'unlimited' | 'limited' | 'offline';
    /** 资源优先级 */
    priority?: 'low' | 'normal' | 'high';
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
    logLevel?: 'debug' | 'info' | 'warn' | 'error';
    traceSteps?: boolean;
    breakpoints?: string[];
    variables?: string[];
}

// 🔧 模板变量引用
// 🌌 从表达式解析器包导入类型
export type { TemplateVariableReference } from '@systembug/zouwu-expression-parser';

// 🌌 执行上下文（ExecutionContext）
export interface ExecutionContext {
    /** 执行唯一标识 */
    executionId: string;
    /** 工作流 ID */
    workflowId: string;
    /** 命令 ID */
    commandId?: string;
    /** 开始时间戳 */
    startTime: number;
    /** 当前步骤 ID */
    currentStepId?: string;
    /** 执行状态 */
    status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
    /** 输入参数 */
    input: Record<string, any>;
    /** 输出结果 */
    output?: Record<string, any>;
    /** 运行时变量 */
    variables: Record<string, any>;
    /** 步骤执行结果 */
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

// 📜 步骤执行结果（StepResult）
export interface StepResult {
    /** 步骤 ID */
    stepId: string;
    /** 执行状态 */
    status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
    /** 开始时间戳 */
    startTime: number;
    /** 结束时间戳 */
    endTime?: number;
    /** 执行耗时（毫秒） */
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

// 🌌 驺吾特性配置类型
export interface GuardianConfig {
    /** 温和模式 */
    gentle?: boolean;
    /** 安全保护 */
    safe?: boolean;
}

export interface BenevolentConfig {
    /** 非破坏性 */
    nonDestructive?: boolean;
    /** 保留原始数据 */
    preserveOriginal?: boolean;
}

export interface WingsConfig {
    /** 左翼分支 */
    left?: string;
    /** 右翼分支 */
    right?: string;
}

export interface TailConfig {
    /** 长尾特性 */
    long?: boolean;
    /** 优雅特性 */
    graceful?: boolean;
}

// 📜 循环配置
export interface LoopConfig {
    /** 循环变量名 */
    variable: string;
    /** 循环次数或数据源（支持模板语法） */
    count: number | string;
    /** 循环体步骤 */
    steps: WorkflowStep[];
}

// 🔧 并行配置
export interface ParallelConfig {
    /** 最大并发数 */
    maxConcurrency?: number;
    /** 并行步骤列表 */
    steps: WorkflowStep[];
}

// 🌌 重试配置
export interface RetryConfig {
    /** 最大尝试次数 */
    maxAttempts: number;
    /** 延迟时间（毫秒） */
    delay: number;
    /** 退避策略 */
    backoff?: 'linear' | 'exponential';
    /** 重试条件 */
    retryCondition?: Condition;
}

// 📜 错误处理配置
export interface ErrorHandlerConfig {
    /** 错误类型 */
    errorType?: string;
    /** 错误处理步骤 */
    steps: WorkflowStep[];
    /** 是否继续执行 */
    continue?: boolean;
}

// 🔧 输入/输出定义（用于规范文档中的 Record 格式）
export interface InputDefinition {
    /** 参数类型 */
    type: 'string' | 'number' | 'boolean' | 'object' | 'array';
    /** 是否必需 */
    required?: boolean;
    /** 参数描述 */
    description?: string;
    /** 默认值 */
    default?: any;
    /** 验证规则 */
    validation?: {
        pattern?: string;
        min?: number;
        max?: number;
        schema?: any;
    };
}

export interface OutputDefinition {
    /** 输出类型 */
    type: 'string' | 'number' | 'boolean' | 'object' | 'array';
    /** 输出描述 */
    description?: string;
}

// 🌌 触发器定义
export interface TriggerDefinition {
    /** 意图触发 */
    intent?: string;
    /** 事件触发 */
    event?: string;
    /** 定时触发（cron格式） */
    schedule?: string;
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

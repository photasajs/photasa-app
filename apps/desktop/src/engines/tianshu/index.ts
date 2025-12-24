/**
 * 天枢引擎 - Tianshu Engine
 *
 * 神话背景：
 * 天枢，北斗七星之首，是紫微垣中最重要的星宿之一。
 * 在传统神话中，天枢星君掌管着天地万物的运行秩序，
 * 负责协调各方力量，统筹全局，确保宇宙的和谐运转。
 * 天枢星君具有洞察天机、预知未来的能力，
 * 能够根据天象变化调整策略，指挥众神各司其职。
 *
 * 在本架构中，天枢引擎承担着工作流编排的重任，
 * 就如同神话中的天枢星君协调众神一样，
 * 它负责理解用户意图、编排工作流程、调度各个引擎，
 * 确保整个系统的协调运行，为用户提供智能化的服务体验。
 *
 * 核心能力：
 * - 用户意图理解和命令解析
 * - 工作流编排和步骤调度
 * - 多引擎协调和资源管理
 * - 执行状态监控和进度跟踪
 * - 错误处理和恢复机制
 * - 性能优化和负载均衡
 */

// 核心引擎
export { TianshuEngine } from "./core";
export type { TianshuEngineConfig } from "./core";

// 公共类型
export type {
    // 命令和响应
    UICommand,
    TianshuResponse,
    UserIntent,
    CommandPriority,
    CommandContext,
    TianshuError,
    ExecutionMetrics,
    ProgressUpdate,
    StatusUpdate,

    // 系统状态
    SystemStatus,
    EngineStatus,
    SystemStatusReport,
    WorkflowStatus,
    CommandExecutionResult,
    BatchCommandResponse,
    HealthCheckResponse,
    StatisticsResponse,
    ConfigResponse,
    LogResponse,

    // 工作流
    WorkflowDefinition,
    WorkflowStep,
    ExecutionContext,
    StepResult,
    WorkflowExecutionOptions,
    StepType,
    ExecutionMode,
    ConditionOperator,
    ConditionExpression,
} from "./types";

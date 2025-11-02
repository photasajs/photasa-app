/**
 * Tianshu引擎命令和响应类型定义
 */

/**
 * 用户意图类型
 */
export type UserIntent =
    | "scan_folder"
    | "scan_file"
    | "update_config"
    | "get_preferences"
    | "update_preferences"
    | "get_scanning_queue" // ✅ RFC 0042 Phase 2.3: 获取扫描队列
    | "add_scan_action" // ✅ RFC 0042 Phase 2.4: 添加单个扫描任务（天界workflow）
    | "remove_scan_action" // ✅ RFC 0042 Phase 2.4: 移除单个扫描任务（天界workflow）
    | "generate_thumbnail"
    | "process_media"
    | "stop_operation"
    | "get_status"
    | "restore_app_state" // ✅ RFC 0042 Step 2.5: 应用状态管理workflow
    | "update_folder_tree" // ✅ RFC 0042 Step 2.5: 文件夹树管理workflow
    | "switch_current_folder"; // ✅ RFC 0042 Step 2.5: 当前文件夹管理workflow

/**
 * 命令优先级
 */
export type CommandPriority = "user" | "background" | "system";

/**
 * 命令上下文
 */
export interface CommandContext {
    /** 用户ID */
    userId?: string;
    /** 会话ID */
    sessionId?: string;
    /** 请求来源 */
    source: "ui" | "api" | "scheduled" | "system";
    /** 超时时间（毫秒） */
    timeout?: number;
    /** 重试次数 */
    retryCount?: number;
    /** 自定义元数据 */
    metadata?: Record<string, any>;
}

/**
 * UI发送的命令
 */
export interface UICommand {
    /** 命令唯一标识 */
    id: string;
    /** 用户意图 */
    intent: UserIntent;
    /** 命令参数 */
    params: Record<string, any>;
    /** 优先级 */
    priority: CommandPriority;
    /** 命令上下文 */
    context?: CommandContext;
    /** 创建时间戳 */
    createdAt: number;
}

/**
 * Tianshu错误类型
 */
export interface TianshuError {
    /** 错误代码 */
    code: string;
    /** 错误消息 */
    message: string;
    /** 错误详情 */
    details?: any;
    /** 错误堆栈 */
    stack?: string;
    /** 是否可重试 */
    retryable: boolean;
    /** 建议的解决方案 */
    suggestion?: string;
}

/**
 * 执行指标
 */
export interface ExecutionMetrics {
    /** 开始时间 */
    startTime: number;
    /** 结束时间 */
    endTime?: number;
    /** 执行耗时（毫秒） */
    duration?: number;
    /** 内存使用量（字节） */
    memoryUsage?: number;
    /** 步骤数量 */
    stepCount: number;
    /** 成功步骤数 */
    successStepCount: number;
    /** 失败步骤数 */
    failedStepCount: number;
    /** 跳过的步骤数 */
    skippedStepCount: number;
}

/**
 * Tianshu响应
 */
export interface TianshuResponse {
    /** 命令ID */
    commandId: string;
    /** 用户意图 */
    intent: UserIntent;
    /** 执行状态 */
    status: "accepted" | "queued" | "processing" | "completed" | "failed" | "cancelled";
    /** 执行结果 */
    result?: any;
    /** 错误信息 */
    error?: TianshuError;
    /** 执行指标 */
    metrics?: ExecutionMetrics;
    /** 响应时间戳 */
    timestamp: number;
}

/**
 * 进度更新
 */
export interface ProgressUpdate {
    /** 命令ID */
    commandId: string;
    /** 当前步骤 */
    currentStep: number;
    /** 总步骤数 */
    totalSteps: number;
    /** 进度百分比 */
    progress: number;
    /** 当前步骤描述 */
    stepDescription: string;
    /** 预计剩余时间（毫秒） */
    estimatedRemainingTime?: number;
    /** 更新时间戳 */
    timestamp: number;
}

/**
 * 状态更新
 */
export interface StatusUpdate {
    /** 引擎名称 */
    engine: string;
    /** 状态类型 */
    type: "health" | "performance" | "error" | "warning";
    /** 状态值 */
    value: any;
    /** 状态描述 */
    description: string;
    /** 更新时间戳 */
    timestamp: number;
}

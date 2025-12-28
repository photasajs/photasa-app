/**
 * Tianshu引擎响应类型定义
 */

// 移除未使用的导入

/**
 * 系统状态类型
 */
export type SystemStatus = "healthy" | "degraded" | "unhealthy" | "unknown";

/**
 * 引擎状态
 */
export interface EngineStatus {
    /** 引擎名称 */
    name: string;
    /** 状态 */
    status: SystemStatus;
    /** 最后检查时间 */
    lastCheck: number;
    /** 响应时间（毫秒） */
    responseTime?: number;
    /** 错误信息 */
    error?: string;
    /** 指标数据 */
    metrics?: Record<string, any>;
}

/**
 * 工作流状态
 */
export interface WorkflowStatus {
    /** 工作流ID */
    workflowId: string;
    /** 执行ID */
    executionId: string;
    /** 状态 */
    status: "idle" | "running" | "paused" | "completed" | "failed" | "cancelled" | "pending";
    /** 当前步骤 */
    currentStep?: string;
    /** 进度百分比 */
    progress: number;
    /** 开始时间 */
    startTime: number;
    /** 预计完成时间 */
    estimatedCompletionTime?: number;
    /** 错误信息 */
    error?: string;
}

/**
 * 系统状态报告
 */
export interface SystemStatusReport {
    /** 系统整体状态 */
    overallStatus: SystemStatus;
    /** 报告时间 */
    timestamp: number;
    /** 引擎状态列表 */
    engines: EngineStatus[];
    /** 工作流状态列表 */
    workflows: WorkflowStatus[];
    /** 系统指标 */
    systemMetrics: {
        /** CPU使用率 */
        cpuUsage: number;
        /** 内存使用量（字节） */
        memoryUsage: number;
        /** 磁盘使用量（字节） */
        diskUsage: number;
        /** 活跃连接数 */
        activeConnections: number;
    };
    /** 错误统计 */
    errorStats: {
        /** 总错误数 */
        totalErrors: number;
        /** 最近1小时错误数 */
        recentErrors: number;
        /** 错误类型分布 */
        errorTypes: Record<string, number>;
    };
}

/**
 * 命令执行结果
 */
export interface CommandExecutionResult {
    /** 命令ID */
    commandId: string;
    /** 执行状态 */
    status: "success" | "failure" | "timeout" | "cancelled";
    /** 结果数据 */
    result?: any;
    /** 错误信息 */
    error?: string;
    /** 执行时间 */
    executionTime: number;
    /** 资源使用情况 */
    resourceUsage: {
        /** 内存使用量 */
        memoryUsed: number;
        /** CPU使用时间 */
        cpuTime: number;
    };
}

/**
 * 批量命令响应
 */
export interface BatchCommandResponse {
    /** 批量命令ID */
    batchId: string;
    /** 总命令数 */
    totalCommands: number;
    /** 成功命令数 */
    successCount: number;
    /** 失败命令数 */
    failureCount: number;
    /** 命令结果列表 */
    results: CommandExecutionResult[];
    /** 批量执行时间 */
    totalExecutionTime: number;
    /** 批量状态 */
    status: "completed" | "partial_success" | "failed";
}

/**
 * 健康检查响应
 */
export interface HealthCheckResponse {
    /** 健康状态 */
    healthy: boolean;
    /** 检查时间 */
    timestamp: number;
    /** 版本信息 */
    version: string;
    /** 运行时间 */
    uptime: number;
    /** 依赖服务状态 */
    dependencies: Record<
        string,
        {
            healthy: boolean;
            responseTime?: number;
            error?: string;
        }
    >;
    /** 系统信息 */
    system: {
        platform: string;
        nodeVersion: string;
        memoryUsage: NodeJS.MemoryUsage;
    };
}

/**
 * 统计信息响应
 */
export interface StatisticsResponse {
    /** 统计时间范围 */
    timeRange: {
        start: number;
        end: number;
    };
    /** 命令统计 */
    commands: {
        total: number;
        success: number;
        failure: number;
        averageExecutionTime: number;
    };
    /** 工作流统计 */
    workflows: {
        total: number;
        running: number;
        completed: number;
        failed: number;
    };
    /** 性能指标 */
    performance: {
        averageResponseTime: number;
        peakMemoryUsage: number;
        errorRate: number;
    };
}

/**
 * 配置响应
 */
export interface ConfigResponse {
    /** 配置项 */
    config: Record<string, any>;
    /** 配置版本 */
    version: string;
    /** 最后更新时间 */
    lastUpdated: number;
    /** 配置来源 */
    source: "file" | "database" | "memory" | "default";
}

/**
 * 日志响应
 */
export interface LogResponse {
    /** 日志条目 */
    logs: Array<{
        timestamp: number;
        level: "debug" | "info" | "warn" | "error";
        message: string;
        context?: Record<string, any>;
    }>;
    /** 总日志数 */
    total: number;
    /** 分页信息 */
    pagination: {
        page: number;
        pageSize: number;
        totalPages: number;
    };
}

/**
 * 服务管理核心类型定义
 */

import { BrowserWindow, IpcMain, App } from "electron";

/**
 * 服务优先级
 */
export enum ServicePriority {
    Critical = "critical",
    Important = "important",
    Background = "background",
}

/**
 * 服务元数据
 */
export interface ServiceMetadata {
    /** 服务唯一标识 */
    name: string;
    /** 服务显示名称 */
    displayName?: string;
    /** 服务优先级 */
    priority: ServicePriority;
    /** 依赖的其他服务 */
    dependencies?: string[];
    /** 是否延迟加载 */
    lazyLoad?: boolean;
    /** 启动延迟时间（毫秒） */
    startupDelay?: number;
    /** 失败时是否重试 */
    retryOnFailure?: boolean;
    /** 最大重试次数 */
    maxRetries?: number;
    /** 服务描述 */
    description?: string;
}

/**
 * 服务接口
 */
export interface IService {
    /** 服务名称 */
    readonly name: string;
    /** 初始化服务 */
    initialize(): Promise<void>;
    /** 关闭服务 */
    shutdown?(): Promise<void>;
    /** 健康检查 */
    healthCheck?(): Promise<boolean>;
    /** 获取服务状态 */
    getStatus?(): ServiceStatus;
}

/**
 * 服务状态
 */
export interface ServiceStatus {
    /** 是否正在运行 */
    running: boolean;
    /** 是否健康 */
    healthy?: boolean;
    /** 最后健康检查时间 */
    lastHealthCheck?: Date;
    /** 错误信息 */
    error?: string;
    /** 启动时间 */
    startTime?: Date;
    /** 重启次数 */
    restartCount?: number;
}

/**
 * 服务工厂函数
 */
export type ServiceFactory = (
    ipcMain: IpcMain,
    mainWindow: BrowserWindow,
    app: App,
    dependencies?: Map<string, IService>,
) => IService;

/**
 * 服务初始化选项
 */
export interface ServiceInitOptions {
    /** 是否阻塞等待 */
    blocking?: boolean;
    /** 是否错开初始化时间 */
    staggered?: boolean;
    /** 错开的时间间隔 */
    staggerDelay?: number;
}

/**
 * 服务管理器配置
 */
export interface ServiceManagerConfig {
    /** 是否启用健康检查 */
    enableHealthCheck?: boolean;
    /** 健康检查间隔（毫秒） */
    healthCheckInterval?: number;
    /** 是否启用自动恢复 */
    enableAutoRecovery?: boolean;
    /** 服务启动超时时间（毫秒） */
    startupTimeout?: number;
}

/**
 * 服务事件
 */
export enum ServiceEvent {
    /** 服务已启动 */
    STARTED = "service:started",
    /** 服务已停止 */
    STOPPED = "service:stopped",
    /** 服务启动失败 */
    START_FAILED = "service:start-failed",
    /** 服务健康检查失败 */
    HEALTH_CHECK_FAILED = "service:health-check-failed",
    /** 服务正在重启 */
    RESTARTING = "service:restarting",
    /** 服务已恢复 */
    RECOVERED = "service:recovered",
}

/**
 * 服务事件数据
 */
export interface ServiceEventData {
    /** 服务名称 */
    serviceName: string;
    /** 事件类型 */
    event: ServiceEvent;
    /** 时间戳 */
    timestamp: Date;
    /** 额外数据 */
    data?: any;
    /** 错误信息 */
    error?: Error;
}

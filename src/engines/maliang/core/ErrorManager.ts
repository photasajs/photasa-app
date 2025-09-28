/**
 * MaLiang 错误管理系统
 * 统一的错误处理、恢复和监控机制
 *
 * 设计原则：
 * 1. 纯函数设计 - 成功返回结果，失败抛异常
 * 2. 分层处理 - 不同级别的错误有不同的处理策略
 * 3. 可恢复性 - 尽可能从错误中恢复而不是完全失败
 * 4. 可观测性 - 所有错误都被记录和监控
 */

import type { PhotasaLogger } from "@common/logger";
import type { PaintRequest, PaintResult } from "../types/BrushTypes";

/**
 * 错误严重程度级别
 */
export enum ErrorSeverity {
    LOW = "low", // 可忽略的小问题
    MEDIUM = "medium", // 需要关注但不影响功能
    HIGH = "high", // 影响功能但可恢复
    CRITICAL = "critical", // 严重错误需要立即处理
}

/**
 * 错误选项
 */
export interface ErrorOptions {
    recoverable?: boolean;
    retryable?: boolean;
    severity?: ErrorSeverity;
    context?: any;
    cause?: Error;
}

/**
 * MaLiang基础错误类
 * 所有MaLiang错误的基类，提供统一的错误结构
 */
export class MaLiangError extends Error {
    public readonly code: string;
    public readonly recoverable: boolean;
    public readonly retryable: boolean;
    public readonly severity: ErrorSeverity;
    public readonly context?: any;
    public readonly cause?: Error;
    public readonly timestamp: Date;

    constructor(message: string, code: string, options?: ErrorOptions) {
        super(message);
        this.name = this.constructor.name;
        this.code = code;
        this.recoverable = options?.recoverable ?? false;
        this.retryable = options?.retryable ?? false;
        this.severity = options?.severity ?? ErrorSeverity.MEDIUM;
        this.context = options?.context;
        this.cause = options?.cause;
        this.timestamp = new Date();

        // 保持原型链
        Object.setPrototypeOf(this, new.target.prototype);
    }

    /**
     * 获取完整的错误信息
     */
    public getFullMessage(): string {
        let message = `[${this.code}] ${this.message}`;
        if (this.cause) {
            message += ` | Caused by: ${this.cause.message}`;
        }
        return message;
    }

    /**
     * 转换为JSON格式
     */
    public toJSON() {
        return {
            name: this.name,
            code: this.code,
            message: this.message,
            severity: this.severity,
            recoverable: this.recoverable,
            retryable: this.retryable,
            timestamp: this.timestamp,
            context: this.context,
            cause: this.cause?.message,
            stack: this.stack,
        };
    }
}

/**
 * 参数验证错误 - 输入参数不合法
 */
export class ValidationError extends MaLiangError {
    constructor(message: string, context?: any) {
        super(message, "VALIDATION_ERROR", {
            recoverable: false,
            retryable: false,
            severity: ErrorSeverity.LOW,
            context,
        });
    }
}

/**
 * 格式错误 - 文件格式不支持或格式损坏
 */
export class FormatError extends MaLiangError {
    constructor(message: string, context?: any) {
        super(message, "FORMAT_ERROR", {
            recoverable: true, // 可能通过其他神笔处理
            retryable: false,
            severity: ErrorSeverity.MEDIUM,
            context,
        });
    }
}

/**
 * 处理错误 - 处理过程中的错误
 */
export class ProcessingError extends MaLiangError {
    constructor(message: string, context?: any, cause?: Error) {
        super(message, "PROCESSING_ERROR", {
            recoverable: true,
            retryable: true,
            severity: ErrorSeverity.HIGH,
            context,
            cause,
        });
    }
}

/**
 * 资源错误 - 文件、内存、网络等资源问题
 */
export class ResourceError extends MaLiangError {
    constructor(message: string, context?: any) {
        super(message, "RESOURCE_ERROR", {
            recoverable: true,
            retryable: true,
            severity: ErrorSeverity.HIGH,
            context,
        });
    }
}

/**
 * 超时错误 - 操作超时
 */
export class TimeoutError extends MaLiangError {
    constructor(message: string, context?: any) {
        super(message, "TIMEOUT_ERROR", {
            recoverable: true,
            retryable: true,
            severity: ErrorSeverity.HIGH,
            context,
        });
    }
}

/**
 * 恢复结果
 */
export interface RecoveryResult {
    success: boolean;
    recovered?: PaintResult; // 恢复后的结果
    fallback?: PaintResult; // 降级方案结果
    newRequest?: PaintRequest; // 修正后的请求
    error?: MaLiangError; // 如果恢复失败，返回错误
}

/**
 * 错误恢复策略接口
 */
export interface ErrorRecoveryStrategy {
    /**
     * 判断是否可以恢复此错误
     */
    canRecover(error: MaLiangError): boolean;

    /**
     * 执行恢复操作
     */
    recover(error: MaLiangError, context: PaintRequest): Promise<RecoveryResult>;

    /**
     * 判断是否应该重试
     */
    shouldRetry(error: MaLiangError, attempt: number): boolean;

    /**
     * 获取重试延迟时间（毫秒）
     */
    getRetryDelay(attempt: number): number;
}

/**
 * 格式错误恢复策略
 * 尝试使用其他神笔处理不支持的格式
 */
export class FormatErrorRecoveryStrategy implements ErrorRecoveryStrategy {
    constructor(
        private logger?: PhotasaLogger,
        private maxRetries: number = 3,
    ) {}

    public canRecover(error: MaLiangError): boolean {
        return error instanceof FormatError && error.recoverable;
    }

    public async recover(error: MaLiangError, context: PaintRequest): Promise<RecoveryResult> {
        this.logger?.info(`尝试从格式错误中恢复: ${error.message}`);

        // 这里应该尝试选择其他神笔
        // 实际实现需要引用BrushRegistry
        return {
            success: false,
            error: new FormatError("没有找到合适的神笔处理此格式", context),
        };
    }

    public shouldRetry(error: MaLiangError, attempt: number): boolean {
        return error.retryable && attempt < this.maxRetries;
    }

    public getRetryDelay(attempt: number): number {
        // 指数退避: 1s, 2s, 4s...
        return Math.min(1000 * Math.pow(2, attempt - 1), 10000);
    }
}

/**
 * 资源错误恢复策略
 * 处理内存不足、文件锁定等资源问题
 */
export class ResourceErrorRecoveryStrategy implements ErrorRecoveryStrategy {
    constructor(
        private logger?: PhotasaLogger,
        private maxRetries: number = 5,
    ) {}

    public canRecover(error: MaLiangError): boolean {
        return error instanceof ResourceError && error.recoverable;
    }

    public async recover(error: MaLiangError, context: PaintRequest): Promise<RecoveryResult> {
        this.logger?.info(`尝试从资源错误中恢复: ${error.message}`);

        // 降低处理质量
        const newRequest: PaintRequest = {
            ...context,
            thumbnailOptions: {
                width: context.thumbnailOptions?.width || 150,
                height: context.thumbnailOptions?.height || 150,
                ...context.thumbnailOptions,
                quality: Math.max((context.thumbnailOptions?.quality || 80) - 20, 30),
            },
        };

        return {
            success: true,
            newRequest,
        };
    }

    public shouldRetry(error: MaLiangError, attempt: number): boolean {
        return error.retryable && attempt < this.maxRetries;
    }

    public getRetryDelay(attempt: number): number {
        // 线性退避: 2s, 4s, 6s...
        return Math.min(2000 * attempt, 15000);
    }
}

/**
 * 回退错误恢复策略
 * 简化的错误恢复策略，主要提供重试和质量降级能力
 * FallbackBrush的选择由BrushRegistry自动处理
 */
export class FallbackErrorRecoveryStrategy implements ErrorRecoveryStrategy {
    constructor(private logger?: PhotasaLogger) {}

    public canRecover(error: MaLiangError): boolean {
        // 对于非关键性错误，支持简单的重试或质量降级
        return error.severity !== ErrorSeverity.CRITICAL && error.retryable;
    }

    public async recover(error: MaLiangError, context: PaintRequest): Promise<RecoveryResult> {
        this.logger?.info(`尝试错误恢复: ${error.message}`);

        // 简单的质量降级策略
        if (
            context.thumbnailOptions &&
            context.thumbnailOptions.quality &&
            context.thumbnailOptions.quality > 50
        ) {
            const newRequest: PaintRequest = {
                ...context,
                thumbnailOptions: {
                    ...context.thumbnailOptions,
                    quality: Math.max(context.thumbnailOptions.quality - 30, 30),
                    width: Math.min(context.thumbnailOptions.width || 150, 150),
                    height: Math.min(context.thumbnailOptions.height || 150, 150),
                },
            };

            this.logger?.info(`降低质量重试: quality=${newRequest.thumbnailOptions?.quality}`);

            return {
                success: true,
                newRequest,
            };
        }

        // 如果无法降级，返回失败
        return {
            success: false,
            error: new ProcessingError(`无法恢复的错误: ${error.message}`, context, error),
        };
    }

    public shouldRetry(error: MaLiangError, attempt: number): boolean {
        return error.retryable && attempt < 2; // 最多重试2次
    }

    public getRetryDelay(attempt: number): number {
        return 1000 * attempt; // 1s, 2s
    }
}

/**
 * 错误统计信息
 */
export interface ErrorStatistics {
    totalErrors: number;
    errorsByCode: Map<string, number>;
    errorsBySeverity: Map<ErrorSeverity, number>;
    recoverableErrors: number;
    recoveredErrors: number;
    averageRecoveryTime: number;
}

/**
 * 错误管理器
 * 负责错误处理、恢复和监控
 */
export class ErrorManager {
    private strategies: Map<string, ErrorRecoveryStrategy> = new Map();
    private errorHistory: MaLiangError[] = [];
    private recoveryStats = {
        totalAttempts: 0,
        successfulRecoveries: 0,
        totalRecoveryTime: 0,
    };

    constructor(private logger?: PhotasaLogger) {
        // 注册默认恢复策略
        this.registerStrategy("FORMAT_ERROR", new FormatErrorRecoveryStrategy(logger));
        this.registerStrategy("RESOURCE_ERROR", new ResourceErrorRecoveryStrategy(logger));
        this.registerStrategy("FALLBACK", new FallbackErrorRecoveryStrategy(logger));
    }

    /**
     * 注册错误恢复策略
     */
    public registerStrategy(errorCode: string, strategy: ErrorRecoveryStrategy): void {
        this.strategies.set(errorCode, strategy);
        this.logger?.debug(`注册错误恢复策略: ${errorCode}`);
    }

    /**
     * 处理错误
     */
    public async handleError(error: Error, context: PaintRequest): Promise<RecoveryResult> {
        const startTime = performance.now();

        // 转换为MaLiangError
        const maLiangError = this.normalizeError(error);

        // 记录错误
        this.recordError(maLiangError);
        this.logger?.error(`处理错误: ${maLiangError.getFullMessage()}`);

        // 尝试恢复
        const strategy = this.strategies.get(maLiangError.code);
        if (!strategy || !strategy.canRecover(maLiangError)) {
            return {
                success: false,
                error: maLiangError,
            };
        }

        this.recoveryStats.totalAttempts++;

        try {
            const result = await strategy.recover(maLiangError, context);

            if (result.success) {
                this.recoveryStats.successfulRecoveries++;
                this.logger?.info(`成功从错误中恢复: ${maLiangError.code}`);
            }

            const recoveryTime = performance.now() - startTime;
            this.recoveryStats.totalRecoveryTime += recoveryTime;

            return result;
        } catch (recoveryError) {
            this.logger?.error(`错误恢复失败: ${recoveryError}`);
            return {
                success: false,
                error: new ProcessingError(
                    "错误恢复失败",
                    context,
                    recoveryError instanceof Error ? recoveryError : undefined,
                ),
            };
        }
    }

    /**
     * 将普通错误转换为MaLiangError
     */
    private normalizeError(error: Error): MaLiangError {
        if (error instanceof MaLiangError) {
            return error;
        }

        // 根据错误消息推断错误类型
        const message = error.message.toLowerCase();

        if (message.includes("format") || message.includes("unsupported")) {
            return new FormatError(error.message);
        }

        if (message.includes("memory") || message.includes("resource")) {
            return new ResourceError(error.message);
        }

        if (message.includes("timeout")) {
            return new TimeoutError(error.message);
        }

        // 默认为处理错误
        return new ProcessingError(error.message, undefined, error);
    }

    /**
     * 记录错误
     */
    private recordError(error: MaLiangError): void {
        this.errorHistory.push(error);

        // 限制历史记录大小
        if (this.errorHistory.length > 1000) {
            this.errorHistory.shift();
        }
    }

    /**
     * 获取错误统计信息
     */
    public getStatistics(): ErrorStatistics {
        const stats: ErrorStatistics = {
            totalErrors: this.errorHistory.length,
            errorsByCode: new Map(),
            errorsBySeverity: new Map(),
            recoverableErrors: 0,
            recoveredErrors: this.recoveryStats.successfulRecoveries,
            averageRecoveryTime: 0,
        };

        // 统计错误分布
        for (const error of this.errorHistory) {
            // 按错误代码统计
            const codeCount = stats.errorsByCode.get(error.code) || 0;
            stats.errorsByCode.set(error.code, codeCount + 1);

            // 按严重程度统计
            const severityCount = stats.errorsBySeverity.get(error.severity) || 0;
            stats.errorsBySeverity.set(error.severity, severityCount + 1);

            // 统计可恢复错误
            if (error.recoverable) {
                stats.recoverableErrors++;
            }
        }

        // 计算平均恢复时间
        if (this.recoveryStats.successfulRecoveries > 0) {
            stats.averageRecoveryTime =
                this.recoveryStats.totalRecoveryTime / this.recoveryStats.successfulRecoveries;
        }

        return stats;
    }

    /**
     * 获取最频繁的错误
     */
    public getFrequentErrors(limit = 10): Array<{ code: string; count: number }> {
        const stats = this.getStatistics();
        const errors = Array.from(stats.errorsByCode.entries())
            .map(([code, count]) => ({ code, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, limit);

        return errors;
    }

    /**
     * 清理错误历史
     */
    public clearHistory(): void {
        this.errorHistory = [];
        this.recoveryStats = {
            totalAttempts: 0,
            successfulRecoveries: 0,
            totalRecoveryTime: 0,
        };
        this.logger?.info("错误历史已清理");
    }
}

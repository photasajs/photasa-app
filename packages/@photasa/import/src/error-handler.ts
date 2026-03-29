import { getLogger } from "@photasa/common";
import type { ImportError, ErrorCategory, ErrorSeverity } from "@photasa/common";

const logger = getLogger("import-error");

/**
 * 导入错误处理器
 * 负责处理导入过程中的各种错误，提供分类、重试和恢复机制
 */
export class ImportErrorHandler {
    private errors: ImportError[] = [];
    private retryMap = new Map<string, number>(); // 文件路径 -> 重试次数
    private maxRetries = 3;

    /**
     * 记录错误
     */
    recordError(
        filePath: string,
        error: Error | string,
        category: ErrorCategory = "FILE_SYSTEM",
        severity: ErrorSeverity = "MEDIUM",
        recoverable = true,
    ): ImportError {
        const errorMessage = error instanceof Error ? error.message : error;
        const errorObj: ImportError = {
            id: `err_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
            file: filePath,
            filePath,
            error: errorMessage,
            message: errorMessage,
            category,
            severity,
            recoverable,
            retryCount: this.getRetryCount(filePath),
        };

        this.errors.push(errorObj);

        // 根据严重性记录日志
        switch (severity) {
            case "CRITICAL":
            case "HIGH":
                logger.error(`[${category}] ${filePath}: ${errorMessage}`);
                break;
            case "MEDIUM":
                logger.warn(`[${category}] ${filePath}: ${errorMessage}`);
                break;
            case "LOW":
                logger.info(`[${category}] ${filePath}: ${errorMessage}`);
                break;
        }

        return errorObj;
    }

    /**
     * 获取所有错误
     */
    getErrors(): ImportError[] {
        return [...this.errors];
    }

    /**
     * 获取特定类别的错误
     */
    getErrorsByCategory(category: ErrorCategory): ImportError[] {
        return this.errors.filter((err) => err.category === category);
    }

    /**
     * 获取特定严重性的错误
     */
    getErrorsBySeverity(severity: ErrorSeverity): ImportError[] {
        return this.errors.filter((err) => err.severity === severity);
    }

    /**
     * 获取特定文件的错误
     */
    getErrorsForFile(filePath: string): ImportError[] {
        return this.errors.filter((err) => err.filePath === filePath);
    }

    /**
     * 检查文件是否可以重试
     */
    canRetry(filePath: string): boolean {
        const retryCount = this.getRetryCount(filePath);
        return retryCount < this.maxRetries;
    }

    /**
     * 增加文件的重试次数
     */
    incrementRetryCount(filePath: string): number {
        const currentCount = this.getRetryCount(filePath);
        const newCount = currentCount + 1;
        this.retryMap.set(filePath, newCount);
        return newCount;
    }

    /**
     * 获取文件的重试次数
     */
    getRetryCount(filePath: string): number {
        return this.retryMap.get(filePath) || 0;
    }

    /**
     * 重置文件的重试次数
     */
    resetRetryCount(filePath: string): void {
        this.retryMap.delete(filePath);
    }

    /**
     * 清除所有错误
     */
    clearErrors(): void {
        this.errors = [];
    }

    /**
     * 清除特定文件的错误
     */
    clearErrorsForFile(filePath: string): void {
        this.errors = this.errors.filter((err) => err.filePath !== filePath);
    }

    /**
     * 获取错误统计信息
     */
    getErrorStats(): {
        total: number;
        byCategory: Record<ErrorCategory, number>;
        bySeverity: Record<ErrorSeverity, number>;
        recoverableCount: number;
    } {
        const byCategory: Record<ErrorCategory, number> = {
            FILE_SYSTEM: 0,
            METADATA: 0,
            VALIDATION: 0,
            NETWORK: 0,
            PERMISSION: 0,
            DISK_SPACE: 0,
            UNKNOWN: 0,
            file_operation: 0,
            metadata_extraction: 0,
            duplicate_handling: 0,
        };

        const bySeverity: Record<ErrorSeverity, number> = {
            LOW: 0,
            MEDIUM: 0,
            HIGH: 0,
            CRITICAL: 0,
            error: 0,
            warning: 0,
            info: 0,
        };

        let recoverableCount = 0;

        for (const error of this.errors) {
            byCategory[error.category]++;
            bySeverity[error.severity]++;
            if (error.recoverable) recoverableCount++;
        }

        return {
            total: this.errors.length,
            byCategory,
            bySeverity,
            recoverableCount,
        };
    }

    /**
     * 获取可恢复的错误
     */
    getRecoverableErrors(): ImportError[] {
        return this.errors.filter((err) => err.recoverable);
    }

    /**
     * 分析错误并提供建议
     */
    analyzeErrors(): {
        summary: string;
        recommendations: string[];
        criticalIssues: ImportError[];
    } {
        const stats = this.getErrorStats();
        const criticalIssues = this.errors.filter(
            (err) => err.severity === "error" && !err.recoverable,
        );

        const summary = `Total errors: ${stats.total} (${stats.recoverableCount} recoverable)`;
        const recommendations: string[] = [];

        // 分析文件操作错误
        if (stats.byCategory.file_operation > 0) {
            const permissionErrors = this.errors.filter(
                (err) => err.category === "file_operation" && err.message.includes("permission"),
            );

            if (permissionErrors.length > 0) {
                recommendations.push("Check file permissions on target directory");
            }

            const spaceErrors = this.errors.filter(
                (err) => err.category === "file_operation" && err.message.includes("space"),
            );

            if (spaceErrors.length > 0) {
                recommendations.push("Free up disk space on target drive");
            }
        }

        // 分析元数据提取错误
        if (stats.byCategory.metadata_extraction > 0) {
            recommendations.push("Some files have invalid or corrupted metadata");
        }

        // 分析重复文件错误
        if (stats.byCategory.duplicate_handling > 0) {
            recommendations.push("Review duplicate file handling strategy");
        }

        return {
            summary,
            recommendations,
            criticalIssues,
        };
    }

    /**
     * 创建错误报告
     */
    generateErrorReport(): string {
        const stats = this.getErrorStats();
        const analysis = this.analyzeErrors();

        let report = "# Import Error Report\n\n";
        report += `Generated: ${new Date().toISOString()}\n\n`;
        report += `## Summary\n\n`;
        report += `- Total errors: ${stats.total}\n`;
        report += `- Recoverable errors: ${stats.recoverableCount}\n`;
        report += `- Critical issues: ${analysis.criticalIssues.length}\n\n`;

        report += `## Error Categories\n\n`;
        for (const [category, count] of Object.entries(stats.byCategory)) {
            if (count > 0) {
                report += `- ${category}: ${count}\n`;
            }
        }

        report += `\n## Recommendations\n\n`;
        for (const recommendation of analysis.recommendations) {
            report += `- ${recommendation}\n`;
        }

        report += `\n## Error Details\n\n`;
        for (const error of this.errors) {
            report += `### ${error.id}\n\n`;
            report += `- File: ${error.filePath}\n`;
            report += `- Category: ${error.category}\n`;
            report += `- Severity: ${error.severity}\n`;
            report += `- Recoverable: ${error.recoverable}\n`;
            report += `- Retry count: ${error.retryCount}\n`;
            report += `- Message: ${error.message}\n\n`;
        }

        return report;
    }
}

/**
 * 错误恢复策略接口
 */
export interface ErrorRecoveryStrategy {
    canRecover(error: ImportError): boolean;
    recover(error: ImportError): Promise<boolean>;
}

/**
 * 重试策略
 */
export class RetryRecoveryStrategy implements ErrorRecoveryStrategy {
    private errorHandler: ImportErrorHandler;
    private retryCallback: (filePath: string) => Promise<boolean>;

    constructor(
        errorHandler: ImportErrorHandler,
        retryCallback: (filePath: string) => Promise<boolean>,
    ) {
        this.errorHandler = errorHandler;
        this.retryCallback = retryCallback;
    }

    canRecover(error: ImportError): boolean {
        return error.recoverable && this.errorHandler.canRetry(error.filePath);
    }

    async recover(error: ImportError): Promise<boolean> {
        if (!this.canRecover(error)) return false;

        this.errorHandler.incrementRetryCount(error.filePath);
        logger.info(
            `Retrying file: ${error.filePath} (attempt ${this.errorHandler.getRetryCount(error.filePath)})`,
        );

        try {
            const success = await this.retryCallback(error.filePath);
            if (success) {
                this.errorHandler.clearErrorsForFile(error.filePath);
            }
            return success;
        } catch (e) {
            logger.error(`Retry failed for ${error.filePath}: ${e}`);
            return false;
        }
    }
}

/**
 * 跳过策略
 */
export class SkipRecoveryStrategy implements ErrorRecoveryStrategy {
    canRecover(_error: ImportError): boolean {
        // 所有错误都可以跳过
        return true;
    }

    async recover(error: ImportError): Promise<boolean> {
        logger.info(`Skipping file: ${error.filePath}`);
        return true; // 跳过总是成功的
    }
}

/**
 * 错误恢复管理器
 */
export class ErrorRecoveryManager {
    private strategies: ErrorRecoveryStrategy[] = [];
    private errorHandler: ImportErrorHandler;

    constructor(errorHandler: ImportErrorHandler) {
        this.errorHandler = errorHandler;
    }

    addStrategy(strategy: ErrorRecoveryStrategy): void {
        this.strategies.push(strategy);
    }

    async recoverError(error: ImportError): Promise<boolean> {
        for (const strategy of this.strategies) {
            if (strategy.canRecover(error)) {
                const success = await strategy.recover(error);
                if (success) return true;
            }
        }

        return false;
    }

    async recoverAll(): Promise<{
        attempted: number;
        succeeded: number;
        failed: number;
    }> {
        const recoverableErrors = this.errorHandler.getRecoverableErrors();
        let attempted = 0;
        let succeeded = 0;
        let failed = 0;

        for (const error of recoverableErrors) {
            attempted++;
            const success = await this.recoverError(error);
            if (success) {
                succeeded++;
            } else {
                failed++;
            }
        }

        return { attempted, succeeded, failed };
    }
}

// 导出单例实例
export const importErrorHandler = new ImportErrorHandler();

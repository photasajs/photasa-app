/**
 * Queue Health Monitoring Types
 * Defines interfaces and types for queue health monitoring dashboard
 */

/**
 * Real-time queue health metrics
 */
export interface QueueHealthMetrics {
    /** Current number of operations in queue */
    currentSize: number;

    /** Number of operations processed per minute */
    processingRate: number;

    /** Error rate as percentage (0-100) */
    errorRate: number;

    /** Timestamp of oldest operation in queue */
    oldestOperation: Date | null;

    /** Estimated time to complete all operations in minutes */
    estimatedTimeToComplete: number;

    /** Memory usage by queue in MB */
    memoryUsage: number;

    /** Count of operations by type */
    eventTypes: Record<string, number>;

    /** Count of operations by status */
    statusCounts: {
        pending: number;
        processing: number;
        completed: number;
        failed: number;
    };

    /** Recent processing history for rate calculation */
    recentProcessingHistory: ProcessingHistoryEntry[];

    /** Last update timestamp */
    lastUpdated: Date;
}

/**
 * Processing history entry for rate calculation
 */
export interface ProcessingHistoryEntry {
    timestamp: Date;
    operationsCompleted: number;
    operationsFailed: number;
    queueSize: number;
}

/**
 * Queue monitoring configuration
 */
export interface QueueMonitoringConfig {
    /** Update interval in milliseconds */
    updateInterval: number;

    /** Maximum history entries to keep */
    maxHistoryEntries: number;

    /** Warning threshold for queue size */
    queueSizeWarningThreshold: number;

    /** Error rate warning threshold (percentage) */
    errorRateWarningThreshold: number;

    /** Memory usage warning threshold in MB */
    memoryWarningThreshold: number;
}

/**
 * Queue control actions
 */
export type QueueControlAction =
    | "pause"
    | "resume"
    | "clear-completed"
    | "clear-failed"
    | "clear-all"
    | "retry-failed";

/**
 * Queue status
 */
export type QueueStatus = "active" | "paused" | "idle" | "error";

/**
 * Metric display configuration
 */
export interface MetricCardConfig {
    title: string;
    value: string | number;
    unit?: string;
    trend?: "up" | "down" | "stable";
    severity?: "info" | "warning" | "error" | "success";
    description?: string;
}

/**
 * Chart data point for queue visualization
 */
export interface ChartDataPoint {
    timestamp: Date;
    queueSize: number;
    processingRate: number;
    errorRate: number;
}

/**
 * Default monitoring configuration
 */
export const DEFAULT_MONITORING_CONFIG: QueueMonitoringConfig = {
    updateInterval: 5000, // 5 seconds
    maxHistoryEntries: 100, // Keep last 100 entries (about 8 minutes of history)
    queueSizeWarningThreshold: 1000,
    errorRateWarningThreshold: 5, // 5% error rate
    memoryWarningThreshold: 100, // 100MB
};

/**
 * Utility functions for queue monitoring
 */
export class QueueMonitoringUtils {
    /**
     * Calculate processing rate from history
     */
    static calculateProcessingRate(history: ProcessingHistoryEntry[]): number {
        if (history.length < 2) return 0;

        const recent = history.slice(-10); // Last 10 entries
        const timeSpan =
            recent[recent.length - 1].timestamp.getTime() - recent[0].timestamp.getTime();
        const totalProcessed = recent.reduce((sum, entry) => sum + entry.operationsCompleted, 0);

        if (timeSpan === 0) return 0;

        // Convert to operations per minute
        return (totalProcessed / (timeSpan / 1000)) * 60;
    }

    /**
     * Calculate error rate from history
     */
    static calculateErrorRate(history: ProcessingHistoryEntry[]): number {
        if (history.length === 0) return 0;

        const recent = history.slice(-10);
        const totalCompleted = recent.reduce((sum, entry) => sum + entry.operationsCompleted, 0);
        const totalFailed = recent.reduce((sum, entry) => sum + entry.operationsFailed, 0);
        const total = totalCompleted + totalFailed;

        if (total === 0) return 0;

        return (totalFailed / total) * 100;
    }

    /**
     * Estimate completion time based on current queue size and processing rate
     */
    static estimateCompletionTime(queueSize: number, processingRate: number): number {
        if (processingRate === 0 || queueSize === 0) return 0;
        return queueSize / processingRate; // minutes
    }

    /**
     * Format time duration for display
     */
    static formatDuration(minutes: number): string {
        if (minutes < 1) return "< 1分钟";
        if (minutes < 60) return `${Math.round(minutes)}分钟`;

        const hours = Math.floor(minutes / 60);
        const remainingMinutes = Math.round(minutes % 60);

        if (hours < 24) {
            return remainingMinutes > 0 ? `${hours}小时${remainingMinutes}分钟` : `${hours}小时`;
        }

        const days = Math.floor(hours / 24);
        const remainingHours = hours % 24;

        return remainingHours > 0 ? `${days}天${remainingHours}小时` : `${days}天`;
    }

    /**
     * Format memory usage for display
     */
    static formatMemoryUsage(bytes: number): string {
        const mb = bytes / (1024 * 1024);
        if (mb < 1) return `${(bytes / 1024).toFixed(1)} KB`;
        if (mb < 1024) return `${mb.toFixed(1)} MB`;
        return `${(mb / 1024).toFixed(1)} GB`;
    }

    /**
     * Determine metric severity based on thresholds
     */
    static getMetricSeverity(
        value: number,
        warningThreshold: number,
        errorThreshold?: number,
    ): MetricCardConfig["severity"] {
        if (errorThreshold && value >= errorThreshold) return "error";
        if (value >= warningThreshold) return "warning";
        return "info";
    }
}

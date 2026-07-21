/**
 * Queue Monitoring Service
 * Provides real-time queue health monitoring and metrics collection
 */

import { ref, computed, type Ref } from "vue";
import type {
    QueueHealthMetrics,
    ProcessingHistoryEntry,
    QueueMonitoringConfig,
    QueueControlAction,
    QueueStatus,
    ChartDataPoint,
} from "@photasa/common";
import { DEFAULT_MONITORING_CONFIG, QueueMonitoringUtils } from "@photasa/common";
import type { ScanQueueItem } from "@renderer/stores/scanning-types";
import { loggers } from "@photasa/common";

const logger = loggers.app;

/** 由 App 注入，避免在定时器回调中调用 Vue composable */
export type QueueSnapshotProvider = () => ScanQueueItem[];

export class QueueMonitoringService {
    private config: QueueMonitoringConfig = DEFAULT_MONITORING_CONFIG;
    private updateTimer: NodeJS.Timeout | null = null;
    private processingHistory: ProcessingHistoryEntry[] = [];
    private chartData: ChartDataPoint[] = [];
    private queueProvider: QueueSnapshotProvider | null = null;
    private previousQueueSnapshot: ScanQueueItem[] = [];
    private sessionCompletedCount = 0;

    // Reactive state
    private _metrics = ref<QueueHealthMetrics>({
        currentSize: 0,
        processingRate: 0,
        errorRate: 0,
        oldestOperation: null,
        estimatedTimeToComplete: 0,
        memoryUsage: 0,
        eventTypes: {},
        statusCounts: {
            pending: 0,
            processing: 0,
            completed: 0,
            failed: 0,
        },
        recentProcessingHistory: [],
        lastUpdated: new Date(),
    });

    private _status = ref<QueueStatus>("idle");
    private _isMonitoring = ref(false);

    // Public reactive getters
    get metrics(): Ref<QueueHealthMetrics> {
        return this._metrics;
    }

    get status(): Ref<QueueStatus> {
        return this._status;
    }

    get isMonitoring(): Ref<boolean> {
        return this._isMonitoring;
    }

    get chartDataHistory(): ChartDataPoint[] {
        return [...this.chartData];
    }

    // Computed properties for dashboard
    readonly queueHealth = computed(() => {
        const metrics = this._metrics.value;
        let health: "good" | "warning" | "error" = "good";

        if (metrics.errorRate >= this.config.errorRateWarningThreshold) {
            health = "error";
        } else if (
            metrics.currentSize >= this.config.queueSizeWarningThreshold ||
            metrics.memoryUsage >= this.config.memoryWarningThreshold
        ) {
            health = "warning";
        }

        return health;
    });

    /**
     * 注入扫描队列快照来源（须在 startMonitoring 前由 App.vue 调用）
     */
    setQueueProvider(provider: QueueSnapshotProvider): void {
        this.queueProvider = provider;
    }

    /**
     * Start monitoring queue health
     */
    startMonitoring(): void {
        if (this._isMonitoring.value) {
            logger.warn("Queue monitoring already started");
            return;
        }

        logger.info("Starting queue health monitoring");
        this._isMonitoring.value = true;
        this.collectMetrics(); // Initial collection

        this.updateTimer = setInterval(() => {
            this.collectMetrics();
        }, this.config.updateInterval);
    }

    /**
     * Stop monitoring queue health
     */
    stopMonitoring(): void {
        if (!this._isMonitoring.value) {
            return;
        }

        logger.info("Stopping queue health monitoring");
        this._isMonitoring.value = false;

        if (this.updateTimer) {
            clearInterval(this.updateTimer);
            this.updateTimer = null;
        }
    }

    /**
     * Update monitoring configuration
     */
    updateConfig(newConfig: Partial<QueueMonitoringConfig>): void {
        this.config = { ...this.config, ...newConfig };
        logger.debug("Queue monitoring config updated:", this.config);

        // Restart monitoring with new config if currently running
        if (this._isMonitoring.value) {
            this.stopMonitoring();
            this.startMonitoring();
        }
    }

    /**
     * Collect current queue metrics from ScanningStore snapshot (RFC 0048 v3)
     */
    private collectMetrics(): void {
        try {
            if (!this.queueProvider) {
                logger.warn("Queue provider not set; skipping metrics collection");
                this._status.value = "error";
                return;
            }

            const scanningQueue = this.queueProvider();

            // Calculate basic metrics
            const currentSize = scanningQueue.length;
            const oldestOperation = this.getOldestOperation(scanningQueue);
            const eventTypes = this.calculateEventTypes(scanningQueue);
            const queueStatusCounts = this.calculateQueueStatusCounts(scanningQueue);
            const { completedDelta, failedDelta } = this.calculateProcessingDeltas(
                this.previousQueueSnapshot,
                scanningQueue,
            );
            this.sessionCompletedCount += completedDelta;
            this.previousQueueSnapshot = scanningQueue.map((item) => ({ ...item }));

            const statusCounts: QueueHealthMetrics["statusCounts"] = {
                ...queueStatusCounts,
                // v3 成功任务立即出队；completed 表示本会话累计完成数
                completed: this.sessionCompletedCount,
            };
            const memoryUsage = this.estimateMemoryUsage(scanningQueue);

            const historyEntry: ProcessingHistoryEntry = {
                timestamp: new Date(),
                operationsCompleted: completedDelta,
                operationsFailed: failedDelta,
                queueSize: currentSize,
            };

            this.processingHistory.push(historyEntry);

            // Keep history within limits
            if (this.processingHistory.length > this.config.maxHistoryEntries) {
                this.processingHistory = this.processingHistory.slice(
                    -this.config.maxHistoryEntries,
                );
            }

            // Calculate derived metrics
            const processingRate = QueueMonitoringUtils.calculateProcessingRate(
                this.processingHistory,
            );
            const errorRate = QueueMonitoringUtils.calculateErrorRate(this.processingHistory);
            const estimatedTimeToComplete = QueueMonitoringUtils.estimateCompletionTime(
                statusCounts.pending + statusCounts.processing,
                processingRate,
            );

            // Update metrics
            this._metrics.value = {
                currentSize,
                processingRate,
                errorRate,
                oldestOperation,
                estimatedTimeToComplete,
                memoryUsage,
                eventTypes,
                statusCounts,
                recentProcessingHistory: this.processingHistory.slice(-10),
                lastUpdated: new Date(),
            };

            // Update chart data
            this.updateChartData();

            // Update status
            this.updateStatus(statusCounts);

            logger.debug("Queue metrics collected:", {
                size: currentSize,
                rate: processingRate,
                errorRate,
                memory: memoryUsage,
            });
        } catch (error) {
            logger.error("Error collecting queue metrics:", error);
            this._status.value = "error";
        }
    }

    /**
     * Get oldest operation timestamp
     */
    private getOldestOperation(scanningQueue: ScanQueueItem[]): Date | null {
        if (scanningQueue.length === 0) return null;

        const timestamps = scanningQueue
            .map((item) => item.createdAt)
            .filter((timestamp) => timestamp != null)
            .map((timestamp) => new Date(timestamp));

        if (timestamps.length === 0) return null;

        return new Date(Math.min(...timestamps.map((date) => date.getTime())));
    }

    /**
     * 对比相邻两次快照，推算完成/失败增量（v3 成功即删，completed 不在队列里）
     */
    private calculateProcessingDeltas(
        previousQueue: ScanQueueItem[],
        currentQueue: ScanQueueItem[],
    ): { completedDelta: number; failedDelta: number } {
        const currentByPath = new Map(currentQueue.map((item) => [item.path, item]));
        let completedDelta = 0;
        let failedDelta = 0;

        for (const previousItem of previousQueue) {
            const currentItem = currentByPath.get(previousItem.path);
            if (!currentItem) {
                if (previousItem.status === "failed") {
                    continue;
                }
                completedDelta += 1;
                continue;
            }

            if (previousItem.status !== "failed" && currentItem.status === "failed") {
                failedDelta += 1;
            }
        }

        return { completedDelta, failedDelta };
    }

    /**
     * Calculate event types distribution
     */
    private calculateEventTypes(scanningQueue: ScanQueueItem[]): Record<string, number> {
        const eventTypes: Record<string, number> = {};

        scanningQueue.forEach((item) => {
            const type = item.action || "unknown";
            eventTypes[type] = (eventTypes[type] || 0) + 1;
        });

        return eventTypes;
    }

    /**
     * 当前队列内状态分布（不含 completed，v3 成功即删）
     */
    private calculateQueueStatusCounts(
        scanningQueue: ScanQueueItem[],
    ): Pick<QueueHealthMetrics["statusCounts"], "pending" | "processing" | "failed"> {
        const counts = {
            pending: 0,
            processing: 0,
            failed: 0,
        };

        scanningQueue.forEach((item) => {
            const status = item.status || "pending";
            if (status === "pending" || status === "processing" || status === "failed") {
                counts[status] += 1;
            } else {
                counts.pending += 1;
            }
        });

        return counts;
    }

    /**
     * Estimate memory usage by queue
     */
    private estimateMemoryUsage(scanningQueue: ScanQueueItem[]): number {
        // Rough estimate: each queue item uses approximately 200-500 bytes
        const averageItemSize = 350; // bytes
        const totalBytes = scanningQueue.length * averageItemSize;
        return totalBytes / (1024 * 1024); // Convert to MB
    }

    /**
     * Update chart data for visualization
     */
    private updateChartData(): void {
        const metrics = this._metrics.value;

        const chartPoint: ChartDataPoint = {
            timestamp: metrics.lastUpdated,
            queueSize: metrics.currentSize,
            processingRate: metrics.processingRate,
            errorRate: metrics.errorRate,
        };

        this.chartData.push(chartPoint);

        // Keep chart data within reasonable limits (last hour of data)
        const maxDataPoints = Math.ceil(3600 / (this.config.updateInterval / 1000));
        if (this.chartData.length > maxDataPoints) {
            this.chartData = this.chartData.slice(-maxDataPoints);
        }
    }

    /**
     * Update queue status based on current state
     */
    private updateStatus(statusCounts: QueueHealthMetrics["statusCounts"]): void {
        const activeInQueue =
            statusCounts.pending + statusCounts.processing + statusCounts.failed;

        if (activeInQueue === 0) {
            this._status.value = statusCounts.completed > 0 ? "active" : "idle";
        } else if (statusCounts.processing > 0) {
            this._status.value = "active";
        } else if (statusCounts.failed > 0 && statusCounts.pending === 0) {
            this._status.value = "error";
        } else {
            this._status.value = "active";
        }
    }

    /**
     * Execute queue control action
     */
    async executeControlAction(action: QueueControlAction): Promise<boolean> {
        try {
            logger.info(`Executing queue control action: ${action}`);
            // const preferenceStore = usePreferenceStore(); // Reserved for future implementation

            switch (action) {
                case "pause":
                    // TODO: Implement pause functionality
                    logger.warn("Pause functionality not yet implemented");
                    return false;

                case "resume":
                    // TODO: Implement resume functionality
                    logger.warn("Resume functionality not yet implemented");
                    return false;

                case "clear-completed":
                    // Remove completed operations from queue
                    const completedCount = this._metrics.value.statusCounts.completed;
                    // TODO: Implement completed operation cleanup
                    logger.info(`Would clear ${completedCount} completed operations`);
                    return true;

                case "clear-failed":
                    // Remove failed operations from queue
                    const failedCount = this._metrics.value.statusCounts.failed;
                    // TODO: Implement failed operation cleanup
                    logger.info(`Would clear ${failedCount} failed operations`);
                    return true;

                case "clear-all":
                    // Clear entire queue (with user confirmation)
                    const totalCount = this._metrics.value.currentSize;
                    // TODO: Implement full queue clear
                    logger.info(`Would clear all ${totalCount} operations`);
                    return true;

                case "retry-failed":
                    // Retry all failed operations
                    const retryCount = this._metrics.value.statusCounts.failed;
                    // TODO: Implement retry functionality
                    logger.info(`Would retry ${retryCount} failed operations`);
                    return true;

                default:
                    logger.warn(`Unknown control action: ${action}`);
                    return false;
            }
        } catch (error) {
            logger.error(`Error executing control action ${action}:`, error);
            return false;
        }
    }

    /**
     * Export current metrics as JSON
     */
    exportMetrics(): string {
        return JSON.stringify(
            {
                metrics: this._metrics.value,
                chartData: this.chartData,
                config: this.config,
                exportedAt: new Date().toISOString(),
            },
            null,
            2,
        );
    }

    /**
     * Reset all collected data
     */
    reset(): void {
        this.processingHistory = [];
        this.chartData = [];
        this.previousQueueSnapshot = [];
        this.sessionCompletedCount = 0;
        this._metrics.value = {
            currentSize: 0,
            processingRate: 0,
            errorRate: 0,
            oldestOperation: null,
            estimatedTimeToComplete: 0,
            memoryUsage: 0,
            eventTypes: {},
            statusCounts: {
                pending: 0,
                processing: 0,
                completed: 0,
                failed: 0,
            },
            recentProcessingHistory: [],
            lastUpdated: new Date(),
        };
        this._status.value = "idle";

        logger.info("Queue monitoring service reset");
    }
}

// Export singleton instance
export const queueMonitoringService = new QueueMonitoringService();

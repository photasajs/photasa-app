<!-- Queue Health Monitoring Dashboard -->
<template>
    <div class="queue-dashboard" :class="{ 'dashboard-error': queueHealth === 'error' }">
        <!-- Dashboard Header -->
        <div class="dashboard-header">
            <div class="header-title">
                <h2>队列健康监控</h2>
                <div class="status-indicator" :class="statusClass">
                    <span class="status-dot"></span>
                    <span class="status-text">{{ statusText }}</span>
                </div>
            </div>

            <div class="header-info">
                <div class="last-update">最后更新: {{ formatTime(metrics.lastUpdated) }}</div>
                <button class="export-button" @click="exportMetrics" title="导出监控数据">
                    <PhChartBar :size="16" />
                    导出数据
                </button>
            </div>
        </div>

        <!-- Main Metrics Grid -->
        <div class="metrics-grid">
            <BaseMetricsCard
                v-for="metric in mainMetrics"
                :key="metric.title"
                :config="metric"
                :last-updated="metrics.lastUpdated"
                show-last-update
            />
        </div>

        <!-- Secondary Metrics -->
        <div class="secondary-metrics">
            <div class="metrics-section">
                <h3>事件类型分布</h3>
                <div class="event-types-grid">
                    <BaseMetricsCard
                        v-for="(count, type) in metrics.eventTypes"
                        :key="type"
                        :config="{
                            title: getEventTypeLabel(type),
                            value: count,
                            severity: 'info',
                        }"
                    />
                </div>
            </div>

            <div class="metrics-section">
                <h3>状态分布</h3>
                <div class="status-grid">
                    <BaseMetricsCard
                        v-for="(count, status) in metrics.statusCounts"
                        :key="status"
                        :config="{
                            title: getStatusLabel(status),
                            value: count,
                            severity: getStatusSeverity(status, count),
                        }"
                    />
                </div>
            </div>
        </div>

        <!-- Chart Section -->
        <div class="chart-section">
            <h3>队列状态趋势</h3>
            <div class="chart-container">
                <QueueChart :chart-data="chartData" />
            </div>
        </div>

        <!-- Configuration Panel -->
        <div v-if="showConfig" class="config-panel">
            <h3>监控配置</h3>
            <div class="config-form">
                <div class="config-row">
                    <label>更新间隔 (秒)</label>
                    <input
                        type="number"
                        v-model.number="configForm.updateInterval"
                        min="1"
                        max="60"
                        @change="updateConfiguration"
                    />
                </div>

                <div class="config-row">
                    <label>队列大小警告阈值</label>
                    <input
                        type="number"
                        v-model.number="configForm.queueSizeWarningThreshold"
                        min="10"
                        @change="updateConfiguration"
                    />
                </div>

                <div class="config-row">
                    <label>错误率警告阈值 (%)</label>
                    <input
                        type="number"
                        v-model.number="configForm.errorRateWarningThreshold"
                        min="1"
                        max="100"
                        @change="updateConfiguration"
                    />
                </div>
            </div>
        </div>

        <!-- Quick Settings -->
        <div class="quick-settings">
            <button class="settings-toggle" @click="showConfig = !showConfig">
                <PhGear :size="16" />
                {{ showConfig ? "隐藏配置" : "显示配置" }}
            </button>
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, reactive } from "vue";
import { queueMonitoringService } from "@renderer/services/queue-monitoring-service";
import { QueueMonitoringUtils } from "@photasa/common";
import type { MetricCardConfig } from "@photasa/common";
import BaseMetricsCard from "./BaseMetricsCard.vue";
import QueueChart from "./QueueChart.vue";
import { loggers } from "@photasa/common";
import { PhChartBar, PhGear } from "@phosphor-icons/vue";

const logger = loggers.app;

// Reactive state
const showConfig = ref(false);

// Service reactive references
const metrics = queueMonitoringService.metrics;
const status = queueMonitoringService.status;
const isMonitoring = queueMonitoringService.isMonitoring;
const queueHealth = queueMonitoringService.queueHealth;

// Chart data
const chartData = computed(() => queueMonitoringService.chartDataHistory);

// Configuration form
const configForm = reactive({
    updateInterval: 5,
    queueSizeWarningThreshold: 1000,
    errorRateWarningThreshold: 5,
});

// Computed properties
const statusClass = computed(() => {
    switch (status.value) {
        case "active":
            return "status-active";
        case "paused":
            return "status-paused";
        case "error":
            return "status-error";
        default:
            return "status-idle";
    }
});

const statusText = computed(() => {
    switch (status.value) {
        case "active":
            return "运行中";
        case "paused":
            return "已暂停";
        case "error":
            return "错误";
        default:
            return "空闲";
    }
});

const mainMetrics = computed((): MetricCardConfig[] => {
    const m = metrics.value;

    return [
        {
            title: "队列大小",
            value: m.currentSize,
            severity: m.currentSize >= 1000 ? "warning" : "info",
            description: "当前待处理的操作数量",
        },
        {
            title: "处理速率",
            value: m.processingRate.toFixed(1),
            unit: "操作/分",
            severity: m.processingRate > 0 ? "success" : "info",
            description: "每分钟处理的操作数量",
        },
        {
            title: "错误率",
            value: m.errorRate.toFixed(1),
            unit: "%",
            severity: m.errorRate >= 5 ? "error" : m.errorRate >= 2 ? "warning" : "success",
            description: "处理失败的操作百分比",
        },
        {
            title: "预估完成时间",
            value: QueueMonitoringUtils.formatDuration(m.estimatedTimeToComplete),
            severity: m.estimatedTimeToComplete > 60 ? "warning" : "info",
            description: "完成所有操作的预估时间",
        },
        {
            title: "内存使用",
            value: m.memoryUsage.toFixed(1),
            unit: "MB",
            severity: m.memoryUsage >= 100 ? "warning" : "info",
            description: "队列占用的内存大小",
        },
        {
            title: "最旧操作",
            value: m.oldestOperation ? formatAge(m.oldestOperation) : "无",
            severity:
                m.oldestOperation && Date.now() - m.oldestOperation.getTime() > 300000
                    ? "warning"
                    : "info",
            description: "队列中最旧操作的时间",
        },
    ];
});

// Methods
function formatTime(date: Date): string {
    return date.toLocaleTimeString("zh-CN", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
    });
}

const exportMetrics = (): void => {
    try {
        const data = queueMonitoringService.exportMetrics();
        const blob = new Blob([data], { type: "application/json" });
        const url = URL.createObjectURL(blob);

        const a = document.createElement("a");
        a.href = url;
        a.download = `queue-metrics-${new Date().toISOString().slice(0, 19)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        URL.revokeObjectURL(url);
        logger.info("Queue metrics exported successfully");
    } catch (error) {
        logger.error("Error exporting queue metrics:", error);
    }
};

const updateConfiguration = (): void => {
    queueMonitoringService.updateConfig({
        updateInterval: configForm.updateInterval * 1000, // Convert to milliseconds
        queueSizeWarningThreshold: configForm.queueSizeWarningThreshold,
        errorRateWarningThreshold: configForm.errorRateWarningThreshold,
    });
};

// Utility functions
const formatAge = (date: Date): string => {
    const now = Date.now();
    const diff = now - date.getTime();
    const minutes = Math.floor(diff / 60000);

    if (minutes < 1) return "刚刚";
    if (minutes < 60) return `${minutes}分钟前`;

    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}小时前`;

    const days = Math.floor(hours / 24);
    return `${days}天前`;
};

const getEventTypeLabel = (type: string): string => {
    const labels: Record<string, string> = {
        scan: "扫描",
        rescan: "重扫",
        current: "删除",
        unknown: "未知",
    };
    return labels[type] || type;
};

const getStatusLabel = (status: string): string => {
    const labels: Record<string, string> = {
        pending: "待处理",
        processing: "处理中",
        completed: "本会话已完成",
        failed: "失败",
    };
    return labels[status] || status;
};

const getStatusSeverity = (status: string, count: number): MetricCardConfig["severity"] => {
    if (count === 0) return "info";

    switch (status) {
        case "failed":
            return "error";
        case "processing":
            return "warning";
        case "completed":
            return "success";
        default:
            return "info";
    }
};

// Lifecycle
onMounted(() => {
    // Start monitoring by default
    if (!isMonitoring.value) {
        queueMonitoringService.startMonitoring();
    }
});

onUnmounted(() => {
    // Stop monitoring when component is unmounted
    queueMonitoringService.stopMonitoring();
});
</script>

<style scoped lang="less">
.queue-dashboard {
    padding: 24px;
    background: var(--color-bg);
    min-height: 500px;

    &.dashboard-error {
        border-left: 4px solid var(--color-danger);
        background: var(--color-error-bg, rgba(255, 77, 79, 0.02));
    }
}

.dashboard-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 24px;
    padding-bottom: 16px;
    border-bottom: 1px solid var(--color-border);
}

.header-title {
    display: flex;
    align-items: center;
    gap: 16px;

    h2 {
        margin: 0;
        color: var(--color-text);
        font-size: 24px;
        font-weight: 600;
    }
}

.status-indicator {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 12px;
    border-radius: 16px;
    font-size: 14px;
    font-weight: 500;

    .status-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
    }

    &.status-idle {
        background: rgba(0, 0, 0, 0.04);
        color: var(--color-text-secondary);

        .status-dot {
            background: var(--color-disabled);
        }
    }

    &.status-active {
        background: var(--color-success-bg, rgba(82, 196, 26, 0.1));
        color: var(--color-success);

        .status-dot {
            background: var(--color-success);
        }
    }

    &.status-paused {
        background: var(--color-warning-bg, rgba(250, 173, 20, 0.1));
        color: var(--color-warning);

        .status-dot {
            background: var(--color-warning);
        }
    }

    &.status-error {
        background: var(--color-danger-bg, rgba(255, 77, 79, 0.1));
        color: var(--color-danger);

        .status-dot {
            background: var(--color-danger);
        }
    }
}

.header-info {
    display: flex;
    gap: 16px;
    align-items: center;
}

.last-update {
    font-size: 12px;
    color: var(--color-text-secondary);
    opacity: 0.8;
}

.export-button {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    border: 1px solid var(--color-border);
    border-radius: 4px;
    background: var(--color-bg);
    color: var(--color-text-secondary);
    font-size: 12px;
    cursor: pointer;
    transition: all 0.2s ease;

    &:hover {
        background: var(--color-fill-secondary);
        border-color: var(--color-primary);
        color: var(--color-text);
    }
}

.metrics-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 16px;
    margin-bottom: 32px;
}

.secondary-metrics {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 32px;
    margin-bottom: 32px;
}

.metrics-section {
    h3 {
        margin: 0 0 16px 0;
        color: var(--color-text);
        font-size: 18px;
        font-weight: 500;
    }
}

.event-types-grid,
.status-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
    gap: 12px;
}

.chart-section {
    margin-bottom: 24px;

    h3 {
        margin: 0 0 16px 0;
        color: var(--color-text);
        font-size: 18px;
        font-weight: 500;
    }
}

.chart-container {
    background: var(--color-bg);
    border: 1px solid var(--color-border);
    border-radius: 8px;
    padding: 0;
    min-height: 450px;
    overflow: hidden;
}

.config-panel {
    background: var(--color-bg);
    border: 1px solid var(--color-border);
    border-radius: 8px;
    padding: 20px;
    margin-bottom: 16px;

    h3 {
        margin: 0 0 16px 0;
        color: var(--color-text);
        font-size: 16px;
        font-weight: 500;
    }
}

.config-form {
    display: grid;
    gap: 12px;
}

.config-row {
    display: flex;
    align-items: center;
    justify-content: space-between;

    label {
        color: var(--color-text);
        font-size: 14px;
    }

    input {
        width: 100px;
        padding: 4px 8px;
        border: 1px solid var(--color-border);
        border-radius: 4px;
        background: var(--color-bg);
        color: var(--color-text);
    }
}

.quick-settings {
    text-align: center;
}

.settings-toggle {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 16px;
    border: 1px solid var(--color-border);
    border-radius: 6px;
    background: var(--color-bg);
    color: var(--color-text-secondary);
    cursor: pointer;
    font-size: 13px;
    transition: all 0.2s ease;

    &:hover {
        color: var(--color-text);
        border-color: var(--color-primary);
    }
}

// Responsive design
@media (max-width: 1024px) {
    .metrics-grid {
        grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    }

    .secondary-metrics {
        grid-template-columns: 1fr;
        gap: 24px;
    }
}

@media (max-width: 768px) {
    .queue-dashboard {
        padding: 16px;
    }

    .dashboard-header {
        flex-direction: column;
        align-items: flex-start;
        gap: 16px;
    }

    .header-info {
        width: 100%;
        justify-content: flex-end;
    }

    .metrics-grid {
        grid-template-columns: 1fr;
    }

    .event-types-grid,
    .status-grid {
        grid-template-columns: repeat(2, 1fr);
    }
}
</style>

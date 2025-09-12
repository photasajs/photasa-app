<!-- Base Metrics Card Component for Queue Health Dashboard -->
<template>
    <div class="metrics-card" :class="[severityClass, { 'with-trend': trend }]">
        <div class="card-header">
            <h3 class="card-title">{{ config.title }}</h3>
            <div v-if="trend" class="trend-indicator" :class="trendClass">
                <PhTrendUp v-if="trend === 'up'" class="trend-icon" />
                <PhTrendDown v-if="trend === 'down'" class="trend-icon" />
                <PhMinus v-if="trend === 'stable'" class="trend-icon" />
            </div>
        </div>

        <div class="card-content">
            <div class="metric-value">
                <span class="value">{{ formattedValue }}</span>
                <span v-if="config.unit" class="unit">{{ config.unit }}</span>
            </div>

            <div v-if="config.description" class="metric-description">
                {{ config.description }}
            </div>
        </div>

        <div v-if="showLastUpdate" class="card-footer">
            <span class="last-update"> 更新时间: {{ formatTime(lastUpdated) }} </span>
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed, type PropType } from "vue";
import type { MetricCardConfig } from "@common/queue-monitoring-types";

// Import Phosphor Icons for consistency
import { PhTrendUp, PhTrendDown, PhMinus } from "@phosphor-icons/vue";

const props = defineProps({
    config: {
        type: Object as PropType<MetricCardConfig>,
        required: true,
    },
    trend: {
        type: String as PropType<"up" | "down" | "stable">,
        default: undefined,
    },
    lastUpdated: {
        type: Date,
        default: () => new Date(),
    },
    showLastUpdate: {
        type: Boolean,
        default: false,
    },
});

const formattedValue = computed(() => {
    const value = props.config.value;

    if (typeof value === "number") {
        // Format numbers with appropriate precision
        if (value >= 1000000) {
            return `${(value / 1000000).toFixed(1)}M`;
        } else if (value >= 1000) {
            return `${(value / 1000).toFixed(1)}K`;
        } else if (value % 1 !== 0) {
            return value.toFixed(1);
        }
    }

    return String(value);
});

const severityClass = computed(() => {
    switch (props.config.severity) {
        case "warning":
            return "severity-warning";
        case "error":
            return "severity-error";
        case "success":
            return "severity-success";
        default:
            return "severity-info";
    }
});

const trendClass = computed(() => {
    switch (props.trend) {
        case "up":
            return "trend-up";
        case "down":
            return "trend-down";
        case "stable":
            return "trend-stable";
        default:
            return "";
    }
});

const formatTime = (date: Date): string => {
    return date.toLocaleTimeString("zh-CN", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
    });
};
</script>

<style scoped lang="less">
.metrics-card {
    background: var(--color-bg);
    border: 1px solid var(--color-border);
    border-radius: 8px;
    padding: 16px;
    transition: all 0.2s ease;
    position: relative;

    &:hover {
        border-color: var(--color-border-hover);
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    }

    // Severity styling
    &.severity-info {
        border-left: 4px solid var(--color-primary);
    }

    &.severity-success {
        border-left: 4px solid var(--color-success);

        .metric-value .value {
            color: var(--color-success);
        }
    }

    &.severity-warning {
        border-left: 4px solid var(--color-warning);
        background: var(--color-warning-bg, rgba(250, 173, 20, 0.04));

        .metric-value .value {
            color: var(--color-warning);
        }
    }

    &.severity-error {
        border-left: 4px solid var(--color-danger);
        background: var(--color-error-bg, rgba(255, 77, 79, 0.04));

        .metric-value .value {
            color: var(--color-danger);
        }
    }
}

.card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
}

.card-title {
    margin: 0;
    font-size: 14px;
    font-weight: 500;
    color: var(--color-text-secondary);
}

.trend-indicator {
    display: flex;
    align-items: center;

    .trend-icon {
        width: 16px;
        height: 16px;
    }

    &.trend-up {
        color: var(--color-success);
    }

    &.trend-down {
        color: var(--color-danger);
    }

    &.trend-stable {
        color: var(--color-text-secondary);
    }
}

.card-content {
    margin-bottom: 8px;
}

.metric-value {
    display: flex;
    align-items: baseline;
    gap: 4px;

    .value {
        font-size: 24px;
        font-weight: 600;
        color: var(--color-text);
        line-height: 1.2;
    }

    .unit {
        font-size: 14px;
        color: var(--color-text-secondary);
        font-weight: normal;
    }
}

.metric-description {
    font-size: 12px;
    color: var(--color-text-secondary);
    margin-top: 4px;
    line-height: 1.4;
}

.card-footer {
    border-top: 1px solid var(--color-border);
    padding-top: 8px;
    margin-top: 8px;
}

.last-update {
    font-size: 11px;
    color: var(--color-text-tertiary);
}

// Responsive adjustments
@media (max-width: 768px) {
    .metrics-card {
        padding: 12px;
    }

    .metric-value .value {
        font-size: 20px;
    }

    .card-title {
        font-size: 13px;
    }
}

// Dark theme support
@media (prefers-color-scheme: dark) {
    .metrics-card {
        &:hover {
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
        }

        &.severity-warning {
            background: rgba(250, 173, 20, 0.08);
        }

        &.severity-error {
            background: rgba(255, 77, 79, 0.08);
        }
    }
}
</style>

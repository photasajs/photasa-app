<!-- Queue Status Chart Component for Health Dashboard -->
<template>
    <div class="queue-chart" :class="{ 'chart-loading': isLoading }">
        <div class="chart-header">
            <h3 class="chart-title">队列状态趋势</h3>
            <div class="chart-controls">
                <BaseSelect
                    v-model:modelValue="timeRange"
                    :options="timeRangeOptions"
                    style="width: 120px"
                    @update:modelValue="handleTimeRangeChange"
                />
            </div>
        </div>

        <div class="chart-content" ref="chartContainer">
            <canvas
                ref="chartCanvas"
                :width="chartDimensions.width"
                :height="chartDimensions.height"
            />

            <div v-if="isLoading" class="chart-loading-overlay">
                <BaseSpinner />
                <span>加载图表数据...</span>
            </div>

            <div v-if="!chartData.length && !isLoading" class="chart-empty">
                <div class="empty-icon">
                    <PhChartBar :size="48" />
                </div>
                <div class="empty-text">暂无图表数据</div>
                <div class="empty-subtitle">队列监控开始后将显示趋势图表</div>
            </div>
        </div>

        <div class="chart-legend">
            <div class="legend-item">
                <div class="legend-color queue-size-color"></div>
                <span>队列大小</span>
            </div>
            <div class="legend-item">
                <div class="legend-color processing-rate-color"></div>
                <span>处理速率</span>
            </div>
            <div class="legend-item">
                <div class="legend-color error-rate-color"></div>
                <span>错误率 (%)</span>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick, type PropType } from "vue";
import { useI18n } from "vue-i18n";
import type { ChartDataPoint } from "@photasa/common";
import { BaseSpinner, BaseSelect } from "@renderer/components/ui";
import { PhChartBar } from "@phosphor-icons/vue";

interface ChartDimensions {
    width: number;
    height: number;
    padding: {
        top: number;
        right: number;
        bottom: number;
        left: number;
    };
}

const { t } = useI18n();

const props = defineProps({
    chartData: {
        type: Array as PropType<ChartDataPoint[]>,
        default: () => [],
    },
    isLoading: {
        type: Boolean,
        default: false,
    },
});

const timeRange = ref<"1h" | "6h" | "24h">("1h");
const chartContainer = ref<HTMLElement>();
const chartCanvas = ref<HTMLCanvasElement>();

// 时间范围选项
const timeRangeOptions = computed(() => [
    { value: "1h", label: t("queue.timeRange.1h") },
    { value: "6h", label: t("queue.timeRange.6h") },
    { value: "24h", label: t("queue.timeRange.24h") },
]);

const chartDimensions = ref<ChartDimensions>({
    width: 600,
    height: 300,
    padding: {
        top: 20,
        right: 20,
        bottom: 50,
        left: 60,
    },
});

const filteredChartData = computed(() => {
    if (!props.chartData.length) return [];

    const now = new Date();
    const timeRangeMs = {
        "1h": 60 * 60 * 1000,
        "6h": 6 * 60 * 60 * 1000,
        "24h": 24 * 60 * 60 * 1000,
    }[timeRange.value];

    const cutoffTime = new Date(now.getTime() - timeRangeMs);

    return props.chartData.filter((point) => point.timestamp >= cutoffTime);
});

const chartScales = computed(() => {
    const data = filteredChartData.value;
    if (!data.length) return { x: { min: 0, max: 1 }, y: { min: 0, max: 100 } };

    const timestamps = data.map((d) => d.timestamp.getTime());
    const queueSizes = data.map((d) => d.queueSize);
    const processingRates = data.map((d) => d.processingRate);
    const errorRates = data.map((d) => d.errorRate);

    return {
        x: {
            min: Math.min(...timestamps),
            max: Math.max(...timestamps),
        },
        y: {
            min: 0,
            max:
                Math.max(
                    Math.max(...queueSizes, 10),
                    Math.max(...processingRates, 10),
                    Math.max(...errorRates, 10),
                    100,
                ) * 1.1,
        },
    };
});

function drawChart(): void {
    const canvas = chartCanvas.value;
    const data = filteredChartData.value;

    if (!canvas || !data.length) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { width, height, padding } = chartDimensions.value;
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    ctx.clearRect(0, 0, width, height);

    const scales = chartScales.value;

    function scaleX(timestamp: number): number {
        return (
            padding.left + ((timestamp - scales.x.min) / (scales.x.max - scales.x.min)) * chartWidth
        );
    }

    function scaleY(value: number): number {
        return padding.top + ((scales.y.max - value) / scales.y.max) * chartHeight;
    }

    drawGrid(ctx, chartWidth, chartHeight, padding);
    drawAxes(ctx, chartWidth, chartHeight, padding, scales);
    drawLines(ctx, data, scaleX, scaleY);
}

function drawGrid(
    ctx: CanvasRenderingContext2D,
    chartWidth: number,
    chartHeight: number,
    padding: ChartDimensions["padding"],
): void {
    ctx.strokeStyle =
        getComputedStyle(document.documentElement).getPropertyValue("--color-border").trim() ||
        "#d9d9d9";
    ctx.lineWidth = 0.5;
    ctx.globalAlpha = 0.3;

    const gridLinesX = 6;
    const gridLinesY = 5;

    for (let i = 0; i <= gridLinesX; i++) {
        const x = padding.left + (i / gridLinesX) * chartWidth;
        ctx.beginPath();
        ctx.moveTo(x, padding.top);
        ctx.lineTo(x, padding.top + chartHeight);
        ctx.stroke();
    }

    for (let i = 0; i <= gridLinesY; i++) {
        const y = padding.top + (i / gridLinesY) * chartHeight;
        ctx.beginPath();
        ctx.moveTo(padding.left, y);
        ctx.lineTo(padding.left + chartWidth, y);
        ctx.stroke();
    }

    ctx.globalAlpha = 1.0;
}

function drawAxes(
    ctx: CanvasRenderingContext2D,
    chartWidth: number,
    chartHeight: number,
    padding: ChartDimensions["padding"],
    scales: { x: { min: number; max: number }; y: { min: number; max: number } },
): void {
    ctx.fillStyle =
        getComputedStyle(document.documentElement)
            .getPropertyValue("--color-text-secondary")
            .trim() || "#666666";
    ctx.font = "11px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    ctx.textAlign = "center";

    const timeLabels = getTimeLabels(scales.x.min, scales.x.max, 6);
    timeLabels.forEach((label, i) => {
        const x = padding.left + (i / (timeLabels.length - 1)) * chartWidth;
        ctx.fillText(label, x, padding.top + chartHeight + 20);
    });

    ctx.textAlign = "right";
    ctx.textBaseline = "middle";

    const valueLabels = getValueLabels(0, scales.y.max, 5);
    valueLabels.forEach((label, i) => {
        const y = padding.top + (i / (valueLabels.length - 1)) * chartHeight;
        ctx.fillText(label.toString(), padding.left - 10, y);
    });
}

function drawLines(
    ctx: CanvasRenderingContext2D,
    data: ChartDataPoint[],
    scaleX: (timestamp: number) => number,
    scaleY: (value: number) => number,
): void {
    // 使用CSS变量获取主题颜色
    const getCSSVariable = (variable: string, fallback: string): string => {
        return (
            getComputedStyle(document.documentElement).getPropertyValue(variable).trim() || fallback
        );
    };

    const colors = {
        primary: getCSSVariable("--color-info", "#1890ff"),
        success: getCSSVariable("--color-success", "#52c41a"),
        warning: getCSSVariable("--color-warning", "#faad14"),
    };

    const lines = [
        {
            data: data.map((d) => ({ x: d.timestamp.getTime(), y: d.queueSize })),
            color: colors.primary,
            label: "队列大小",
        },
        {
            data: data.map((d) => ({ x: d.timestamp.getTime(), y: d.processingRate })),
            color: colors.success,
            label: "处理速率",
        },
        {
            data: data.map((d) => ({ x: d.timestamp.getTime(), y: d.errorRate })),
            color: colors.warning,
            label: "错误率",
        },
    ];

    lines.forEach((line) => {
        if (line.data.length < 2) return;

        ctx.strokeStyle = line.color;
        ctx.lineWidth = 2;
        ctx.beginPath();

        line.data.forEach((point, i) => {
            const x = scaleX(point.x);
            const y = scaleY(point.y);

            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        });

        ctx.stroke();

        ctx.fillStyle = line.color;
        line.data.forEach((point) => {
            const x = scaleX(point.x);
            const y = scaleY(point.y);

            ctx.beginPath();
            ctx.arc(x, y, 3, 0, 2 * Math.PI);
            ctx.fill();
        });
    });
}

function getTimeLabels(minTime: number, maxTime: number, count: number): string[] {
    const labels: string[] = [];
    const interval = (maxTime - minTime) / (count - 1);

    for (let i = 0; i < count; i++) {
        const time = new Date(minTime + i * interval);
        labels.push(
            time.toLocaleTimeString("zh-CN", {
                hour: "2-digit",
                minute: "2-digit",
            }),
        );
    }

    return labels;
}

function getValueLabels(min: number, max: number, count: number): number[] {
    const labels: number[] = [];
    const interval = (max - min) / (count - 1);

    for (let i = 0; i < count; i++) {
        labels.push(Math.round(min + i * interval));
    }

    return labels.reverse();
}

function handleTimeRangeChange(): void {
    nextTick(() => {
        drawChart();
    });
}

function updateChartSize(): void {
    if (!chartContainer.value) return;

    const containerRect = chartContainer.value.getBoundingClientRect();
    chartDimensions.value.width = Math.max(containerRect.width - 40, 400);
    chartDimensions.value.height = Math.min(Math.max(containerRect.height - 100, 250), 400);

    nextTick(() => {
        drawChart();
    });
}

let resizeObserver: ResizeObserver | null = null;

onMounted(() => {
    updateChartSize();

    if (chartContainer.value && window.ResizeObserver) {
        resizeObserver = new ResizeObserver(() => {
            updateChartSize();
        });
        resizeObserver.observe(chartContainer.value);
    }
});

onUnmounted(() => {
    if (resizeObserver && chartContainer.value) {
        resizeObserver.unobserve(chartContainer.value);
        resizeObserver = null;
    }
});

watch(
    () => props.chartData,
    () => {
        nextTick(() => {
            drawChart();
        });
    },
    { deep: true },
);
</script>

<style scoped lang="less">
.queue-chart {
    background: transparent;
    border: none;
    border-radius: 8px;
    padding: 20px;
    height: 450px;
    display: flex;
    flex-direction: column;

    &.chart-loading {
        .chart-content {
            opacity: 0.6;
        }
    }
}

.chart-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
}

.chart-title {
    margin: 0;
    font-size: 16px;
    font-weight: 500;
    color: var(--color-text);
}

.chart-controls {
    display: flex;
    gap: 8px;
    align-items: center;
}

.chart-content {
    flex: 1;
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 250px;
}

.chart-loading-overlay {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    z-index: 10;

    span {
        font-size: 14px;
        color: var(--color-text-secondary);
    }
}

.chart-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
    color: var(--color-text-secondary);
    padding: 40px 20px;
    height: 100%;
    min-height: 300px;

    .empty-icon {
        opacity: 0.4;
        filter: grayscale(30%);
        margin-bottom: 8px;
        color: var(--color-text-secondary);
    }

    .empty-text {
        font-size: 16px;
        font-weight: 500;
        color: var(--color-text);
        opacity: 0.8;
        margin-bottom: 4px;
    }

    .empty-subtitle {
        font-size: 13px;
        opacity: 0.6;
        text-align: center;
        line-height: 1.5;
        max-width: 200px;
        word-wrap: break-word;
    }
}

.chart-legend {
    display: flex;
    justify-content: center;
    gap: 32px;
    margin-top: 16px;
    padding-top: 16px;
    border-top: 1px solid var(--color-border);
    opacity: 0.9;
}

.legend-item {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    color: var(--color-text-secondary);
    font-weight: 500;
    transition: opacity 0.2s ease;

    &:hover {
        opacity: 1;
        color: var(--color-text);
    }
}

.legend-color {
    width: 16px;
    height: 4px;
    border-radius: 2px;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);

    &.queue-size-color {
        background: var(--color-info);
    }

    &.processing-rate-color {
        background: var(--color-success);
    }

    &.error-rate-color {
        background: var(--color-warning);
    }
}

// 响应式调整
@media (max-width: 768px) {
    .queue-chart {
        height: 320px;
        padding: 12px;
    }

    .chart-title {
        font-size: 14px;
    }

    .chart-legend {
        gap: 16px;
        flex-wrap: wrap;
    }

    .legend-item {
        font-size: 11px;
    }
}

// 暗色主题支持
@media (prefers-color-scheme: dark) {
    .queue-chart {
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);

        &:hover {
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.35);
        }

        canvas {
            filter: contrast(1.1) brightness(1.05);
        }

        .legend-color {
            box-shadow: 0 1px 2px rgba(255, 255, 255, 0.1);

            &.queue-size-color {
                background: var(--color-info);
            }

            &.processing-rate-color {
                background: var(--color-success);
            }

            &.error-rate-color {
                background: var(--color-warning);
            }
        }
    }
}

// Canvas 高质量渲染
canvas {
    image-rendering: -webkit-optimize-contrast;
    image-rendering: optimize-contrast;
    image-rendering: crisp-edges;

    // 高DPI支持
    @media (-webkit-min-device-pixel-ratio: 2), (min-resolution: 192dpi) {
        image-rendering: auto;
        image-rendering: -webkit-optimize-contrast;
    }
}
</style>

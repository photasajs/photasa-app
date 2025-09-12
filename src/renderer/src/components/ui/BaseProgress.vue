<template>
    <div
        v-bind="$attrs"
        class="base-progress"
        :class="[
            `base-progress--${type}`,
            `base-progress--${status}`,
            `base-progress--${size}`,
            { 'base-progress--show-info': showInfo },
        ]"
    >
        <!-- 线性进度条 -->
        <div v-if="type === 'line'" class="base-progress-line">
            <div class="base-progress-outer">
                <div class="base-progress-inner">
                    <div
                        class="base-progress-bg"
                        :class="`base-progress-bg--${status}`"
                        :style="{
                            width: `${Math.min(100, Math.max(0, percent))}%`,
                            backgroundColor: strokeColor || getStatusColor(status),
                        }"
                    />
                </div>
            </div>
            <div v-if="showInfo" class="base-progress-text">
                <span>{{ formatPercent(percent) }}</span>
            </div>
        </div>

        <!-- 圆形进度条 -->
        <div v-else-if="type === 'circle'" class="base-progress-circle">
            <div
                class="base-progress-circle-outer"
                :style="{ width: `${width}px`, height: `${width}px` }"
            >
                <svg class="base-progress-circle-svg" viewBox="0 0 100 100">
                    <!-- 背景圆环 -->
                    <circle
                        class="base-progress-circle-bg"
                        cx="50"
                        cy="50"
                        :r="getRadius()"
                        :stroke-width="getStrokeWidth()"
                        fill="none"
                    />
                    <!-- 进度圆环 -->
                    <circle
                        class="base-progress-circle-path"
                        :class="`base-progress-circle-path--${status}`"
                        cx="50"
                        cy="50"
                        :r="getRadius()"
                        :stroke-width="getStrokeWidth()"
                        :stroke="strokeColor || getStatusColor(status)"
                        :stroke-dasharray="getStrokeDasharray()"
                        :stroke-dashoffset="getStrokeDashoffset()"
                        fill="none"
                        stroke-linecap="round"
                    />
                </svg>
                <div v-if="showInfo" class="base-progress-circle-text">
                    <span>{{ formatPercent(percent) }}</span>
                </div>
            </div>
        </div>

        <!-- 仪表盘进度条 -->
        <div v-else-if="type === 'dashboard'" class="base-progress-dashboard">
            <div
                class="base-progress-dashboard-outer"
                :style="{ width: `${width}px`, height: `${width}px` }"
            >
                <svg class="base-progress-dashboard-svg" viewBox="0 0 100 100">
                    <!-- 背景弧线 -->
                    <path
                        class="base-progress-dashboard-bg"
                        :d="getDashboardPath()"
                        :stroke-width="getStrokeWidth()"
                        fill="none"
                    />
                    <!-- 进度弧线 -->
                    <path
                        class="base-progress-dashboard-path"
                        :class="`base-progress-dashboard-path--${status}`"
                        :d="getDashboardPath()"
                        :stroke-width="getStrokeWidth()"
                        :stroke="strokeColor || getStatusColor(status)"
                        :stroke-dasharray="getDashboardStrokeDasharray()"
                        :stroke-dashoffset="getDashboardStrokeDashoffset()"
                        fill="none"
                        stroke-linecap="round"
                    />
                </svg>
                <div v-if="showInfo" class="base-progress-dashboard-text">
                    <span>{{ formatPercent(percent) }}</span>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
// No imports needed for this component

interface BaseProgressProps {
    /** 进度百分比 (0-100) */
    percent?: number;
    /** 进度条类型 */
    type?: "line" | "circle" | "dashboard";
    /** 进度条状态 */
    status?: "normal" | "success" | "exception" | "active";
    /** 进度条大小 */
    size?: "default" | "small";
    /** 是否显示进度文字 */
    showInfo?: boolean;
    /** 自定义进度条颜色 */
    strokeColor?: string;
    /** 圆形进度条宽度 */
    width?: number;
    /** 圆形进度条描边宽度 */
    strokeWidth?: number;
    /** 仪表盘进度条缺口角度 */
    gapDegree?: number;
    /** 仪表盘进度条缺口位置 */
    gapPosition?: "top" | "bottom" | "left" | "right";
}

const props = withDefaults(defineProps<BaseProgressProps>(), {
    percent: 0,
    type: "line",
    status: "normal",
    size: "default",
    showInfo: true,
    width: 120,
    strokeWidth: 6,
    gapDegree: 75,
    gapPosition: "bottom",
});

// 格式化百分比显示
const formatPercent = (percent: number): string => {
    return `${Math.round(percent)}%`;
};

// 获取状态对应的颜色
const getStatusColor = (status: string): string => {
    const colors = {
        normal: "var(--color-primary)",
        success: "var(--color-success)",
        exception: "var(--color-danger)",
        active: "var(--color-warning)",
    };
    return colors[status as keyof typeof colors] || colors.normal;
};

// 圆形进度条相关计算
const getRadius = (): number => {
    return 50 - props.strokeWidth / 2;
};

const getStrokeWidth = (): number => {
    return props.strokeWidth;
};

const getStrokeDasharray = (): string => {
    const radius = getRadius();
    const circumference = 2 * Math.PI * radius;
    return `${circumference} ${circumference}`;
};

const getStrokeDashoffset = (): string => {
    const radius = getRadius();
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (props.percent / 100) * circumference;
    return `${offset}`;
};

// 仪表盘进度条相关计算
const getDashboardPath = (): string => {
    const radius = getRadius();
    const startAngle = -Math.PI / 2; // 从顶部开始
    const endAngle = (3 * Math.PI) / 2; // 到顶部结束，留出缺口

    const startX = 50 + radius * Math.cos(startAngle);
    const startY = 50 + radius * Math.sin(startAngle);
    const endX = 50 + radius * Math.cos(endAngle);
    const endY = 50 + radius * Math.sin(endAngle);

    return `M ${startX} ${startY} A ${radius} ${radius} 0 1 1 ${endX} ${endY}`;
};

const getDashboardStrokeDasharray = (): string => {
    const radius = getRadius();
    const circumference = 2 * Math.PI * radius;
    const gapLength = (props.gapDegree / 360) * circumference;
    const progressLength = circumference - gapLength;
    return `${progressLength} ${gapLength}`;
};

const getDashboardStrokeDashoffset = (): string => {
    const radius = getRadius();
    const circumference = 2 * Math.PI * radius;
    const gapLength = (props.gapDegree / 360) * circumference;
    const progressLength = circumference - gapLength;
    const offset = progressLength - (props.percent / 100) * progressLength;
    return `${offset}`;
};
</script>

<style scoped>
.base-progress {
    display: inline-block;
    vertical-align: middle;
}

/* 线性进度条样式 */
.base-progress-line {
    display: flex;
    align-items: center;
    width: 100%;
}

.base-progress-outer {
    flex: 1;
    margin-right: 8px;
    background: var(--color-bg-secondary);
    border-radius: 100px;
    overflow: hidden;
}

.base-progress-inner {
    position: relative;
    height: 8px;
    border-radius: 100px;
    overflow: hidden;
}

.base-progress-bg {
    height: 100%;
    border-radius: 100px;
    transition: width 0.3s ease;
}

.base-progress-bg--success {
    background-color: var(--color-success) !important;
}

.base-progress-bg--exception {
    background-color: var(--color-danger) !important;
}

.base-progress-bg--active {
    background-color: var(--color-warning) !important;
}

.base-progress-text {
    min-width: 35px;
    text-align: right;
    font-size: 14px;
    color: var(--color-text-secondary);
}

/* 圆形进度条样式 */
.base-progress-circle {
    position: relative;
    display: inline-block;
}

.base-progress-circle-outer {
    position: relative;
    display: inline-block;
}

.base-progress-circle-svg {
    width: 100%;
    height: 100%;
    transform: rotate(-90deg);
}

.base-progress-circle-bg {
    stroke: var(--color-bg-secondary);
}

.base-progress-circle-path {
    transition: stroke-dashoffset 0.3s ease;
}

.base-progress-circle-path--success {
    stroke: var(--color-success) !important;
}

.base-progress-circle-path--exception {
    stroke: var(--color-danger) !important;
}

.base-progress-circle-path--active {
    stroke: var(--color-warning) !important;
}

.base-progress-circle-text {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    font-size: 14px;
    color: var(--color-text);
    font-weight: 500;
}

/* 仪表盘进度条样式 */
.base-progress-dashboard {
    position: relative;
    display: inline-block;
}

.base-progress-dashboard-outer {
    position: relative;
    display: inline-block;
}

.base-progress-dashboard-svg {
    width: 100%;
    height: 100%;
}

.base-progress-dashboard-bg {
    stroke: var(--color-bg-secondary);
}

.base-progress-dashboard-path {
    transition: stroke-dashoffset 0.3s ease;
}

.base-progress-dashboard-path--success {
    stroke: var(--color-success) !important;
}

.base-progress-dashboard-path--exception {
    stroke: var(--color-danger) !important;
}

.base-progress-dashboard-path--active {
    stroke: var(--color-warning) !important;
}

.base-progress-dashboard-text {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    font-size: 14px;
    color: var(--color-text);
    font-weight: 500;
}

/* 尺寸变体 */
.base-progress--small .base-progress-inner {
    height: 6px;
}

.base-progress--small .base-progress-text {
    font-size: 12px;
}

.base-progress--small .base-progress-circle-text,
.base-progress--small .base-progress-dashboard-text {
    font-size: 12px;
}
</style>

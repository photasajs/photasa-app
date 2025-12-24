<template>
    <div
        v-bind="$attrs"
        class="base-statistic"
        :class="[`base-statistic--${size}`, { 'base-statistic--loading': loading }]"
    >
        <!-- 标题 -->
        <div v-if="title" class="base-statistic-title">
            {{ title }}
        </div>

        <!-- 数值内容 -->
        <div class="base-statistic-content">
            <!-- 前缀 -->
            <span v-if="prefix" class="base-statistic-prefix">
                <slot name="prefix">{{ prefix }}</slot>
            </span>

            <!-- 数值 -->
            <span class="base-statistic-value" :style="valueStyle">
                <slot name="value">
                    <span v-if="loading" class="base-statistic-loading">
                        <BaseSpinner size="sm" />
                    </span>
                    <span v-else>{{ formattedValue }}</span>
                </slot>
            </span>

            <!-- 后缀 -->
            <span v-if="suffix" class="base-statistic-suffix">
                <slot name="suffix">{{ suffix }}</slot>
            </span>
        </div>

        <!-- 描述 -->
        <div v-if="description" class="base-statistic-description">
            {{ description }}
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import BaseSpinner from "./BaseSpinner.vue";

interface BaseStatisticProps {
    /** 数值 */
    value?: number | string;
    /** 标题 */
    title?: string;
    /** 描述 */
    description?: string;
    /** 前缀 */
    prefix?: string;
    /** 后缀 */
    suffix?: string;
    /** 数值样式 */
    valueStyle?: Record<string, string>;
    /** 是否加载中 */
    loading?: boolean;
    /** 尺寸 */
    size?: "default" | "small" | "large";
    /** 精度（小数位数） */
    precision?: number;
    /** 千分位分隔符 */
    groupSeparator?: string;
    /** 小数分隔符 */
    decimalSeparator?: string;
    /** 格式化函数 */
    formatter?: (value: number | string) => string;
}

const props = withDefaults(defineProps<BaseStatisticProps>(), {
    value: 0,
    size: "default",
    precision: 0,
    groupSeparator: ",",
    decimalSeparator: ".",
    loading: false,
});

// 格式化数值
const formattedValue = computed(() => {
    if (props.loading) return "";

    if (props.formatter) {
        return props.formatter(props.value);
    }

    if (typeof props.value === "string") {
        return props.value;
    }

    if (typeof props.value === "number") {
        // 处理精度
        let formatted = props.value.toFixed(props.precision);

        // 添加千分位分隔符
        if (props.groupSeparator) {
            const parts = formatted.split(".");
            parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, props.groupSeparator);
            formatted = parts.join(props.decimalSeparator);
        }

        return formatted;
    }

    return String(props.value);
});
</script>

<style scoped>
.base-statistic {
    display: inline-block;
    text-align: left;
}

.base-statistic-title {
    color: var(--color-text-secondary);
    font-size: 14px;
    line-height: 1.5;
    margin-bottom: 4px;
}

.base-statistic-content {
    display: flex;
    align-items: baseline;
    gap: 4px;
    margin-bottom: 4px;
}

.base-statistic-value {
    color: var(--color-text);
    font-weight: 600;
    line-height: 1;
}

.base-statistic-prefix,
.base-statistic-suffix {
    color: var(--color-text-secondary);
    font-size: 0.9em;
}

.base-statistic-description {
    color: var(--color-text-secondary);
    font-size: 12px;
    line-height: 1.4;
}

.base-statistic-loading {
    display: inline-flex;
    align-items: center;
    gap: 4px;
}

/* 尺寸变体 */
.base-statistic--small .base-statistic-title {
    font-size: 12px;
}

.base-statistic--small .base-statistic-value {
    font-size: 18px;
}

.base-statistic--small .base-statistic-description {
    font-size: 11px;
}

.base-statistic--large .base-statistic-title {
    font-size: 16px;
}

.base-statistic--large .base-statistic-value {
    font-size: 32px;
}

.base-statistic--large .base-statistic-description {
    font-size: 14px;
}

.base-statistic--default .base-statistic-value {
    font-size: 24px;
}
</style>

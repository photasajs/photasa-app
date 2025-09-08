<template>
    <div
        v-bind="$attrs"
        class="base-row"
        :class="[`base-row--${align}`, `base-row--${justify}`, { 'base-row--gutter': gutter > 0 }]"
        :style="rowStyle"
    >
        <slot />
    </div>
</template>

<script setup lang="ts">
import { computed, provide } from "vue";

interface BaseRowProps {
    /** 栅格间隔 */
    gutter?: number | [number, number];
    /** 垂直对齐方式 */
    align?: "top" | "middle" | "bottom" | "stretch";
    /** 水平排列方式 */
    justify?: "start" | "end" | "center" | "space-around" | "space-between" | "space-evenly";
    /** 是否换行 */
    wrap?: boolean;
}

const props = withDefaults(defineProps<BaseRowProps>(), {
    gutter: 0,
    align: "top",
    justify: "start",
    wrap: true,
});

// 计算行样式
const rowStyle = computed(() => {
    const style: Record<string, string> = {};

    if (props.gutter > 0) {
        const gutterValue = Array.isArray(props.gutter) ? props.gutter[0] : props.gutter;
        style.marginLeft = `-${gutterValue / 2}px`;
        style.marginRight = `-${gutterValue / 2}px`;
    }

    if (!props.wrap) {
        style.flexWrap = "nowrap";
    }

    return style;
});

// 提供上下文给子组件
provide("row", {
    gutter: props.gutter,
});
</script>

<style scoped>
.base-row {
    display: flex;
    flex-wrap: wrap;
    width: 100%;
}

/* 垂直对齐 */
.base-row--top {
    align-items: flex-start;
}

.base-row--middle {
    align-items: center;
}

.base-row--bottom {
    align-items: flex-end;
}

.base-row--stretch {
    align-items: stretch;
}

/* 水平排列 */
.base-row--start {
    justify-content: flex-start;
}

.base-row--end {
    justify-content: flex-end;
}

.base-row--center {
    justify-content: center;
}

.base-row--space-around {
    justify-content: space-around;
}

.base-row--space-between {
    justify-content: space-between;
}

.base-row--space-evenly {
    justify-content: space-evenly;
}

/* 间隔样式 */
.base-row--gutter > * {
    padding-left: calc(var(--gutter) / 2);
    padding-right: calc(var(--gutter) / 2);
}
</style>

<template>
    <div
        v-bind="$attrs"
        class="base-accordion"
        :class="[
            `base-accordion--${size}`,
            { 'base-accordion--bordered': bordered },
            { 'base-accordion--ghost': ghost },
        ]"
    >
        <slot />
    </div>
</template>

<script setup lang="ts">
import { provide } from "vue";

interface BaseAccordionProps {
    /** 手风琴模式：同时只能展开一个面板 */
    accordion?: boolean;
    /** 默认展开的面板key */
    defaultActiveKey?: string | string[];
    /** 当前展开的面板key */
    activeKey?: string | string[];
    /** 是否显示边框 */
    bordered?: boolean;
    /** 是否幽灵模式 */
    ghost?: boolean;
    /** 尺寸 */
    size?: "default" | "small" | "large";
    /** 是否可折叠 */
    collapsible?: boolean;
    /** 展开/收起时的回调 */
    onChange?: (activeKey: string | string[]) => void;
}

const props = withDefaults(defineProps<BaseAccordionProps>(), {
    accordion: false,
    bordered: true,
    ghost: false,
    size: "default",
    collapsible: true,
});

const emit = defineEmits<{
    change: [activeKey: string | string[]];
}>();

// 提供上下文给子组件
provide("accordion", {
    accordion: props.accordion,
    activeKey: props.activeKey,
    defaultActiveKey: props.defaultActiveKey,
    collapsible: props.collapsible,
    size: props.size,
    onChange: (key: string | string[]) => {
        emit("change", key);
        props.onChange?.(key);
    },
});
</script>

<style scoped>
.base-accordion {
    background: var(--color-card-bg);
    border-radius: var(--radius-md);
    overflow: hidden;
}

.base-accordion--bordered {
    border: 1px solid var(--color-border);
}

.base-accordion--ghost {
    background: transparent;
    border: none;
}

.base-accordion--small {
    font-size: 12px;
}

.base-accordion--large {
    font-size: 16px;
}
</style>

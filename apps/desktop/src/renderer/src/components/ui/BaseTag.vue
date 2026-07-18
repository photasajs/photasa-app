<template>
    <span
        v-bind="$attrs"
        class="base-tag"
        :class="[
            `base-tag--${type}`,
            `base-tag--${size}`,
            `base-tag--${color}`,
            { 'base-tag--closable': closable },
            { 'base-tag--checkable': checkable },
            { 'base-tag--checked': checked },
        ]"
        :style="tagStyle"
        @click="handleClick"
    >
        <span class="base-tag-content">
            <slot />
        </span>
        <span v-if="closable" class="base-tag-close" @click.stop="handleClose">
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path
                    d="M7.5 2.5L2.5 7.5M2.5 2.5L7.5 7.5"
                    stroke="currentColor"
                    stroke-width="1"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                />
            </svg>
        </span>
    </span>
</template>

<script setup lang="ts">
import { computed } from "vue";

interface BaseTagProps {
    /** 标签类型 */
    type?: "default" | "success" | "processing" | "error" | "warning";
    /** 标签颜色 */
    color?: string;
    /** 标签大小 */
    size?: "default" | "small" | "large";
    /** 是否可关闭 */
    closable?: boolean;
    /** 是否可选择 */
    checkable?: boolean;
    /** 是否选中（checkable模式下） */
    checked?: boolean;
    /** 自定义样式 */
    style?: Record<string, string>;
}

const props = withDefaults(defineProps<BaseTagProps>(), {
    type: "default",
    size: "default",
    closable: false,
    checkable: false,
    checked: false,
});

const emit = defineEmits<{
    close: [];
    click: [];
    change: [checked: boolean];
}>();

// 计算标签样式
const tagStyle = computed(() => {
    const style: Record<string, string> = { ...props.style };

    // 自定义颜色
    if (
        props.color &&
        !["default", "success", "processing", "error", "warning"].includes(props.color)
    ) {
        style.backgroundColor = props.color;
        style.borderColor = props.color;
        style.color = "#fff";
    }

    return style;
});

// 处理点击事件
const handleClick = () => {
    if (props.checkable) {
        emit("change", !props.checked);
    } else {
        emit("click");
    }
};

// 处理关闭事件
const handleClose = () => {
    emit("close");
};
</script>

<style scoped>
.base-tag {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 2px 8px;
    font-size: 12px;
    line-height: 1.5;
    border-radius: 4px;
    border: 1px solid transparent;
    background: var(--color-bg-secondary);
    color: var(--color-text);
    transition: all 0.3s ease;
    user-select: none;
    cursor: default;
}

.base-tag--checkable {
    cursor: pointer;
}

.base-tag--checkable:hover {
    opacity: 0.8;
}

.base-tag--checked {
    background: var(--color-primary);
    color: var(--color-white);
    border-color: var(--color-primary);
}

/* 类型样式 */
.base-tag--default {
    background: var(--color-bg-secondary);
    color: var(--color-text);
    border-color: var(--color-border);
}

.base-tag--success {
    background: var(--color-success);
    color: var(--color-white);
    border-color: var(--color-success);
}

.base-tag--processing {
    background: var(--color-primary);
    color: var(--color-white);
    border-color: var(--color-primary);
}

.base-tag--error {
    background: var(--color-danger);
    color: var(--color-white);
    border-color: var(--color-danger);
}

.base-tag--warning {
    background: var(--color-warning);
    color: var(--color-white);
    border-color: var(--color-warning);
}

/* 尺寸样式 */
.base-tag--small {
    padding: 1px 6px;
    font-size: 11px;
}

.base-tag--large {
    padding: 4px 12px;
    font-size: 14px;
}

/* 内容区域 */
.base-tag-content {
    flex: 1;
    min-width: 0;
}

/* 关闭按钮 */
.base-tag-close {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 14px;
    height: 14px;
    margin-left: 4px;
    cursor: pointer;
    border-radius: 2px;
    transition: all 0.3s ease;
}

.base-tag-close:hover {
    background: rgba(255, 255, 255, 0.2);
}

.base-tag--default .base-tag-close:hover {
    background: var(--color-bg-tertiary);
}

/* 可关闭标签的样式调整 */
.base-tag--closable {
    padding-right: 4px;
}
</style>

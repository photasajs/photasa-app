<template>
    <li class="breadcrumb-item">
        <span class="breadcrumb-text">
            <slot>{{ text || "NO_TEXT" }}</slot>
        </span>
    </li>
</template>

<script setup lang="ts">
interface Props {
    text?: string;
    isLast?: boolean;
}

defineProps<Props>();
</script>

<style scoped lang="less">
.breadcrumb-item {
    display: flex;
    align-items: center;

    &:not(:last-child)::after {
        content: "/";
        margin: 0 8px;
        color: var(--color-tree-text, var(--color-text-tertiary, #999));
        font-size: 12px;
        opacity: 0.6;
    }
}

.breadcrumb-text {
    color: var(--color-tree-text, var(--color-text, #000));
    font-size: 14px;
    font-weight: 500;
}
</style>

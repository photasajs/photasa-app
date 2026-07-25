<template>
    <li class="breadcrumb-item" :class="{ 'breadcrumb-item--last': isLast }">
        <span class="breadcrumb-text" :title="displayTitle">
            <slot>{{ text }}</slot>
        </span>
    </li>
</template>

<script setup lang="ts">
import { computed } from "vue";

interface Props {
    text?: string;
    isLast?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
    text: "",
    isLast: false,
});

const displayTitle = computed(() => props.text.trim() || undefined);
</script>

<style scoped lang="less">
.breadcrumb-item {
    display: flex;
    align-items: center;
    min-width: 0;
    flex: 0 1 auto;
    max-width: 30%;

    &:not(:last-child)::after {
        content: "/";
        flex-shrink: 0;
        margin: 0 8px;
        color: var(--color-tree-text, var(--color-text-tertiary, #999));
        font-size: 12px;
        opacity: 0.6;
    }

    &--last {
        flex: 1 1 auto;
        max-width: none;
    }
}

.breadcrumb-text {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--color-tree-text, var(--color-text, #000));
    font-size: 14px;
    font-weight: 500;
}
</style>

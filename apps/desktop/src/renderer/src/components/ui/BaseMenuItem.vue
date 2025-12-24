<script setup lang="ts">
import { computed } from "vue";

interface BaseMenuItemProps {
    disabled?: boolean;
    danger?: boolean;
    icon?: any;
}

const props = withDefaults(defineProps<BaseMenuItemProps>(), {
    disabled: false,
    danger: false,
});

const emit = defineEmits<{
    click: [event: MouseEvent];
}>();

const itemClasses = computed(() => {
    return [
        "base-menu-item",
        {
            "base-menu-item--disabled": props.disabled,
            "base-menu-item--danger": props.danger,
        },
    ];
});

function handleClick(event: MouseEvent) {
    if (!props.disabled) {
        emit("click", event);
    }
}
</script>

<template>
    <div :class="itemClasses" @click="handleClick">
        <component v-if="icon" :is="icon" class="base-menu-item__icon" />
        <span class="base-menu-item__content">
            <slot />
        </span>
    </div>
</template>

<style scoped>
.base-menu-item {
    display: flex;
    align-items: center;
    padding: 8px 12px;
    cursor: pointer;
    transition:
        background-color 0.2s ease,
        color 0.2s ease;
    color: var(--color-text);
    font-size: 14px;
    line-height: 20px;
    white-space: nowrap;
    user-select: none;
}

.base-menu-item:hover:not(.base-menu-item--disabled) {
    background: var(--color-primary-alpha-10, var(--color-bg-hover, rgba(54, 130, 216, 0.1)));
    color: var(--color-primary, var(--color-text-hover, #3b82f6));
}

.base-menu-item:active:not(.base-menu-item--disabled) {
    background: var(--color-menu-item-active, var(--color-bg-active, rgba(255, 255, 255, 0.12)));
}

.base-menu-item--disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

.base-menu-item--danger {
    color: var(--color-danger, #ff4d4f);
}

.base-menu-item--danger:hover:not(.base-menu-item--disabled) {
    background: rgba(255, 77, 79, 0.1);
}

.base-menu-item__icon {
    width: 16px;
    height: 16px;
    margin-right: 8px;
    flex-shrink: 0;
}

.base-menu-item__content {
    flex: 1;
}
</style>

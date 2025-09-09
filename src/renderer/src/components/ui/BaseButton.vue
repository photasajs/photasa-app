<template>
    <button
        :class="[
            'inline-flex items-center justify-center font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
            sizeClasses,
            variantClasses,
            loading && 'cursor-not-allowed',
        ]"
        :disabled="disabled || loading"
        v-bind="$attrs"
        @click="$emit('click', $event)"
    >
        <div v-if="loading" :class="['animate-spin mr-2', iconSizeClasses]">
            <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
            >
                <path d="M21 12a9 9 0 11-6.219-8.56" />
            </svg>
        </div>
        <div v-else-if="$slots.icon" :class="['mr-2', iconSizeClasses]">
            <slot name="icon" />
        </div>
        <slot />
    </button>
</template>

<script setup lang="ts">
import { computed } from "vue";

interface Props {
    variant?: "primary" | "secondary" | "danger" | "ghost";
    type?: "primary" | "default" | "link" | "text";
    size?: "sm" | "md" | "lg";
    disabled?: boolean;
    loading?: boolean;
    danger?: boolean;
    ghost?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
    size: "md",
    disabled: false,
    loading: false,
    danger: false,
    ghost: false,
});

defineEmits<{
    click: [event: MouseEvent];
}>();

const sizeClasses = computed(() => {
    switch (props.size) {
        case "sm":
            return "px-3 py-1.5 text-sm rounded-md";
        case "lg":
            return "px-6 py-3 text-lg rounded-lg";
        default:
            return "px-4 py-2 text-base rounded-md";
    }
});

const iconSizeClasses = computed(() => {
    switch (props.size) {
        case "sm":
            return "w-4 h-4";
        case "lg":
            return "w-6 h-6";
        default:
            return "w-5 h-5";
    }
});

const variantClasses = computed(() => {
    // 支持danger属性优先级
    if (props.danger) {
        return "bg-[var(--color-danger)] text-white hover:opacity-90 focus:ring-[var(--color-danger)]";
    }

    // 支持ghost属性优先级
    if (props.ghost) {
        return "text-[var(--color-text)] border border-[var(--color-border)] hover:bg-[var(--color-card-hover)] focus:ring-[var(--color-primary)] bg-transparent";
    }

    // 根据type属性决定样式（兼容Ant Design）
    const buttonType = props.type || props.variant;

    switch (buttonType) {
        case "primary":
            return "bg-[var(--color-primary)] text-white hover:bg-[var(--color-btn-hover)] focus:ring-[var(--color-primary)]";
        case "secondary":
        case "default":
            return "bg-[var(--color-bg-secondary)] text-[var(--color-text)] border border-[var(--color-border)] hover:bg-[var(--color-card-hover)] focus:ring-[var(--color-primary)]";
        case "link":
            return "text-[var(--color-primary)] hover:text-[var(--color-primary-hover)] focus:ring-[var(--color-primary)] bg-transparent border-none underline-offset-4 hover:underline px-0";
        case "text":
            return "text-[var(--color-text)] hover:bg-[var(--color-card-hover)] focus:ring-[var(--color-primary)] bg-transparent border-none";
        case "danger":
            return "bg-[var(--color-danger)] text-white hover:opacity-90 focus:ring-[var(--color-danger)]";
        case "ghost":
            return "text-[var(--color-text)] border border-[var(--color-border)] hover:bg-[var(--color-card-hover)] focus:ring-[var(--color-primary)] bg-transparent";
        default:
            return "bg-[var(--color-bg-secondary)] text-[var(--color-text)] border border-[var(--color-border)] hover:bg-[var(--color-card-hover)] focus:ring-[var(--color-primary)]";
    }
});
</script>

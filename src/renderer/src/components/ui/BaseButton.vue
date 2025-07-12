<template>
    <button
        :class="[
            'inline-flex items-center justify-center font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
            sizeClasses,
            variantClasses,
        ]"
        :disabled="disabled"
        v-bind="$attrs"
        @click="$emit('click', $event)"
    >
        <slot />
    </button>
</template>

<script setup lang="ts">
import { computed } from "vue";

interface Props {
    variant?: "primary" | "secondary" | "danger" | "ghost";
    size?: "sm" | "md" | "lg";
    disabled?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
    variant: "primary",
    size: "md",
    disabled: false,
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

const variantClasses = computed(() => {
    switch (props.variant) {
        case "primary":
            return "bg-[var(--color-primary)] text-white hover:bg-[var(--color-btn-hover)] focus:ring-[var(--color-primary)]";
        case "secondary":
            return "bg-[var(--color-bg-secondary)] text-[var(--color-text)] border border-[var(--color-border)] hover:bg-[var(--color-card-hover)] focus:ring-[var(--color-primary)]";
        case "danger":
            return "bg-[var(--color-danger)] text-white hover:opacity-90 focus:ring-[var(--color-danger)]";
        case "ghost":
            return "text-[var(--color-text)] hover:bg-[var(--color-card-hover)] focus:ring-[var(--color-primary)]";
        default:
            return "bg-[var(--color-primary)] text-white hover:bg-[var(--color-btn-hover)] focus:ring-[var(--color-primary)]";
    }
});
</script>

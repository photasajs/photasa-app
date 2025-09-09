<template>
    <span
        v-if="text || dot || showZero || computedCount > 0 || $slots.default"
        :class="[
            'inline-flex items-center justify-center font-medium',
            dot ? dotClasses : badgeClasses,
            variantClasses,
            sizeClasses,
            className,
        ]"
    >
        <slot v-if="!dot">{{ computedText }}</slot>
    </span>
</template>

<script setup lang="ts">
import { computed } from "vue";

interface Props {
    count?: number;
    max?: number;
    text?: string;
    dot?: boolean;
    showZero?: boolean;
    variant?: "primary" | "secondary" | "success" | "warning" | "danger" | "info";
    size?: "sm" | "md" | "lg";
    className?: string;
}

const props = withDefaults(defineProps<Props>(), {
    max: 99,
    dot: false,
    showZero: false,
    variant: "primary",
    size: "md",
    className: "",
});

const computedCount = computed(() => {
    if (props.count === undefined) return 0;
    return props.count > props.max ? props.max : props.count;
});

const computedText = computed(() => {
    if (props.text) return props.text;
    if (props.count === undefined) return "";
    return props.count > props.max ? `${props.max}+` : String(props.count);
});

const dotClasses = computed(() => {
    switch (props.size) {
        case "sm":
            return "w-1.5 h-1.5 rounded-full";
        case "lg":
            return "w-3 h-3 rounded-full";
        default:
            return "w-2 h-2 rounded-full";
    }
});

const badgeClasses = computed(() => {
    switch (props.size) {
        case "sm":
            return "px-1 py-0.5 text-xs rounded min-w-[16px] h-4";
        case "lg":
            return "px-3 py-1 text-sm rounded-md min-w-[24px] h-6";
        default:
            return "px-2 py-0.5 text-xs rounded min-w-[20px] h-5";
    }
});

const sizeClasses = computed(() => {
    if (props.dot) return "";

    switch (props.size) {
        case "sm":
            return "text-xs";
        case "lg":
            return "text-sm";
        default:
            return "text-xs";
    }
});

const variantClasses = computed(() => {
    switch (props.variant) {
        case "primary":
            return "bg-[var(--color-primary)] text-white";
        case "secondary":
            return "bg-[var(--color-secondary)] text-white";
        case "success":
            return "bg-green-500 text-white";
        case "warning":
            return "bg-yellow-500 text-white";
        case "danger":
            return "bg-red-500 text-white";
        case "info":
            return "bg-blue-500 text-white";
        default:
            return "bg-[var(--color-primary)] text-white";
    }
});
</script>

<template>
    <div
        :class="[
            'bg-[var(--color-card-bg)] border border-[var(--color-border)] rounded-lg shadow-sm',
            'transition-all duration-150',
            sizeClasses,
        ]"
    >
        <div
            v-if="title || $slots.title"
            :class="['border-b border-[var(--color-border)] px-6 py-4', 'bg-[var(--color-bg)]']"
        >
            <slot name="title">
                <h3 class="text-lg font-semibold text-[var(--color-text)] m-0">{{ title }}</h3>
            </slot>
        </div>
        <div :class="['px-6 py-4', bodyClasses]">
            <slot />
        </div>
        <div
            v-if="$slots.footer"
            class="border-t border-[var(--color-border)] px-6 py-4 bg-[var(--color-bg)]"
        >
            <slot name="footer" />
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed } from "vue";

interface Props {
    title?: string;
    size?: "sm" | "md" | "lg";
    bodyPadding?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
    size: "md",
    bodyPadding: true,
});

const sizeClasses = computed(() => {
    switch (props.size) {
        case "sm":
            return "max-w-sm";
        case "lg":
            return "max-w-4xl";
        default:
            return "max-w-2xl";
    }
});

const bodyClasses = computed(() => {
    return props.bodyPadding ? "" : "!p-0";
});
</script>

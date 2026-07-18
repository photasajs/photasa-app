<template>
    <div
        :class="[
            'px-4 py-3 bg-[var(--color-card-bg)] transition-colors',
            clickable && 'cursor-pointer hover:bg-[var(--color-card-hover)]',
            active && 'bg-[var(--color-card-selected)]',
            disabled && 'opacity-50 cursor-not-allowed',
            sizeClasses,
            className,
        ]"
        @click="handleClick"
    >
        <div class="flex items-center justify-between">
            <div class="flex items-center min-w-0 flex-1">
                <div v-if="$slots.avatar" class="flex-shrink-0 mr-3">
                    <slot name="avatar" />
                </div>
                <div class="min-w-0 flex-1">
                    <div v-if="title || $slots.title" class="font-medium text-[var(--color-text)]">
                        <slot name="title">{{ title }}</slot>
                    </div>
                    <div
                        v-if="description || $slots.description"
                        class="mt-1 text-[var(--color-text-secondary)]"
                    >
                        <slot name="description">{{ description }}</slot>
                    </div>
                    <div v-if="$slots.default" class="mt-2">
                        <slot />
                    </div>
                </div>
            </div>
            <div v-if="$slots.actions" class="flex-shrink-0 ml-3">
                <slot name="actions" />
            </div>
            <div v-if="$slots.extra" class="flex-shrink-0 ml-3">
                <slot name="extra" />
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed } from "vue";

interface Props {
    title?: string;
    description?: string;
    clickable?: boolean;
    active?: boolean;
    disabled?: boolean;
    size?: "sm" | "md" | "lg";
    className?: string;
}

const props = withDefaults(defineProps<Props>(), {
    clickable: false,
    active: false,
    disabled: false,
    size: "md",
    className: "",
});

const emit = defineEmits<{
    click: [event: MouseEvent];
}>();

const sizeClasses = computed(() => {
    switch (props.size) {
        case "sm":
            return "px-3 py-2 text-sm";
        case "lg":
            return "px-6 py-4 text-lg";
        default:
            return "px-4 py-3";
    }
});

const handleClick = (event: MouseEvent) => {
    if (!props.disabled && props.clickable) {
        emit("click", event);
    }
};
</script>

<template>
    <div
        :class="[
            'inline-block animate-spin rounded-full border-solid border-current border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]',
            sizeClasses,
        ]"
        role="status"
    >
        <span class="sr-only">Loading...</span>
    </div>
</template>

<script setup lang="ts">
import { computed } from "vue";

interface Props {
    size?: "sm" | "md" | "lg" | "xl";
}

const props = withDefaults(defineProps<Props>(), {
    size: "md",
});

const sizeClasses = computed(() => {
    switch (props.size) {
        case "sm":
            return "h-4 w-4 border-2";
        case "lg":
            return "h-8 w-8 border-4";
        case "xl":
            return "h-12 w-12 border-4";
        default:
            return "h-6 w-6 border-2";
    }
});
</script>

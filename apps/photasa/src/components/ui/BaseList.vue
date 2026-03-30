<template>
    <div
        :class="[
            'divide-y divide-[var(--color-border)]',
            bordered && 'border border-[var(--color-border)] rounded-lg',
            size === 'sm' && 'text-sm',
            size === 'lg' && 'text-lg',
            className,
        ]"
    >
        <slot />
    </div>
</template>

<script setup lang="ts">
interface Props {
    bordered?: boolean;
    size?: "sm" | "md" | "lg";
    className?: string;
}

withDefaults(defineProps<Props>(), {
    bordered: false,
    size: "md",
    className: "",
});
</script>

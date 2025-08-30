<template>
    <div
        @click.stop
        :class="className"
        :style="style"
        role="dialog"
        :aria-labelledby="ariaLabelledby"
        aria-modal="true"
        v-bind="$attrs"
    >
        <slot />
    </div>
</template>

<script setup lang="ts">
interface Props {
    className?: string | string[] | Record<string, boolean>;
    style?: string | Record<string, any>;
    ariaLabelledby?: string;
}

defineProps<Props>();

// 允许所有HTML属性透传
defineOptions({
    inheritAttrs: false,
});
</script>

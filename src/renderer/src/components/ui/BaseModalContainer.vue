<template>
    <div
        @click.stop
        :class="class"
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
    class?: string | string[] | Record<string, boolean>;
    style?: string | Record<string, any>;
    ariaLabelledby?: string;
}

defineProps<Props>();

// 允许所有HTML属性透传
defineOptions({
    inheritAttrs: false,
});
</script>

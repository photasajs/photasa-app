<template>
    <div :class="class" :style="style" v-bind="$attrs">
        <slot />
    </div>
</template>

<script setup lang="ts">
interface Props {
    class?: string | string[] | Record<string, boolean>;
    style?: string | Record<string, any>;
}

defineProps<Props>();

// 允许所有HTML属性透传
defineOptions({
    inheritAttrs: false,
});
</script>

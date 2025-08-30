<template>
    <div :class="className" aria-hidden="true" v-bind="$attrs" @click="$emit('click')" />
</template>

<script setup lang="ts">
interface Props {
    className?: string | string[] | Record<string, boolean>;
}

defineProps<Props>();

defineEmits<{
    click: [];
}>();

// 允许所有HTML属性透传
defineOptions({
    inheritAttrs: false,
});
</script>

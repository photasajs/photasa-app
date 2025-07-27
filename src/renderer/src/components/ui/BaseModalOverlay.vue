<template>
    <div :class="class" aria-hidden="true" v-bind="$attrs" @click="$emit('click')" />
</template>

<script setup lang="ts">
interface Props {
    class?: string | string[] | Record<string, boolean>;
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

<template>
    <h2 :id="id" :class="className" v-bind="$attrs">
        <slot>{{ title }}</slot>
    </h2>
</template>

<script setup lang="ts">
interface Props {
    title?: string;
    id?: string;
    className?: string | string[] | Record<string, boolean>;
}

withDefaults(defineProps<Props>(), {
    id: "modal-title",
});

// 允许所有HTML属性透传
defineOptions({
    inheritAttrs: false,
});
</script>

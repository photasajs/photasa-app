<template>
    <button
        type="button"
        :class="className"
        :style="style"
        v-bind="$attrs"
        @click="$emit('click')"
        :aria-label="ariaLabel"
    >
        <slot>
            <PhX v-if="showIcon" class="h-5 w-5" />
        </slot>
    </button>
</template>

<script setup lang="ts">
import { PhX } from "@phosphor-icons/vue";

interface Props {
    className?: string | string[] | Record<string, boolean>;
    style?: string | Record<string, any>;
    ariaLabel?: string;
    showIcon?: boolean;
}

withDefaults(defineProps<Props>(), {
    ariaLabel: "Close modal",
    showIcon: true,
});

defineEmits<{
    click: [];
}>();

// 允许所有HTML属性透传
defineOptions({
    inheritAttrs: false,
});
</script>

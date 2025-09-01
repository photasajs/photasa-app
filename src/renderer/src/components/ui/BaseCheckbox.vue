<template>
    <label
        :class="[
            'inline-flex items-center cursor-pointer',
            disabled && 'opacity-50 cursor-not-allowed',
        ]"
    >
        <input
            type="checkbox"
            :checked="modelValue"
            :disabled="disabled"
            :class="['sr-only']"
            @change="handleChange"
        />
        <div
            :class="[
                'relative flex items-center justify-center w-4 h-4 border-2 rounded transition-all',
                modelValue
                    ? 'bg-[var(--color-primary)] border-[var(--color-primary)]'
                    : 'bg-[var(--color-input-bg)] border-[var(--color-border)] hover:border-[var(--color-primary)]',
                disabled && 'cursor-not-allowed',
            ]"
        >
            <PhCheck v-if="modelValue" class="w-3 h-3 text-white" />
        </div>
        <span
            v-if="label || $slots.default"
            :class="[
                'ml-2 text-sm text-[var(--color-text)]',
                disabled && 'text-[var(--color-text-secondary)]',
            ]"
        >
            <slot>{{ label }}</slot>
        </span>
    </label>
</template>

<script setup lang="ts">
import { PhCheck } from "@phosphor-icons/vue";

interface Props {
    modelValue: boolean;
    label?: string;
    disabled?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
    disabled: false,
});

const emit = defineEmits<{
    "update:modelValue": [value: boolean];
}>();

const handleChange = (event: Event) => {
    if (props.disabled) return;
    const target = event.target as HTMLInputElement;
    emit("update:modelValue", target.checked);
};
</script>

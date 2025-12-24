<template>
    <label
        :class="[
            'inline-flex items-center cursor-pointer',
            disabled && 'opacity-50 cursor-not-allowed',
        ]"
    >
        <input
            type="radio"
            :value="value"
            :checked="modelValue === value"
            :disabled="disabled"
            :name="name"
            :class="['sr-only']"
            @change="handleChange"
        />
        <div
            :class="[
                'relative flex items-center justify-center w-4 h-4 border-2 rounded-full transition-all',
                modelValue === value
                    ? 'bg-[var(--color-primary)] border-[var(--color-primary)]'
                    : 'bg-[var(--color-input-bg)] border-[var(--color-border)] hover:border-[var(--color-primary)]',
                disabled && 'cursor-not-allowed',
            ]"
        >
            <div v-if="modelValue === value" class="w-2 h-2 bg-white rounded-full" />
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
interface Props {
    modelValue?: any;
    value: any;
    label?: string;
    disabled?: boolean;
    name?: string;
}

const props = withDefaults(defineProps<Props>(), {
    disabled: false,
});

const emit = defineEmits<{
    "update:modelValue": [value: any];
    change: [value: any];
}>();

const handleChange = () => {
    if (!props.disabled) {
        emit("update:modelValue", props.value);
        emit("change", props.value);
    }
};
</script>

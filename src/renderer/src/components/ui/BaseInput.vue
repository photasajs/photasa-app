<template>
    <div class="relative">
        <input
            :type="type"
            :value="modelValue"
            :placeholder="placeholder"
            :disabled="disabled"
            :readonly="readonly"
            :class="[
                'block w-full rounded-md border px-3 py-2 text-sm placeholder-[var(--color-text-secondary)] shadow-sm transition-colors',
                'bg-[var(--color-input-bg)] border-[var(--color-border)] text-[var(--color-text)]',
                'hover:border-[var(--color-primary)] focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-2',
                disabled && 'opacity-50 cursor-not-allowed',
                readonly && 'bg-[var(--color-bg-secondary)] cursor-default',
                error &&
                    'border-[var(--color-danger)] focus:border-[var(--color-danger)] focus:ring-[var(--color-danger)]',
            ]"
            @input="handleInput"
            @blur="$emit('blur', $event)"
            @focus="$emit('focus', $event)"
        />
        <div v-if="$slots.suffix" class="absolute inset-y-0 right-0 flex items-center pr-3">
            <slot name="suffix" />
        </div>
    </div>
    <p v-if="error && errorMessage" class="mt-1 text-sm text-[var(--color-danger)]">
        {{ errorMessage }}
    </p>
</template>

<script setup lang="ts">
interface Props {
    modelValue: string | number;
    type?: string;
    placeholder?: string;
    disabled?: boolean;
    readonly?: boolean;
    error?: boolean;
    errorMessage?: string;
}

const _props = withDefaults(defineProps<Props>(), {
    type: "text",
    disabled: false,
    readonly: false,
    error: false,
});

const emit = defineEmits<{
    "update:modelValue": [value: string | number];
    blur: [event: FocusEvent];
    focus: [event: FocusEvent];
}>();

const handleInput = (event: Event) => {
    const target = event.target as HTMLInputElement;
    emit("update:modelValue", target.value);
};
</script>

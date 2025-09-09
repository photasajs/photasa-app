<template>
    <div :class="['space-y-2', className]">
        <label
            v-if="label || $slots.label"
            :for="inputId"
            :class="[
                'block text-sm font-medium text-[var(--color-text)]',
                required && 'after:content-[\'*\'] after:ml-1 after:text-red-500',
                disabled && 'opacity-50',
            ]"
        >
            <slot name="label">{{ label }}</slot>
        </label>

        <div class="relative">
            <slot :id="inputId" :aria-describedby="helpId" :aria-invalid="!!error" />

            <div
                v-if="error"
                class="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none"
            >
                <PhWarning class="h-4 w-4 text-red-500" />
            </div>
        </div>

        <div
            v-if="help || $slots.help"
            :id="helpId"
            class="text-sm text-[var(--color-text-secondary)]"
        >
            <slot name="help">{{ help }}</slot>
        </div>

        <div v-if="error" class="text-sm text-red-500 flex items-center">
            <PhWarning class="h-4 w-4 mr-1 flex-shrink-0" />
            {{ error }}
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { PhWarning } from "@phosphor-icons/vue";

interface Props {
    label?: string;
    help?: string;
    error?: string;
    required?: boolean;
    disabled?: boolean;
    className?: string;
}

withDefaults(defineProps<Props>(), {
    required: false,
    disabled: false,
    className: "",
});

const fieldId = ref(Math.random().toString(36).substr(2, 9));

const inputId = computed(() => `form-field-${fieldId.value}`);
const helpId = computed(() => `form-field-help-${fieldId.value}`);
</script>

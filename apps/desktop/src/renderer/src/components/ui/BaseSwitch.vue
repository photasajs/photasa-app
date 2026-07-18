<template>
    <Switch
        v-model="switchValue"
        :disabled="disabled"
        :class="[
            switchValue ? 'bg-[var(--color-primary)]' : 'bg-[var(--color-bg-secondary)]',
            'relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-2',
            disabled && 'opacity-50 cursor-not-allowed',
        ]"
    >
        <span class="sr-only">{{ label }}</span>
        <span
            :class="[
                switchValue ? 'translate-x-5' : 'translate-x-0',
                'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out',
            ]"
        />
    </Switch>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { Switch } from "@headlessui/vue";

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

const switchValue = computed({
    get: () => props.modelValue,
    set: (value) => emit("update:modelValue", value),
});
</script>

<template>
    <div
        :class="['space-y-2', direction === 'horizontal' && 'flex space-x-4 space-y-0', className]"
        role="radiogroup"
        :aria-labelledby="labelId"
        :aria-describedby="descriptionId"
    >
        <div v-if="label" :id="labelId" class="text-sm font-medium text-[var(--color-text)] mb-2">
            {{ label }}
        </div>
        <div
            v-if="description"
            :id="descriptionId"
            class="text-sm text-[var(--color-text-secondary)] mb-3"
        >
            {{ description }}
        </div>

        <template v-if="options && options.length">
            <BaseRadio
                v-for="option in options"
                :key="getOptionValue(option)"
                v-model="internalValue"
                :value="getOptionValue(option)"
                :label="getOptionLabel(option)"
                :disabled="disabled || getOptionDisabled(option)"
                :name="name || `radio-group-${groupId}`"
                @change="handleChange"
            />
        </template>

        <slot v-else :value="internalValue" :change="handleChange" />
    </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import BaseRadio from "./BaseRadio.vue";

interface Option {
    label: string;
    value: any;
    disabled?: boolean;
}

interface Props {
    modelValue?: any;
    options?: Option[] | string[] | number[];
    label?: string;
    description?: string;
    direction?: "vertical" | "horizontal";
    disabled?: boolean;
    name?: string;
    className?: string;
}

const props = withDefaults(defineProps<Props>(), {
    direction: "vertical",
    disabled: false,
    className: "",
});

const emit = defineEmits<{
    "update:modelValue": [value: any];
    change: [value: any];
}>();

const groupId = ref(Math.random().toString(36).substr(2, 9));
const labelId = computed(() => `radio-group-label-${groupId.value}`);
const descriptionId = computed(() => `radio-group-desc-${groupId.value}`);

const internalValue = computed({
    get: () => props.modelValue,
    set: (value) => {
        emit("update:modelValue", value);
    },
});

const getOptionValue = (option: Option | string | number) => {
    if (typeof option === "object" && option !== null) {
        return option.value;
    }
    return option;
};

const getOptionLabel = (option: Option | string | number) => {
    if (typeof option === "object" && option !== null) {
        return option.label;
    }
    return String(option);
};

const getOptionDisabled = (option: Option | string | number) => {
    if (typeof option === "object" && option !== null) {
        return option.disabled || false;
    }
    return false;
};

const handleChange = (value: any) => {
    emit("change", value);
};
</script>

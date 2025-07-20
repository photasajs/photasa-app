<template>
    <Listbox v-model="selectedValue" :disabled="disabled">
        <div class="relative">
            <ListboxButton
                :class="[
                    'relative w-full cursor-default rounded-md border py-2 pl-3 pr-10 text-left shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 sm:text-sm',
                    'bg-[var(--color-input-bg)] border-[var(--color-border)] text-[var(--color-text)]',
                    'hover:border-[var(--color-primary)] focus:border-[var(--color-primary)] focus:ring-[var(--color-primary)]',
                    disabled && 'opacity-50 cursor-not-allowed',
                ]"
            >
                <span class="block truncate">
                    {{ selectedOption?.label || placeholder }}
                </span>
                <span class="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
                    <ChevronUpDownIcon
                        class="h-5 w-5 text-[var(--color-text-secondary)]"
                        aria-hidden="true"
                    />
                </span>
            </ListboxButton>

            <transition
                leave-active-class="transition duration-100 ease-in"
                leave-from-class="opacity-100"
                leave-to-class="opacity-0"
            >
                <ListboxOptions
                    :class="[
                        'absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm',
                        'bg-[var(--color-card-bg)] border border-[var(--color-border)]',
                    ]"
                >
                    <ListboxOption
                        v-for="option in options"
                        :key="option.value"
                        v-slot="{ active, selected }"
                        :value="option.value"
                        as="template"
                    >
                        <li
                            :class="[
                                active
                                    ? 'bg-[var(--color-card-hover)] text-[var(--color-text)]'
                                    : 'text-[var(--color-text)]',
                                'relative cursor-default select-none py-2 pl-10 pr-4',
                            ]"
                        >
                            <span
                                :class="[
                                    selected ? 'font-medium' : 'font-normal',
                                    'block truncate',
                                ]"
                            >
                                {{ option.label }}
                            </span>
                            <span
                                v-if="selected"
                                class="absolute inset-y-0 left-0 flex items-center pl-3 text-[var(--color-primary)]"
                            >
                                <CheckIcon class="h-5 w-5" aria-hidden="true" />
                            </span>
                        </li>
                    </ListboxOption>
                </ListboxOptions>
            </transition>
        </div>
    </Listbox>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { Listbox, ListboxButton, ListboxOptions, ListboxOption } from "@headlessui/vue";
import { CheckIcon, ChevronUpDownIcon } from "@heroicons/vue/20/solid";

interface Option {
    value: string | number;
    label: string;
}

interface Props {
    modelValue: string | number | null;
    options: Option[];
    placeholder?: string;
    disabled?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
    placeholder: "Select an option",
    disabled: false,
});

const emit = defineEmits<{
    "update:modelValue": [value: string | number | null];
}>();

const selectedValue = computed({
    get: () => props.modelValue,
    set: (value) => emit("update:modelValue", value),
});

const selectedOption = computed(() => {
    return props.options.find((option) => option.value === props.modelValue);
});
</script>

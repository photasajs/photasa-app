<template>
    <MenuItem v-slot="{ active, close }">
        <button
            :class="[
                'group flex w-full items-center px-4 py-2 text-sm transition-colors',
                active
                    ? 'bg-[var(--color-card-hover)] text-[var(--color-text)]'
                    : 'text-[var(--color-text-secondary)]',
                disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
            ]"
            :disabled="disabled"
            @click="handleClick(close)"
        >
            <slot name="icon" v-if="$slots.icon" />
            <slot />
        </button>
    </MenuItem>
</template>

<script setup lang="ts">
import { MenuItem } from "@headlessui/vue";

interface Props {
    disabled?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
    disabled: false,
});

const emit = defineEmits<{
    click: [];
}>();

const handleClick = (close: () => void) => {
    if (!props.disabled) {
        emit("click");
        close();
    }
};
</script>

<template>
    <div
        :class="[
            'rounded-lg border px-4 py-3 flex items-start gap-3',
            'transition-all duration-150',
            typeClasses,
        ]"
        role="alert"
    >
        <div v-if="showIcon" class="flex-shrink-0 mt-0.5 alert-icon-container">
            <IconCircleX
                v-if="type === 'error'"
                class="h-5 w-5 alert-icon-danger"
                :style="{
                    color: 'var(--color-danger)',
                    stroke: 'var(--color-danger)',
                    '--tabler-stroke-width': '2'
                }"
            />
            <IconAlertTriangle
                v-else-if="type === 'warning'"
                class="h-5 w-5 alert-icon-warning"
                :style="{
                    color: 'var(--color-warning)',
                    stroke: 'var(--color-warning)',
                    '--tabler-stroke-width': '2'
                }"
            />
            <IconCircleCheck
                v-else-if="type === 'success'"
                class="h-5 w-5 alert-icon-success"
                :style="{
                    color: 'var(--color-success)',
                    stroke: 'var(--color-success)',
                    '--tabler-stroke-width': '2'
                }"
            />
            <IconInfoCircle
                v-else
                class="h-5 w-5 alert-icon-info"
                :style="{
                    color: 'var(--color-info)',
                    stroke: 'var(--color-info)',
                    '--tabler-stroke-width': '2'
                }"
            />
        </div>
        <div class="flex-1 min-w-0">
            <div v-if="message" class="font-medium text-sm mb-1">
                {{ message }}
            </div>
            <div v-if="description" class="text-sm opacity-90">
                {{ description }}
            </div>
            <slot />
        </div>
        <button
            v-if="closable"
            @click="$emit('close')"
            class="flex-shrink-0 ml-2 hover:opacity-75 transition-opacity"
        >
            <svg class="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                <path
                    fill-rule="evenodd"
                    d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                    clip-rule="evenodd"
                />
            </svg>
        </button>
    </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { IconCircleCheck, IconAlertTriangle, IconCircleX, IconInfoCircle } from "@tabler/icons-vue";

interface Props {
    type?: "info" | "success" | "warning" | "error";
    message?: string;
    description?: string;
    showIcon?: boolean;
    closable?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
    type: "info",
    showIcon: false,
    closable: false,
});

defineEmits<{
    close: [];
}>();

const typeClasses = computed(() => {
    switch (props.type) {
        case "success":
            return "bg-transparent border-[var(--color-success)] text-[var(--color-success)]";
        case "warning":
            return "bg-transparent border-[var(--color-warning)] text-[var(--color-warning)]";
        case "error":
            return "bg-transparent border-[var(--color-danger)] text-[var(--color-danger)]";
        default:
            return "bg-transparent border-[var(--color-info)] text-[var(--color-info)]";
    }
});

</script>

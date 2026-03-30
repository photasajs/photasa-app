<template>
    <div class="wizard-indicator">
        <div class="flex items-center justify-center space-x-4">
            <template v-for="(step, index) in steps" :key="step.id">
                <div class="flex items-center">
                    <!-- Step Circle -->
                    <div
                        :class="[
                            'w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors',
                            getStepClasses(step, index),
                        ]"
                        @click="onStepClick(index)"
                        :style="{ cursor: allowStepClick ? 'pointer' : 'default' }"
                    >
                        <PhCheck v-if="completedSteps.has(step.id)" class="w-4 h-4" />
                        <span v-else>{{ index + 1 }}</span>
                    </div>

                    <!-- Step Label -->
                    <div class="ml-2 min-w-0">
                        <div class="text-sm font-medium text-[var(--color-text)] truncate">
                            {{ step.title }}
                        </div>
                        <div
                            v-if="step.description && showDescriptions"
                            class="text-xs text-[var(--color-text-secondary)] truncate"
                        >
                            {{ step.description }}
                        </div>
                    </div>
                </div>

                <!-- Connector Line -->
                <div
                    v-if="index < steps.length - 1"
                    :class="[
                        'flex-1 h-px transition-colors',
                        completedSteps.has(step.id)
                            ? 'bg-[var(--color-primary)]'
                            : 'bg-[var(--color-border)]',
                    ]"
                ></div>
            </template>
        </div>

        <!-- Progress Bar (optional) -->
        <div v-if="showProgressBar" class="mt-4">
            <div class="w-full bg-[var(--color-bg-secondary)] rounded-full h-2">
                <div
                    class="bg-[var(--color-primary)] h-2 rounded-full transition-all duration-300"
                    :style="{ width: `${progress}%` }"
                ></div>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { PhCheck } from "@phosphor-icons/vue";
import type { WizardStep } from "./types";

interface Props {
    steps: WizardStep[];
    currentStepIndex: number;
    completedSteps: Set<string>;
    progress: number;
    allowStepClick?: boolean;
    showDescriptions?: boolean;
    showProgressBar?: boolean;
}

interface Emits {
    (e: "step-click", index: number): void;
}

const props = withDefaults(defineProps<Props>(), {
    allowStepClick: false,
    showDescriptions: false,
    showProgressBar: false,
});

const emit = defineEmits<Emits>();

const getStepClasses = (step: WizardStep, index: number) => {
    const isCompleted = props.completedSteps.has(step.id);
    const isCurrent = index === props.currentStepIndex;

    if (isCompleted) {
        return "bg-[var(--color-primary)] text-[var(--color-white)]";
    } else if (isCurrent) {
        return "bg-[var(--color-primary)] text-[var(--color-white)]";
    } else {
        return "bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)]";
    }
};

const onStepClick = (index: number) => {
    if (props.allowStepClick) {
        emit("step-click", index);
    }
};
</script>

<style scoped>
.wizard-indicator {
    @apply w-full;
}
</style>

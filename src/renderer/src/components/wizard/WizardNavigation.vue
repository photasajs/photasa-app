<template>
    <div class="wizard-navigation">
        <div class="flex justify-between items-center">
            <!-- Back Button -->
            <div>
                <BaseButton
                    v-if="showBackButton && canGoBack"
                    variant="secondary"
                    :disabled="isLoading"
                    @click="$emit('back')"
                >
                    <ArrowLeftIcon class="w-4 h-4 mr-2" />
                    {{ backButtonText }}
                </BaseButton>
            </div>

            <!-- Forward Buttons -->
            <div class="flex gap-3">
                <!-- Cancel Button -->
                <BaseButton
                    v-if="showCancelButton"
                    variant="secondary"
                    :disabled="isLoading"
                    @click="$emit('cancel')"
                >
                    {{ cancelButtonText }}
                </BaseButton>

                <!-- Next Button -->
                <BaseButton
                    v-if="!isLastStep"
                    variant="primary"
                    :disabled="!canGoNext || isLoading"
                    :loading="isLoading"
                    @click="$emit('next')"
                >
                    <component :is="nextButtonIcon" class="w-4 h-4 mr-2" />
                    {{ nextButtonText }}
                </BaseButton>

                <!-- Finish Button -->
                <BaseButton
                    v-if="isLastStep"
                    variant="primary"
                    :disabled="!canFinish || isLoading"
                    :loading="isLoading"
                    @click="$emit('finish')"
                >
                    <component :is="finishButtonIcon" class="w-4 h-4 mr-2" />
                    {{ finishButtonText }}
                </BaseButton>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { BaseButton } from "@renderer/components/ui";
import { ArrowLeftIcon, ArrowRightIcon, CheckIcon } from "@heroicons/vue/24/outline";

interface Props {
    canGoNext: boolean;
    canGoBack: boolean;
    canFinish: boolean;
    isLastStep: boolean;
    isLoading: boolean;
    showBackButton?: boolean;
    showCancelButton?: boolean;
    backButtonText?: string;
    nextButtonText?: string;
    finishButtonText?: string;
    cancelButtonText?: string;
    nextButtonIcon?: any;
    finishButtonIcon?: any;
}

interface Emits {
    (e: "next"): void;
    (e: "back"): void;
    (e: "finish"): void;
    (e: "cancel"): void;
}

withDefaults(defineProps<Props>(), {
    showBackButton: true,
    showCancelButton: true,
    backButtonText: "Back",
    nextButtonText: "Next",
    finishButtonText: "Finish",
    cancelButtonText: "Cancel",
    nextButtonIcon: ArrowRightIcon,
    finishButtonIcon: CheckIcon,
});

defineEmits<Emits>();
</script>

<style scoped>
.wizard-navigation {
    @apply w-full;
}
</style>

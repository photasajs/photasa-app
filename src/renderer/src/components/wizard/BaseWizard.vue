<template>
    <BaseModal
        :open="open"
        :title="modalTitle"
        :size="size"
        :closable="closable"
        :persistent="persistent"
        @close="handleClose"
    >
        <div class="wizard-container h-full flex flex-col">
            <!-- Step Indicator -->
            <div v-if="showIndicator" class="flex-shrink-0 mb-6">
                <WizardIndicator
                    :steps="visibleSteps"
                    :current-step-index="currentStepIndex"
                    :completed-steps="completedSteps"
                    :progress="progress"
                    :allow-step-click="allowStepNavigation"
                    :show-descriptions="showStepDescriptions"
                    :show-progress-bar="showProgressBar"
                    @step-click="handleStepClick"
                />
            </div>

            <!-- Step Content -->
            <div class="flex-1 overflow-hidden">
                <div class="h-full">
                    <!-- Dynamic Step Component -->
                    <component
                        v-if="currentStep?.component"
                        :is="currentStep.component"
                        :step-data="getStepData(currentStep.id)"
                        :wizard-state="state"
                        @update:step-data="(data) => setStepData(currentStep.id, data)"
                        @next="handleNext"
                        @back="handleBack"
                        @finish="handleFinish"
                        @cancel="handleCancel"
                    />

                    <!-- Slot-based Content -->
                    <slot
                        v-else
                        :name="currentStep?.id"
                        :step="currentStep"
                        :step-data="getStepData(currentStep?.id || '')"
                        :wizard-state="state"
                        :set-step-data="setStepData"
                        :go-next="handleNext"
                        :go-back="handleBack"
                        :finish="handleFinish"
                        :cancel="handleCancel"
                    >
                        <!-- Default slot -->
                        <slot
                            :step="currentStep"
                            :step-data="getStepData(currentStep?.id || '')"
                            :wizard-state="state"
                            :set-step-data="setStepData"
                            :go-next="handleNext"
                            :go-back="handleBack"
                            :finish="handleFinish"
                            :cancel="handleCancel"
                        />
                    </slot>
                </div>
            </div>
        </div>

        <!-- Navigation Footer -->
        <template #footer>
            <WizardNavigation
                v-if="showNavigation"
                :can-go-next="canGoNext"
                :can-go-back="canGoBack"
                :can-finish="canFinish"
                :is-last-step="isLastStep"
                :is-loading="isLoading"
                :show-back-button="showBackButton"
                :show-cancel-button="showCancelButton"
                :back-button-text="backButtonText"
                :next-button-text="nextButtonText"
                :finish-button-text="finishButtonText"
                :cancel-button-text="cancelButtonText"
                :next-button-icon="nextButtonIcon"
                :finish-button-icon="finishButtonIcon"
                @next="handleNext"
                @back="handleBack"
                @finish="handleFinish"
                @cancel="handleCancel"
            />

            <!-- Custom Footer Slot -->
            <slot
                name="footer"
                :wizard-state="state"
                :go-next="handleNext"
                :go-back="handleBack"
                :finish="handleFinish"
                :cancel="handleCancel"
            />
        </template>
    </BaseModal>
</template>

<script setup lang="ts">
import { computed, onMounted, watch } from "vue";
import { BaseModal } from "@renderer/components/ui";
import WizardIndicator from "./WizardIndicator.vue";
import WizardNavigation from "./WizardNavigation.vue";
import { useWizard } from "./composables/useWizard";
import type { WizardConfig } from "./types";

interface Props {
    open: boolean;
    config: WizardConfig;
    size?: "sm" | "md" | "lg" | "xl" | "full";
    closable?: boolean;
    persistent?: boolean;
    showIndicator?: boolean;
    showNavigation?: boolean;
    showProgressBar?: boolean;
    showStepDescriptions?: boolean;
    allowStepNavigation?: boolean;
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
    (e: "update:open", value: boolean): void;
    (e: "complete", data: any): void;
    (e: "cancel"): void;
    (e: "step-change", stepId: string, stepIndex: number, wizardState: any): void;
}

const props = withDefaults(defineProps<Props>(), {
    size: "lg",
    closable: true,
    persistent: false,
    showIndicator: true,
    showNavigation: true,
    showProgressBar: false,
    showStepDescriptions: false,
    allowStepNavigation: false,
    showBackButton: true,
    showCancelButton: true,
    backButtonText: "Back",
    nextButtonText: "Next",
    finishButtonText: "Finish",
    cancelButtonText: "Cancel",
});

const emit = defineEmits<Emits>();

// Initialize wizard
const wizard = useWizard({
    ...props.config,
    onComplete: async (data) => {
        emit("complete", data);
        if (props.config.onComplete) {
            await props.config.onComplete(data);
        }
    },
    onCancel: () => {
        emit("cancel");
        if (props.config.onCancel) {
            props.config.onCancel();
        }
    },
});

// Destructure wizard composable
const {
    state,
    currentStep,
    currentStepIndex,
    visibleSteps,
    completedSteps,
    canGoNext,
    canGoBack,
    canFinish,
    isLastStep,
    isLoading,
    progress,
    goNext,
    goBack,
    goToStep,
    finish,
    cancel,
    setStepData,
    getStepData,
    initialize,
} = wizard;

// Computed
const modalTitle = computed(() => {
    return currentStep.value?.title || "Wizard";
});

// Methods
const handleNext = async () => {
    const success = await goNext();
    if (success) {
        emit("step-change", currentStep.value.id, currentStepIndex.value, {
            stepData: state.stepData,
            setStepData,
        });
    }
};

const handleBack = async () => {
    const success = await goBack();
    if (success) {
        emit("step-change", currentStep.value.id, currentStepIndex.value, {
            stepData: state.stepData,
            setStepData,
        });
    }
};

const handleFinish = async () => {
    const success = await finish();
    if (success) {
        emit("update:open", false);
    }
};

const handleCancel = () => {
    cancel();
    emit("update:open", false);
};

const handleClose = () => {
    handleCancel();
};

const handleStepClick = async (stepIndex: number) => {
    if (props.allowStepNavigation) {
        const success = await goToStep(stepIndex);
        if (success) {
            emit("step-change", currentStep.value.id, currentStepIndex.value, {
                stepData: state.stepData,
                setStepData,
            });
        }
    }
};

// Watch for open changes to initialize/reset
watch(
    () => props.open,
    (isOpen) => {
        if (isOpen) {
            initialize();
        }
    },
);

// Initialize on mount
onMounted(() => {
    if (props.open) {
        initialize();
    }
});
</script>

<style scoped>
.wizard-container {
    min-height: 400px;
}
</style>

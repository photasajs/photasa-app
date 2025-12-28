import { ref, computed, reactive } from "vue";
import type { WizardConfig, WizardState, WizardStep } from "../types";
import { loggers } from "@photasa/common";

const logger = loggers.renderer;

export function useWizard(config: WizardConfig) {
    // State
    const currentStepIndex = ref(0);
    const completedSteps = ref(new Set<string>());
    const stepData = reactive<Record<string, any>>({});
    const isLoading = ref(false);

    // Computed
    const visibleSteps = computed(() => config.steps.filter((step) => !step.isHidden));

    const currentStep = computed(() => visibleSteps.value[currentStepIndex.value]);

    const canGoBack = computed(
        () => config.allowBackNavigation !== false && currentStepIndex.value > 0,
    );

    const canGoNext = computed(() => {
        const step = currentStep.value;
        if (!step) return false;

        // Check if step is valid
        if (step.isValid && typeof step.isValid === "function") {
            const currentStepData = stepData[step.id];
            const valid = step.isValid(currentStepData);
            return valid instanceof Promise ? false : valid; // Handle async validation separately
        }

        return true;
    });

    const canFinish = computed(
        () => currentStepIndex.value === visibleSteps.value.length - 1 && canGoNext.value,
    );

    const isFirstStep = computed(() => currentStepIndex.value === 0);
    const isLastStep = computed(() => currentStepIndex.value === visibleSteps.value.length - 1);

    const progress = computed(
        () => ((currentStepIndex.value + 1) / visibleSteps.value.length) * 100,
    );

    // State object
    const state = computed<WizardState>(() => ({
        currentStepIndex: currentStepIndex.value,
        currentStep: currentStep.value,
        completedSteps: completedSteps.value,
        stepData,
        isLoading: isLoading.value,
        canGoNext: canGoNext.value,
        canGoBack: canGoBack.value,
        canFinish: canFinish.value,
    }));

    // Methods
    async function validateCurrentStep(): Promise<boolean> {
        const step = currentStep.value;
        if (!step?.isValid) return true;

        const currentStepData = stepData[step.id];
        const result = step.isValid(currentStepData);
        return result instanceof Promise ? await result : result;
    }

    async function canEnterStep(step: WizardStep): Promise<boolean> {
        if (!step.canEnter) return true;

        const currentStepData = stepData[step.id];
        const result = step.canEnter(currentStepData);
        return result instanceof Promise ? await result : result;
    }

    async function canLeaveStep(step: WizardStep): Promise<boolean> {
        if (!step.canLeave) return true;

        const currentStepData = stepData[step.id];
        const result = step.canLeave(currentStepData);
        return result instanceof Promise ? await result : result;
    }

    async function goToStep(stepIndex: number): Promise<boolean> {
        if (stepIndex < 0 || stepIndex >= visibleSteps.value.length) {
            return false;
        }

        const fromStep = currentStep.value;
        const toStep = visibleSteps.value[stepIndex];

        if (!toStep) return false;

        isLoading.value = true;

        try {
            // Check if we can leave current step
            if (fromStep && !(await canLeaveStep(fromStep))) {
                return false;
            }

            // Check if we can enter target step
            if (!(await canEnterStep(toStep))) {
                return false;
            }

            // Call leave handler
            if (fromStep?.onLeave) {
                const fromStepData = stepData[fromStep.id];
                await fromStep.onLeave(fromStepData);
            }

            // Update step
            currentStepIndex.value = stepIndex;

            // Mark previous step as completed
            if (fromStep) {
                completedSteps.value.add(fromStep.id);
            }

            // Call enter handler
            if (toStep.onEnter) {
                const toStepData = stepData[toStep.id];
                await toStep.onEnter(toStepData);
            }

            return true;
        } catch (error) {
            logger.error("Error navigating to step:", error);
            return false;
        } finally {
            isLoading.value = false;
        }
    }

    async function goNext(): Promise<boolean> {
        if (!canGoNext.value || isLastStep.value) return false;

        // Validate current step before proceeding
        if (!(await validateCurrentStep())) {
            return false;
        }

        return await goToStep(currentStepIndex.value + 1);
    }

    async function goBack(): Promise<boolean> {
        if (!canGoBack.value || isFirstStep.value) return false;
        return await goToStep(currentStepIndex.value - 1);
    }

    async function finish(): Promise<boolean> {
        if (!canFinish.value) return false;

        // Validate current step
        if (!(await validateCurrentStep())) {
            return false;
        }

        isLoading.value = true;

        try {
            // Mark final step as completed
            completedSteps.value.add(currentStep.value.id);

            // Call completion handler
            if (config.onComplete) {
                await config.onComplete(stepData);
            }

            return true;
        } catch (error) {
            logger.error("Error finishing wizard:", error);
            return false;
        } finally {
            isLoading.value = false;
        }
    }

    function cancel(): void {
        if (config.onCancel) {
            config.onCancel();
        }
    }

    function reset(): void {
        currentStepIndex.value = 0;
        completedSteps.value.clear();
        Object.keys(stepData).forEach((key) => delete stepData[key]);
        isLoading.value = false;
    }

    function setStepData(stepId: string, data: any): void {
        stepData[stepId] = data;
    }

    function getStepData(stepId: string): any {
        return stepData[stepId];
    }

    // Initialize
    function initialize(): void {
        if (visibleSteps.value.length > 0) {
            const firstStep = visibleSteps.value[0];
            if (firstStep.onEnter) {
                const firstStepData = stepData[firstStep.id];
                firstStep.onEnter(firstStepData);
            }
        }
    }

    return {
        // State
        state,
        currentStep,
        currentStepIndex,
        visibleSteps,
        completedSteps,
        stepData,
        isLoading,

        // Computed
        canGoNext,
        canGoBack,
        canFinish,
        isFirstStep,
        isLastStep,
        progress,

        // Methods
        goNext,
        goBack,
        goToStep,
        finish,
        cancel,
        reset,
        setStepData,
        getStepData,
        validateCurrentStep,
        initialize,
    };
}

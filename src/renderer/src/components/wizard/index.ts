// Main wizard components
export { default as BaseWizard } from "./BaseWizard.vue";
export { default as WizardIndicator } from "./WizardIndicator.vue";
export { default as WizardNavigation } from "./WizardNavigation.vue";

// Composables
export { useWizard } from "./composables/useWizard";

// Types
export type {
    WizardStep,
    WizardConfig,
    WizardState,
    WizardNavigationDirection,
    WizardNavigationEvent,
} from "./types";

// Utility functions
export function createWizardStep(
    step: Partial<WizardStep> & { id: string; title: string },
): WizardStep {
    return {
        isValid: () => true,
        canEnter: () => true,
        canLeave: () => true,
        isOptional: false,
        isHidden: false,
        ...step,
    };
}

export function createWizardConfig(
    config: Partial<WizardConfig> & { steps: WizardStep[] },
): WizardConfig {
    return {
        allowBackNavigation: true,
        allowSkipSteps: false,
        persistData: false,
        ...config,
    };
}

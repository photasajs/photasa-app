export interface WizardStep {
    id: string;
    title: string;
    description?: string;
    component?: any;
    isValid?: (stepData?: any) => boolean | Promise<boolean>;
    canEnter?: (stepData?: any) => boolean | Promise<boolean>;
    canLeave?: (stepData?: any) => boolean | Promise<boolean>;
    onEnter?: (stepData?: any) => void | Promise<void>;
    onLeave?: (stepData?: any) => void | Promise<void>;
    isOptional?: boolean;
    isHidden?: boolean;
}

export interface WizardConfig {
    steps: WizardStep[];
    allowBackNavigation?: boolean;
    allowSkipSteps?: boolean;
    persistData?: boolean;
    onComplete?: (data: any) => void | Promise<void>;
    onCancel?: () => void;
}

export interface WizardState {
    currentStepIndex: number;
    currentStep: WizardStep;
    completedSteps: Set<string>;
    stepData: Record<string, any>;
    isLoading: boolean;
    canGoNext: boolean;
    canGoBack: boolean;
    canFinish: boolean;
}

export type WizardNavigationDirection = "next" | "back" | "finish" | "cancel";

export interface WizardNavigationEvent {
    direction: WizardNavigationDirection;
    fromStep: WizardStep;
    toStep?: WizardStep;
    data?: any;
}

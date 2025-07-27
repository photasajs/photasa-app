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
    size?: "sm" | "md" | "lg" | "xl" | "full" | "custom";
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
    stepData, // 添加stepData的直接引用，避免通过computed state访问
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
/**
 * 处理下一步导航
 * 关键改进：在实际步骤切换前先触发step-change事件，允许父组件提前初始化目标步骤的数据
 * 这解决了stepData未定义导致的预览数据加载失败问题
 */
const handleNext = async () => {
    // 在导航前触发step-change事件，让父组件有机会初始化目标步骤的数据
    // 这是关键修复：之前事件在导航后触发，导致onEnter时数据未准备好
    const nextStepIndex = currentStepIndex.value + 1;
    const nextStep = visibleSteps.value[nextStepIndex];
    if (nextStep) {
        // 传递目标步骤信息和当前wizard状态，包括stepData和setStepData函数
        // 传递目标步骤信息和当前wizard状态，包括stepData和setStepData函数
        // 注意：直接传递stepData而不是state.stepData，避免computed带来的引用问题
        emit("step-change", nextStep.id, nextStepIndex, {
            stepData,
            setStepData,
        });
    }

    // 执行实际的步骤切换逻辑
    const success = await goNext();
    return success;
};

/**
 * 处理返回上一步导航
 * 同样在实际导航前触发step-change事件，确保数据初始化的一致性
 */
const handleBack = async () => {
    // 在返回导航前触发step-change事件，保持与handleNext的一致行为
    const prevStepIndex = currentStepIndex.value - 1;
    const prevStep = visibleSteps.value[prevStepIndex];
    if (prevStep) {
        // 传递目标步骤（上一步）的信息给父组件
        // 传递目标步骤（上一步）的信息给父组件
        emit("step-change", prevStep.id, prevStepIndex, {
            stepData,
            setStepData,
        });
    }

    // 执行实际的返回步骤逻辑
    const success = await goBack();
    return success;
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

/**
 * 处理步骤指示器点击导航
 * 当允许步骤导航时，用户可以直接点击步骤指示器跳转到特定步骤
 */
const handleStepClick = async (stepIndex: number) => {
    if (props.allowStepNavigation) {
        // 在直接跳转前也要触发step-change事件，确保目标步骤数据已初始化
        const targetStep = visibleSteps.value[stepIndex];
        if (targetStep) {
            // 传递用户点击的目标步骤信息
            // 传递用户点击的目标步骤信息
            emit("step-change", targetStep.id, stepIndex, {
                stepData,
                setStepData,
            });
        }

        // 执行实际的步骤跳转逻辑
        const success = await goToStep(stepIndex);
        return success;
    }
};

// 监控wizard打开状态变化，处理初始化逻辑
watch(
    () => props.open,
    (isOpen) => {
        if (isOpen) {
            // 初始化wizard状态
            initialize();

            // 关键修复：为初始步骤触发step-change事件
            // 这确保即使是第一个步骤也能得到数据初始化的机会
            // 解决了wizard打开时配置步骤数据未初始化的问题
            const firstStep = visibleSteps.value[0];
            if (firstStep) {
                emit("step-change", firstStep.id, 0, {
                    stepData, // 直接传递stepData响应式对象
                    setStepData, // 提供数据设置函数
                });
            }
        }
    },
);

// 组件挂载时的初始化逻辑
onMounted(() => {
    if (props.open) {
        // 如果wizard在挂载时就是打开状态，立即初始化
        initialize();

        // 为初始步骤触发step-change事件，与watch中的逻辑保持一致
        // 这处理了组件挂载时就打开wizard的场景
        const firstStep = visibleSteps.value[0];
        if (firstStep) {
            emit("step-change", firstStep.id, 0, {
                stepData, // 直接传递stepData响应式对象
                setStepData, // 允许父组件设置步骤数据
            });
        }
    }
});
</script>

<style scoped>
.wizard-container {
    /* 设置固定高度确保文件列表能正确滚动，避免无限扩展 */
    height: 600px;
    min-height: 400px;
}
</style>

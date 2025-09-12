<script setup lang="ts">
/**
 * 独立状态栏组件，完全变量化，支持主题 patch
 * - 自动消费 Pinia useStatusBarStore
 * - 支持国际化、进度、错误等
 * - 样式全部用 CSS 变量
 * - 增强扫描动画效果
 */
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { useStatusBarStore } from "@renderer/stores/statusBar";
import { usePhotosStore } from "@renderer/stores/photos";
import { storeToRefs } from "pinia";
import BuyMeCoffeeButton from "./BuyMeCoffeeButton.vue";

const statusBarStore = useStatusBarStore();
const photosStore = usePhotosStore();
const { processingFile } = storeToRefs(photosStore);
const { t } = useI18n();

const statusText = computed(() =>
    statusBarStore.status ? t(`status.${statusBarStore.status}`) : "",
);

// 检测是否正在扫描
const isScanning = computed(() => {
    const scanningText = t("status.scanning");
    const progressText = t("status.@d#/gi");

    return (
        processingFile.value?.includes(scanningText) ||
        processingFile.value?.includes(progressText) ||
        statusBarStore.currentTask?.includes(scanningText) ||
        statusBarStore.currentTask?.includes(progressText) ||
        statusBarStore.status === "scanning"
    );
});

// 提取扫描路径用于显示
const scanningPath = computed(() => {
    const scanningText = t("status.scanning");
    const colonSeparator = ": ";

    if (processingFile.value?.includes(scanningText + colonSeparator)) {
        return processingFile.value.replace(scanningText + colonSeparator, "");
    }
    return statusBarStore.currentTask || processingFile.value;
});
</script>
<template>
    <div class="status-bar">
        <div class="status-content">
            <!-- 扫描状态增强显示 -->
            <template v-if="isScanning">
                <div class="scanning-status">
                    <!-- 扫描动画图标 -->
                    <div class="scanning-icon">
                        <div class="scan-pulse-ring"></div>
                        <div class="scan-spinner">
                            <div class="scan-segment"></div>
                            <div class="scan-segment"></div>
                            <div class="scan-segment"></div>
                            <div class="scan-segment"></div>
                        </div>
                    </div>

                    <!-- 扫描文本 -->
                    <div class="scanning-text">
                        <span class="scanning-label">{{ t("status.scanning") }}</span>
                        <span v-if="scanningPath" class="scanning-path">: {{ scanningPath }}</span>
                        <span
                            v-if="statusBarStore.progress !== undefined"
                            class="scanning-progress"
                        >
                            ({{ statusBarStore.progress }}%)
                        </span>
                    </div>

                    <!-- 数据流动效果 -->
                    <div class="data-flow-mini">
                        <div class="data-dot data-dot-1"></div>
                        <div class="data-dot data-dot-2"></div>
                        <div class="data-dot data-dot-3"></div>
                    </div>
                </div>
            </template>

            <!-- 原有状态栏内容 -->
            <template v-else-if="statusBarStore.status">
                {{ statusText }}
                <span v-if="statusBarStore.currentTask">: {{ statusBarStore.currentTask }}</span>
                <span v-if="statusBarStore.progress !== undefined">
                    ({{ statusBarStore.progress }}%)
                </span>
                <span v-if="statusBarStore.error">
                    [{{ t("notification.error") }}: {{ statusBarStore.error }}]
                </span>
            </template>

            <!-- processingFile 显示（非扫描状态） -->
            <template v-else-if="scanningPath && !isScanning">
                {{ scanningPath }}
            </template>

            <!-- 默认插槽 -->
            <template v-else>
                <slot> </slot>
            </template>
        </div>

        <!-- Buy Me a Coffee 按钮始终在最右侧 -->
        <div class="bmc-btn">
            <BuyMeCoffeeButton />
        </div>
    </div>
</template>
<style scoped>
.status-bar {
    display: flex;
    align-items: center;
    width: 100%;
    min-height: 32px;
    background: var(--color-bg-secondary, #f3f3f3);
    color: var(--color-statusbar-fg, var(--color-text));
    padding: 0 12px;
}

.status-content {
    flex: 1 1 0;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--color-statusbar-fg, var(--color-text));
}

.bmc-btn {
    flex: 0 0 auto;
    margin-left: 12px;
    align-items: center;
    justify-content: flex-end;
}

/* 扫描状态增强样式 */
.scanning-status {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
}

.scanning-icon {
    position: relative;
    width: 20px;
    height: 20px;
    flex-shrink: 0;

    .scan-pulse-ring {
        position: absolute;
        width: 100%;
        height: 100%;
        border: 1.5px solid var(--color-primary);
        border-radius: 50%;
        animation: scanPulse 1.5s ease-out infinite;
        opacity: 0.6;
    }

    .scan-spinner {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 12px;
        height: 12px;
        animation: scanRotate 2s linear infinite;

        .scan-segment {
            position: absolute;
            width: 2px;
            height: 4px;
            background: var(--color-primary);
            border-radius: 1px;
            transform-origin: 50% 6px;
            opacity: 0.3;
            animation: scanFade 1.2s ease-in-out infinite;

            &:nth-child(1) {
                transform: rotate(0deg);
                animation-delay: 0s;
            }
            &:nth-child(2) {
                transform: rotate(90deg);
                animation-delay: 0.3s;
            }
            &:nth-child(3) {
                transform: rotate(180deg);
                animation-delay: 0.6s;
            }
            &:nth-child(4) {
                transform: rotate(270deg);
                animation-delay: 0.9s;
            }
        }
    }
}

.scanning-text {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;

    .scanning-label {
        font-weight: 500;
        color: var(--color-primary);
        animation: labelPulse 2s ease-in-out infinite alternate;
    }

    .scanning-path {
        color: var(--color-text);
        font-family: monospace;
        font-size: 0.9em;
    }

    .scanning-progress {
        color: var(--color-primary);
        font-weight: 600;
        margin-left: 4px;
        animation: progressUpdate 0.3s ease;
    }
}

.data-flow-mini {
    position: relative;
    width: 40px;
    height: 16px;
    flex-shrink: 0;
    overflow: hidden;

    .data-dot {
        position: absolute;
        width: 3px;
        height: 3px;
        background: var(--color-primary);
        border-radius: 50%;
        opacity: 0.7;
    }

    .data-dot-1 {
        top: 2px;
        animation: dataFlowMini1 2s ease-in-out infinite;
    }

    .data-dot-2 {
        top: 7px;
        animation: dataFlowMini2 2s ease-in-out infinite;
        animation-delay: 0.7s;
    }

    .data-dot-3 {
        top: 12px;
        animation: dataFlowMini3 2s ease-in-out infinite;
        animation-delay: 1.4s;
    }
}

/* 扫描动画关键帧 */
@keyframes scanPulse {
    0% {
        transform: scale(1);
        opacity: 0.6;
    }
    50% {
        transform: scale(1.2);
        opacity: 0.3;
    }
    100% {
        transform: scale(1.4);
        opacity: 0;
    }
}

@keyframes scanRotate {
    from {
        transform: translate(-50%, -50%) rotate(0deg);
    }
    to {
        transform: translate(-50%, -50%) rotate(360deg);
    }
}

@keyframes scanFade {
    0%,
    39%,
    100% {
        opacity: 0.3;
    }
    40% {
        opacity: 1;
    }
}

@keyframes labelPulse {
    0% {
        opacity: 0.8;
    }
    100% {
        opacity: 1;
    }
}

@keyframes progressUpdate {
    0% {
        transform: scale(1);
    }
    50% {
        transform: scale(1.05);
    }
    100% {
        transform: scale(1);
    }
}

@keyframes dataFlowMini1 {
    0% {
        left: -3px;
        opacity: 0;
    }
    20% {
        opacity: 1;
    }
    80% {
        opacity: 0.7;
    }
    100% {
        left: 40px;
        opacity: 0;
    }
}

@keyframes dataFlowMini2 {
    0% {
        left: -3px;
        opacity: 0;
    }
    20% {
        opacity: 1;
    }
    80% {
        opacity: 0.7;
    }
    100% {
        left: 40px;
        opacity: 0;
    }
}

@keyframes dataFlowMini3 {
    0% {
        left: -3px;
        opacity: 0;
    }
    20% {
        opacity: 1;
    }
    80% {
        opacity: 0.7;
    }
    100% {
        left: 40px;
        opacity: 0;
    }
}
</style>

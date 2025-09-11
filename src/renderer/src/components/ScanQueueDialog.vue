<!-- Scan Queue Dialog Component -->
<template>
    <BaseModal
        :open="show"
        :title="t('scan.queueTitle')"
        size="custom"
        :style="{ '--modal-width': '680px' }"
        @close="$emit('close')"
    >
        <div class="scan-queue-container">
            <!-- Status Header -->
            <div class="queue-status-header">
                <div v-if="scanningFolder.length > 0" class="processing-status">
                    <div class="status-icon-wrapper">
                        <!-- 多层脉冲环增强效果 -->
                        <div class="pulse-ring pulse-ring-1"></div>
                        <div class="pulse-ring pulse-ring-2"></div>
                        <div class="pulse-ring pulse-ring-3"></div>

                        <!-- 导入数据流动画 -->
                        <div class="data-flow-container">
                            <div class="data-particle data-particle-1"></div>
                            <div class="data-particle data-particle-2"></div>
                            <div class="data-particle data-particle-3"></div>
                            <div class="data-particle data-particle-4"></div>
                        </div>

                        <div class="status-icon">
                            <div class="processing-spinner">
                                <div class="spinner-segment"></div>
                                <div class="spinner-segment"></div>
                                <div class="spinner-segment"></div>
                                <div class="spinner-segment"></div>
                                <div class="spinner-segment"></div>
                                <div class="spinner-segment"></div>
                            </div>
                        </div>
                    </div>
                    <div class="status-text">
                        <h4 class="processing-title">{{ t("scan.processing") }}</h4>
                        <p class="task-counter">
                            <span class="counter-number">{{ scanningFolder.length }}</span>
                            <span class="counter-label">
                                {{ t("import.moreFiles", { count: scanningFolder.length }) }}
                            </span>
                        </p>
                    </div>
                </div>
                <div v-else class="empty-status">
                    <div class="empty-icon">
                        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path
                                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                                stroke="currentColor"
                                stroke-width="2"
                                stroke-linecap="round"
                                stroke-linejoin="round"
                            />
                        </svg>
                    </div>
                    <div class="empty-text">
                        <h4>{{ t("scan.queueEmpty") }}</h4>
                        <p>{{ t("scan.allTasksCompleted") }}</p>
                    </div>
                </div>
            </div>

            <!-- Queue List -->
            <div class="queue-items" v-if="scanningFolder.length > 0">
                <div class="queue-header">
                    <span class="header-path">{{ t("scan.pathHeader") }}</span>
                    <span class="header-timestamp">{{ t("scan.timestampHeader") }}</span>
                    <span class="header-action">{{ t("scan.actionHeader") }}</span>
                </div>
                <div class="queue-list">
                    <div
                        v-for="(item, index) in scanningFolder"
                        :key="item.path"
                        class="queue-item"
                        :class="{
                            active: index === 0,
                            'next-in-queue': index === 1,
                            'in-queue': index > 1,
                        }"
                        :style="{ '--item-index': index }"
                    >
                        <div class="item-content">
                            <div class="item-icon">
                                <svg
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    xmlns="http://www.w3.org/2000/svg"
                                >
                                    <path
                                        d="M3 7V5C3 3.89543 3.89543 3 5 3H9.58579C9.851 3 10.1054 3.10536 10.2929 3.29289L12 5H19C20.1046 5 21 5.89543 21 7V7"
                                        :stroke="getItemColors(index).iconColor"
                                        stroke-width="2"
                                        stroke-linecap="round"
                                    />
                                    <path
                                        d="M3 7H21V18C21 19.1046 20.1046 20 19 20H5C3.89543 20 3 19.1046 3 18V7Z"
                                        :stroke="getItemColors(index).iconColor"
                                        stroke-width="2"
                                    />
                                </svg>
                            </div>
                            <div class="item-info">
                                <div class="item-path" :title="item.path">{{ item.path }}</div>
                                <div class="item-meta">
                                    <span
                                        class="path-name"
                                        :style="{ color: getItemColors(index).metaColor }"
                                    >
                                        {{ formatPathName(item.path) }}
                                    </span>
                                    <span v-if="index === 0 && item.progress" class="progress-info">
                                        • {{ t("scan.processed") }}:
                                        {{ item.progress.processed || 0 }}
                                        <span v-if="item.progress.total > 0">
                                            / {{ item.progress.total }}
                                        </span>
                                        <span
                                            class="cache-indicator"
                                            :title="t('scan.incrementalCache')"
                                        >
                                            🔄
                                        </span>
                                    </span>
                                </div>
                            </div>
                        </div>
                        <div class="item-timestamp" :title="formatFullTimestamp(item.createdAt)">
                            <div class="timestamp-relative">
                                {{ formatRelativeTime(item.createdAt) }}
                            </div>
                            <div class="timestamp-priority" v-if="item.priority !== undefined">
                                {{ t("scan.priority") }}: {{ item.priority }}
                            </div>
                        </div>
                        <div class="item-action">
                            <span class="action-badge" :class="getActionClass(item.action)">
                                {{ getActionText(item.action) }}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        <template #footer>
            <BaseButton variant="primary" @click="$emit('close')">
                {{ t("button.ok") }}
            </BaseButton>
        </template>
    </BaseModal>
</template>

<script setup lang="ts">
import { BaseModal, BaseButton } from "@renderer/components/ui";
import { useI18n } from "vue-i18n";

interface ScanAction {
    path: string;
    action: string;
    createdAt?: number;
    priority?: number;
    operationType?: string;
    progress?: {
        processed: number;
        total: number;
        cacheEnabled?: boolean;
    };
}

interface Props {
    show: boolean;
    scanningFolder: ScanAction[];
}

defineProps<Props>();

defineEmits<{
    close: [];
}>();

const { t } = useI18n();

// 计算属性：获取项目颜色
const getItemColors = (index: number) => {
    const getCSSValue = (variable: string, fallback: string): string => {
        return (
            getComputedStyle(document.documentElement).getPropertyValue(variable).trim() || fallback
        );
    };

    return {
        iconColor:
            index === 0
                ? getCSSValue("--color-primary", "#1890ff")
                : getCSSValue("--color-text-tertiary", "#999999"),
        textColor:
            index === 0
                ? getCSSValue("--color-primary", "#1890ff")
                : getCSSValue("--color-text", "#ffffff"),
        metaColor:
            index === 0
                ? getCSSValue("--color-primary", "#1890ff")
                : getCSSValue("--color-text-tertiary", "#999999"),
    };
};

// UI helper functions
function formatPathName(path: string): string {
    const parts = path.split("/");
    return parts[parts.length - 1] || parts[parts.length - 2] || t("scan.unknownFolder");
}

function getActionText(action: string): string {
    const actionMap: Record<string, string> = {
        scan: t("scan.actions.scan"),
        rescan: t("scan.actions.rescan"),
        current: t("scan.actions.current"),
    };
    return actionMap[action] || action;
}

function getActionClass(action: string): string {
    const classMap: Record<string, string> = {
        scan: "action-scan",
        rescan: "action-rescan",
        current: "action-current",
    };
    return classMap[action] || "action-default";
}

// 时间格式化函数
function formatRelativeTime(timestamp?: number): string {
    if (!timestamp) {
        return t("scan.noTimestamp");
    }

    const now = Date.now();
    const diff = now - timestamp;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (seconds < 60) {
        return t("scan.timeJustNow");
    } else if (minutes < 60) {
        return t("scan.timeMinutesAgo", { count: minutes });
    } else if (hours < 24) {
        return t("scan.timeHoursAgo", { count: hours });
    } else {
        return t("scan.timeDaysAgo", { count: days });
    }
}

function formatFullTimestamp(timestamp?: number): string {
    if (!timestamp) {
        return t("scan.noTimestamp");
    }

    const date = new Date(timestamp);
    return date.toLocaleString();
}
</script>

<style scoped lang="less">
/* Modern Scan Queue Dialog Styles */
.scan-queue-container {
    min-height: 300px;
    max-height: 500px;
}

.queue-status-header {
    padding: 24px 0;
    text-align: center;
    border-bottom: 1px solid var(--color-border);
    margin-bottom: 24px;
}

.processing-status {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;

    .status-icon-wrapper {
        position: relative;
        width: 64px;
        height: 64px;

        .pulse-ring {
            position: absolute;
            width: 100%;
            height: 100%;
            border: 2px solid var(--color-primary);
            border-radius: 50%;
            opacity: 0.6;
        }

        .pulse-ring-1 {
            animation: pulse 2s ease-out infinite;
        }

        .pulse-ring-2 {
            animation: pulse 2s ease-out infinite;
            animation-delay: 0.4s;
            opacity: 0.4;
        }

        .pulse-ring-3 {
            animation: pulse 2s ease-out infinite;
            animation-delay: 0.8s;
            opacity: 0.3;
        }

        /* 数据流粒子容器 */
        .data-flow-container {
            position: absolute;
            width: 120px;
            height: 120px;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            pointer-events: none;
        }

        .data-particle {
            position: absolute;
            width: 4px;
            height: 4px;
            background: var(--color-primary);
            border-radius: 50%;
            opacity: 0.8;
        }

        .data-particle-1 {
            top: 10px;
            left: 50%;
            animation: dataFlow1 3s ease-in-out infinite;
        }

        .data-particle-2 {
            top: 50%;
            right: 10px;
            animation: dataFlow2 3s ease-in-out infinite;
            animation-delay: 0.75s;
        }

        .data-particle-3 {
            bottom: 10px;
            left: 50%;
            animation: dataFlow3 3s ease-in-out infinite;
            animation-delay: 1.5s;
        }

        .data-particle-4 {
            top: 50%;
            left: 10px;
            animation: dataFlow4 3s ease-in-out infinite;
            animation-delay: 2.25s;
        }

        .status-icon {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 32px;
            height: 32px;
            display: flex;
            align-items: center;
            justify-content: center;

            .processing-spinner {
                width: 24px;
                height: 24px;
                position: relative;
                animation: rotate 2s linear infinite;

                .spinner-segment {
                    position: absolute;
                    width: 3px;
                    height: 8px;
                    background: var(--color-primary);
                    border-radius: 2px;
                    transform-origin: 50% 12px;
                    opacity: 0.3;
                    animation: fade 1.2s ease-in-out infinite;

                    &:nth-child(1) {
                        transform: rotate(0deg);
                        animation-delay: 0s;
                    }
                    &:nth-child(2) {
                        transform: rotate(60deg);
                        animation-delay: 0.1s;
                    }
                    &:nth-child(3) {
                        transform: rotate(120deg);
                        animation-delay: 0.2s;
                    }
                    &:nth-child(4) {
                        transform: rotate(180deg);
                        animation-delay: 0.3s;
                    }
                    &:nth-child(5) {
                        transform: rotate(240deg);
                        animation-delay: 0.4s;
                    }
                    &:nth-child(6) {
                        transform: rotate(300deg);
                        animation-delay: 0.5s;
                    }
                }
            }
        }
    }

    .status-text {
        .processing-title {
            margin: 0;
            font-size: 18px;
            font-weight: 600;
            color: var(--color-text);
            margin-bottom: 4px;
            animation: titlePulse 2s ease-in-out infinite alternate;
        }

        .task-counter {
            margin: 0;
            font-size: 14px;
            color: var(--color-text-secondary);

            .counter-number {
                font-weight: 600;
                color: var(--color-primary);
                transition: all 0.3s ease;
                animation: countUpdate 0.5s ease;
            }

            .counter-label {
                opacity: 0.8;
            }
        }
    }
}

.empty-status {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;

    .empty-icon {
        width: 64px;
        height: 64px;
        background: var(--color-success, #52c41a);
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;

        svg {
            width: 32px;
            height: 32px;
        }
    }

    .empty-text {
        h4 {
            margin: 0;
            font-size: 18px;
            font-weight: 600;
            color: var(--color-text);
            margin-bottom: 4px;
        }

        p {
            margin: 0;
            font-size: 14px;
            color: var(--color-text-secondary);
        }
    }
}

.queue-items {
    .queue-header {
        display: flex;
        align-items: center;
        padding: 0 20px 16px 20px;
        border-bottom: 1px solid var(--color-border);
        margin-bottom: 28px;

        .header-path,
        .header-timestamp,
        .header-action {
            font-size: 12px;
            font-weight: 600;
            color: var(--color-text-secondary);
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        .header-path {
            flex: 1;
            min-width: 0;
        }

        .header-timestamp {
            width: 120px;
            text-align: center;
            margin-left: 16px;
        }

        .header-action {
            width: 80px;
            text-align: right;
            margin-left: 16px;
        }
    }

    .queue-list {
        max-height: 280px;
        overflow-y: auto;
        overflow-x: hidden;
        padding: 8px 4px;

        /* Custom scrollbar - 使用主题变量 */
        scrollbar-width: thin;
        scrollbar-color: var(--color-scrollbar-thumb) var(--color-scrollbar-track);

        &::-webkit-scrollbar {
            width: var(--color-scrollbar-width-thin);
        }

        &::-webkit-scrollbar-track {
            background: var(--color-scrollbar-track);
            border-radius: var(--color-scrollbar-border-radius);
        }

        &::-webkit-scrollbar-track:hover {
            background: var(--color-scrollbar-track-hover);
        }

        &::-webkit-scrollbar-thumb {
            background: var(--color-scrollbar-thumb);
            border-radius: var(--color-scrollbar-border-radius);
            transition: all 0.2s ease;

            &:hover {
                background: var(--color-scrollbar-thumb-hover);
            }

            &:active {
                background: var(--color-scrollbar-thumb-active);
            }
        }
    }

    .queue-item {
        display: flex;
        align-items: center;
        padding: 16px 20px;
        margin-bottom: 12px;
        background: var(--color-fill-quaternary, rgba(0, 0, 0, 0.02));
        border: 1px solid transparent;
        border-radius: 12px;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        cursor: default;

        /* 确保第一个项目有足够的顶部间距 */
        &:first-child {
            margin-top: 4px;
        }

        &:hover {
            background: var(--color-fill-tertiary, rgba(0, 0, 0, 0.04));
            border-color: var(--color-primary-bg);
            transform: translateY(-1px);
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
        }

        &.active {
            background: var(--color-primary-bg);
            border-color: var(--color-primary);
            transform: translateY(-1px);
            box-shadow: 0 4px 16px rgba(24, 144, 255, 0.15);
            animation: activeProcessing 2s ease-in-out infinite;

            .item-icon {
                animation: iconPulse 1.5s ease-in-out infinite;
            }

            .item-path {
                color: var(--color-primary);
                font-weight: 500;
            }

            /* 处理进度条 */
            &::before {
                content: "";
                position: absolute;
                bottom: 0;
                left: 0;
                height: 3px;
                background: linear-gradient(
                    90deg,
                    var(--color-primary),
                    var(--color-primary-light)
                );
                animation: progressBar 3s ease-in-out infinite;
                border-radius: 0 0 12px 12px;
            }
        }

        &.next-in-queue {
            animation: nextInQueue 1s ease-in-out;
            border-color: var(--color-primary-border);

            .item-icon {
                animation: iconReady 2s ease-in-out infinite;
            }
        }

        &.in-queue {
            animation: fadeInItem 0.8s ease calc(var(--item-index) * 0.1s);
        }

        .item-content {
            display: flex;
            align-items: center;
            gap: 16px;
            flex: 1;
            min-width: 0;

            .item-icon {
                width: 20px;
                height: 20px;
                flex-shrink: 0;
                transition: all 0.2s ease;

                svg {
                    width: 100%;
                    height: 100%;
                }
            }

            .item-info {
                flex: 1;
                min-width: 0;

                .item-path {
                    font-size: 14px;
                    font-weight: 500;
                    color: var(--color-text);
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                    margin-bottom: 4px;
                    transition: color 0.2s ease;
                }

                .item-meta {
                    font-size: 12px;
                    color: var(--color-text-tertiary);
                    font-weight: 400;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    flex-wrap: wrap;
                }

                .progress-info {
                    color: var(--color-primary);
                    font-weight: 500;
                    opacity: 1;
                    display: flex;
                    align-items: center;
                    gap: 4px;
                    font-size: 11px;
                }

                .cache-indicator {
                    font-size: 12px;
                    animation: spin 2s linear infinite;
                    cursor: help;
                }

                @keyframes spin {
                    from {
                        transform: rotate(0deg);
                    }
                    to {
                        transform: rotate(360deg);
                    }
                }
            }
        }

        .item-timestamp {
            width: 120px;
            margin-left: 16px;
            flex-shrink: 0;
            text-align: center;

            .timestamp-relative {
                font-size: 12px;
                font-weight: 500;
                color: var(--color-text-secondary);
                margin-bottom: 2px;
            }

            .timestamp-priority {
                font-size: 10px;
                color: var(--color-text-tertiary);
                opacity: 0.8;
            }
        }

        .item-action {
            flex-shrink: 0;
            margin-left: 16px;
            width: 80px;
            display: flex;
            justify-content: flex-end;

            .action-badge {
                display: inline-flex;
                align-items: center;
                padding: 6px 12px;
                border-radius: 16px;
                font-size: 11px;
                font-weight: 600;
                text-transform: uppercase;
                letter-spacing: 0.5px;
                transition: all 0.2s ease;

                &.action-scan {
                    background: var(--color-success-bg, #f6ffed);
                    color: var(--color-success, #52c41a);
                }

                &.action-rescan {
                    background: var(--color-warning-bg, #fff7e6);
                    color: var(--color-warning, #fa8c16);
                }

                &.action-current {
                    background: var(--color-success-bg, #f6ffed);
                    color: var(--color-success, #52c41a);
                }

                &.action-default {
                    background: var(--color-fill-secondary);
                    color: var(--color-text-secondary);
                }
            }
        }
    }
}

@keyframes pulse {
    0% {
        transform: scale(1);
        opacity: 0.6;
    }
    50% {
        transform: scale(1.1);
        opacity: 0.3;
    }
    100% {
        transform: scale(1.2);
        opacity: 0;
    }
}

@keyframes rotate {
    from {
        transform: rotate(0deg);
    }
    to {
        transform: rotate(360deg);
    }
}

@keyframes fade {
    0%,
    39%,
    100% {
        opacity: 0.3;
    }
    40% {
        opacity: 1;
    }
}

/* 数据流粒子动画 */
@keyframes dataFlow1 {
    0% {
        transform: translate(-50%, 0) scale(0);
        opacity: 0;
    }
    10% {
        transform: translate(-50%, 0) scale(1);
        opacity: 1;
    }
    50% {
        transform: translate(-50%, 20px) scale(1);
        opacity: 0.8;
    }
    90% {
        transform: translate(-50%, 40px) scale(0.5);
        opacity: 0.3;
    }
    100% {
        transform: translate(-50%, 50px) scale(0);
        opacity: 0;
    }
}

@keyframes dataFlow2 {
    0% {
        transform: translate(0, -50%) scale(0);
        opacity: 0;
    }
    10% {
        transform: translate(0, -50%) scale(1);
        opacity: 1;
    }
    50% {
        transform: translate(-20px, -50%) scale(1);
        opacity: 0.8;
    }
    90% {
        transform: translate(-40px, -50%) scale(0.5);
        opacity: 0.3;
    }
    100% {
        transform: translate(-50px, -50%) scale(0);
        opacity: 0;
    }
}

@keyframes dataFlow3 {
    0% {
        transform: translate(-50%, 0) scale(0);
        opacity: 0;
    }
    10% {
        transform: translate(-50%, 0) scale(1);
        opacity: 1;
    }
    50% {
        transform: translate(-50%, -20px) scale(1);
        opacity: 0.8;
    }
    90% {
        transform: translate(-50%, -40px) scale(0.5);
        opacity: 0.3;
    }
    100% {
        transform: translate(-50%, -50px) scale(0);
        opacity: 0;
    }
}

@keyframes dataFlow4 {
    0% {
        transform: translate(0, -50%) scale(0);
        opacity: 0;
    }
    10% {
        transform: translate(0, -50%) scale(1);
        opacity: 1;
    }
    50% {
        transform: translate(20px, -50%) scale(1);
        opacity: 0.8;
    }
    90% {
        transform: translate(40px, -50%) scale(0.5);
        opacity: 0.3;
    }
    100% {
        transform: translate(50px, -50%) scale(0);
        opacity: 0;
    }
}

/* 标题脉冲动画 */
@keyframes titlePulse {
    0% {
        opacity: 0.9;
    }
    100% {
        opacity: 1;
    }
}

/* 计数更新动画 */
@keyframes countUpdate {
    0% {
        transform: scale(1);
    }
    50% {
        transform: scale(1.1);
    }
    100% {
        transform: scale(1);
    }
}

/* 活跃处理项动画 */
@keyframes activeProcessing {
    0% {
        box-shadow: 0 4px 16px rgba(24, 144, 255, 0.15);
    }
    50% {
        box-shadow: 0 6px 20px rgba(24, 144, 255, 0.25);
    }
    100% {
        box-shadow: 0 4px 16px rgba(24, 144, 255, 0.15);
    }
}

/* 图标脉冲动画 */
@keyframes iconPulse {
    0% {
        transform: scale(1);
        opacity: 1;
    }
    50% {
        transform: scale(1.1);
        opacity: 0.8;
    }
    100% {
        transform: scale(1);
        opacity: 1;
    }
}

/* 进度条动画 */
@keyframes progressBar {
    0% {
        width: 0%;
        opacity: 1;
    }
    50% {
        width: 70%;
        opacity: 0.8;
    }
    100% {
        width: 100%;
        opacity: 0.6;
    }
}

/* 下一个队列项动画 */
@keyframes nextInQueue {
    0% {
        transform: translateX(0);
        background: var(--color-fill-quaternary, rgba(0, 0, 0, 0.02));
    }
    50% {
        transform: translateX(-2px);
        background: var(--color-primary-bg-light, rgba(24, 144, 255, 0.05));
    }
    100% {
        transform: translateX(0);
        background: var(--color-fill-quaternary, rgba(0, 0, 0, 0.02));
    }
}

/* 图标准备动画 */
@keyframes iconReady {
    0%,
    100% {
        transform: scale(1);
    }
    50% {
        transform: scale(1.05);
    }
}

/* 项目淡入动画 */
@keyframes fadeInItem {
    0% {
        opacity: 0;
        transform: translateY(10px);
    }
    100% {
        opacity: 1;
        transform: translateY(0);
    }
}

/* Dark theme support */
@media (prefers-color-scheme: dark) {
    .scan-queue-container {
        .queue-item {
            &:hover {
                box-shadow: 0 4px 12px rgba(255, 255, 255, 0.08);
            }

            &.active {
                box-shadow: 0 4px 16px rgba(64, 169, 255, 0.2);
            }
        }
    }
}

/* Responsive design */
@media (max-width: 768px) {
    .queue-items {
        .queue-header {
            .header-timestamp {
                width: 80px;
                font-size: 10px;
            }

            .header-action {
                width: 60px;
            }
        }

        .queue-item {
            padding: 12px 16px;

            .item-content {
                gap: 12px;

                .item-icon {
                    width: 18px;
                    height: 18px;
                }
            }

            .item-timestamp {
                width: 80px;
                margin-left: 8px;

                .timestamp-relative {
                    font-size: 10px;
                }

                .timestamp-priority {
                    font-size: 9px;
                }
            }

            .item-action {
                margin-left: 8px;
                width: 60px;

                .action-badge {
                    padding: 4px 8px;
                    font-size: 10px;
                }
            }
        }
    }
}
</style>

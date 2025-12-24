<template>
    <div class="progress-monitor">
        <!-- 进度头部 -->
        <div class="progress-header">
            <h3>{{ t("import.progress") }}</h3>
            <div class="progress-status">
                <BaseBadge :variant="statusBadgeType" :text="statusText" />
            </div>
        </div>

        <!-- 主进度条 -->
        <div class="main-progress">
            <BaseProgress
                :percent="progressPercentage"
                :status="progressStatus"
                :stroke-color="progressColor"
                :show-info="false"
            />
            <div class="progress-text">
                <span class="progress-percentage">{{ progressPercentage.toFixed(1) }}%</span>
                <span class="progress-files">
                    {{ progress.processedFiles }} / {{ progress.totalFiles }}
                    {{ t("import.files") }}
                </span>
            </div>
        </div>

        <!-- 详细统计 -->
        <div class="progress-stats">
            <BaseRow :gutter="16">
                <BaseCol :span="6">
                    <div class="statistic-item">
                        <div class="statistic-title">{{ t("import.speed") }}</div>
                        <div class="statistic-value" style="font-size: 16px">
                            <ThunderboltOutlined class="statistic-icon" />
                            {{ formatSpeed(progress.speed) }}
                        </div>
                    </div>
                </BaseCol>
                <BaseCol :span="6">
                    <div class="statistic-item">
                        <div class="statistic-title">{{ t("import.remaining") }}</div>
                        <div class="statistic-value" style="font-size: 16px">
                            <ClockCircleOutlined class="statistic-icon" />
                            {{ formatTime(progress.estimatedTimeRemaining) }}
                        </div>
                    </div>
                </BaseCol>
                <BaseCol :span="6">
                    <div class="statistic-item">
                        <div class="statistic-title">{{ t("import.elapsed") }}</div>
                        <div class="statistic-value" style="font-size: 16px">
                            <HistoryOutlined class="statistic-icon" />
                            {{ formatTime(elapsedTime) }}
                        </div>
                    </div>
                </BaseCol>
                <BaseCol :span="6">
                    <div class="statistic-item">
                        <div class="statistic-title">{{ t("import.eta") }}</div>
                        <div class="statistic-value" style="font-size: 16px">
                            <CalendarOutlined class="statistic-icon" />
                            {{ formatETA(progress.estimatedTimeRemaining) }}
                        </div>
                    </div>
                </BaseCol>
            </BaseRow>
        </div>

        <!-- 当前处理文件 -->
        <div v-if="progress.currentFile" class="current-file">
            <div class="current-file-label">
                <FileOutlined />
                {{ t("import.processing") }}:
            </div>
            <div class="current-file-path">
                <BaseTooltip :title="progress.currentFile">
                    <span>{{ getFileName(progress.currentFile) }}</span>
                </BaseTooltip>
            </div>
        </div>

        <!-- 错误和警告 -->
        <div v-if="hasIssues" class="issues-section">
            <!-- 错误列表 -->
            <div v-if="progress.errors.length > 0" class="error-section">
                <div class="collapse-section">
                    <div class="collapse-header">
                        <span class="collapse-title">{{ errorHeader }}</span>
                        <BaseBadge :count="progress.errors.length" variant="danger" />
                    </div>
                    <div class="collapse-content">
                        <div class="issue-list">
                            <div
                                v-for="(error, index) in visibleErrors"
                                :key="index"
                                class="issue-item error-item"
                            >
                                <div class="issue-icon">
                                    <ExclamationCircleOutlined />
                                </div>
                                <div class="issue-content">
                                    <div class="issue-file">{{ getFileName(error.file) }}</div>
                                    <div class="issue-message">{{ error.error }}</div>
                                    <div v-if="error.recoverable" class="issue-actions">
                                        <BaseButton
                                            size="sm"
                                            type="link"
                                            @click="retryFile(error.file)"
                                        >
                                            {{ t("import.retry") }}
                                        </BaseButton>
                                    </div>
                                </div>
                            </div>
                            <div
                                v-if="progress.errors.length > maxVisibleIssues"
                                class="more-issues"
                            >
                                <BaseButton
                                    type="link"
                                    size="sm"
                                    @click="showAllErrors = !showAllErrors"
                                >
                                    {{
                                        showAllErrors
                                            ? t("import.showLess")
                                            : t("import.showMore", {
                                                  count: progress.errors.length - maxVisibleIssues,
                                              })
                                    }}
                                </BaseButton>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- 警告列表 -->
            <div v-if="progress.warnings.length > 0" class="warning-section">
                <div class="collapse-section">
                    <div class="collapse-header">
                        <span class="collapse-title">{{ warningHeader }}</span>
                        <BaseBadge :count="progress.warnings.length" variant="warning" />
                    </div>
                    <div class="collapse-content">
                        <div class="issue-list">
                            <div
                                v-for="(warning, index) in visibleWarnings"
                                :key="index"
                                class="issue-item warning-item"
                            >
                                <div class="issue-icon">
                                    <WarningOutlined />
                                </div>
                                <div class="issue-content">
                                    <div class="issue-file">{{ getFileName(warning.file) }}</div>
                                    <div class="issue-message">{{ warning.message }}</div>
                                </div>
                            </div>
                            <div
                                v-if="progress.warnings.length > maxVisibleIssues"
                                class="more-issues"
                            >
                                <BaseButton
                                    type="link"
                                    size="sm"
                                    @click="showAllWarnings = !showAllWarnings"
                                >
                                    {{
                                        showAllWarnings
                                            ? t("import.showLess")
                                            : t("import.showMore", {
                                                  count:
                                                      progress.warnings.length - maxVisibleIssues,
                                              })
                                    }}
                                </BaseButton>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- 控制按钮 -->
        <div class="progress-controls">
            <BaseSpace>
                <BaseButton
                    v-if="progress.status === 'processing'"
                    type="default"
                    @click="$emit('pause')"
                >
                    <template #icon><PauseOutlined /></template>
                    {{ t("import.pauseButton") }}
                </BaseButton>
                <BaseButton
                    v-if="progress.status === 'paused'"
                    type="primary"
                    @click="$emit('resume')"
                >
                    <template #icon><PlayCircleOutlined /></template>
                    {{ t("import.resumeButton") }}
                </BaseButton>
                <BaseButton
                    v-if="canCancel && ['processing', 'paused'].includes(progress.status)"
                    danger
                    @click="confirmCancel"
                >
                    <template #icon><StopOutlined /></template>
                    {{ t("import.cancelButton") }}
                </BaseButton>
                <BaseButton
                    v-if="progress.status === 'completed'"
                    type="primary"
                    @click="$emit('close')"
                >
                    <template #icon><CheckOutlined /></template>
                    {{ t("import.closeButton") }}
                </BaseButton>
            </BaseSpace>
        </div>

        <!-- 取消确认对话框 -->
        <BaseModal
            v-model:open="showCancelConfirm"
            :title="t('import.confirmCancel')"
            :ok-text="t('import.yes')"
            :cancel-text="t('import.no')"
            @ok="handleCancel"
        >
            <p>{{ t("import.cancelWarning") }}</p>
            <p v-if="progress.processedFiles > 0">
                {{
                    t("import.cancelProgress", {
                        processed: progress.processedFiles,
                        total: progress.totalFiles,
                    })
                }}
            </p>
        </BaseModal>
    </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from "vue";
import { useI18n } from "vue-i18n";
import {
    PhLightning as ThunderboltOutlined,
    PhClock as ClockCircleOutlined,
    PhClock as HistoryOutlined,
    PhCalendar as CalendarOutlined,
    PhFileText as FileOutlined,
    PhWarning as ExclamationCircleOutlined,
    PhWarning as WarningOutlined,
    PhPause as PauseOutlined,
    PhPlay as PlayCircleOutlined,
    PhStop as StopOutlined,
    PhCheck as CheckOutlined,
} from "@phosphor-icons/vue";
import type { ImportProgress } from "@common/import-types";
import {
    BaseButton,
    BaseBadge,
    BaseProgress,
    BaseRow,
    BaseCol,
    BaseTooltip,
    BaseSpace,
    BaseModal,
} from "@renderer/components/ui";

// Props
const props = withDefaults(
    defineProps<{
        progress: ImportProgress;
        canCancel?: boolean;
        startTime?: Date;
    }>(),
    {
        canCancel: true,
    },
);

// Emits
const emit = defineEmits<{
    (e: "pause"): void;
    (e: "resume"): void;
    (e: "cancel"): void;
    (e: "retry", file: string): void;
    (e: "close"): void;
}>();

const { t } = useI18n();

// 响应式状态
const showAllErrors = ref(false);
const showAllWarnings = ref(false);
const showCancelConfirm = ref(false);
const elapsedTime = ref(0);
const maxVisibleIssues = 5;

// 定时器
let elapsedTimer: NodeJS.Timeout | null = null;

// 计算属性
const progressPercentage = computed(() => {
    if (props.progress.totalFiles === 0) return 0;
    return Math.min((props.progress.processedFiles / props.progress.totalFiles) * 100, 100);
});

const progressStatus = computed(() => {
    switch (props.progress.status) {
        case "error":
            return "exception";
        case "completed":
            return "success";
        case "paused":
            return "normal";
        default:
            return "active";
    }
});

const progressColor = computed(() => {
    switch (props.progress.status) {
        case "error":
            return "#ff4d4f";
        case "completed":
            return "#52c41a";
        case "paused":
            return "#faad14";
        default:
            return "#1890ff";
    }
});

const statusText = computed(() => {
    switch (props.progress.status) {
        case "preparing":
            return t("import.status.preparing");
        case "processing":
            return t("import.status.processing");
        case "paused":
            return t("import.status.paused");
        case "completed":
            return t("import.status.completed");
        case "cancelled":
            return t("import.status.cancelled");
        case "error":
            return t("import.status.error");
        default:
            return t("import.status.unknown");
    }
});

const statusBadgeType = computed(() => {
    switch (props.progress.status) {
        case "processing":
            return "primary";
        case "completed":
            return "success";
        case "error":
            return "danger";
        case "paused":
            return "warning";
        default:
            return "secondary";
    }
});

const hasIssues = computed(() => {
    return props.progress.errors.length > 0 || props.progress.warnings.length > 0;
});

const visibleErrors = computed(() => {
    return showAllErrors.value
        ? props.progress.errors
        : props.progress.errors.slice(0, maxVisibleIssues);
});

const visibleWarnings = computed(() => {
    return showAllWarnings.value
        ? props.progress.warnings
        : props.progress.warnings.slice(0, maxVisibleIssues);
});

const errorHeader = computed(() => {
    return t("import.errors", { count: props.progress.errors.length });
});

const warningHeader = computed(() => {
    return t("import.warnings", { count: props.progress.warnings.length });
});

// 方法
const formatSpeed = (speed: number): string => {
    if (speed < 1) return `${(speed * 60).toFixed(1)} files/min`;
    return `${speed.toFixed(1)} files/sec`;
};

const formatTime = (seconds: number): string => {
    if (seconds < 60) return `${Math.ceil(seconds)}s`;
    if (seconds < 3600) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.ceil(seconds % 60);
        return `${mins}m ${secs}s`;
    }
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${mins}m`;
};

const formatETA = (remainingSeconds: number): string => {
    if (remainingSeconds <= 0) return t("import.now");

    const eta = new Date(Date.now() + remainingSeconds * 1000);
    return eta.toLocaleTimeString(undefined, {
        hour: "2-digit",
        minute: "2-digit",
    });
};

const getFileName = (filePath: string): string => {
    if (!filePath) return "";
    const parts = filePath.split(/[/\\]/);
    return parts[parts.length - 1];
};

const confirmCancel = () => {
    showCancelConfirm.value = true;
};

const handleCancel = () => {
    showCancelConfirm.value = false;
    emit("cancel");
};

const retryFile = (file: string) => {
    emit("retry", file);
};

// 生命周期
onMounted(() => {
    if (props.startTime) {
        elapsedTimer = setInterval(() => {
            elapsedTime.value = Math.floor(
                (Date.now() - (props.startTime?.getTime() || Date.now())) / 1000,
            );
        }, 1000);
    }
});

onUnmounted(() => {
    if (elapsedTimer) {
        clearInterval(elapsedTimer);
    }
});
</script>

<style scoped lang="less">
.progress-monitor {
    .progress-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 16px;

        h3 {
            margin: 0;
            font-size: 16px;
            font-weight: 600;
            color: var(--text-color);
        }
    }

    .main-progress {
        margin-bottom: 24px;

        .progress-text {
            display: flex;
            justify-content: space-between;
            align-items: center;

            .progress-percentage {
                font-size: 18px;
                font-weight: 600;
                color: var(--primary-color);
            }

            .progress-files {
                color: var(--text-color);
                opacity: 0.7;
                font-size: 14px;
            }
        }
    }

    .progress-stats {
        margin-bottom: 24px;
        padding: 16px;
        background-color: var(--hover-color);
        border-radius: 6px;
    }

    .current-file {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 16px;
        padding: 12px;
        background-color: var(--success-color);
        opacity: 0.1;
        border: 1px solid var(--success-color);
        border-radius: 6px;

        .current-file-label {
            display: flex;
            align-items: center;
            gap: 4px;
            font-weight: 500;
            color: var(--success-color);
            white-space: nowrap;
        }

        .current-file-path {
            flex: 1;
            overflow: hidden;

            span {
                display: block;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
                color: var(--text-color);
                opacity: 0.7;
            }
        }
    }

    .issues-section {
        margin-bottom: 24px;

        .error-section,
        .warning-section {
            margin-bottom: 12px;

            &:last-child {
                margin-bottom: 0;
            }
        }

        .issue-list {
            .issue-item {
                display: flex;
                align-items: flex-start;
                gap: 8px;
                padding: 8px 0;
                border-bottom: 1px solid var(--border-color);

                &:last-child {
                    border-bottom: none;
                }

                .issue-icon {
                    margin-top: 2px;
                    font-size: 16px;
                }

                .issue-content {
                    flex: 1;

                    .issue-file {
                        font-weight: 500;
                        margin-bottom: 4px;
                        color: var(--text-color);
                    }

                    .issue-message {
                        color: var(--text-color);
                        opacity: 0.7;
                        font-size: 14px;
                        margin-bottom: 4px;
                    }

                    .issue-actions {
                        margin-top: 4px;
                    }
                }
            }

            .error-item .issue-icon {
                color: var(--error-color);
            }

            .warning-item .issue-icon {
                color: var(--warning-color);
            }

            .more-issues {
                text-align: center;
                padding-top: 8px;
            }
        }
    }

    .progress-controls {
        text-align: right;
        padding-top: 16px;
        border-top: 1px solid var(--border-color);
    }

    .statistic-item {
        text-align: center;
    }

    .statistic-title {
        font-size: 12px;
        color: var(--color-text-secondary);
        margin-bottom: 4px;
    }

    .statistic-value {
        font-size: 16px;
        font-weight: 600;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 4px;
    }

    .statistic-icon {
        font-size: 14px;
    }

    .collapse-section {
        border: 1px solid var(--color-border);
        border-radius: 6px;
        margin-bottom: 16px;
    }

    .collapse-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 12px 16px;
        background: var(--color-bg-secondary);
        border-bottom: 1px solid var(--color-border);
        cursor: pointer;
    }

    .collapse-title {
        font-weight: 500;
    }

    .collapse-content {
        padding: 16px;
    }
}
</style>

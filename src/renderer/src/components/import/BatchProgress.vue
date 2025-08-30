<template>
    <div class="batch-progress">
        <!-- 整体进度头部 -->
        <div class="batch-header">
            <h3>{{ t("import.batchProgress") }}</h3>
            <div class="batch-stats">
                <a-tag color="blue">
                    {{ batchProgress.completedDirectories }} / {{ batchProgress.totalDirectories }}
                    {{ t("import.directories") }}
                </a-tag>
                <a-tag :color="getOverallStatusColor()">
                    {{ Math.round(batchProgress.overallProgress) }}% {{ t("import.complete") }}
                </a-tag>
            </div>
        </div>

        <!-- 整体进度条 -->
        <div class="overall-progress">
            <div class="progress-label">
                <span>{{ t("import.overallProgress") }}</span>
                <span class="progress-text">{{ Math.round(batchProgress.overallProgress) }}%</span>
            </div>
            <a-progress
                :percent="batchProgress.overallProgress"
                :status="getOverallProgressStatus()"
                :stroke-color="getProgressColor(batchProgress.overallProgress)"
                :show-info="false"
            />
        </div>

        <!-- 当前处理目录 -->
        <div v-if="batchProgress.currentDirectory" class="current-directory">
            <div class="current-label">
                <FolderOutlined />
                {{ t("import.currentDirectory") }}:
            </div>
            <div class="current-path">
                <a-tooltip :title="batchProgress.currentDirectory">
                    {{ getDirectoryName(batchProgress.currentDirectory) }}
                </a-tooltip>
            </div>
        </div>

        <!-- 目录进度列表 -->
        <div class="directory-list">
            <a-collapse v-model:activeKey="activeDirectories" ghost>
                <a-collapse-panel
                    v-for="directory in directoryProgresses"
                    :key="directory.path"
                    :header="getDirectoryHeader(directory)"
                >
                    <template #extra>
                        <div class="directory-extra" @click.stop>
                            <a-progress
                                type="circle"
                                :width="24"
                                :percent="getDirectoryProgress(directory)"
                                :status="getDirectoryStatus(directory)"
                                :show-info="false"
                            />
                            <div class="directory-actions">
                                <a-button
                                    v-if="directory.status === 'processing'"
                                    type="text"
                                    size="small"
                                    @click="pauseDirectory(directory.path)"
                                >
                                    <template #icon><PauseOutlined /></template>
                                </a-button>
                                <a-button
                                    v-if="directory.status === 'paused'"
                                    type="text"
                                    size="small"
                                    @click="resumeDirectory(directory.path)"
                                >
                                    <template #icon><PlayCircleOutlined /></template>
                                </a-button>
                                <a-button
                                    v-if="
                                        directory.canCancel &&
                                        ['processing', 'paused'].includes(directory.status)
                                    "
                                    type="text"
                                    size="small"
                                    danger
                                    @click="cancelDirectory(directory.path)"
                                >
                                    <template #icon><StopOutlined /></template>
                                </a-button>
                            </div>
                        </div>
                    </template>

                    <!-- 目录详细进度 -->
                    <div class="directory-details">
                        <!-- 进度统计 -->
                        <div class="directory-stats">
                            <a-row :gutter="16">
                                <a-col :span="6">
                                    <a-statistic
                                        :title="t('import.processed')"
                                        :value="`${directory.processedFiles} / ${directory.totalFiles}`"
                                        :value-style="{ fontSize: '14px' }"
                                    />
                                </a-col>
                                <a-col :span="6">
                                    <a-statistic
                                        :title="t('import.progress')"
                                        :value="`${getDirectoryProgress(directory)}%`"
                                        :value-style="{ fontSize: '14px' }"
                                    />
                                </a-col>
                                <a-col :span="6">
                                    <a-statistic
                                        :title="t('import.status')"
                                        :value="t(`import.status.${directory.status}`)"
                                        :value-style="{
                                            fontSize: '14px',
                                            color: getStatusColor(directory.status),
                                        }"
                                    />
                                </a-col>
                                <a-col :span="6">
                                    <a-statistic
                                        :title="t('import.eta')"
                                        :value="getDirectoryETA(directory)"
                                        :value-style="{ fontSize: '14px' }"
                                    />
                                </a-col>
                            </a-row>
                        </div>

                        <!-- 详细进度条 -->
                        <div class="directory-progress-bar">
                            <a-progress
                                :percent="getDirectoryProgress(directory)"
                                :status="getDirectoryStatus(directory)"
                                :stroke-color="getProgressColor(getDirectoryProgress(directory))"
                            />
                        </div>

                        <!-- 错误和警告 -->
                        <div v-if="hasDirectoryIssues(directory)" class="directory-issues">
                            <a-alert
                                v-if="getDirectoryErrors(directory).length > 0"
                                type="error"
                                :message="
                                    t('import.errors', {
                                        count: getDirectoryErrors(directory).length,
                                    })
                                "
                                :description="getDirectoryErrors(directory).slice(0, 3).join('; ')"
                                show-icon
                                closable
                            />
                            <a-alert
                                v-if="getDirectoryWarnings(directory).length > 0"
                                type="warning"
                                :message="
                                    t('import.warnings', {
                                        count: getDirectoryWarnings(directory).length,
                                    })
                                "
                                :description="
                                    getDirectoryWarnings(directory).slice(0, 3).join('; ')
                                "
                                show-icon
                                closable
                            />
                        </div>

                        <!-- 最近处理的文件 -->
                        <div v-if="getRecentFiles(directory).length > 0" class="recent-files">
                            <h5>{{ t("import.recentFiles") }}</h5>
                            <div class="file-list">
                                <div
                                    v-for="file in getRecentFiles(directory).slice(0, 5)"
                                    :key="file"
                                    class="file-item"
                                >
                                    <FileOutlined />
                                    <span>{{ getFileName(file) }}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </a-collapse-panel>
            </a-collapse>
        </div>

        <!-- 批量控制按钮 -->
        <div class="batch-controls">
            <a-space>
                <a-button v-if="canPauseAll" @click="pauseAllDirectories">
                    <template #icon><PauseOutlined /></template>
                    {{ t("import.pauseAll") }}
                </a-button>
                <a-button v-if="canResumeAll" type="primary" @click="resumeAllDirectories">
                    <template #icon><PlayCircleOutlined /></template>
                    {{ t("import.resumeAll") }}
                </a-button>
                <a-button v-if="canCancelAll" danger @click="confirmCancelAll">
                    <template #icon><StopOutlined /></template>
                    {{ t("import.cancelAll") }}
                </a-button>
                <a-button v-if="isCompleted" type="primary" @click="$emit('close')">
                    <template #icon><CheckOutlined /></template>
                    {{ t("import.close") }}
                </a-button>
            </a-space>
        </div>

        <!-- 取消确认对话框 -->
        <a-modal
            v-model:visible="showCancelAllConfirm"
            :title="t('import.confirmCancelAll')"
            :ok-text="t('import.yes')"
            :cancel-text="t('import.no')"
            @ok="cancelAllDirectories"
        >
            <p>{{ t("import.cancelAllWarning") }}</p>
            <p>
                {{
                    t("import.cancelAllProgress", {
                        completed: batchProgress.completedDirectories,
                        total: batchProgress.totalDirectories,
                    })
                }}
            </p>
        </a-modal>
    </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import {
    FolderOutlined,
    PauseOutlined,
    PlayCircleOutlined,
    StopOutlined,
    CheckOutlined,
    FileOutlined,
} from "@ant-design/icons-vue";
import type { BatchProgress, DirectoryProgress } from "@common/import-types";

// Props
const props = withDefaults(
    defineProps<{
        batchProgress: BatchProgress;
        directoryProgresses: DirectoryProgress[];
        recentFiles?: Map<string, string[]>;
        errors?: Map<string, string[]>;
        warnings?: Map<string, string[]>;
    }>(),
    {
        recentFiles: () => new Map(),
        errors: () => new Map(),
        warnings: () => new Map(),
    },
);

// Emits
const emit = defineEmits<{
    (e: "pause-directory", path: string): void;
    (e: "resume-directory", path: string): void;
    (e: "cancel-directory", path: string): void;
    (e: "pause-all"): void;
    (e: "resume-all"): void;
    (e: "cancel-all"): void;
    (e: "close"): void;
}>();

const { t } = useI18n();

// 响应式状态
const activeDirectories = ref<string[]>([]);
const showCancelAllConfirm = ref(false);

// 计算属性
const canPauseAll = computed(() => {
    return props.directoryProgresses.some((d) => d.status === "processing");
});

const canResumeAll = computed(() => {
    return props.directoryProgresses.some((d) => d.status === "paused");
});

const canCancelAll = computed(() => {
    return props.directoryProgresses.some(
        (d) => d.canCancel && ["processing", "paused"].includes(d.status),
    );
});

const isCompleted = computed(() => {
    return props.directoryProgresses.every((d) =>
        ["completed", "cancelled", "error"].includes(d.status),
    );
});

// 方法
const getDirectoryName = (path: string): string => {
    const parts = path.split(/[/\\]/);
    return parts[parts.length - 1] || path;
};

const getDirectoryHeader = (directory: DirectoryProgress): string => {
    const name = getDirectoryName(directory.path);
    const progress = getDirectoryProgress(directory);
    const status = t(`import.status.${directory.status}`);
    return `${name} - ${progress}% (${status})`;
};

const getDirectoryProgress = (directory: DirectoryProgress): number => {
    if (directory.totalFiles === 0) return 0;
    return Math.round((directory.processedFiles / directory.totalFiles) * 100);
};

const getDirectoryStatus = (directory: DirectoryProgress): string => {
    switch (directory.status) {
        case "error":
            return "exception";
        case "completed":
            return "success";
        case "paused":
            return "normal";
        default:
            return "active";
    }
};

const getDirectoryETA = (directory: DirectoryProgress): string => {
    if (directory.status === "completed") return t("import.completed");
    if (directory.status === "error") return t("import.error");
    if (directory.status === "paused") return t("import.paused");
    if (directory.status === "pending") return t("import.pending");

    // 简单的ETA计算
    const remaining = directory.totalFiles - directory.processedFiles;
    if (remaining === 0) return t("import.finishing");

    // 假设每个文件处理时间为1秒（实际应该基于历史速度计算）
    const eta = remaining * 1;
    return formatTime(eta);
};

const getOverallStatusColor = (): string => {
    if (props.batchProgress.overallProgress === 100) return "green";
    if (props.directoryProgresses.some((d) => d.status === "error")) return "red";
    if (props.directoryProgresses.some((d) => d.status === "paused")) return "orange";
    return "blue";
};

const getOverallProgressStatus = (): string => {
    if (props.directoryProgresses.some((d) => d.status === "error")) return "exception";
    if (props.batchProgress.overallProgress === 100) return "success";
    return "active";
};

const getProgressColor = (progress: number): string => {
    if (progress === 100) return "#52c41a";
    if (progress >= 75) return "#1890ff";
    if (progress >= 50) return "#faad14";
    return "#ff4d4f";
};

const getStatusColor = (status: string): string => {
    switch (status) {
        case "completed":
            return "#52c41a";
        case "processing":
            return "#1890ff";
        case "paused":
            return "#faad14";
        case "error":
            return "#ff4d4f";
        case "cancelled":
            return "#999";
        default:
            return "#666";
    }
};

const hasDirectoryIssues = (directory: DirectoryProgress): boolean => {
    return getDirectoryErrors(directory).length > 0 || getDirectoryWarnings(directory).length > 0;
};

const getDirectoryErrors = (directory: DirectoryProgress): string[] => {
    return props.errors.get(directory.path) || [];
};

const getDirectoryWarnings = (directory: DirectoryProgress): string[] => {
    return props.warnings.get(directory.path) || [];
};

const getRecentFiles = (directory: DirectoryProgress): string[] => {
    return props.recentFiles.get(directory.path) || [];
};

const getFileName = (filePath: string): string => {
    const parts = filePath.split(/[/\\]/);
    return parts[parts.length - 1];
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

// 事件处理
const pauseDirectory = (path: string) => {
    emit("pause-directory", path);
};

const resumeDirectory = (path: string) => {
    emit("resume-directory", path);
};

const cancelDirectory = (path: string) => {
    emit("cancel-directory", path);
};

const pauseAllDirectories = () => {
    emit("pause-all");
};

const resumeAllDirectories = () => {
    emit("resume-all");
};

const confirmCancelAll = () => {
    showCancelAllConfirm.value = true;
};

const cancelAllDirectories = () => {
    showCancelAllConfirm.value = false;
    emit("cancel-all");
};
</script>

<style scoped lang="less">
.batch-progress {
    .batch-header {
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

        .batch-stats {
            display: flex;
            gap: 8px;
        }
    }

    .overall-progress {
        margin-bottom: 24px;
        padding: 16px;
        background-color: var(--hover-color);
        border-radius: 6px;

        .progress-label {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 8px;

            .progress-text {
                font-size: 18px;
                font-weight: 600;
                color: var(--primary-color);
            }
        }
    }

    .current-directory {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 16px;
        padding: 12px;
        background-color: var(--success-color);
        opacity: 0.1;
        border: 1px solid var(--success-color);
        border-radius: 6px;

        .current-label {
            display: flex;
            align-items: center;
            gap: 4px;
            font-weight: 500;
            color: var(--success-color);
            white-space: nowrap;
        }

        .current-path {
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

    .directory-list {
        margin-bottom: 24px;

        .directory-extra {
            display: flex;
            align-items: center;
            gap: 8px;

            .directory-actions {
                display: flex;
                gap: 4px;
            }
        }

        .directory-details {
            .directory-stats {
                margin-bottom: 16px;
                padding: 12px;
                background-color: var(--hover-color);
                border-radius: 4px;
            }

            .directory-progress-bar {
                margin-bottom: 16px;
            }

            .directory-issues {
                margin-bottom: 16px;

                .ant-alert {
                    margin-bottom: 8px;

                    &:last-child {
                        margin-bottom: 0;
                    }
                }
            }

            .recent-files {
                h5 {
                    margin-bottom: 8px;
                    font-size: 13px;
                    color: var(--text-color);
                    opacity: 0.7;
                }

                .file-list {
                    .file-item {
                        display: flex;
                        align-items: center;
                        gap: 6px;
                        padding: 4px 0;
                        font-size: 12px;
                        color: var(--text-color);
                        opacity: 0.7;

                        .anticon {
                            color: var(--text-color);
                            opacity: 0.5;
                        }

                        span {
                            overflow: hidden;
                            text-overflow: ellipsis;
                            white-space: nowrap;
                        }
                    }
                }
            }
        }
    }

    .batch-controls {
        text-align: right;
        padding-top: 16px;
        border-top: 1px solid var(--border-color);
    }
}
</style>

<template>
    <div class="batch-progress">
        <!-- 整体进度头部 -->
        <div class="batch-header">
            <h3>{{ t("import.batchProgress") }}</h3>
            <div class="batch-stats">
                <BaseSpace>
                    <BaseTag type="processing">
                        {{ batchProgress.completedDirectories }} /
                        {{ batchProgress.totalDirectories }}
                        {{ t("import.directories") }}
                    </BaseTag>
                    <BaseTag :type="getOverallStatusType()">
                        {{ Math.round(batchProgress.overallProgress) }}% {{ t("import.complete") }}
                    </BaseTag>
                </BaseSpace>
            </div>
        </div>

        <!-- 整体进度条 -->
        <div class="overall-progress">
            <div class="progress-label">
                <span>{{ t("import.overallProgress") }}</span>
                <span class="progress-text">{{ Math.round(batchProgress.overallProgress) }}%</span>
            </div>
            <BaseProgress
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
                <BaseTooltip :title="batchProgress.currentDirectory">
                    {{ getDirectoryName(batchProgress.currentDirectory) }}
                </BaseTooltip>
            </div>
        </div>

        <!-- 目录进度列表 -->
        <div class="directory-list">
            <BaseAccordion v-model:activeKey="activeDirectories" ghost>
                <BaseAccordionPanel
                    v-for="directory in directoryProgresses"
                    :key="directory.path"
                    :header="getDirectoryHeader(directory)"
                >
                    <template #extra>
                        <div class="directory-extra" @click.stop>
                            <BaseProgress
                                type="circle"
                                :width="24"
                                :percent="getDirectoryProgress(directory)"
                                :status="getDirectoryStatus(directory)"
                                :show-info="false"
                            />
                            <div class="directory-actions">
                                <BaseButton
                                    v-if="directory.status === 'processing'"
                                    type="text"
                                    size="small"
                                    @click="pauseDirectory(directory.path)"
                                >
                                    <template #icon><PauseOutlined /></template>
                                </BaseButton>
                                <BaseButton
                                    v-if="directory.status === 'paused'"
                                    type="text"
                                    size="small"
                                    @click="resumeDirectory(directory.path)"
                                >
                                    <template #icon><PlayCircleOutlined /></template>
                                </BaseButton>
                                <BaseButton
                                    v-if="directory.status === 'completed'"
                                    type="text"
                                    size="small"
                                    @click="openDirectory(directory.path)"
                                >
                                    <template #icon><FolderOpenOutlined /></template>
                                </BaseButton>
                            </div>
                        </div>
                    </template>

                    <!-- 进度统计 -->
                    <div class="directory-stats">
                        <BaseRow :gutter="16">
                            <BaseCol :span="6">
                                <BaseStatistic
                                    :title="t('import.processed')"
                                    :value="`${directory.processedFiles} / ${directory.totalFiles}`"
                                    :value-style="{ fontSize: '14px' }"
                                />
                            </BaseCol>
                            <BaseCol :span="6">
                                <BaseStatistic
                                    :title="t('import.progress')"
                                    :value="`${getDirectoryProgress(directory)}%`"
                                    :value-style="{ fontSize: '14px' }"
                                />
                            </BaseCol>
                            <BaseCol :span="6">
                                <BaseStatistic
                                    :title="t('import.status')"
                                    :value="t(`import.status.${directory.status}`)"
                                    :value-style="{
                                        fontSize: '14px',
                                        color: getStatusColor(directory.status),
                                    }"
                                />
                            </BaseCol>
                            <BaseCol :span="6">
                                <BaseStatistic
                                    :title="t('import.eta')"
                                    :value="getDirectoryETA(directory)"
                                    :value-style="{ fontSize: '14px' }"
                                />
                            </BaseCol>
                        </BaseRow>
                    </div>

                    <!-- 详细进度条 -->
                    <div class="directory-progress-bar">
                        <BaseProgress
                            :percent="getDirectoryProgress(directory)"
                            :status="getDirectoryStatus(directory)"
                            :stroke-color="getProgressColor(getDirectoryProgress(directory))"
                        />
                    </div>

                    <!-- 错误和警告 -->
                    <div v-if="hasDirectoryIssues(directory)" class="directory-issues">
                        <BaseAlert
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
                        <BaseAlert
                            v-if="getDirectoryWarnings(directory).length > 0"
                            type="warning"
                            :message="
                                t('import.warnings', {
                                    count: getDirectoryWarnings(directory).length,
                                })
                            "
                            :description="getDirectoryWarnings(directory).slice(0, 3).join('; ')"
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
                </BaseAccordionPanel>
            </BaseAccordion>
        </div>

        <!-- 批量控制按钮 -->
        <div class="batch-controls">
            <BaseSpace>
                <BaseButton v-if="canPauseAll" @click="pauseAllDirectories">
                    <template #icon><PauseOutlined /></template>
                    {{ t("import.pauseAll") }}
                </BaseButton>
                <BaseButton v-if="canResumeAll" type="primary" @click="resumeAllDirectories">
                    <template #icon><PlayCircleOutlined /></template>
                    {{ t("import.resumeAll") }}
                </BaseButton>
                <BaseButton v-if="canCancelAll" danger @click="confirmCancelAll">
                    <template #icon><StopOutlined /></template>
                    {{ t("import.cancelAll") }}
                </BaseButton>
                <BaseButton v-if="isCompleted" type="primary" @click="$emit('close')">
                    <template #icon><CheckOutlined /></template>
                    {{ t("import.close") }}
                </BaseButton>
            </BaseSpace>
        </div>

        <!-- 取消确认对话框 -->
        <BaseModal
            :open="showCancelAllConfirm"
            :title="t('import.confirmCancelAll')"
            @close="showCancelAllConfirm = false"
        >
            <p>{{ t("import.cancelAllConfirmMessage") }}</p>
            <template #footer>
                <BaseSpace>
                    <BaseButton @click="showCancelAllConfirm = false">
                        {{ t("import.cancel") }}
                    </BaseButton>
                    <BaseButton type="primary" danger @click="cancelAllDirectories">
                        {{ t("import.confirm") }}
                    </BaseButton>
                </BaseSpace>
            </template>
        </BaseModal>
    </div>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import { useI18n } from "vue-i18n";
import {
    BaseButton,
    BaseProgress,
    BaseStatistic,
    BaseTag,
    BaseSpace,
    BaseRow,
    BaseCol,
    BaseAccordion,
    BaseAccordionPanel,
    BaseTooltip,
    BaseAlert,
    BaseModal,
} from "@renderer/components/ui";
import {
    FolderOutlined,
    PauseOutlined,
    PlayCircleOutlined,
    FolderOpenOutlined,
    FileOutlined,
    StopOutlined,
    CheckOutlined,
} from "@ant-design/icons-vue";

// 定义组件属性
interface BatchProgressProps {
    batchProgress: {
        completedDirectories: number;
        totalDirectories: number;
        overallProgress: number;
        currentDirectory?: string;
    };
    directoryProgresses: Array<{
        path: string;
        status: string;
        processedFiles: number;
        totalFiles: number;
        errors: string[];
        warnings: string[];
        recentFiles: string[];
    }>;
}

const props = defineProps<BatchProgressProps>();
const emit = defineEmits<{
    close: [];
    pauseDirectory: [path: string];
    resumeDirectory: [path: string];
    openDirectory: [path: string];
    pauseAll: [];
    resumeAll: [];
    cancelAll: [];
}>();

const { t } = useI18n();

// 响应式数据
const activeDirectories = ref<string[]>([]);
const showCancelAllConfirm = ref(false);

// 计算属性
const canPauseAll = computed(() => {
    return props.directoryProgresses.some((dir) => dir.status === "processing");
});

const canResumeAll = computed(() => {
    return props.directoryProgresses.some((dir) => dir.status === "paused");
});

const canCancelAll = computed(() => {
    return props.directoryProgresses.some((dir) => ["processing", "paused"].includes(dir.status));
});

const isCompleted = computed(() => {
    return props.directoryProgresses.every((dir) => dir.status === "completed");
});

// 方法
const getOverallStatusType = () => {
    if (props.batchProgress.overallProgress === 100) return "success";
    if (props.batchProgress.overallProgress > 0) return "processing";
    return "default";
};

const getOverallProgressStatus = () => {
    if (props.batchProgress.overallProgress === 100) return "success";
    if (props.batchProgress.overallProgress > 0) return "active";
    return "normal";
};

const getProgressColor = (progress: number) => {
    if (progress === 100) return "var(--color-success)";
    if (progress > 0) return "var(--color-primary)";
    return "var(--color-bg-secondary)";
};

const getDirectoryName = (path: string) => {
    return path.split("/").pop() || path;
};

const getDirectoryHeader = (directory: any) => {
    return `${getDirectoryName(directory.path)} (${directory.processedFiles}/${directory.totalFiles})`;
};

const getDirectoryProgress = (directory: any) => {
    if (directory.totalFiles === 0) return 0;
    return Math.round((directory.processedFiles / directory.totalFiles) * 100);
};

const getDirectoryStatus = (directory: any) => {
    if (directory.status === "completed") return "success";
    if (directory.status === "error") return "exception";
    if (directory.status === "processing") return "active";
    return "normal";
};

const getStatusColor = (status: string) => {
    const colors = {
        processing: "var(--color-primary)",
        completed: "var(--color-success)",
        error: "var(--color-danger)",
        paused: "var(--color-warning)",
    };
    return colors[status as keyof typeof colors] || "var(--color-text-secondary)";
};

const getDirectoryETA = (directory: any) => {
    // 简化的ETA计算
    if (directory.status !== "processing") return "-";
    const remaining = directory.totalFiles - directory.processedFiles;
    return remaining > 0 ? `${remaining} files` : "Complete";
};

const hasDirectoryIssues = (directory: any) => {
    return directory.errors.length > 0 || directory.warnings.length > 0;
};

const getDirectoryErrors = (directory: any) => {
    return directory.errors || [];
};

const getDirectoryWarnings = (directory: any) => {
    return directory.warnings || [];
};

const getRecentFiles = (directory: any) => {
    return directory.recentFiles || [];
};

const getFileName = (filePath: string) => {
    return filePath.split("/").pop() || filePath;
};

// 事件处理
const pauseDirectory = (path: string) => {
    emit("pauseDirectory", path);
};

const resumeDirectory = (path: string) => {
    emit("resumeDirectory", path);
};

const openDirectory = (path: string) => {
    emit("openDirectory", path);
};

const pauseAllDirectories = () => {
    emit("pauseAll");
};

const resumeAllDirectories = () => {
    emit("resumeAll");
};

const confirmCancelAll = () => {
    showCancelAllConfirm.value = true;
};

const cancelAllDirectories = () => {
    emit("cancelAll");
    showCancelAllConfirm.value = false;
};
</script>

<style scoped>
.batch-progress {
    padding: 20px;
    background: var(--color-card-bg);
    border-radius: var(--radius-lg);
    border: 1px solid var(--color-border);
}

.batch-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
}

.batch-header h3 {
    margin: 0;
    color: var(--color-text);
    font-size: 18px;
    font-weight: 600;
}

.batch-stats {
    display: flex;
    gap: 8px;
}

.overall-progress {
    margin-bottom: 20px;
}

.progress-label {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
    color: var(--color-text-secondary);
    font-size: 14px;
}

.progress-text {
    font-weight: 600;
    color: var(--color-text);
}

.current-directory {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 20px;
    padding: 12px;
    background: var(--color-bg-secondary);
    border-radius: var(--radius-md);
}

.current-label {
    display: flex;
    align-items: center;
    gap: 4px;
    color: var(--color-text-secondary);
    font-size: 14px;
}

.current-path {
    flex: 1;
    color: var(--color-text);
    font-weight: 500;
}

.directory-list {
    margin-bottom: 20px;
}

.directory-extra {
    display: flex;
    align-items: center;
    gap: 8px;
}

.directory-actions {
    display: flex;
    gap: 4px;
}

.directory-stats {
    margin-bottom: 16px;
}

.directory-progress-bar {
    margin-bottom: 16px;
}

.directory-issues {
    margin-bottom: 16px;
}

.recent-files h5 {
    margin: 0 0 8px 0;
    color: var(--color-text);
    font-size: 14px;
    font-weight: 600;
}

.file-list {
    display: flex;
    flex-direction: column;
    gap: 4px;
}

.file-item {
    display: flex;
    align-items: center;
    gap: 6px;
    color: var(--color-text-secondary);
    font-size: 12px;
}

.batch-controls {
    display: flex;
    justify-content: center;
    padding-top: 20px;
    border-top: 1px solid var(--color-border);
}
</style>

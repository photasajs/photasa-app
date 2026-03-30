<template>
    <BaseDrawer
        v-model="modelValue"
        placement="right"
        width="25vw"
        :mask-closable="true"
        :close-on-esc="true"
    >
        <template #title>
            <h2 class="text-lg font-medium text-[var(--color-text)] title-truncated">
                {{ fileMeta?.name || t("fileInfo.title") }}
            </h2>
        </template>
        <BaseSpinContainer :spinning="loading">
            <div v-if="fileMeta" class="file-info-content">
                <!-- 原始元数据切换控制 -->
                <div class="metadata-toggle">
                    <button
                        @click="showRawMetadata = !showRawMetadata"
                        class="toggle-button"
                        :class="{ active: showRawMetadata }"
                    >
                        <PhCode class="w-4 h-4" />
                        {{
                            showRawMetadata ? t("fileInfo.hideRawData") : t("fileInfo.showRawData")
                        }}
                    </button>
                </div>

                <!-- 基本信息卡片 -->
                <div class="info-card basic-info">
                    <div class="info-card-header">
                        <h4 class="info-card-title">
                            <PhInfo class="w-4 h-4" />
                            {{ t("fileInfo.basicInfo") }}
                        </h4>
                    </div>
                    <div class="info-card-content">
                        <div class="info-grid">
                            <div class="info-item full-width">
                                <span class="info-label">{{ t("fileInfo.fileName") }}</span>
                                <span class="info-value file-name">{{ fileMeta.name }}</span>
                            </div>
                            <div class="info-item">
                                <span class="info-label">{{ t("fileInfo.fileType") }}</span>
                                <span class="info-value">
                                    <span
                                        class="file-type-badge"
                                        :class="getFileTypeBadgeClass(fileMeta?.type)"
                                    >
                                        {{ fileMeta.type?.toUpperCase() || "FILE" }}
                                    </span>
                                </span>
                            </div>
                            <div class="info-item">
                                <span class="info-label">{{ t("fileInfo.format") }}</span>
                                <span class="info-value">
                                    {{ fileMeta.format || t("fileInfo.unknown") }}
                                </span>
                            </div>
                            <div class="info-item">
                                <span class="info-label">{{ t("fileInfo.size") }}</span>
                                <span class="info-value file-size">
                                    {{ formatFileSize(fileMeta.size) }}
                                </span>
                            </div>
                            <div class="info-item full-width">
                                <span class="info-label">{{ t("fileInfo.location") }}</span>
                                <span class="info-value file-path">
                                    {{ fileMeta.path }}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- 媒体属性卡片 -->
                <div
                    v-if="fileMeta.type === 'image' && fileMeta.width && fileMeta.height"
                    class="info-card media-info"
                >
                    <div class="info-card-header">
                        <h4 class="info-card-title">
                            <PhImage class="w-4 h-4" />
                            {{ t("fileInfo.mediaProperties") }}
                        </h4>
                    </div>
                    <div class="info-card-content">
                        <div class="info-grid">
                            <div class="info-item">
                                <span class="info-label">{{ t("fileInfo.dimensions") }}</span>
                                <span class="info-value">
                                    {{ fileMeta.width }} × {{ fileMeta.height }}
                                </span>
                            </div>
                            <div class="info-item">
                                <span class="info-label">{{ t("fileInfo.codec") }}</span>
                                <span class="info-value">
                                    {{ fileMeta.codec || t("fileInfo.unknown") }}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- 视频属性卡片 -->
                <div
                    v-if="fileMeta.type === 'video' && fileMeta.duration"
                    class="info-card video-info"
                >
                    <div class="info-card-header">
                        <h4 class="info-card-title">
                            <PhVideoCamera class="w-4 h-4" />
                            {{ t("fileInfo.videoProperties") }}
                        </h4>
                    </div>
                    <div class="info-card-content">
                        <div class="info-grid">
                            <div class="info-item">
                                <span class="info-label">{{ t("fileInfo.duration") }}</span>
                                <span class="info-value">
                                    {{ formatDuration(fileMeta.duration) }}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- 时间信息卡片 -->
                <div
                    v-if="fileMeta.createdTime || fileMeta.modifiedTime"
                    class="info-card time-info"
                >
                    <div class="info-card-header">
                        <h4 class="info-card-title">
                            <PhClock class="w-4 h-4" />
                            {{ t("fileInfo.timeInfo") }}
                        </h4>
                    </div>
                    <div class="info-card-content">
                        <div class="info-grid">
                            <div class="info-item">
                                <span class="info-label">{{ t("fileInfo.createdAt") }}</span>
                                <span class="info-value">
                                    {{ formatDateTime(fileMeta.createdTime) }}
                                </span>
                            </div>
                            <div class="info-item">
                                <span class="info-label">{{ t("fileInfo.modifiedAt") }}</span>
                                <span class="info-value">
                                    {{ formatDateTime(fileMeta.modifiedTime) }}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- 技术信息卡片 -->
                <div v-if="fileMeta.cameraInfo" class="info-card technical-info">
                    <div class="info-card-header">
                        <h4 class="info-card-title">
                            <PhGear class="w-4 h-4" />
                            {{ t("fileInfo.technicalInfo") }}
                        </h4>
                    </div>
                    <div class="info-card-content">
                        <div class="info-grid">
                            <div class="info-item">
                                <span class="info-label">{{ t("fileInfo.camera") }}</span>
                                <span class="info-value">
                                    {{ fileMeta.cameraInfo?.make || t("fileInfo.unknown") }}
                                </span>
                            </div>
                            <div class="info-item">
                                <span class="info-label">{{ t("fileInfo.lens") }}</span>
                                <span class="info-value">
                                    {{ fileMeta.cameraInfo?.lens || t("fileInfo.unknown") }}
                                </span>
                            </div>
                            <div class="info-item">
                                <span class="info-label">{{ t("fileInfo.iso") }}</span>
                                <span class="info-value">
                                    {{ fileMeta.cameraInfo?.iso || t("fileInfo.unknown") }}
                                </span>
                            </div>
                            <div class="info-item">
                                <span class="info-label">{{ t("fileInfo.aperture") }}</span>
                                <span class="info-value">
                                    {{ fileMeta.cameraInfo?.aperture || t("fileInfo.unknown") }}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- 原始元数据展示 -->
                <div v-if="showRawMetadata" class="metadata-viewer">
                    <h4 class="metadata-title">
                        <PhCode class="w-4 h-4" />
                        {{ t("fileInfo.rawMetadata") }}
                    </h4>
                    <div v-if="fileMeta.rawMetadata" class="metadata-content">
                        <JsonTreeView :data="fileMeta.rawMetadata as any" />
                    </div>
                    <div v-else class="no-metadata">
                        {{ t("fileInfo.noMetadata") }}
                    </div>
                </div>
            </div>
        </BaseSpinContainer>
    </BaseDrawer>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import { useI18n } from "vue-i18n";
import type { FileMetadata } from "@photasa/common";
import { JsonTreeView } from "json-tree-view-vue3";
import { BaseDrawer, BaseSpinContainer } from "@renderer/components/ui";
import { PhImage, PhVideoCamera, PhInfo, PhClock, PhGear, PhCode } from "@phosphor-icons/vue";

// 定义组件属性
interface FileInfoDrawerProps {
    modelValue: boolean;
    fileMeta?: FileMetadata | null;
    loading?: boolean;
}

// 定义组件事件
const emit = defineEmits<{
    "update:modelValue": [value: boolean];
}>();

// 组件属性
const props = withDefaults(defineProps<FileInfoDrawerProps>(), {
    loading: false,
});

// 计算属性用于v-model
const modelValue = computed({
    get: () => props.modelValue,
    set: (value: boolean) => emit("update:modelValue", value),
});

// 国际化
const { t } = useI18n();

// 响应式数据
const showRawMetadata = ref(false);

// 工具函数
function getFileTypeBadgeClass(fileType: string | undefined): string {
    switch (fileType) {
        case "image":
            return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
        case "video":
            return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200";
        default:
            return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200";
    }
}

function formatFileSize(bytes: number | undefined): string {
    if (!bytes) return "";
    const units = ["B", "KB", "MB", "GB"];
    let size = bytes;
    let unitIndex = 0;
    while (size >= 1024 && unitIndex < units.length - 1) {
        size /= 1024;
        unitIndex++;
    }
    return `${size.toFixed(1)} ${units[unitIndex]}`;
}

function formatDuration(seconds: number | undefined): string {
    if (!seconds) return "";
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    if (hours > 0) {
        return `${hours}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    }
    return `${minutes}:${secs.toString().padStart(2, "0")}`;
}

function formatDateTime(date: Date | undefined): string {
    if (!date) return "";
    return new Date(date).toLocaleString("zh-CN", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
    });
}
</script>

<style scoped>
.title-truncated {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 100%;
    min-width: 0;
    flex: 1;
}

.file-info-content {
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 16px;
}

.metadata-toggle {
    display: flex;
    justify-content: flex-end;
    margin-bottom: 8px;
}

.toggle-button {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 16px;
    background: var(--color-bg-secondary);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    color: var(--color-text-secondary);
    font-size: 14px;
    cursor: pointer;
    transition: all 0.2s ease;
}

.toggle-button:hover {
    background: var(--color-bg-hover);
    color: var(--color-text);
}

.toggle-button.active {
    background: var(--color-primary);
    color: white;
    border-color: var(--color-primary);
}

.info-card {
    background: var(--color-card-bg);
    border: 1px solid var(--color-card-border);
    border-radius: var(--radius-md);
    overflow: hidden;
    transition: all 0.2s ease;
}

.info-card:hover {
    box-shadow: 0 2px 8px var(--color-card-shadow);
}

.info-card.basic-info {
    border-left: 4px solid var(--color-info);
}

.info-card.media-info {
    border-left: 4px solid var(--color-primary);
}

.info-card.video-info {
    border-left: 4px solid var(--color-warning);
}

.info-card.time-info {
    border-left: 4px solid var(--color-success);
}

.info-card.technical-info {
    border-left: 4px solid var(--color-danger);
}

.info-card-header {
    padding: 16px 20px 12px;
    border-bottom: 1px solid var(--color-border);
    background: var(--color-bg-secondary);
}

.info-card-title {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0;
    font-size: 16px;
    font-weight: 600;
    color: var(--color-text);
}

.info-card-content {
    padding: 20px;
}

.info-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
}

.info-item {
    display: flex;
    flex-direction: column;
    gap: 4px;
}

.info-item.full-width {
    grid-column: 1 / -1;
}

.info-label {
    font-size: 12px;
    font-weight: 500;
    color: var(--color-text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.5px;
}

.info-value {
    font-size: 14px;
    color: var(--color-text);
    word-break: break-all;
}

.file-name {
    font-weight: 600;
    font-size: 16px;
}

.file-size {
    font-weight: 600;
    color: var(--color-primary);
}

.file-type-badge {
    display: inline-block;
    padding: 4px 8px;
    border-radius: var(--radius-sm);
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
}

.file-path {
    font-family: monospace;
    font-size: 13px;
    background: var(--color-bg-secondary);
    padding: 8px 12px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--color-border);
}

.metadata-viewer {
    background: var(--color-card-bg);
    border: 1px solid var(--color-card-border);
    border-radius: var(--radius-md);
    overflow: hidden;
}

.metadata-title {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0;
    padding: 16px 20px;
    font-size: 16px;
    font-weight: 600;
    color: var(--color-text);
    background: var(--color-bg-secondary);
    border-bottom: 1px solid var(--color-border);
}

.metadata-content {
    padding: 20px;
    max-height: 400px;
    overflow: auto;
}

.no-metadata {
    padding: 40px 20px;
    text-align: center;
    color: var(--color-text-secondary);
    font-style: italic;
}

@media (max-width: 768px) {
    .info-grid {
        grid-template-columns: 1fr;
    }

    .info-item.full-width {
        grid-column: 1;
    }
}
</style>

<template>
    <div class="file-preview">
        <!-- 预览头部 -->
        <div class="preview-header">
            <h3>{{ t("import.filePreview") }}</h3>
            <div class="preview-actions">
                <a-space>
                    <BaseButton size="sm" @click="selectAll">
                        <template #icon><CheckOutlined /></template>
                        {{ t("import.selectAll") }}
                    </BaseButton>
                    <BaseButton size="sm" @click="deselectAll">
                        <template #icon><CloseOutlined /></template>
                        {{ t("import.deselectAll") }}
                    </BaseButton>
                    <BaseButton size="sm" @click="invertSelection">
                        <template #icon><SwapOutlined /></template>
                        {{ t("import.invertSelection") }}
                    </BaseButton>
                </a-space>
            </div>
        </div>

        <!-- 预览统计 -->
        <div class="preview-stats">
            <a-row :gutter="16">
                <a-col :span="6">
                    <a-statistic
                        :title="t('import.selected')"
                        :value="`${selectedCount} / ${totalCount}`"
                        :value-style="{ color: '#1890ff' }"
                    />
                </a-col>
                <a-col :span="6">
                    <a-statistic
                        :title="t('import.selectedSize')"
                        :value="formatSize(selectedSize)"
                        :value-style="{ color: '#52c41a' }"
                    />
                </a-col>
                <a-col :span="6">
                    <a-statistic
                        :title="t('import.fileGroups')"
                        :value="groupCount"
                        :value-style="{ color: '#722ed1' }"
                    />
                </a-col>
                <a-col :span="6">
                    <a-statistic
                        :title="t('import.duplicates')"
                        :value="duplicateCount"
                        :value-style="{ color: '#fa8c16' }"
                    />
                </a-col>
            </a-row>
        </div>

        <!-- 文件列表 -->
        <div class="file-list">
            <a-list
                :data-source="visibleGroups"
                :pagination="hasMoreFiles ? paginationConfig : false"
                size="sm"
            >
                <template #renderItem="{ item: group }">
                    <a-list-item class="file-item">
                        <template #actions>
                            <a-tooltip :title="t('import.toggleSelection')">
                                <a-checkbox
                                    :checked="isSelected(group.mainFile.path)"
                                    @change="toggleSelection(group)"
                                />
                            </a-tooltip>
                            <a-tooltip :title="t('import.viewDetails')">
                                <BaseButton type="text" size="sm" @click="showDetails(group)">
                                    <template #icon><InfoCircleOutlined /></template>
                                </BaseButton>
                            </a-tooltip>
                        </template>

                        <a-list-item-meta>
                            <template #avatar>
                                <a-avatar shape="square" size="large" class="file-avatar">
                                    <template #icon>
                                        <FileImageOutlined v-if="group.mainFile.type === 'image'" />
                                        <VideoCameraOutlined
                                            v-else-if="group.mainFile.type === 'video'"
                                        />
                                        <FileOutlined v-else />
                                    </template>
                                </a-avatar>
                            </template>

                            <template #title>
                                <div class="file-title">
                                    <span class="file-name">{{ group.mainFile.name }}</span>
                                    <div class="file-tags">
                                        <a-tag v-if="group.type === 'group'" color="blue" size="sm">
                                            {{ t("import.group", { count: group.files.length }) }}
                                        </a-tag>
                                        <a-tag v-if="isDuplicate(group)" color="orange" size="sm">
                                            {{ t("import.duplicate.label") }}
                                        </a-tag>
                                        <a-tag
                                            v-if="group.mainFile.type === 'image'"
                                            color="green"
                                            size="sm"
                                        >
                                            {{ t("import.image") }}
                                        </a-tag>
                                        <a-tag
                                            v-if="group.mainFile.type === 'video'"
                                            color="purple"
                                            size="sm"
                                        >
                                            {{ t("import.video") }}
                                        </a-tag>
                                    </div>
                                </div>
                            </template>

                            <template #description>
                                <div class="file-description">
                                    <div class="file-info">
                                        <span class="file-size">{{
                                            formatSize(group.totalSize)
                                        }}</span>
                                        <span v-if="group.mainFile.dateTime" class="file-date">
                                            {{ formatDate(group.mainFile.dateTime) }}
                                        </span>
                                        <span v-if="group.mainFile.dateSource" class="date-source">
                                            ({{
                                                t(`import.dateSource.${group.mainFile.dateSource}`)
                                            }})
                                        </span>
                                    </div>
                                    <div v-if="group.targetPath" class="target-path">
                                        <ArrowRightOutlined />
                                        {{ getTargetPath(group) }}
                                    </div>
                                </div>
                            </template>
                        </a-list-item-meta>
                    </a-list-item>
                </template>
            </a-list>
        </div>

        <!-- 文件详情对话框 -->
        <a-modal
            v-model:visible="showDetailsDialog"
            :title="t('import.fileDetails')"
            width="800px"
            :footer="null"
        >
            <div v-if="selectedGroup" class="file-details">
                <!-- 基本信息 -->
                <div class="detail-section">
                    <h4>{{ t("import.basicInfo") }}</h4>
                    <a-descriptions :column="2" size="sm" bordered>
                        <a-descriptions-item :label="t('import.fileName')">
                            {{ selectedGroup.mainFile.name }}
                        </a-descriptions-item>
                        <a-descriptions-item :label="t('import.fileSize')">
                            {{ formatSize(selectedGroup.totalSize) }}
                        </a-descriptions-item>
                        <a-descriptions-item :label="t('import.fileType')">
                            {{ selectedGroup.mainFile.type }}
                        </a-descriptions-item>
                        <a-descriptions-item :label="t('import.dateSource.label')">
                            {{ t(`import.dateSource.${selectedGroup.mainFile.dateSource}`) }}
                        </a-descriptions-item>
                        <a-descriptions-item :label="t('import.dateTime')">
                            {{ formatDate(selectedGroup.mainFile.dateTime) }}
                        </a-descriptions-item>
                        <a-descriptions-item :label="t('import.modifiedTime')">
                            {{ formatDate(selectedGroup.mainFile.modifiedTime) }}
                        </a-descriptions-item>
                    </a-descriptions>
                </div>

                <!-- 文件组信息 -->
                <div v-if="selectedGroup.type === 'group'" class="detail-section">
                    <h4>{{ t("import.groupFiles") }}</h4>
                    <a-list :data-source="selectedGroup.files" size="sm">
                        <template #renderItem="{ item: file }">
                            <a-list-item>
                                <a-list-item-meta>
                                    <template #avatar>
                                        <a-avatar size="sm" shape="square">
                                            <template #icon>
                                                <FileImageOutlined v-if="file.type === 'image'" />
                                                <VideoCameraOutlined
                                                    v-else-if="file.type === 'video'"
                                                />
                                                <FileOutlined v-else />
                                            </template>
                                        </a-avatar>
                                    </template>
                                    <template #title>{{ file.name }}</template>
                                    <template #description>{{ formatSize(file.size) }}</template>
                                </a-list-item-meta>
                            </a-list-item>
                        </template>
                    </a-list>
                </div>

                <!-- 目标路径预览 -->
                <div class="detail-section">
                    <h4>{{ t("import.targetPath") }}</h4>
                    <a-input :value="getTargetPath(selectedGroup)" readonly />
                </div>

                <!-- 元数据信息 -->
                <div v-if="selectedGroup.mainFile.metadata" class="detail-section">
                    <h4>{{ t("import.metadata") }}</h4>
                    <a-descriptions :column="2" size="sm" bordered>
                        <a-descriptions-item
                            v-if="'width' in selectedGroup.mainFile.metadata"
                            :label="t('import.dimensions')"
                        >
                            {{ (selectedGroup.mainFile.metadata as any).width }} ×
                            {{ (selectedGroup.mainFile.metadata as any).height }}
                        </a-descriptions-item>
                        <a-descriptions-item
                            v-if="'duration' in selectedGroup.mainFile.metadata"
                            :label="t('import.duration')"
                        >
                            {{ formatDuration((selectedGroup.mainFile.metadata as any).duration) }}
                        </a-descriptions-item>
                        <a-descriptions-item
                            v-if="selectedGroup.mainFile.metadata.format"
                            :label="t('import.format')"
                        >
                            {{ selectedGroup.mainFile.metadata.format }}
                        </a-descriptions-item>
                        <a-descriptions-item
                            v-if="selectedGroup.mainFile.metadata.gpsInfo"
                            :label="t('import.location')"
                        >
                            {{ formatGPS(selectedGroup.mainFile.metadata.gpsInfo) }}
                        </a-descriptions-item>
                    </a-descriptions>
                </div>
            </div>
        </a-modal>
    </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import {
    PhCheck as CheckOutlined,
    PhX as CloseOutlined,
    PhArrowsClockwise as SwapOutlined,
    PhInfo as InfoCircleOutlined,
    PhImage as FileImageOutlined,
    PhVideoCamera as VideoCameraOutlined,
    PhFileText as FileOutlined,
    PhCaretRight as ArrowRightOutlined,
} from "@phosphor-icons/vue";
import type { FileGroup, DuplicateFileInfo, GPSInfo } from "@common/import-types";
import { BaseButton } from "@renderer/components/ui";

// Props
const props = withDefaults(
    defineProps<{
        fileGroups: FileGroup[];
        duplicates?: DuplicateFileInfo[];
        selectedFiles: Set<string>;
        targetBasePath: string;
        pageSize?: number;
    }>(),
    {
        duplicates: () => [],
        pageSize: 50,
    },
);

// Emits
const emit = defineEmits<{
    (e: "update:selectedFiles", selectedFiles: Set<string>): void;
}>();

const { t } = useI18n();

// 响应式状态
const currentPage = ref(1);
const showDetailsDialog = ref(false);
const selectedGroup = ref<FileGroup | null>(null);

// 计算属性
const visibleGroups = computed(() => {
    const start = (currentPage.value - 1) * props.pageSize;
    const end = start + props.pageSize;
    return props.fileGroups.slice(start, end);
});

const hasMoreFiles = computed(() => {
    return props.fileGroups.length > props.pageSize;
});

const selectedCount = computed(() => {
    return props.selectedFiles.size;
});

const totalCount = computed(() => {
    return props.fileGroups.length;
});

const selectedSize = computed(() => {
    let size = 0;
    for (const group of props.fileGroups) {
        if (props.selectedFiles.has(group.mainFile.path)) {
            size += group.totalSize;
        }
    }
    return size;
});

const groupCount = computed(() => {
    return props.fileGroups.filter((g) => g.type === "group").length;
});

const duplicateCount = computed(() => {
    return props.duplicates.length;
});

const paginationConfig = computed(() => ({
    current: currentPage.value,
    pageSize: props.pageSize,
    total: props.fileGroups.length,
    showSizeChanger: false,
    showQuickJumper: true,
    showTotal: (total: number, range: [number, number]) =>
        t("import.pagination", { start: range[0], end: range[1], total }),
    onChange: (page: number) => {
        currentPage.value = page;
    },
}));

// 方法
const isSelected = (path: string): boolean => {
    return props.selectedFiles.has(path);
};

const toggleSelection = (group: FileGroup) => {
    const newSelection = new Set(props.selectedFiles);
    const path = group.mainFile.path;

    if (newSelection.has(path)) {
        newSelection.delete(path);
    } else {
        newSelection.add(path);
    }

    emit("update:selectedFiles", newSelection);
};

const selectAll = () => {
    const newSelection = new Set<string>();
    for (const group of props.fileGroups) {
        newSelection.add(group.mainFile.path);
    }
    emit("update:selectedFiles", newSelection);
};

const deselectAll = () => {
    emit("update:selectedFiles", new Set<string>());
};

const invertSelection = () => {
    const newSelection = new Set<string>();
    for (const group of props.fileGroups) {
        const path = group.mainFile.path;
        if (!props.selectedFiles.has(path)) {
            newSelection.add(path);
        }
    }
    emit("update:selectedFiles", newSelection);
};

const isDuplicate = (group: FileGroup): boolean => {
    return props.duplicates.some((d) => d.duplicateFile.path === group.mainFile.path);
};

const showDetails = (group: FileGroup) => {
    selectedGroup.value = group;
    showDetailsDialog.value = true;
};

const getTargetPath = (group: FileGroup): string => {
    if (!group.targetPath) return props.targetBasePath;
    return `${props.targetBasePath}/${group.targetPath}/${group.mainFile.name}`;
};

// 格式化函数
const formatSize = (size: number): string => {
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    if (size < 1024 * 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
    return `${(size / (1024 * 1024 * 1024)).toFixed(1)} GB`;
};

const formatDate = (date: Date | undefined): string => {
    if (!date) return t("import.unknown");
    return new Intl.DateTimeFormat(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    }).format(date);
};

const formatDuration = (duration: number): string => {
    const hours = Math.floor(duration / 3600);
    const minutes = Math.floor((duration % 3600) / 60);
    const seconds = Math.floor(duration % 60);

    if (hours > 0) {
        return `${hours}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
    }
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
};

const formatGPS = (gps: GPSInfo): string => {
    const lat = gps.latitude.toFixed(6);
    const lng = gps.longitude.toFixed(6);
    return `${lat}, ${lng}`;
};
</script>

<style scoped lang="less">
.file-preview {
    .preview-header {
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

    .preview-stats {
        margin-bottom: 16px;
        padding: 16px;
        background-color: var(--hover-color);
        border-radius: 6px;
    }

    .file-list {
        border: 1px solid var(--border-color);
        border-radius: 6px;
        max-height: 500px;
        overflow-y: auto;

        .file-item {
            padding: 12px 16px;

            &:hover {
                background-color: var(--hover-color);
            }

            .file-avatar {
                background-color: var(--hover-color);
                color: var(--text-color);
            }

            .file-title {
                .file-name {
                    font-weight: 500;
                    margin-right: 8px;
                    color: var(--text-color);
                }

                .file-tags {
                    display: inline-flex;
                    gap: 4px;
                    flex-wrap: wrap;
                }
            }

            .file-description {
                .file-info {
                    display: flex;
                    gap: 12px;
                    margin-bottom: 4px;

                    .file-size {
                        font-weight: 500;
                        color: var(--primary-color);
                    }

                    .file-date {
                        color: var(--text-color);
                        opacity: 0.7;
                    }

                    .date-source {
                        color: var(--text-color);
                        opacity: 0.5;
                        font-size: 12px;
                    }
                }

                .target-path {
                    display: flex;
                    align-items: center;
                    gap: 4px;
                    color: var(--success-color);
                    font-size: 12px;

                    .anticon {
                        font-size: 10px;
                    }
                }
            }
        }
    }

    .file-details {
        .detail-section {
            margin-bottom: 24px;

            h4 {
                margin-bottom: 12px;
                font-size: 14px;
                font-weight: 600;
                color: var(--text-color);
            }
        }
    }
}
</style>

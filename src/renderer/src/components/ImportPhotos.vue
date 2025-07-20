<script setup lang="ts">
import { computed, reactive, ref, watch } from "vue";
import { usePreferenceStore } from "@renderer/stores/preference";
import {
    chooseDirectories,
    previewImport,
    executeImport,
    cancelImport,
    pauseImport,
    resumeImport,
} from "@renderer/utils/api";
import { storeToRefs } from "pinia";
import { useI18n } from "vue-i18n";
import {
    TrashIcon,
    PlusIcon,
    FolderOpenIcon,
    EyeIcon,
    ArrowDownTrayIcon,
    PauseIcon,
    PlayIcon,
    StopIcon,
    PhotoIcon,
    VideoCameraIcon,
    DocumentIcon,
} from "@heroicons/vue/24/outline";
import {
    BaseModal,
    BaseButton,
    BaseInput,
    BaseSelect,
    BaseCheckbox,
    BaseSwitch,
} from "@renderer/components/ui";
import type {
    ImportConfig,
    ImportProgress,
    FileGroup,
    DuplicateStrategy,
    ImportFilters,
    FileType,
    ImportResult,
} from "@common/import-types";

// Define props and emits
const props = withDefaults(
    defineProps<{
        show: boolean;
        initialSourcePaths?: string[];
        initialTargetPath?: string;
    }>(),
    {
        show: () => false,
        initialSourcePaths: () => [],
        initialTargetPath: () => "",
    },
);

const emit = defineEmits<{
    (e: "update:show", show: boolean): void;
    (e: "import-complete", result: ImportResult): void;
}>();

const { t } = useI18n();
const store = usePreferenceStore();
const { paths } = storeToRefs(store);

// 响应式状态
const sourcePaths = ref<string[]>(props.initialSourcePaths);
const targetPath = ref<string>(props.initialTargetPath || store.paths[0] || "");

// 导入选项
const filters = reactive<ImportFilters>({
    fileTypes: ["image", "video"] as FileType[],
    sizeRange: { min: 0, max: Number.MAX_SAFE_INTEGER },
    dateRange: { start: new Date(0), end: new Date() },
    includeSubfolders: true,
});

const duplicateStrategy = ref<DuplicateStrategy>("rename");

// 预览状态
const showPreview = ref(false);
const filePreview = reactive<{
    files: FileGroup[];
    selectedFiles: Set<string>;
    totalCount: number;
    totalSize: number;
    statistics: any;
}>({
    files: [],
    selectedFiles: new Set(),
    totalCount: 0,
    totalSize: 0,
    statistics: {
        imageFiles: 0,
        videoFiles: 0,
        otherFiles: 0,
        duplicateCount: 0,
    },
});

// 导入状态
const isImporting = ref(false);
const isPaused = ref(false);
const canCancel = ref(true);
const importId = ref("");
const importProgress = reactive<ImportProgress>({
    totalFiles: 0,
    processedFiles: 0,
    speed: 0,
    estimatedTimeRemaining: 0,
    errors: [],
    warnings: [],
    status: "preparing",
});

// 计算属性
const showConfigModal = computed({
    get() {
        return props.show;
    },
    set(value) {
        emit("update:show", value);
    },
});

const canPreview = computed(() => {
    return sourcePaths.value.length > 0 && targetPath.value !== "";
});

const canImport = computed(() => {
    return (
        sourcePaths.value.length > 0 &&
        targetPath.value !== "" &&
        (filePreview.files.length > 0 || !showPreview.value)
    );
});

const pathOptions = computed(() => {
    return paths.value.map((path) => ({
        value: path,
        label: path,
    }));
});

const duplicateStrategyOptions = computed(() => [
    { value: "rename", label: t("import.duplicate.rename") },
    { value: "skip", label: t("import.duplicate.skip") },
    { value: "overwrite", label: t("import.duplicate.overwrite") },
    { value: "keep_both", label: t("import.duplicate.keepBoth") },
]);

// 文件类型选项
const imageTypeSelected = computed({
    get: () => filters.fileTypes.includes("image"),
    set: (value: boolean) => {
        if (value && !filters.fileTypes.includes("image")) {
            filters.fileTypes.push("image");
        } else if (!value) {
            const index = filters.fileTypes.indexOf("image");
            if (index > -1) filters.fileTypes.splice(index, 1);
        }
    },
});

const videoTypeSelected = computed({
    get: () => filters.fileTypes.includes("video"),
    set: (value: boolean) => {
        if (value && !filters.fileTypes.includes("video")) {
            filters.fileTypes.push("video");
        } else if (!value) {
            const index = filters.fileTypes.indexOf("video");
            if (index > -1) filters.fileTypes.splice(index, 1);
        }
    },
});

// 方法
const addSourceDirectory = async () => {
    try {
        const result = await chooseDirectories(true);
        if (result.filePaths && result.filePaths.length > 0) {
            // 添加新的源目录，避免重复
            for (const path of result.filePaths) {
                if (!sourcePaths.value.includes(path)) {
                    sourcePaths.value.push(path);
                }
            }
        }
    } catch (error) {
        console.error("Failed to choose directories:", error);
    }
};

const removeSourcePath = (index: number) => {
    sourcePaths.value.splice(index, 1);
};

const selectTargetDirectory = async () => {
    try {
        const result = await chooseDirectories(false);
        if (result.filePaths && result.filePaths.length > 0) {
            targetPath.value = result.filePaths[0];
        }
    } catch (error) {
        console.error("Failed to choose target directory:", error);
    }
};

const previewImportFiles = async () => {
    try {
        const config: ImportConfig = {
            sourcePaths: sourcePaths.value,
            targetPath: targetPath.value,
            filters,
            duplicateStrategy: duplicateStrategy.value,
            fileGroups: [],
            selectedFiles: [],
            allowDuplicateRename: true,
        };

        const preview = await previewImport(config);

        // 更新预览状态
        filePreview.files = preview.fileGroups;
        filePreview.totalCount = preview.statistics.totalFiles;
        filePreview.totalSize = preview.statistics.totalSize;
        filePreview.statistics = preview.statistics;
        filePreview.selectedFiles = new Set(preview.fileGroups.map((g) => g.mainFile.path));

        showPreview.value = true;
    } catch (error) {
        console.error("Failed to preview import:", error);
    }
};

const startImport = async () => {
    try {
        isImporting.value = true;

        const config: ImportConfig = {
            sourcePaths: sourcePaths.value,
            targetPath: targetPath.value,
            filters,
            duplicateStrategy: duplicateStrategy.value,
            fileGroups: filePreview.files,
            selectedFiles: Array.from(filePreview.selectedFiles),
            allowDuplicateRename: true,
        };

        const result = await executeImport(config, {
            onProgress: (progress) => {
                // 更新进度
                Object.assign(importProgress, progress);
            },
            onDuplicateFound: (duplicate) => {
                console.log("Duplicate found:", duplicate);
            },
            onFileGroupDetected: (group) => {
                console.log("File group detected:", group);
            },
        });

        importId.value = result.importId;

        // 导入完成
        isImporting.value = false;
        emit("import-complete", result);
    } catch (error) {
        console.error("Failed to start import:", error);
        isImporting.value = false;
    }
};

const cancelImportProcess = async () => {
    if (!importId.value) return;

    try {
        await cancelImport(importId.value);
        isImporting.value = false;
    } catch (error) {
        console.error("Failed to cancel import:", error);
    }
};

const pauseImportProcess = async () => {
    if (!importId.value) return;

    try {
        await pauseImport(importId.value);
        isPaused.value = true;
    } catch (error) {
        console.error("Failed to pause import:", error);
    }
};

const resumeImportProcess = async () => {
    if (!importId.value) return;

    try {
        await resumeImport(importId.value);
        isPaused.value = false;
    } catch (error) {
        console.error("Failed to resume import:", error);
    }
};

const closeDialog = () => {
    emit("update:show", false);
};

const isFileSelected = (path: string): boolean => {
    return filePreview.selectedFiles.has(path);
};

const toggleFileSelection = (group: FileGroup) => {
    const path = group.mainFile.path;
    if (filePreview.selectedFiles.has(path)) {
        filePreview.selectedFiles.delete(path);
    } else {
        filePreview.selectedFiles.add(path);
    }
};

// 格式化函数
const formatSize = (size: number): string => {
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    if (size < 1024 * 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
    return `${(size / (1024 * 1024 * 1024)).toFixed(1)} GB`;
};

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

// 监听器
watch(
    () => props.initialSourcePaths,
    (newPaths) => {
        if (newPaths && newPaths.length > 0) {
            sourcePaths.value = [...newPaths];
        }
    },
);

watch(
    () => props.initialTargetPath,
    (newPath) => {
        if (newPath) {
            targetPath.value = newPath;
        }
    },
);
</script>

<template>
    <!-- 主导入配置对话框 -->
    <BaseModal :open="showConfigModal" :title="t('import.title')" size="xl" @close="closeDialog">
        <div class="import-dialog space-y-6">
            <!-- 源目录选择 -->
            <div class="import-section">
                <h3 class="text-lg font-semibold text-[var(--color-text)] mb-4">
                    {{ t("import.sourceDirectories") }}
                </h3>
                <div class="space-y-3">
                    <div
                        v-for="(path, index) in sourcePaths"
                        :key="index"
                        class="flex items-center gap-2"
                    >
                        <BaseInput :model-value="path" readonly class="flex-1" />
                        <BaseButton variant="danger" size="sm" @click="removeSourcePath(index)">
                            <TrashIcon class="w-4 h-4" />
                        </BaseButton>
                    </div>
                    <BaseButton variant="secondary" class="w-full" @click="addSourceDirectory">
                        <PlusIcon class="w-4 h-4 mr-2" />
                        {{ t("import.addSource") }}
                    </BaseButton>
                </div>
            </div>

            <!-- 目标目录选择 -->
            <div class="import-section">
                <h3 class="text-lg font-semibold text-[var(--color-text)] mb-4">
                    {{ t("import.targetDirectory") }}
                </h3>
                <div class="flex gap-2">
                    <BaseSelect
                        v-model="targetPath"
                        :options="pathOptions"
                        :placeholder="t('import.selectTarget')"
                        class="flex-1"
                    />
                    <BaseButton @click="selectTargetDirectory">
                        <FolderOpenIcon class="w-4 h-4 mr-2" />
                        {{ t("import.browse") }}
                    </BaseButton>
                </div>
            </div>

            <!-- 导入选项 -->
            <div class="import-section">
                <h3 class="text-lg font-semibold text-[var(--color-text)] mb-4">
                    {{ t("import.options") }}
                </h3>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label class="block text-sm font-medium text-[var(--color-text)] mb-2">
                            {{ t("import.fileTypes.label") }}
                        </label>
                        <div class="space-y-2">
                            <BaseCheckbox
                                v-model="imageTypeSelected"
                                :label="t('import.fileTypes.images')"
                            />
                            <BaseCheckbox
                                v-model="videoTypeSelected"
                                :label="t('import.fileTypes.videos')"
                            />
                        </div>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-[var(--color-text)] mb-2">
                            {{ t("import.includeSubfolders") }}
                        </label>
                        <BaseSwitch
                            v-model="filters.includeSubfolders"
                            :label="t('import.includeSubfolders')"
                        />
                    </div>
                </div>
                <div class="mt-4">
                    <label class="block text-sm font-medium text-[var(--color-text)] mb-2">
                        {{ t("import.duplicateHandling") }}
                    </label>
                    <BaseSelect v-model="duplicateStrategy" :options="duplicateStrategyOptions" />
                </div>
            </div>

            <!-- 预览区域 -->
            <div v-if="showPreview && filePreview.files.length > 0" class="import-section">
                <h3 class="text-lg font-semibold text-[var(--color-text)] mb-4">
                    {{ t("import.preview") }}
                </h3>
                <div
                    class="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-[var(--color-bg-secondary)] rounded-lg mb-4"
                >
                    <div class="text-center">
                        <div class="text-2xl font-bold text-[var(--color-text)]">
                            {{ filePreview.totalCount }}
                        </div>
                        <div class="text-sm text-[var(--color-text-secondary)]">
                            {{ t("import.totalFiles") }}
                        </div>
                    </div>
                    <div class="text-center">
                        <div class="text-2xl font-bold text-[var(--color-text)]">
                            {{ formatSize(filePreview.totalSize) }}
                        </div>
                        <div class="text-sm text-[var(--color-text-secondary)]">
                            {{ t("import.totalSize") }}
                        </div>
                    </div>
                    <div class="text-center">
                        <div class="text-2xl font-bold text-[var(--color-text)]">
                            {{ filePreview.statistics.imageFiles }}
                        </div>
                        <div class="text-sm text-[var(--color-text-secondary)]">
                            {{ t("import.images") }}
                        </div>
                    </div>
                    <div class="text-center">
                        <div class="text-2xl font-bold text-[var(--color-text)]">
                            {{ filePreview.statistics.videoFiles }}
                        </div>
                        <div class="text-sm text-[var(--color-text-secondary)]">
                            {{ t("import.videos") }}
                        </div>
                    </div>
                </div>

                <!-- 文件预览列表 -->
                <div
                    class="max-h-96 overflow-y-auto border border-[var(--color-border)] rounded-lg"
                >
                    <div
                        v-for="group in filePreview.files.slice(0, 50)"
                        :key="group.mainFile.path"
                        class="flex items-center p-3 border-b border-[var(--color-border)] last:border-b-0 hover:bg-[var(--color-card-hover)] transition-colors"
                    >
                        <BaseCheckbox
                            :model-value="isFileSelected(group.mainFile.path)"
                            @update:model-value="toggleFileSelection(group)"
                            class="mr-3"
                        />
                        <div class="flex items-center mr-3">
                            <PhotoIcon
                                v-if="group.mainFile.type === 'image'"
                                class="w-8 h-8 text-[var(--color-primary)]"
                            />
                            <VideoCameraIcon
                                v-else-if="group.mainFile.type === 'video'"
                                class="w-8 h-8 text-[var(--color-primary)]"
                            />
                            <DocumentIcon
                                v-else
                                class="w-8 h-8 text-[var(--color-text-secondary)]"
                            />
                        </div>
                        <div class="flex-1 min-w-0">
                            <div class="flex items-center gap-2">
                                <p class="text-sm font-medium text-[var(--color-text)] truncate">
                                    {{ group.mainFile.name }}
                                </p>
                                <span
                                    v-if="group.type === 'group'"
                                    class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-[var(--color-primary)] text-white"
                                >
                                    {{ t("import.group", { count: group.files.length }) }}
                                </span>
                            </div>
                            <p class="text-sm text-[var(--color-text-secondary)]">
                                {{ formatSize(group.totalSize) }}
                                <span v-if="group.targetPath"> → {{ group.targetPath }} </span>
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            <!-- 进度显示 -->
            <div v-if="isImporting" class="import-section">
                <h3 class="text-lg font-semibold text-[var(--color-text)] mb-4">
                    {{ t("import.progress") }}
                </h3>
                <div class="space-y-4">
                    <!-- 进度条 -->
                    <div class="w-full bg-[var(--color-bg-secondary)] rounded-full h-2">
                        <div
                            class="bg-[var(--color-primary)] h-2 rounded-full transition-all duration-300"
                            :style="{
                                width: `${Math.round((importProgress.processedFiles / importProgress.totalFiles) * 100)}%`,
                            }"
                        ></div>
                    </div>

                    <!-- 进度信息 -->
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div class="text-center">
                            <div class="text-lg font-semibold text-[var(--color-text)]">
                                {{ importProgress.processedFiles }} /
                                {{ importProgress.totalFiles }}
                            </div>
                            <div class="text-sm text-[var(--color-text-secondary)]">
                                {{ t("import.processed") }}
                            </div>
                        </div>
                        <div class="text-center">
                            <div class="text-lg font-semibold text-[var(--color-text)]">
                                {{ formatSpeed(importProgress.speed) }}
                            </div>
                            <div class="text-sm text-[var(--color-text-secondary)]">
                                {{ t("import.speed") }}
                            </div>
                        </div>
                        <div class="text-center">
                            <div class="text-lg font-semibold text-[var(--color-text)]">
                                {{ formatTime(importProgress.estimatedTimeRemaining) }}
                            </div>
                            <div class="text-sm text-[var(--color-text-secondary)]">
                                {{ t("import.remaining") }}
                            </div>
                        </div>
                    </div>

                    <!-- 当前文件 -->
                    <div
                        v-if="importProgress.currentFile"
                        class="p-3 bg-[var(--color-bg-secondary)] rounded-lg"
                    >
                        <p class="text-sm text-[var(--color-text-secondary)]">
                            {{ t("import.processing") }}:
                            <span class="text-[var(--color-text)] font-medium">
                                {{ importProgress.currentFile }}
                            </span>
                        </p>
                    </div>
                </div>
            </div>
        </div>

        <!-- 操作按钮 -->
        <template #footer>
            <div class="flex justify-end gap-3">
                <BaseButton
                    v-if="!isImporting"
                    variant="secondary"
                    :disabled="!canPreview"
                    @click="previewImportFiles"
                >
                    <EyeIcon class="w-4 h-4 mr-2" />
                    {{ t("import.previewButton") }}
                </BaseButton>
                <BaseButton
                    v-if="!isImporting"
                    variant="primary"
                    :disabled="!canImport"
                    @click="startImport"
                >
                    <ArrowDownTrayIcon class="w-4 h-4 mr-2" />
                    {{ t("import.importButton") }}
                </BaseButton>
                <BaseButton
                    v-if="isImporting && !isPaused"
                    variant="secondary"
                    @click="pauseImportProcess"
                >
                    <PauseIcon class="w-4 h-4 mr-2" />
                    {{ t("import.pauseButton") }}
                </BaseButton>
                <BaseButton
                    v-if="isImporting && isPaused"
                    variant="primary"
                    @click="resumeImportProcess"
                >
                    <PlayIcon class="w-4 h-4 mr-2" />
                    {{ t("import.resumeButton") }}
                </BaseButton>
                <BaseButton
                    v-if="isImporting && canCancel"
                    variant="danger"
                    @click="cancelImportProcess"
                >
                    <StopIcon class="w-4 h-4 mr-2" />
                    {{ t("import.cancelButton") }}
                </BaseButton>
                <BaseButton variant="secondary" @click="closeDialog">
                    {{ t("import.closeButton") }}
                </BaseButton>
            </div>
        </template>
    </BaseModal>
</template>

<style scoped lang="less">
.import-dialog {
    .import-section {
        h3 {
            color: var(--color-text);
        }
    }
}
</style>

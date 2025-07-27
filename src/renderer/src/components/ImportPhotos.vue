<!--
  ImportPhotos Component

  A comprehensive wizard-based interface for importing photos and videos.

  Features:
  - Two-step wizard: Configuration → Preview
  - Source directory selection with validation
  - Target directory selection
  - File type filtering (images/videos)
  - Duplicate handling strategies
  - Real-time preview with file selection
  - Progress modal for import execution

  Props:
  - show: Controls wizard visibility
  - initialSourcePaths: Pre-populate source directories
  - initialTargetPath: Pre-populate target directory

  Events:
  - update:show: Emitted when wizard visibility changes
  - import-complete: Emitted when import process completes

  Usage:
  <ImportPhotos
    :show="showImportDialog"
    :initial-source-paths="['/path/to/photos']"
    :initial-target-path="'/path/to/library'"
    @update:show="showImportDialog = $event"
    @import-complete="handleImportComplete"
  />
-->

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { usePreferenceStore } from "@renderer/stores/preference";
import { chooseDirectories, previewImport } from "@renderer/utils/api";
import { getLogger } from "@common/logger";
import {
    createDefaultFilters,
    addSourceDirectories,
    removeSourceDirectory,
    updateFileTypeFilter,
    formatFileSize,
} from "@renderer/utils/import-helpers";
import {
    validateConfigurationStep,
    validatePreviewStep,
    createInitialConfigurationData,
    createInitialPreviewData,
    transformToImportConfig,
    transformPreviewResponse,
    createPreviewConfig,
} from "@renderer/utils/import-wizard-helpers";
import { storeToRefs } from "pinia";
import { useI18n } from "vue-i18n";
import {
    TrashIcon,
    PlusIcon,
    FolderOpenIcon,
    EyeIcon,
    ArrowDownTrayIcon,
    PhotoIcon,
    VideoCameraIcon,
    DocumentIcon,
} from "@heroicons/vue/24/outline";
import {
    BaseButton,
    BaseInput,
    BaseSelect,
    BaseCheckbox,
    BaseSwitch,
} from "@renderer/components/ui";
import { BaseWizard, createWizardStep, createWizardConfig } from "@renderer/components/wizard";
import ImportProgressModal from "./ImportProgressModal.vue";
import type { ImportConfig, DuplicateStrategy, ImportResult } from "@common/import-types";

/**
 * Component Props Definition
 */
interface ImportPhotosProps {
    /** Controls the visibility of the import wizard */
    show: boolean;
    /** Optional array of initial source directory paths */
    initialSourcePaths?: string[];
    /** Optional initial target directory path */
    initialTargetPath?: string;
}

const props = withDefaults(defineProps<ImportPhotosProps>(), {
    show: () => false,
    initialSourcePaths: () => [],
    initialTargetPath: () => "",
});

/**
 * Component Events Definition
 */
interface ImportPhotosEmits {
    /** Emitted when wizard visibility should change */
    (e: "update:show", show: boolean): void;
    /** Emitted when import process completes successfully */
    (e: "import-complete", result: ImportResult): void;
}

const emit = defineEmits<ImportPhotosEmits>();

// Logger instance for this component
const logger = getLogger("import-photos");

// Wizard state reference - declared early to avoid initialization order issues
const wizardStateRef = ref<any>(null);

// Debug logging for development and initialization
watch(
    () => props.show,
    (newValue) => {
        logger.debug("ImportPhotos show prop changed:", newValue);

        // Initialize wizard data when wizard opens
        if (newValue && wizardStateRef.value?.setStepData) {
            if (!wizardStateRef.value.stepData.configuration) {
                const configData = createInitialConfigurationData(
                    props.initialSourcePaths,
                    props.initialTargetPath,
                    store.paths,
                    excludePaths.value,
                );
                wizardStateRef.value.setStepData("configuration", configData);
            }
        }
    },
    { immediate: true },
);

const { t } = useI18n();
const store = usePreferenceStore();
const { paths, excludePaths } = storeToRefs(store);

// Wizard data storage - this will be managed by the wizard framework
// We'll access it through the stepData parameter in templates

// Import progress modal state
const showProgressModal = ref(false);
const importConfig = ref<ImportConfig | null>(null);

/**
 * Handle wizard completion - transform data and show progress modal
 * @param data - Wizard completion data containing all step data
 */
const handleWizardComplete = (data: any) => {
    const configData = data.configuration;
    const previewData = data.preview;

    // Validate both configuration and preview data
    if (validateConfigurationStep(configData) && validatePreviewStep(previewData)) {
        // Transform wizard data to import config using pure function
        importConfig.value = transformToImportConfig(configData, previewData);

        // Close wizard and show progress modal
        emit("update:show", false);
        showProgressModal.value = true;
    } else {
        logger.error("Invalid wizard data on completion", { configData, previewData });
    }
};

const handleWizardCancel = () => {
    // Close wizard
    emit("update:show", false);
};

// Initialize step data immediately
const initializeWizardData = () => {
    if (wizardStateRef.value?.setStepData) {
        const configData = createInitialConfigurationData(
            props.initialSourcePaths,
            props.initialTargetPath,
            store.paths,
            excludePaths.value,
        );
        const previewData = createInitialPreviewData();

        wizardStateRef.value.setStepData("configuration", configData);
        wizardStateRef.value.setStepData("preview", previewData);
    }
};

// Wizard configuration (only config and preview steps)
const wizardConfig = createWizardConfig({
    steps: [
        createWizardStep({
            id: "configuration",
            title: t("import.steps.configuration"),
            description: t("import.steps.configurationDesc"),
            isValid: (stepData: any) => {
                const isValid = validateConfigurationStep(stepData);
                logger.debug("Configuration step validation:", { stepData, isValid });
                return isValid;
            },
            onEnter: (stepData: any) => {
                // Initialize step data if not already present
                if (!stepData) {
                    const configData = createInitialConfigurationData(
                        props.initialSourcePaths,
                        props.initialTargetPath,
                        store.paths,
                        excludePaths.value,
                    );
                    // We need access to setStepData here, but it's not available in onEnter
                    // So we'll keep the template initialization as backup
                }
            },
        }),
        createWizardStep({
            id: "preview",
            title: t("import.steps.preview"),
            description: t("import.steps.previewDesc"),
            onEnter: async () => {
                // Preview data loading will be handled in the step change handler
            },
            isValid: (stepData: any) => {
                return validatePreviewStep(stepData);
            },
        }),
    ],
    onComplete: handleWizardComplete,
    onCancel: handleWizardCancel,
});

// Computed properties
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

/**
 * Wizard Step Helper Functions
 * These functions handle user interactions within the wizard steps
 */

/**
 * Add a new source directory through file dialog
 * @param stepData - Current step data
 * @param setStepData - Function to update step data
 */
const addSourceDirectory = async (
    stepData: any,
    setStepData: (stepId: string, data: any) => void,
) => {
    try {
        const result = await chooseDirectories(true);
        if (result.filePaths && result.filePaths.length > 0) {
            const newSourcePaths = addSourceDirectories(
                stepData.sourcePaths || [],
                result.filePaths,
            );
            setStepData("configuration", { ...stepData, sourcePaths: newSourcePaths });
        }
    } catch (error) {
        logger.error("Failed to choose directories:", error);
    }
};

/**
 * Remove a source directory by index
 * @param index - Index of the source path to remove
 * @param stepData - Current step data
 * @param setStepData - Function to update step data
 */
const removeSourcePath = (
    index: number,
    stepData: any,
    setStepData: (stepId: string, data: any) => void,
) => {
    const newSourcePaths = removeSourceDirectory(stepData.sourcePaths || [], index);
    setStepData("configuration", { ...stepData, sourcePaths: newSourcePaths });
};

/**
 * Select target directory through file dialog
 * @param stepData - Current step data
 * @param setStepData - Function to update step data
 */
const selectTargetDirectory = async (
    stepData: any,
    setStepData: (stepId: string, data: any) => void,
) => {
    try {
        const result = await chooseDirectories(false);
        if (result.filePaths && result.filePaths.length > 0) {
            setStepData("configuration", { ...stepData, targetPath: result.filePaths[0] });
        }
    } catch (error) {
        logger.error("Failed to choose target directory:", error);
    }
};

/**
 * Update file type filter (images/videos)
 * @param type - File type to update ('image' or 'video')
 * @param enabled - Whether the file type should be enabled
 * @param stepData - Current step data
 * @param setStepData - Function to update step data
 */
const updateFileType = (
    type: string,
    enabled: boolean,
    stepData: any,
    setStepData: (stepId: string, data: any) => void,
) => {
    const currentFilters = stepData.filters || createDefaultFilters(excludePaths.value);
    const updatedFilters = updateFileTypeFilter(currentFilters, type as any, enabled);
    setStepData("configuration", { ...stepData, filters: updatedFilters });
};

/**
 * Toggle file selection in preview step
 * @param filePath - Path of the file to toggle
 * @param selected - Whether the file should be selected
 * @param stepData - Current step data
 * @param setStepData - Function to update step data
 */
const toggleFileSelection = (
    filePath: string,
    selected: boolean,
    stepData: any,
    setStepData: (stepId: string, data: any) => void,
) => {
    const selectedFiles = new Set(stepData.selectedFiles || []);
    if (selected) {
        selectedFiles.add(filePath);
    } else {
        selectedFiles.delete(filePath);
    }
    setStepData("preview", { ...stepData, selectedFiles });
};

// Progress modal event handlers
const handleImportComplete = (result: ImportResult) => {
    showProgressModal.value = false;
    importConfig.value = null;
    emit("import-complete", result);
};

const handleImportCancel = () => {
    showProgressModal.value = false;
    importConfig.value = null;
};

/**
 * 处理向导步骤切换事件
 *
 * 关键修复说明：
 * - 该函数现在在步骤实际切换前被调用（之前是切换后）
 * - 这确保了每个步骤在用户进入前都有正确初始化的数据
 * - 特别解决了预览步骤因缺少配置数据而无法加载的问题
 *
 * @param stepId - 即将进入的步骤ID（'configuration' 或 'preview'）
 * @param stepIndex - 即将进入的步骤索引（0 或 1）
 * @param wizardState - 包含stepData和setStepData的向导状态对象
 */
const handleStepChange = async (stepId: string, stepIndex: number, wizardState: any) => {
    logger.debug(`=== Step Change Debug ===`);
    logger.debug(`Preparing for step: ${stepId} (${stepIndex})`);
    logger.debug("Current stepData:", wizardState.stepData);
    // 保存向导状态引用，供其他函数使用
    wizardStateRef.value = wizardState;
    // 确保配置步骤数据已初始化
    // 这是所有步骤的基础数据，包含源目录、目标目录、文件过滤器等

    if (!wizardState.stepData.configuration) {
        logger.debug("Initializing configuration data...");
        const configData = createInitialConfigurationData(
            props.initialSourcePaths,
            // 来自父组件的初始源路径
            props.initialTargetPath,
            // 来自父组件的初始目标路径
            store.paths,
            // 来自偏好设置的可用路径列表
            excludePaths.value,
            // 来自偏好设置的排除路径列表
        );
        wizardState.setStepData("configuration", configData);
    }
    // 处理预览步骤的特殊初始化和数据加载
    if (stepId === "preview") {
        logger.debug("Preparing preview step, initializing and loading data...");
        // 初始化空的预览数据结构（如果还不存在）
        if (!wizardState.stepData.preview) {
            const previewData = createInitialPreviewData();
            wizardState.setStepData("preview", previewData);
        }
        // 验证配置数据是否存在并有效，然后加载预览数据
        logger.debug("Configuration data:", wizardState.stepData.configuration);
        logger.debug("Configuration filters:", wizardState.stepData.configuration.filters);
        await loadPreviewData(wizardState);
    }
    logger.debug(`========================`);
};

/**
 * 从API加载预览数据
 *
 * 该函数基于用户在配置步骤中设置的参数调用后端API获取文件预览数据
 * 包括文件列表、统计信息、分组信息等，用于在预览步骤中展示
 *
 * @param wizardState - 包含stepData和setStepData的当前向导状态对象
 */
const loadPreviewData = async (wizardState: any) => {
    const configData = wizardState.stepData.configuration;

    // 在调用API前验证配置数据的完整性和有效性
    // 必须有有效的源目录、目标目录和文件过滤器设置
    if (!validateConfigurationStep(configData)) {
        logger.error("Invalid configuration data for preview");
        // 如果配置无效，设置空的预览数据并终止加载
        wizardState.setStepData("preview", createInitialPreviewData());
        return;
    }

    try {
        // 将向导配置数据转换为API调用所需的格式
        // 这是一个纯函数，确保数据转换的一致性和可测试性
        const config = createPreviewConfig(configData);

        // 调试：检查config对象的结构和可序列化性
        logger.debug("Preview config before API call:", config);
        logger.debug("Config filters:", config.filters);
        logger.debug("Config filters dateRange:", config.filters.dateRange);

        // 调用后端API获取预览数据
        // 该API会扫描源目录，应用过滤器，返回文件列表和统计信息
        const previewResponse = await previewImport(config);

        // 将API响应转换为前端组件所需的数据格式
        // 包括文件分组、选择状态、统计信息等
        const previewData = transformPreviewResponse(previewResponse);

        // 更新预览步骤的数据，触发UI重新渲染
        wizardState.setStepData("preview", previewData);
    } catch (error) {
        logger.error("Failed to load preview:", error);
        // 发生错误时设置空的预览数据，防止UI崩溃
        // 用户可以返回配置步骤修改设置后重试
        wizardState.setStepData("preview", createInitialPreviewData());
    }
};

/**
 * Initialize configuration step data with default values
 * @param setStepData - Function to set step data
 * @returns null (for template usage)
 */
const initializeConfigurationData = (setStepData: (stepId: string, data: any) => void) => {
    // Always initialize to ensure data is present
    const configData = createInitialConfigurationData(
        props.initialSourcePaths,
        props.initialTargetPath,
        store.paths,
        excludePaths.value,
    );
    setStepData("configuration", configData);
    return null; // Return null so it doesn't render anything
};

/**
 * Initialize preview step data with empty values
 * @param setStepData - Function to set step data
 * @returns null (for template usage)
 */
const initializePreviewData = (setStepData: (stepId: string, data: any) => void) => {
    const previewData = createInitialPreviewData();
    setStepData("preview", previewData);
    return null; // Return null so it doesn't render anything
};

// Initialize all step data when component mounts
const initializeAllStepData = (setStepData: (stepId: string, data: any) => void) => {
    initializeConfigurationData(setStepData);
    initializePreviewData(setStepData);
};
</script>

<template>
    <!-- Configuration Wizard -->
    <BaseWizard
        :open="show"
        :config="wizardConfig"
        size="custom"
        :persistent="true"
        :show-progress-bar="true"
        :show-step-descriptions="true"
        :show-navigation="false"
        style="--modal-width: 800px"
        @update:open="$emit('update:show', $event)"
        @complete="handleWizardComplete"
        @cancel="handleWizardCancel"
        @step-change="handleStepChange"
    >
        <!-- Configuration Step -->
        <template #configuration="{ stepData, setStepData }">
            <!-- Initialize step data if not present -->
            {{ !stepData ? initializeConfigurationData(setStepData) : null }}
            <div class="h-full overflow-y-auto space-y-6">
                <!-- Source directories -->
                <div>
                    <h3 class="text-lg font-semibold text-[var(--color-text)] mb-4">
                        {{ t("import.sourceDirectories") }}
                    </h3>
                    <div class="space-y-3">
                        <div
                            v-for="(path, index) in stepData?.sourcePaths || []"
                            :key="index"
                            class="flex items-center gap-2"
                        >
                            <BaseInput :model-value="path" readonly class="flex-1" />
                            <BaseButton
                                variant="danger"
                                size="sm"
                                @click="removeSourcePath(index, stepData || {}, setStepData)"
                            >
                                <TrashIcon class="w-4 h-4 text-current" />
                            </BaseButton>
                        </div>
                        <BaseButton
                            variant="secondary"
                            class="w-full"
                            @click="addSourceDirectory(stepData || {}, setStepData)"
                        >
                            <PlusIcon class="w-4 h-4 mr-2 text-current" />
                            {{ t("import.addSource") }}
                        </BaseButton>
                    </div>
                </div>

                <!-- Target directory -->
                <div>
                    <h3 class="text-lg font-semibold text-[var(--color-text)] mb-4">
                        {{ t("import.targetDirectory") }}
                    </h3>
                    <div class="flex gap-2">
                        <BaseSelect
                            :model-value="stepData?.targetPath || ''"
                            @update:model-value="
                                (value) =>
                                    setStepData('configuration', {
                                        ...(stepData || {}),
                                        targetPath: value,
                                    })
                            "
                            :options="pathOptions"
                            :placeholder="t('import.selectTarget')"
                            class="flex-1"
                        />
                        <BaseButton @click="selectTargetDirectory(stepData || {}, setStepData)">
                            <FolderOpenIcon class="w-4 h-4 mr-2 text-current" />
                            {{ t("import.browse") }}
                        </BaseButton>
                    </div>
                </div>

                <!-- Import options -->
                <div>
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
                                    :model-value="
                                        stepData?.filters?.fileTypes?.includes('image') || false
                                    "
                                    @update:model-value="
                                        (value) =>
                                            updateFileType(
                                                'image',
                                                value,
                                                stepData || {},
                                                setStepData,
                                            )
                                    "
                                    :label="t('import.fileTypes.images')"
                                />
                                <BaseCheckbox
                                    :model-value="
                                        stepData?.filters?.fileTypes?.includes('video') || false
                                    "
                                    @update:model-value="
                                        (value) =>
                                            updateFileType(
                                                'video',
                                                value,
                                                stepData || {},
                                                setStepData,
                                            )
                                    "
                                    :label="t('import.fileTypes.videos')"
                                />
                            </div>
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-[var(--color-text)] mb-2">
                                {{ t("import.includeSubfolders") }}
                            </label>
                            <BaseSwitch
                                :model-value="stepData?.filters?.includeSubfolders || false"
                                @update:model-value="
                                    (value) =>
                                        setStepData('configuration', {
                                            ...(stepData || {}),
                                            filters: {
                                                ...(stepData?.filters || {}),
                                                includeSubfolders: value,
                                            },
                                        })
                                "
                                :label="t('import.includeSubfolders')"
                            />
                        </div>
                    </div>
                    <div class="mt-4">
                        <label class="block text-sm font-medium text-[var(--color-text)] mb-2">
                            {{ t("import.duplicateHandling") }}
                        </label>
                        <BaseSelect
                            :model-value="stepData?.duplicateStrategy || 'rename'"
                            @update:model-value="
                                (value) =>
                                    setStepData('configuration', {
                                        ...(stepData || {}),
                                        duplicateStrategy: value,
                                    })
                            "
                            :options="duplicateStrategyOptions"
                        />
                    </div>
                </div>

                <!-- 额外的底部空间，确保下拉菜单有足够空间展开 -->
                <div class="pb-20"></div>
            </div>
        </template>

        <!-- Preview Step -->
        <template #preview="{ stepData, setStepData }">
            <!-- Initialize preview data if not present -->
            {{ !stepData ? initializeAllStepData(setStepData) : null }}
            <div class="h-full flex flex-col">
                <!-- Statistics -->
                <div class="flex-shrink-0 mb-4">
                    <div
                        class="grid grid-cols-2 lg:grid-cols-4 gap-4 p-4 bg-[var(--color-bg-secondary)] rounded-lg"
                    >
                        <div class="text-center">
                            <div class="text-2xl font-bold text-[var(--color-text)]">
                                {{ stepData?.totalCount || 0 }}
                            </div>
                            <div class="text-sm text-[var(--color-text-secondary)]">
                                {{ t("import.totalFiles") }}
                            </div>
                        </div>
                        <div class="text-center">
                            <div class="text-2xl font-bold text-[var(--color-text)]">
                                {{ formatFileSize(stepData?.totalSize || 0) }}
                            </div>
                            <div class="text-sm text-[var(--color-text-secondary)]">
                                {{ t("import.totalSize") }}
                            </div>
                        </div>
                        <div class="text-center">
                            <div class="text-2xl font-bold text-[var(--color-text)]">
                                {{ stepData?.statistics?.imageFiles || 0 }}
                            </div>
                            <div class="text-sm text-[var(--color-text-secondary)]">
                                {{ t("import.images") }}
                            </div>
                        </div>
                        <div class="text-center">
                            <div class="text-2xl font-bold text-[var(--color-text)]">
                                {{ stepData?.statistics?.videoFiles || 0 }}
                            </div>
                            <div class="text-sm text-[var(--color-text-secondary)]">
                                {{ t("import.videos") }}
                            </div>
                        </div>
                    </div>
                </div>

                <!-- File list -->
                <div class="flex-1 overflow-hidden">
                    <div
                        class="h-full overflow-y-auto border border-[var(--color-border)] rounded-lg"
                    >
                        <div
                            v-for="group in stepData?.files || []"
                            :key="group.mainFile.path"
                            class="flex items-center p-3 border-b border-[var(--color-border)] last:border-b-0 hover:bg-[var(--color-card-hover)] transition-colors"
                        >
                            <BaseCheckbox
                                :model-value="
                                    stepData?.selectedFiles?.has(group.mainFile.path) || false
                                "
                                @update:model-value="
                                    (value) =>
                                        toggleFileSelection(
                                            group.mainFile.path,
                                            value,
                                            stepData || {},
                                            setStepData,
                                        )
                                "
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
                                    <p
                                        class="text-sm font-medium text-[var(--color-text)] truncate"
                                    >
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
                                    {{ formatFileSize(group.totalSize) }}
                                    <span v-if="group.targetPath"> → {{ group.targetPath }}</span>
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </template>

        <!-- Custom Footer -->
        <template #footer="{ wizardState, goNext, goBack, finish, cancel }">
            <div class="flex justify-between">
                <div>
                    <BaseButton v-if="wizardState.canGoBack" variant="secondary" @click="goBack">
                        {{ t("import.backButton") }}
                    </BaseButton>
                </div>
                <div class="flex gap-3">
                    <!-- Configuration step -->
                    <BaseButton
                        v-if="wizardState.currentStep.id === 'configuration'"
                        variant="primary"
                        :disabled="!wizardState.canGoNext"
                        @click="goNext"
                    >
                        <EyeIcon class="w-4 h-4 mr-2 text-current" />
                        {{ t("import.nextButton") }}
                    </BaseButton>

                    <!-- Preview step -->
                    <BaseButton
                        v-if="wizardState.currentStep.id === 'preview'"
                        variant="primary"
                        :disabled="!wizardState.canFinish"
                        @click="finish"
                    >
                        <ArrowDownTrayIcon class="w-4 h-4 mr-2 text-current" />
                        {{ t("import.importButton") }}
                    </BaseButton>

                    <!-- Close button -->
                    <BaseButton variant="secondary" @click="cancel">
                        {{ t("import.closeButton") }}
                    </BaseButton>
                </div>
            </div>
        </template>
    </BaseWizard>

    <!-- Import Progress Modal -->
    <ImportProgressModal
        :show="showProgressModal"
        :config="importConfig"
        @complete="handleImportComplete"
        @cancel="handleImportCancel"
    />
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

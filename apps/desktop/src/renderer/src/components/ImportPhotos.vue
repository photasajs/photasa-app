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
import { computed, ref, watch, reactive } from "vue";
import { usePreferenceStore } from "@renderer/stores/preference";
import { chooseDirectories, previewImport, onPreviewProgress } from "@renderer/utils/api";
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
import { DuplicateStrategies, FileTypeDetectors } from "@common/constants";
import {
    PhTrash as TrashIcon,
    PhPlus as PlusIcon,
    PhFolderOpen as FolderOpenIcon,
    PhEye as EyeIcon,
    PhArrowDown as ArrowDownTrayIcon,
    PhImage as PhotoIcon,
    PhVideoCamera as VideoCameraIcon,
    PhFileText as DocumentIcon,
} from "@phosphor-icons/vue";
import {
    BaseButton,
    BaseInput,
    BaseSelect,
    BaseCheckbox,
    BaseSwitch,
    BaseAlert,
    BaseSpinner,
} from "@renderer/components/ui";
import { BaseWizard, createWizardStep, createWizardConfig } from "@renderer/components/wizard";
import VirtualList from "@renderer/components/ui/VirtualList.vue";
import ImportProgressModal from "./ImportProgressModal.vue";
import PreviewProgressDisplay from "./import/PreviewProgressDisplay.vue";
import type { ImportConfig, ImportResult, PreviewProgress } from "@common/import-types";

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

// Error state management
const errorState = reactive({
    hasError: false,
    errorType: null as "network" | "validation" | "permission" | "api" | "unknown" | null,
    errorMessage: "",
    canRetry: false,
    retryAction: null as (() => Promise<void>) | null,
    context: null as any,
});

// Loading state for different operations
const loadingState = reactive({
    preview: false,
    directories: false,
    validation: false,
});

// 预览进度状态
const previewProgress = reactive<PreviewProgress>({
    stage: "scanning",
    currentPath: "",
    filesFound: 0,
    directoriesScanned: 0,
    totalDirectories: 0,
    message: "",
});

// 已发现的文件列表
const discoveredFiles = reactive<any[]>([]);

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
        logger.error(
            `Invalid wizard data: configData=${!!configData}, previewData=${!!previewData}`,
        );
    }
};

const handleWizardCancel = () => {
    // Close wizard
    emit("update:show", false);
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
                logger.debug(`Configuration validation: valid=${isValid}`);
                return isValid;
            },
            onEnter: (stepData: any) => {
                // Initialize step data if not already present
                if (!stepData) {
                    createInitialConfigurationData(
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
    { value: DuplicateStrategies.RENAME, label: t("import.duplicate.rename") },
    { value: DuplicateStrategies.SKIP, label: t("import.duplicate.skip") },
    { value: DuplicateStrategies.OVERWRITE, label: t("import.duplicate.overwrite") },
    { value: DuplicateStrategies.KEEP_BOTH, label: t("import.duplicate.keepBoth") },
]);

/**
 * Error handling utility functions
 */

/**
 * Clear current error state
 */
const clearError = () => {
    errorState.hasError = false;
    errorState.errorType = null;
    errorState.errorMessage = "";
    errorState.canRetry = false;
    errorState.retryAction = null;
    errorState.context = null;
};

/**
 * Set error state with user-friendly message and recovery options
 * @param error - The error object or message
 * @param type - The type of error for appropriate handling
 * @param retryAction - Optional function to retry the failed operation
 * @param context - Additional context for error handling
 */
const setError = (
    error: any,
    type: "network" | "validation" | "permission" | "api" | "unknown",
    retryAction?: () => Promise<void>,
    context?: any,
) => {
    logger.error(`[${type}] Error occurred:`, error, context);

    errorState.hasError = true;
    errorState.errorType = type;
    errorState.context = context;
    errorState.canRetry = !!retryAction;
    errorState.retryAction = retryAction || null;

    // Generate user-friendly error messages
    switch (type) {
        case "network":
            errorState.errorMessage = t("import.error.network");
            break;
        case "validation":
            errorState.errorMessage = t("import.error.validation");
            break;
        case "permission":
            errorState.errorMessage = t("import.error.permission");
            break;
        case "api":
            errorState.errorMessage = t("import.error.api");
            break;
        default:
            errorState.errorMessage = error?.message || t("import.error.unknown");
    }
};

/**
 * Retry the failed operation
 */
const retryOperation = async () => {
    if (errorState.retryAction) {
        clearError();
        try {
            await errorState.retryAction();
        } catch (error) {
            // If retry fails, set error again
            setError(error, "unknown");
        }
    }
};

/**
 * Enhanced error handling for async operations
 * @param operation - The async operation to execute
 * @param errorType - The type of error for this operation
 * @param retryFn - Optional function to retry on failure
 * @param context - Additional context
 */
const executeWithErrorHandling = async <T,>(
    operation: () => Promise<T>,
    errorType: "network" | "validation" | "permission" | "api" | "unknown",
    retryFn?: () => Promise<void>,
    context?: any,
): Promise<T | null> => {
    try {
        clearError();
        return await operation();
    } catch (error) {
        setError(error, errorType, retryFn, context);
        return null;
    }
};

/**
 * Enhanced wizard step helper functions with error handling
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
    await executeWithErrorHandling(
        async () => {
            loadingState.directories = true;
            const result = await chooseDirectories(true);
            if (result.filePaths && result.filePaths.length > 0) {
                const newSourcePaths = addSourceDirectories(
                    stepData.sourcePaths || [],
                    result.filePaths,
                );
                setStepData("configuration", { ...stepData, sourcePaths: newSourcePaths });
            }
            return result;
        },
        "permission",
        () => addSourceDirectory(stepData, setStepData),
        { operation: "addSourceDirectory" },
    );

    loadingState.directories = false;
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
    await executeWithErrorHandling(
        async () => {
            loadingState.directories = true;
            const result = await chooseDirectories(false);
            if (result.filePaths && result.filePaths.length > 0) {
                setStepData("configuration", { ...stepData, targetPath: result.filePaths[0] });
            }
            return result;
        },
        "permission",
        () => selectTargetDirectory(stepData, setStepData),
        { operation: "selectTargetDirectory" },
    );

    loadingState.directories = false;
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
const handleStepChange = async (stepId: string, _stepIndex: number, wizardState: any) => {
    // Step change processing
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
        // Configuration data loaded
        await loadPreviewData(wizardState);
    }
};

/**
 * 从API加载预览数据 - 增强错误处理版本
 *
 * 该函数基于用户在配置步骤中设置的参数调用后端API获取文件预览数据
 * 包括文件列表、统计信息、分组信息等，用于在预览步骤中展示
 *
 * @param wizardState - 包含stepData和setStepData的当前向导状态对象
 */
const loadPreviewData = async (wizardState: any) => {
    const configData = wizardState.stepData.configuration;

    // 在调用API前验证配置数据的完整性和有效性
    if (!validateConfigurationStep(configData)) {
        setError(
            new Error("Configuration validation failed"),
            "validation",
            () => loadPreviewData(wizardState),
            { step: "preview", configData },
        );
        wizardState.setStepData("preview", createInitialPreviewData());
        return;
    }

    const result = await executeWithErrorHandling(
        async () => {
            loadingState.preview = true;
            logger.debug("Preview started, loadingState.preview set to true");

            // 重置预览进度状态
            Object.assign(previewProgress, {
                stage: "scanning",
                currentPath: "",
                filesFound: 0,
                directoriesScanned: 0,
                totalDirectories: 0,
                message: "开始扫描目录...",
            });
            logger.debug("Preview progress state reset:", previewProgress);

            // 清空已发现的文件列表
            discoveredFiles.splice(0);

            // 设置预览进度监听
            let cleanupProgress: (() => void) | null = null;
            try {
                cleanupProgress = onPreviewProgress((progress, files) => {
                    logger.debug(
                        `Preview progress: stage=${progress.stage}, filesFound=${progress.filesFound}, discoveredFiles=${progress.discoveredFiles?.length || 0}, currentCount=${discoveredFiles.length}`,
                    );

                    // 更新进度状态
                    Object.assign(previewProgress, progress);

                    // 检查progress中是否有discoveredFiles字段
                    const foundFiles = progress.discoveredFiles || files;
                    if (foundFiles && foundFiles.length > 0) {
                        logger.debug(
                            "Updating discovered files from",
                            discoveredFiles.length,
                            "to",
                            foundFiles.length,
                        );
                        // 实时更新文件列表，保持最新的50个文件
                        const newFiles = foundFiles.slice(-50);
                        discoveredFiles.splice(0, discoveredFiles.length, ...newFiles);
                        logger.debug(
                            "Discovered files updated, new count:",
                            discoveredFiles.length,
                        );
                    }
                });

                // 将向导配置数据转换为API调用所需的格式
                const config = createPreviewConfig(configData);

                logger.debug("Preview config before API call:", config);

                // 调用后端API获取预览数据
                const previewResponse = await previewImport(config);

                // 将API响应转换为前端组件所需的数据格式
                const previewData = transformPreviewResponse(previewResponse);

                // 更新预览步骤的数据，触发UI重新渲染
                wizardState.setStepData("preview", previewData);

                return previewData;
            } finally {
                // 清理预览进度监听器
                if (cleanupProgress) {
                    cleanupProgress();
                }
            }
        },
        "api",
        () => loadPreviewData(wizardState),
        { step: "preview", configData },
    );

    loadingState.preview = false;

    // 如果失败，设置空的预览数据
    if (!result) {
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

/**
 * 生成完整的目标路径，用于在UI中显示
 * @param relativePath - 相对路径（如 "2025/20250126"）
 * @param basePath - 基础目标目录（如 "/Users/photos"）
 * @returns 完整路径（如 "/Users/photos/2025/20250126"）
 */
const getFullTargetPath = (relativePath: string, basePath?: string): string => {
    if (!relativePath) return "";
    if (!basePath) return relativePath;

    // 使用路径分隔符拼接，确保不重复分隔符
    const separator = "/";
    const normalizedBase = basePath.endsWith(separator) ? basePath.slice(0, -1) : basePath;
    const normalizedRelative = relativePath.startsWith(separator)
        ? relativePath.slice(1)
        : relativePath;

    return `${normalizedBase}${separator}${normalizedRelative}`;
};
</script>

<template>
    <!-- Configuration Wizard -->
    <BaseWizard
        :open="show"
        :config="wizardConfig"
        size="4xl"
        :persistent="true"
        :show-progress-bar="true"
        :show-step-descriptions="true"
        :show-navigation="false"
        @update:open="$emit('update:show', $event)"
        @complete="handleWizardComplete"
        @cancel="handleWizardCancel"
        @step-change="handleStepChange"
    >
        <!-- Error Alert - shown at the top of wizard when there's an error -->
        <div v-if="errorState.hasError" class="mb-4">
            <BaseAlert
                type="error"
                :title="t('import.error.title')"
                :message="errorState.errorMessage"
                :dismissible="true"
                @dismiss="clearError"
            >
                <template #actions>
                    <BaseButton
                        v-if="errorState.canRetry"
                        variant="secondary"
                        size="sm"
                        @click="retryOperation"
                        class="mr-2"
                    >
                        {{ t("import.error.retry") }}
                    </BaseButton>
                    <BaseButton variant="secondary" size="sm" @click="clearError">
                        {{ t("import.error.dismiss") }}
                    </BaseButton>
                </template>
            </BaseAlert>
        </div>
        <!-- Configuration Step -->
        <template #configuration="{ stepData, setStepData }">
            <!-- Initialize step data if not present -->
            {{ !stepData ? initializeConfigurationData(setStepData) : null }}
            <div class="h-full overflow-y-auto scrollbar-theme space-y-6">
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
                                @click="
                                    removeSourcePath(Number(index), stepData || {}, setStepData)
                                "
                            >
                                <TrashIcon class="w-4 h-4 text-current" />
                            </BaseButton>
                        </div>
                        <BaseButton
                            variant="secondary"
                            class="w-full"
                            :disabled="loadingState.directories"
                            @click="addSourceDirectory(stepData || {}, setStepData)"
                            data-testid="add-source-button"
                        >
                            <BaseSpinner v-if="loadingState.directories" class="w-4 h-4 mr-2" />
                            <PlusIcon v-else class="w-4 h-4 mr-2 text-current" />
                            {{
                                loadingState.directories
                                    ? t("import.loading.label")
                                    : t("import.addSource")
                            }}
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
                        <BaseButton
                            :disabled="loadingState.directories"
                            @click="selectTargetDirectory(stepData || {}, setStepData)"
                        >
                            <BaseSpinner v-if="loadingState.directories" class="w-4 h-4 mr-2" />
                            <FolderOpenIcon v-else class="w-4 h-4 mr-2 text-current" />
                            {{
                                loadingState.directories
                                    ? t("import.loading.label")
                                    : t("import.browse")
                            }}
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
                    <div class="mt-4">
                        <label class="flex items-center space-x-2 text-sm text-[var(--color-text)]">
                            <input
                                type="checkbox"
                                :checked="stepData?.useMD5ForDuplicates || false"
                                @change="
                                    (event) =>
                                        setStepData('configuration', {
                                            ...(stepData || {}),
                                            useMD5ForDuplicates: (event.target as HTMLInputElement)
                                                .checked,
                                        })
                                "
                                class="rounded border-[var(--color-border)] text-[var(--color-primary)] focus:ring-[var(--color-primary)]"
                            />
                            <span>{{ t("import.useMD5ForDuplicates") }}</span>
                        </label>
                        <p class="mt-1 text-xs text-[var(--color-text-secondary)]">
                            {{ t("import.useMD5ForDuplicatesDescription") }}
                        </p>
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

            <!-- Loading State for Preview -->
            <div v-if="loadingState.preview" class="h-full">
                <PreviewProgressDisplay
                    :progress="previewProgress"
                    :discovered-files="discoveredFiles"
                />
            </div>

            <!-- Preview Content -->
            <div v-else class="h-full flex flex-col">
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
                    <!-- Use VirtualList for large file lists (>100 files) -->
                    <VirtualList
                        v-if="(stepData?.files || []).length > 100"
                        :items="stepData?.files || []"
                        :item-height="72"
                        :container-height="400"
                        :get-item-key="(group) => group.mainFile.path"
                        class="border border-[var(--color-border)] rounded-lg"
                    >
                        <template #default="{ item: group }">
                            <div
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
                                        v-if="group.mainFile.type === FileTypeDetectors.IMAGE"
                                        class="w-8 h-8 text-[var(--color-primary)]"
                                    />
                                    <VideoCameraIcon
                                        v-else-if="group.mainFile.type === FileTypeDetectors.VIDEO"
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
                                            class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-[var(--color-primary)] text-[var(--color-white)]"
                                        >
                                            {{ t("import.group", { count: group.files.length }) }}
                                        </span>
                                    </div>
                                    <p class="text-sm text-[var(--color-text-secondary)]">
                                        {{ formatFileSize(group.totalSize) }}
                                        <span v-if="group.targetPath">
                                            →
                                            {{
                                                getFullTargetPath(
                                                    group.targetPath,
                                                    stepData?.targetPath,
                                                )
                                            }}</span
                                        >
                                    </p>
                                </div>
                            </div>
                        </template>
                    </VirtualList>

                    <!-- Regular list for smaller file lists (≤100 files) -->
                    <div
                        v-else
                        class="h-full overflow-y-auto scrollbar-theme-thin border border-[var(--color-border)] rounded-lg"
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
                                    v-if="group.mainFile.type === FileTypeDetectors.IMAGE"
                                    class="w-8 h-8 text-[var(--color-primary)]"
                                />
                                <VideoCameraIcon
                                    v-else-if="group.mainFile.type === FileTypeDetectors.VIDEO"
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
                                        class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-[var(--color-primary)] text-[var(--color-white)]"
                                    >
                                        {{ t("import.group", { count: group.files.length }) }}
                                    </span>
                                </div>
                                <p class="text-sm text-[var(--color-text-secondary)]">
                                    {{ formatFileSize(group.totalSize) }}
                                    <span v-if="group.targetPath">
                                        →
                                        {{
                                            getFullTargetPath(
                                                group.targetPath,
                                                stepData?.targetPath,
                                            )
                                        }}</span
                                    >
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </template>

        <!-- Custom Footer -->
        <template #footer="{ wizardState, goNext, goBack, finish, cancel }">
            <div class="flex justify-center">
                <div class="flex gap-4">
                    <!-- Back Button -->
                    <BaseButton
                        v-if="wizardState.canGoBack"
                        variant="secondary"
                        @click="goBack"
                        class="min-w-[80px]"
                    >
                        {{ t("import.backButton") }}
                    </BaseButton>

                    <!-- Configuration step -->
                    <BaseButton
                        v-if="wizardState.currentStep.id === 'configuration'"
                        variant="primary"
                        :disabled="!wizardState.canGoNext"
                        @click="goNext"
                        class="min-w-[80px]"
                    >
                        <EyeIcon class="w-4 h-4 mr-2 text-current" />
                        {{ t("import.nextButton") }}
                    </BaseButton>

                    <!-- Preview step -->
                    <BaseButton
                        v-if="wizardState.currentStep.id === 'preview'"
                        variant="primary"
                        :disabled="!wizardState.canFinish || loadingState.preview"
                        @click="finish"
                        class="min-w-[80px]"
                    >
                        <ArrowDownTrayIcon
                            v-if="!loadingState.preview"
                            class="w-4 h-4 mr-2 text-current"
                        />
                        <BaseSpinner v-else class="w-4 h-4 mr-2" />
                        {{
                            loadingState.preview
                                ? t("import.loading.preview")
                                : t("import.importButton")
                        }}
                    </BaseButton>

                    <!-- Close Button -->
                    <BaseButton variant="secondary" @click="cancel" class="min-w-[80px]">
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

<script setup lang="ts">
import { ref, reactive, watch, computed, onMounted, onUnmounted } from "vue";
import { useI18n } from "vue-i18n";
import {
    executeImport,
    cancelImport,
    pauseImport,
    resumeImport,
    onImportProgress,
    onImportComplete,
    onImportError,
    removeImportListeners,
} from "@renderer/utils/api";
import { formatProcessingSpeed, formatRemainingTime } from "@renderer/utils/import-helpers";
import { createSerializableConfig } from "@renderer/utils/import-wizard-helpers";
import { BaseModal, BaseButton } from "@renderer/components/ui";
import {
    PhPause as PauseIcon,
    PhPlay as PlayIcon,
    PhStop as StopIcon,
    PhCheckCircle,
    PhWarning,
    PhXCircle,
} from "@phosphor-icons/vue";
import type { ImportConfig, ImportProgress, ImportResult } from "@common/import-types";
import { loggers } from "@common/logger";

interface Props {
    show: boolean;
    config: ImportConfig | null;
}

interface Emits {
    (e: "complete", result: ImportResult): void;
    (e: "cancel"): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const { t } = useI18n();
const logger = loggers.importProgress;

// Import state
const importId = ref("");
const isPaused = ref(false);
const canCancel = ref(true);
const isImporting = ref(false);

// Progress data
const importProgress = reactive<ImportProgress>({
    totalFiles: 0,
    processedFiles: 0,
    successfulFiles: 0,
    skippedFiles: 0,
    errorFiles: 0,
    speed: 0,
    estimatedTimeRemaining: 0,
    errors: [],
    warnings: [],
    status: "preparing",
    currentFile: "",
    remainingTime: 0,
    startTime: new Date(),
});

// Import result
const importResult = ref<ImportResult | null>(null);
const importError = ref<Error | null>(null);

// Event cleanup functions
let cleanupFunctions: Array<() => void> = [];

// Computed
const progressPercentage = computed(() => {
    if (importProgress.totalFiles === 0) return 0;
    return Math.round((importProgress.processedFiles / importProgress.totalFiles) * 100);
});

const statusIcon = computed(() => {
    switch (importProgress.status) {
        case "completed":
            return PhCheckCircle;
        case "failed":
        case "cancelled":
            return PhXCircle;
        case "paused":
            return PauseIcon;
        default:
            return null;
    }
});

const statusColor = computed(() => {
    switch (importProgress.status) {
        case "completed":
            return "text-green-500";
        case "failed":
        case "cancelled":
            return "text-red-500";
        case "paused":
            return "text-yellow-500";
        default:
            return "text-[var(--color-text)]";
    }
});

const canClose = computed(() => {
    return ["completed", "failed", "cancelled"].includes(importProgress.status);
});

// Methods
const startImport = async () => {
    if (!props.config) return;

    try {
        isImporting.value = true;
        importProgress.status = "preparing";
        logger.debug("Starting import process", { config: props.config });

        // Reset progress
        Object.assign(importProgress, {
            totalFiles: props.config.selectedFiles.length,
            processedFiles: 0,
            successfulFiles: 0,
            skippedFiles: 0,
            errorFiles: 0,
            speed: 0,
            estimatedTimeRemaining: 0,
            errors: [],
            warnings: [],
            currentFile: "",
        });

        // Set up event listeners
        const cleanupProgress = onImportProgress((progress) => {
            logger.debug("Progress update received:", progress);
            // Update all progress fields
            Object.assign(importProgress, {
                totalFiles: progress.totalFiles || importProgress.totalFiles,
                processedFiles: progress.processedFiles || 0,
                successfulFiles: progress.successfulFiles || 0,
                skippedFiles: progress.skippedFiles || 0,
                errorFiles: progress.errorFiles || 0,
                speed: progress.speed || 0,
                estimatedTimeRemaining: progress.estimatedTimeRemaining || 0,
                remainingTime: progress.remainingTime || progress.estimatedTimeRemaining || 0,
                currentFile: progress.currentFile || "",
                status: progress.status || "processing",
                errors: progress.errors || [],
                warnings: progress.warnings || [],
            });
        });

        const cleanupComplete = onImportComplete((result) => {
            logger.debug("Import completed:", result);
            importResult.value = result;

            // 更新最终统计数据
            Object.assign(importProgress, {
                successfulFiles: result.successfulFiles || 0,
                skippedFiles: result.skippedFiles || 0,
                errorFiles: result.errorFiles || 0,
                totalFiles: result.totalFiles || 0,
                processedFiles: result.totalFiles || 0,
                status: "completed",
            });

            isImporting.value = false;

            logger.debug(
                `Import completed with final stats - successful: ${importProgress.successfulFiles}, skipped: ${importProgress.skippedFiles}, errors: ${importProgress.errorFiles}`,
            );
        });

        const cleanupError = onImportError((error) => {
            logger.error("Import failed:", error);
            importError.value = error;
            importProgress.status = "failed";
            isImporting.value = false;
        });

        // Store cleanup functions
        cleanupFunctions = [cleanupProgress, cleanupComplete, cleanupError];

        // Serialize the config to handle Date objects properly for IPC transmission
        const serializableConfig = createSerializableConfig(props.config, false);

        // Start the import (returns importId immediately)
        const { importId: newImportId } = await executeImport(serializableConfig);
        importId.value = newImportId;

        logger.debug("Import started with ID:", importId.value);
    } catch (error) {
        logger.error("Import failed to start:", error);
        importError.value = error as Error;
        importProgress.status = "failed";
        isImporting.value = false;
    }
};

const pauseImportProcess = async () => {
    if (!importId.value) return;

    try {
        logger.debug("Pausing import:", importId.value);
        await pauseImport(importId.value);
        isPaused.value = true;
        importProgress.status = "paused";
    } catch (error) {
        logger.error("Failed to pause import:", error);
    }
};

const resumeImportProcess = async () => {
    if (!importId.value) return;

    try {
        logger.debug("Resuming import:", importId.value);
        await resumeImport(importId.value);
        isPaused.value = false;
        importProgress.status = "processing";
    } catch (error) {
        logger.error("Failed to resume import:", error);
    }
};

const cancelImportProcess = async () => {
    if (!importId.value) return;

    try {
        logger.debug("Cancelling import:", importId.value);
        await cancelImport(importId.value);
        importProgress.status = "cancelled";
        isImporting.value = false;
    } catch (error) {
        logger.error("Failed to cancel import:", error);
    }
};

const handleComplete = () => {
    if (importResult.value) {
        emit("complete", importResult.value);
    }
};

const handleCancel = () => {
    if (isImporting.value) {
        cancelImportProcess();
    } else {
        emit("cancel");
    }
};

// Watch for config changes to start import
watch(
    () => props.config,
    (newConfig) => {
        logger.debug("Config changed", { newConfig, show: props.show });
        if (newConfig && props.show) {
            logger.debug("Starting import...");
            startImport();
        }
    },
    { immediate: true },
);

// Watch progress changes for debugging
watch(
    () => importProgress,
    (newProgress) => {
        logger.debug("Progress updated", {
            status: newProgress.status,
            processedFiles: newProgress.processedFiles,
            totalFiles: newProgress.totalFiles,
            currentFile: newProgress.currentFile,
        });
    },
    { deep: true },
);

// Reset state when modal closes
watch(
    () => props.show,
    (show) => {
        if (!show) {
            logger.debug("Modal closed, cleaning up state");
            // Cleanup event listeners
            cleanupFunctions.forEach((cleanup) => cleanup());
            cleanupFunctions = [];

            // Reset state
            importId.value = "";
            isPaused.value = false;
            isImporting.value = false;
            importResult.value = null;
            importError.value = null;
            Object.assign(importProgress, {
                totalFiles: 0,
                processedFiles: 0,
                speed: 0,
                estimatedTimeRemaining: 0,
                errors: [],
                warnings: [],
                status: "preparing",
                currentFile: "",
            });
        }
    },
);

// Component lifecycle
onMounted(() => {
    logger.debug("ImportProgressModal mounted");
});

onUnmounted(() => {
    logger.debug("ImportProgressModal unmounting, cleaning up listeners");
    cleanupFunctions.forEach((cleanup) => cleanup());
    removeImportListeners();
});
</script>

<template>
    <BaseModal
        :open="show"
        :title="t('import.progress')"
        size="4xl"
        :closable="canClose"
        @close="handleCancel"
    >
        <div class="import-progress space-y-6">
            <!-- Status Header -->
            <div class="flex items-center justify-center space-x-3">
                <component :is="statusIcon" v-if="statusIcon" :class="['w-8 h-8', statusColor]" />
                <h3 :class="['text-lg font-semibold', statusColor]">
                    {{ t(`import.status.${importProgress.status}`) }}
                </h3>
            </div>

            <!-- Progress Bar -->
            <div class="space-y-2">
                <div class="flex justify-between text-sm">
                    <span>{{ t("import.progress") }}</span>
                    <span>{{ progressPercentage }}%</span>
                </div>
                <div class="w-full bg-[var(--color-bg-secondary)] rounded-full h-3">
                    <div
                        class="bg-[var(--color-primary)] h-3 rounded-full transition-all duration-300"
                        :style="{ width: `${progressPercentage}%` }"
                    ></div>
                </div>
            </div>

            <!-- Progress Statistics -->
            <div class="grid grid-cols-2 gap-4 min-w-0">
                <!-- Top Row -->
                <div class="text-center p-4 bg-[var(--color-bg-secondary)] rounded-lg min-w-0">
                    <div
                        class="text-lg font-semibold text-[var(--color-text)] whitespace-nowrap overflow-hidden text-ellipsis"
                    >
                        {{ importProgress.processedFiles }} / {{ importProgress.totalFiles }}
                    </div>
                    <div
                        class="text-sm text-[var(--color-text-secondary)] whitespace-nowrap overflow-hidden text-ellipsis"
                    >
                        {{ t("import.processed") }}
                    </div>
                </div>
                <div class="text-center p-4 bg-[var(--color-bg-secondary)] rounded-lg min-w-0">
                    <div
                        class="text-lg font-semibold text-[var(--color-text)] whitespace-nowrap overflow-hidden text-ellipsis"
                    >
                        {{ formatProcessingSpeed(importProgress.speed, t) }}
                    </div>
                    <div
                        class="text-sm text-[var(--color-text-secondary)] whitespace-nowrap overflow-hidden text-ellipsis"
                    >
                        {{ t("import.speed") }}
                    </div>
                </div>
            </div>

            <!-- Detailed Statistics -->
            <div class="grid grid-cols-4 gap-3 min-w-0 text-sm">
                <div class="text-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg min-w-0">
                    <div class="text-lg font-semibold text-green-600 dark:text-green-400">
                        {{ importProgress.successfulFiles }}
                    </div>
                    <div class="text-xs text-green-600/80 dark:text-green-400/80">
                        {{ t("import.successful") }}
                    </div>
                </div>
                <div class="text-center p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg min-w-0">
                    <div class="text-lg font-semibold text-yellow-600 dark:text-yellow-400">
                        {{ importProgress.skippedFiles }}
                    </div>
                    <div class="text-xs text-yellow-600/80 dark:text-yellow-400/80">
                        {{ t("import.skipped") }}
                    </div>
                </div>
                <div class="text-center p-3 bg-red-50 dark:bg-red-900/20 rounded-lg min-w-0">
                    <div class="text-lg font-semibold text-red-600 dark:text-red-400">
                        {{ importProgress.errorFiles }}
                    </div>
                    <div class="text-xs text-red-600/80 dark:text-red-400/80">
                        {{ t("import.errors") }}
                    </div>
                </div>
                <div class="text-center p-3 bg-[var(--color-bg-secondary)] rounded-lg min-w-0">
                    <div class="text-lg font-semibold text-[var(--color-text)]">
                        {{ formatRemainingTime(importProgress.estimatedTimeRemaining) }}
                    </div>
                    <div class="text-xs text-[var(--color-text-secondary)]">
                        {{ t("import.remaining") }}
                    </div>
                </div>
            </div>

            <!-- Current File -->
            <div
                v-if="importProgress.currentFile && isImporting"
                class="p-3 bg-[var(--color-bg-secondary)] rounded-lg"
            >
                <div class="text-sm text-[var(--color-text-secondary)] mb-1">
                    {{ t("import.processing") }}:
                </div>
                <div class="text-[var(--color-text)] font-medium truncate">
                    {{ importProgress.currentFile }}
                </div>
            </div>

            <!-- Errors and Warnings -->
            <div
                v-if="importProgress.errors.length > 0 || importProgress.warnings.length > 0"
                class="space-y-3"
            >
                <!-- Errors -->
                <div v-if="importProgress.errors.length > 0" class="space-y-2">
                    <div class="flex items-center space-x-2 text-red-500">
                        <PhXCircle class="w-5 h-5" />
                        <span class="font-medium"
                            >{{ t("import.errors") }} ({{ importProgress.errors.length }})</span
                        >
                    </div>
                    <div class="max-h-32 overflow-y-auto space-y-1">
                        <div
                            v-for="(error, index) in importProgress.errors"
                            :key="index"
                            class="text-sm p-2 bg-red-50 border border-red-200 rounded text-red-700"
                        >
                            {{ error.message || error }}
                        </div>
                    </div>
                </div>

                <!-- Warnings -->
                <div v-if="importProgress.warnings.length > 0" class="space-y-2">
                    <div class="flex items-center space-x-2 text-yellow-500">
                        <PhWarning class="w-5 h-5" />
                        <span class="font-medium"
                            >{{ t("import.warnings") }} ({{ importProgress.warnings.length }})</span
                        >
                    </div>
                    <div class="max-h-32 overflow-y-auto space-y-1">
                        <div
                            v-for="(warning, index) in importProgress.warnings"
                            :key="index"
                            class="text-sm p-2 bg-yellow-50 border border-yellow-200 rounded text-yellow-700"
                        >
                            {{ warning.message || warning }}
                        </div>
                    </div>
                </div>
            </div>

            <!-- Import Error -->
            <div v-if="importError" class="p-3 bg-red-50 border border-red-200 rounded">
                <div class="flex items-center space-x-2 text-red-500 mb-2">
                    <PhXCircle class="w-5 h-5" />
                    <span class="font-medium">{{ t("import.importFailed") }}</span>
                </div>
                <div class="text-sm text-red-700">
                    {{ importError.message }}
                </div>
            </div>

            <!-- Success Message -->
            <div
                v-if="importProgress.status === 'completed'"
                class="p-3 bg-green-50 border border-green-200 rounded"
            >
                <div class="flex items-center space-x-2 text-green-500 mb-2">
                    <PhCheckCircle class="w-5 h-5" />
                    <span class="font-medium">{{ t("import.importCompleted") }}</span>
                </div>
                <div class="text-sm text-green-700">
                    {{ t("import.importCompletedDesc", { count: importProgress.processedFiles }) }}
                </div>
            </div>
        </div>

        <!-- Footer Actions -->
        <template #footer>
            <div class="flex justify-end space-x-3">
                <!-- Active Import Controls -->
                <template v-if="isImporting">
                    <BaseButton v-if="!isPaused" variant="secondary" @click="pauseImportProcess">
                        <PauseIcon class="w-4 h-4 mr-2" />
                        {{ t("import.pauseButton") }}
                    </BaseButton>
                    <BaseButton v-if="isPaused" variant="primary" @click="resumeImportProcess">
                        <PlayIcon class="w-4 h-4 mr-2" />
                        {{ t("import.resumeButton") }}
                    </BaseButton>
                    <BaseButton v-if="canCancel" variant="danger" @click="cancelImportProcess">
                        <StopIcon class="w-4 h-4 mr-2" />
                        {{ t("import.cancelButton") }}
                    </BaseButton>
                </template>

                <!-- Completed State Controls -->
                <template v-else>
                    <BaseButton
                        v-if="importProgress.status === 'completed'"
                        variant="primary"
                        @click="handleComplete"
                    >
                        {{ t("import.doneButton") }}
                    </BaseButton>
                    <BaseButton v-else variant="secondary" @click="handleCancel">
                        {{ t("import.closeButton") }}
                    </BaseButton>
                </template>
            </div>
        </template>
    </BaseModal>
</template>

<style scoped>
.import-progress {
    min-height: 200px;
}
</style>

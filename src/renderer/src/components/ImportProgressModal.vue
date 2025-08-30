<script setup lang="ts">
import { ref, reactive, watch, computed } from "vue";
import { useI18n } from "vue-i18n";
import { executeImport, cancelImport, pauseImport, resumeImport } from "@renderer/utils/api";
import { formatProcessingSpeed, formatRemainingTime } from "@renderer/utils/import-helpers";
import { BaseModal, BaseButton } from "@renderer/components/ui";
import {
    PauseIcon,
    PlayIcon,
    StopIcon,
    CheckCircleIcon,
    ExclamationTriangleIcon,
    XCircleIcon,
} from "@heroicons/vue/24/outline";
import type { ImportConfig, ImportProgress, ImportResult } from "@common/import-types";

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

// Import state
const importId = ref("");
const isPaused = ref(false);
const canCancel = ref(true);
const isImporting = ref(false);

// Progress data
const importProgress = reactive<ImportProgress>({
    totalFiles: 0,
    processedFiles: 0,
    speed: 0,
    estimatedTimeRemaining: 0,
    errors: [],
    warnings: [],
    status: "preparing",
    currentFile: "",
});

// Import result
const importResult = ref<ImportResult | null>(null);
const importError = ref<Error | null>(null);

// Computed
const progressPercentage = computed(() => {
    if (importProgress.totalFiles === 0) return 0;
    return Math.round((importProgress.processedFiles / importProgress.totalFiles) * 100);
});

const statusIcon = computed(() => {
    switch (importProgress.status) {
        case "completed":
            return CheckCircleIcon;
        case "failed":
        case "cancelled":
            return XCircleIcon;
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

        // Reset progress
        Object.assign(importProgress, {
            totalFiles: props.config.selectedFiles.length,
            processedFiles: 0,
            speed: 0,
            estimatedTimeRemaining: 0,
            errors: [],
            warnings: [],
            currentFile: "",
        });

        const result = await executeImport(props.config, {
            onProgress: (progress) => {
                Object.assign(importProgress, {
                    ...progress,
                    status: progress.status || "processing",
                });
            },
            onDuplicateFound: (duplicate) => {
                console.log("Duplicate found:", duplicate);
                // Could show duplicate resolution UI here
            },
            onFileGroupDetected: (group) => {
                console.log("File group detected:", group);
            },
        });

        importId.value = result.importId;
        importResult.value = result;
        importProgress.status = "completed";
        isImporting.value = false;

        // Auto-close after successful completion (optional)
        setTimeout(() => {
            if (importProgress.status === "completed") {
                handleComplete();
            }
        }, 2000);
    } catch (error) {
        console.error("Import failed:", error);
        importError.value = error as Error;
        importProgress.status = "failed";
        isImporting.value = false;
    }
};

const pauseImportProcess = async () => {
    if (!importId.value) return;

    try {
        await pauseImport(importId.value);
        isPaused.value = true;
        importProgress.status = "paused";
    } catch (error) {
        console.error("Failed to pause import:", error);
    }
};

const resumeImportProcess = async () => {
    if (!importId.value) return;

    try {
        await resumeImport(importId.value);
        isPaused.value = false;
        importProgress.status = "processing";
    } catch (error) {
        console.error("Failed to resume import:", error);
    }
};

const cancelImportProcess = async () => {
    if (!importId.value) return;

    try {
        await cancelImport(importId.value);
        importProgress.status = "cancelled";
        isImporting.value = false;
    } catch (error) {
        console.error("Failed to cancel import:", error);
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
        if (newConfig && props.show) {
            startImport();
        }
    },
    { immediate: true },
);

// Reset state when modal closes
watch(
    () => props.show,
    (show) => {
        if (!show) {
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
</script>

<template>
    <BaseModal
        :open="show"
        :title="t('import.progress')"
        size="md"
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
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div class="text-center p-3 bg-[var(--color-bg-secondary)] rounded-lg">
                    <div class="text-lg font-semibold text-[var(--color-text)]">
                        {{ importProgress.processedFiles }} / {{ importProgress.totalFiles }}
                    </div>
                    <div class="text-sm text-[var(--color-text-secondary)]">
                        {{ t("import.processed") }}
                    </div>
                </div>
                <div class="text-center p-3 bg-[var(--color-bg-secondary)] rounded-lg">
                    <div class="text-lg font-semibold text-[var(--color-text)]">
                        {{ formatProcessingSpeed(importProgress.speed) }}
                    </div>
                    <div class="text-sm text-[var(--color-text-secondary)]">
                        {{ t("import.speed") }}
                    </div>
                </div>
                <div class="text-center p-3 bg-[var(--color-bg-secondary)] rounded-lg">
                    <div class="text-lg font-semibold text-[var(--color-text)]">
                        {{ formatRemainingTime(importProgress.estimatedTimeRemaining) }}
                    </div>
                    <div class="text-sm text-[var(--color-text-secondary)]">
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
                        <XCircleIcon class="w-5 h-5" />
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
                        <ExclamationTriangleIcon class="w-5 h-5" />
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
                    <XCircleIcon class="w-5 h-5" />
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
                    <CheckCircleIcon class="w-5 h-5" />
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

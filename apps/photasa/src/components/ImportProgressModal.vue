<script setup lang="ts">
/**
 * RFC 0118 — 导入进度模态：start 执行一次；reattach 只接会话；Dismiss ≠ Cancel
 */
import { ref, reactive, watch, computed, onUnmounted } from "vue";
import { storeToRefs } from "pinia";
import { useI18n } from "vue-i18n";
import { executeImport, cancelImport, pauseImport, resumeImport } from "@renderer/utils/api";
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
import type { ImportConfig, ImportProgress, ImportResult } from "@photasa/common";
import { loggers } from "@photasa/common";
import { IMPORT_ALREADY_RUNNING, useImportSessionStore } from "@renderer/stores/import-session";
import { notification } from "@renderer/services/notification-manager";
import {
    IMPORT_MODAL_MODE_REATTACH,
    IMPORT_MODAL_MODE_START,
    type ImportModalMode,
} from "@renderer/constants/import-modal";

interface Props {
    show: boolean;
    config: ImportConfig | null;
    /** start：execute 一次；reattach：只 hydrate，禁止再 execute */
    mode?: ImportModalMode;
}

interface Emits {
    (e: "complete", result: ImportResult): void;
    /** 用户点 Cancel/Stop 或终态关闭 */
    (e: "cancel"): void;
    /** 后台继续：关模态，不 cancel */
    (e: "dismiss"): void;
}

const props = withDefaults(defineProps<Props>(), {
    mode: IMPORT_MODAL_MODE_START,
});
const emit = defineEmits<Emits>();

const { t } = useI18n();
const logger = loggers.importProgress;
const session = useImportSessionStore();
const {
    importId: sessionImportId,
    phase,
    result: sessionResult,
    error: sessionError,
} = storeToRefs(session);

/** 本地展示缓冲（与 session.progress 同步） */
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

const importResult = ref<ImportResult | null>(null);
const importError = ref<Error | null>(null);
const isPaused = ref(false);
/** 防 G1：同一次 show 周期内只 execute 一次 */
const startAttempted = ref(false);

const progressPercentage = computed(() => {
    if (importProgress.totalFiles === 0) return 0;
    return Math.round((importProgress.processedFiles / importProgress.totalFiles) * 100);
});

const isImporting = computed(
    () =>
        phase.value === "running" ||
        phase.value === "paused" ||
        importProgress.status === "preparing",
);

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

/** RFC 0118：运行中也可关（Dismiss） */
const canClose = computed(() => true);

function applySnapshot(snapshot: ImportProgress | null): void {
    if (!snapshot) return;
    Object.assign(importProgress, {
        totalFiles: snapshot.totalFiles ?? 0,
        processedFiles: snapshot.processedFiles ?? 0,
        successfulFiles: snapshot.successfulFiles ?? 0,
        skippedFiles: snapshot.skippedFiles ?? 0,
        errorFiles: snapshot.errorFiles ?? 0,
        speed: snapshot.speed ?? 0,
        estimatedTimeRemaining: snapshot.estimatedTimeRemaining ?? 0,
        remainingTime: snapshot.remainingTime ?? snapshot.estimatedTimeRemaining ?? 0,
        currentFile: snapshot.currentFile ?? "",
        status: snapshot.status ?? "processing",
        errors: snapshot.errors ?? [],
        warnings: snapshot.warnings ?? [],
        startTime: snapshot.startTime ?? importProgress.startTime,
    });
    isPaused.value = snapshot.status === "paused" || phase.value === "paused";
}

function hydrateFromSession(): void {
    applySnapshot(session.hydrateFromSession());
    importResult.value = sessionResult.value;
    importError.value = sessionError.value instanceof Error ? sessionError.value : null;
    if (phase.value === "completed" && sessionResult.value) {
        Object.assign(importProgress, {
            status: "completed",
            successfulFiles: sessionResult.value.successfulFiles ?? importProgress.successfulFiles,
            skippedFiles: sessionResult.value.skippedFiles ?? importProgress.skippedFiles,
            errorFiles: sessionResult.value.errorFiles ?? importProgress.errorFiles,
            totalFiles: sessionResult.value.totalFiles ?? importProgress.totalFiles,
            processedFiles: sessionResult.value.totalFiles ?? importProgress.processedFiles,
        });
    }
}

const startImport = async (): Promise<void> => {
    if (!props.config || startAttempted.value) return;
    startAttempted.value = true;

    try {
        session.assertCanStart();
        importError.value = null;
        importResult.value = null;
        importProgress.status = "preparing";
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

        const serializableConfig = createSerializableConfig(props.config, false);
        const { importId: newImportId } = await executeImport(serializableConfig);
        await session.begin(newImportId, {
            totalFiles: props.config.selectedFiles.length,
            status: "processing",
        });
        logger.debug("📚 导入已开衙，会话就位", newImportId);
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (message === IMPORT_ALREADY_RUNNING) {
            logger.warn("⚠️ 已有导入在衙，拒开新导入");
            notification.warning({
                title: t("import.importAlreadyRunning"),
                message: t("import.importAlreadyRunningDesc"),
            });
            emit("dismiss");
            return;
        }
        logger.error("❌ 导入未能开衙", error);
        importError.value = error as Error;
        importProgress.status = "failed";
        session.fail(error);
    }
};

const pauseImportProcess = async (): Promise<void> => {
    const id = sessionImportId.value;
    if (!id) return;
    try {
        await pauseImport(id);
        isPaused.value = true;
        importProgress.status = "paused";
        session.setPaused(true);
    } catch (error) {
        logger.error("❌ 暂停导入失败", error);
    }
};

const resumeImportProcess = async (): Promise<void> => {
    const id = sessionImportId.value;
    if (!id) return;
    try {
        await resumeImport(id);
        isPaused.value = false;
        importProgress.status = "processing";
        session.setPaused(false);
    } catch (error) {
        logger.error("❌ 继续导入失败", error);
    }
};

const cancelImportProcess = async (): Promise<void> => {
    const id = sessionImportId.value;
    if (!id) return;
    try {
        await cancelImport(id);
        importProgress.status = "cancelled";
        session.markCancelled();
        emit("cancel");
    } catch (error) {
        logger.error("❌ 取消导入失败", error);
    }
};

/** 后台继续：关窗不 cancel */
const handleDismiss = (): void => {
    logger.info("📚 进度模态后台继续，不取消导入", sessionImportId.value);
    session.setModalVisible(false);
    emit("dismiss");
};

const handleComplete = (): void => {
    if (importResult.value || sessionResult.value) {
        emit("complete", (importResult.value ?? sessionResult.value)!);
    }
    logger.info("📚 导入完成确认，清会话");
    session.clear();
};

const handleTerminalClose = (): void => {
    if (importProgress.status === "completed") {
        handleComplete();
        return;
    }
    logger.info("📚 终态关闭进度模态", importProgress.status);
    session.clear();
    emit("cancel");
};

watch(
    () => session.progress,
    (next) => {
        if (next) applySnapshot(next);
    },
    { deep: true },
);

watch(
    () => sessionResult.value,
    (res) => {
        if (!res) return;
        importResult.value = res;
        Object.assign(importProgress, {
            successfulFiles: res.successfulFiles ?? 0,
            skippedFiles: res.skippedFiles ?? 0,
            errorFiles: res.errorFiles ?? 0,
            totalFiles: res.totalFiles ?? 0,
            processedFiles: res.totalFiles ?? 0,
            status: "completed",
        });
    },
);

watch(
    () => sessionError.value,
    (err) => {
        if (!err) return;
        importError.value = err instanceof Error ? err : new Error(String(err));
        importProgress.status = "failed";
    },
);

watch(
    () => phase.value,
    (p) => {
        if (p === "cancelled") importProgress.status = "cancelled";
        if (p === "paused") {
            isPaused.value = true;
            importProgress.status = "paused";
        }
        if (p === "running") isPaused.value = false;
    },
);

watch(
    () => props.show,
    (show) => {
        session.setModalVisible(show);
        if (!show) {
            startAttempted.value = false;
            return;
        }
        if (props.mode === IMPORT_MODAL_MODE_REATTACH) {
            logger.info("📚 进度模态 reattach，不重跑 execute");
            hydrateFromSession();
            return;
        }
        if (props.config && !startAttempted.value) {
            logger.info("📚 进度模态 start，即将 executeImport");
            void startImport();
        }
    },
    { immediate: true },
);

onUnmounted(() => {
    // 只清 UI 标记；会话监听由 store 持有，禁止 removeImportListeners
    session.setModalVisible(false);
    logger.debug("📚 进度模态散衙，会话监听仍在");
});
</script>

<template>
    <BaseModal
        :open="show"
        :title="t('import.progress')"
        size="4xl"
        :closable="canClose"
        @close="handleDismiss"
    >
        <div class="import-progress space-y-6">
            <div class="flex items-center justify-center space-x-3">
                <component :is="statusIcon" v-if="statusIcon" :class="['w-8 h-8', statusColor]" />
                <h3 :class="['text-lg font-semibold', statusColor]">
                    {{ t(`import.status.${importProgress.status}`) }}
                </h3>
            </div>

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

            <div class="grid grid-cols-2 gap-4 min-w-0">
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

            <div
                v-if="importProgress.errors.length > 0 || importProgress.warnings.length > 0"
                class="space-y-3"
            >
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

            <div v-if="importError" class="p-3 bg-red-50 border border-red-200 rounded">
                <div class="flex items-center space-x-2 text-red-500 mb-2">
                    <PhXCircle class="w-5 h-5" />
                    <span class="font-medium">{{ t("import.importFailed") }}</span>
                </div>
                <div class="text-sm text-red-700">
                    {{ importError.message }}
                </div>
            </div>

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

        <template #footer>
            <div class="flex justify-end space-x-3">
                <template v-if="isImporting">
                    <BaseButton variant="secondary" @click="handleDismiss">
                        {{ t("import.runInBackground") }}
                    </BaseButton>
                    <BaseButton v-if="!isPaused" variant="secondary" @click="pauseImportProcess">
                        <PauseIcon class="w-4 h-4 mr-2" />
                        {{ t("import.pauseButton") }}
                    </BaseButton>
                    <BaseButton v-if="isPaused" variant="primary" @click="resumeImportProcess">
                        <PlayIcon class="w-4 h-4 mr-2" />
                        {{ t("import.resumeButton") }}
                    </BaseButton>
                    <BaseButton variant="danger" @click="cancelImportProcess">
                        <StopIcon class="w-4 h-4 mr-2" />
                        {{ t("import.cancelButton") }}
                    </BaseButton>
                </template>

                <template v-else>
                    <BaseButton
                        v-if="importProgress.status === 'completed'"
                        variant="primary"
                        @click="handleComplete"
                    >
                        {{ t("import.doneButton") }}
                    </BaseButton>
                    <BaseButton v-else variant="secondary" @click="handleTerminalClose">
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

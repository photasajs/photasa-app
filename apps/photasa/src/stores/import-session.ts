/**
 * RFC 0118 — 单飞导入会话（Photasa）
 * 进度监听挂在本 store，不走 modal 的 removeImportListeners。
 */

import { defineStore } from "pinia";
import { computed, ref } from "vue";
import { listen } from "@tauri-apps/api/event";
import type { ImportProgress, ImportResult } from "@photasa/common";
import { normalizeImportProgressPayload } from "@renderer/api/import.adapter";
import { isTauri } from "@renderer/api/env";
import { notification } from "@renderer/services/notification-manager";
import { loggers } from "@photasa/common";

const logger = loggers.importProgress;

export type ImportSessionPhase =
    | "idle"
    | "running"
    | "paused"
    | "completed"
    | "failed"
    | "cancelled";

type Unlisten = () => void;

/** Rust `import:error` payload：{message, importId}，非 JS Error */
function normalizeImportErrorPayload(payload: unknown): Error {
    if (payload instanceof Error) return payload;
    if (payload && typeof payload === "object" && "message" in payload) {
        const message = (payload as { message?: unknown }).message;
        if (typeof message === "string") return new Error(message);
    }
    return new Error(String(payload ?? "未知错误"));
}

/** 单飞冲突错误码（UI / 调用方匹配） */
export const IMPORT_ALREADY_RUNNING = "IMPORT_ALREADY_RUNNING" as const;

export const useImportSessionStore = defineStore("importSession", () => {
    const importId = ref<string | null>(null);
    const phase = ref<ImportSessionPhase>("idle");
    const progress = ref<ImportProgress | null>(null);
    const result = ref<ImportResult | null>(null);
    const error = ref<unknown>(null);
    const startedAt = ref(0);
    /** 模态是否正在显示（用于完成后是否 toast） */
    const modalVisible = ref(false);
    /** App/ImportPhotos：请求以 reattach 打开进度模态 */
    const openModalRequest = ref(0);

    let progressUnlisten: Unlisten | null = null;
    let completeUnlisten: Unlisten | null = null;
    let errorUnlisten: Unlisten | null = null;

    /** 运行中 / 暂停中不可再开新导入 */
    const canStart = computed(() => phase.value !== "running" && phase.value !== "paused");

    const isActive = computed(() => phase.value === "running" || phase.value === "paused");

    const isTerminal = computed(
        () =>
            phase.value === "completed" || phase.value === "failed" || phase.value === "cancelled",
    );

    /** 活跃或终态未清时显示 chip */
    const showChip = computed(() => isActive.value || isTerminal.value);

    const progressPercent = computed(() => {
        const p = progress.value;
        if (!p || !p.totalFiles) return 0;
        return Math.round((p.processedFiles / p.totalFiles) * 100);
    });

    function stopListeners(): void {
        progressUnlisten?.();
        completeUnlisten?.();
        errorUnlisten?.();
        progressUnlisten = null;
        completeUnlisten = null;
        errorUnlisten = null;
    }

    async function startListeners(): Promise<void> {
        stopListeners();
        if (!isTauri()) {
            logger.debug("📚 非 Tauri：跳过导入会话事件监听");
            return;
        }
        progressUnlisten = await listen<unknown>("import:progress", (event) => {
            const next = normalizeImportProgressPayload(event.payload);
            if (next.importId && next.importId !== importId.value) {
                logger.warn("📚 收到不匹配的 import:progress 丢弃", {
                    eventId: next.importId,
                    currentId: importId.value,
                });
                return;
            }
            applyProgress(next);
        });
        completeUnlisten = await listen<unknown>("import:complete", (event) => {
            const res = event.payload as ImportResult | null;
            if (res && res.importId && res.importId !== importId.value) {
                logger.warn("📚 收到不匹配的 import:complete 丢弃", {
                    eventId: res.importId,
                    currentId: importId.value,
                });
                return;
            }
            complete(res as ImportResult);
        });
        errorUnlisten = await listen<unknown>("import:error", (event) => {
            const payload = event.payload as { importId?: string } | null;
            if (payload && payload.importId && payload.importId !== importId.value) {
                logger.warn("📚 收到不匹配的 import:error 丢弃", {
                    eventId: payload.importId,
                    currentId: importId.value,
                });
                return;
            }
            fail(normalizeImportErrorPayload(event.payload));
        });
        logger.debug("📚 导入会话事件监听已挂起");
    }

    function applyProgress(next: ImportProgress): void {
        if (phase.value === "cancelled") return;
        progress.value = { ...next };
        if (next.status === "paused") {
            phase.value = "paused";
        } else if (next.status === "cancelled") {
            phase.value = "cancelled";
        } else if (
            phase.value !== "paused" &&
            (next.status === "processing" || next.status === "preparing")
        ) {
            phase.value = "running";
        }
    }

    function setPaused(paused: boolean): void {
        if (!isActive.value && phase.value !== "paused") return;
        phase.value = paused ? "paused" : "running";
        if (progress.value) {
            progress.value = {
                ...progress.value,
                status: paused ? "paused" : "processing",
            };
        }
        logger.info(paused ? "📚 导入会话已暂停" : "📚 导入会话已继续", idSnippet());
    }

    async function begin(id: string, initial?: Partial<ImportProgress>): Promise<void> {
        assertCanStart();
        clearTerminalState();
        importId.value = id;
        phase.value = "running";
        startedAt.value = Date.now();
        result.value = null;
        error.value = null;
        progress.value = {
            totalFiles: initial?.totalFiles ?? 0,
            processedFiles: initial?.processedFiles ?? 0,
            successfulFiles: initial?.successfulFiles ?? 0,
            skippedFiles: initial?.skippedFiles ?? 0,
            errorFiles: initial?.errorFiles ?? 0,
            speed: 0,
            estimatedTimeRemaining: 0,
            remainingTime: 0,
            startTime: new Date(),
            errors: [],
            warnings: [],
            status: "processing",
            currentFile: "",
            ...initial,
        };
        await startListeners();
        logger.info("📚 导入会话开衙", {
            importId: idSnippet(),
            totalFiles: progress.value?.totalFiles ?? 0,
        });
    }

    function complete(res: ImportResult): void {
        result.value = res;
        phase.value = "completed";
        if (progress.value) {
            progress.value = {
                ...progress.value,
                status: "completed",
                processedFiles: res.totalFiles ?? progress.value.processedFiles,
                successfulFiles: res.successfulFiles ?? progress.value.successfulFiles,
                skippedFiles: res.skippedFiles ?? progress.value.skippedFiles,
                errorFiles: res.errorFiles ?? progress.value.errorFiles,
                totalFiles: res.totalFiles ?? progress.value.totalFiles,
            };
        }
        stopListeners();
        if (!modalVisible.value) {
            notification.success({
                title: "导入完成",
                message: `成功 ${res.successfulFiles ?? 0} / 共 ${res.totalFiles ?? 0} 个文件`,
            });
        }
        logger.info("📚 导入会话完成", idSnippet());
    }

    function fail(err: unknown): void {
        error.value = err;
        phase.value = "failed";
        if (progress.value) {
            progress.value = { ...progress.value, status: "failed" };
        }
        stopListeners();
        if (!modalVisible.value) {
            const msg = err instanceof Error ? err.message : String(err ?? "未知错误");
            notification.error({
                title: "导入失败",
                message: msg,
            });
        }
        logger.error("📚 导入会话失败", err);
    }

    function markCancelled(): void {
        phase.value = "cancelled";
        if (progress.value) {
            progress.value = { ...progress.value, status: "cancelled" };
        }
        stopListeners();
        logger.info("📚 导入会话已取消", idSnippet());
    }

    function clearTerminalState(): void {
        if (phase.value === "running" || phase.value === "paused") return;
        importId.value = null;
        phase.value = "idle";
        progress.value = null;
        result.value = null;
        error.value = null;
        startedAt.value = 0;
    }

    /** 用户关掉 chip / Done 后清会话 */
    function clear(): void {
        logger.info("📚 导入会话清档归库", idSnippet());
        stopListeners();
        importId.value = null;
        phase.value = "idle";
        progress.value = null;
        result.value = null;
        error.value = null;
        startedAt.value = 0;
    }

    function setModalVisible(visible: boolean): void {
        modalVisible.value = visible;
        logger.debug(visible ? "📚 进度模态开衙" : "📚 进度模态散衙（会话仍在）", idSnippet());
    }

    function requestOpenModal(): void {
        openModalRequest.value += 1;
        logger.info("📚 请复开进度模态（reattach）", {
            importId: idSnippet(),
            phase: phase.value,
            request: openModalRequest.value,
        });
    }

    function hydrateFromSession(): ImportProgress | null {
        const snap = progress.value ? { ...progress.value } : null;
        logger.debug("📚 从会话灌水进度快照", {
            importId: idSnippet(),
            phase: phase.value,
            processed: snap?.processedFiles,
            total: snap?.totalFiles,
        });
        return snap;
    }

    function idSnippet(): string {
        return importId.value?.slice(0, 8) ?? "";
    }

    /** 可开始：idle 或已终态（可开新任务前先 clear，或允许覆盖终态） */
    function assertCanStart(): void {
        if (phase.value === "running" || phase.value === "paused") {
            logger.warn("⚠️ 导入已在进行，拒开新衙", {
                importId: idSnippet(),
                phase: phase.value,
            });
            throw new Error(IMPORT_ALREADY_RUNNING);
        }
    }

    return {
        importId,
        phase,
        progress,
        result,
        error,
        startedAt,
        modalVisible,
        openModalRequest,
        canStart,
        isActive,
        isTerminal,
        showChip,
        progressPercent,
        begin,
        applyProgress,
        setPaused,
        complete,
        fail,
        markCancelled,
        clear,
        clearTerminalState,
        setModalVisible,
        requestOpenModal,
        hydrateFromSession,
        assertCanStart,
        stopListeners,
    };
});

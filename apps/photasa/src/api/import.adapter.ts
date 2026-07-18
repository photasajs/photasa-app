/**
 * 导入适配器
 * 适配导入服务 API（类型与 @photasa/common 一致，便于与 Electron / Rust 事件对齐）
 */

import type {
    DirectorySelection,
    ImportConfig,
    ImportProgress,
    ImportResult,
} from "@photasa/common";
import { ImportEvents } from "@photasa/common";
import { isTauri } from "./env";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

export type { DirectorySelection, ImportConfig, ImportProgress };

/**
 * resumeImport：Tauri 仅清 paused 标志并继续同一次 spawn（RFC 0096），不重跑整次导入。
 * 返回最小 ImportResult 占位以兼容调用方类型；完整结果仍走 import:complete 事件（P3 可收紧形状）。
 */
const RESUME_STUB: ImportResult = {
    success: true,
    totalFiles: 0,
    successfulFiles: 0,
    skippedFiles: 0,
    errorFiles: 0,
    totalSize: 0,
    processedSize: 0,
    importedFiles: [],
    errors: [],
    warnings: [],
    duration: 0,
    importId: "",
    sourcePaths: [],
    targetPath: "",
};

const DEFAULT_PROGRESS: ImportProgress = {
    totalFiles: 0,
    processedFiles: 0,
    successfulFiles: 0,
    skippedFiles: 0,
    errorFiles: 0,
    speed: 0,
    estimatedTimeRemaining: 0,
    remainingTime: 0,
    startTime: new Date(),
    errors: [],
    warnings: [],
    status: "processing",
};

/**
 * 将 Rust `import:progress` 或 Electron IPC 的 JSON 规范为 ImportProgress（含 startTime 为 Date）
 */
export function normalizeImportProgressPayload(raw: unknown): ImportProgress {
    if (raw === null || raw === undefined || typeof raw !== "object") {
        return { ...DEFAULT_PROGRESS };
    }
    const r = raw as Record<string, unknown>;
    const nested = (r.progress as Record<string, unknown> | undefined) ?? r;
    const st = nested.startTime;
    const startTime = st instanceof Date ? st : typeof st === "string" ? new Date(st) : new Date();

    return {
        importId: nested.importId as string | undefined,
        totalFiles: Number(nested.totalFiles ?? 0),
        processedFiles: Number(nested.processedFiles ?? 0),
        successfulFiles: Number(nested.successfulFiles ?? 0),
        skippedFiles: Number(nested.skippedFiles ?? 0),
        errorFiles: Number(nested.errorFiles ?? 0),
        currentFile: nested.currentFile as string | undefined,
        speed: Number(nested.speed ?? 0),
        estimatedTimeRemaining: Number(nested.estimatedTimeRemaining ?? nested.remainingTime ?? 0),
        remainingTime: Number(nested.remainingTime ?? nested.estimatedTimeRemaining ?? 0),
        startTime,
        errors: (nested.errors as ImportProgress["errors"]) ?? [],
        warnings: (nested.warnings as ImportProgress["warnings"]) ?? [],
        status: (nested.status as ImportProgress["status"]) ?? "processing",
    };
}

export const importAdapter = {
    /**
     * 扫描目录
     */
    scanDirectories: async (paths: string[], filters?: unknown): Promise<unknown[]> => {
        if (isTauri()) {
            const { invoke } = await import("@tauri-apps/api/core");
            return await invoke("scan_directories", { paths, filters: filters ?? null });
        }
        const out = await (window as any).electronAPI?.api?.scanDirectories?.(paths, filters);
        return out ?? [];
    },

    /**
     * 单选/多选目录（与 Electron `chooseDirectories` 返回形状一致）
     */
    chooseDirectories: async (multiSelect = true): Promise<DirectorySelection> => {
        if (isTauri()) {
            const { open } = await import("@tauri-apps/plugin-dialog");
            const selected = await open({ directory: true, multiple: multiSelect });
            if (Array.isArray(selected)) {
                return { filePaths: selected };
            } else if (typeof selected === "string") {
                return { filePaths: [selected] };
            }
            return { filePaths: [] };
        }
        const out = await (window as any).electronAPI?.api?.chooseDirectories?.(multiSelect);
        return out ?? { filePaths: [] };
    },

    /**
     * 执行导入
     */
    execute: async (config: ImportConfig): Promise<string> => {
        if (isTauri()) {
            const { invoke } = await import("@tauri-apps/api/core");
            return await invoke("execute_import", { config });
        }
        return await (window as any).electronAPI?.api?.executeImport?.(config);
    },

    /**
     * 监听导入进度
     */
    onProgress: async (
        callback: (progress: ImportProgress) => void,
    ): Promise<UnlistenFn | (() => void)> => {
        if (isTauri()) {
            return await listen<unknown>("import:progress", (event) => {
                callback(normalizeImportProgressPayload(event.payload));
            });
        }
        const w = window as any;
        const wrapped = (_event: unknown, eventData: unknown) => {
            const ed = eventData as Record<string, unknown> & { progress?: unknown };
            callback(normalizeImportProgressPayload(ed?.progress ?? ed));
        };
        const ipc = w.electronAPI?.ipcRenderer;
        if (ipc?.on) {
            ipc.on(ImportEvents.PROGRESS, wrapped);
            return () => {
                ipc.removeListener(ImportEvents.PROGRESS, wrapped);
            };
        }
        return () => {};
    },

    /**
     * 取消导入
     */
    cancel: async (importId: string): Promise<void> => {
        if (isTauri()) {
            const { invoke } = await import("@tauri-apps/api/core");
            await invoke("cancel_import", { importId });
            return;
        }
        await (window as any).electronAPI?.api?.cancelImport?.(importId);
    },

    /**
     * 暂停导入（文件边界生效，见 RFC 0096）
     */
    pause: async (importId: string): Promise<void> => {
        if (isTauri()) {
            const { invoke } = await import("@tauri-apps/api/core");
            await invoke("pause_import", { importId });
            return;
        }
        await (window as any).electronAPI?.api?.pauseImport?.(importId);
    },

    /**
     * 恢复导入
     */
    resume: async (importId: string): Promise<ImportResult> => {
        if (isTauri()) {
            const { invoke } = await import("@tauri-apps/api/core");
            await invoke("resume_import", { importId });
            return { ...RESUME_STUB, importId };
        }
        const r = await (window as any).electronAPI?.api?.resumeImport?.(importId);
        return r ?? { ...RESUME_STUB, importId };
    },
};

import type {
    ImportConfig,
    ImportHistory,
    ImportPreview,
    ImportProgress,
    ImportResult,
    ImportResumeResult,
    RecoverableImport,
    RecoverableImportActionResult,
    UndoPreview,
    UndoResult,
} from "@photasa/common";
import type {
    IImportOperations,
    Zouzhe,
    ZouzheResponse,
} from "@renderer/interfaces/fang-xuan-ling.interface";
import type { ImportEventPort } from "@renderer/interfaces/yuan-tian-gang.interface";
import { normalizeImportProgress } from "@renderer/services/import-contract";

interface ImportOperationsDependencies {
    processZouzhe(zouzhe: Zouzhe): Promise<ZouzheResponse>;
    events: ImportEventPort;
}

function memorial(matter: string, content: Record<string, unknown> = {}): Zouzhe {
    return {
        department: "导入政务",
        matter,
        content,
        timestamp: Date.now(),
        priority: "normal",
    };
}

function approvedData<T>(response: ZouzheResponse): T {
    if (!response.approved) throw new Error(response.instruction || "导入操作失败");
    return response.data as T;
}

function date(value: unknown): Date {
    if (value instanceof Date) return value;
    return new Date(typeof value === "string" || typeof value === "number" ? value : 0);
}

function normalizeHistory(raw: unknown): ImportHistory[] {
    if (!Array.isArray(raw)) return [];
    return raw.map((item) => {
        const entry = item as ImportHistory & { timestamp: unknown };
        return {
            ...entry,
            timestamp: date(entry.timestamp),
            result: entry.result
                ? {
                      ...entry.result,
                      importedFiles: Array.isArray(entry.result.importedFiles)
                          ? entry.result.importedFiles.map((file) => ({
                                ...file,
                                importTime: date(file.importTime),
                            }))
                          : [],
                  }
                : entry.result,
            fileList: Array.isArray(entry.fileList)
                ? entry.fileList.map((file) => ({ ...file, importTime: date(file.importTime) }))
                : [],
        };
    });
}

function normalizeUndoPreview(raw: unknown, historyId: string): UndoPreview {
    const value = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
    return {
        historyId: typeof value.historyId === "string" ? value.historyId : historyId,
        canUndo: Boolean(value.canUndo),
        reason: String(value.reason ?? ""),
        filesToDelete: Array.isArray(value.filesToDelete)
            ? value.filesToDelete.map((item) => {
                  const file = item as Record<string, unknown>;
                  return {
                      path: String(file.path ?? ""),
                      size: Number(file.size ?? 0),
                      originalPath: String(file.originalPath ?? ""),
                      importTime: date(file.importTime),
                  };
              })
            : [],
        directoriesToCleanup:
            value.directoriesToCleanup instanceof Set
                ? (value.directoriesToCleanup as Set<string>)
                : new Set(
                      Array.isArray(value.directoriesToCleanup)
                          ? (value.directoriesToCleanup as string[])
                          : [],
                  ),
        potentialIssues: Array.isArray(value.potentialIssues)
            ? (value.potentialIssues as UndoPreview["potentialIssues"])
            : [],
        estimatedTime: Number(value.estimatedTime ?? 0),
    };
}

function normalizeUndoResult(raw: unknown): UndoResult {
    const value = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
    return {
        success: Boolean(value.success),
        deletedFiles: Array.isArray(value.deletedFiles) ? (value.deletedFiles as string[]) : [],
        errors: Array.isArray(value.errors) ? (value.errors as UndoResult["errors"]) : [],
        restoredDirectories:
            value.restoredDirectories instanceof Set
                ? (value.restoredDirectories as Set<string>)
                : new Set(
                      Array.isArray(value.restoredDirectories)
                          ? (value.restoredDirectories as string[])
                          : [],
                  ),
        undoId: String(value.undoId ?? ""),
        timestamp: date(value.timestamp),
    };
}

function normalizeRecoverable(raw: unknown): RecoverableImport[] {
    if (!Array.isArray(raw)) return [];
    return raw.map((item) => {
        const value = item as RecoverableImport & { startedAt: unknown; updatedAt: unknown };
        return {
            ...value,
            startedAt: date(value.startedAt),
            updatedAt: date(value.updatedAt),
            fileList: Array.isArray(value.fileList)
                ? value.fileList.map((file) => ({ ...file, importTime: date(file.importTime) }))
                : [],
        };
    });
}

function normalizeRecoveryAction(raw: unknown): RecoverableImportActionResult {
    const value = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
    return {
        success: Boolean(value.success),
        importId: String(value.importId ?? ""),
        deletedFiles: Array.isArray(value.deletedFiles)
            ? (value.deletedFiles as string[])
            : undefined,
        keptFiles: typeof value.keptFiles === "number" ? value.keptFiles : undefined,
        errors: Array.isArray(value.errors)
            ? (value.errors as RecoverableImportActionResult["errors"])
            : [],
        timestamp: date(value.timestamp),
    };
}

export function createImportOperations({
    processZouzhe,
    events,
}: ImportOperationsDependencies): IImportOperations {
    let previewInFlight = false;
    const execute = async <T>(matter: string, content?: Record<string, unknown>): Promise<T> =>
        approvedData<T>(await processZouzhe(memorial(matter, content)));

    return {
        ready: () => events.ready(),
        async preview(config: ImportConfig) {
            if (previewInFlight) throw new Error("IMPORT_PREVIEW_ALREADY_RUNNING");
            previewInFlight = true;
            try {
                return await execute<ImportPreview>("preview_import", { config });
            } finally {
                previewInFlight = false;
            }
        },
        async execute(config: ImportConfig) {
            const importId = await execute<string>("execute_import", { config });
            return { importId };
        },
        async cancel(importId: string) {
            await execute("cancel_import", { importId });
        },
        async pause(importId: string) {
            await execute("pause_import", { importId });
        },
        async resume(importId: string): Promise<ImportResumeResult> {
            await execute("resume_import", { importId });
            return { importId };
        },
        async history(limit?: number) {
            return normalizeHistory(await execute("get_import_history", { limit }));
        },
        details: (historyId: string) =>
            execute<ImportHistory | null>("get_import_details", { historyId }),
        async previewUndo(historyId: string) {
            return normalizeUndoPreview(
                await execute("preview_undo_import", { historyId }),
                historyId,
            );
        },
        async undo(historyId: string) {
            return normalizeUndoResult(await execute("undo_import_execute", { historyId }));
        },
        async progress(importId: string) {
            return normalizeImportProgress(await execute("get_import_progress", { importId }));
        },
        async recoverable() {
            return normalizeRecoverable(await execute("get_recoverable_imports"));
        },
        async cleanupRecoverable(importId: string) {
            return normalizeRecoveryAction(
                await execute("cleanup_recoverable_import", { importId }),
            );
        },
        async keepRecoverable(importId: string) {
            return normalizeRecoveryAction(await execute("keep_recoverable_import", { importId }));
        },
        onProgress: (callback: (progress: ImportProgress) => void) => events.onProgress(callback),
        onComplete: (callback: (result: ImportResult) => void) => events.onComplete(callback),
        onError: (callback: (error: { importId?: string; error: Error }) => void) =>
            events.onError(callback),
        onPreviewProgress: (callback: (progress: unknown, files?: unknown[]) => void) =>
            events.onPreviewProgress(callback),
    };
}

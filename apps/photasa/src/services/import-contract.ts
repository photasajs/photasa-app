import type { ImportProgress } from "@photasa/common";

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

export function normalizeImportProgress(raw: unknown): ImportProgress {
    if (!raw || typeof raw !== "object") return { ...DEFAULT_PROGRESS };
    const outer = raw as Record<string, unknown>;
    const value =
        outer.progress && typeof outer.progress === "object"
            ? (outer.progress as Record<string, unknown>)
            : outer;
    const rawStart = value.startTime;
    return {
        importId: typeof value.importId === "string" ? value.importId : undefined,
        totalFiles: Number(value.totalFiles ?? 0),
        processedFiles: Number(value.processedFiles ?? 0),
        successfulFiles: Number(value.successfulFiles ?? 0),
        skippedFiles: Number(value.skippedFiles ?? 0),
        errorFiles: Number(value.errorFiles ?? 0),
        currentFile: typeof value.currentFile === "string" ? value.currentFile : undefined,
        speed: Number(value.speed ?? 0),
        estimatedTimeRemaining: Number(value.estimatedTimeRemaining ?? value.remainingTime ?? 0),
        remainingTime: Number(value.remainingTime ?? value.estimatedTimeRemaining ?? 0),
        startTime:
            rawStart instanceof Date
                ? rawStart
                : typeof rawStart === "string"
                  ? new Date(rawStart)
                  : new Date(),
        errors: (value.errors as ImportProgress["errors"]) ?? [],
        warnings: (value.warnings as ImportProgress["warnings"]) ?? [],
        status: (value.status as ImportProgress["status"]) ?? "processing",
    };
}

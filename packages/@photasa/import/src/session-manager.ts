import type {
    ImportConfig,
    ImportSession,
    ImportProgress,
    EnhancedImportCallback,
} from "@photasa/common";
import type { ProgressEvent } from "@photasa/common";

const IMPORT_ID_RANDOM_LEN = 9;

/**
 * 生成与 ImportService 相同格式的 importId。
 */
export function generateImportSessionId(): string {
    return `import_${Date.now()}_${Math.random()
        .toString(36)
        .slice(2, 2 + IMPORT_ID_RANDOM_LEN)}`;
}

/**
 * 新建会话的初始进度（与原先 import-service.createInitialProgress 一致）。
 */
export function createInitialImportProgress(): ImportProgress {
    return {
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
        status: "preparing",
        currentFile: "",
    };
}

/** 会话从 Map 移除前的延迟（与原 service 一致：5 分钟） */
export const IMPORT_SESSION_CLEANUP_DELAY_MS = 300_000;

/**
 * 管理 `activeSessions` 与 `progressCallbacks`，无 Electron 依赖。
 */
export class ImportSessionManager {
    private readonly sessions = new Map<string, ImportSession>();
    private readonly progressCallbacks = new Map<string, EnhancedImportCallback>();
    private readonly removalTimers = new Map<string, ReturnType<typeof setTimeout>>();

    getSession(importId: string): ImportSession | undefined {
        return this.sessions.get(importId);
    }

    setSession(session: ImportSession): void {
        this.sessions.set(session.importId, session);
    }

    createPreparingSession(importId: string, config: ImportConfig): ImportSession {
        const session: ImportSession = {
            importId,
            config,
            status: "preparing",
            progress: createInitialImportProgress(),
            cancelRequested: false,
            startTime: new Date(),
        };
        this.sessions.set(importId, session);
        return session;
    }

    /**
     * 应用 worker 进度事件；返回更新后的 session，若无则 `undefined`。
     */
    applyProgressFromWorker(
        taskId: string,
        data: ProgressEvent["data"],
    ): ImportSession | undefined {
        const session = this.sessions.get(taskId);
        if (!session) {
            return undefined;
        }
        session.progress = {
            ...session.progress,
            processedFiles: data.processedFiles,
            totalFiles: data.totalFiles,
            currentFile: data.currentFile,
            speed: data.speed,
            estimatedTimeRemaining: data.estimatedTimeRemaining,
            remainingTime: data.estimatedTimeRemaining,
        };
        return session;
    }

    requestCancel(importId: string): ImportSession | undefined {
        const session = this.sessions.get(importId);
        if (!session) {
            return undefined;
        }
        session.cancelRequested = true;
        session.cancelTime = new Date();
        if (session.status === "processing") {
            session.status = "cancelled";
        }
        this.progressCallbacks.delete(importId);
        return session;
    }

    pauseIfProcessing(importId: string): boolean {
        const session = this.sessions.get(importId);
        if (!session || session.status !== "processing") {
            return false;
        }
        session.status = "paused";
        session.pauseTime = new Date();
        return true;
    }

    resumeFromPaused(importId: string): ImportSession | undefined {
        const session = this.sessions.get(importId);
        if (!session || session.status !== "paused") {
            return undefined;
        }
        session.status = "processing";
        session.resumeCount = (session.resumeCount || 0) + 1;
        session.lastResumeTime = new Date();
        return session;
    }

    getProgressOrDefault(importId: string): ImportProgress {
        const session = this.sessions.get(importId);
        if (session) {
            return session.progress;
        }
        return {
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
            status: "completed",
        };
    }

    setProgressCallback(importId: string, cb: EnhancedImportCallback): void {
        this.progressCallbacks.set(importId, cb);
    }

    getProgressCallback(importId: string): EnhancedImportCallback | undefined {
        return this.progressCallbacks.get(importId);
    }

    deleteProgressCallback(importId: string): void {
        this.progressCallbacks.delete(importId);
    }

    scheduleSessionRemoval(
        importId: string,
        delayMs: number = IMPORT_SESSION_CLEANUP_DELAY_MS,
    ): void {
        const prev = this.removalTimers.get(importId);
        if (prev !== undefined) {
            clearTimeout(prev);
        }
        const t = setTimeout(() => {
            this.sessions.delete(importId);
            this.removalTimers.delete(importId);
        }, delayMs);
        this.removalTimers.set(importId, t);
    }

    forEachSession(callback: (session: ImportSession) => void): void {
        for (const session of this.sessions.values()) {
            callback(session);
        }
    }

    getActiveSessionsCount(): number {
        return this.sessions.size;
    }

    getProgressCallbacksCount(): number {
        return this.progressCallbacks.size;
    }

    clearAllTimersAndSessions(): void {
        for (const t of this.removalTimers.values()) {
            clearTimeout(t);
        }
        this.removalTimers.clear();
        this.sessions.clear();
        this.progressCallbacks.clear();
    }
}

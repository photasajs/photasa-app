import type { ImportProgress, ImportResult } from "@photasa/common";
import { invoke as tauriInvoke } from "@tauri-apps/api/core";
import { listen as tauriListen, type UnlistenFn } from "@tauri-apps/api/event";
import type { ImportEventPort } from "@renderer/interfaces/yuan-tian-gang.interface";
import { normalizeImportProgress } from "@renderer/services/import-contract";

type ImportEventName =
    | "import:progress"
    | "import:complete"
    | "import:error"
    | "import:preview-progress";

type Listener = (event: { payload: unknown }) => void;
type Listen = (name: ImportEventName, handler: Listener) => Promise<UnlistenFn>;
type Invoke = (command: string, args?: Record<string, unknown>) => Promise<unknown>;
type Unsubscribe = () => void;

interface ImportTransportDependencies {
    listen?: Listen;
    invoke?: Invoke;
    enabled?: boolean;
}

function normalizeImportError(raw: unknown): { importId?: string; error: Error } {
    if (raw instanceof Error) return { error: raw };
    const value = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
    const message = typeof value.message === "string" ? value.message : String(raw ?? "未知错误");
    return {
        importId: typeof value.importId === "string" ? value.importId : undefined,
        error: new Error(message),
    };
}

function commandArgs(command: string, context: Record<string, unknown>): Record<string, unknown> {
    if (command === "preview_import" || command === "execute_import") {
        return { config: context.config };
    }
    if (
        command === "cancel_import" ||
        command === "pause_import" ||
        command === "resume_import" ||
        command === "get_import_progress" ||
        command === "cleanup_recoverable_import" ||
        command === "keep_recoverable_import"
    ) {
        return { args: { importId: context.importId } };
    }
    if (
        command === "get_import_details" ||
        command === "preview_undo_import" ||
        command === "undo_import_execute"
    ) {
        return { args: { historyId: context.historyId } };
    }
    if (command === "get_import_history") {
        return { args: { limit: context.limit } };
    }
    return {};
}

export class ImportTransport implements ImportEventPort {
    private readonly invoke: Invoke;
    private readonly listen: Listen;
    private readonly enabled: boolean;
    private readonly listeners = {
        progress: new Set<(progress: ImportProgress) => void>(),
        complete: new Set<(result: ImportResult) => void>(),
        error: new Set<(error: { importId?: string; error: Error }) => void>(),
        preview: new Set<(progress: unknown, files?: unknown[]) => void>(),
    };
    private readiness?: Promise<void>;
    private unlisteners: UnlistenFn[] = [];
    private destroyed = false;

    constructor({
        listen = tauriListen as Listen,
        invoke = tauriInvoke as Invoke,
        enabled = true,
    }: ImportTransportDependencies = {}) {
        this.invoke = invoke;
        this.listen = listen;
        this.enabled = enabled;
    }

    private async install(listen: Listen): Promise<void> {
        const registrations = await Promise.allSettled([
            listen("import:progress", ({ payload }) => {
                const progress = normalizeImportProgress(payload);
                this.listeners.progress.forEach((callback) => callback(progress));
            }),
            listen("import:complete", ({ payload }) => {
                this.listeners.complete.forEach((callback) => callback(payload as ImportResult));
            }),
            listen("import:error", ({ payload }) => {
                const error = normalizeImportError(payload);
                this.listeners.error.forEach((callback) => callback(error));
            }),
            listen("import:preview-progress", ({ payload }) => {
                const value =
                    payload && typeof payload === "object"
                        ? (payload as Record<string, unknown>)
                        : {};
                this.listeners.preview.forEach((callback) =>
                    callback(value.progress ?? payload, value.files as unknown[] | undefined),
                );
            }),
        ]);
        const unlisteners = registrations.flatMap((registration) =>
            registration.status === "fulfilled" ? [registration.value] : [],
        );
        const failure = registrations.find(
            (registration): registration is PromiseRejectedResult =>
                registration.status === "rejected",
        );
        if (failure) {
            unlisteners.forEach((unlisten) => unlisten());
            throw failure.reason;
        }
        if (this.destroyed) {
            unlisteners.forEach((unlisten) => unlisten());
            return;
        }
        this.unlisteners = unlisteners;
    }

    ready(): Promise<void> {
        if (!this.readiness) {
            this.readiness = this.enabled ? this.install(this.listen) : Promise.resolve();
        }
        return this.readiness;
    }

    async execute(command: string, context: Record<string, unknown>): Promise<unknown> {
        await this.ready();
        return this.invoke(command, commandArgs(command, context));
    }

    onProgress(callback: (progress: ImportProgress) => void): Unsubscribe {
        return this.subscribe(this.listeners.progress, callback);
    }

    onComplete(callback: (result: ImportResult) => void): Unsubscribe {
        return this.subscribe(this.listeners.complete, callback);
    }

    onError(callback: (error: { importId?: string; error: Error }) => void): Unsubscribe {
        return this.subscribe(this.listeners.error, callback);
    }

    onPreviewProgress(callback: (progress: unknown, files?: unknown[]) => void): Unsubscribe {
        return this.subscribe(this.listeners.preview, callback);
    }

    private subscribe<T>(listeners: Set<(value: T) => void>, callback: (value: T) => void) {
        listeners.add(callback);
        return () => listeners.delete(callback);
    }

    destroy(): void {
        this.destroyed = true;
        this.unlisteners.splice(0).forEach((unlisten) => unlisten());
        Object.values(this.listeners).forEach((listeners) => listeners.clear());
    }
}

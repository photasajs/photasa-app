import type { MessagePort } from "worker_threads";

/** Worker 发往主进程的日志条目类型标识（与主进程 IPC 信道同名，便于统一） */
export const WORKER_LOG_CHANNEL = "worker:log" as const;

/** 主进程通知 Worker：日志查看器是否激活 */
export const LOG_VIEWER_STATUS_TYPE = "log:viewer-status" as const;

export type WorkerLogLevel = "debug" | "info" | "warn" | "error";

export type WorkerBaseLogger = Record<WorkerLogLevel, (message: string) => void>;

export type WorkerLogViewerBridge = {
    workerLog: (level: WorkerLogLevel, category: string, message: string) => void;
    setLogViewerActive: (active: boolean) => void;
    getLogViewerActive: () => boolean;
    createCategoryLogger: (category: string) => WorkerBaseLogger;
};

/**
 * 主进程 logger 输出 + 可选转发到日志查看器（与 LogViewerService 协作）
 */
export function createWorkerLogViewerBridge(options: {
    port: MessagePort | null;
    baseLogger: WorkerBaseLogger;
    threadId: string;
}): WorkerLogViewerBridge {
    let logViewerActive = false;

    const workerLog = (level: WorkerLogLevel, category: string, message: string): void => {
        options.baseLogger[level](message);
        if (logViewerActive && options.port) {
            options.port.postMessage({
                type: WORKER_LOG_CHANNEL,
                entry: {
                    timestamp: new Date().toISOString(),
                    level,
                    category,
                    message,
                    source: "worker",
                    threadId: options.threadId,
                },
            });
        }
    };

    return {
        workerLog,
        setLogViewerActive(active: boolean) {
            logViewerActive = active;
        },
        getLogViewerActive: () => logViewerActive,
        createCategoryLogger(category: string) {
            return {
                debug: (m: string) => workerLog("debug", category, m),
                info: (m: string) => workerLog("info", category, m),
                warn: (m: string) => workerLog("warn", category, m),
                error: (m: string) => workerLog("error", category, m),
            };
        },
    };
}

/**
 * 若为日志查看器状态消息则处理并返回 true，否则返回 false。
 */
export function handleLogViewerStatusMessage(
    message: unknown,
    bridge: Pick<WorkerLogViewerBridge, "setLogViewerActive" | "workerLog">,
    logCategory: string,
): boolean {
    if (
        typeof message !== "object" ||
        message === null ||
        !("type" in message) ||
        !("active" in message) ||
        (message as { type: unknown }).type !== LOG_VIEWER_STATUS_TYPE ||
        typeof (message as { active: unknown }).active !== "boolean"
    ) {
        return false;
    }
    const active = (message as { active: boolean }).active;
    bridge.setLogViewerActive(active);
    bridge.workerLog("debug", logCategory, `Log viewer ${active ? "activated" : "deactivated"}`);
    return true;
}

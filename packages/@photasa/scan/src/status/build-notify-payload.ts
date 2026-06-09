import type { NotifyPayload } from "@photasa/common";

/** 与扫描 worker 发出的 notify 相关消息类型一致 */
const SCAN_NOTIFY_DOMAIN = "scan";

/**
 * Worker 发往主进程的扫描消息中，用于构造 {@link NotifyPayload} 的字段子集。
 * 不含 `WORKER_LOG_CHANNEL` 等日志通道消息。
 */
export type ScanWorkerNotifySource = {
    type: string;
    error?: unknown;
    action?: { path?: string; isDirectory?: boolean };
    progress?: { processed: number; total: number };
    currentFile?: string;
};

/**
 * 将任意 unknown 错误规范为 notify 用的字符串（与原先 scan-service 内联逻辑一致）。
 */
function formatScanWorkerError(error: unknown): string {
    if (error === null || error === undefined) {
        return "";
    }
    if (typeof error === "string") {
        return error;
    }
    if (typeof error === "object" && "message" in error && typeof (error as Error).message === "string") {
        return (error as Error).message;
    }
    return String(error);
}

/**
 * 将扫描 worker 消息转换为状态条用的 {@link NotifyPayload}；无需通知时返回 `undefined`。
 * 纯函数，无 Electron、无 IO。
 */
export function buildScanNotifyPayload(data: ScanWorkerNotifySource): NotifyPayload | undefined {
    const timestamp = Date.now();

    if (data.type === "error") {
        return {
            type: SCAN_NOTIFY_DOMAIN,
            task: data.action?.path ?? "",
            status: "error",
            error: formatScanWorkerError(data.error),
            timestamp,
        };
    }

    if (data.type === "complete") {
        return {
            type: SCAN_NOTIFY_DOMAIN,
            task: data.action?.path ?? "",
            status: "complete",
            timestamp,
        };
    }

    if (data.type === "progress") {
        const taskDisplay = data.currentFile || data.action?.path || "";
        return {
            type: SCAN_NOTIFY_DOMAIN,
            task: taskDisplay,
            status: "progress",
            data: {
                ...data.progress,
                currentFile: data.currentFile,
            },
            timestamp,
        };
    }

    return undefined;
}

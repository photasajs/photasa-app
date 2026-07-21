/**
 * 扫描队列 payload 归一化（纯函数，无 IPC）
 */
import type { ScanAction } from "@photasa/common";
import { createScanQueueItem, type ScanQueueItem } from "@renderer/stores/scanning-types";

export function normalizeRestoredQueueItem(raw: Record<string, unknown>): ScanQueueItem {
    const createdAt =
        typeof raw.createdAt === "number"
            ? raw.createdAt
            : typeof raw.timestamp === "number"
              ? raw.timestamp
              : Date.now();

    return {
        path: String(raw.path),
        action: (raw.action as ScanQueueItem["action"]) ?? "scan",
        status: (raw.status as ScanQueueItem["status"]) ?? "pending",
        createdAt,
        startedAt: typeof raw.startedAt === "number" ? raw.startedAt : undefined,
        source: (raw.source as ScanQueueItem["source"]) ?? "user",
        error: typeof raw.error === "string" ? raw.error : undefined,
        retryCount: typeof raw.retryCount === "number" ? raw.retryCount : 0,
        maxRetries: typeof raw.maxRetries === "number" ? raw.maxRetries : 3,
        priority: typeof raw.priority === "number" ? raw.priority : undefined,
        fileOperationId: typeof raw.fileOperationId === "string" ? raw.fileOperationId : undefined,
        operationType: (raw.operationType as ScanQueueItem["operationType"]) ?? "directory",
        thumbnailSize: typeof raw.thumbnailSize === "number" ? raw.thumbnailSize : 150,
    };
}

export function normalizeRestoredQueue(rawQueue: Record<string, unknown>[]): ScanQueueItem[] {
    return rawQueue.map(normalizeRestoredQueueItem);
}

export function scanActionToPersistedEntry(action: ScanAction): Record<string, unknown> {
    return {
        ...createScanQueueItem({
            path: action.path,
            action: action.action,
            source: action.source,
            operationType: action.operationType,
            thumbnailSize: action.thumbnailSize,
            priority: action.priority,
            fileOperationId: action.fileOperationId,
        }),
    };
}

export function extractActionsFromContext(context: Record<string, unknown>): ScanAction[] {
    if (Array.isArray(context.actions)) {
        return context.actions as ScanAction[];
    }
    if (context.action && typeof context.action === "object") {
        return [context.action as ScanAction];
    }
    return [];
}

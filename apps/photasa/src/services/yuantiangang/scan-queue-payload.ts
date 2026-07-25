/**
 * 扫描队列 payload 归一化（纯函数，无 IPC）
 *
 * @see RFC 0162 — .spec/rfc/completed/0162-scan-queue-nonblocking-ipc.md
 */
import type { ScanAction } from "@photasa/common";
import { createScanQueueItem, type ScanQueueItem } from "@renderer/stores/scanning-types";

export type { ScanQueueAck } from "./scan-queue-contract";

export function normalizeQueuePath(path: string): string {
    return path.trimEnd().replace(/\/+$/, "");
}

export function applyScanQueueAdd(
    current: ScanQueueItem[],
    actions: ScanAction[],
): ScanQueueItem[] {
    const next = [...current];
    for (const action of actions) {
        const normalizedPath = normalizeQueuePath(action.path);
        if (next.some((item) => normalizeQueuePath(item.path) === normalizedPath)) {
            continue;
        }
        next.push(normalizeRestoredQueueItem(scanActionToPersistedEntry(action)));
    }
    return next;
}

export function applyScanQueueRemove(current: ScanQueueItem[], path: string): ScanQueueItem[] {
    const normalizedPath = normalizeQueuePath(path);
    return current.filter((item) => normalizeQueuePath(item.path) !== normalizedPath);
}

export function applyScanQueueUpdate(
    current: ScanQueueItem[],
    path: string,
    status: ScanQueueItem["status"],
    updates: Record<string, unknown>,
): ScanQueueItem[] {
    const normalizedPath = normalizeQueuePath(path);
    return current.map((item) => {
        if (normalizeQueuePath(item.path) !== normalizedPath) {
            return item;
        }
        return {
            ...item,
            status,
            startedAt: typeof updates.startedAt === "number" ? updates.startedAt : item.startedAt,
            error: typeof updates.error === "string" ? updates.error : item.error,
            retryCount:
                typeof updates.retryCount === "number" ? updates.retryCount : item.retryCount,
        };
    });
}

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

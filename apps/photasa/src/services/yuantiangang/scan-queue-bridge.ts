/**
 * 扫描队列 Rust 持久化桥接（RFC 0136 + RFC 0143）
 *
 * Electron 工作流语义在 Rust `scan_queue_storage` 实现；
 * 袁天罡仅 invoke，房玄龄 matter-sync 投影 Pinia。
 */

import { invoke } from "@tauri-apps/api/core";
import type { ScanAction } from "@photasa/common";
import { ZOUZHE_MATTERS } from "@renderer/interfaces/fang-xuan-ling.interface";
import { isTauri } from "@renderer/api/env";
import { createScanQueueItem, type ScanQueueItem } from "@renderer/stores/scanning-types";

/** 与 `commands/scan_queue.rs` 一致 */
export const SCAN_QUEUE_COMMANDS = {
    GET: "scan_queue_get",
    ADD: "scan_queue_add_actions",
    REMOVE: "scan_queue_remove_action",
    UPDATE: "scan_queue_update_action_status",
} as const;

type ScanQueueZhaolingCommand =
    | typeof ZOUZHE_MATTERS.GET_SCANNING_QUEUE
    | typeof ZOUZHE_MATTERS.ADD_SCAN_ACTION
    | typeof ZOUZHE_MATTERS.REMOVE_SCAN_ACTION
    | typeof ZOUZHE_MATTERS.UPDATE_SCAN_ACTION_STATUS;

/** 磁盘 JSON → Store `ScanQueueItem` */
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

/** ScanAction → 持久化条目（补齐 RFC 0048 状态机缺省字段） */
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

/**
 * 袁天罡队列奏折：invoke Rust（restore/append/persist 在 Rust 内原子完成）
 */
export async function executeScanQueueZhaoling(
    command: ScanQueueZhaolingCommand,
    context: Record<string, unknown>,
): Promise<{ queue: ScanQueueItem[] }> {
    if (!isTauri()) {
        throw new Error("扫描队列持久化仅支持 Tauri 环境（~/.photasa/scan/scanning.json）");
    }

    let rawQueue: Record<string, unknown>[];

    if (command === ZOUZHE_MATTERS.GET_SCANNING_QUEUE) {
        rawQueue = await invoke<Record<string, unknown>[]>(SCAN_QUEUE_COMMANDS.GET);
    } else if (command === ZOUZHE_MATTERS.ADD_SCAN_ACTION) {
        const actions = extractActionsFromContext(context).map(scanActionToPersistedEntry);
        rawQueue = await invoke<Record<string, unknown>[]>(SCAN_QUEUE_COMMANDS.ADD, { actions });
    } else if (command === ZOUZHE_MATTERS.REMOVE_SCAN_ACTION) {
        const path = String(context.path ?? "");
        rawQueue = await invoke<Record<string, unknown>[]>(SCAN_QUEUE_COMMANDS.REMOVE, { path });
    } else if (command === ZOUZHE_MATTERS.UPDATE_SCAN_ACTION_STATUS) {
        const path = String(context.path ?? "");
        const status = String(context.status ?? "pending");
        const updates = (context.updates ?? {}) as Record<string, unknown>;
        rawQueue = await invoke<Record<string, unknown>[]>(SCAN_QUEUE_COMMANDS.UPDATE, {
            path,
            status,
            updates,
        });
    } else {
        throw new Error(`未支持的扫描队列诏令: ${command}`);
    }

    return { queue: normalizeRestoredQueue(rawQueue) };
}

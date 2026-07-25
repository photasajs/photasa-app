import type { ScanQueueItem } from "@renderer/stores/scanning-types";

export interface QueuePathDisplay {
    name: string;
    parent: string;
}

export type QueueCardTier = "active" | "next" | "queued";

export const QUEUE_CARD_HEIGHT_BASE = 76;
/** 当前扫描项固定高度（预留进度行，避免虚拟列表跳动） */
export const QUEUE_CARD_HEIGHT_ACTIVE = 92;
/** 失败项额外详情行高度 */
export const QUEUE_CARD_HEIGHT_FAILED = 92;
export const QUEUE_CARD_GAP = 8;

/** 将队列路径拆为展示用文件夹名与父路径 */
export function splitQueuePath(path: string): QueuePathDisplay {
    const normalized = path.replace(/\\/g, "/").replace(/\/$/, "");
    const segments = normalized.split("/").filter(Boolean);

    if (segments.length === 0) {
        return { name: path, parent: "" };
    }

    const name = segments[segments.length - 1] ?? path;
    const parent = segments.slice(0, -1).join("/");

    return { name, parent };
}

/** 提取路径末段名称（与 legacy ScanQueueDialog 行为一致） */
export function formatPathName(path: string, unknownLabel: string): string {
    if (!path || typeof path !== "string") {
        return unknownLabel;
    }

    const parts = path.split("/").filter(Boolean);
    return parts[parts.length - 1] || parts[parts.length - 2] || unknownLabel;
}

/** 队列卡片层级：当前 / 下一个 / 其余 */
export function getQueueCardTier(index: number): QueueCardTier {
    if (index === 0) {
        return "active";
    }
    if (index === 1) {
        return "next";
    }
    return "queued";
}

export function shouldShowProgress(item: ScanQueueItem, index: number): boolean {
    return index === 0 && Boolean(item.progress);
}

/** 当前项始终预留进度行槽位，防止进度出现时卡片增高 */
export function shouldReserveActiveDetailSlot(index: number): boolean {
    return index === 0;
}

export function shouldShowFailedState(item: ScanQueueItem): boolean {
    return item.status === "failed";
}

/** TanStack 固定行高：当前项恒定 active 高度；失败项增高；其余基础高度 */
export function estimateQueueCardHeight(item: ScanQueueItem | undefined, index: number): number {
    if (!item) {
        return QUEUE_CARD_HEIGHT_BASE;
    }

    if (shouldReserveActiveDetailSlot(index)) {
        return QUEUE_CARD_HEIGHT_ACTIVE;
    }

    if (shouldShowFailedState(item)) {
        return QUEUE_CARD_HEIGHT_FAILED;
    }

    return QUEUE_CARD_HEIGHT_BASE;
}

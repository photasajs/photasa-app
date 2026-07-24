import { describe, expect, it } from "vitest";
import { createScanQueueItem, type ScanQueueItem } from "@renderer/stores/scanning-types";
import {
    estimateQueueCardHeight,
    formatPathName,
    getQueueCardTier,
    QUEUE_CARD_HEIGHT_ACTIVE,
    QUEUE_CARD_HEIGHT_BASE,
    QUEUE_CARD_HEIGHT_FAILED,
    shouldReserveActiveDetailSlot,
    shouldShowFailedState,
    shouldShowProgress,
    splitQueuePath,
} from "../scan-queue-display";

describe("splitQueuePath", () => {
    it("应拆分绝对路径为名称与父路径", () => {
        expect(splitQueuePath("/Volumes/One Touch/照片/2017/20170402")).toEqual({
            name: "20170402",
            parent: "Volumes/One Touch/照片/2017",
        });
    });
});

describe("formatPathName", () => {
    it("应返回路径末段名称", () => {
        expect(formatPathName("/test/very/long/folder/path", "未知")).toBe("path");
    });
});

describe("getQueueCardTier", () => {
    it("应按索引返回层级", () => {
        expect(getQueueCardTier(0)).toBe("active");
        expect(getQueueCardTier(1)).toBe("next");
        expect(getQueueCardTier(2)).toBe("queued");
    });
});

describe("shouldReserveActiveDetailSlot", () => {
    it("仅当前项预留详情槽位", () => {
        expect(shouldReserveActiveDetailSlot(0)).toBe(true);
        expect(shouldReserveActiveDetailSlot(1)).toBe(false);
    });
});

describe("estimateQueueCardHeight", () => {
    it("当前项无进度时也使用固定 active 行高", () => {
        const item = createScanQueueItem({ path: "/a" });

        expect(shouldShowProgress(item, 0)).toBe(false);
        expect(estimateQueueCardHeight(item, 0)).toBe(QUEUE_CARD_HEIGHT_ACTIVE);
    });

    it("当前项有进度时仍使用相同 active 行高", () => {
        const item: ScanQueueItem = {
            ...createScanQueueItem({ path: "/a" }),
            progress: { processed: 1, total: 10 },
        };

        expect(shouldShowProgress(item, 0)).toBe(true);
        expect(estimateQueueCardHeight(item, 0)).toBe(QUEUE_CARD_HEIGHT_ACTIVE);
    });

    it("失败任务应使用更高行高", () => {
        const item: ScanQueueItem = {
            ...createScanQueueItem({ path: "/a" }),
            status: "failed",
            error: "disk full",
        };

        expect(shouldShowFailedState(item)).toBe(true);
        expect(estimateQueueCardHeight(item, 2)).toBe(QUEUE_CARD_HEIGHT_FAILED);
    });

    it("普通等待项使用基础行高", () => {
        const item = createScanQueueItem({ path: "/a" });
        expect(estimateQueueCardHeight(item, 2)).toBe(QUEUE_CARD_HEIGHT_BASE);
    });
});

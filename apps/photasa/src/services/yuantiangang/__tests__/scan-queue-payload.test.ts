import { describe, it, expect } from "vitest";
import type { ScanAction } from "@photasa/common";
import {
    applyScanQueueAdd,
    applyScanQueueRemove,
    applyScanQueueUpdate,
    extractActionsFromContext,
    normalizeQueuePath,
    normalizeRestoredQueueItem,
    scanActionToPersistedEntry,
} from "../scan-queue-payload";
import { createScanQueueItem } from "@renderer/stores/scanning-types";

function createTestAction(overrides: Partial<ScanAction> = {}): ScanAction {
    return {
        path: "/test/path",
        action: "scan",
        thumbnailSize: 150,
        operationType: "directory",
        source: "user",
        ...overrides,
    };
}

describe("scan-queue-payload", () => {
    it("normalizeRestoredQueueItem 兼容 timestamp", () => {
        const item = normalizeRestoredQueueItem({
            path: "/a",
            action: "rescan",
            timestamp: 100,
        });
        expect(item.path).toBe("/a");
        expect(item.status).toBe("pending");
        expect(item.createdAt).toBe(100);
    });

    it("scanActionToPersistedEntry 带 pending 状态", () => {
        const entry = scanActionToPersistedEntry(createTestAction({ path: "/b" }));
        expect(entry.path).toBe("/b");
        expect(entry.status).toBe("pending");
    });

    it("extractActionsFromContext 支持 actions 数组", () => {
        const actions = [createTestAction()];
        expect(extractActionsFromContext({ actions })).toEqual(actions);
    });

    it("normalizeQueuePath 去除尾部斜杠", () => {
        expect(normalizeQueuePath("/a/b/")).toBe("/a/b");
        expect(normalizeQueuePath("/a/b")).toBe("/a/b");
    });

    it("applyScanQueueAdd 去重并追加", () => {
        const existing = [createScanQueueItem({ path: "/a" })];
        const actions = [createTestAction({ path: "/a" }), createTestAction({ path: "/b/" })];
        const next = applyScanQueueAdd(existing, actions);
        expect(next).toHaveLength(2);
        expect(next.map((item) => item.path)).toEqual(["/a", "/b/"]);
    });

    it("applyScanQueueRemove 按路径移除", () => {
        const existing = [createScanQueueItem({ path: "/a" }), createScanQueueItem({ path: "/b" })];
        expect(applyScanQueueRemove(existing, "/a/")).toHaveLength(1);
        expect(applyScanQueueRemove(existing, "/a/")[0].path).toBe("/b");
    });

    it("applyScanQueueUpdate 合并状态与 updates", () => {
        const existing = [createScanQueueItem({ path: "/a", status: "pending", retryCount: 0 })];
        const next = applyScanQueueUpdate(existing, "/a/", "running", {
            startedAt: 42,
            retryCount: 1,
        });
        expect(next[0].status).toBe("running");
        expect(next[0].startedAt).toBe(42);
        expect(next[0].retryCount).toBe(1);
    });
});

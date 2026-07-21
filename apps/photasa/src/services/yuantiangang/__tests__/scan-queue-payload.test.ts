import { describe, it, expect } from "vitest";
import type { ScanAction } from "@photasa/common";
import {
    extractActionsFromContext,
    normalizeRestoredQueueItem,
    scanActionToPersistedEntry,
} from "../scan-queue-payload";

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
});

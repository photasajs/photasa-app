import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ScanAction } from "@photasa/common";
import { ZOUZHE_MATTERS } from "@renderer/interfaces/fang-xuan-ling.interface";
import {
    executeScanQueueZhaoling,
    extractActionsFromContext,
    normalizeRestoredQueueItem,
    SCAN_QUEUE_COMMANDS,
    scanActionToPersistedEntry,
} from "../scan-queue-bridge";

const mockInvoke = vi.fn();

vi.mock("@tauri-apps/api/core", () => ({
    invoke: (...args: unknown[]) => mockInvoke(...args),
}));

vi.mock("@renderer/api/env", () => ({
    isTauri: () => true,
}));

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

describe("scan-queue-bridge", () => {
    beforeEach(() => {
        mockInvoke.mockReset();
    });

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

    it("GET 走 scan_queue_get", async () => {
        mockInvoke.mockResolvedValue([{ path: "/restored", action: "scan", timestamp: 1 }]);
        const result = await executeScanQueueZhaoling(ZOUZHE_MATTERS.GET_SCANNING_QUEUE, {});
        expect(mockInvoke).toHaveBeenCalledWith(SCAN_QUEUE_COMMANDS.GET);
        expect(result.queue).toHaveLength(1);
        expect(result.queue[0].path).toBe("/restored");
    });

    it("ADD 走 scan_queue_add_actions", async () => {
        const action = createTestAction({ path: "/added" });
        mockInvoke.mockResolvedValue([scanActionToPersistedEntry(action)]);
        const result = await executeScanQueueZhaoling(ZOUZHE_MATTERS.ADD_SCAN_ACTION, {
            action,
        });
        expect(mockInvoke).toHaveBeenCalledWith(
            SCAN_QUEUE_COMMANDS.ADD,
            expect.objectContaining({
                actions: [expect.objectContaining({ path: "/added", status: "pending" })],
            }),
        );
        expect(result.queue[0].path).toBe("/added");
    });

    it("extractActionsFromContext 支持 actions 数组", () => {
        const actions = [createTestAction()];
        expect(extractActionsFromContext({ actions })).toEqual(actions);
    });
});

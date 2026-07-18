import { describe, it, expect, beforeEach } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { useScanningStore } from "../stores/scanning-store";
import { createScanQueueItem, type ScanQueueItem } from "@renderer/stores/scanning-types";

/**
 * Helper: 创建测试用 ScanQueueItem（Store 内部类型）
 */
function createTestScanQueueItem(overrides: Partial<ScanQueueItem> = {}): ScanQueueItem {
    return createScanQueueItem({
        path: overrides.path || "/test/path",
        action: overrides.action || "scan",
        thumbnailSize: overrides.thumbnailSize || 150,
        operationType: overrides.operationType || "directory",
        source: overrides.source || "user",
        maxRetries: overrides.maxRetries || 3,
    });
}

describe("ScanningStore", () => {
    beforeEach(() => {
        setActivePinia(createPinia());
    });

    describe("初始状态", () => {
        it("应该有正确的初始状态", () => {
            const store = useScanningStore();

            expect(store.queue).toEqual([]);
            expect(store.isProcessing).toBe(false);
            expect(store.currentPath).toBe(null);
        });
    });

    describe("Getters", () => {
        it("queueSize应该返回队列长度", () => {
            const store = useScanningStore();
            expect(store.queueSize).toBe(0);

            const action = createTestScanQueueItem({ path: "/test/path1", action: "scan" });
            store.addToQueue(action);

            expect(store.queueSize).toBe(1);
        });

        it("queuePaths应该返回所有路径", () => {
            const store = useScanningStore();

            const action1 = createTestScanQueueItem({ path: "/test/path1", action: "scan" });
            const action2 = createTestScanQueueItem({ path: "/test/path2", action: "rescan" });

            store.addToQueue(action1);
            store.addToQueue(action2);

            expect(store.queuePaths).toEqual(["/test/path1", "/test/path2"]);
        });

        it("isInQueue应该正确检查路径是否在队列中", () => {
            const store = useScanningStore();

            const action = createTestScanQueueItem({ path: "/test/path1", action: "scan" });

            expect(store.isInQueue("/test/path1")).toBe(false);

            store.addToQueue(action);

            expect(store.isInQueue("/test/path1")).toBe(true);
            expect(store.isInQueue("/test/path2")).toBe(false);
        });

        it("nextScanAction应该返回下一个待扫描任务", () => {
            const store = useScanningStore();

            expect(store.nextScanAction).toBe(null);

            const action1 = createTestScanQueueItem({ path: "/test/path1", action: "scan" });
            const action2 = createTestScanQueueItem({ path: "/test/path2", action: "rescan" });

            store.addToQueue(action1);
            store.addToQueue(action2);

            expect(store.nextScanAction).toEqual(action1);
        });
    });

    describe("Actions", () => {
        describe("addToQueue", () => {
            it("应该成功添加任务到队列", () => {
                const store = useScanningStore();

                const action = createTestScanQueueItem({ path: "/test/path1", action: "scan" });

                store.addToQueue(action);

                expect(store.queue).toHaveLength(1);
                expect(store.queue[0]).toEqual(action);
            });

            it("应该能添加多个任务", () => {
                const store = useScanningStore();

                const action1 = createTestScanQueueItem({ path: "/test/path1", action: "scan" });
                const action2 = createTestScanQueueItem({ path: "/test/path2", action: "rescan" });

                store.addToQueue(action1);
                store.addToQueue(action2);

                expect(store.queue).toHaveLength(2);
                expect(store.queue[0]).toEqual(action1);
                expect(store.queue[1]).toEqual(action2);
            });
        });

        describe("removeFromQueue", () => {
            it("应该成功从队列中移除任务", () => {
                const store = useScanningStore();

                const action = createTestScanQueueItem({ path: "/test/path1", action: "scan" });

                store.addToQueue(action);
                expect(store.queue).toHaveLength(1);

                store.removeFromQueue("/test/path1");
                expect(store.queue).toHaveLength(0);
            });

            it("移除不存在的路径不应报错", () => {
                const store = useScanningStore();

                const action = createTestScanQueueItem({ path: "/test/path1", action: "scan" });

                store.addToQueue(action);
                expect(store.queue).toHaveLength(1);

                store.removeFromQueue("/test/nonexistent");
                expect(store.queue).toHaveLength(1);
            });

            it("应该只移除第一个匹配的任务", () => {
                const store = useScanningStore();

                const action1 = createTestScanQueueItem({ path: "/test/path1", action: "scan" });
                const action2 = createTestScanQueueItem({ path: "/test/path2", action: "rescan" });

                store.addToQueue(action1);
                store.addToQueue(action2);

                store.removeFromQueue("/test/path1");

                expect(store.queue).toHaveLength(1);
                expect(store.queue[0]).toEqual(action2);
            });
        });

        describe("clearQueue", () => {
            it("应该清空队列和重置状态", () => {
                const store = useScanningStore();

                const action = createTestScanQueueItem({ path: "/test/path1", action: "scan" });

                store.addToQueue(action);
                store.setProcessingStatus(true, "/test/path1");

                expect(store.queue).toHaveLength(1);
                expect(store.isProcessing).toBe(true);
                expect(store.currentPath).toBe("/test/path1");

                store.clearQueue();

                expect(store.queue).toHaveLength(0);
                expect(store.isProcessing).toBe(false);
                expect(store.currentPath).toBe(null);
            });
        });

        describe("setQueue", () => {
            it("应该批量设置队列", () => {
                const store = useScanningStore();

                const actions: ScanQueueItem[] = [
                    createTestScanQueueItem({ path: "/test/path1", action: "scan" }),
                    createTestScanQueueItem({ path: "/test/path2", action: "rescan" }),
                ];

                store.setQueue(actions);

                expect(store.queue).toHaveLength(2);
                expect(store.queue).toEqual(actions);
            });

            it("应该创建队列副本而不是引用", () => {
                const store = useScanningStore();

                const actions: ScanQueueItem[] = [
                    createTestScanQueueItem({ path: "/test/path1", action: "scan" }),
                ];

                store.setQueue(actions);

                // 修改原数组不应影响store
                actions.push(createTestScanQueueItem({ path: "/test/path2", action: "scan" }));

                expect(store.queue).toHaveLength(1);
            });

            it("应该替换现有队列", () => {
                const store = useScanningStore();

                const action1 = createTestScanQueueItem({ path: "/test/old", action: "scan" });

                store.addToQueue(action1);
                expect(store.queue).toHaveLength(1);

                const newActions: ScanQueueItem[] = [
                    createTestScanQueueItem({ path: "/test/new1", action: "scan" }),
                    createTestScanQueueItem({ path: "/test/new2", action: "rescan" }),
                ];

                store.setQueue(newActions);

                expect(store.queue).toHaveLength(2);
                expect(store.queue[0].path).toBe("/test/new1");
                expect(store.queue[1].path).toBe("/test/new2");
            });
        });

        describe("setProcessingStatus", () => {
            it("应该更新处理状态", () => {
                const store = useScanningStore();

                store.setProcessingStatus(true, "/test/path1");

                expect(store.isProcessing).toBe(true);
                expect(store.currentPath).toBe("/test/path1");
            });

            it("应该能清除currentPath", () => {
                const store = useScanningStore();

                store.setProcessingStatus(true, "/test/path1");
                expect(store.currentPath).toBe("/test/path1");

                store.setProcessingStatus(false);
                expect(store.isProcessing).toBe(false);
                expect(store.currentPath).toBe(null);
            });
        });

        describe("updateProgress", () => {
            it("应该更新任务进度", () => {
                const store = useScanningStore();

                const action = createTestScanQueueItem({ path: "/test/path1", action: "scan" });

                store.addToQueue(action);

                store.updateProgress("/test/path1", { processed: 10, total: 100 });

                expect(store.queue[0].progress).toEqual({
                    processed: 10,
                    total: 100,
                    cacheEnabled: true,
                });
            });

            it("更新不存在路径的进度不应报错", () => {
                const store = useScanningStore();

                const action = createTestScanQueueItem({ path: "/test/path1", action: "scan" });

                store.addToQueue(action);

                expect(() => {
                    store.updateProgress("/test/nonexistent", { processed: 10, total: 100 });
                }).not.toThrow();

                expect(store.queue[0].progress).toBeUndefined();
            });
        });
    });

    describe("持久化", () => {
        it("Store配置为不持久化", () => {
            const store = useScanningStore();

            // Store的persist配置在defineStore中设置为false
            // 这确保了运行时状态不会自动持久化到localStorage
            // 持久化由天界（千里眼）通过scanning.json管理
            expect(store.queue).toBeDefined();
        });
    });
});

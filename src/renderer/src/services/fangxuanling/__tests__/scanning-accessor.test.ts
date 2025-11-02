import { describe, it, expect, beforeEach, vi } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { FangXuanLingService } from "../fangxuanling";
import { useScanningStore } from "../stores/scanning-store";
import { createScanningService } from "../accessors/service-builders";
import type { ScanAction } from "@common/scan-types";
import type { IYuanTianGangService } from "@renderer/interfaces/yuan-tian-gang.interface";

// Mock YuanTianGang服务
const mockYuanTianGang = {
    executeZhaoling: vi.fn(),
} as unknown as IYuanTianGangService;

describe("FangXuanLing 扫描队列访问器（只读模式）", () => {
    let fangXuanLing: FangXuanLingService;
    let scanningStore: ReturnType<typeof useScanningStore>;

    beforeEach(() => {
        setActivePinia(createPinia());
        fangXuanLing = new FangXuanLingService(mockYuanTianGang);
        scanningStore = useScanningStore();
    });

    describe("只读属性：queue", () => {
        it("应该返回响应式队列引用（RFC 0042设计）", () => {
            const action: ScanAction = {
                path: "/test/path1",
                action: "scan",
                thumbnailSize: 150,
                operationType: "directory",
            };

            // 通过Store直接添加（模拟其他服务通过Zouzhe修改）
            scanningStore.addToQueue(action);

            const queue = fangXuanLing.scanning.queue;

            expect(queue).toHaveLength(1);
            expect(queue[0]).toEqual(action);

            // ✅ RFC 0042: 返回响应式数组引用，使Vue可以追踪变化
            // 验证返回的是同一个响应式引用
            expect(fangXuanLing.scanning.queue).toBe(queue);

            // 通过Store添加另一个action
            scanningStore.addToQueue({
                path: "/test/path2",
                action: "scan",
                thumbnailSize: 150,
                operationType: "directory",
            });

            // 验证响应式引用会自动更新
            expect(fangXuanLing.scanning.queue).toHaveLength(2);
        });

        it("Store未初始化时应返回空数组", () => {
            // 创建新的accessor实例
            const emptyAccessor = createScanningService();
            expect(emptyAccessor.queue).toEqual([]);
        });
    });

    describe("只读属性：queueSize", () => {
        it("应该返回队列大小", () => {
            expect(fangXuanLing.scanning.queueSize).toBe(0);

            // 通过Store直接添加（模拟其他服务通过Zouzhe修改）
            scanningStore.addToQueue({
                path: "/test/path1",
                action: "scan",
                thumbnailSize: 150,
                operationType: "directory",
            });

            expect(fangXuanLing.scanning.queueSize).toBe(1);

            scanningStore.addToQueue({
                path: "/test/path2",
                action: "rescan",
                thumbnailSize: 150,
                operationType: "directory",
            });

            expect(fangXuanLing.scanning.queueSize).toBe(2);
        });

        it("Store未初始化时应返回0", () => {
            const emptyAccessor = createScanningService();
            expect(emptyAccessor.queueSize).toBe(0);
        });
    });

    describe("只读属性：isProcessing", () => {
        it("应该返回处理状态", () => {
            expect(fangXuanLing.scanning.isProcessing).toBe(false);

            // 通过Store设置处理状态（模拟其他服务通过Zouzhe修改）
            scanningStore.setProcessingStatus(true, "/test/path");

            expect(fangXuanLing.scanning.isProcessing).toBe(true);
        });

        it("Store未初始化时应返回false", () => {
            const emptyAccessor = createScanningService();
            expect(emptyAccessor.isProcessing).toBe(false);
        });
    });

    describe("只读属性：currentPath", () => {
        it("应该返回当前处理路径", () => {
            expect(fangXuanLing.scanning.currentPath).toBeNull();

            // 通过Store设置处理状态（模拟其他服务通过Zouzhe修改）
            scanningStore.setProcessingStatus(true, "/test/current");

            expect(fangXuanLing.scanning.currentPath).toBe("/test/current");
        });

        it("Store未初始化时应返回null", () => {
            const emptyAccessor = createScanningService();
            expect(emptyAccessor.currentPath).toBeNull();
        });
    });

    describe("只读属性：nextScanAction", () => {
        it("应该返回下一个待处理任务", () => {
            expect(fangXuanLing.scanning.nextScanAction).toBeNull();

            const action: ScanAction = {
                path: "/test/path1",
                action: "scan",
                thumbnailSize: 150,
                operationType: "directory",
            };

            // 通过Store添加任务（模拟其他服务通过Zouzhe修改）
            scanningStore.addToQueue(action);

            expect(fangXuanLing.scanning.nextScanAction).toEqual(action);
        });

        it("Store未初始化时应返回null", () => {
            const emptyAccessor = createScanningService();
            expect(emptyAccessor.nextScanAction).toBeNull();
        });
    });

    describe("只读方法：isInQueue", () => {
        it("应该正确检查路径是否在队列中", () => {
            const path = "/test/path1";

            expect(fangXuanLing.scanning.isInQueue(path)).toBe(false);

            // 通过Store添加任务（模拟其他服务通过Zouzhe修改）
            scanningStore.addToQueue({
                path,
                action: "scan",
                thumbnailSize: 150,
                operationType: "directory",
            });

            expect(fangXuanLing.scanning.isInQueue(path)).toBe(true);
            expect(fangXuanLing.scanning.isInQueue("/test/other")).toBe(false);
        });

        it("Store未初始化时应返回false", () => {
            const emptyAccessor = createScanningService();
            expect(emptyAccessor.isInQueue("/any/path")).toBe(false);
        });
    });

    describe("设计原则验证", () => {
        it("accessor应该只提供只读访问，无修改方法", () => {
            const accessor = fangXuanLing.scanning;

            // 验证只有只读属性和方法
            expect(accessor).toHaveProperty("queue");
            expect(accessor).toHaveProperty("queueSize");
            expect(accessor).toHaveProperty("isProcessing");
            expect(accessor).toHaveProperty("currentPath");
            expect(accessor).toHaveProperty("nextScanAction");
            expect(accessor).toHaveProperty("isInQueue");

            // 验证没有修改方法
            expect(accessor).not.toHaveProperty("addToQueue");
            expect(accessor).not.toHaveProperty("removeFromQueue");
            expect(accessor).not.toHaveProperty("clearQueue");
            expect(accessor).not.toHaveProperty("setQueue");
            expect(accessor).not.toHaveProperty("updateProgress");
        });

        it("应该与Store状态实时同步（只读）", () => {
            // 通过Store修改（模拟其他服务通过Zouzhe修改）
            scanningStore.addToQueue({
                path: "/test/path",
                action: "scan",
                thumbnailSize: 150,
                operationType: "directory",
            });

            // accessor应该立即反映变化
            expect(fangXuanLing.scanning.queueSize).toBe(1);
            expect(scanningStore.queueSize).toBe(1);

            // 通过Store清空（模拟其他服务通过Zouzhe修改）
            scanningStore.clearQueue();

            // accessor应该立即反映变化
            expect(fangXuanLing.scanning.queueSize).toBe(0);
            expect(scanningStore.queueSize).toBe(0);
        });
    });

    describe("集成场景：完整工作流", () => {
        it("应该支持完整的只读查询流程", () => {
            // 1. 初始状态查询
            expect(fangXuanLing.scanning.queueSize).toBe(0);
            expect(fangXuanLing.scanning.isProcessing).toBe(false);
            expect(fangXuanLing.scanning.currentPath).toBeNull();

            // 2. 其他服务通过Zouzhe添加任务（这里直接操作Store模拟）
            const action1: ScanAction = {
                path: "/test/path1",
                action: "scan",
                thumbnailSize: 150,
                operationType: "directory",
            };
            const action2: ScanAction = {
                path: "/test/path2",
                action: "scan",
                thumbnailSize: 150,
                operationType: "directory",
            };

            scanningStore.addToQueue(action1);
            scanningStore.addToQueue(action2);

            // 3. 通过accessor查询状态
            expect(fangXuanLing.scanning.queueSize).toBe(2);
            expect(fangXuanLing.scanning.isInQueue("/test/path1")).toBe(true);
            expect(fangXuanLing.scanning.isInQueue("/test/path2")).toBe(true);

            // 4. 查询下一个任务
            const nextTask = fangXuanLing.scanning.nextScanAction;
            expect(nextTask).toEqual(action1);

            // 5. 其他服务通过Zouzhe更新进度（这里直接操作Store模拟）
            scanningStore.updateProgress("/test/path1", { processed: 5, total: 10 });

            // 6. 查询队列状态
            const queue = fangXuanLing.scanning.queue;
            expect(queue[0].progress?.processed).toBe(5);

            // 7. 其他服务通过Zouzhe移除任务（这里直接操作Store模拟）
            scanningStore.removeFromQueue("/test/path1");

            expect(fangXuanLing.scanning.queueSize).toBe(1);
            expect(fangXuanLing.scanning.isInQueue("/test/path1")).toBe(false);
        });
    });

    describe("文档说明：如何修改扫描队列", () => {
        it("示例：其他服务应该如何修改扫描队列", async () => {
            /**
             * ⚠️ 重要：修改扫描队列的正确方式
             *
             * 1. 不要直接调用FangXuanLing的方法修改
             * 2. 应该创建Zouzhe（奏折）提交给FangXuanLing
             * 3. FangXuanLing通过processZouzhe()处理修改请求
             *
             * 示例代码（伪代码，实际应在YuChiGong等服务中实现）：
             *
             * ```typescript
             * // 添加扫描任务的正确方式
             * const zouzhe: Zouzhe = {
             *     department: 'YuChiGong',
             *     matter: 'ADD_SCAN_TASK',
             *     content: {
             *         action: {
             *             path: '/test/path',
             *             action: 'scan',
             *             thumbnailSize: 150,
             *             operationType: 'directory'
             *         }
             *     },
             *     timestamp: Date.now(),
             *     priority: ZOUZHE_PRIORITIES.NORMAL
             * };
             *
             * await this.fangXuanLingService.processZouzhe(zouzhe);
             * ```
             *
             * FangXuanLing会：
             * 1. 接收Zouzhe
             * 2. 根据matter类型调用对应的Store action
             * 3. 发送Zhaoling给天界（Main进程）
             * 4. 天界执行实际修改并返回结果
             */

            // 这个测试只是文档说明，实际验证在集成测试中进行
            expect(true).toBe(true);
        });
    });
});

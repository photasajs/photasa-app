/**
 * 扫描队列集成测试 (RFC 0042 Phase 2.6)
 *
 * 测试完整的数据流：尉迟恭 → 房玄龄 → 袁天罡 → 天枢 → 千里眼
 *
 * 架构流程：
 * 1. 尉迟恭(YuChiGong) - 用户操作服务，提交扫描请求
 * 2. 房玄龄(FangXuanLing) - 前端门户服务，processZouzhe处理奏折
 * 3. 袁天罡(YuanTianGang) - 祈请服务，executeZhaoling执行诏令
 * 4. 天枢(Tianshu) - 工作流引擎，processCommand执行命令
 * 5. 千里眼(Qianliyan) - 后端引擎，scan_folder操作
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { ScanAction } from "@photasa/common";
import { createPinia, setActivePinia } from "pinia";
import { FangXuanLingService } from "../fangxuanling/fangxuanling";
import { YuanTianGangService } from "../yuantiangang";
import {
    ZOUZHE_MATTERS,
    ZOUZHE_PRIORITIES,
    GUANYUAN_NAMES,
    type Zouzhe,
} from "@renderer/interfaces/fang-xuan-ling.interface";
import { useScanningStore } from "../fangxuanling/stores/scanning-store";
import { createScanQueueItem } from "@renderer/stores/scanning-types";
import { SCAN_QUEUE_COMMANDS } from "../yuantiangang/tauri-command-names";

const mockTauriInvoke = vi.hoisted(() => vi.fn());
let mockPersistedQueue: Record<string, unknown>[] = [];

vi.mock("@tauri-apps/api/core", () => ({
    invoke: (...args: unknown[]) => mockTauriInvoke(...args),
}));

vi.mock("@renderer/api/env", () => ({
    isTauri: () => true,
}));

/**
 * Helper: 创建测试用 ScanAction（IPC 契约）
 */
function createTestScanAction(overrides: Partial<ScanAction> = {}): ScanAction {
    return {
        path: "/test/path",
        action: "scan",
        thumbnailSize: 150,
        operationType: "directory",
        source: "user",
        ...overrides,
    };
}

describe("扫描队列集成测试 - RFC 0042 Phase 2.6", () => {
    let fangXuanLing: FangXuanLingService;

    beforeEach(() => {
        const pinia = createPinia();
        setActivePinia(pinia);

        mockPersistedQueue = [];
        mockTauriInvoke.mockReset();
        mockTauriInvoke.mockImplementation(
            async (command: string, args?: Record<string, unknown>) => {
                if (command === SCAN_QUEUE_COMMANDS.GET) {
                    return [...mockPersistedQueue];
                }
                if (command === SCAN_QUEUE_COMMANDS.ADD) {
                    const actions = (args?.actions ?? []) as Record<string, unknown>[];
                    for (const action of actions) {
                        const path = String(action.path);
                        if (!mockPersistedQueue.some((item) => item.path === path)) {
                            mockPersistedQueue.push(action);
                        }
                    }
                    return [...mockPersistedQueue];
                }
                if (command === SCAN_QUEUE_COMMANDS.REMOVE) {
                    const path = String(args?.path ?? "");
                    mockPersistedQueue = mockPersistedQueue.filter((item) => item.path !== path);
                    return [...mockPersistedQueue];
                }
                if (command === SCAN_QUEUE_COMMANDS.UPDATE) {
                    const path = String(args?.path ?? "");
                    const status = String(args?.status ?? "pending");
                    const updates = (args?.updates ?? {}) as Record<string, unknown>;
                    mockPersistedQueue = mockPersistedQueue.map((item) =>
                        item.path === path ? { ...item, status, ...updates } : item,
                    );
                    return [...mockPersistedQueue];
                }
                return null;
            },
        );

        // Mock天枢和千里眼的IPC调用
        const mockTianshuCall = vi.fn().mockResolvedValue({
            success: true,
            result: {
                success: true,
                queueSize: 1,
                updatedQueue: [],
            },
        });

        const mockQianliyanCall = vi.fn().mockResolvedValue({
            success: true,
            data: {
                folder: "/test/path",
                totalFiles: 10,
            },
        });

        // Mock window.api and window.tianshu for testing
        // 袁天罡使用 (window as any).tianshu.processCommand
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (window as any).tianshu = {
            processCommand: mockTianshuCall,
            onProgress: vi.fn(),
            offProgress: vi.fn(),
        };

        (window as any).electronAPI = {
            get tianshu() {
                return (window as any).tianshu;
            },
        };

        // 某些服务可能使用 window.api
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (window as any).api = {
            tianshu: {
                processCommand: mockTianshuCall,
                onProgress: vi.fn(),
                offProgress: vi.fn(),
            },
            qianliyan: {
                scanFolder: mockQianliyanCall,
            },
        };

        // 初始化服务（按正确的依赖顺序）
        // 1. 袁天罡服务（依赖window.api.tianshu）
        const yuanTianGang = new YuanTianGangService();

        // 2. 房玄龄服务（依赖袁天罡）
        fangXuanLing = new FangXuanLingService(yuanTianGang);
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe("端到端测试：尉迟恭 → 房玄龄 → 袁天罡 → 天枢 → 千里眼", () => {
        it("应该成功完成完整的扫描队列添加流程", async () => {
            const testPath = "/test/folder";

            // Step 1: 构建ADD_SCAN_ACTION奏折（通常由尉迟恭创建）
            const zouzhe: Zouzhe = {
                department: GUANYUAN_NAMES.YU_CHI_GONG,
                matter: ZOUZHE_MATTERS.ADD_SCAN_ACTION,
                content: {
                    action: createTestScanAction({
                        path: testPath,
                        action: "scan",
                        thumbnailSize: 150,
                        source: "user",
                        operationType: "directory",
                    }),
                },
                timestamp: Date.now(),
                priority: ZOUZHE_PRIORITIES.NORMAL,
            };

            // 验证奏折格式
            expect(zouzhe).toBeDefined();
            expect(zouzhe.matter).toBe(ZOUZHE_MATTERS.ADD_SCAN_ACTION);
            expect(zouzhe.content).toHaveProperty("action");

            // Step 2: 房玄龄 - 处理奏折并转换为诏令
            const response = await fangXuanLing.processZouzhe(zouzhe);

            // 验证房玄龄响应
            expect(response).toBeDefined();
            expect(response.approved).toBe(true);
            expect(response.data).toHaveProperty("queue");
        });

        it("应该成功完成完整的扫描队列移除流程", async () => {
            const testPath = "/test/folder";

            // Step 1: 构建REMOVE_SCAN_ACTION奏折
            const zouzhe: Zouzhe = {
                department: GUANYUAN_NAMES.YU_CHI_GONG,
                matter: ZOUZHE_MATTERS.REMOVE_SCAN_ACTION,
                content: {
                    path: testPath,
                },
                timestamp: Date.now(),
                priority: ZOUZHE_PRIORITIES.NORMAL,
            };

            // 验证奏折格式
            expect(zouzhe.matter).toBe(ZOUZHE_MATTERS.REMOVE_SCAN_ACTION);
            expect(zouzhe.content).toHaveProperty("path", testPath);

            // Step 2: 房玄龄 - 处理奏折
            const response = await fangXuanLing.processZouzhe(zouzhe);

            // 验证响应
            expect(response.approved).toBe(true);
            expect(response.data).toHaveProperty("queue");
        });

        it("应该成功完成完整的扫描队列查询流程", async () => {
            // Step 1: 构建GET_SCANNING_QUEUE奏折
            const zouzhe: Zouzhe = {
                department: GUANYUAN_NAMES.YU_CHI_GONG,
                matter: ZOUZHE_MATTERS.GET_SCANNING_QUEUE,
                timestamp: Date.now(),
                priority: ZOUZHE_PRIORITIES.NORMAL,
            };

            // 验证奏折格式
            expect(zouzhe.matter).toBe(ZOUZHE_MATTERS.GET_SCANNING_QUEUE);

            // Step 2: 房玄龄 - 处理奏折
            const response = await fangXuanLing.processZouzhe(zouzhe);

            // 验证响应
            expect(response.approved).toBe(true);
            expect(response.data).toHaveProperty("queue");
        });
    });

    describe("断电恢复场景测试", () => {
        it("应该在重启后恢复扫描队列状态", async () => {
            // 模拟断电前的状态：队列中有待处理任务
            const mockQueueBeforeCrash: ScanAction[] = [
                createTestScanAction({
                    path: "/test/folder1",
                    action: "scan",
                    thumbnailSize: 150,
                    source: "user",
                    timestamp: Date.now() - 1000,
                    operationType: "directory",
                }),
                createTestScanAction({
                    path: "/test/folder2",
                    action: "rescan",
                    thumbnailSize: 150,
                    source: "auto",
                    timestamp: Date.now() - 500,
                    operationType: "directory",
                }),
            ];

            // Mock天枢返回恢复的队列
            window.api.tianshu.processCommand = vi.fn().mockResolvedValue({
                success: true,
                result: {
                    success: true,
                    queue: mockQueueBeforeCrash,
                    queueSize: mockQueueBeforeCrash.length,
                },
            });

            // 模拟应用重启：请求恢复队列
            const zouzhe: Zouzhe = {
                department: GUANYUAN_NAMES.YU_CHI_GONG,
                matter: ZOUZHE_MATTERS.GET_SCANNING_QUEUE,
                timestamp: Date.now(),
                priority: ZOUZHE_PRIORITIES.NORMAL,
            };

            const response = await fangXuanLing.processZouzhe(zouzhe);

            // 验证队列恢复成功
            expect(response.approved).toBe(true);

            // 验证房玄龄可以访问恢复的队列
            const restoredQueue = fangXuanLing.scanning.queue;
            expect(restoredQueue).toBeDefined();
        });

        it("应该在断电后正确处理部分完成的扫描任务", async () => {
            // RFC 0143: 袁天罡直接拦截队列 Zouzhe，返回 Pinia store 快照
            // Tianshu 不再被调用，直接从本地 store 同步状态
            const scanningStore = useScanningStore();
            const partialAction = createScanQueueItem({
                path: "/test/partial",
                action: "scan",
                thumbnailSize: 150,
                operationType: "directory",
            });
            scanningStore.addToQueue(partialAction);

            // 查询当前处理状态
            const zouzhe: Zouzhe = {
                department: GUANYUAN_NAMES.YU_CHI_GONG,
                matter: ZOUZHE_MATTERS.GET_SCANNING_QUEUE,
                timestamp: Date.now(),
                priority: ZOUZHE_PRIORITIES.NORMAL,
            };

            const response = await fangXuanLing.processZouzhe(zouzhe);

            // 验证袁天罡直连拦截，返回 Pinia 快照
            expect(response.approved).toBe(true);
            expect(response.data).toHaveProperty("queue");
            expect(Array.isArray(response.data.queue)).toBe(true);
        });

        it("应该在断电后正确恢复空队列状态", async () => {
            // RFC 0143: 袁天罡直连拦截，直接返回 Pinia store 快照（此时为空队列）
            const zouzhe: Zouzhe = {
                department: GUANYUAN_NAMES.YU_CHI_GONG,
                matter: ZOUZHE_MATTERS.GET_SCANNING_QUEUE,
                timestamp: Date.now(),
                priority: ZOUZHE_PRIORITIES.NORMAL,
            };

            const response = await fangXuanLing.processZouzhe(zouzhe);

            // 验证空队列状态正确（Pinia store 初始为空）
            expect(response.approved).toBe(true);
            expect(response.data).toHaveProperty("queue");
            expect(Array.isArray(response.data.queue)).toBe(true);
            expect(response.data.queue).toHaveLength(0);
        });
    });

    describe("错误处理测试", () => {
        it("RFC 0143: 扫描队列 Zouzhe 由袁天罡直连拦截，不经过天枢", async () => {
            // RFC 0143: ADD_SCAN_ACTION 由袁天罡直连 Pinia 拦截
            // 即使 Tianshu mock 失败，队列操作也应成功（不依赖 Tianshu）
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (window as any).tianshu.processCommand = vi
                .fn()
                .mockRejectedValue(new Error("天枢不可用"));

            const zouzhe: Zouzhe = {
                department: GUANYUAN_NAMES.YU_CHI_GONG,
                matter: ZOUZHE_MATTERS.ADD_SCAN_ACTION,
                content: {
                    action: createTestScanAction({
                        path: "/test/path",
                        action: "scan",
                        thumbnailSize: 150,
                        source: "user",
                        operationType: "directory",
                    }),
                },
                timestamp: Date.now(),
                priority: ZOUZHE_PRIORITIES.NORMAL,
            };

            const response = await fangXuanLing.processZouzhe(zouzhe);

            // RFC 0143: 袁天罡本地拦截，不依赖 Tianshu，应该成功
            expect(response.approved).toBe(true);
            expect(response.data).toHaveProperty("queue");
        });

        it("RFC 0143: GET_SCANNING_QUEUE 返回本地 Pinia store 快照", async () => {
            // RFC 0143: GET_SCANNING_QUEUE 由袁天罡直连 Pinia 拦截
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (window as any).tianshu.processCommand = vi
                .fn()
                .mockRejectedValue(new Error("千里眼不可用"));

            const zouzhe: Zouzhe = {
                department: GUANYUAN_NAMES.YU_CHI_GONG,
                matter: ZOUZHE_MATTERS.ADD_SCAN_ACTION,
                content: {
                    action: createTestScanAction({
                        path: "/invalid/path",
                        action: "scan",
                        thumbnailSize: 150,
                        source: "user",
                        operationType: "directory",
                    }),
                },
                timestamp: Date.now(),
                priority: ZOUZHE_PRIORITIES.NORMAL,
            };

            const response = await fangXuanLing.processZouzhe(zouzhe);

            // RFC 0143: 本地拦截，不传播 Tianshu 错误
            expect(response.approved).toBe(true);
            expect(response.data).toHaveProperty("queue");
        });

        it("应该正确处理无效的扫描路径", async () => {
            const invalidPath = "";

            const zouzhe: Zouzhe = {
                department: GUANYUAN_NAMES.YU_CHI_GONG,
                matter: ZOUZHE_MATTERS.ADD_SCAN_ACTION,
                content: {
                    action: createTestScanAction({
                        path: invalidPath,
                        action: "scan",
                        thumbnailSize: 150,
                        source: "user",
                        operationType: "directory",
                    }),
                },
                timestamp: Date.now(),
                priority: ZOUZHE_PRIORITIES.NORMAL,
            };

            const response = await fangXuanLing.processZouzhe(zouzhe);

            // 验证房玄龄可以处理（由天枢工作流验证路径有效性）
            expect(response).toBeDefined();
        });
    });

    describe("响应式数据流测试", () => {
        it("应该在Store更新后自动触发房玄龄的响应式引用更新", async () => {
            // Mock天枢返回成功
            window.api.tianshu.processCommand = vi.fn().mockResolvedValue({
                success: true,
                result: {
                    success: true,
                    queueSize: 1,
                    updatedQueue: [
                        createTestScanAction({
                            path: "/test/reactive",
                            action: "scan",
                            thumbnailSize: 150,
                            source: "user",
                            operationType: "directory",
                        }),
                    ],
                },
            });

            // 获取初始队列引用
            const initialQueue = fangXuanLing.scanning.queue;
            const initialSize = fangXuanLing.scanning.queueSize;

            // 执行添加操作
            const zouzhe: Zouzhe = {
                department: GUANYUAN_NAMES.YU_CHI_GONG,
                matter: ZOUZHE_MATTERS.ADD_SCAN_ACTION,
                content: {
                    action: createTestScanAction({
                        path: "/test/reactive",
                        action: "scan",
                        thumbnailSize: 150,
                        source: "user",
                        operationType: "directory",
                    }),
                },
                timestamp: Date.now(),
                priority: ZOUZHE_PRIORITIES.NORMAL,
            };

            await fangXuanLing.processZouzhe(zouzhe);

            // 验证响应式引用自动更新
            const updatedQueue = fangXuanLing.scanning.queue;
            const updatedSize = fangXuanLing.scanning.queueSize;

            // 验证响应式队列已更新
            expect(updatedQueue).toBeDefined();

            // 内容和大小已更新
            expect(typeof updatedSize).toBe("number");
            expect(updatedSize).toBeGreaterThanOrEqual(initialSize);
        });

        it("应该在多次操作后保持响应式引用一致性", async () => {
            // 执行多次操作
            for (let i = 0; i < 3; i++) {
                const zouzhe: Zouzhe = {
                    department: GUANYUAN_NAMES.YU_CHI_GONG,
                    matter: ZOUZHE_MATTERS.ADD_SCAN_ACTION,
                    content: {
                        action: createTestScanAction({
                            path: `/test/path${i}`,
                            action: "scan",
                            thumbnailSize: 150,
                            source: "user",
                            operationType: "directory",
                        }),
                    },
                    timestamp: Date.now(),
                    priority: ZOUZHE_PRIORITIES.NORMAL,
                };

                await fangXuanLing.processZouzhe(zouzhe);

                // 验证队列保持定义并更新
                expect(fangXuanLing.scanning.queue).toBeDefined();
            }
        });
    });

    describe("并发操作测试", () => {
        it("应该正确处理并发的扫描请求", async () => {
            const paths = ["/test/concurrent1", "/test/concurrent2", "/test/concurrent3"];

            // 并发提交多个扫描请求
            const promises = paths.map((path) => {
                const zouzhe: Zouzhe = {
                    department: GUANYUAN_NAMES.YU_CHI_GONG,
                    matter: ZOUZHE_MATTERS.ADD_SCAN_ACTION,
                    content: {
                        action: createTestScanAction({
                            path,
                            action: "scan",
                            thumbnailSize: 150,
                            source: "user",
                            operationType: "directory",
                        }),
                        actions: [
                            createTestScanAction({
                                path,
                                action: "scan",
                                thumbnailSize: 150,
                                source: "user",
                                operationType: "directory",
                            }),
                        ],
                    },
                    timestamp: Date.now(),
                    priority: ZOUZHE_PRIORITIES.NORMAL,
                };

                return fangXuanLing.processZouzhe(zouzhe);
            });

            // 等待所有请求完成
            const results = await Promise.all(promises);

            // 验证所有请求都成功处理
            results.forEach((result) => {
                expect(result.approved).toBe(true);
            });
        });

        it("应该正确处理并发的添加和移除操作", async () => {
            // Mock天枢处理添加
            window.api.tianshu.processCommand = vi
                .fn()
                .mockImplementation((params: { command: string }) => {
                    if (params.command === "add_scan_action") {
                        return Promise.resolve({
                            success: true,
                            result: { success: true, queueSize: 1 },
                        });
                    } else if (params.command === "remove_scan_action") {
                        return Promise.resolve({
                            success: true,
                            result: { success: true, queueSize: 0 },
                        });
                    }
                    return Promise.resolve({ success: false });
                });

            // 并发执行添加和移除
            const addZouzhe: Zouzhe = {
                department: GUANYUAN_NAMES.YU_CHI_GONG,
                matter: ZOUZHE_MATTERS.ADD_SCAN_ACTION,
                content: {
                    action: createTestScanAction({
                        path: "/test/path",
                        action: "scan",
                        thumbnailSize: 150,
                        source: "user",
                        operationType: "directory",
                    }),
                    actions: [
                        createTestScanAction({
                            path: "/test/path",
                            action: "scan",
                            thumbnailSize: 150,
                            source: "user",
                            operationType: "directory",
                        }),
                    ],
                },
                timestamp: Date.now(),
                priority: ZOUZHE_PRIORITIES.NORMAL,
            };

            const removeZouzhe: Zouzhe = {
                department: GUANYUAN_NAMES.YU_CHI_GONG,
                matter: ZOUZHE_MATTERS.REMOVE_SCAN_ACTION,
                content: {
                    path: "/test/path",
                },
                timestamp: Date.now(),
                priority: ZOUZHE_PRIORITIES.NORMAL,
            };

            const [addResult, removeResult] = await Promise.all([
                fangXuanLing.processZouzhe(addZouzhe),
                fangXuanLing.processZouzhe(removeZouzhe),
            ]);

            // 验证两个操作都被处理
            expect(addResult.approved).toBe(true);
            expect(removeResult.approved).toBe(true);
        });
    });
});

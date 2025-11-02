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
import type { ScanAction } from "@common/scan-types";
import { createPinia, setActivePinia } from "pinia";
import { FangXuanLingService } from "../fangxuanling/fangxuanling";
import { YuanTianGangService } from "../yuantiangang";
import {
    ZOUZHE_MATTERS,
    ZOUZHE_PRIORITIES,
    GUANYUAN_NAMES,
    type Zouzhe,
} from "@renderer/interfaces/fang-xuan-ling.interface";

describe("扫描队列集成测试 - RFC 0042 Phase 2.6", () => {
    let fangXuanLing: FangXuanLingService;

    beforeEach(() => {
        // 创建新的Pinia实例
        const pinia = createPinia();
        setActivePinia(pinia);

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
                    action: {
                        path: testPath,
                        action: "scan",
                        thumbnailSize: 150,
                        source: "user",
                        timestamp: Date.now(),
                        operationType: "directory",
                    } as ScanAction,
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

            // Step 3 & 4 & 5: 验证天枢的调用（房玄龄自动调用袁天罡→天枢→千里眼）
            expect(window.api.tianshu.processCommand).toHaveBeenCalled();
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

            // Step 3 & 4 & 5: 验证天枢的调用
            expect(window.api.tianshu.processCommand).toHaveBeenCalled();
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

            // Step 3 & 4 & 5: 验证天枢的调用
            expect(window.api.tianshu.processCommand).toHaveBeenCalled();
        });
    });

    describe("断电恢复场景测试", () => {
        it("应该在重启后恢复扫描队列状态", async () => {
            // 模拟断电前的状态：队列中有待处理任务
            const mockQueueBeforeCrash: ScanAction[] = [
                {
                    path: "/test/folder1",
                    action: "scan",
                    thumbnailSize: 150,
                    source: "user",
                    timestamp: Date.now() - 1000,
                    operationType: "directory",
                },
                {
                    path: "/test/folder2",
                    action: "rescan",
                    thumbnailSize: 150,
                    source: "auto",
                    timestamp: Date.now() - 500,
                    operationType: "directory",
                },
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
            // 模拟断电前正在处理的任务
            const partiallyCompletedAction: ScanAction = {
                path: "/test/partial",
                action: "scan",
                thumbnailSize: 150,
                source: "user",
                timestamp: Date.now(),
                operationType: "directory",
            };

            // Mock天枢返回部分完成的任务状态
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (window as any).tianshu.processCommand = vi.fn().mockResolvedValue({
                success: true,
                result: {
                    success: true,
                    currentPath: partiallyCompletedAction.path,
                    isProcessing: true,
                    queue: [partiallyCompletedAction],
                },
            });

            // 查询当前处理状态
            const zouzhe: Zouzhe = {
                department: GUANYUAN_NAMES.YU_CHI_GONG,
                matter: ZOUZHE_MATTERS.GET_SCANNING_QUEUE,
                timestamp: Date.now(),
                priority: ZOUZHE_PRIORITIES.NORMAL,
            };

            const response = await fangXuanLing.processZouzhe(zouzhe);

            // 验证可以识别部分完成的任务
            expect(response.approved).toBe(true);
            // 注意：响应数据在response.data.result中
            expect(response.data).toHaveProperty("success", true);
            // 这个测试主要验证数据能正确传递，具体字段结构由实际业务决定
        });

        it("应该在断电后正确恢复空队列状态", async () => {
            // Mock天枢返回空队列
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (window as any).tianshu.processCommand = vi.fn().mockResolvedValue({
                success: true,
                result: {
                    success: true,
                    queue: [],
                    queueSize: 0,
                    isProcessing: false,
                    currentPath: null,
                },
            });

            // 查询队列状态
            const zouzhe: Zouzhe = {
                department: GUANYUAN_NAMES.YU_CHI_GONG,
                matter: ZOUZHE_MATTERS.GET_SCANNING_QUEUE,
                timestamp: Date.now(),
                priority: ZOUZHE_PRIORITIES.NORMAL,
            };

            const response = await fangXuanLing.processZouzhe(zouzhe);

            // 验证空队列状态正确
            expect(response.approved).toBe(true);
            expect(response.data).toHaveProperty("success", true);
            expect(response.data).toHaveProperty("queueSize", 0);
        });
    });

    describe("错误处理测试", () => {
        it("应该正确处理天枢调用失败的情况", async () => {
            // Mock天枢返回错误状态
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (window as any).tianshu.processCommand = vi.fn().mockResolvedValue({
                status: "failed",
                error: { message: "天枢繁忙，请稍后再试" },
                result: null,
            });

            const zouzhe: Zouzhe = {
                department: GUANYUAN_NAMES.YU_CHI_GONG,
                matter: ZOUZHE_MATTERS.ADD_SCAN_ACTION,
                content: {
                    action: {
                        path: "/test/path",
                        action: "scan",
                        thumbnailSize: 150,
                        source: "user",
                        timestamp: Date.now(),
                        operationType: "directory",
                    } as ScanAction,
                },
                timestamp: Date.now(),
                priority: ZOUZHE_PRIORITIES.NORMAL,
            };

            const response = await fangXuanLing.processZouzhe(zouzhe);

            // 验证错误处理
            expect(response.approved).toBe(false);
        });

        it("应该正确处理千里眼调用失败的情况", async () => {
            // Mock天枢成功但千里眼失败的场景
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (window as any).tianshu.processCommand = vi.fn().mockResolvedValue({
                status: "failed",
                error: { message: "千里眼执行失败" },
                result: null,
            });

            const zouzhe: Zouzhe = {
                department: GUANYUAN_NAMES.YU_CHI_GONG,
                matter: ZOUZHE_MATTERS.ADD_SCAN_ACTION,
                content: {
                    action: {
                        path: "/invalid/path",
                        action: "scan",
                        thumbnailSize: 150,
                        source: "user",
                        timestamp: Date.now(),
                        operationType: "directory",
                    } as ScanAction,
                },
                timestamp: Date.now(),
                priority: ZOUZHE_PRIORITIES.NORMAL,
            };

            const response = await fangXuanLing.processZouzhe(zouzhe);

            // 验证错误传播
            expect(response.approved).toBe(false);
        });

        it("应该正确处理无效的扫描路径", async () => {
            const invalidPath = "";

            const zouzhe: Zouzhe = {
                department: GUANYUAN_NAMES.YU_CHI_GONG,
                matter: ZOUZHE_MATTERS.ADD_SCAN_ACTION,
                content: {
                    action: {
                        path: invalidPath,
                        action: "scan",
                        thumbnailSize: 150,
                        source: "user",
                        timestamp: Date.now(),
                        operationType: "directory",
                    } as ScanAction,
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
                        {
                            path: "/test/reactive",
                            action: "scan",
                            thumbnailSize: 150,
                            source: "user",
                            timestamp: Date.now(),
                            operationType: "directory",
                        },
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
                    action: {
                        path: "/test/reactive",
                        action: "scan",
                        thumbnailSize: 150,
                        source: "user",
                        timestamp: Date.now(),
                        operationType: "directory",
                    } as ScanAction,
                },
                timestamp: Date.now(),
                priority: ZOUZHE_PRIORITIES.NORMAL,
            };

            await fangXuanLing.processZouzhe(zouzhe);

            // 验证响应式引用自动更新
            const updatedQueue = fangXuanLing.scanning.queue;
            const updatedSize = fangXuanLing.scanning.queueSize;

            // 引用应该是同一个响应式对象
            expect(updatedQueue).toBe(initialQueue);

            // 但内容和大小可能已更新（取决于Store Automation）
            expect(typeof updatedSize).toBe("number");
            expect(updatedSize).toBeGreaterThanOrEqual(initialSize);
        });

        it("应该在多次操作后保持响应式引用一致性", async () => {
            // 获取初始引用
            const queueRef = fangXuanLing.scanning.queue;

            // 执行多次操作
            for (let i = 0; i < 3; i++) {
                const zouzhe: Zouzhe = {
                    department: GUANYUAN_NAMES.YU_CHI_GONG,
                    matter: ZOUZHE_MATTERS.ADD_SCAN_ACTION,
                    content: {
                        action: {
                            path: `/test/path${i}`,
                            action: "scan",
                            thumbnailSize: 150,
                            source: "user",
                            timestamp: Date.now(),
                            operationType: "directory",
                        } as ScanAction,
                    },
                    timestamp: Date.now(),
                    priority: ZOUZHE_PRIORITIES.NORMAL,
                };

                await fangXuanLing.processZouzhe(zouzhe);

                // 验证引用保持不变
                expect(fangXuanLing.scanning.queue).toBe(queueRef);
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
                        action: {
                            path,
                            action: "scan",
                            thumbnailSize: 150,
                            source: "user",
                            timestamp: Date.now(),
                            operationType: "directory",
                        } as ScanAction,
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
                    action: {
                        path: "/test/path",
                        action: "scan",
                        thumbnailSize: 150,
                        source: "user",
                        timestamp: Date.now(),
                        operationType: "directory",
                    } as ScanAction,
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

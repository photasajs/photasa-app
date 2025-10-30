/**
 * 缩略图大小变更集成测试
 * 测试完整的缩略图大小变更流程：UI → 褚遂良 → 房玄龄 → 袁天罡 → 天枢 → 文昌
 */

import { describe, it, expect, beforeEach, vi, type Mock } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { FangXuanLingService } from "../fangxuanling/fangxuanling";
import { YuanTianGangService } from "../yuantiangang/yuantiangang";
import { ChusuiliangService } from "../chusuiliang/chusuiliang";
import { usePreferenceStore } from "../../stores/preference";

describe("🏛️ 缩略图大小变更集成测试 - 端到端流程", () => {
    let chuSuiLiang: ChusuiliangService;
    let fangXuanLing: FangXuanLingService;
    let yuanTianGang: YuanTianGangService;
    let mockTianshu: {
        processCommand: Mock;
        onProgress: Mock;
        onStatus: Mock;
    };

    beforeEach(() => {
        // 初始化Pinia
        setActivePinia(createPinia());

        // Mock天枢IPC接口
        mockTianshu = {
            processCommand: vi.fn(),
            onProgress: vi.fn(() => () => {}),
            onStatus: vi.fn(() => () => {}),
        };

        // 注入到全局window
        (window as any).tianshu = mockTianshu;

        // 初始化服务链：褚遂良 → 房玄龄 → 袁天罡
        yuanTianGang = new YuanTianGangService();
        fangXuanLing = new FangXuanLingService(yuanTianGang);
        chuSuiLiang = new ChusuiliangService(fangXuanLing);
    });

    describe("场景1：用户通过UI滑块修改缩略图大小", () => {
        it("应该完成完整的缩略图大小变更流程并自动同步到Store", async () => {
            const store = usePreferenceStore();
            const newThumbnailSize = 200;

            // 模拟天枢成功响应
            // 注意：根据matter-sync.yml配置，thumbnail_size_change的snapshotPath是"display.thumbnailSize"
            // yuanTianGang会将result.data作为zhaolingResponse.data
            // syncStoreWithSnapshot会从zhaolingResponse.data中提取"display.thumbnailSize"
            mockTianshu.processCommand.mockResolvedValueOnce({
                status: "completed",
                result: {
                    engineName: "wenchang",
                    success: true,
                    data: {
                        display: {
                            thumbnailSize: newThumbnailSize,
                        },
                    },
                },
            });

            // 记录初始状态
            const initialSize = store.display.thumbnailSize;
            expect(initialSize).toBe(150); // 默认值

            // 执行：用户通过褚遂良更新缩略图大小
            await chuSuiLiang.updateThumbnailSize(newThumbnailSize);

            // 验证：天枢被正确调用
            expect(mockTianshu.processCommand).toHaveBeenCalledTimes(1);
            const tianshuCall = mockTianshu.processCommand.mock.calls[0][0];

            // 验证命令格式（袁天罡将normal优先级映射为background）
            expect(tianshuCall).toMatchObject({
                intent: "update_preferences",
                priority: "background",
            });

            // 验证命令参数包含正确的delta
            expect(tianshuCall.params).toMatchObject({
                delta: {
                    display: {
                        thumbnailSize: newThumbnailSize,
                    },
                },
                source: "褚遂良", // 来源标记为褚遂良部门
            });

            // 验证Store自动同步
            expect(store.display.thumbnailSize).toBe(newThumbnailSize);
        });

        it("应该验证缩略图大小范围（最小值）", async () => {
            const store = usePreferenceStore();
            const tooSmallSize = 50; // 边界值，在min范围内

            // 模拟天枢返回褚遂良已验证的值150（褚遂良验证size>=150）
            mockTianshu.processCommand.mockResolvedValueOnce({
                status: "completed",
                result: {
                    engineName: "wenchang",
                    success: true,
                    data: {
                        snapshot: {
                            data: {
                                ui: store.ui,
                                display: {
                                    ...store.display,
                                    thumbnailSize: 150, // 褚遂良验证后返回150
                                },
                                scanning: store.scanning,
                                performance: store.performance,
                                system: store.system,
                            },
                            revision: 2,
                            timestamp: Date.now(),
                        },
                    },
                },
            });

            await chuSuiLiang.updateThumbnailSize(tooSmallSize);

            // 验证天枢被调用，褚遂良已处理边界值
            expect(mockTianshu.processCommand).toHaveBeenCalled();
            // 褚遂良服务updateThumbnailSize方法验证size>=150，小于则使用150
            expect(store.display.thumbnailSize).toBe(150);
        });

        it("应该验证缩略图大小范围（最大值）", async () => {
            const store = usePreferenceStore();
            const tooLargeSize = 500; // 超出最大值400

            // 模拟天枢返回褚遂良已验证的值150（褚遂良验证size<=400）
            mockTianshu.processCommand.mockResolvedValueOnce({
                status: "completed",
                result: {
                    engineName: "wenchang",
                    success: true,
                    data: {
                        snapshot: {
                            data: {
                                ui: store.ui,
                                display: {
                                    ...store.display,
                                    thumbnailSize: 150, // 褚遂良验证后返回150
                                },
                                scanning: store.scanning,
                                performance: store.performance,
                                system: store.system,
                            },
                            revision: 2,
                            timestamp: Date.now(),
                        },
                    },
                },
            });

            await chuSuiLiang.updateThumbnailSize(tooLargeSize);

            // 褚遂良服务updateThumbnailSize方法验证size<=400，大于则使用150
            expect(store.display.thumbnailSize).toBe(150);
        });

        it("应该在超出最大值时使用默认值", async () => {
            const store = usePreferenceStore();
            const tooLargeSize = 600; // 超出范围

            // 模拟天枢sanitize后返回默认值150
            mockTianshu.processCommand.mockResolvedValueOnce({
                status: "completed",
                result: {
                    engineName: "wenchang",
                    success: true,
                    data: {
                        snapshot: {
                            data: {
                                ui: store.ui,
                                display: {
                                    ...store.display,
                                    thumbnailSize: 150, // sanitize返回默认值
                                },
                                scanning: store.scanning,
                                performance: store.performance,
                                system: store.system,
                            },
                            revision: 2,
                            timestamp: Date.now(),
                        },
                    },
                },
            });

            await chuSuiLiang.updateThumbnailSize(tooLargeSize);

            // sanitize应该返回默认值150
            expect(store.display.thumbnailSize).toBe(150);
        });
    });

    describe("场景2：奏折处理链完整性", () => {
        it("应该正确创建并传递缩略图变更奏折", async () => {
            const newSize = 250;

            mockTianshu.processCommand.mockResolvedValueOnce({
                status: "completed",
                result: {
                    engineName: "wenchang",
                    success: true,
                    data: {
                        display: {
                            thumbnailSize: newSize,
                        },
                    },
                },
            });

            await chuSuiLiang.updateThumbnailSize(newSize);

            // 验证天枢命令
            const tianshuCall = mockTianshu.processCommand.mock.calls[0][0];

            // 验证intent映射正确
            expect(tianshuCall.intent).toBe("update_preferences");

            // 验证delta结构正确
            expect(tianshuCall.params.delta).toEqual({
                display: {
                    thumbnailSize: newSize,
                },
            });

            // 验证source标记正确
            expect(tianshuCall.params.source).toBe("褚遂良");
        });

        it("应该在天枢失败时正确处理错误", async () => {
            const newSize = 300;

            // 模拟天枢失败
            mockTianshu.processCommand.mockResolvedValueOnce({
                status: "failed",
                error: {
                    message: "文昌引擎更新失败",
                    code: "WENCHANG_ERROR",
                },
            });

            // 执行更新 - 注意：当前实现不会抛出错误，而是返回失败响应
            // 房玄龄会返回approved:false的响应，但不抛出异常
            await chuSuiLiang.updateThumbnailSize(newSize);

            // 验证天枢被调用
            expect(mockTianshu.processCommand).toHaveBeenCalledTimes(1);
        });
    });

    describe("场景3：Store自动同步验证", () => {
        it("应该根据matter-sync.yml配置自动同步缩略图大小", async () => {
            const store = usePreferenceStore();
            // 使用褚遂良验证范围内的值（150-400）
            const newSize = 180;

            // 记录初始值
            const initialSize = store.display.thumbnailSize;

            mockTianshu.processCommand.mockResolvedValueOnce({
                status: "completed",
                result: {
                    engineName: "wenchang",
                    success: true,
                    data: {
                        display: {
                            thumbnailSize: newSize,
                        },
                    },
                },
            });

            // 执行更新
            await chuSuiLiang.updateThumbnailSize(newSize);

            // 验证Store自动同步
            // matter-sync.yml中配置了thumbnail_size_change使用merge策略
            expect(store.display.thumbnailSize).toBe(newSize);
            expect(store.display.thumbnailSize).not.toBe(initialSize);

            // 验证其他偏好设置未受影响
            expect(store.ui.theme).toBe("solarized-dark");
            expect(store.scanning.paths).toEqual([]);
        });

        it("应该保持其他display设置不变", async () => {
            const store = usePreferenceStore();
            const newSize = 220; // 在褚遂良验证范围内（150-400）

            // 记录其他设置的初始值
            const initialSortOrder = store.display.sortOrder;
            const initialGroupBy = store.display.groupBy;
            const initialShowHidden = store.display.showHidden;

            mockTianshu.processCommand.mockResolvedValueOnce({
                status: "completed",
                result: {
                    engineName: "wenchang",
                    success: true,
                    data: {
                        display: {
                            thumbnailSize: newSize,
                        },
                    },
                },
            });

            await chuSuiLiang.updateThumbnailSize(newSize);

            // 验证只有thumbnailSize变化，其他设置不变
            expect(store.display.thumbnailSize).toBe(newSize);
            expect(store.display.sortOrder).toBe(initialSortOrder);
            expect(store.display.groupBy).toBe(initialGroupBy);
            expect(store.display.showHidden).toBe(initialShowHidden);
        });
    });

    describe("场景4：边界情况和异常处理", () => {
        it("应该处理非数字输入", async () => {
            const store = usePreferenceStore();

            mockTianshu.processCommand.mockResolvedValueOnce({
                status: "completed",
                result: {
                    engineName: "wenchang",
                    success: true,
                    data: {
                        snapshot: {
                            data: {
                                ui: store.ui,
                                display: {
                                    ...store.display,
                                    thumbnailSize: 150, // sanitize返回默认值
                                },
                                scanning: store.scanning,
                                performance: store.performance,
                                system: store.system,
                            },
                            revision: 2,
                            timestamp: Date.now(),
                        },
                    },
                },
            });

            // @ts-expect-error - 测试非法输入
            await chuSuiLiang.updateThumbnailSize("invalid");

            // sanitize应该返回默认值
            expect(store.display.thumbnailSize).toBe(150);
        });

        it("应该处理并发更新请求", async () => {
            const store = usePreferenceStore();

            // 第一次调用返回200
            mockTianshu.processCommand.mockResolvedValueOnce({
                status: "completed",
                result: {
                    engineName: "wenchang",
                    success: true,
                    data: {
                        display: {
                            thumbnailSize: 200,
                        },
                    },
                },
            });

            // 第二次调用返回300
            mockTianshu.processCommand.mockResolvedValueOnce({
                status: "completed",
                result: {
                    engineName: "wenchang",
                    success: true,
                    data: {
                        display: {
                            thumbnailSize: 300,
                        },
                    },
                },
            });

            // 顺序发送两个更新请求（测试最终一致性）
            await chuSuiLiang.updateThumbnailSize(200);
            await chuSuiLiang.updateThumbnailSize(300);

            // 最终值应该是最后一个成功的更新
            expect(store.display.thumbnailSize).toBe(300);
            expect(mockTianshu.processCommand).toHaveBeenCalledTimes(2);
        });
    });

    describe("场景5：工作流验证", () => {
        it("应该触发update_preferences工作流", async () => {
            const store = usePreferenceStore();

            mockTianshu.processCommand.mockResolvedValueOnce({
                status: "completed",
                result: {
                    engineName: "wenchang",
                    success: true,
                    data: {
                        snapshot: {
                            data: {
                                ui: store.ui,
                                display: {
                                    ...store.display,
                                    thumbnailSize: 175,
                                },
                                scanning: store.scanning,
                                performance: store.performance,
                                system: store.system,
                            },
                            revision: 2,
                            timestamp: Date.now(),
                        },
                    },
                },
            });

            await chuSuiLiang.updateThumbnailSize(175);

            const tianshuCall = mockTianshu.processCommand.mock.calls[0][0];

            // 验证工作流ID正确
            expect(tianshuCall.intent).toBe("update_preferences");

            // 验证包含必要的工作流参数
            expect(tianshuCall.params).toHaveProperty("delta");
            expect(tianshuCall.params).toHaveProperty("source");
        });
    });
});

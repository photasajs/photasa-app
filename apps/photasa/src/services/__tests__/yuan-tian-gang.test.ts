import { describe, it, expect, vi, beforeEach } from "vitest";
import { YuanTianGangService } from "../yuantiangang";
import { ZOUZHE_MATTERS } from "../../interfaces/fang-xuan-ling.interface";
import type { Zhaoling } from "../../interfaces/fang-xuan-ling.interface";

const tauriEventMocks = vi.hoisted(() => ({
    listen: vi.fn(async () => vi.fn()),
}));

// Mock logger
vi.mock("@photasa/common", () => ({
    loggers: {
        yuantiangang: {
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
            debug: vi.fn(),
        },
        main: {
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
            debug: vi.fn(),
        },
    },
}));

vi.mock("@tauri-apps/api/event", () => ({
    listen: tauriEventMocks.listen,
}));

// Mock window.tianshu
const mockTianshu = {
    processCommand: vi.fn(),
    onProgress: vi.fn(() => vi.fn()), // 返回cleanup函数
    onStatus: vi.fn(() => vi.fn()), // 返回cleanup函数
};

Object.defineProperty(window, "tianshu", {
    value: mockTianshu,
    writable: true,
});

Object.defineProperty(window, "electronAPI", {
    value: { tianshu: mockTianshu },
    writable: true,
});

describe("YuanTianGangService", () => {
    let yuanTianGangService: YuanTianGangService;

    beforeEach(() => {
        vi.clearAllMocks();
        tauriEventMocks.listen.mockResolvedValue(vi.fn());
        delete (window as unknown as { electron?: unknown }).electron;
        yuanTianGangService = new YuanTianGangService();
    });

    describe("GET_PREFERENCES 诏令处理", () => {
        it("应该正确将GET_PREFERENCES诏令转换为天枢符箓", async () => {
            // 模拟天枢引擎返回成功响应
            const mockTianshuResponse = {
                success: true,
                status: "completed",
                result: {
                    ui: {
                        theme: "dark",
                        language: "en-US",
                    },
                    display: {
                        thumbnailSize: 150,
                    },
                },
            };

            mockTianshu.processCommand.mockResolvedValue(mockTianshuResponse);

            // 创建GET_PREFERENCES诏令
            const zhaoling: Zhaoling = {
                command: ZOUZHE_MATTERS.GET_PREFERENCES,
                context: {
                    action: "get_preferences",
                    purpose: "应用启动时加载偏好设置",
                },
                timestamp: Date.now(),
                source: "褚遂良文书部",
                priority: "urgent",
            };

            // 执行诏令
            const response = await yuanTianGangService.executeZhaoling(zhaoling);

            // 验证响应
            expect(response.acknowledged).toBe(true);
            expect(response.command).toBe(ZOUZHE_MATTERS.GET_PREFERENCES);
            expect(response.data).toEqual({
                ui: {
                    theme: "dark",
                    language: "en-US",
                },
                display: {
                    thumbnailSize: 150,
                },
            });

            // 验证天枢引擎被正确调用
            expect(mockTianshu.processCommand).toHaveBeenCalledWith(
                expect.objectContaining({
                    id: expect.stringMatching(/^fulu-\d+-[a-z0-9]+$/),
                    intent: "get_preferences", // 关键：验证映射正确
                    params: zhaoling.context,
                    priority: "user",
                    context: {
                        source: "api",
                        metadata: {
                            originalFuluIntent: ZOUZHE_MATTERS.GET_PREFERENCES,
                            fuluSource: zhaoling.source,
                            fuluTimestamp: expect.any(Number),
                        },
                    },
                    createdAt: expect.any(Number),
                }),
            );
        });

        it("应该正确处理天枢引擎的失败响应", async () => {
            // 模拟天枢引擎返回失败响应
            const mockTianshuResponse = {
                success: false,
                status: "failed",
                error: "文昌引擎暂时不可用",
            };

            mockTianshu.processCommand.mockResolvedValue(mockTianshuResponse);

            const zhaoling: Zhaoling = {
                command: ZOUZHE_MATTERS.GET_PREFERENCES,
                context: { action: "get_preferences" },
                timestamp: Date.now(),
                source: "褚遂良文书部",
                priority: "urgent",
            };

            const response = await yuanTianGangService.executeZhaoling(zhaoling);

            // 验证失败响应
            expect(response.acknowledged).toBe(false);
            expect(response.blessing).toBe("天枢暂时忙碌，需再次祈请");
        });

        it("应该在天枢引擎异常时返回错误响应", async () => {
            // 模拟天枢引擎抛出异常
            mockTianshu.processCommand.mockRejectedValue(new Error("天枢引擎连接失败"));

            const zhaoling: Zhaoling = {
                command: ZOUZHE_MATTERS.GET_PREFERENCES,
                context: { action: "get_preferences" },
                timestamp: Date.now(),
                source: "褚遂良文书部",
                priority: "urgent",
            };

            const response = await yuanTianGangService.executeZhaoling(zhaoling);

            // 验证错误响应 - sendFuluToTianshu内部捕获异常，executeZhaoling仍返回acknowledged=false
            expect(response.acknowledged).toBe(false);
            // 异常时generateBlessing会生成blessing字段
            expect(response.blessing).toBe("天枢暂时忙碌，需再次祈请");
        });
    });

    describe("符箓映射验证", () => {
        it("应该正确映射所有已知的奏折事务类型", async () => {
            const testCases = [
                {
                    input: ZOUZHE_MATTERS.GET_PREFERENCES,
                    expected: "get_preferences",
                },
                {
                    input: ZOUZHE_MATTERS.THEME_CHANGE,
                    expected: "update_preferences",
                },
                {
                    input: ZOUZHE_MATTERS.LANGUAGE_CHANGE,
                    expected: "update_preferences",
                },
                {
                    input: ZOUZHE_MATTERS.NOTIFICATION_SHOW,
                    expected: "get_status",
                },
                {
                    input: ZOUZHE_MATTERS.PHOTO_SWITCH,
                    expected: "scan_folder",
                },
            ];

            for (const { input, expected } of testCases) {
                vi.clearAllMocks(); // 清理之前的调用记录
                mockTianshu.processCommand.mockResolvedValue({ status: "completed" });

                const zhaoling: Zhaoling = {
                    command: input,
                    context: {},
                    timestamp: Date.now(),
                    source: "测试部门",
                    priority: "normal",
                };

                await yuanTianGangService.executeZhaoling(zhaoling);

                // 验证正确的intent被传递给天枢引擎
                expect(mockTianshu.processCommand).toHaveBeenCalledWith(
                    expect.objectContaining({
                        intent: expected,
                    }),
                );
            }
        });

        it("应该为未知命令返回错误响应", async () => {
            const zhaoling: Zhaoling = {
                command: "unknown_command",
                context: {},
                timestamp: Date.now(),
                source: "测试部门",
                priority: "normal",
            };

            const response = await yuanTianGangService.executeZhaoling(zhaoling);

            // 未知命令应该返回失败响应
            expect(response.acknowledged).toBe(false);
            expect(response.blessing).toBe("天枢暂时忙碌，需再次祈请");
            expect(response.data).toBeNull();

            // processCommand 不应该被调用，因为在转换符箓时就失败了
            expect(mockTianshu.processCommand).not.toHaveBeenCalled();
        });
    });

    describe("事件监听管理", () => {
        it("应该在初始化时建立天枢事件监听", () => {
            expect(mockTianshu.onProgress).toHaveBeenCalled();
            expect(mockTianshu.onStatus).toHaveBeenCalled();
        });

        it("Tauri 模式应该监听 notify:status", async () => {
            const service = new YuanTianGangService();
            await vi.waitFor(() => {
                expect(tauriEventMocks.listen).toHaveBeenCalledWith(
                    "notify:status",
                    expect.any(Function),
                );
            });
            service.destroy();
        });

        it("应该在destroy时清理事件监听", () => {
            // onProgress和onStatus返回的cleanup函数应该被调用
            const progressCleanup = vi.fn();
            const statusCleanup = vi.fn();

            mockTianshu.onProgress.mockReturnValue(progressCleanup);
            mockTianshu.onStatus.mockReturnValue(statusCleanup);

            // 重新创建服务以触发监听设置
            const newService = new YuanTianGangService();

            // 销毁服务
            newService.destroy();

            expect(progressCleanup).toHaveBeenCalled();
            expect(statusCleanup).toHaveBeenCalled();
        });
    });

    describe("优先级映射", () => {
        it("应该正确映射诏令优先级到天枢优先级", async () => {
            const priorityTestCases = [
                { zhaolingSriority: "imperial", expected: "system" },
                { zhaolingSriority: "urgent", expected: "user" },
                { zhaolingSriority: "normal", expected: "background" },
            ];

            for (const testCase of priorityTestCases) {
                mockTianshu.processCommand.mockResolvedValue({ status: "completed" });

                const zhaoling: Zhaoling = {
                    command: ZOUZHE_MATTERS.GET_PREFERENCES,
                    context: {},
                    timestamp: Date.now(),
                    source: "测试部门",
                    priority: testCase.zhaolingSriority as any,
                };

                await yuanTianGangService.executeZhaoling(zhaoling);

                const lastCall = mockTianshu.processCommand.mock.calls.slice(-1)[0];
                expect(lastCall[0].priority).toBe(testCase.expected);
            }
        });
    });
});

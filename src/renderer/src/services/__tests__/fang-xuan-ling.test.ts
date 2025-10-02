import { describe, it, expect, vi, beforeEach } from "vitest";
import { FangXuanLingService } from "../fang-xuan-ling.service";
import { ZOUZHE_MATTERS } from "../../interfaces/fang-xuan-ling.interface";
import type { IYuanTianGangService } from "../../interfaces/yuan-tian-gang.interface";

// Mock logger
vi.mock("@common/logger", () => ({
    loggers: {
        fangxuanling: {
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
            debug: vi.fn(),
        },
    },
}));

// Mock usePreferenceStore
const mockPreferenceStore = {
    setThemeId: vi.fn(),
    setLocale: vi.fn(),
    updateThumbnailSize: vi.fn(),
    themeId: "light",
    locale: "zh-CN",
    darkMode: false,
    thumbnailSize: 120,
    $state: {},
    $reset: vi.fn(),
};

vi.mock("../../stores/preference", () => ({
    usePreferenceStore: vi.fn(() => mockPreferenceStore),
}));

// Mock useNotificationStore
const mockNotificationStore = {
    add: vi.fn(),
    remove: vi.fn(),
    clear: vi.fn(),
    notifications: [],
    $reset: vi.fn(),
};

vi.mock("../../stores/notification", () => ({
    useNotificationStore: vi.fn(() => mockNotificationStore),
}));

// Mock usePhotosStore
const mockPhotosStore = {
    setCurrentFolder: vi.fn(),
    currentFolder: null,
    files: new Map(),
    $reset: vi.fn(),
};

vi.mock("../../stores/photos", () => ({
    usePhotosStore: vi.fn(() => mockPhotosStore),
}));

describe("FangXuanLingService", () => {
    let mockYuanTianGang: IYuanTianGangService;
    let fangXuanLingService: FangXuanLingService;

    beforeEach(() => {
        vi.clearAllMocks();

        // Mock 袁天罡服务
        mockYuanTianGang = {
            executeZhaoling: vi.fn(),
            onProgress: vi.fn(),
        };

        fangXuanLingService = new FangXuanLingService(mockYuanTianGang);
    });

    describe("GET_PREFERENCES 奏折处理", () => {
        it("应该正确处理GET_PREFERENCES奏折并上报天界", async () => {
            // 模拟天界返回成功响应
            const mockTianshuResponse = {
                acknowledged: true,
                command: "get_preferences",
                context: { action: "get_preferences" },
                timestamp: Date.now(),
                result: {
                    message: "袁天罡已执行诏令",
                    tianShuResponse: {
                        success: true,
                        data: {
                            ui: {
                                theme: "dark",
                                language: "en-US",
                            },
                            display: {
                                thumbnailSize: 150,
                            },
                        },
                    },
                },
            };

            mockYuanTianGang.executeZhaoling = vi.fn().mockResolvedValue(mockTianshuResponse);

            // 创建GET_PREFERENCES奏折
            const zouzhe = {
                department: "褚遂良文书部",
                matter: ZOUZHE_MATTERS.GET_PREFERENCES,
                content: {
                    action: "get_preferences",
                    purpose: "应用启动时加载偏好设置",
                },
                timestamp: Date.now(),
                priority: "urgent" as const,
            };

            // 处理奏折
            const response = await fangXuanLingService.processZouzhe(zouzhe);

            // 验证结果
            expect(response.approved).toBe(true);
            expect(response.matter).toBe(ZOUZHE_MATTERS.GET_PREFERENCES);
            expect(response.needsEscalation).toBe(true);
            expect(response.instruction).toBe("需向天界获取偏好设置");

            // 验证袁天罡被调用
            expect(mockYuanTianGang.executeZhaoling).toHaveBeenCalledWith({
                command: ZOUZHE_MATTERS.GET_PREFERENCES,
                context: zouzhe.content,
                timestamp: expect.any(Number),
                source: zouzhe.department,
                priority: "urgent",
                requiresTianshuApproval: true,
            });
        });

        it("应该在天界响应失败时正确处理", async () => {
            // 模拟天界返回失败响应
            const mockTianshuResponse = {
                acknowledged: false,
                command: "get_preferences",
                context: { action: "get_preferences" },
                timestamp: Date.now(),
                error: "天界暂时不可用",
            };

            mockYuanTianGang.executeZhaoling = vi.fn().mockResolvedValue(mockTianshuResponse);

            const zouzhe = {
                department: "褚遂良文书部",
                matter: ZOUZHE_MATTERS.GET_PREFERENCES,
                content: { action: "get_preferences" },
                timestamp: Date.now(),
                priority: "urgent" as const,
            };

            const response = await fangXuanLingService.processZouzhe(zouzhe);

            // 验证奏折处理仍然成功（房玄龄层面）
            expect(response.approved).toBe(true);
            expect(response.needsEscalation).toBe(true);
            expect(mockYuanTianGang.executeZhaoling).toHaveBeenCalled();
        });

        it("应该在袁天罡服务异常时返回错误响应", async () => {
            // 模拟袁天罡服务抛出异常
            mockYuanTianGang.executeZhaoling = vi
                .fn()
                .mockRejectedValue(new Error("袁天罡服务不可用"));

            const zouzhe = {
                department: "褚遂良文书部",
                matter: ZOUZHE_MATTERS.GET_PREFERENCES,
                content: { action: "get_preferences" },
                timestamp: Date.now(),
                priority: "urgent" as const,
            };

            const response = await fangXuanLingService.processZouzhe(zouzhe);

            // 验证错误处理
            expect(response.approved).toBe(false);
            expect(response.instruction).toContain("袁天罡服务不可用");
        });
    });

    describe("偏好保存奏折处理", () => {
        it("应该正确处理THEME_CHANGE奏折", async () => {
            const mockResponse = {
                acknowledged: true,
                command: "theme_change",
                timestamp: Date.now(),
                result: { message: "主题变更已保存" },
            };

            mockYuanTianGang.executeZhaoling = vi.fn().mockResolvedValue(mockResponse);

            const zouzhe = {
                department: "主题设置部",
                matter: ZOUZHE_MATTERS.THEME_CHANGE,
                content: { themeId: "dark" },
                timestamp: Date.now(),
                priority: "normal" as const,
            };

            const response = await fangXuanLingService.processZouzhe(zouzhe);

            expect(response.approved).toBe(true);
            expect(response.needsEscalation).toBe(true);
            expect(response.instruction).toBe("重大偏好变更，需上报天界记录");
        });
    });

    describe("服务初始化", () => {
        it("应该在构造函数中正确初始化各部门管理器", () => {
            expect(fangXuanLingService.preference).toBeDefined();
            expect(fangXuanLingService.notification).toBeDefined();
            expect(fangXuanLingService.photos).toBeDefined();
        });

        it("应该在没有袁天罡服务时抛出错误", () => {
            expect(() => {
                new FangXuanLingService(null as any);
            }).toThrow("袁天罡钦天监服务未注入");
        });
    });

    describe("全局状态管理", () => {
        it("应该正确返回全局状态", () => {
            const globalState = fangXuanLingService.getGlobalState();

            expect(globalState).toHaveProperty("preference");
            expect(globalState).toHaveProperty("notification");
            expect(globalState).toHaveProperty("photos");
        });

        it("应该正确执行全局重置", () => {
            fangXuanLingService.resetAll();

            expect(mockPreferenceStore.$reset).toHaveBeenCalled();
            expect(mockNotificationStore.$reset).toHaveBeenCalled();
            expect(mockPhotosStore.$reset).toHaveBeenCalled();
        });
    });
});

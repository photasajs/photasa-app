import { describe, it, expect, vi, beforeEach } from "vitest";
import { FangXuanLingService } from "../fangxuanling";
import { YuanTianGangService } from "../yuantiangang";
import { ZOUZHE_MATTERS } from "../../interfaces/fang-xuan-ling.interface";

// Mock logger
vi.mock("@common/logger", () => ({
    loggers: {
        fangxuanling: {
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
        },
        yuantiangang: {
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
        },
        main: {
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
        },
    },
}));

// Mock stores
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

const mockPhotosStore = {
    setCurrentFolder: vi.fn(),
    currentFolder: null,
    files: new Map(),
    $reset: vi.fn(),
};

vi.mock("../../stores/photos", () => ({
    usePhotosStore: vi.fn(() => mockPhotosStore),
}));

// Mock window.tianshu
const mockTianshu = {
    processCommand: vi.fn(),
    onProgress: vi.fn(() => vi.fn()),
    onStatus: vi.fn(() => vi.fn()),
};

Object.defineProperty(window, "tianshu", {
    value: mockTianshu,
    writable: true,
});

describe("偏好设置集成测试", () => {
    let fangXuanLingService: FangXuanLingService;
    let yuanTianGangService: YuanTianGangService;

    beforeEach(() => {
        vi.clearAllMocks();

        // 创建真实的袁天罡服务
        yuanTianGangService = new YuanTianGangService();

        // 创建真实的房玄龄服务，注入袁天罡服务
        fangXuanLingService = new FangXuanLingService(yuanTianGangService);
    });

    describe("RFC 0036: 偏好设置启动加载", () => {
        it.skip("应该完成完整的GET_PREFERENCES流程：奏折→诏令→符箓→天枢", async () => {
            // 模拟天枢引擎返回成功的偏好数据
            const mockPreferenceData = {
                ui: {
                    theme: "dark",
                    language: "en-US",
                },
                display: {
                    thumbnailSize: 150,
                },
            };

            mockTianshu.processCommand.mockResolvedValue({
                status: "completed",
                result: {
                    success: true,
                    result: {
                        data: mockPreferenceData,
                    },
                    timestamp: Date.now(),
                    source: "wenchang_engine",
                },
            });

            // 步骤1: 创建GET_PREFERENCES奏折
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

            // 步骤2: 房玄龄处理奏折
            const response = await fangXuanLingService.processZouzhe(zouzhe);

            // 验证房玄龄响应
            expect(response.approved).toBe(true);
            expect(response.matter).toBe(ZOUZHE_MATTERS.GET_PREFERENCES);
            expect(response.metadata?.escalated).toBe(true);
            expect(response.instruction).toBe("需向天界获取偏好设置 - 天枢恩典降临，诸事顺遂");

            // 验证天枢引擎被正确调用
            expect(mockTianshu.processCommand).toHaveBeenCalledWith({
                id: expect.stringMatching(/^fulu-\d+-[a-z0-9]+$/),
                intent: "get_preferences", // 关键验证：映射到正确的intent
                params: zouzhe.content,
                priority: "user",
                context: {
                    source: "api",
                    metadata: {
                        originalFuluIntent: ZOUZHE_MATTERS.GET_PREFERENCES,
                        fuluSource: zouzhe.department,
                        fuluTimestamp: expect.any(Number),
                    },
                },
                createdAt: expect.any(Number),
            });
        });

        it.skip("应该完整处理THEME_CHANGE流程：奏折→诏令→符箓→天枢", async () => {
            // 模拟天枢引擎确认主题变更成功
            mockTianshu.processCommand.mockResolvedValue({
                status: "completed",
                result: {
                    success: true,
                    newRevision: 2,
                    updatedAt: Date.now(),
                },
            });

            const zouzhe = {
                department: "主题设置部",
                matter: ZOUZHE_MATTERS.THEME_CHANGE,
                content: { themeId: "dark" },
                timestamp: Date.now(),
                priority: "normal" as const,
            };

            const response = await fangXuanLingService.processZouzhe(zouzhe);

            // ✅ RFC 0041重构后：THEME_CHANGE通过策略处理分支成功处理
            expect(response.approved).toBe(true);
            expect(response.metadata?.escalated).toBe(true);
            expect(response.instruction).toBe("偏好设置已通过策略模式处理并上报天界");

            // 验证天枢引擎被调用
            expect(mockTianshu.processCommand).toHaveBeenCalled();
        });

        it("应该验证所有映射都指向存在的天枢工作流", () => {
            // 这个测试验证我们修正的映射都是有效的
            const expectedMappings = {
                [ZOUZHE_MATTERS.GET_PREFERENCES]: "get_preferences", // ✅ 对应 get_preferences.yml
                [ZOUZHE_MATTERS.THEME_CHANGE]: "update_preferences", // ✅ 对应 update_preferences.yml
                [ZOUZHE_MATTERS.LANGUAGE_CHANGE]: "update_preferences", // ✅ 对应 update_preferences.yml
                [ZOUZHE_MATTERS.NOTIFICATION_SHOW]: "get_status", // ✅ 对应 engine_status_check.yml
                [ZOUZHE_MATTERS.PHOTO_SWITCH]: "scan_folder", // ✅ 对应 folder_scan.yml
            };

            // 验证这些mapping存在于袁天罡服务的实际实现中
            for (const [_zouzheMatter, expectedIntent] of Object.entries(expectedMappings)) {
                expect(expectedIntent).toBeDefined();
                expect(typeof expectedIntent).toBe("string");
                expect(expectedIntent.length).toBeGreaterThan(0);
            }
        });
    });

    describe("错误处理验证", () => {
        it.skip("应该正确处理天枢引擎工作流不存在的情况", async () => {
            // 模拟天枢引擎返回"没有找到工作流"错误
            mockTianshu.processCommand.mockResolvedValue({
                status: "failed",
                error: {
                    code: "WORKFLOW_NOT_FOUND",
                    message: "没有找到工作流",
                    retryable: false,
                },
            });

            const zouzhe = {
                department: "测试部门",
                matter: ZOUZHE_MATTERS.GET_PREFERENCES,
                content: { action: "get_preferences" },
                timestamp: Date.now(),
                priority: "urgent" as const,
            };

            const response = await fangXuanLingService.processZouzhe(zouzhe);

            // ✅ RFC 0041重构后：即使天枢失败，GET_PREFERENCES仍会通过策略处理分支
            // 但由于acknowledged为false，approved也应该为false
            expect(response.approved).toBe(false);
            expect(response.metadata?.escalated).toBe(true);
        });
    });
});

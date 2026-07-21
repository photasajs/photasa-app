import { describe, it, expect, vi, beforeEach } from "vitest";
import { FangXuanLingService } from "../fangxuanling";
import { YuanTianGangService } from "../yuantiangang";
import { ZOUZHE_MATTERS } from "../../interfaces/fang-xuan-ling.interface";
import { createPinia, setActivePinia } from "pinia";
import { PREFERENCES_COMMANDS } from "../yuantiangang/tauri-command-names";
import { IntentToFuluMapping } from "../yuantiangang/intent";
import { PREFERENCE_ZHAOLING_MATTERS } from "../yuantiangang/preferences-delta";

const mockInvoke = vi.fn();
const mockIsTauri = vi.fn(() => true);

vi.mock("@photasa/common", () => ({
    loggers: {
        fangxuanling: {
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
            debug: vi.fn(),
        },
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

vi.mock("@tauri-apps/api/core", () => ({
    invoke: (...args: unknown[]) => mockInvoke(...args),
}));

vi.mock("@renderer/api/env", () => ({
    isTauri: () => mockIsTauri(),
}));

const mockPreferenceStore = {
    setThemeId: vi.fn(),
    setLocale: vi.fn(),
    updateThumbnailSize: vi.fn(),
    themeId: "light",
    locale: "zh-CN",
    darkMode: false,
    thumbnailSize: 120,
    scanning: { paths: [] as string[] },
    $state: {},
    $reset: vi.fn(),
    $patch: vi.fn(),
};

vi.mock("../../stores/preference", () => ({
    usePreferenceStore: vi.fn(() => mockPreferenceStore),
}));

vi.mock("../../stores/notification", () => ({
    useNotificationStore: vi.fn(() => ({
        add: vi.fn(),
        remove: vi.fn(),
        clear: vi.fn(),
        notifications: [],
        $reset: vi.fn(),
    })),
}));

vi.mock("../../stores/photos", () => ({
    usePhotosStore: vi.fn(() => ({
        setCurrentFolder: vi.fn(),
        currentFolder: null,
        files: new Map(),
        $reset: vi.fn(),
    })),
}));

const mockTianshu = {
    processCommand: vi.fn(),
    onProgress: vi.fn(() => vi.fn()),
    onStatus: vi.fn(() => vi.fn()),
};

Object.defineProperty(window, "tianshu", {
    value: mockTianshu,
    writable: true,
});

Object.defineProperty(window, "electronAPI", {
    value: { tianshu: mockTianshu },
    writable: true,
});

describe("偏好设置集成测试", () => {
    let fangXuanLingService: FangXuanLingService;
    let yuanTianGangService: YuanTianGangService;

    beforeEach(() => {
        vi.clearAllMocks();
        mockIsTauri.mockReturnValue(true);
        setActivePinia(createPinia());

        yuanTianGangService = new YuanTianGangService();
        fangXuanLingService = new FangXuanLingService(yuanTianGangService);
    });

    describe("RFC 0147: 偏好设置直连袁天罡 invoke", () => {
        it("应该完成 GET_PREFERENCES：奏折→诏令→invoke preferences_get", async () => {
            const mockPreferenceData = {
                ui: { theme: "dark", language: "en-US" },
                display: { thumbnailSize: 150 },
            };
            mockInvoke.mockResolvedValue(mockPreferenceData);

            const zouzhe = {
                department: "褚遂良文书部",
                matter: ZOUZHE_MATTERS.GET_PREFERENCES,
                content: { purpose: "应用启动时加载偏好设置" },
                timestamp: Date.now(),
                priority: "urgent" as const,
            };

            const response = await fangXuanLingService.processZouzhe(zouzhe);

            expect(response.approved).toBe(true);
            expect(mockInvoke).toHaveBeenCalledWith(PREFERENCES_COMMANDS.GET);
            expect(mockTianshu.processCommand).not.toHaveBeenCalled();
            expect(response.data).toEqual(mockPreferenceData);
        });

        it("应该完成 THEME_CHANGE：奏折→invoke preferences_update", async () => {
            const snapshot = {
                ui: { theme: "dark", language: "zh-CN" },
                display: { thumbnailSize: 150 },
            };
            mockInvoke.mockResolvedValue({
                updated: { ui: { theme: "dark" } },
                snapshot,
                revision: 2,
            });

            const zouzhe = {
                department: "主题设置部",
                matter: ZOUZHE_MATTERS.THEME_CHANGE,
                content: { themeId: "dark" },
                timestamp: Date.now(),
                priority: "normal" as const,
            };

            const response = await fangXuanLingService.processZouzhe(zouzhe);

            expect(response.approved).toBe(true);
            expect(mockInvoke).toHaveBeenCalledWith(PREFERENCES_COMMANDS.UPDATE, {
                delta: { ui: { theme: "dark" } },
                source: zouzhe.department,
            });
            expect(mockTianshu.processCommand).not.toHaveBeenCalled();
        });

        it("preference matter 不在 zouwu intent 映射中", () => {
            for (const matter of PREFERENCE_ZHAOLING_MATTERS) {
                expect(IntentToFuluMapping[matter]).toBeUndefined();
            }
            expect(IntentToFuluMapping[ZOUZHE_MATTERS.NOTIFICATION_SHOW]).toBe("get_status");
        });
    });

    describe("RFC 0147: 错误处理", () => {
        it("invoke 失败时 approved=false", async () => {
            mockInvoke.mockRejectedValue(new Error("磁盘写入失败"));

            const zouzhe = {
                department: "测试部门",
                matter: ZOUZHE_MATTERS.GET_PREFERENCES,
                content: {},
                timestamp: Date.now(),
                priority: "urgent" as const,
            };

            const response = await fangXuanLingService.processZouzhe(zouzhe);

            expect(response.approved).toBe(false);
            expect(response.data).toBeNull();
        });
    });
});

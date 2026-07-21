import { describe, it, expect, vi, beforeEach } from "vitest";
import { YuanTianGangService } from "../yuantiangang";
import { ZOUZHE_MATTERS } from "../../interfaces/fang-xuan-ling.interface";
import type { Zhaoling } from "../../interfaces/fang-xuan-ling.interface";
import { PREFERENCES_COMMANDS } from "../yuantiangang/tauri-command-names";
import { IntentToFuluMapping, RETIRED_ZOUWU_MATTERS } from "../yuantiangang/intent";
import { PREFERENCE_ZHAOLING_MATTERS } from "../yuantiangang/preferences-delta";

const mockInvoke = vi.fn();
const mockIsTauri = vi.fn(() => true);

const tauriEventMocks = vi.hoisted(() => ({
    listen: vi.fn(async () => vi.fn()),
}));

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

vi.mock("@tauri-apps/api/core", () => ({
    invoke: (...args: unknown[]) => mockInvoke(...args),
}));

vi.mock("@renderer/api/env", () => ({
    isTauri: () => mockIsTauri(),
}));

vi.mock("@tauri-apps/api/event", () => ({
    listen: tauriEventMocks.listen,
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

describe("YuanTianGangService", () => {
    let yuanTianGangService: YuanTianGangService;

    beforeEach(() => {
        vi.clearAllMocks();
        mockIsTauri.mockReturnValue(true);
        tauriEventMocks.listen.mockResolvedValue(vi.fn());
        delete (window as unknown as { electron?: unknown }).electron;
        yuanTianGangService = new YuanTianGangService();
    });

    describe("GET_PREFERENCES 诏令处理（RFC 0147 直连）", () => {
        it("应 invoke preferences_get 并返回快照", async () => {
            const mockPreferenceData = {
                ui: { theme: "dark", language: "en-US" },
                display: { thumbnailSize: 150 },
            };
            mockInvoke.mockResolvedValue(mockPreferenceData);

            const zhaoling: Zhaoling = {
                command: ZOUZHE_MATTERS.GET_PREFERENCES,
                context: { purpose: "应用启动时加载偏好设置" },
                timestamp: Date.now(),
                source: "褚遂良文书部",
                priority: "urgent",
            };

            const response = await yuanTianGangService.executeZhaoling(zhaoling);

            expect(response.acknowledged).toBe(true);
            expect(response.data).toEqual(mockPreferenceData);
            expect(mockInvoke).toHaveBeenCalledWith(PREFERENCES_COMMANDS.GET);
            expect(mockTianshu.processCommand).not.toHaveBeenCalled();
        });

        it("invoke 失败时返回 acknowledged=false", async () => {
            mockInvoke.mockRejectedValue(new Error("偏好读取失败"));

            const zhaoling: Zhaoling = {
                command: ZOUZHE_MATTERS.GET_PREFERENCES,
                context: {},
                timestamp: Date.now(),
                source: "褚遂良文书部",
                priority: "urgent",
            };

            const response = await yuanTianGangService.executeZhaoling(zhaoling);

            expect(response.acknowledged).toBe(false);
            expect(response.blessing).toBe("偏好持久化失败");
        });
    });

    describe("符箓映射验证（RFC 0137/0139 zouwu 退场）", () => {
        it("preference matter 不在 zouwu intent 映射中", () => {
            for (const matter of PREFERENCE_ZHAOLING_MATTERS) {
                expect(IntentToFuluMapping[matter]).toBeUndefined();
            }
        });

        it("已退场 matter 均不在 zouwu intent 映射中", () => {
            for (const matter of RETIRED_ZOUWU_MATTERS) {
                expect(IntentToFuluMapping[matter]).toBeUndefined();
            }
        });

        it("遗留 matter 调用应失败且不经过天枢", async () => {
            mockIsTauri.mockReturnValue(false);

            const zhaoling: Zhaoling = {
                command: ZOUZHE_MATTERS.NOTIFICATION_SHOW,
                context: {},
                timestamp: Date.now(),
                source: "测试部门",
                priority: "normal",
            };

            const response = await yuanTianGangService.executeZhaoling(zhaoling);

            expect(response.acknowledged).toBe(false);
            expect(mockTianshu.processCommand).not.toHaveBeenCalled();
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

            expect(response.acknowledged).toBe(false);
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
            const progressCleanup = vi.fn();
            const statusCleanup = vi.fn();

            mockTianshu.onProgress.mockReturnValue(progressCleanup);
            mockTianshu.onStatus.mockReturnValue(statusCleanup);

            const newService = new YuanTianGangService();
            newService.destroy();

            expect(progressCleanup).toHaveBeenCalled();
            expect(statusCleanup).toHaveBeenCalled();
        });
    });

    describe("优先级映射", () => {
        it("SWITCH_FOLDER 直连 invoke 不经过天枢优先级映射", async () => {
            mockIsTauri.mockReturnValue(true);
            mockInvoke.mockResolvedValue({ version: "1", photoList: [] });

            const zhaoling: Zhaoling = {
                command: ZOUZHE_MATTERS.SWITCH_FOLDER,
                context: { folderPath: "/photos" },
                timestamp: Date.now(),
                source: "魏征",
                priority: "imperial",
            };

            const response = await yuanTianGangService.executeZhaoling(zhaoling);

            expect(response.acknowledged).toBe(true);
            expect(mockInvoke).toHaveBeenCalledWith("get_photasa_config", { folder: "/photos" });
            expect(mockTianshu.processCommand).not.toHaveBeenCalled();
        });
    });
});

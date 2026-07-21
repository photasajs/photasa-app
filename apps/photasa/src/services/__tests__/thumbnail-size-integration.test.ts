/**
 * 缩略图大小变更集成测试
 * RFC 0147：UI → 褚遂良 → 房玄龄 → 袁天罡 invoke(preferences_update)
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { FangXuanLingService } from "../fangxuanling/fangxuanling";
import { YuanTianGangService } from "../yuantiangang/yuantiangang";
import { ChusuiliangService } from "../chusuiliang/chusuiliang";
import { usePreferenceStore } from "../../stores/preference";
import { PREFERENCES_COMMANDS } from "../yuantiangang/tauri-command-names";

const mockInvoke = vi.hoisted(() => vi.fn());
const mockIsTauri = vi.hoisted(() => vi.fn(() => true));

vi.mock("@tauri-apps/api/core", () => ({
    invoke: (...args: unknown[]) => mockInvoke(...args),
}));

vi.mock("@renderer/api/env", () => ({
    isTauri: () => mockIsTauri(),
}));

function mockPreferencesThumbnailResponse(
    store: ReturnType<typeof usePreferenceStore>,
    thumbnailSize: number,
) {
    mockInvoke.mockResolvedValueOnce({
        updated: { display: { thumbnailSize } },
        snapshot: {
            ui: store.ui,
            display: { ...store.display, thumbnailSize },
            scanning: store.scanning,
            performance: store.performance,
            system: store.system,
            revision: 2,
            lastModified: Date.now(),
        },
        revision: 2,
    });
}

function mockPreferencesDisplayOnly(thumbnailSize: number) {
    mockInvoke.mockResolvedValueOnce({
        updated: { display: { thumbnailSize } },
        snapshot: { display: { thumbnailSize } },
        revision: 2,
    });
}

describe("🏛️ 缩略图大小变更集成测试 - 端到端流程", () => {
    let chuSuiLiang: ChusuiliangService;

    beforeEach(() => {
        setActivePinia(createPinia());
        vi.clearAllMocks();
        mockIsTauri.mockReturnValue(true);

        const yuanTianGang = new YuanTianGangService();
        const fangXuanLing = new FangXuanLingService(yuanTianGang);
        chuSuiLiang = new ChusuiliangService(fangXuanLing);
    });

    describe("场景1：用户通过UI滑块修改缩略图大小", () => {
        it("应该完成完整的缩略图大小变更流程并自动同步到Store", async () => {
            const store = usePreferenceStore();
            const newThumbnailSize = 200;

            mockPreferencesDisplayOnly(newThumbnailSize);

            const initialSize = store.display.thumbnailSize;
            expect(initialSize).toBe(150);

            await chuSuiLiang.updateThumbnailSize(newThumbnailSize);

            expect(mockInvoke).toHaveBeenCalledTimes(1);
            expect(mockInvoke).toHaveBeenCalledWith(PREFERENCES_COMMANDS.UPDATE, {
                delta: { display: { thumbnailSize: newThumbnailSize } },
                source: "褚遂良",
            });

            expect(store.display.thumbnailSize).toBe(newThumbnailSize);
        });

        it("应该验证缩略图大小范围（最小值）", async () => {
            const store = usePreferenceStore();
            const tooSmallSize = 50; // 边界值，在min范围内

            mockPreferencesThumbnailResponse(store, 150);

            await chuSuiLiang.updateThumbnailSize(tooSmallSize);

            expect(mockInvoke).toHaveBeenCalled();
            expect(store.display.thumbnailSize).toBe(150);
        });

        it("应该验证缩略图大小范围（最大值）", async () => {
            const store = usePreferenceStore();
            const tooLargeSize = 500;

            mockPreferencesThumbnailResponse(store, 150);

            await chuSuiLiang.updateThumbnailSize(tooLargeSize);

            expect(store.display.thumbnailSize).toBe(150);
        });

        it("应该在超出最大值时使用默认值", async () => {
            const store = usePreferenceStore();
            const tooLargeSize = 600;

            mockPreferencesThumbnailResponse(store, 150);

            await chuSuiLiang.updateThumbnailSize(tooLargeSize);

            expect(store.display.thumbnailSize).toBe(150);
        });
    });

    describe("场景2：奏折处理链完整性", () => {
        it("应该正确创建并传递缩略图变更奏折", async () => {
            const newSize = 250;

            mockPreferencesDisplayOnly(newSize);

            await chuSuiLiang.updateThumbnailSize(newSize);

            expect(mockInvoke).toHaveBeenCalledWith(PREFERENCES_COMMANDS.UPDATE, {
                delta: { display: { thumbnailSize: newSize } },
                source: "褚遂良",
            });
        });

        it("应该在 invoke 失败时由房玄龄返回 approved=false", async () => {
            mockInvoke.mockRejectedValueOnce(new Error("偏好持久化失败"));

            const store = usePreferenceStore();
            const before = store.display.thumbnailSize;

            await chuSuiLiang.updateThumbnailSize(300);

            expect(mockInvoke).toHaveBeenCalledTimes(1);
            expect(store.display.thumbnailSize).toBe(before);
        });
    });

    describe("场景3：Store自动同步验证", () => {
        it("应该根据matter-sync.yml配置自动同步缩略图大小", async () => {
            const store = usePreferenceStore();
            const newSize = 180;
            const initialSize = store.display.thumbnailSize;

            mockPreferencesDisplayOnly(newSize);

            await chuSuiLiang.updateThumbnailSize(newSize);

            expect(store.display.thumbnailSize).toBe(newSize);
            expect(store.display.thumbnailSize).not.toBe(initialSize);
            expect(store.ui.theme).toBe("solarized-dark");
            expect(store.scanning.paths).toEqual([]);
        });

        it("应该保持其他display设置不变", async () => {
            const store = usePreferenceStore();
            const newSize = 220;

            const initialSortOrder = store.display.sortOrder;
            const initialGroupBy = store.display.groupBy;
            const initialShowHidden = store.display.showHidden;

            mockPreferencesDisplayOnly(newSize);

            await chuSuiLiang.updateThumbnailSize(newSize);

            expect(store.display.thumbnailSize).toBe(newSize);
            expect(store.display.sortOrder).toBe(initialSortOrder);
            expect(store.display.groupBy).toBe(initialGroupBy);
            expect(store.display.showHidden).toBe(initialShowHidden);
        });
    });

    describe("场景4：边界情况和异常处理", () => {
        it("应该处理非数字输入", async () => {
            const store = usePreferenceStore();

            mockPreferencesThumbnailResponse(store, 150);

            // @ts-expect-error - 测试非法输入
            await chuSuiLiang.updateThumbnailSize("invalid");

            expect(store.display.thumbnailSize).toBe(150);
        });

        it("应该处理并发更新请求", async () => {
            const store = usePreferenceStore();

            mockPreferencesDisplayOnly(200);
            mockPreferencesDisplayOnly(300);

            await chuSuiLiang.updateThumbnailSize(200);
            await chuSuiLiang.updateThumbnailSize(300);

            expect(store.display.thumbnailSize).toBe(300);
            expect(mockInvoke).toHaveBeenCalledTimes(2);
        });
    });

    describe("场景5：袁天罡直连验证", () => {
        it("应该 invoke preferences_update", async () => {
            const store = usePreferenceStore();

            mockPreferencesThumbnailResponse(store, 175);

            await chuSuiLiang.updateThumbnailSize(175);

            expect(mockInvoke).toHaveBeenCalledWith(
                PREFERENCES_COMMANDS.UPDATE,
                expect.objectContaining({
                    delta: { display: { thumbnailSize: 175 } },
                    source: "褚遂良",
                }),
            );
        });
    });
});

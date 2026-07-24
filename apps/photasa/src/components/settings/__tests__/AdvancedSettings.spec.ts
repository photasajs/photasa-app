import { beforeEach, describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";
import AdvancedSettings from "../AdvancedSettings.vue";

const { resetFolderConfigs, resetAllFolders, success } = vi.hoisted(() => ({
    resetFolderConfigs: vi.fn(),
    resetAllFolders: vi.fn(),
    success: vi.fn(),
}));

vi.mock("@renderer/composables/useWeiZheng", () => ({
    useWeiZheng: () => ({ resetFolderConfigs }),
}));

vi.mock("@renderer/stores/preference", () => ({
    usePreferenceStore: () => ({
        paths: ["/photos", "/archive"],
        resetAllFolders,
    }),
}));

vi.mock("@renderer/utils/theme-notification", () => ({
    themeNotification: { success },
}));

vi.mock("vue-i18n", () => ({
    useI18n: () => ({ t: (key: string) => key }),
}));

describe("AdvancedSettings 文件夹配置重置", () => {
    beforeEach(() => {
        resetFolderConfigs.mockReset().mockResolvedValue(undefined);
        resetAllFolders.mockReset();
        success.mockReset();
    });

    it("应先由魏征重置配置，再更新本地目录投影", async () => {
        const wrapper = mount(AdvancedSettings, {
            global: {
                stubs: {
                    BaseCard: { template: "<div><slot /></div>" },
                    BaseAlert: true,
                    BaseButton: { template: "<button @click=\"$emit('click')\"><slot /></button>" },
                },
            },
        });

        await wrapper.get("button").trigger("click");
        await vi.waitFor(() => expect(resetAllFolders).toHaveBeenCalled());

        expect(resetFolderConfigs).toHaveBeenCalledWith(["/photos", "/archive"]);
        expect(resetAllFolders).toHaveBeenCalledWith(["/photos", "/archive"]);
        expect(resetFolderConfigs.mock.invocationCallOrder[0]).toBeLessThan(
            resetAllFolders.mock.invocationCallOrder[0],
        );
    });
});

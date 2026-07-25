import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import TitlebarMac from "../TitlebarMac.vue";
import TitlebarMenuBar from "../TitlebarMenuBar.vue";
import { TITLEBAR_DRAG_REGION_ATTR, TITLEBAR_TEST_ID } from "../titlebar-drag-contract";
import { useMenusStore } from "@renderer/stores/menus";

vi.mock("vue-i18n", () => ({
    useI18n: () => ({
        t: (key: string) => key,
    }),
}));

vi.mock("@renderer/composables/useZhangSunWuJi", () => ({
    useZhangSunWuJi: () => ({
        handleMenuAction: vi.fn(),
    }),
}));

describe("TitlebarMac drag layout (RFC 0152)", () => {
    beforeEach(() => {
        setActivePinia(createPinia());
    });

    it("exposes background drag handle with data-tauri-drag-region", () => {
        const wrapper = mount(TitlebarMac, {
            global: {
                stubs: {
                    CoffeeOutlined: true,
                    ImportOutlined: true,
                    ReportIssueOutlined: true,
                    SettingOutlined: true,
                },
            },
        });

        const handle = wrapper.find(`[data-testid="${TITLEBAR_TEST_ID.DRAG_HANDLE}"]`);
        expect(handle.exists()).toBe(true);
        expect(handle.attributes(TITLEBAR_DRAG_REGION_ATTR)).toBeDefined();
    });

    it("does not embed in-window menu bar on macOS", () => {
        const wrapper = mount(TitlebarMac, {
            global: {
                stubs: {
                    CoffeeOutlined: true,
                    ImportOutlined: true,
                    ReportIssueOutlined: true,
                    SettingOutlined: true,
                },
            },
        });

        expect(wrapper.findComponent(TitlebarMenuBar).exists()).toBe(false);
        expect(wrapper.find(".titlebar-menus").exists()).toBe(false);
        expect(wrapper.find(`[data-testid="${TITLEBAR_TEST_ID.SETTING_HEADER}"]`).exists()).toBe(
            true,
        );
    });

    it("exposes titlebar Report Issue shortcut (RFC 0170 upstream Help menu bypass)", () => {
        const wrapper = mount(TitlebarMac, {
            global: {
                stubs: {
                    CoffeeOutlined: true,
                    ImportOutlined: true,
                    ReportIssueOutlined: true,
                    SettingOutlined: true,
                },
            },
        });

        expect(wrapper.text()).not.toContain("TitlebarMenuBar");
        const icons = wrapper.findAll(".system-icon");
        expect(icons.length).toBeGreaterThanOrEqual(4);
    });
});

describe("TitlebarMenuBar pointer-events (Win/Linux, RFC 0152)", () => {
    beforeEach(() => {
        setActivePinia(createPinia());
        const store = useMenusStore();
        store.$patch({
            menus: [
                {
                    key: "file",
                    label: "File",
                    items: [{ key: "file-import", label: "Import" }],
                },
                {
                    key: "help",
                    label: "Help",
                    items: [{ key: "help-report-issue", label: "Report Issue" }],
                },
            ],
        });
    });

    it("renders menu bar pass-through shell and per-item interactive targets", () => {
        const wrapper = mount(TitlebarMenuBar);

        expect(wrapper.find(`[data-testid="${TITLEBAR_TEST_ID.MENU_BAR}"]`).exists()).toBe(true);
        const items = wrapper.findAll(`[data-testid="${TITLEBAR_TEST_ID.MENU_ITEM}"]`);
        expect(items.length).toBe(2);
    });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import StatusBar from "../StatusBar.vue";
import { useStatusBarStore } from "@renderer/stores/statusBar";

vi.mock("vue-i18n", () => ({
    useI18n: () => ({
        t: (key: string) =>
            ({
                "status.ready": "Ready",
                "status.scanning": "Scanning",
                "status.error": "Scan error",
            })[key] ?? key,
    }),
}));

function mountStatusBar() {
    const pinia = createPinia();
    setActivePinia(pinia);

    return mount(StatusBar, {
        global: {
            plugins: [pinia],
            stubs: {
                BuyMeCoffeeButton: true,
            },
        },
    });
}

describe("StatusBar (RFC 0136)", () => {
    beforeEach(() => {
        setActivePinia(createPinia());
    });

    it("renders Ready when status has no active task", () => {
        const wrapper = mountStatusBar();

        expect(wrapper.text()).toContain("Ready");
    });

    it("renders scan status from notify payload instead of queue state", async () => {
        const wrapper = mountStatusBar();
        const statusBar = useStatusBarStore();

        statusBar.update({
            type: "scan",
            task: "/library",
            status: "progress",
            timestamp: 1,
            data: {
                currentFile: "/library/IMG_001.jpg",
                processed: 3,
                total: 10,
            },
        });
        await wrapper.vm.$nextTick();

        expect(wrapper.text()).toContain("Scanning");
        expect(wrapper.text()).toContain("/library/IMG_001.jpg");
        expect(wrapper.text()).toContain("3 / 10");
    });

    it("returns to Ready after scan completion", async () => {
        const wrapper = mountStatusBar();
        const statusBar = useStatusBarStore();

        statusBar.update({
            type: "scan",
            task: "/library",
            status: "complete",
            timestamp: 2,
        });
        await wrapper.vm.$nextTick();

        expect(wrapper.text()).toContain("Ready");
    });

    it("renders notification errors from status state", async () => {
        const wrapper = mountStatusBar();
        const statusBar = useStatusBarStore();

        statusBar.update({
            type: "scan",
            task: "/library",
            status: "error",
            error: "disk unavailable",
            timestamp: 3,
        });
        await wrapper.vm.$nextTick();

        expect(wrapper.text()).toContain("disk unavailable");
    });
});

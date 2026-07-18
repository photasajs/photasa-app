import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import ImportProgressChip from "../ImportProgressChip.vue";
import { useImportSessionStore } from "@renderer/stores/import-session";

vi.mock("vue-i18n", () => ({
    useI18n: () => ({
        t: (key: string) => key,
    }),
}));

vi.mock("@renderer/api/env", () => ({
    isTauri: () => false,
}));

vi.mock("@renderer/services/notification-manager", () => ({
    notification: {
        success: vi.fn(),
        error: vi.fn(),
        warning: vi.fn(),
        info: vi.fn(),
    },
}));

vi.mock("@photasa/common", async () => {
    const actual = await vi.importActual<typeof import("@photasa/common")>("@photasa/common");
    return {
        ...actual,
        loggers: {
            ...actual.loggers,
            importProgress: {
                debug: vi.fn(),
                info: vi.fn(),
                error: vi.fn(),
                warn: vi.fn(),
            },
        },
    };
});

describe("ImportProgressChip (RFC 0118)", () => {
    beforeEach(() => {
        setActivePinia(createPinia());
        vi.clearAllMocks();
    });

    it("uses sibling buttons for open and dismiss controls", async () => {
        const pinia = createPinia();
        setActivePinia(pinia);
        const store = useImportSessionStore();
        await store.begin("chip-id", { totalFiles: 4, processedFiles: 1 });

        const wrapper = mount(ImportProgressChip, {
            global: { plugins: [pinia] },
        });

        const buttons = wrapper.findAll("button");
        expect(buttons).toHaveLength(2);
        expect(buttons[0].find("button").exists()).toBe(false);
        expect(buttons[1].find("button").exists()).toBe(false);
    });
});

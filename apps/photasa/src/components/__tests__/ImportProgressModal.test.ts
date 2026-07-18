/**
 * RFC 0118 — ImportProgressModal：dismiss ≠ cancel；reattach 不 execute
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import ImportProgressModal from "../ImportProgressModal.vue";
import {
    IMPORT_MODAL_MODE_REATTACH,
    IMPORT_MODAL_MODE_START,
} from "@renderer/constants/import-modal";
import { useImportSessionStore } from "@renderer/stores/import-session";
import type { ImportConfig } from "@photasa/common";

const executeImport = vi.fn();
const cancelImport = vi.fn();
const pauseImport = vi.fn();
const resumeImport = vi.fn();

vi.mock("@renderer/utils/api", () => ({
    executeImport: (...args: unknown[]) => executeImport(...args),
    cancelImport: (...args: unknown[]) => cancelImport(...args),
    pauseImport: (...args: unknown[]) => pauseImport(...args),
    resumeImport: (...args: unknown[]) => resumeImport(...args),
}));

vi.mock("@renderer/utils/import-helpers", () => ({
    formatProcessingSpeed: () => "0/s",
    formatRemainingTime: () => "0s",
}));

vi.mock("@renderer/utils/import-wizard-helpers", () => ({
    createSerializableConfig: (c: unknown) => c,
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

vi.mock("vue-i18n", () => ({
    useI18n: () => ({
        t: (key: string) => key,
    }),
}));

function sampleConfig(): ImportConfig {
    return {
        sourcePaths: ["/src"],
        targetPath: "/dst",
        selectedFiles: ["/src/a.jpg", "/src/b.jpg"],
        filters: {
            includeImages: true,
            includeVideos: false,
            includeSubfolders: true,
        } as ImportConfig["filters"],
        duplicateStrategy: "skip" as ImportConfig["duplicateStrategy"],
        fileGroups: [],
        allowDuplicateRename: false,
        useMD5ForDuplicates: false,
    };
}

describe("ImportProgressModal (RFC 0118)", () => {
    beforeEach(() => {
        setActivePinia(createPinia());
        vi.clearAllMocks();
        executeImport.mockResolvedValue({ importId: "imp-1" });
        cancelImport.mockResolvedValue(undefined);
    });

    it("renders when show is true", () => {
        const wrapper = mount(ImportProgressModal, {
            props: { show: true, config: null, mode: IMPORT_MODAL_MODE_REATTACH },
            global: { plugins: [createPinia()] },
        });
        expect(wrapper.exists()).toBe(true);
    });

    it("T1.3 start mode calls executeImport once", async () => {
        const pinia = createPinia();
        setActivePinia(pinia);
        mount(ImportProgressModal, {
            props: {
                show: true,
                config: sampleConfig(),
                mode: IMPORT_MODAL_MODE_START,
            },
            global: { plugins: [pinia] },
        });
        await flushPromises();
        expect(executeImport).toHaveBeenCalledTimes(1);
        const session = useImportSessionStore();
        expect(session.importId).toBe("imp-1");
    });

    it("T1.3 reattach does not call executeImport", async () => {
        const pinia = createPinia();
        setActivePinia(pinia);
        const session = useImportSessionStore();
        await session.begin("existing-id", { totalFiles: 2, processedFiles: 1 });

        mount(ImportProgressModal, {
            props: {
                show: true,
                config: sampleConfig(),
                mode: IMPORT_MODAL_MODE_REATTACH,
            },
            global: { plugins: [pinia] },
        });
        await flushPromises();
        expect(executeImport).not.toHaveBeenCalled();
        expect(session.importId).toBe("existing-id");
    });

    it("T1.1 dismiss does not call cancelImport; session keeps importId", async () => {
        const pinia = createPinia();
        setActivePinia(pinia);
        const wrapper = mount(ImportProgressModal, {
            props: {
                show: true,
                config: sampleConfig(),
                mode: IMPORT_MODAL_MODE_START,
            },
            global: { plugins: [pinia] },
        });
        await flushPromises();
        const session = useImportSessionStore();
        expect(session.importId).toBe("imp-1");

        await wrapper.findComponent({ name: "BaseModal" }).vm.$emit("close");
        await flushPromises();

        expect(cancelImport).not.toHaveBeenCalled();
        expect(session.importId).toBe("imp-1");
        expect(wrapper.emitted("dismiss")).toBeTruthy();
    });

    it("T1.2 cancel button calls cancelImport", async () => {
        const pinia = createPinia();
        setActivePinia(pinia);
        const wrapper = mount(ImportProgressModal, {
            props: {
                show: true,
                config: sampleConfig(),
                mode: IMPORT_MODAL_MODE_START,
            },
            global: { plugins: [pinia] },
        });
        await flushPromises();

        const buttons = wrapper.findAllComponents({ name: "BaseButton" });
        const cancelBtn = buttons.find((b) => b.text().includes("import.cancelButton"));
        expect(cancelBtn).toBeTruthy();
        await cancelBtn!.trigger("click");
        await flushPromises();

        expect(cancelImport).toHaveBeenCalledWith("imp-1");
        expect(useImportSessionStore().phase).toBe("cancelled");
    });

    it("canClose is true while processing (dismiss allowed)", async () => {
        const pinia = createPinia();
        setActivePinia(pinia);
        const wrapper = mount(ImportProgressModal, {
            props: {
                show: true,
                config: sampleConfig(),
                mode: IMPORT_MODAL_MODE_START,
            },
            global: { plugins: [pinia] },
        });
        await flushPromises();
        const modal = wrapper.findComponent({ name: "BaseModal" });
        expect(modal.props("closable")).toBe(true);
    });
});

import { flushPromises, mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ImportHistory from "../ImportHistory.vue";

const operations = vi.hoisted(() => ({
    history: vi.fn(),
    previewUndo: vi.fn(),
    undo: vi.fn(),
}));

vi.mock("@renderer/composables/useImportOperations", () => ({
    useImportOperations: () => operations,
}));

vi.mock("vue-i18n", () => ({
    useI18n: () => ({ t: (key: string) => key }),
}));

vi.mock("@photasa/common", () => ({
    getLogger: () => ({
        error: vi.fn(),
        warn: vi.fn(),
        info: vi.fn(),
        debug: vi.fn(),
    }),
}));

vi.mock("@renderer/components/ui", () => ({
    BaseButton: {
        name: "BaseButton",
        props: ["variant", "size", "loading"],
        emits: ["click"],
        template: `<button :data-variant="variant" @click="$emit('click', $event)"><slot /></button>`,
    },
    BaseInput: { template: "<input />" },
    BaseSelect: {
        props: ["modelValue", "options", "placeholder"],
        template: "<div />",
    },
    BaseModal: {
        props: ["open"],
        template: `<div v-if="open"><slot /><slot name="footer" /></div>`,
    },
}));

const historyEntry = {
    id: "history-1",
    timestamp: new Date("2026-07-24T00:00:00.000Z"),
    sourcePaths: ["/src"],
    targetPath: "/library",
    result: {
        success: true,
        successfulFiles: 1,
        importedFiles: [],
    },
    canUndo: true,
    fileList: [],
    statistics: {
        totalFiles: 1,
        successfulFiles: 1,
        skippedFiles: 0,
        errorFiles: 0,
        totalSize: 1,
        duplicateCount: 0,
    },
};

describe("ImportHistory persona path", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        operations.history.mockResolvedValue([historyEntry]);
        operations.previewUndo.mockResolvedValue({
            historyId: "history-1",
            canUndo: true,
            filesToDelete: [],
            potentialIssues: [],
            estimatedTime: 0,
        });
        operations.undo.mockResolvedValue({ success: true });
    });

    it("loads history and reloads it once after undo", async () => {
        const wrapper = mount(ImportHistory);
        await flushPromises();
        expect(operations.history).toHaveBeenCalledTimes(1);

        const undoButton = wrapper
            .findAll("button")
            .find((button) => button.text().includes("import.history.undo"));
        await undoButton!.trigger("click");
        await flushPromises();
        expect(operations.previewUndo).toHaveBeenCalledWith("history-1");

        const confirmButton = wrapper
            .findAll("button")
            .find((button) => button.text().includes("import.history.confirmUndo"));
        await confirmButton!.trigger("click");
        await flushPromises();

        expect(operations.undo).toHaveBeenCalledWith("history-1");
        expect(operations.history).toHaveBeenCalledTimes(2);
    });
});

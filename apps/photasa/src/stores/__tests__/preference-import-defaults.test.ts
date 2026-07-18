import { describe, it, beforeEach, expect, vi } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { usePreferenceStore } from "../preference";

vi.mock("@renderer/utils/path", () => ({
    normalizePath: vi.fn((path: string) => path.replace(/\\/g, "/")),
}));

vi.mock("@renderer/utils/folder-tree", () => ({
    addFolderToTree: vi.fn(),
    cleanDataNode: vi.fn(),
}));

vi.mock("@photasa/common", () => ({
    loggers: {
        fangxuanling: {
            debug: vi.fn(),
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
        },
    },
}));

describe("preferenceStore.importing", () => {
    beforeEach(() => {
        setActivePinia(createPinia());
        vi.clearAllMocks();
    });

    it("should expose durable import defaults", () => {
        const store = usePreferenceStore();

        expect(store.importing).toEqual({
            defaultTargetPath: "",
            duplicateStrategy: "rename",
            includeSubfolders: true,
        });
        expect(store.importDefaults).toBe(store.importing);
    });

    it("should update import defaults through narrow actions", () => {
        const store = usePreferenceStore();

        store.setImportDefaultTargetPath("/imports");
        store.setImportDuplicateStrategy("skip");
        store.setImportIncludeSubfolders(false);

        expect(store.importing).toEqual({
            defaultTargetPath: "/imports",
            duplicateStrategy: "skip",
            includeSubfolders: false,
        });
    });
});

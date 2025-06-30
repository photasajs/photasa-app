import { describe, it, beforeEach, expect, vi } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { usePreferenceStore } from "../preference";

describe("preferenceStore.resetAllFolders", () => {
    beforeEach(() => {
        setActivePinia(createPinia());
        // mock window.api.resetPhotasaConfig
        (window as any).api = { resetPhotasaConfig: vi.fn() };
    });

    it("should clear and rebuild all folders", async () => {
        const store = usePreferenceStore();
        store.paths = ["/a", "/b"];
        store.folderTree = [{ path: "/a" } as any, { path: "/b" } as any];
        store.scanningFolder = ["/a"] as any;
        const newDirs = ["/c", "/d"];
        await store.resetAllFolders(newDirs);
        expect(store.paths).toEqual(["/c", "/d"]);
        expect(store.folderTree).toEqual([]); // 这里只重建 paths，folderTree 需后续扫描填充
        expect(store.scanningFolder).toEqual([]);
        expect((window as any).api.resetPhotasaConfig).toHaveBeenCalledTimes(2);
        expect((window as any).api.resetPhotasaConfig).toHaveBeenCalledWith("/c");
        expect((window as any).api.resetPhotasaConfig).toHaveBeenCalledWith("/d");
    });
});

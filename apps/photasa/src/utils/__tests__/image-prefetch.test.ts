import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("prefetchImageTask", () => {
    let prefetchImageTask: typeof import("../image-prefetch").prefetchImageTask;

    beforeEach(async () => {
        vi.resetModules();
        const mod = await import("../image-prefetch");
        prefetchImageTask = mod.prefetchImageTask;
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("应保留 ?t= 查询串以便重建缩略图后绕过缓存", async () => {
        const loaded: string[] = [];
        const originalCreateElement = document.createElement.bind(document);
        vi.spyOn(document, "createElement").mockImplementation((tagName: string) => {
            const el = originalCreateElement(tagName);
            if (tagName === "img") {
                Object.defineProperty(el, "src", {
                    set(value: string) {
                        loaded.push(value);
                    },
                    get() {
                        return loaded.at(-1) ?? "";
                    },
                    configurable: true,
                });
                queueMicrotask(() => el.onload?.(new Event("load")));
            }
            return el;
        });

        const url = "file:///test/.photasaoriginals/thumbnail-a.jpg.png?t=999";
        await prefetchImageTask.perform(url);

        expect(loaded).toContain(url);
    });
});

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ManifestCache } from "../ManifestCache";

describe("ManifestCache", () => {
    let cache: ManifestCache;

    beforeEach(() => {
        vi.useFakeTimers();
        cache = new ManifestCache({ ttlMs: 1000 });
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("should store and retrieve values", () => {
        const config = { version: "1.0", photoList: [], lastModified: 0 };
        cache.set("/path", config);

        const retrieved = cache.get("/path");
        expect(retrieved).toEqual(config);
        expect(retrieved).not.toBe(config); // Should be a clone
    });

    it("should return undefined for missing keys", () => {
        expect(cache.get("/missing")).toBeUndefined();
    });

    it("should expire items after TTL", () => {
        const config = { version: "1.0", photoList: [], lastModified: 0 };
        cache.set("/path", config);

        vi.advanceTimersByTime(1001);

        expect(cache.get("/path")).toBeUndefined();
    });

    it("should not expire items before TTL", () => {
        const config = { version: "1.0", photoList: [], lastModified: 0 };
        cache.set("/path", config);

        vi.advanceTimersByTime(500);

        expect(cache.get("/path")).toBeDefined();
    });

    it("should clear cache", () => {
        cache.set("/path", {} as any);
        expect(cache.getSize()).toBe(1);

        cache.clear();
        expect(cache.getSize()).toBe(0);
        expect(cache.get("/path")).toBeUndefined();
    });

    it("should use JSON fallback if structuredClone is unavailable", () => {
        const originalStructuredClone = global.structuredClone;
        (global as any).structuredClone = undefined;

        try {
            const fallbackCache = new ManifestCache({ ttlMs: 1000 });
            const config = { version: "1.0", photoList: [], lastModified: 0 };
            fallbackCache.set("/path", config);

            const retrieved = fallbackCache.get("/path");
            expect(retrieved).toEqual(config);
            expect(retrieved).not.toBe(config);
        } finally {
            global.structuredClone = originalStructuredClone;
        }
    });
});

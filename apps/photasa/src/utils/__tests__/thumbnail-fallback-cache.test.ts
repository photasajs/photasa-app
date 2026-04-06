import { describe, expect, it } from "vitest";
import {
    applyThumbnailFallbackResult,
    clearThumbnailFallbackFlag,
    getThumbnailFallbackFlag,
    thumbnailFallbackCacheKey,
} from "../thumbnail-fallback-cache";

describe("thumbnailFallbackCacheKey", () => {
    it("unifies file URL and POSIX path", () => {
        const path = "/Photos/a.CR2";
        const url = "file:///Photos/a.CR2";
        expect(thumbnailFallbackCacheKey(url)).toBe(path);
        expect(thumbnailFallbackCacheKey(path)).toBe(path);
    });

    it("normalizes Windows-style separators", () => {
        expect(thumbnailFallbackCacheKey(String.raw`C:\foo\bar.nef`)).toBe("C:/foo/bar.nef");
    });
});

describe("applyThumbnailFallbackResult", () => {
    it("sets flag when success and fallback true", () => {
        const p = "/tmp/x.CR2";
        applyThumbnailFallbackResult(p, { success: true, fallback: true });
        expect(getThumbnailFallbackFlag(p)).toBe(true);
        expect(getThumbnailFallbackFlag("file:///tmp/x.CR2")).toBe(true);
    });

    it("clears flag when success with fallback false", () => {
        const p = "/tmp/y.jpg";
        applyThumbnailFallbackResult(p, { success: true, fallback: true });
        applyThumbnailFallbackResult(p, { success: true, fallback: false });
        expect(getThumbnailFallbackFlag(p)).toBe(false);
    });

    it("preserves flag when success omits fallback", () => {
        const p = "/tmp/w.cr2";
        applyThumbnailFallbackResult(p, { success: true, fallback: true });
        applyThumbnailFallbackResult(p, { success: true });
        expect(getThumbnailFallbackFlag(p)).toBe(true);
    });

    it("clearThumbnailFallbackFlag removes entry", () => {
        const p = "/tmp/z.arw";
        applyThumbnailFallbackResult(p, { success: true, fallback: true });
        clearThumbnailFallbackFlag(p);
        expect(getThumbnailFallbackFlag(p)).toBe(false);
    });
});

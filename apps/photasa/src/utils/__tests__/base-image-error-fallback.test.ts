import { describe, expect, it, vi, beforeEach } from "vitest";
import {
    mediaPathKey,
    resolveNextImageSrcOnError,
} from "@renderer/utils/base-image-error-fallback";

vi.mock("@tauri-apps/api/core", () => ({
    isTauri: () => true,
    convertFileSrc: (path: string) => `asset://localhost/${encodeURIComponent(path)}`,
}));

describe("base-image-error-fallback", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("treats asset and absolute path as the same media key", () => {
        const path = "/Volumes/ORICO/photos/sunset.jpeg";
        expect(mediaPathKey(`asset://localhost/${encodeURIComponent(path)}`)).toBe(path);
        expect(mediaPathKey(path)).toBe(path);
    });

    it("does not retry the same path when preview equals raw", () => {
        const original = "/Volumes/ORICO/photos/sunset.jpeg";
        const asset = `asset://localhost/${encodeURIComponent(original)}`;

        const next = resolveNextImageSrcOnError({
            currentSrc: asset,
            preview: asset,
            raw: original,
            fallback: "asset://localhost/thumb.png",
            fallbackToThumbnail: false,
        });

        expect(next).toBeNull();
    });

    it("falls back to thumbnail in grid mode when preview/raw exhausted", () => {
        const original = "/Volumes/ORICO/photos/sunset.jpeg";
        const thumb = "/Volumes/ORICO/photos/.photasaoriginals/thumbnail-sunset.jpeg.png";

        const next = resolveNextImageSrcOnError({
            currentSrc: `asset://localhost/${encodeURIComponent(original)}`,
            preview: original,
            raw: original,
            fallback: thumb,
            fallbackToThumbnail: true,
        });

        expect(next).toBe(`asset://localhost/${encodeURIComponent(thumb)}`);
    });

    it("skips thumbnail fallback in lightbox mode", () => {
        const original = "/Volumes/ORICO/photos/sunset.jpeg";
        const thumb = "/Volumes/ORICO/photos/.photasaoriginals/thumbnail-sunset.jpeg.png";

        const next = resolveNextImageSrcOnError({
            currentSrc: `asset://localhost/${encodeURIComponent(original)}`,
            preview: original,
            raw: original,
            fallback: thumb,
            fallbackToThumbnail: false,
        });

        expect(next).toBeNull();
    });

    it("tries preview jpeg when heic raw fails", () => {
        const heic = "/Volumes/ORICO/photos/holiday.heic";
        const previewJpeg = "/Volumes/ORICO/photos/.photasaoriginals/holiday.jpeg";

        const next = resolveNextImageSrcOnError({
            currentSrc: `asset://localhost/${encodeURIComponent(heic)}`,
            preview: previewJpeg,
            raw: heic,
            fallback: "/Volumes/ORICO/photos/.photasaoriginals/thumbnail-holiday.heic.png",
            fallbackToThumbnail: false,
        });

        expect(next).toBe(`asset://localhost/${encodeURIComponent(previewJpeg)}`);
    });
});

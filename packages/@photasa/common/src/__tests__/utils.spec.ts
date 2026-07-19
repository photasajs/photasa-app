import { describe, it, expect } from "vitest";
import {
    toThumbnailPath,
    ratioStringToParts,
    getOptimalThumbnailResolution,
    shouldIgnorePhotasaPath,
} from "../utils";

describe("utils", () => {
    describe("toThumbnailPath", () => {
        it("should prepend 'thumbnail-' to filename and append '.png'", () => {
            expect(toThumbnailPath("image.jpg")).toBe("thumbnail-image.jpg.png");
            expect(toThumbnailPath("my/path/photo.HEIC")).toBe("thumbnail-my/path/photo.HEIC.png");
        });
    });

    describe("ratioStringToParts", () => {
        it("should split ratio string into numbers", () => {
            expect(ratioStringToParts("16:9")).toEqual([16, 9]);
            expect(ratioStringToParts("4:3")).toEqual([4, 3]);
        });
    });

    describe("getOptimalThumbnailResolution", () => {
        it("should calculate resolution based on width for landscape", () => {
            const videoSize = { width: 1920, height: 1080 };
            const target = { width: 320, height: 240 };
            const result = getOptimalThumbnailResolution(videoSize, target);
            expect(result).toEqual({ width: 320, height: 180 });
        });

        it("should calculate resolution based on height for portrait", () => {
            const videoSize = { width: 1080, height: 1920 };
            const target = { width: 320, height: 240 };
            const result = getOptimalThumbnailResolution(videoSize, target);
            expect(result).toEqual({ width: 135, height: 240 });
        });
    });

    describe("shouldIgnorePhotasaPath", () => {
        it("should ignore .photasaoriginals", () => {
            expect(shouldIgnorePhotasaPath("/path/to/.photasaoriginals/img.jpg")).toBe(true);
        });

        it("should ignore .picasaoriginals", () => {
            expect(shouldIgnorePhotasaPath("/path/to/.picasaoriginals/img.jpg")).toBe(true);
        });

        it("should ignore .AppleDouble", () => {
            expect(shouldIgnorePhotasaPath("/path/to/.AppleDouble/img.jpg")).toBe(true);
        });

        it("should not ignore normal paths", () => {
            expect(shouldIgnorePhotasaPath("/path/to/img.jpg")).toBe(false);
            expect(shouldIgnorePhotasaPath("/path/to/my_photos/img.png")).toBe(false);
        });
    });
});

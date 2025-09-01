import { describe, it, expect } from "vitest";
import {
    calculateBufferTolerance,
    isBufferSizeWithinTolerance,
    calculateAdjustedDimensions,
    convertRgbToRgba,
} from "@main/thumbnail/thumbnail-utils";

describe("thumbnail-utils", () => {
    it("calculateBufferTolerance returns >= 1KB or 1%", () => {
        expect(calculateBufferTolerance(1000)).toBe(1024);
        expect(calculateBufferTolerance(100_000)).toBe(1000);
    });

    it("isBufferSizeWithinTolerance detects within tolerance", () => {
        const expected = 100_000;
        const within = expected + 800; // < 1%
        const res = isBufferSizeWithinTolerance(within, expected);
        expect(res.isWithin).toBe(true);
        expect(res.difference).toBe(800);
    });

    it("calculateAdjustedDimensions computes height by buffer size", () => {
        const width = 10;
        const channels = 3;
        const pixels = 10 * 12; // height=12
        const decoded = new Uint8Array(pixels * channels);
        const adjusted = calculateAdjustedDimensions(decoded, width, channels);
        expect(adjusted).toEqual({ width: 10, height: 12, channels: 3 });
    });

    it("convertRgbToRgba pads alpha=255", () => {
        const width = 2;
        const height = 1;
        const rgb = new Uint8Array([10, 20, 30, 40, 50, 60]);
        const rgba = convertRgbToRgba(rgb, width, height);
        expect(rgba.length).toBe(8);
        expect(Array.from(rgba)).toEqual([10, 20, 30, 255, 40, 50, 60, 255]);
    });
});

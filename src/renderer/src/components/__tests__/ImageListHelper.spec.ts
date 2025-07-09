import { describe, it, expect } from "vitest";
import { toImageList, computeColumns } from "../ImageListHelper";
import type { PhotasaConfig } from "@common/config-types";

const mockPhoto = (path: string, thumbnail: string, isVideo = false) => ({
    path,
    thumbnail,
    isVideo,
});

describe("toImageList", () => {
    it("should map photoList to images", () => {
        const config: PhotasaConfig = {
            photoList: [mockPhoto("a.jpg", "a-thumb.jpg"), mockPhoto("b.jpg", "b-thumb.jpg", true)],
        } as PhotasaConfig;
        const result = toImageList("/folder", config);
        expect(result.title).toBe("/folder");
        expect(result.parts).toEqual(["", "folder"]);
        expect(result.images.length).toBe(2);
        expect(result.images[0]).toMatchObject({ key: "a.jpg", isVideo: false });
        expect(result.images[1]).toMatchObject({ key: "b.jpg", isVideo: true });
    });

    it("should handle empty photoList", () => {
        const config: PhotasaConfig = {
            photoList: [],
            version: "",
            lastModified: 0,
        } as PhotasaConfig;
        const result = toImageList("/folder", config);
        expect(result.images).toEqual([]);
    });

    it("should handle missing photoList", () => {
        const config: PhotasaConfig = {} as PhotasaConfig;
        const result = toImageList("/folder", config);
        expect(result.images).toEqual([]);
    });

    it("should split folder path correctly", () => {
        const config: PhotasaConfig = {
            photoList: [],
            version: "",
            lastModified: 0,
        } as PhotasaConfig;
        const result = toImageList("/a/b/c", config);
        expect(result.parts).toEqual(["", "a", "b", "c"]);
    });
});

describe("computeColumns", () => {
    it("should return 1 if containerWidth is 0", () => {
        expect(computeColumns(0, 100)).toBe(1);
    });
    it("should return 1 if containerWidth is less than thumbnail+padding+gap", () => {
        expect(computeColumns(50, 100)).toBe(1);
    });
    it("should calculate correct columns for normal case", () => {
        // thumbnailSize=100, padding=24*2=48, cardWidth=148, gap=16, available=484
        // (500-16)/(148+16)=484/164≈2.95, floor=2
        expect(computeColumns(500, 100)).toBe(2);
    });
    it("should always return at least 1", () => {
        expect(computeColumns(10, 10)).toBe(1);
        expect(computeColumns(-100, 100)).toBe(1);
    });
    it("should respect custom gap and padding", () => {
        // thumbnailSize=100, padding=10*2=20, cardWidth=120, gap=8, available=492
        // (500-8)/(120+8)=492/128≈3.84, floor=3
        expect(computeColumns(500, 100, { gap: 8, padding: 10 })).toBe(3);
        // thumbnailSize=50, padding=0, gap=0, cardWidth=50, available=500
        // 500/50=10
        expect(computeColumns(500, 50, { gap: 0, padding: 0 })).toBe(10);
    });
});

import { describe, it, expect, beforeEach } from "vitest";
import type { Image } from "@renderer/common/image";
import {
    appendCacheBust,
    getThumbnailBustKey,
    getThumbnailDisplaySrc,
    getThumbnailRenderKey,
    markThumbnailRebuilt,
    resetThumbnailBustStateForTests,
    stripUrlQuery,
    THUMBNAIL_CACHE_BUST_PARAM,
} from "../thumbnail-display";

const sampleImage = (): Image => ({
    key: "photo.jpg",
    src: "file:///Volumes/Photos/.photasaoriginals/thumbnail-photo.jpg.png",
    thumbnail: "file:///Volumes/Photos/.photasaoriginals/thumbnail-photo.jpg.png",
    preview: "file:///Volumes/Photos/photo.jpg",
    raw: "file:///Volumes/Photos/photo.jpg",
    isVideo: false,
});

describe("thumbnail-display", () => {
    beforeEach(() => {
        resetThumbnailBustStateForTests();
    });

    it("stripUrlQuery 应移除已有 query", () => {
        expect(stripUrlQuery("file:///a/b.png?t=1&x=2")).toBe("file:///a/b.png");
    });

    it("appendCacheBust 应附加标准 query 参数", () => {
        expect(appendCacheBust("file:///a/b.png", 42)).toBe(
            `file:///a/b.png?${THUMBNAIL_CACHE_BUST_PARAM}=42`,
        );
    });

    it("getThumbnailBustKey 应使用绝对缩略图路径", () => {
        const image = sampleImage();
        expect(getThumbnailBustKey(image)).toBe(
            "/Volumes/Photos/.photasaoriginals/thumbnail-photo.jpg.png",
        );
    });

    it("markThumbnailRebuilt 后 getThumbnailDisplaySrc 应带 ?t=", () => {
        const image = sampleImage();
        markThumbnailRebuilt(image, 999);

        expect(getThumbnailDisplaySrc(image)).toBe(
            `file:///Volumes/Photos/.photasaoriginals/thumbnail-photo.jpg.png?${THUMBNAIL_CACHE_BUST_PARAM}=999`,
        );
    });

    it("切换文件夹模拟：新 Image 实例同一缩略图路径仍保留 bust", () => {
        const imageA = sampleImage();
        markThumbnailRebuilt(imageA, 12345);

        const imageAfterFolderSwitch: Image = {
            ...sampleImage(),
            key: "photo.jpg",
        };

        expect(getThumbnailDisplaySrc(imageAfterFolderSwitch)).toContain("?t=12345");
        expect(getThumbnailRenderKey(imageAfterFolderSwitch)).toBe("photo.jpg:12345");
    });

    it("未重建时 getThumbnailDisplaySrc 应返回原始 thumbnail", () => {
        const image = sampleImage();
        expect(getThumbnailDisplaySrc(image)).toBe(image.thumbnail);
        expect(getThumbnailRenderKey(image)).toBe("photo.jpg");
    });
});

import { describe, it, expect } from "vitest";
import {
    toPreviewableImage,
    toFileProtocol,
    removeFileProtocol,
    toImage,
    groupImagesByColumns,
} from "../image";
import type { Photo } from "@common/config-types";

const mockPhotoHeic: Photo = {
    path: "photos/holiday.heic",
    thumbnail: "thumbnails/holiday.heic.png",
    isVideo: false,
};

const mockPhotoJpeg: Photo = {
    path: "photos/sunset.jpeg",
    thumbnail: "thumbnails/sunset.jpeg",
    isVideo: false,
};

const mockPhotoVideo: Photo = {
    path: "videos/movie.mp4",
    thumbnail: "thumbnails/movie.jpg",
    isVideo: true,
};

const mockPhotoSpecial: Photo = {
    path: "photos/特殊字符@#$.jpeg",
    thumbnail: "thumbnails/特殊字符@#$.jpeg",
    isVideo: false,
};

describe("toPreviewableImage", () => {
    it("should convert heic to jpeg preview", () => {
        const result = toPreviewableImage(mockPhotoHeic);
        expect(result).toBe("thumbnails/holiday.jpeg");
    });
    it("should return path for non-heic", () => {
        const result = toPreviewableImage(mockPhotoJpeg);
        expect(result).toBe("photos/sunset.jpeg");
    });
});

describe("toFileProtocol", () => {
    it("should prepend file protocol", () => {
        const result = toFileProtocol("/root", "abc.jpg");
        expect(result).toBe("file:///root/abc.jpg");
    });
    it("should handle special characters", () => {
        const result = toFileProtocol("/root", "特殊@#$.png");
        expect(result).toBe("file:///root/特殊@#$.png");
    });
});

describe("removeFileProtocol", () => {
    it("should remove file protocol", () => {
        const result = removeFileProtocol("file:///root/abc.jpg");
        expect(result).toBe("/root/abc.jpg");
    });
    it("should remove file protocol", () => {
        const result = removeFileProtocol("file://c:/root/abc.jpg");
        expect(result).toBe("c:/root/abc.jpg");
    });
    it("should return unchanged if no protocol", () => {
        const result = removeFileProtocol("/root/abc.jpg");
        expect(result).toBe("/root/abc.jpg");
    });
});

describe("toImage", () => {
    const folder = "/root";
    it("should convert Photo to Image (heic)", () => {
        const img = toImage(folder, mockPhotoHeic);
        expect(img).toEqual({
            key: mockPhotoHeic.path,
            src: "file:///root/thumbnails/holiday.heic.png",
            thumbnail: "file:///root/thumbnails/holiday.heic.png",
            preview: "file:///root/thumbnails/holiday.jpeg",
            raw: "file:///root/photos/holiday.heic",
            isVideo: false,
        });
    });
    it("should convert Photo to Image (jpeg)", () => {
        const img = toImage(folder, mockPhotoJpeg);
        expect(img).toEqual({
            key: mockPhotoJpeg.path,
            src: "file:///root/thumbnails/sunset.jpeg",
            thumbnail: "file:///root/thumbnails/sunset.jpeg",
            preview: "file:///root/photos/sunset.jpeg",
            raw: "file:///root/photos/sunset.jpeg",
            isVideo: false,
        });
    });
    it("should convert Photo to Image (video)", () => {
        const img = toImage(folder, mockPhotoVideo);
        expect(img).toEqual({
            key: mockPhotoVideo.path,
            src: "file:///root/thumbnails/movie.jpg",
            thumbnail: "file:///root/thumbnails/movie.jpg",
            preview: "file:///root/videos/movie.mp4",
            raw: "file:///root/videos/movie.mp4",
            isVideo: true,
        });
    });
    it("should handle special characters in path", () => {
        const img = toImage(folder, mockPhotoSpecial);
        expect(img).toEqual({
            key: mockPhotoSpecial.path,
            src: "file:///root/thumbnails/特殊字符@#$.jpeg",
            thumbnail: "file:///root/thumbnails/特殊字符@#$.jpeg",
            preview: "file:///root/photos/特殊字符@#$.jpeg",
            raw: "file:///root/photos/特殊字符@#$.jpeg",
            isVideo: false,
        });
    });
});

describe("groupImagesByColumns", () => {
    const imgs = [
        { key: "1", src: "", thumbnail: "", preview: "", raw: "", isVideo: false },
        { key: "2", src: "", thumbnail: "", preview: "", raw: "", isVideo: false },
        { key: "3", src: "", thumbnail: "", preview: "", raw: "", isVideo: false },
        { key: "4", src: "", thumbnail: "", preview: "", raw: "", isVideo: false },
        { key: "5", src: "", thumbnail: "", preview: "", raw: "", isVideo: false },
    ];
    it("should group images into correct columns", () => {
        expect(groupImagesByColumns(imgs, 2)).toEqual([
            [imgs[0], imgs[1]],
            [imgs[2], imgs[3]],
            [imgs[4]],
        ]);
    });
    it("should return all in one group if cols >= length", () => {
        expect(groupImagesByColumns(imgs, 10)).toEqual([imgs]);
    });
    it("should return empty array if input is empty", () => {
        expect(groupImagesByColumns([], 3)).toEqual([]);
    });
    it("should throw or return [] if cols <= 0", () => {
        // Ramda splitEvery(0, arr) 返回 []
        expect(groupImagesByColumns(imgs, 0)).toEqual([
            [imgs[0]],
            [imgs[1]],
            [imgs[2]],
            [imgs[3]],
            [imgs[4]],
        ]);
        expect(groupImagesByColumns(imgs, -2)).toEqual([
            [imgs[0]],
            [imgs[1]],
            [imgs[2]],
            [imgs[3]],
            [imgs[4]],
        ]);
    });
});

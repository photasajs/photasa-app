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
    thumbnail: ".photasaoriginals/thumbnail-holiday.heic.png",
    isVideo: false,
};

const mockPhotoJpeg: Photo = {
    path: "photos/sunset.jpeg",
    thumbnail: ".photasaoriginals/thumbnail-sunset.jpeg.png",
    isVideo: false,
};

const mockPhotoVideo: Photo = {
    path: "videos/movie.mp4",
    thumbnail: ".photasaoriginals/thumbnail-movie.mp4.png",
    isVideo: true,
};

const mockPhotoSpecial: Photo = {
    path: "photos/特殊字符@#$.jpeg",
    thumbnail: ".photasaoriginals/thumbnail-特殊字符@#$.jpeg.png",
    isVideo: false,
};

describe("toPreviewableImage", () => {
    it("should convert heic to jpeg preview", () => {
        const result = toPreviewableImage(mockPhotoHeic);
        expect(result).toBe(".photasaoriginals/holiday.jpeg");
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
            src: "file:///root/.photasaoriginals/thumbnail-holiday.heic.png",
            thumbnail: "file:///root/.photasaoriginals/thumbnail-holiday.heic.png",
            preview: "file:///root/.photasaoriginals/holiday.jpeg",
            raw: "file:///root/photos/holiday.heic",
            isVideo: false,
        });
    });
    it("should convert Photo to Image (jpeg)", () => {
        const img = toImage(folder, mockPhotoJpeg);
        expect(img).toEqual({
            key: mockPhotoJpeg.path,
            src: "file:///root/.photasaoriginals/thumbnail-sunset.jpeg.png",
            thumbnail: "file:///root/.photasaoriginals/thumbnail-sunset.jpeg.png",
            preview: "file:///root/photos/sunset.jpeg",
            raw: "file:///root/photos/sunset.jpeg",
            isVideo: false,
        });
    });
    it("should convert Photo to Image (video)", () => {
        const img = toImage(folder, mockPhotoVideo);
        expect(img).toEqual({
            key: mockPhotoVideo.path,
            src: "file:///root/.photasaoriginals/thumbnail-movie.mp4.png",
            thumbnail: "file:///root/.photasaoriginals/thumbnail-movie.mp4.png",
            preview: "file:///root/videos/movie.mp4",
            raw: "file:///root/videos/movie.mp4",
            isVideo: true,
        });
    });
    it("should handle special characters in path", () => {
        const img = toImage(folder, mockPhotoSpecial);
        expect(img).toEqual({
            key: mockPhotoSpecial.path,
            src: "file:///root/.photasaoriginals/thumbnail-特殊字符@#$.jpeg.png",
            thumbnail: "file:///root/.photasaoriginals/thumbnail-特殊字符@#$.jpeg.png",
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
    it("should return empty array if input is empty regardless of cols", () => {
        expect(groupImagesByColumns([], 1)).toEqual([]);
        expect(groupImagesByColumns([], 0)).toEqual([]);
        expect(groupImagesByColumns([], -1)).toEqual([]);
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

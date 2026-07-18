import { describe, it, expect } from "vitest";
import { toPreviewableImage, toFileProtocol, toImage, groupImagesByColumns } from "../image";
// removeFileProtocol 现在通过 preload API 使用，测试移到 shared 层
import type { Photo } from "@photasa/common";

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

    it("should encode special characters to prevent URL truncation", () => {
        const result = toFileProtocol("/root", "特殊@#$.png");
        expect(result).toBe("file:///root/%E7%89%B9%E6%AE%8A%40%23%24.png");
    });

    it("should handle very long paths with Chinese characters without truncation", () => {
        const longPath =
            "/Volumes/SUCAI/图库/服饰/汉服/N067-魏晋隋唐汉服中国风服装参考（古风复原装束）/汉服";
        const longFile =
            ".photasaoriginals/thumbnail-#北宋#宋時女子常著裙衫。衫多為對襟，覆在裙外。髮冠沿襲自唐、五代，此時則更為高大。甚至有高三尺，寬與肩等，垂於肩齊，梳長壹尺者。皇祐初規定冠廣不得過壹尺，高不得過四寸，梳長不得過四寸.jpg.png";

        const result = toFileProtocol(longPath, longFile);

        // 验证 URL 可以正确构造
        expect(() => new URL(result)).not.toThrow();

        // 验证解码后包含完整的文件名
        const url = new URL(result);
        const decodedPath = decodeURIComponent(url.pathname);
        expect(decodedPath).toContain("四寸.jpg.png");
        expect(decodedPath).toContain("北宋");
        expect(decodedPath).toContain("皇祐初規定");
    });

    it("should preserve directory structure with encoded components", () => {
        const result = toFileProtocol("/用户/文档", "子文件夹/图片.jpg");
        expect(result).toBe(
            "file:///%E7%94%A8%E6%88%B7/%E6%96%87%E6%A1%A3/%E5%AD%90%E6%96%87%E4%BB%B6%E5%A4%B9/%E5%9B%BE%E7%89%87.jpg",
        );

        // 验证解码后路径正确
        const url = new URL(result);
        const decodedPath = decodeURIComponent(url.pathname);
        expect(decodedPath).toBe("/用户/文档/子文件夹/图片.jpg");
    });
});

// removeFileProtocol 现在通过 preload API 使用，测试移到 shared 层

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
            src: "file:///root/.photasaoriginals/thumbnail-%E7%89%B9%E6%AE%8A%E5%AD%97%E7%AC%A6%40%23%24.jpeg.png",
            thumbnail:
                "file:///root/.photasaoriginals/thumbnail-%E7%89%B9%E6%AE%8A%E5%AD%97%E7%AC%A6%40%23%24.jpeg.png",
            preview: "file:///root/photos/%E7%89%B9%E6%AE%8A%E5%AD%97%E7%AC%A6%40%23%24.jpeg",
            raw: "file:///root/photos/%E7%89%B9%E6%AE%8A%E5%AD%97%E7%AC%A6%40%23%24.jpeg",
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

import { describe, it, expect } from "vitest";
import { toImageMeta } from "@renderer/common/image";
import type { Image } from "@renderer/common/image";

describe("MediaPreview Image Source", () => {
    it("should use preview path for HEIC images", () => {
        // 模拟一个HEIC图片的Image对象
        const heicImage: Image = {
            key: "photos/holiday.heic",
            src: "file:///root/.photasaoriginals/thumbnail-holiday.heic.png",
            thumbnail: "file:///root/.photasaoriginals/thumbnail-holiday.heic.png",
            preview: "file:///root/.photasaoriginals/holiday.jpeg", // 预览图路径
            raw: "file:///root/photos/holiday.heic", // 原始HEIC文件
            isVideo: false,
        };

        // toImageMeta应该将preview路径放在src字段
        const metaImage = toImageMeta(heicImage);

        // 验证返回的对象结构
        expect(metaImage.src).toBe("file:///root/.photasaoriginals/holiday.jpeg");
        expect(metaImage.raw).toBe("file:///root/photos/holiday.heic");
        expect(metaImage.thumbnail).toBe(
            "file:///root/.photasaoriginals/thumbnail-holiday.heic.png",
        );

        // 确保src不是原始HEIC文件
        expect(metaImage.src).not.toBe(metaImage.raw);
        expect(metaImage.src).not.toContain(".heic");
        expect(metaImage.src).toContain(".jpeg");
    });

    it("should use original path for non-HEIC images", () => {
        const jpegImage: Image = {
            key: "photos/sunset.jpeg",
            src: "file:///root/.photasaoriginals/thumbnail-sunset.jpeg.png",
            thumbnail: "file:///root/.photasaoriginals/thumbnail-sunset.jpeg.png",
            preview: "file:///root/photos/sunset.jpeg", // 对于非HEIC，preview就是原始文件
            raw: "file:///root/photos/sunset.jpeg",
            isVideo: false,
        };

        const metaImage = toImageMeta(jpegImage);

        expect(metaImage.src).toBe("file:///root/photos/sunset.jpeg");
        expect(metaImage.raw).toBe("file:///root/photos/sunset.jpeg");
        expect(metaImage.src).toBe(metaImage.raw); // 对于非HEIC，两者相同
    });

    it("should handle video files correctly", () => {
        const videoImage: Image = {
            key: "videos/movie.mp4",
            src: "file:///root/.photasaoriginals/thumbnail-movie.mp4.png",
            thumbnail: "file:///root/.photasaoriginals/thumbnail-movie.mp4.png",
            preview: "file:///root/videos/movie.mp4",
            raw: "file:///root/videos/movie.mp4",
            isVideo: true,
        };

        const metaImage = toImageMeta(videoImage);

        expect(metaImage.isVideo).toBe(true);
        expect(metaImage.src).toBe("file:///root/videos/movie.mp4");
        expect(metaImage.thumbnail).toBe("file:///root/.photasaoriginals/thumbnail-movie.mp4.png");
    });

    it("should use default dimensions when not specified", () => {
        const image: Image = {
            key: "test.jpg",
            src: "thumbnail.png",
            thumbnail: "thumbnail.png",
            preview: "test.jpg",
            raw: "test.jpg",
            isVideo: false,
        };

        const metaImage = toImageMeta(image);

        expect(metaImage.w).toBe(1200); // DEFAULT_WIDTH
        expect(metaImage.h).toBe(900); // DEFAULT_HEIGHT
    });

    it("should use custom dimensions when specified", () => {
        const image: Image = {
            key: "test.jpg",
            src: "thumbnail.png",
            thumbnail: "thumbnail.png",
            preview: "test.jpg",
            raw: "test.jpg",
            isVideo: false,
        };

        const metaImage = toImageMeta(image, { width: 1920, height: 1080 });

        expect(metaImage.w).toBe(1920);
        expect(metaImage.h).toBe(1080);
    });
});

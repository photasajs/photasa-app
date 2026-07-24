import { describe, it, expect, vi, beforeEach } from "vitest";
import {
    toImageList,
    computeColumns,
    requestThumbnail,
    hydrateFolderThumbnailMtimes,
} from "../ImageListHelper";
import type { PhotasaConfig } from "@photasa/common";
import type { Photo } from "@photasa/common";
import type { Image } from "@renderer/common/image";
import { createThumbnailTask } from "@renderer/utils/api";
import {
    getThumbnailBustKey,
    getThumbnailDisplaySrc,
    resetThumbnailBustStateForTests,
} from "@renderer/utils/thumbnail-display";

// Mock createThumbnailTask
vi.mock("@renderer/utils/api", () => ({
    createThumbnailTask: {
        perform: vi.fn(),
    },
    getFilesModified: vi.fn(),
}));

describe("ImageListHelper", () => {
    describe("toImageList", () => {
        it("应该将配置转换为图片列表", () => {
            const currentFolder = "/test/folder";
            const config: PhotasaConfig = {
                version: "1.0",
                photoList: [
                    {
                        path: "image1.jpg",
                        thumbnail: "thumb1.jpg",
                        preview: "preview1.jpg",
                        isVideo: false,
                        width: 800,
                        height: 600,
                    } as Photo,
                    {
                        path: "video1.mp4",
                        thumbnail: "thumb1.jpg",
                        preview: "preview1.jpg",
                        isVideo: true,
                        width: 1920,
                        height: 1080,
                    } as Photo,
                ],
                lastModified: Date.now(),
            };

            const result = toImageList(currentFolder, config);

            expect(result.title).toBe(currentFolder);
            expect(result.parts).toEqual(["", "test", "folder"]);
            expect(result.images).toHaveLength(2);
            expect(result.images[0].key).toBe("image1.jpg");
            expect(result.images[0].isVideo).toBe(false);
            expect(result.images[1].key).toBe("video1.mp4");
            expect(result.images[1].isVideo).toBe(true);
        });

        it("应该处理空的photoList", () => {
            const currentFolder = "/empty/folder";
            const config: PhotasaConfig = {
                version: "1.0",
                photoList: [],
                lastModified: Date.now(),
            };

            const result = toImageList(currentFolder, config);

            expect(result.title).toBe(currentFolder);
            expect(result.images).toHaveLength(0);
            expect(result.parts).toEqual(["", "empty", "folder"]);
        });

        it("应该处理未定义的photoList", () => {
            const currentFolder = "/undefined/folder";
            const config: PhotasaConfig = {
                version: "1.0",
                photoList: undefined as any,
                lastModified: Date.now(),
            };

            const result = toImageList(currentFolder, config);

            expect(result.title).toBe(currentFolder);
            expect(result.images).toHaveLength(0);
        });

        it("应该正确分割文件夹路径", () => {
            const currentFolder = "/Users/test/Photos/2023";
            const config: PhotasaConfig = {
                version: "1.0",
                photoList: [],
                lastModified: Date.now(),
            };

            const result = toImageList(currentFolder, config);

            expect(result.parts).toEqual(["", "Users", "test", "Photos", "2023"]);
        });
    });

    describe("computeColumns", () => {
        it("应该计算正确的列数", () => {
            const containerWidth = 800;
            const thumbnailSize = 150;

            const result = computeColumns(containerWidth, thumbnailSize);

            // available = 800 - 48 = 752
            // cols = floor(752 / (150 + 16)) = floor(752 / 166) = 4
            expect(result).toBe(4);
        });

        it("应该使用自定义的gap和padding", () => {
            const containerWidth = 800;
            const thumbnailSize = 150;
            const gap = 20;
            const padding = 30;

            const result = computeColumns(containerWidth, thumbnailSize, { gap, padding });

            // available = 800 - 60 = 740
            // cols = floor(740 / (150 + 20)) = floor(740 / 170) = 4
            expect(result).toBe(4);
        });

        it("应该在容器宽度为0时返回1", () => {
            const result = computeColumns(0, 150);
            expect(result).toBe(1);
        });

        it("应该至少返回1列", () => {
            const containerWidth = 50; // 很小的宽度
            const thumbnailSize = 200; // 很大的缩略图

            const result = computeColumns(containerWidth, thumbnailSize);

            expect(result).toBe(1);
        });

        it("应该处理边界情况", () => {
            // 刚好容纳1列的情况
            const thumbnailSize = 150;
            const gap = 16;
            const padding = 24;
            const containerWidth = thumbnailSize + gap + 2 * padding; // 190

            const result = computeColumns(containerWidth, thumbnailSize);

            expect(result).toBe(1);
        });

        it("应该处理大容器宽度", () => {
            const containerWidth = 2000;
            const thumbnailSize = 100;

            const result = computeColumns(containerWidth, thumbnailSize);

            // available = 2000 - 48 = 1952
            // cols = floor(1952 / (100 + 16)) = floor(1952 / 116) = 16
            expect(result).toBe(16);
        });
    });

    describe("requestThumbnail", () => {
        const thumbRel = "file:///test/.photasaoriginals/thumbnail-test.jpg.png";

        beforeEach(() => {
            vi.clearAllMocks();
            resetThumbnailBustStateForTests();
        });

        it("应该调用createThumbnailTask.perform（目标路径取自 config 缩略图）", async () => {
            const mockPerform = vi.mocked(createThumbnailTask.perform);
            mockPerform.mockResolvedValue({
                success: true,
                file: "/test/.photasaoriginals/thumbnail-test.jpg.png",
            });

            const image: Image = {
                key: "test.jpg",
                src: thumbRel,
                thumbnail: thumbRel,
                preview: "file:///test/preview.jpg",
                raw: "file:///test/test.jpg",
                isVideo: false,
            };

            await requestThumbnail(image, 200);

            expect(mockPerform).toHaveBeenCalledWith({
                path: "/test/test.jpg",
                thumbnail: "/test/.photasaoriginals/thumbnail-test.jpg.png",
                width: 200,
                height: 200,
                always: true,
                preview: "",
            });
        });

        it("应该在缺少raw属性时使用preview", async () => {
            const mockPerform = vi.mocked(createThumbnailTask.perform);
            mockPerform.mockResolvedValue({ success: true });

            const previewThumb = "file:///test/.photasaoriginals/thumbnail-preview.jpg.png";
            const image: Image = {
                key: "test.jpg",
                src: previewThumb,
                thumbnail: previewThumb,
                preview: "file:///test/preview.jpg",
                raw: null as unknown as string,
                isVideo: false,
            };

            await requestThumbnail(image, 150);

            expect(mockPerform).toHaveBeenCalledWith({
                path: "/test/preview.jpg",
                thumbnail: "/test/.photasaoriginals/thumbnail-preview.jpg.png",
                width: 150,
                height: 150,
                always: true,
                preview: "",
            });
        });

        it("应该返回带缓存破坏的 WebView URL", async () => {
            const mockPerform = vi.mocked(createThumbnailTask.perform);
            mockPerform.mockResolvedValue({ success: true });

            const mockDate = 1234567890;
            vi.spyOn(Date, "now").mockReturnValue(mockDate);

            const image: Image = {
                key: "test.jpg",
                src: thumbRel,
                thumbnail: thumbRel,
                preview: "file:///test/preview.jpg",
                raw: "file:///test/test.jpg",
                isVideo: false,
            };

            const newSrc = await requestThumbnail(image, 180);

            expect(newSrc).toBe(
                `file:///test/.photasaoriginals/thumbnail-test.jpg.png?t=${mockDate}`,
            );
            expect(getThumbnailDisplaySrc(image)).toBe(newSrc);

            vi.restoreAllMocks();
        });

        it("createThumbnail 失败时应抛错", async () => {
            const mockPerform = vi.mocked(createThumbnailTask.perform);
            mockPerform.mockResolvedValue({ success: false, error: "decode failed" });

            const image: Image = {
                key: "test.jpg",
                src: thumbRel,
                thumbnail: thumbRel,
                preview: "file:///test/preview.jpg",
                raw: "file:///test/test.jpg",
                isVideo: false,
            };

            await expect(requestThumbnail(image, 180)).rejects.toThrow("decode failed");
        });

        it("应该处理视频文件", async () => {
            const mockPerform = vi.mocked(createThumbnailTask.perform);
            mockPerform.mockResolvedValue({ success: true });

            const videoThumb = "file:///test/.photasaoriginals/thumbnail-test.mp4.png";
            const image: Image = {
                key: "test.mp4",
                src: videoThumb,
                thumbnail: videoThumb,
                preview: "file:///test/preview.jpg",
                raw: "file:///test/test.mp4",
                isVideo: true,
            };

            await requestThumbnail(image, 250);

            expect(mockPerform).toHaveBeenCalledWith({
                path: "/test/test.mp4",
                thumbnail: "/test/.photasaoriginals/thumbnail-test.mp4.png",
                width: 250,
                height: 250,
                always: true,
                preview: "",
            });
        });
    });

    describe("hydrateFolderThumbnailMtimes", () => {
        it("应使用与 getThumbnailBustKey 相同的路径键 stat 磁盘", async () => {
            const { getFilesModified } = await import("@renderer/utils/api");
            const mockGetFilesModified = vi.mocked(getFilesModified);
            mockGetFilesModified.mockResolvedValue({});

            const folder = "/Volumes/Photos";
            const config: PhotasaConfig = {
                version: "1.0",
                photoList: [
                    {
                        path: "a.jpg",
                        thumbnail: ".photasaoriginals/thumbnail-a.jpg.png",
                        isVideo: false,
                    },
                ],
                lastModified: 0,
            };
            const image = toImageList(folder, config).images[0];
            const bustKey = getThumbnailBustKey(image);

            await hydrateFolderThumbnailMtimes(folder, config.photoList);

            expect(mockGetFilesModified).toHaveBeenCalledWith([bustKey]);
        });
    });
});

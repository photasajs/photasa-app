import { describe, expect, it, vi } from "vitest";
import { createGalleryMediaOperations } from "../gallery-media";
import { WeiZhengService } from "../weizheng";

describe("魏征图库 accessor (RFC 0154 Phase 2e)", () => {
    it("submits thumbnail creation through one typed memorial", async () => {
        const processZouzhe = vi.fn().mockResolvedValue({
            approved: true,
            data: { success: true, file: "/photos/thumb.png" },
            instruction: "准奏",
        });
        const gallery = createGalleryMediaOperations({ processZouzhe });
        const request = {
            path: "/photos/source.jpg",
            thumbnail: "/photos/thumb.png",
            width: 200,
            height: 200,
            preview: "",
        };

        await expect(gallery.createThumbnail(request)).resolves.toEqual({
            success: true,
            file: "/photos/thumb.png",
        });
        expect(processZouzhe).toHaveBeenCalledWith(
            expect.objectContaining({
                department: "图库监察",
                matter: "create_thumbnail",
                content: { request },
            }),
        );
    });

    it("normalizes Rust metadata dates at the persona boundary", async () => {
        const processZouzhe = vi.fn().mockResolvedValue({
            approved: true,
            data: {
                path: "/photos/source.jpg",
                name: "source.jpg",
                size: 12,
                type: "image",
                dateSource: "exif",
                modifiedTime: "2026-07-24T01:00:00.000Z",
                createdTime: "2026-07-24T00:00:00.000Z",
                dateTime: "2026-07-23T23:00:00.000Z",
                creationTime: "2026-07-23T22:00:00.000Z",
            },
            instruction: "准奏",
        });
        const gallery = createGalleryMediaOperations({ processZouzhe });

        const metadata = await gallery.fileMetadata("file:///photos/source.jpg");

        expect(metadata.modifiedTime).toBeInstanceOf(Date);
        expect(metadata.createdTime).toBeInstanceOf(Date);
        expect(metadata.dateTime).toBeInstanceOf(Date);
        expect(metadata.creationTime).toBeInstanceOf(Date);
    });

    it("rejects denied media work", async () => {
        const gallery = createGalleryMediaOperations({
            processZouzhe: vi.fn().mockResolvedValue({
                approved: false,
                data: null,
                instruction: "执行失败",
            }),
        });

        await expect(gallery.filesModified(["/photos/thumb.png"])).rejects.toThrow("执行失败");
    });

    it("exposes gallery work through Wei Zheng instead of UI reaching Fang Xuanling", async () => {
        const processZouzhe = vi.fn().mockResolvedValue({
            approved: true,
            data: { "/photos/thumb.png": 42 },
            instruction: "准奏",
        });
        const service = new WeiZhengService({ processZouzhe } as never);

        await expect(service.gallery.filesModified(["/photos/thumb.png"])).resolves.toEqual({
            "/photos/thumb.png": 42,
        });
    });
});

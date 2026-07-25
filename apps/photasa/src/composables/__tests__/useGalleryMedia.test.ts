import { defineComponent, h } from "vue";
import { mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";
import { WEI_ZHENG_TOKEN } from "@renderer/interfaces/wei-zheng.interface";
import { useGalleryMedia } from "../useGalleryMedia";

describe("useGalleryMedia (RFC 0154 Phase 2e)", () => {
    it("keeps thumbnail concurrency in the UI composable and delegates media work to Wei Zheng", async () => {
        const gallery = {
            createThumbnail: vi.fn().mockResolvedValue({ success: true }),
            fileMetadata: vi.fn().mockResolvedValue({ name: "a.jpg" }),
            filesModified: vi.fn().mockResolvedValue({ "/photos/thumb.png": 42 }),
        };
        let media!: ReturnType<typeof useGalleryMedia>;
        const Host = defineComponent({
            setup() {
                media = useGalleryMedia();
                return () => h("div");
            },
        });
        const wrapper = mount(Host, {
            global: {
                provide: {
                    [WEI_ZHENG_TOKEN as symbol]: { gallery },
                },
            },
        });

        await expect(
            media.createThumbnail({
                path: "/photos/a.jpg",
                thumbnail: "/photos/thumb.png",
                width: 200,
                height: 200,
                preview: "",
            }),
        ).resolves.toEqual({ success: true });
        await expect(media.fileMetadata("/photos/a.jpg")).resolves.toEqual({ name: "a.jpg" });
        await expect(media.filesModified(["/photos/thumb.png"])).resolves.toEqual({
            "/photos/thumb.png": 42,
        });
        expect(gallery.createThumbnail).toHaveBeenCalledTimes(1);

        wrapper.unmount();
    });
});

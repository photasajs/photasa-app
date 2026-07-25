import { describe, it, expect, vi } from "vitest";
import { mount } from "@vue/test-utils";
import ImageListItem from "../ImageListItem.vue";
import { IMAGE_HOVER_ACTION, IMAGE_HOVER_TEST_ID } from "../image-list-hover-actions";
import type { Image } from "@renderer/common/image";

vi.mock("@phosphor-icons/vue", () => ({
    PhArrowsClockwise: { name: "PhArrowsClockwise", template: "<span />" },
    PhFolderOpen: { name: "PhFolderOpen", template: "<span />" },
    PhInfo: { name: "PhInfo", template: "<span />" },
}));

vi.mock("vue-i18n", async () => {
    const actual = await vi.importActual<typeof import("vue-i18n")>("vue-i18n");
    return {
        ...actual,
        useI18n: () => ({
            t: (key: string) => key,
        }),
    };
});

const sampleImage: Image = {
    key: "photo.jpg",
    src: "asset://localhost/photo-thumb.png",
    thumbnail: "asset://localhost/photo-thumb.png",
    preview: "asset://localhost/photo.jpg",
    raw: "asset://localhost/photo.jpg",
    isVideo: false,
};

function mountItem(overrides: Partial<InstanceType<typeof ImageListItem>["$props"]> = {}) {
    return mount(ImageListItem, {
        props: {
            image: sampleImage,
            thumbnailSize: 180,
            fallback: "fallback.png",
            mouseEnterDelay: 0,
            rebuildThumbnail: vi.fn().mockResolvedValue(undefined),
            ...overrides,
        },
        global: {
            stubs: {
                BaseTooltip: { template: "<div><slot /></div>" },
                BaseCard: { template: "<div><slot /></div>" },
                BaseImage: true,
            },
        },
    });
}

describe("ImageListItem hover action bar", () => {
    it("悬停时显示 3 个操作按钮", async () => {
        const wrapper = mountItem();
        await wrapper.find(".image-list-item").trigger("mouseenter");

        expect(wrapper.find('[data-testid="image-hover-bar"]').isVisible()).toBe(true);
        expect(
            wrapper
                .find(`[data-testid="${IMAGE_HOVER_TEST_ID[IMAGE_HOVER_ACTION.DETAIL]}"]`)
                .exists(),
        ).toBe(true);
        expect(
            wrapper
                .find(`[data-testid="${IMAGE_HOVER_TEST_ID[IMAGE_HOVER_ACTION.REBUILD]}"]`)
                .exists(),
        ).toBe(true);
        expect(
            wrapper
                .find(`[data-testid="${IMAGE_HOVER_TEST_ID[IMAGE_HOVER_ACTION.OPEN_IN_FINDER]}"]`)
                .exists(),
        ).toBe(true);
    });

    it("详情按钮触发 openMeta", async () => {
        const wrapper = mountItem();
        await wrapper.find(".image-list-item").trigger("mouseenter");
        await wrapper
            .find(`[data-testid="${IMAGE_HOVER_TEST_ID[IMAGE_HOVER_ACTION.DETAIL]}"]`)
            .trigger("click");

        expect(wrapper.emitted("openMeta")).toHaveLength(1);
    });

    it("在 Finder 中打开按钮触发 openInFolder", async () => {
        const wrapper = mountItem();
        await wrapper.find(".image-list-item").trigger("mouseenter");
        await wrapper
            .find(`[data-testid="${IMAGE_HOVER_TEST_ID[IMAGE_HOVER_ACTION.OPEN_IN_FINDER]}"]`)
            .trigger("click");

        expect(wrapper.emitted("openInFolder")).toHaveLength(1);
    });

    it("重建缩略图按钮调用 rebuildThumbnail", async () => {
        const rebuildThumbnail = vi.fn().mockResolvedValue(undefined);
        const wrapper = mountItem({ rebuildThumbnail });

        await wrapper.find(".image-list-item").trigger("mouseenter");
        await wrapper
            .find(`[data-testid="${IMAGE_HOVER_TEST_ID[IMAGE_HOVER_ACTION.REBUILD]}"]`)
            .trigger("click");

        expect(rebuildThumbnail).toHaveBeenCalledWith(sampleImage);
    });
});

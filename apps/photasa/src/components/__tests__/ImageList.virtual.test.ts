import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { defineComponent, h, nextTick } from "vue";
import { createPinia, setActivePinia } from "pinia";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import ImageList from "../ImageList.vue";

const mockScrollToOffset = vi.fn();
const mockMeasure = vi.fn();

const VirtualizedGridStub = defineComponent({
    name: "VirtualizedGrid",
    props: {
        rows: { type: Array, required: true },
        rowHeight: { type: Number, required: true },
        resolveScrollElement: { type: Function, default: undefined },
    },
    setup(_props, { expose }) {
        expose({
            measure: mockMeasure,
            scrollToOffset: mockScrollToOffset,
            scrollToRow: vi.fn(),
        });
        return () => h("div", { class: "virtualized-grid-stub" });
    },
});

vi.mock("../FileInfoDrawer.vue", () => ({
    default: { name: "FileInfoDrawer", template: "<div />" },
}));

vi.mock("@renderer/composables/useZhangSunWuJi", () => ({
    useZhangSunWuJi: () => ({
        openInFinder: vi.fn(),
    }),
}));

vi.mock("@renderer/composables/useGalleryMedia", () => ({
    useGalleryMedia: () => ({
        createThumbnail: vi.fn(),
        fileMetadata: vi.fn(),
        filesModified: vi.fn().mockResolvedValue({}),
    }),
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

const mountOptions = {
    global: {
        stubs: {
            BaseBreadcrumb: true,
            BaseBreadcrumbItem: true,
            FileCountBadge: true,
            LoadingState: true,
            EmptyState: true,
            ImageListItem: true,
            MediaPreview: true,
            VirtualizedGrid: VirtualizedGridStub,
        },
    },
};

describe("ImageList virtual scroll integration", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        setActivePinia(createPinia());
    });

    it("使用 VirtualizedGrid 并在切换文件夹时滚回顶部", async () => {
        const { usePreferenceStore } = await import("@renderer/stores/preference");
        const store = usePreferenceStore();

        store.appState.currentFolder = "/photos/a";
        store.appState.currentFolderConfig = {
            version: "1.0",
            photoList: [{ path: "a.jpg", thumbnail: "t.jpg", isVideo: false } as never],
            lastModified: Date.now(),
        };

        const wrapper = mount(ImageList, mountOptions);

        await flushPromises();
        expect(wrapper.find(".virtualized-grid-stub").exists()).toBe(true);

        store.appState.currentFolder = "/photos/b";
        store.appState.currentFolderConfig = {
            version: "1.0",
            photoList: [{ path: "b.jpg", thumbnail: "t2.jpg", isVideo: false } as never],
            lastModified: Date.now(),
        };

        await nextTick();
        await flushPromises();

        expect(mockScrollToOffset).toHaveBeenCalledWith(0);

        wrapper.unmount();
    });

    it("ImageList 源码不直接 import useVirtualizer", () => {
        const source = readFileSync(resolve(__dirname, "../ImageList.vue"), "utf8");
        expect(source).not.toContain("useVirtualizer");
        expect(source).toContain("VirtualizedGrid");
    });
});

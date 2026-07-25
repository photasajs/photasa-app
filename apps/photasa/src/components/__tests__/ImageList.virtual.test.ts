import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { ref, nextTick } from "vue";
import { createPinia, setActivePinia } from "pinia";
import ImageList from "../ImageList.vue";

const mockScrollToOffset = vi.fn();
const mockMeasure = vi.fn();

vi.mock("../FileInfoDrawer.vue", () => ({
    default: { name: "FileInfoDrawer", template: "<div />" },
}));

vi.mock("@tanstack/vue-virtual", () => ({
    useVirtualizer: vi.fn(() =>
        ref({
            getVirtualItems: vi.fn(() => []),
            getTotalSize: vi.fn(() => 0),
            measure: mockMeasure,
            scrollToOffset: mockScrollToOffset,
            options: { count: 0 },
            scrollElement: null,
        }),
    ),
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

describe("ImageList virtual scroll integration", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        setActivePinia(createPinia());
    });

    it("切换文件夹时初始化虚拟滚动", async () => {
        const { usePreferenceStore } = await import("@renderer/stores/preference");
        const store = usePreferenceStore();

        store.appState.currentFolder = "/photos/a";
        store.appState.currentFolderConfig = {
            version: "1.0",
            photoList: [{ path: "a.jpg", thumbnail: "t.jpg", isVideo: false } as never],
            lastModified: Date.now(),
        };

        const wrapper = mount(ImageList, {
            global: {
                stubs: {
                    BaseBreadcrumb: true,
                    BaseBreadcrumbItem: true,
                    FileCountBadge: true,
                    LoadingState: true,
                    EmptyState: true,
                    BaseContextMenu: {
                        template: "<div><slot /><slot name='menu' :close='() => {}' /></div>",
                    },
                    BaseTooltip: { template: "<div><slot /></div>" },
                    BaseCard: { template: "<div><slot /></div>" },
                    BaseImage: true,
                    BaseMenuItem: true,
                    MediaPreview: true,
                },
            },
        });

        await flushPromises();

        store.appState.currentFolder = "/photos/b";
        store.appState.currentFolderConfig = {
            version: "1.0",
            photoList: [{ path: "b.jpg", thumbnail: "t2.jpg", isVideo: false } as never],
            lastModified: Date.now(),
        };

        await nextTick();
        await flushPromises();

        expect(mockMeasure).toHaveBeenCalled();

        wrapper.unmount();
    });
});

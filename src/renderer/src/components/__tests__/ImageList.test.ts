import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount } from "@vue/test-utils";
import { nextTick } from "vue";
import ImageList from "../ImageList.vue";
import { usePreferenceStore } from "@renderer/stores/preference";
import type { PhotasaConfig } from "@common/config-types";
import type { Photo } from "@common/config-types";

// Mock dependencies
vi.mock("@renderer/stores/preference", () => ({
    usePreferenceStore: vi.fn(),
}));

vi.mock("@renderer/utils/api", () => ({
    getFileMetadata: vi.fn(),
    createThumbnailTask: {
        perform: vi.fn(),
    },
}));

vi.mock("@renderer/utils/api-path", () => ({
    openInFinder: vi.fn(),
}));

vi.mock("@tanstack/vue-virtual", () => ({
    useVirtualizer: vi.fn(() => ({
        value: {
            getVirtualItems: () => [],
            getTotalSize: () => 0,
            options: { count: 0 },
            measure: vi.fn(),
        },
    })),
}));

vi.mock("@common/logger", () => ({
    loggers: {
        renderer: {
            debug: vi.fn(),
            error: vi.fn(),
        },
    },
}));

describe("ImageList", () => {
    const createMockStore = (overrides: Partial<any> = {}) => ({
        thumbnailSize: 150,
        currentFolder: "/test/folder",
        currentFolderConfig: {
            version: "1.0",
            photoList: [],
            lastModified: Date.now(),
        } as PhotasaConfig,
        ...overrides,
    });

    beforeEach(() => {
        vi.clearAllMocks();
        const mockStore = createMockStore();
        vi.mocked(usePreferenceStore).mockReturnValue({
            ...mockStore,
            $state: mockStore,
        } as any);
    });

    it("应该渲染空状态当没有图片时", () => {
        const wrapper = mount(ImageList);

        expect(wrapper.find(".image-list").exists()).toBe(true);
        expect(wrapper.findComponent({ name: "EmptyState" }).exists()).toBe(true);
    });

    it("应该正确显示面包屑", () => {
        const mockStore = createMockStore({
            currentFolder: "/Users/test/Photos/2023",
        });
        vi.mocked(usePreferenceStore).mockReturnValue({
            ...mockStore,
            $state: mockStore,
        } as any);

        const wrapper = mount(ImageList);

        expect(wrapper.findComponent({ name: "BaseBreadcrumb" }).exists()).toBe(true);
    });

    it("应该处理字符串类型的thumbnailSize", async () => {
        const mockStore = createMockStore({
            thumbnailSize: "203", // 字符串类型
            currentFolderConfig: {
                version: "1.0",
                photoList: [
                    {
                        path: "test.jpg",
                        thumbnail: "thumb.jpg",
                        preview: "preview.jpg",
                        isVideo: false,
                        width: 800,
                        height: 600,
                    } as Photo,
                ],
                lastModified: Date.now(),
            },
        });
        vi.mocked(usePreferenceStore).mockReturnValue({
            ...mockStore,
            $state: mockStore,
        } as any);

        const wrapper = mount(ImageList);
        await nextTick();

        // 检查是否正确转换了字符串类型的thumbnailSize
        const vm = wrapper.vm as any;
        expect(typeof vm.safeThumbnailSize).toBe("number");
        expect(vm.safeThumbnailSize).toBe(203);
    });

    it("应该使用默认值当thumbnailSize无效时", async () => {
        const mockStore = createMockStore({
            thumbnailSize: "invalid", // 无效字符串
        });
        vi.mocked(usePreferenceStore).mockReturnValue({
            ...mockStore,
            $state: mockStore,
        } as any);

        const wrapper = mount(ImageList);
        await nextTick();

        const vm = wrapper.vm as any;
        expect(vm.safeThumbnailSize).toBe(150); // 默认值
    });

    it("应该正确计算列数", async () => {
        const mockStore = createMockStore({
            thumbnailSize: 150,
        });
        vi.mocked(usePreferenceStore).mockReturnValue({
            ...mockStore,
            $state: mockStore,
        } as any);

        const wrapper = mount(ImageList);

        // 设置容器宽度
        const vm = wrapper.vm as any;
        vm.containerWidth = 800;
        await nextTick();

        expect(typeof vm.columns).toBe("number");
        expect(vm.columns).toBeGreaterThanOrEqual(1);
    });

    it("应该正确计算行高", async () => {
        const mockStore = createMockStore({
            thumbnailSize: 200,
        });
        vi.mocked(usePreferenceStore).mockReturnValue({
            ...mockStore,
            $state: mockStore,
        } as any);

        const wrapper = mount(ImageList);
        await nextTick();

        const vm = wrapper.vm as any;
        expect(vm.rowHeight).toBe(216); // 200 + 16
    });

    it("应该处理图片数据", async () => {
        const mockStore = createMockStore({
            currentFolder: "/test/folder",
            currentFolderConfig: {
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
            },
        });
        vi.mocked(usePreferenceStore).mockReturnValue({
            ...mockStore,
            $state: mockStore,
        } as any);

        const wrapper = mount(ImageList);
        await nextTick();

        const vm = wrapper.vm as any;
        expect(vm.card.images).toHaveLength(2);
        expect(vm.card.images[0].key).toBe("image1.jpg");
        expect(vm.card.images[0].isVideo).toBe(false);
        expect(vm.card.images[1].key).toBe("video1.mp4");
        expect(vm.card.images[1].isVideo).toBe(true);
    });

    it("应该正确处理预览功能", async () => {
        const mockStore = createMockStore({
            currentFolderConfig: {
                version: "1.0",
                photoList: [
                    {
                        path: "test.jpg",
                        thumbnail: "thumb.jpg",
                        preview: "preview.jpg",
                        isVideo: false,
                        width: 800,
                        height: 600,
                    } as Photo,
                ],
                lastModified: Date.now(),
            },
        });
        vi.mocked(usePreferenceStore).mockReturnValue({
            ...mockStore,
            $state: mockStore,
        } as any);

        const wrapper = mount(ImageList);
        await nextTick();

        const vm = wrapper.vm as any;

        // 测试打开预览
        expect(vm.previewVisible).toBe(false);
        vm.openPreview(0, 0);
        expect(vm.previewVisible).toBe(true);
        expect(vm.previewIndex).toBe(0);
    });

    it("应该处理容器宽度更新", async () => {
        const wrapper = mount(ImageList, {
            attachTo: document.body,
        });

        const vm = wrapper.vm as any;

        // Mock element clientWidth
        const mockElement = {
            clientWidth: 1200,
        } as HTMLElement;
        vm.imageListRef = mockElement;

        vm.updateContainerWidth();
        expect(vm.containerWidth).toBe(1200);

        wrapper.unmount();
    });

    it("应该正确发出import事件", async () => {
        const wrapper = mount(ImageList);

        // 触发空状态的按钮点击
        const emptyState = wrapper.findComponent({ name: "EmptyState" });
        await emptyState.vm.$emit("buttonClick");

        expect(wrapper.emitted("import")).toBeTruthy();
    });

    it("应该处理resize事件", async () => {
        const wrapper = mount(ImageList, {
            attachTo: document.body,
        });

        const vm = wrapper.vm as any;
        const updateSpy = vi.spyOn(vm, "updateContainerWidth");

        // 触发resize事件
        window.dispatchEvent(new Event("resize"));

        expect(updateSpy).toHaveBeenCalled();

        wrapper.unmount();
    });

    it("应该处理错误的图片元数据加载", async () => {
        const { getFileMetadata } = await import("@renderer/utils/api");
        vi.mocked(getFileMetadata).mockRejectedValue(new Error("Failed to load"));

        const mockStore = createMockStore({
            currentFolderConfig: {
                version: "1.0",
                photoList: [
                    {
                        path: "test.jpg",
                        thumbnail: "thumb.jpg",
                        preview: "preview.jpg",
                        isVideo: false,
                        width: 800,
                        height: 600,
                    } as Photo,
                ],
                lastModified: Date.now(),
            },
        });
        vi.mocked(usePreferenceStore).mockReturnValue({
            ...mockStore,
            $state: mockStore,
        } as any);

        const wrapper = mount(ImageList);
        await nextTick();

        const vm = wrapper.vm as any;
        const mockImage = vm.card.images[0];

        await vm.openImageMeta(mockImage);

        expect(vm.loadingInfo).toBe(false);
        expect(vm.fileMeta).toBe(null);
    });

    it("应该处理缩略图重建", async () => {
        const { createThumbnailTask } = await import("@renderer/utils/api");
        vi.mocked(createThumbnailTask.perform).mockResolvedValue(undefined);

        const mockStore = createMockStore({
            thumbnailSize: 180,
            currentFolderConfig: {
                version: "1.0",
                photoList: [
                    {
                        path: "test.jpg",
                        thumbnail: "thumb.jpg",
                        preview: "preview.jpg",
                        isVideo: false,
                        width: 800,
                        height: 600,
                    } as Photo,
                ],
                lastModified: Date.now(),
            },
        });
        vi.mocked(usePreferenceStore).mockReturnValue({
            ...mockStore,
            $state: mockStore,
        } as any);

        const wrapper = mount(ImageList);
        await nextTick();

        const vm = wrapper.vm as any;
        const mockImage = vm.card.images[0];

        await vm.rebuildThumbnail(mockImage);

        expect(createThumbnailTask.perform).toHaveBeenCalledWith({
            path: mockImage.raw,
            thumbnail: mockImage.src,
            width: 180,
            height: 180,
            always: true,
            preview: "",
        });
    });

    it("应该正确处理虚拟滚动", async () => {
        const mockStore = createMockStore({
            currentFolderConfig: {
                version: "1.0",
                photoList: Array.from({ length: 100 }, (_, i) => ({
                    path: `image${i}.jpg`,
                    thumbnail: `thumb${i}.jpg`,
                    preview: `preview${i}.jpg`,
                    isVideo: false,
                    width: 800,
                    height: 600,
                })) as Photo[],
                lastModified: Date.now(),
            },
        });
        vi.mocked(usePreferenceStore).mockReturnValue({
            ...mockStore,
            $state: mockStore,
        } as any);

        const wrapper = mount(ImageList);
        await nextTick();

        const vm = wrapper.vm as any;

        expect(vm.rows.length).toBeGreaterThan(0);
        expect(vm.virtualizer).toBeDefined();
    });
});

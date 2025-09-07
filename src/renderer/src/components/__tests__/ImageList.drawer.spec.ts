import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import ImageList from "../ImageList.vue";
import { nextTick } from "vue";

// Mock API calls
vi.mock("@renderer/utils/api", () => ({
    getFileMetadata: vi.fn().mockResolvedValue({
        name: "image.jpg",
        type: "image",
        format: "jpeg",
        path: "/path/to/image.jpg",
        size: 1024000,
        width: 1920,
        height: 1080,
        dateTime: new Date("2023-01-01T12:00:00Z"),
        dateSource: "exif",
        modifiedTime: new Date("2023-01-02T12:00:00Z"),
        createdTime: new Date("2023-01-01T10:00:00Z"),
        gpsInfo: null,
        cameraInfo: null,
        rawMetadata: {
            "Image Width": { value: "1920" },
            "Image Height": { value: "1080" },
            "MIME Type": { value: "image/jpeg" },
        },
    }),
    getPhotasaConfig: vi.fn().mockResolvedValue({
        photoList: [],
        version: "1.0.0",
        lastModified: Date.now(),
    }),
}));

vi.mock("@renderer/utils/api-path", () => ({
    openInFinder: vi.fn(),
}));

// Mock Ant Design components globally
vi.mock("ant-design-vue", () => ({
    default: {
        install: vi.fn(),
    },
}));

describe("ImageList Drawer Functionality", () => {
    beforeEach(() => {
        setActivePinia(createPinia());
    });

    it("should open drawer when showInfo is set to true", async () => {
        const wrapper = mount(ImageList, {
            global: {
                stubs: {
                    BaseDrawer: {
                        props: ["modelValue", "placement", "title"],
                        template: `<div class="mock-drawer" v-if="modelValue"><slot /></div>`,
                    },
                    BaseSpinContainer: {
                        props: ["spinning"],
                        template: `<div class="mock-spin"><slot /></div>`,
                    },
                    BaseDescriptions: {
                        props: ["title", "layout", "bordered", "column"],
                        template: `<div class="mock-descriptions"><slot /></div>`,
                    },
                    BaseDescriptionItem: {
                        props: ["label", "span"],
                        template: `<div class="mock-descriptions-item"><slot /></div>`,
                    },
                    BaseTooltip: {
                        props: ["title", "placement"],
                        template: `<div class="mock-tooltip"><slot /></div>`,
                    },
                    BaseCard: {
                        props: ["hoverable", "style"],
                        template: `<div class="mock-card"><slot /></div>`,
                    },
                    BaseBreadcrumb: true,
                    BaseBreadcrumbItem: true,
                    JsonTreeView: true,
                    BaseImage: true,
                    BaseContextMenu: true,
                    BaseMenuItem: true,
                    MediaPreview: true,
                    LoadingState: true,
                    EmptyState: true,
                },
                mocks: {
                    $t: (key: string) => key,
                },
            },
        });

        // Initially drawer should be closed
        expect(wrapper.find(".mock-drawer").exists()).toBe(false);

        // Open drawer by setting showInfo
        const vm = wrapper.vm as any;
        vm.showInfo = true;
        await nextTick();

        // Drawer should be visible
        expect(wrapper.find(".mock-drawer").exists()).toBe(true);

        // Close drawer
        vm.showInfo = false;
        await nextTick();

        // Drawer should be closed
        expect(wrapper.find(".mock-drawer").exists()).toBe(false);
    });

    it("should display image metadata when drawer is opened", async () => {
        const { getFileMetadata } = await import("@renderer/utils/api");

        const wrapper = mount(ImageList, {
            global: {
                stubs: {
                    BaseDrawer: {
                        props: ["modelValue"],
                        template: `<div class="mock-drawer" v-if="modelValue"><slot /></div>`,
                    },
                    BaseSpinContainer: {
                        props: ["spinning"],
                        template: `<div class="mock-spin" :data-spinning="spinning"><slot /></div>`,
                    },
                    BaseDescriptions: {
                        template: `<div class="mock-descriptions"><slot /></div>`,
                    },
                    BaseDescriptionItem: {
                        props: ["label"],
                        template: `<div class="mock-descriptions-item" :data-label="label"><slot /></div>`,
                    },
                    BaseTooltip: true,
                    BaseCard: true,
                    BaseBreadcrumb: true,
                    BaseBreadcrumbItem: true,
                    JsonTreeView: {
                        props: ["data", "maxDepth"],
                        template: `<div class="mock-json-tree">{{ data }}</div>`,
                    },
                    BaseImage: true,
                    BaseContextMenu: true,
                    BaseMenuItem: true,
                    MediaPreview: true,
                    LoadingState: true,
                    EmptyState: true,
                },
                mocks: {
                    $t: (key: string) => key,
                },
            },
        });

        const vm = wrapper.vm as any;

        // Simulate opening image metadata
        const mockImage = {
            raw: "file:///path/to/image.jpg",
            key: "image.jpg",
            src: "file:///path/to/image.jpg",
            isVideo: false,
        };

        await vm.openImageMeta(mockImage);

        // Check that the API was called
        expect(getFileMetadata).toHaveBeenCalledWith("file:///path/to/image.jpg");

        // Check that metadata is populated
        expect(vm.fileMeta.type).toBe("image");
        expect(vm.fileMeta.width).toBe(1920);
        expect(vm.fileMeta.height).toBe(1080);
        expect(vm.fileMeta.path).toBe("/path/to/image.jpg");

        // Check that drawer is open
        expect(vm.showInfo).toBe(true);

        await nextTick();

        // Check that content is rendered
        const drawerContent = wrapper.find(".mock-drawer");
        expect(drawerContent.exists()).toBe(true);

        const descriptionItems = wrapper.findAll(".mock-descriptions-item");
        expect(descriptionItems.length).toBeGreaterThan(0);

        // Check for JSON tree view
        const jsonTree = wrapper.find(".mock-json-tree");
        expect(jsonTree.exists()).toBe(true);
        expect(jsonTree.text()).toContain("name");
    });

    it("should show loading state while fetching metadata", async () => {
        const wrapper = mount(ImageList, {
            global: {
                stubs: {
                    BaseDrawer: {
                        props: ["modelValue"],
                        template: `<div class="mock-drawer" v-if="modelValue"><slot /></div>`,
                    },
                    BaseSpinContainer: {
                        props: ["spinning"],
                        template: `<div class="mock-spin" :data-spinning="spinning"><slot /></div>`,
                    },
                    BaseDescriptions: true,
                    BaseDescriptionItem: true,
                    BaseTooltip: true,
                    BaseCard: true,
                    BaseBreadcrumb: true,
                    BaseBreadcrumbItem: true,
                    JsonTreeView: true,
                    BaseImage: true,
                    BaseContextMenu: true,
                    BaseMenuItem: true,
                    MediaPreview: true,
                    LoadingState: true,
                    EmptyState: true,
                },
                mocks: {
                    $t: (key: string) => key,
                },
            },
        });

        const vm = wrapper.vm as any;

        // Check initial loading state
        expect(vm.loadingInfo).toBe(false);

        // Start opening metadata (which sets loading to true)
        const mockImage = {
            raw: "file:///path/to/image.jpg",
            key: "image.jpg",
            src: "file:///path/to/image.jpg",
            isVideo: false,
        };

        const openMetaPromise = vm.openImageMeta(mockImage);

        // Loading should be true immediately
        expect(vm.loadingInfo).toBe(true);

        // Wait for the operation to complete
        await openMetaPromise;

        // Loading should be false after completion
        expect(vm.loadingInfo).toBe(false);
    });
});

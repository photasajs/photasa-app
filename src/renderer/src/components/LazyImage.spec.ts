import { describe, it, expect, vi, beforeEach } from "vitest";
import { shallowMount } from "@vue/test-utils";
import { nextTick } from "vue";
import LazyImage from "./LazyImage.vue";
import { prefetchImageTask } from "@renderer/utils/image-prefetch";
import * as vueUseCore from "@vueuse/core";

// Mock Ant Design Vue components
const MockAImage = {
    name: "a-image",
    template: "<div class='ant-image'><slot /></div>",
    props: ["src", "width", "height", "fallback", "preview"],
    emits: ["click"],
};
const MockASpin = {
    name: "a-spin",
    template: "<div class='ant-spin'><slot /></div>",
    props: ["spinning"],
};
const MockAModal = {
    name: "a-modal",
    template: "<div class='ant-modal'><slot /></div>",
    props: ["visible"],
};
const MockVideoPlayer = {
    name: "video-player",
    template: "<div class='video-player'><slot /></div>",
    props: ["src", "poster"],
};

// Mock the prefetchImageTask
vi.mock("@renderer/utils/image-prefetch", () => ({
    prefetchImageTask: {
        perform: vi.fn().mockResolvedValue(undefined),
    },
}));

// Mock useIntersectionObserver to control visibility
let targetIsVisibleRef: any = undefined;
vi.mock("@vueuse/core", async () => {
    const actual = await vi.importActual<any>("@vueuse/core");
    return {
        ...actual,
        useIntersectionObserver: (target, callback) => {
            targetIsVisibleRef = target;
            // Simulate intersection observer callback to set targetIsVisible to true
            callback([{ isIntersecting: true }]);
        },
    };
});

// Utility to flush all pending promises
const flushPromises = () => new Promise(setImmediate);

describe("LazyImage", () => {
    const defaultProps = {
        src: "test-image.jpg",
        height: 200,
        width: 300,
        preview: "preview-image.jpg",
        fallback: "fallback-image.jpg",
        isVideo: false,
        raw: "raw-image.jpg",
    };

    beforeEach(() => {
        vi.clearAllMocks();
        targetIsVisibleRef = undefined;
    });

    it("renders with correct dimensions", () => {
        const wrapper = shallowMount(LazyImage, { props: defaultProps });
        const thumbnail = wrapper.find(".thumbnail-image");
        expect(thumbnail.attributes("style")).toContain("width: 300px");
        expect(thumbnail.attributes("style")).toContain("height: 200px");
    });

    it("shows loading spinner when image is not ready", async () => {
        vi.mocked(prefetchImageTask.perform).mockImplementationOnce(() => {
            return new Promise(() => {
                /* no-op */
            }) as any;
        });
        const wrapper = shallowMount(LazyImage, {
            props: defaultProps,
            global: {
                stubs: {
                    "a-spin": MockASpin,
                    "a-image": MockAImage,
                },
            },
        });
        if (targetIsVisibleRef) targetIsVisibleRef.value = true;
        await nextTick();
        expect(wrapper.find(".ant-spin").exists()).toBe(true);
        expect(wrapper.find(".ant-image").exists()).toBe(false);
    });

    it("loads image when visible", async () => {
        const wrapper = shallowMount(LazyImage, { props: defaultProps });

        // Set targetIsVisible to true
        if (targetIsVisibleRef) targetIsVisibleRef.value = true;
        await nextTick();

        expect(prefetchImageTask.perform).toHaveBeenCalledWith(defaultProps.src);
    });

    it("handles video content correctly", async () => {
        const wrapper = shallowMount(LazyImage, {
            props: { ...defaultProps, isVideo: true },
            global: {
                stubs: {
                    "a-spin": MockASpin,
                    "a-image": MockAImage,
                },
            },
        });
        if (targetIsVisibleRef) targetIsVisibleRef.value = true;
        await nextTick();
        await nextTick(); // ensure state is updated
        // For videos, isReady is set to true immediately
        expect(wrapper.findComponent(MockASpin).props("spinning")).toBe(false);
    });

    it("toggles preview on click for images", async () => {
        const wrapper = shallowMount(LazyImage, {
            props: defaultProps,
            global: {
                stubs: {
                    "a-spin": MockASpin,
                    "a-image": MockAImage,
                    "a-modal": MockAModal,
                },
            },
        });
        if (targetIsVisibleRef) targetIsVisibleRef.value = true;
        await flushPromises();
        await nextTick();
        const image = wrapper.find(".ant-image");
        expect(image.exists()).toBe(true);
        await image.trigger("click");
        await nextTick();
        expect(wrapper.find(".ant-modal").exists()).toBe(true);
    });

    it("opens video player on click for videos", async () => {
        const wrapper = shallowMount(LazyImage, {
            props: { ...defaultProps, isVideo: true },
            global: {
                stubs: {
                    "a-spin": MockASpin,
                    "a-image": MockAImage,
                    "video-player": MockVideoPlayer,
                },
            },
        });
        if (targetIsVisibleRef) targetIsVisibleRef.value = true;
        await flushPromises();
        await nextTick();
        const image = wrapper.find(".ant-image");
        expect(image.exists()).toBe(true);
        await image.trigger("click");
        await nextTick();
        expect(wrapper.find(".video-player").exists()).toBe(true);
    });

    it("handles prefetch errors gracefully", async () => {
        vi.mocked(prefetchImageTask.perform).mockRejectedValueOnce(new Error("Failed to load"));
        const wrapper = shallowMount(LazyImage, {
            props: defaultProps,
            global: {
                stubs: {
                    "a-spin": MockASpin,
                    "a-image": MockAImage,
                },
            },
        });

        // Set targetIsVisible to true
        if (targetIsVisibleRef) targetIsVisibleRef.value = true;
        await nextTick();
        await nextTick(); // ensure state is updated after error

        // After error, isReady is set to true and spinner should not be spinning
        expect(wrapper.findComponent(MockASpin).props("spinning")).toBe(false);
    });

    it("updates when src changes", async () => {
        const wrapper = shallowMount(LazyImage, { props: defaultProps });
        await wrapper.setProps({ src: "new-image.jpg" });
        await nextTick();
        expect(prefetchImageTask.perform).toHaveBeenCalledWith("new-image.jpg");
    });
});

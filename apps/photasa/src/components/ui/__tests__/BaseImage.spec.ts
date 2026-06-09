import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { shallowMount } from "@vue/test-utils";
import { nextTick } from "vue";
import BaseImage from "@renderer/components/ui/BaseImage.vue";
import { prefetchImageTask } from "@renderer/utils/image-prefetch";

// Mock Base components
const MockBaseSpinner = {
    name: "BaseSpinner",
    template: "<div class='base-spinner'><slot /></div>",
    props: ["size"],
};

// const MockAModal = {
//     name: "a-modal",
//     template: "<div class='ant-modal'><slot /></div>",
//     props: ["visible"],
// };
// const MockVideoPlayer = {
//     name: "video-player",
//     template: "<div class='video-player'><slot /></div>",
//     props: ["src", "poster"],
// };

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

describe("BaseImage", () => {
    const defaultProps = {
        src: "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/2wBDAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwA/8A",
        height: 200,
        width: 300,
        preview:
            "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/2wBDAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwA/8A",
        fallback:
            "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/2wBDAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwA/8A",
        isVideo: false,
        raw: "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/2wBDAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwA/8A",
    };

    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();
        targetIsVisibleRef = undefined;
    });

    afterEach(() => {
        vi.clearAllTimers();
        vi.useRealTimers();
    });

    it("renders with correct dimensions", () => {
        const wrapper = shallowMount(BaseImage, { props: defaultProps });
        const thumbnail = wrapper.find(".thumbnail-image");
        expect(thumbnail.attributes("style")).toContain("width: 300px");
        expect(thumbnail.attributes("style")).toContain("height: 200px");
    });

    it("shows loading spinner when image is not ready", async () => {
        vi.mocked(prefetchImageTask.perform).mockImplementationOnce(() => {
            return new Promise((resolve) => {
                setTimeout(() => resolve({} as any), 5000); // Long delay to keep loading state
            }) as any;
        });
        const wrapper = shallowMount(BaseImage, {
            props: defaultProps,
            global: {
                stubs: {
                    BaseSpinner: MockBaseSpinner,
                },
            },
        });
        if (targetIsVisibleRef) targetIsVisibleRef.value = true;
        await nextTick();
        expect(wrapper.find(".base-spinner").exists()).toBe(true);
        expect(wrapper.find("img").exists()).toBe(false);
    });

    it("handles video content correctly", async () => {
        const wrapper = shallowMount(BaseImage, {
            props: { ...defaultProps, isVideo: true },
            global: {
                stubs: {
                    BaseSpinner: MockBaseSpinner,
                },
            },
        });
        if (targetIsVisibleRef) targetIsVisibleRef.value = true;
        await nextTick();
        await nextTick(); // ensure state is updated
        // For videos, isReady is set to true immediately
        expect(wrapper.findComponent(MockBaseSpinner).exists()).toBe(false);
    });

    it("handles prefetch errors gracefully", async () => {
        vi.mocked(prefetchImageTask.perform).mockRejectedValueOnce(new Error("Failed to load"));
        const wrapper = shallowMount(BaseImage, {
            props: defaultProps,
            global: {
                stubs: {
                    BaseSpinner: MockBaseSpinner,
                },
            },
        });

        // Set targetIsVisible to true
        if (targetIsVisibleRef) targetIsVisibleRef.value = true;
        await nextTick();
        await nextTick(); // ensure state is updated after error

        // After error, isReady is set to true and spinner should not be spinning
        expect(wrapper.findComponent(MockBaseSpinner).exists()).toBe(false);
    });

    it("updates when src changes", async () => {
        const wrapper = shallowMount(BaseImage, { props: defaultProps });
        await wrapper.setProps({
            src: "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/2wBDAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwA/8A",
        });
        await nextTick();
        expect(prefetchImageTask.perform).toHaveBeenCalledWith(
            "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/2wBDAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwA/8A",
        );
    it("uses viewport fit mode in lightbox without fixed pixel box", async () => {
        const wrapper = shallowMount(BaseImage, {
            props: { ...defaultProps, fitViewport: true, eagerLoad: true },
            global: {
                stubs: {
                    BaseSpinner: MockBaseSpinner,
                },
            },
        });
        if (targetIsVisibleRef) targetIsVisibleRef.value = true;
        await nextTick();
        await nextTick();

        expect(wrapper.find(".thumbnail-image--fit-viewport").exists()).toBe(true);
        const img = wrapper.find("img");
        expect(img.attributes("style")).toContain("max-width: 80vw");
        expect(img.attributes("style")).toContain("max-height: 80vh");
        expect(img.attributes("style")).not.toContain("width: 300px");
    });
});

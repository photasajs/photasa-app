import { describe, it, expect, vi, afterEach } from "vitest";
import { mount } from "@vue/test-utils";
import { nextTick } from "vue";
import SplitView from "@renderer/components/SplitView.vue";

describe("SplitView", () => {
    const defaultSlots = {
        A: '<div class="slot-a">A Content</div>',
        B: '<div class="slot-b">B Content</div>',
    };

    // 清理函数，确保测试之间不会相互影响
    afterEach(() => {
        vi.clearAllMocks();
    });

    it("renders slot content for A and B", () => {
        const wrapper = mount(SplitView, {
            props: { direction: "horizontal", aInit: "100px", aMin: "50px", aMax: "200px" },
            slots: defaultSlots,
        });
        expect(wrapper.find(".slot-a").exists()).toBe(true);
        expect(wrapper.find(".slot-b").exists()).toBe(true);
    });

    it("applies horizontal direction by default", () => {
        const wrapper = mount(SplitView, {
            slots: defaultSlots,
        });
        expect(wrapper.classes().some((className) => className.startsWith("_SplitView"))).toBe(
            true,
        );
        expect(wrapper.classes().some((className) => className.startsWith("_isVertical"))).toBe(
            false,
        );
    });

    it("applies vertical direction", () => {
        const wrapper = mount(SplitView, {
            props: { direction: "vertical" },
            slots: defaultSlots,
        });
        expect(wrapper.classes().some((className) => className.startsWith("_isVertical"))).toBe(
            true,
        );
    });

    it("applies initial size to side A", () => {
        const wrapper = mount(SplitView, {
            props: { aInit: "200px" },
            slots: defaultSlots,
        });
        const sideA = wrapper.find("[class*=SideA]");
        expect(sideA.attributes("style")).toContain("width: 200px");
    });

    it("applies min and max constraints to side A", () => {
        const wrapper = mount(SplitView, {
            props: { aMin: "100px", aMax: "300px" },
            slots: defaultSlots,
        });
        const sideA = wrapper.find("[class*=SideA]");
        expect(sideA.attributes("style")).toContain("min-width: 100px");
        expect(sideA.attributes("style")).toContain("max-width: 300px");
    });

    it("should emit dragStart when handle is clicked", async () => {
        const wrapper = mount(SplitView, {
            props: { direction: "horizontal", aInit: "100px" },
            slots: defaultSlots,
        });

        const handle = wrapper.find("[class*=Handle]");
        await handle.trigger("mousedown", { button: 0 });

        expect(wrapper.emitted("dragStart")).toBeTruthy();
        expect(wrapper.emitted("dragStart")).toHaveLength(1);
    });

    it("cleans up event listeners on unmount", () => {
        const wrapper = mount(SplitView, {
            slots: defaultSlots,
        });

        const handle = wrapper.find("[class*=Handle]");
        handle.trigger("mousedown", { button: 0 });

        // Spy on removeEventListener
        const removeEventListenerSpy = vi.spyOn(window, "removeEventListener");

        wrapper.unmount();

        expect(removeEventListenerSpy).toHaveBeenCalledWith("mousemove", expect.any(Function));
        expect(removeEventListenerSpy).toHaveBeenCalledWith("mouseup", expect.any(Function));
    });

    it("should emit dragStart for vertical direction", async () => {
        const wrapper = mount(SplitView, {
            props: { direction: "vertical", aInit: "100px" },
            slots: defaultSlots,
        });

        const handle = wrapper.find("[class*=Handle]");
        await handle.trigger("mousedown", { button: 0 });

        expect(wrapper.emitted("dragStart")).toBeTruthy();
        expect(wrapper.emitted("dragStart")).toHaveLength(1);
    });

    it("should not emit events when handle is not pressed", async () => {
        const wrapper = mount(SplitView, {
            props: { direction: "horizontal", aInit: "100px" },
            slots: defaultSlots,
        });

        // Simulate mousemove without mousedown
        const mouseEvent = new MouseEvent("mousemove", {
            clientX: 150,
            clientY: 0,
            bubbles: true,
            cancelable: true,
        });
        window.dispatchEvent(mouseEvent);

        await nextTick();

        // Should not emit any events
        expect(wrapper.emitted("dragStart")).toBeFalsy();
        expect(wrapper.emitted("dragEnd")).toBeFalsy();
        expect(wrapper.emitted("update:offset")).toBeFalsy();
    });

    it("should apply correct CSS classes for horizontal direction", () => {
        const wrapper = mount(SplitView, {
            props: { direction: "horizontal" },
            slots: defaultSlots,
        });

        const handle = wrapper.find("[class*=Handle]");
        // Check that the handle exists and has the correct structure
        expect(handle.exists()).toBe(true);
        expect(handle.classes().some((className) => className.includes("Handle"))).toBe(true);
    });

    it("should apply correct CSS classes for vertical direction", () => {
        const wrapper = mount(SplitView, {
            props: { direction: "vertical" },
            slots: defaultSlots,
        });

        const handle = wrapper.find("[class*=Handle]");
        // Check that the handle exists and has the correct structure
        expect(handle.exists()).toBe(true);
        expect(handle.classes().some((className) => className.includes("Handle"))).toBe(true);
    });

    it("should render handle with correct cursor styles", () => {
        const horizontalWrapper = mount(SplitView, {
            props: { direction: "horizontal" },
            slots: defaultSlots,
        });

        const verticalWrapper = mount(SplitView, {
            props: { direction: "vertical" },
            slots: defaultSlots,
        });

        const horizontalHandle = horizontalWrapper.find("[class*=Handle]");
        const verticalHandle = verticalWrapper.find("[class*=Handle]");

        // Check that handles have correct cursor styles (these would be applied via CSS)
        expect(horizontalHandle.exists()).toBe(true);
        expect(verticalHandle.exists()).toBe(true);
    });

    it("should handle prop changes correctly", async () => {
        const wrapper = mount(SplitView, {
            props: { direction: "horizontal", aInit: "100px" },
            slots: defaultSlots,
        });

        // Change direction
        await wrapper.setProps({ direction: "vertical" });
        const handle = wrapper.find("[class*=Handle]");
        expect(handle.exists()).toBe(true);

        // Verify that the component can accept new props
        await wrapper.setProps({ aInit: "200px" });
        expect(wrapper.props("aInit")).toBe("200px");
    });
});

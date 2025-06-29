import { describe, it, expect, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { nextTick } from "vue";
import SplitView from "@renderer/components/SplitView.vue";

describe("SplitView", () => {
    const defaultSlots = {
        A: '<div class="slot-a">A Content</div>',
        B: '<div class="slot-b">B Content</div>',
    };

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

    it("responds to drag events", async () => {
        const wrapper = mount(SplitView, {
            props: { direction: "horizontal", aInit: "100px" },
            slots: defaultSlots,
        });

        const handle = wrapper.find("[class*=Handle]");
        await handle.trigger("mousedown", { button: 0 });

        // Simulate mousemove event
        const mouseEvent = new MouseEvent("mousemove", {
            clientX: 150,
            clientY: 0,
        });
        window.dispatchEvent(mouseEvent);

        // Simulate mouseup event
        window.dispatchEvent(new MouseEvent("mouseup"));

        await nextTick();

        // The offset should have changed from the initial value
        const sideA = wrapper.find("[class*=SideA]");
        expect(sideA.attributes("style")).not.toContain("width: 100px");
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

    it("handles vertical drag correctly", async () => {
        const wrapper = mount(SplitView, {
            props: { direction: "vertical", aInit: "100px" },
            slots: defaultSlots,
        });

        const handle = wrapper.find("[class*=Handle]");
        await handle.trigger("mousedown", { button: 0 });

        // Simulate mousemove event
        const mouseEvent = new MouseEvent("mousemove", {
            clientX: 0,
            clientY: 150,
        });
        window.dispatchEvent(mouseEvent);

        // Simulate mouseup event
        window.dispatchEvent(new MouseEvent("mouseup"));

        await nextTick();

        // The offset should have changed from the initial value
        const sideA = wrapper.find("[class*=SideA]");
        expect(sideA.attributes("style")).not.toContain("height: 100px");
    });

    it("prevents dragging when handle is not pressed", async () => {
        const wrapper = mount(SplitView, {
            props: { direction: "horizontal", aInit: "100px" },
            slots: defaultSlots,
        });

        // Simulate mousemove without mousedown
        const mouseEvent = new MouseEvent("mousemove", {
            clientX: 150,
            clientY: 0,
        });
        window.dispatchEvent(mouseEvent);

        await nextTick();

        // The offset should not have changed
        const sideA = wrapper.find("[class*=SideA]");
        expect(sideA.attributes("style")).toContain("width: 100px");
    });
});

import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import BaseSpinner from "../BaseSpinner.vue";

describe("BaseSpinner", () => {
    it("renders with default props", () => {
        const wrapper = mount(BaseSpinner);

        expect(wrapper.find("div").exists()).toBe(true);
        expect(wrapper.classes()).toContain("animate-spin");
        expect(wrapper.classes()).toContain("h-6");
        expect(wrapper.classes()).toContain("w-6");
    });

    it("applies size classes correctly", () => {
        const wrapper = mount(BaseSpinner, {
            props: {
                size: "lg",
            },
        });

        expect(wrapper.classes()).toContain("h-8");
        expect(wrapper.classes()).toContain("w-8");
        expect(wrapper.classes()).toContain("border-4");
    });

    it("has correct accessibility attributes", () => {
        const wrapper = mount(BaseSpinner);

        expect(wrapper.attributes("role")).toBe("status");
        expect(wrapper.find(".sr-only").text()).toBe("Loading...");
    });

    it("applies extra large size correctly", () => {
        const wrapper = mount(BaseSpinner, {
            props: {
                size: "xl",
            },
        });

        expect(wrapper.classes()).toContain("h-12");
        expect(wrapper.classes()).toContain("w-12");
    });
});

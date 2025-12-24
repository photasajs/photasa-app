import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import BaseBadge from "../BaseBadge.vue";

describe("BaseBadge", () => {
    it("renders count correctly", () => {
        const wrapper = mount(BaseBadge, {
            props: { count: 5 },
        });

        expect(wrapper.text()).toBe("5");
        expect(wrapper.exists()).toBe(true);
    });

    it("renders text instead of count", () => {
        const wrapper = mount(BaseBadge, {
            props: { text: "New" },
        });

        expect(wrapper.text()).toBe("New");
    });

    it("handles max count correctly", () => {
        const wrapper = mount(BaseBadge, {
            props: { count: 150, max: 99 },
        });

        expect(wrapper.text()).toBe("99+");
    });

    it("renders as dot when dot prop is true", () => {
        const wrapper = mount(BaseBadge, {
            props: { dot: true, count: 5 },
        });

        expect(wrapper.classes()).toContain("rounded-full");
        expect(wrapper.text()).toBe(""); // Dot has no text
    });

    it("shows zero when showZero is true", () => {
        const wrapper = mount(BaseBadge, {
            props: { count: 0, showZero: true },
        });

        expect(wrapper.text()).toBe("0");
        expect(wrapper.exists()).toBe(true);
    });

    it("does not render when count is 0 and showZero is false", () => {
        const wrapper = mount(BaseBadge, {
            props: { count: 0, showZero: false },
        });

        expect(wrapper.find("span").exists()).toBe(false);
    });

    it("applies size classes correctly", () => {
        const wrapperSm = mount(BaseBadge, {
            props: { count: 1, size: "sm" },
        });

        const wrapperLg = mount(BaseBadge, {
            props: { count: 1, size: "lg" },
        });

        expect(wrapperSm.classes()).toContain("text-xs");
        expect(wrapperLg.classes()).toContain("text-sm");
    });

    it("applies variant classes correctly", () => {
        const variants = ["primary", "secondary", "success", "warning", "danger", "info"] as const;

        variants.forEach((variant) => {
            const wrapper = mount(BaseBadge, {
                props: { count: 1, variant },
            });

            // Each variant should have appropriate background color
            expect(wrapper.element.className).toMatch(/bg-\[var\(--color-\w+\)\]|bg-\w+-\d+/);
        });
    });

    it("renders slot content", () => {
        const wrapper = mount(BaseBadge, {
            slots: {
                default: "Custom Content",
            },
        });

        expect(wrapper.text()).toBe("Custom Content");
    });
});

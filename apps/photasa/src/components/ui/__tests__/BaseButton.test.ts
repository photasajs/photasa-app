import { describe, it, expect, afterEach } from "vitest";
import { mount } from "@vue/test-utils";
import BaseButton from "../BaseButton.vue";

// 移除全局 Event mock，避免环境污染

describe("BaseButton", () => {
    // 清理函数，确保测试之间不会相互影响
    afterEach(() => {
        // 清理所有 mock 和定时器
    });
    it("renders correctly with default props", () => {
        const wrapper = mount(BaseButton, {
            slots: {
                default: "Button Text",
            },
        });

        expect(wrapper.text()).toContain("Button Text");
        expect(wrapper.find("button").classes()).toContain("inline-flex");
    });

    it("handles click events", async () => {
        const wrapper = mount(BaseButton, {
            slots: {
                default: "Click me",
            },
        });

        await wrapper.find("button").trigger("click");
        expect(wrapper.emitted("click")).toBeTruthy();
        expect(wrapper.emitted("click")).toHaveLength(1);
    });

    it("applies size classes correctly", () => {
        const smallWrapper = mount(BaseButton, {
            props: { size: "sm" },
            slots: { default: "Small" },
        });

        const largeWrapper = mount(BaseButton, {
            props: { size: "lg" },
            slots: { default: "Large" },
        });

        expect(smallWrapper.find("button").classes()).toContain("px-3");
        expect(smallWrapper.find("button").classes()).toContain("py-1.5");
        expect(smallWrapper.find("button").classes()).toContain("text-sm");

        expect(largeWrapper.find("button").classes()).toContain("px-6");
        expect(largeWrapper.find("button").classes()).toContain("py-3");
        expect(largeWrapper.find("button").classes()).toContain("text-lg");
    });

    it("applies variant styles correctly", () => {
        const primaryWrapper = mount(BaseButton, {
            props: { variant: "primary" },
            slots: { default: "Primary" },
        });

        const secondaryWrapper = mount(BaseButton, {
            props: { variant: "secondary" },
            slots: { default: "Secondary" },
        });

        expect(primaryWrapper.find("button").classes()).toContain("bg-[var(--color-primary)]");
        expect(primaryWrapper.find("button").classes()).toContain("text-[var(--color-white)]");

        expect(secondaryWrapper.find("button").classes()).toContain(
            "bg-[var(--color-bg-secondary)]",
        );
        expect(secondaryWrapper.find("button").classes()).toContain("text-[var(--color-text)]");
    });

    it("applies type styles correctly (Ant Design compatibility)", () => {
        const primaryWrapper = mount(BaseButton, {
            props: { type: "primary" },
            slots: { default: "Primary" },
        });

        const linkWrapper = mount(BaseButton, {
            props: { type: "link" },
            slots: { default: "Link" },
        });

        const textWrapper = mount(BaseButton, {
            props: { type: "text" },
            slots: { default: "Text" },
        });

        expect(primaryWrapper.find("button").classes()).toContain("bg-[var(--color-primary)]");
        expect(linkWrapper.find("button").classes()).toContain("text-[var(--color-primary)]");
        expect(linkWrapper.find("button").classes()).toContain("bg-transparent");
        expect(textWrapper.find("button").classes()).toContain("bg-transparent");
    });

    it("handles danger prop correctly", () => {
        const wrapper = mount(BaseButton, {
            props: { danger: true },
            slots: { default: "Danger" },
        });

        expect(wrapper.find("button").classes()).toContain("bg-[var(--color-danger)]");
        expect(wrapper.find("button").classes()).toContain("text-[var(--color-white)]");
    });

    it("handles ghost prop correctly", () => {
        const wrapper = mount(BaseButton, {
            props: { ghost: true },
            slots: { default: "Ghost" },
        });

        expect(wrapper.find("button").classes()).toContain("bg-transparent");
        expect(wrapper.find("button").classes()).toContain("border");
    });

    it("respects disabled state", async () => {
        const wrapper = mount(BaseButton, {
            props: { disabled: true },
            slots: { default: "Disabled" },
        });

        expect(wrapper.find("button").element.disabled).toBe(true);
        expect(wrapper.find("button").classes()).toContain("disabled:opacity-50");

        await wrapper.find("button").trigger("click");
        expect(wrapper.emitted("click")).toBeFalsy();
    });

    it("handles loading state correctly", () => {
        const wrapper = mount(BaseButton, {
            props: { loading: true },
            slots: { default: "Loading" },
        });

        expect(wrapper.find("button").element.disabled).toBe(true);
        expect(wrapper.find("button").classes()).toContain("cursor-not-allowed");
        expect(wrapper.find(".animate-spin").exists()).toBe(true);
    });

    it("renders icon slot correctly", () => {
        const wrapper = mount(BaseButton, {
            slots: {
                icon: '<svg data-testid="test-icon">Test Icon</svg>',
                default: "Button with Icon",
            },
        });

        expect(wrapper.find('[data-testid="test-icon"]').exists()).toBe(true);
        expect(wrapper.text()).toContain("Button with Icon");
    });

    it("prioritizes loading over icon slot", () => {
        const wrapper = mount(BaseButton, {
            props: { loading: true },
            slots: {
                icon: '<svg data-testid="test-icon">Test Icon</svg>',
                default: "Loading Button",
            },
        });

        expect(wrapper.find('[data-testid="test-icon"]').exists()).toBe(false);
        expect(wrapper.find(".animate-spin").exists()).toBe(true);
    });

    it("danger prop overrides other type/variant styles", () => {
        const wrapper = mount(BaseButton, {
            props: {
                danger: true,
                type: "primary",
                variant: "secondary",
            },
            slots: { default: "Danger Override" },
        });

        expect(wrapper.find("button").classes()).toContain("bg-[var(--color-danger)]");
        expect(wrapper.find("button").classes()).not.toContain("bg-[var(--color-primary)]");
        expect(wrapper.find("button").classes()).not.toContain("bg-[var(--color-bg-secondary)]");
    });

    it("ghost prop overrides other type/variant styles except danger", () => {
        const wrapper = mount(BaseButton, {
            props: {
                ghost: true,
                type: "primary",
                variant: "secondary",
            },
            slots: { default: "Ghost Override" },
        });

        expect(wrapper.find("button").classes()).toContain("bg-transparent");
        expect(wrapper.find("button").classes()).not.toContain("bg-[var(--color-primary)]");

        // Test that danger overrides ghost
        const dangerGhostWrapper = mount(BaseButton, {
            props: {
                danger: true,
                ghost: true,
            },
            slots: { default: "Danger Ghost" },
        });

        expect(dangerGhostWrapper.find("button").classes()).toContain("bg-[var(--color-danger)]");
        expect(dangerGhostWrapper.find("button").classes()).not.toContain("bg-transparent");
    });
});

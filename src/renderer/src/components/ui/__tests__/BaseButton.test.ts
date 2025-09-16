import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import BaseButton from "../BaseButton.vue";

// Mock Event constructor to avoid SupportedEventInterface errors
global.Event =
    global.Event ||
    class Event {
        constructor(
            public type: string,
            options?: any,
        ) {
            this.type = type;
            Object.assign(this, options);
        }
        
        // Add required Event interface methods
        preventDefault() {}
        stopPropagation() {}
        stopImmediatePropagation() {}
        get bubbles() { return false; }
        get cancelable() { return false; }
        get composed() { return false; }
        get currentTarget() { return null; }
        get defaultPrevented() { return false; }
        get eventPhase() { return 0; }
        get isTrusted() { return false; }
        get target() { return null; }
        get timeStamp() { return Date.now(); }
    };

// Mock MouseEvent constructor
global.MouseEvent =
    global.MouseEvent ||
    class MouseEvent extends Event {
        constructor(type: string, options?: any) {
            super(type, options);
        }
        
        // Add MouseEvent specific properties
        get button() { return 0; }
        get buttons() { return 0; }
        get clientX() { return 0; }
        get clientY() { return 0; }
        get movementX() { return 0; }
        get movementY() { return 0; }
        get offsetX() { return 0; }
        get offsetY() { return 0; }
        get pageX() { return 0; }
        get pageY() { return 0; }
        get relatedTarget() { return null; }
        get screenX() { return 0; }
        get screenY() { return 0; }
    };

// Mock all event constructors that Vue Test Utils might need
global.KeyboardEvent =
    global.KeyboardEvent ||
    class KeyboardEvent extends Event {
        constructor(type: string, options?: any) {
            super(type, options);
        }
        
        get key() { return ''; }
        get code() { return ''; }
        get keyCode() { return 0; }
        get which() { return 0; }
        get charCode() { return 0; }
        get shiftKey() { return false; }
        get ctrlKey() { return false; }
        get altKey() { return false; }
        get metaKey() { return false; }
        get repeat() { return false; }
        get isComposing() { return false; }
    };

global.FocusEvent =
    global.FocusEvent ||
    class FocusEvent extends Event {
        constructor(type: string, options?: any) {
            super(type, options);
        }
        
        get relatedTarget() { return null; }
    };

describe("BaseButton", () => {
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

import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import BaseButton from "../BaseButton.vue";

describe("BaseButton Text Truncation", () => {
    it("should truncate long text properly", () => {
        const longText = "这是一个非常长的按钮文本，应该被截断显示";
        const wrapper = mount(BaseButton, {
            slots: {
                default: longText,
            },
        });

        const textSpan = wrapper.find("span.truncate");
        expect(textSpan.exists()).toBe(true);
        expect(textSpan.text()).toBe(longText);
        expect(textSpan.classes()).toContain("truncate");
        expect(textSpan.classes()).toContain("max-w-full");
        expect(textSpan.classes()).toContain("whitespace-nowrap");
    });

    it("should handle icon and text together", () => {
        const wrapper = mount(BaseButton, {
            slots: {
                icon: '<div class="test-icon">📁</div>',
                default: "打开文件夹",
            },
        });

        const iconDiv = wrapper.find("div.flex-shrink-0");
        const textSpan = wrapper.find("span.truncate");

        expect(iconDiv.exists()).toBe(true);
        expect(textSpan.exists()).toBe(true);
        expect(iconDiv.classes()).toContain("flex-shrink-0");
        expect(textSpan.classes()).toContain("truncate");
        expect(textSpan.classes()).toContain("whitespace-nowrap");
    });

    it("should have proper flex classes for layout", () => {
        const wrapper = mount(BaseButton, {
            slots: {
                default: "Test Button",
            },
        });

        const button = wrapper.find("button");
        expect(button.classes()).toContain("min-w-0");
        expect(button.classes()).toContain("inline-flex");
        expect(button.classes()).toContain("items-center");
        expect(button.classes()).toContain("justify-center");
        expect(button.classes()).toContain("flex-nowrap");
    });
});

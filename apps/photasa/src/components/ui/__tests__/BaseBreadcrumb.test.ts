import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import BaseBreadcrumb from "../BaseBreadcrumb.vue";
import BaseBreadcrumbItem from "../BaseBreadcrumbItem.vue";

describe("BaseBreadcrumb", () => {
    it("renders breadcrumb items in a single-line list", () => {
        const wrapper = mount(BaseBreadcrumb, {
            slots: {
                default: `
                    <BaseBreadcrumbItem text="Volumes" />
                    <BaseBreadcrumbItem text="One Touch" />
                    <BaseBreadcrumbItem text="照片" is-last />
                `,
            },
            global: {
                components: { BaseBreadcrumbItem },
            },
        });

        const list = wrapper.find(".breadcrumb-list");
        expect(list.exists()).toBe(true);
        expect(wrapper.findAll(".breadcrumb-item")).toHaveLength(3);
    });

    it("applies ellipsis styles to long segment text", () => {
        const longText = "20100305_天津_曹庄_中北镇_假日风景_3日";
        const wrapper = mount(BaseBreadcrumbItem, {
            props: {
                text: longText,
                isLast: true,
            },
        });

        const text = wrapper.find(".breadcrumb-text");
        expect(text.exists()).toBe(true);
        expect(text.text()).toBe(longText);
        expect(text.attributes("title")).toBe(longText);
        expect(wrapper.classes()).toContain("breadcrumb-item--last");
    });

    it("marks non-last items without last modifier class", () => {
        const wrapper = mount(BaseBreadcrumbItem, {
            props: {
                text: "Volumes",
                isLast: false,
            },
        });

        expect(wrapper.classes()).not.toContain("breadcrumb-item--last");
    });
});

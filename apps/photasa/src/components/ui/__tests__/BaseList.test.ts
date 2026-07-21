import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import BaseList from "../BaseList.vue";
import BaseListItem from "../BaseListItem.vue";

describe("BaseList", () => {
    it("renders correctly with default props", () => {
        const wrapper = mount(BaseList, {
            slots: {
                default: "<div>List content</div>",
            },
        });

        expect(wrapper.classes()).toContain("divide-y");
        expect(wrapper.classes()).not.toContain("border");
        expect(wrapper.html()).toContain("List content");
    });

    it("applies bordered style when bordered prop is true", () => {
        const wrapper = mount(BaseList, {
            props: { bordered: true },
        });

        expect(wrapper.classes()).toContain("border");
        expect(wrapper.classes()).toContain("rounded-lg");
    });

    it("applies size classes correctly", () => {
        const wrapper = mount(BaseList, {
            props: { size: "sm" },
        });

        expect(wrapper.classes()).toContain("text-sm");
    });
});

describe("BaseListItem", () => {
    it("renders correctly with title and description", () => {
        const wrapper = mount(BaseListItem, {
            props: {
                title: "Test Title",
                description: "Test Description",
            },
        });

        expect(wrapper.text()).toContain("Test Title");
        expect(wrapper.text()).toContain("Test Description");
    });

    it("handles click events when clickable", async () => {
        const wrapper = mount(BaseListItem, {
            props: { clickable: true },
        });

        await wrapper.trigger("click");
        expect(wrapper.emitted("click")).toBeTruthy();
    });

    it("does not emit click when disabled", async () => {
        const wrapper = mount(BaseListItem, {
            props: { clickable: true, disabled: true },
        });

        await wrapper.trigger("click");
        expect(wrapper.emitted("click")).toBeFalsy();
    });

    it("renders slots correctly", () => {
        const wrapper = mount(BaseListItem, {
            slots: {
                avatar: '<div data-testid="avatar">Avatar</div>',
                title: '<div data-testid="title">Custom Title</div>',
                description: '<div data-testid="desc">Custom Desc</div>',
                actions: '<div data-testid="actions">Actions</div>',
                extra: '<div data-testid="extra">Extra</div>',
            },
        });

        expect(wrapper.find('[data-testid="avatar"]').exists()).toBe(true);
        expect(wrapper.find('[data-testid="title"]').exists()).toBe(true);
        expect(wrapper.find('[data-testid="desc"]').exists()).toBe(true);
        expect(wrapper.find('[data-testid="actions"]').exists()).toBe(true);
        expect(wrapper.find('[data-testid="extra"]').exists()).toBe(true);
    });
});

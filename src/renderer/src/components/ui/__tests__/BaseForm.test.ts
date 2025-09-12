import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import BaseForm from "../BaseForm.vue";
import BaseFormField from "../BaseFormField.vue";

describe("BaseForm", () => {
    it("renders correctly with default props", () => {
        const wrapper = mount(BaseForm, {
            slots: {
                default: "<div>Form content</div>",
            },
        });

        expect(wrapper.find("form").exists()).toBe(true);
        expect(wrapper.classes()).toContain("space-y-6");
        expect(wrapper.text()).toContain("Form content");
    });

    it("handles submit events", async () => {
        const wrapper = mount(BaseForm);

        await wrapper.find("form").trigger("submit");
        expect(wrapper.emitted("submit")).toBeTruthy();
    });

    it("applies custom className", () => {
        const wrapper = mount(BaseForm, {
            props: { className: "custom-form" },
        });

        expect(wrapper.classes()).toContain("custom-form");
    });
});

describe("BaseFormField", () => {
    it("renders label correctly", () => {
        const wrapper = mount(BaseFormField, {
            props: { label: "Field Label" },
            slots: {
                default: "<input />",
            },
        });

        expect(wrapper.find("label").text()).toBe("Field Label");
        expect(wrapper.find("input").exists()).toBe(true);
    });

    it("shows required indicator", () => {
        const wrapper = mount(BaseFormField, {
            props: { label: "Required Field", required: true },
        });

        const label = wrapper.find("label");
        expect(label.classes()).toContain("after:content-['*']");
    });

    it("renders help text", () => {
        const wrapper = mount(BaseFormField, {
            props: { help: "This is help text" },
            slots: {
                default: "<input />",
            },
        });

        expect(wrapper.text()).toContain("This is help text");
    });

    it("shows error message with icon", () => {
        const wrapper = mount(BaseFormField, {
            props: { error: "This field is required" },
            slots: {
                default: "<input />",
            },
        });

        expect(wrapper.text()).toContain("This field is required");
        expect(wrapper.find(".text-red-500").exists()).toBe(true);
    });

    it("applies disabled styles", () => {
        const wrapper = mount(BaseFormField, {
            props: { label: "Disabled Field", disabled: true },
        });

        const label = wrapper.find("label");
        expect(label.classes()).toContain("opacity-50");
    });

    it("generates unique IDs for accessibility", () => {
        const wrapper1 = mount(BaseFormField, {
            props: { label: "Field 1", help: "Help 1" },
        });

        const wrapper2 = mount(BaseFormField, {
            props: { label: "Field 2", help: "Help 2" },
        });

        const label1 = wrapper1.find("label");
        const label2 = wrapper2.find("label");

        expect(label1.attributes("for")).toBeTruthy();
        expect(label2.attributes("for")).toBeTruthy();
        expect(label1.attributes("for")).not.toBe(label2.attributes("for"));
    });

    it("renders custom label slot", () => {
        const wrapper = mount(BaseFormField, {
            slots: {
                label: '<span class="custom-label">Custom Label</span>',
                default: "<input />",
            },
        });

        expect(wrapper.find(".custom-label").text()).toBe("Custom Label");
    });

    it("renders custom help slot", () => {
        const wrapper = mount(BaseFormField, {
            slots: {
                help: '<span class="custom-help">Custom Help</span>',
                default: "<input />",
            },
        });

        expect(wrapper.find(".custom-help").text()).toBe("Custom Help");
    });
});

import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import BaseRadio from "../BaseRadio.vue";
import BaseRadioGroup from "../BaseRadioGroup.vue";

describe("BaseRadio", () => {
    it("renders correctly with label", () => {
        const wrapper = mount(BaseRadio, {
            props: {
                value: "option1",
                label: "Option 1",
                modelValue: "option1",
            },
        });

        expect(wrapper.text()).toContain("Option 1");
        expect(wrapper.find("input").element.checked).toBe(true);
    });

    it("handles value changes", async () => {
        const wrapper = mount(BaseRadio, {
            props: {
                value: "option1",
                modelValue: null,
            },
        });

        await wrapper.find("input").trigger("change");
        expect(wrapper.emitted("update:modelValue")).toEqual([["option1"]]);
        expect(wrapper.emitted("change")).toEqual([["option1"]]);
    });

    it("respects disabled state", async () => {
        const wrapper = mount(BaseRadio, {
            props: {
                value: "option1",
                disabled: true,
            },
        });

        await wrapper.find("input").trigger("change");
        expect(wrapper.emitted("update:modelValue")).toBeFalsy();
    });
});

describe("BaseRadioGroup", () => {
    const options = [
        { label: "Option 1", value: "opt1" },
        { label: "Option 2", value: "opt2" },
        { label: "Option 3", value: "opt3" },
    ];

    it("renders options correctly", () => {
        const wrapper = mount(BaseRadioGroup, {
            props: { options },
        });

        expect(wrapper.text()).toContain("Option 1");
        expect(wrapper.text()).toContain("Option 2");
        expect(wrapper.text()).toContain("Option 3");
    });

    it("handles simple array options", () => {
        const wrapper = mount(BaseRadioGroup, {
            props: { options: ["Apple", "Banana", "Orange"] },
        });

        expect(wrapper.text()).toContain("Apple");
        expect(wrapper.text()).toContain("Banana");
        expect(wrapper.text()).toContain("Orange");
    });

    it("supports horizontal direction", () => {
        const wrapper = mount(BaseRadioGroup, {
            props: { options, direction: "horizontal" },
        });

        expect(wrapper.classes()).toContain("flex");
        expect(wrapper.classes()).toContain("space-x-4");
    });

    it("renders label and description", () => {
        const wrapper = mount(BaseRadioGroup, {
            props: {
                options,
                label: "Choose an option",
                description: "Select one of the following",
            },
        });

        expect(wrapper.text()).toContain("Choose an option");
        expect(wrapper.text()).toContain("Select one of the following");
    });

    it("handles value changes", async () => {
        const wrapper = mount(BaseRadioGroup, {
            props: { options, modelValue: "opt1" },
        });

        // Find the second radio and trigger change
        const radios = wrapper.findAllComponents(BaseRadio);
        await radios[1].vm.$emit("change", "opt2");

        expect(wrapper.emitted("change")).toEqual([["opt2"]]);
    });
});

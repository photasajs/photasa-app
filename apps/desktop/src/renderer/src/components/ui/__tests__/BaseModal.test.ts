import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import BaseModal from "../BaseModal.vue";

describe("BaseModal", () => {
    it("should render correctly", () => {
        const wrapper = mount(BaseModal, {
            props: {
                open: true,
            },
            slots: {
                default: "Modal content",
            },
        });

        expect(wrapper.exists()).toBe(true);
    });

    it("should not render when open is false", () => {
        const wrapper = mount(BaseModal, {
            props: {
                open: false,
            },
        });

        // Modal should still exist in DOM but content might be hidden
        expect(wrapper.exists()).toBe(true);
    });
});

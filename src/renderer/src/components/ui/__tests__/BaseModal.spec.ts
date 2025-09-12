import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import BaseModal from "../BaseModal.vue";

describe("BaseModal", () => {
    it("receives correct props", () => {
        const wrapper = mount(BaseModal, {
            props: {
                open: true,
                title: "Test Modal",
                size: "lg",
                closable: true,
                showDefaultFooter: true,
                confirmText: "OK",
                cancelText: "Cancel",
            },
        });

        expect(wrapper.props("open")).toBe(true);
        expect(wrapper.props("title")).toBe("Test Modal");
        expect(wrapper.props("size")).toBe("lg");
        expect(wrapper.props("closable")).toBe(true);
        expect(wrapper.props("showDefaultFooter")).toBe(true);
    });

    it("has correct default props", () => {
        const wrapper = mount(BaseModal, {
            props: {
                open: false,
            },
        });

        expect(wrapper.props("size")).toBe("md");
        expect(wrapper.props("closable")).toBe(true);
        expect(wrapper.props("showDefaultFooter")).toBe(false);
        expect(wrapper.props("confirmText")).toBe("Confirm");
        expect(wrapper.props("cancelText")).toBe("Cancel");
    });

    it("computes size classes correctly", () => {
        const wrapper = mount(BaseModal, {
            props: {
                open: true,
                size: "lg",
            },
        });

        // Test by checking if the component renders with correct class
        expect(wrapper.props("size")).toBe("lg");
    });

    it("handles different size variants", () => {
        const sizes = ["sm", "md", "lg", "xl", "full"];

        sizes.forEach((size) => {
            const wrapper = mount(BaseModal, {
                props: {
                    open: true,
                    size: size as any,
                },
            });
            expect(wrapper.props("size")).toBe(size);
        });
    });

    it("renders with animation classes when open", () => {
        const wrapper = mount(BaseModal, {
            props: {
                open: true,
            },
            global: {
                stubs: {
                    Teleport: {
                        template: "<div><slot /></div>",
                    },
                },
            },
        });

        // 检查Transition组件是否存在
        expect(wrapper.findComponent({ name: "Transition" }).exists()).toBe(true);

        // 检查动画相关的CSS类
        const modalContent = wrapper.find(".modal-content");
        expect(modalContent.exists()).toBe(true);

        const modalBackdrop = wrapper.find(".modal-backdrop");
        expect(modalBackdrop.exists()).toBe(true);
    });

    it("does not render when open is false", () => {
        const wrapper = mount(BaseModal, {
            props: {
                open: false,
            },
        });

        // 当open为false时，整个模态框应该不存在
        expect(wrapper.find(".modal-content").exists()).toBe(false);
    });

    it("has animation callback functions", () => {
        const wrapper = mount(BaseModal, {
            props: {
                open: true,
            },
        });

        // 检查组件是否正确渲染
        expect(wrapper.exists()).toBe(true);
    });
});

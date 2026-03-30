import { describe, it, expect, vi, afterEach } from "vitest";
import { mount } from "@vue/test-utils";
import { markRaw } from "vue";
import BaseMenuItem from "../BaseMenuItem.vue";

describe("BaseMenuItem", () => {
    // 清理函数，确保测试之间不会相互影响
    afterEach(() => {
        vi.clearAllMocks();
    });
    it("应该正确渲染基本内容", () => {
        const wrapper = mount(BaseMenuItem, {
            slots: {
                default: "菜单项",
            },
        });

        expect(wrapper.find(".base-menu-item").exists()).toBe(true);
        expect(wrapper.find(".base-menu-item__content").text()).toBe("菜单项");
        expect(wrapper.classes()).toContain("base-menu-item");
    });

    it("点击时应该触发click事件", async () => {
        const wrapper = mount(BaseMenuItem, {
            slots: {
                default: "点击我",
            },
        });

        // 使用 Vue Test Utils 的标准方法触发事件
        await wrapper.find(".base-menu-item").trigger("click");

        // 验证事件被正确触发
        expect(wrapper.emitted("click")).toBeTruthy();
        expect(wrapper.emitted("click")).toHaveLength(1);
    });

    it("disabled状态下不应该触发click事件", async () => {
        const wrapper = mount(BaseMenuItem, {
            props: {
                disabled: true,
            },
            slots: {
                default: "禁用的菜单项",
            },
        });

        // 验证 disabled 状态
        expect(wrapper.classes()).toContain("base-menu-item--disabled");

        // 尝试触发点击事件
        await wrapper.find(".base-menu-item").trigger("click");

        // 验证事件没有被触发
        expect(wrapper.emitted("click")).toBeFalsy();
    });

    it("应该正确应用disabled样式类", () => {
        const wrapper = mount(BaseMenuItem, {
            props: {
                disabled: true,
            },
            slots: {
                default: "禁用的菜单项",
            },
        });

        expect(wrapper.classes()).toContain("base-menu-item--disabled");
    });

    it("应该正确应用danger样式类", () => {
        const wrapper = mount(BaseMenuItem, {
            props: {
                danger: true,
            },
            slots: {
                default: "危险操作",
            },
        });

        expect(wrapper.classes()).toContain("base-menu-item--danger");
    });

    it("可以同时应用disabled和danger状态", () => {
        const wrapper = mount(BaseMenuItem, {
            props: {
                disabled: true,
                danger: true,
            },
            slots: {
                default: "禁用的危险操作",
            },
        });

        expect(wrapper.classes()).toContain("base-menu-item--disabled");
        expect(wrapper.classes()).toContain("base-menu-item--danger");
    });

    it("应该正确渲染图标", () => {
        // 创建一个简单的图标组件mock，使用markRaw避免Vue将其转换为响应式对象
        const IconComponent = markRaw({
            name: "TestIcon",
            template: '<div class="test-icon">图标</div>',
        });

        const wrapper = mount(BaseMenuItem, {
            props: {
                icon: IconComponent,
            },
            slots: {
                default: "带图标的菜单项",
            },
        });

        expect(wrapper.find(".base-menu-item__icon").exists()).toBe(true);
        expect(wrapper.find(".test-icon").exists()).toBe(true);
        expect(wrapper.find(".base-menu-item__content").text()).toBe("带图标的菜单项");
    });

    it("没有图标时不应该渲染图标容器", () => {
        const wrapper = mount(BaseMenuItem, {
            slots: {
                default: "无图标菜单项",
            },
        });

        expect(wrapper.find(".base-menu-item__icon").exists()).toBe(false);
        expect(wrapper.find(".base-menu-item__content").text()).toBe("无图标菜单项");
    });

    it("应该正确处理默认属性值", () => {
        const wrapper = mount(BaseMenuItem, {
            slots: {
                default: "默认菜单项",
            },
        });

        // 通过组件行为验证默认属性值，而不是直接访问内部状态
        expect(wrapper.classes()).not.toContain("base-menu-item--disabled");
        expect(wrapper.classes()).not.toContain("base-menu-item--danger");
        expect(wrapper.find(".base-menu-item__icon").exists()).toBe(false);
    });

    it("应该正确响应属性变化", async () => {
        const wrapper = mount(BaseMenuItem, {
            props: {
                disabled: false,
                danger: false,
            },
            slots: {
                default: "可变状态菜单项",
            },
        });

        // 初始状态
        expect(wrapper.classes()).not.toContain("base-menu-item--disabled");
        expect(wrapper.classes()).not.toContain("base-menu-item--danger");

        // 更新props
        await wrapper.setProps({ disabled: true, danger: true });

        // 检查更新后的状态
        expect(wrapper.classes()).toContain("base-menu-item--disabled");
        expect(wrapper.classes()).toContain("base-menu-item--danger");
    });

    it("应该正确处理复杂的slot内容", () => {
        const wrapper = mount(BaseMenuItem, {
            slots: {
                default: '<span class="custom-content">复杂<b>内容</b></span>',
            },
        });

        const contentElement = wrapper.find(".base-menu-item__content");
        expect(contentElement.find(".custom-content").exists()).toBe(true);
        expect(contentElement.find("b").text()).toBe("内容");
    });

    it("应该正确处理事件回调", async () => {
        const wrapper = mount(BaseMenuItem, {
            slots: {
                default: "测试事件",
            },
        });

        // 触发点击事件
        await wrapper.find(".base-menu-item").trigger("click");

        // 验证事件被触发且包含事件对象
        expect(wrapper.emitted("click")).toBeTruthy();
        expect(wrapper.emitted("click")).toHaveLength(1);
        expect(wrapper.emitted("click")?.[0]).toHaveLength(1);
    });

    it("应该正确处理多次点击", async () => {
        const wrapper = mount(BaseMenuItem, {
            slots: {
                default: "多次点击测试",
            },
        });

        // 多次触发点击事件
        await wrapper.find(".base-menu-item").trigger("click");
        await wrapper.find(".base-menu-item").trigger("click");
        await wrapper.find(".base-menu-item").trigger("click");

        // 验证所有点击都被正确处理
        expect(wrapper.emitted("click")).toBeTruthy();
        expect(wrapper.emitted("click")).toHaveLength(3);
    });
});

import { describe, it, expect, vi } from "vitest";
import { mount } from "@vue/test-utils";
import BaseMenuItem from "../BaseMenuItem.vue";

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

describe("BaseMenuItem", () => {
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
        const clickHandler = vi.fn();
        const wrapper = mount(BaseMenuItem, {
            props: {
                onClick: clickHandler,
            },
            slots: {
                default: "点击我",
            },
        });

        await wrapper.find(".base-menu-item").trigger("click");

        expect(clickHandler).toHaveBeenCalledTimes(1);
        expect(clickHandler).toHaveBeenCalledWith(expect.any(Object));
    });

    it("disabled状态下不应该触发click事件", async () => {
        const clickHandler = vi.fn();
        const wrapper = mount(BaseMenuItem, {
            props: {
                disabled: true,
                onClick: clickHandler,
            },
            slots: {
                default: "禁用的菜单项",
            },
        });

        expect(wrapper.classes()).toContain("base-menu-item--disabled");

        await wrapper.find(".base-menu-item").trigger("click");

        expect(clickHandler).not.toHaveBeenCalled();
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
        // 创建一个简单的图标组件mock
        const IconComponent = {
            name: "TestIcon",
            template: '<div class="test-icon">图标</div>',
        };

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

        expect(wrapper.vm.disabled).toBe(false);
        expect(wrapper.vm.danger).toBe(false);
        expect(wrapper.vm.icon).toBeUndefined();
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

    it("事件处理应该传递正确的event对象", async () => {
        const clickHandler = vi.fn();
        const wrapper = mount(BaseMenuItem, {
            props: {
                onClick: clickHandler,
            },
            slots: {
                default: "测试事件",
            },
        });

        // 通过DOM事件触发
        await wrapper.find(".base-menu-item").trigger("click");

        expect(clickHandler).toHaveBeenCalledTimes(1);
        expect(clickHandler).toHaveBeenCalledWith(expect.any(Object));
    });

    it("在disabled状态下不应该触发click事件", async () => {
        const clickHandler = vi.fn();
        const wrapper = mount(BaseMenuItem, {
            props: {
                disabled: true,
                onClick: clickHandler,
            },
            slots: {
                default: "禁用测试",
            },
        });

        await wrapper.find(".base-menu-item").trigger("click");

        expect(clickHandler).not.toHaveBeenCalled();
    });
});

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mount } from "@vue/test-utils";
import { nextTick } from "vue";
import BaseContextMenu from "../BaseContextMenu.vue";
import { onClickOutside } from "@vueuse/core";

// Mock VueUse onClickOutside - but only the behavior, not the implementation
vi.mock("@vueuse/core", () => ({
    onClickOutside: vi.fn(),
}));

describe("BaseContextMenu", () => {
    let wrapper: any;

    beforeEach(() => {
        // Reset VueUse mock
        vi.mocked(onClickOutside).mockClear();
    });

    afterEach(() => {
        if (wrapper) {
            wrapper.unmount();
        }

        // 清理Teleport创建的DOM元素
        const overlay = document.body.querySelector(".base-context-menu-overlay");
        if (overlay) {
            overlay.remove();
        }

        vi.clearAllMocks();
    });

    it("应该正确渲染触发元素", () => {
        wrapper = mount(BaseContextMenu, {
            slots: {
                default: '<div class="trigger">右键点击我</div>',
            },
        });

        expect(wrapper.find(".trigger").exists()).toBe(true);
        expect(wrapper.find(".base-context-menu").exists()).toBe(true);
    });

    it("初始状态菜单应该是关闭的", () => {
        wrapper = mount(BaseContextMenu, {
            slots: {
                default: '<div class="trigger">右键点击我</div>',
            },
        });

        // 测试初始状态 - 通过组件的响应式数据验证
        expect(wrapper.vm.isOpen).toBe(false);
        expect(document.body.querySelector(".base-context-menu-overlay")).toBeFalsy();
    });

    it("通过组件API打开菜单应该正确设置状态", async () => {
        const onOpenSpy = vi.fn();
        wrapper = mount(BaseContextMenu, {
            props: {
                onOpen: onOpenSpy,
            },
            slots: {
                default: '<div class="trigger">右键点击我</div>',
                menu: '<div class="menu-content">菜单内容</div>',
            },
        });

        // 直接调用组件的open方法，提供完整的事件对象
        const testPosition = {
            clientX: 100,
            clientY: 200,
            preventDefault: vi.fn(),
            stopPropagation: vi.fn(),
        };
        wrapper.vm.open(testPosition);
        await nextTick();

        // 验证组件状态
        expect(wrapper.vm.isOpen).toBe(true);
        expect(wrapper.vm.position.x).toBe(100);
        expect(wrapper.vm.position.y).toBe(200);

        // 验证DOM结构 - 由于使用了Teleport，需要在document.body中查找
        expect(document.body.querySelector(".base-context-menu-overlay")).toBeTruthy();

        // 验证回调
        expect(onOpenSpy).toHaveBeenCalled();
    });

    it("菜单打开时应该显示在正确位置", async () => {
        wrapper = mount(BaseContextMenu, {
            slots: {
                default: '<div class="trigger">右键点击我</div>',
                menu: '<div class="menu-content">菜单内容</div>',
            },
        });

        // 使用组件API设置特定位置
        const testPosition = {
            clientX: 150,
            clientY: 250,
            preventDefault: vi.fn(),
            stopPropagation: vi.fn(),
        };
        wrapper.vm.open(testPosition);
        await nextTick();

        expect(wrapper.vm.isOpen).toBe(true);
        expect(wrapper.vm.positionStyle).toEqual({
            position: "fixed",
            top: "250px",
            left: "150px",
            zIndex: 1050,
        });

        // 验证实际DOM样式 - 由于使用了Teleport，在document.body中查找
        const overlay = document.body.querySelector(".base-context-menu-overlay") as HTMLElement;
        expect(overlay).toBeTruthy();

        if (overlay) {
            const style = overlay.style;
            expect(style.position).toBe("fixed");
            expect(style.top).toBe("250px");
            expect(style.left).toBe("150px");
        }
    });

    it("disabled属性为true时不应该打开菜单", async () => {
        wrapper = mount(BaseContextMenu, {
            props: {
                disabled: true,
            },
            slots: {
                default: '<div class="trigger">右键点击我</div>',
            },
        });

        // 尝试通过API打开菜单
        const testPosition = {
            clientX: 100,
            clientY: 200,
            preventDefault: vi.fn(),
            stopPropagation: vi.fn(),
        };
        wrapper.vm.open(testPosition);
        await nextTick();

        // 验证菜单保持关闭状态
        expect(wrapper.vm.isOpen).toBe(false);
        expect(document.body.querySelector(".base-context-menu-overlay")).toBeFalsy();
    });

    it("close方法应该关闭菜单", async () => {
        const onCloseSpy = vi.fn();
        wrapper = mount(BaseContextMenu, {
            props: {
                onClose: onCloseSpy,
            },
            slots: {
                default: '<div class="trigger">右键点击我</div>',
                menu: '<div class="menu-content">菜单内容</div>',
            },
        });

        // 先打开菜单
        wrapper.vm.open({
            clientX: 100,
            clientY: 200,
            preventDefault: vi.fn(),
            stopPropagation: vi.fn(),
        });
        await nextTick();
        expect(wrapper.vm.isOpen).toBe(true);

        // 然后关闭菜单
        wrapper.vm.close();
        await nextTick();

        expect(wrapper.vm.isOpen).toBe(false);
        expect(document.body.querySelector(".base-context-menu-overlay")).toBeFalsy();
        expect(onCloseSpy).toHaveBeenCalled();
    });

    it("应该正确配置onClickOutside", () => {
        wrapper = mount(BaseContextMenu, {
            slots: {
                default: '<div class="trigger">右键点击我</div>',
            },
        });

        // 验证onClickOutside被正确调用
        expect(onClickOutside).toHaveBeenCalled();

        // 获取传递给onClickOutside的回调函数
        const onClickOutsideCall = vi.mocked(onClickOutside).mock.calls[0];
        expect(onClickOutsideCall).toBeDefined();
        expect(typeof onClickOutsideCall[1]).toBe("function"); // 应该传递一个函数作为回调
    });

    it("应该响应VueUse onClickOutside回调", async () => {
        wrapper = mount(BaseContextMenu, {
            slots: {
                default: '<div class="trigger">右键点击我</div>',
                menu: '<div class="menu-content">菜单内容</div>',
            },
        });

        // 先打开菜单
        wrapper.vm.open({
            clientX: 100,
            clientY: 200,
            preventDefault: vi.fn(),
            stopPropagation: vi.fn(),
        });
        await nextTick();
        expect(wrapper.vm.isOpen).toBe(true);

        // 获取并调用onClickOutside的回调函数
        const onClickOutsideCallback = vi.mocked(onClickOutside).mock.calls[0][1];
        if (onClickOutsideCallback) {
            onClickOutsideCallback({} as PointerEvent);
        }
        await nextTick();

        // 验证菜单被关闭
        expect(wrapper.vm.isOpen).toBe(false);
    });

    it("应该提供正确的slot props给menu slot", async () => {
        wrapper = mount(BaseContextMenu, {
            slots: {
                default: '<div class="trigger">右键点击我</div>',
                menu: '<div class="menu-content"><button class="close-btn">关闭</button></div>',
            },
        });

        // 打开菜单
        wrapper.vm.open({
            clientX: 100,
            clientY: 200,
            preventDefault: vi.fn(),
            stopPropagation: vi.fn(),
        });
        await nextTick();

        expect(wrapper.vm.isOpen).toBe(true);

        // 验证菜单内容已渲染 - 由于使用了Teleport，在document.body中查找
        expect(document.body.querySelector(".menu-content")).toBeTruthy();
        expect(document.body.querySelector(".close-btn")).toBeTruthy();
    });

    it("应该正确处理contextmenu事件处理函数", async () => {
        wrapper = mount(BaseContextMenu, {
            slots: {
                default: '<div class="trigger">右键点击我</div>',
                menu: '<div class="menu-content">菜单内容</div>',
            },
        });

        // 验证组件有handleContextMenu方法
        expect(typeof wrapper.vm.handleContextMenu).toBe("function");

        // 直接调用事件处理函数
        const mockContextMenuEvent = {
            preventDefault: vi.fn(),
            stopPropagation: vi.fn(),
            clientX: 120,
            clientY: 220,
        };

        wrapper.vm.handleContextMenu(mockContextMenuEvent);
        await nextTick();

        // 验证事件被正确处理
        expect(mockContextMenuEvent.preventDefault).toHaveBeenCalled();
        expect(mockContextMenuEvent.stopPropagation).toHaveBeenCalled();
        expect(wrapper.vm.isOpen).toBe(true);
        expect(wrapper.vm.position.x).toBe(120);
        expect(wrapper.vm.position.y).toBe(220);
    });

    it("应该在disabled状态下不响应contextmenu事件", async () => {
        wrapper = mount(BaseContextMenu, {
            props: {
                disabled: true,
            },
            slots: {
                default: '<div class="trigger">右键点击我</div>',
            },
        });

        // 模拟contextmenu事件
        const mockContextMenuEvent = {
            preventDefault: vi.fn(),
            stopPropagation: vi.fn(),
            clientX: 120,
            clientY: 220,
        };

        wrapper.vm.handleContextMenu(mockContextMenuEvent);
        await nextTick();

        // 验证在disabled状态下不处理事件
        expect(wrapper.vm.isOpen).toBe(false);
        // 在disabled状态下，可能不会调用preventDefault
    });
});

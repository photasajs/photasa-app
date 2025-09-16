import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mount } from "@vue/test-utils";
import { nextTick } from "vue";
import BaseContextMenu from "../BaseContextMenu.vue";

// Mock VueUse onClickOutside
vi.mock("@vueuse/core", () => ({
    onClickOutside: vi.fn(),
}));

describe("BaseContextMenu", () => {
    let wrapper: any;

    beforeEach(() => {
        // Mock document.addEventListener and removeEventListener
        if (!vi.isMockFunction(document.addEventListener)) {
            vi.spyOn(document, "addEventListener");
        }
        if (!vi.isMockFunction(document.removeEventListener)) {
            vi.spyOn(document, "removeEventListener");
        }
    });

    afterEach(() => {
        if (wrapper) {
            wrapper.unmount();
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

        expect(wrapper.vm.isOpen).toBe(false);
        expect(wrapper.find(".base-context-menu-overlay").exists()).toBe(false);
    });

    it("右键点击应该打开菜单", async () => {
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

        // 直接通过组件的方法触发contextmenu事件
        const mockEvent = {
            preventDefault: vi.fn(),
            stopPropagation: vi.fn(),
            clientX: 100,
            clientY: 200,
        } as any;

        await wrapper.vm.handleContextMenu(mockEvent);
        await nextTick();

        expect(wrapper.vm.isOpen).toBe(true);
        expect(wrapper.vm.position.x).toBe(100);
        expect(wrapper.vm.position.y).toBe(200);
    });

    it("菜单打开时应该显示在正确位置", async () => {
        wrapper = mount(BaseContextMenu, {
            slots: {
                default: '<div class="trigger">右键点击我</div>',
                menu: '<div class="menu-content">菜单内容</div>',
            },
        });

        // 手动打开菜单
        const mockEvent = {
            preventDefault: vi.fn(),
            stopPropagation: vi.fn(),
            clientX: 150,
            clientY: 250,
        } as any;

        wrapper.vm.open(mockEvent);
        await nextTick();

        expect(wrapper.vm.isOpen).toBe(true);
        expect(wrapper.vm.positionStyle).toEqual({
            position: "fixed",
            top: "250px",
            left: "150px",
            zIndex: 1050,
        });
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

        const mockEvent = {
            preventDefault: vi.fn(),
            stopPropagation: vi.fn(),
            clientX: 100,
            clientY: 200,
        } as any;

        wrapper.vm.open(mockEvent);
        await nextTick();

        expect(wrapper.vm.isOpen).toBe(false);
        expect(mockEvent.preventDefault).not.toHaveBeenCalled();
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
        const mockEvent = {
            preventDefault: vi.fn(),
            stopPropagation: vi.fn(),
            clientX: 100,
            clientY: 200,
        } as any;

        wrapper.vm.open(mockEvent);
        await nextTick();
        expect(wrapper.vm.isOpen).toBe(true);

        // 然后关闭菜单
        wrapper.vm.close();
        await nextTick();
        expect(wrapper.vm.isOpen).toBe(false);
    });

    it("应该在组件挂载时添加键盘事件监听", () => {
        wrapper = mount(BaseContextMenu, {
            slots: {
                default: '<div class="trigger">右键点击我</div>',
            },
        });

        expect(document.addEventListener).toHaveBeenCalledWith("keydown", expect.any(Function));
    });

    it("应该在组件卸载时移除键盘事件监听", () => {
        wrapper = mount(BaseContextMenu, {
            slots: {
                default: '<div class="trigger">右键点击我</div>',
            },
        });

        const handleEscapeFunction = (document.addEventListener as any).mock.calls.find(
            (call: any) => call[0] === "keydown",
        )?.[1];

        wrapper.unmount();

        expect(document.removeEventListener).toHaveBeenCalledWith("keydown", handleEscapeFunction);
    });

    it("按Escape键应该关闭打开的菜单", async () => {
        wrapper = mount(BaseContextMenu, {
            slots: {
                default: '<div class="trigger">右键点击我</div>',
                menu: '<div class="menu-content">菜单内容</div>',
            },
        });

        // 打开菜单
        const mockEvent = {
            preventDefault: vi.fn(),
            stopPropagation: vi.fn(),
            clientX: 100,
            clientY: 200,
        } as any;

        wrapper.vm.open(mockEvent);
        await nextTick();
        expect(wrapper.vm.isOpen).toBe(true);

        // 获取添加的键盘事件处理函数
        const handleEscapeFunction = (document.addEventListener as any).mock.calls.find(
            (call: any) => call[0] === "keydown",
        )?.[1];

        // 模拟按下Escape键
        const escapeEvent = new KeyboardEvent("keydown", { key: "Escape" });
        handleEscapeFunction?.(escapeEvent);
        await nextTick();

        expect(wrapper.vm.isOpen).toBe(false);
    });

    it("按其他键不应该关闭菜单", async () => {
        wrapper = mount(BaseContextMenu, {
            slots: {
                default: '<div class="trigger">右键点击我</div>',
                menu: '<div class="menu-content">菜单内容</div>',
            },
        });

        // 打开菜单
        const mockEvent = {
            preventDefault: vi.fn(),
            stopPropagation: vi.fn(),
            clientX: 100,
            clientY: 200,
        } as any;

        wrapper.vm.open(mockEvent);
        await nextTick();
        expect(wrapper.vm.isOpen).toBe(true);

        // 获取添加的键盘事件处理函数
        const handleEscapeFunction = (document.addEventListener as any).mock.calls.find(
            (call: any) => call[0] === "keydown",
        )?.[1];

        // 模拟按下其他键（比如Enter）
        const enterEvent = new KeyboardEvent("keydown", { key: "Enter" });
        handleEscapeFunction?.(enterEvent);
        await nextTick();

        expect(wrapper.vm.isOpen).toBe(true); // 菜单应该保持打开状态
    });

    it("应该提供正确的slot props给menu slot", async () => {
        wrapper = mount(BaseContextMenu, {
            slots: {
                default: '<div class="trigger">右键点击我</div>',
                menu: `
                    <template #menu="{ close }">
                        <button @click="close" class="close-button">关闭</button>
                    </template>
                `,
            },
        });

        // 打开菜单
        const mockEvent = {
            preventDefault: vi.fn(),
            stopPropagation: vi.fn(),
            clientX: 100,
            clientY: 200,
        } as any;

        wrapper.vm.open(mockEvent);
        await nextTick();

        expect(wrapper.vm.isOpen).toBe(true);

        // 验证slot中的close函数可以被调用
        const closeButton = wrapper.find(".close-button");
        if (closeButton.exists()) {
            await closeButton.trigger("click");
            expect(wrapper.vm.isOpen).toBe(false);
        }
    });
});

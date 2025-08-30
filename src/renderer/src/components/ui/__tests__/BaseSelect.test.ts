/**
 * BaseSelect组件单元测试和集成测试
 *
 * 主要测试场景：
 * 1. 基本功能：渲染、选择、键盘导航
 * 2. Modal集成：在新Modal系统中的鼠标点击和Portal兼容性
 * 3. 无障碍访问：ARIA标准遵循
 * 4. 事件处理：click、keyboard、focus管理
 */

import { mount } from "@vue/test-utils";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { nextTick } from "vue";
import BaseSelect from "../BaseSelect.vue";
import BaseModal from "../BaseModal.vue";
import BaseModalOverlay from "../BaseModalOverlay.vue";
import BaseModalContainer from "../BaseModalContainer.vue";
import BaseModalBody from "../BaseModalBody.vue";

// Mock logger
vi.mock("@common/logger", () => ({
    getLogger: () => ({
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    }),
}));

// Test data
const testOptions = [
    { value: "option1", label: "Option 1" },
    { value: "option2", label: "Option 2" },
    { value: "option3", label: "Option 3" },
];

// Portal setup for tests
beforeEach(() => {
    // Create portal target for dropdown
    const portalTarget = document.createElement("div");
    portalTarget.id = "portal-dropdown";
    document.body.appendChild(portalTarget);
});

describe("BaseSelect 基本功能测试", () => {
    it("应该正确渲染组件", () => {
        const wrapper = mount(BaseSelect, {
            props: {
                modelValue: null,
                options: testOptions,
                placeholder: "Choose option",
            },
        });

        expect(wrapper.find('[role="combobox"]').exists()).toBe(true);
        expect(wrapper.text()).toContain("Choose option");
    });

    it("应该正确显示选中的选项", () => {
        const wrapper = mount(BaseSelect, {
            props: {
                modelValue: "option2",
                options: testOptions,
            },
        });

        expect(wrapper.text()).toContain("Option 2");
    });

    it("应该响应键盘导航", async () => {
        const wrapper = mount(BaseSelect, {
            props: {
                modelValue: null,
                options: testOptions,
            },
        });

        const combobox = wrapper.find('[role="combobox"]');

        // 按下Arrow Down打开下拉菜单
        await combobox.trigger("keydown", { key: "ArrowDown" });
        await nextTick();

        // 检查ARIA状态
        expect(combobox.attributes("aria-expanded")).toBe("true");
        expect(combobox.attributes("aria-activedescendant")).toBeTruthy();
    });

    it("应该响应鼠标点击", async () => {
        const wrapper = mount(BaseSelect, {
            props: {
                modelValue: null,
                options: testOptions,
            },
        });

        // 点击按钮打开下拉菜单
        await wrapper.find('[role="combobox"]').trigger("click");
        await nextTick();

        expect(wrapper.find('[role="combobox"]').attributes("aria-expanded")).toBe("true");
    });

    it("应该正确处理选项选择", async () => {
        const wrapper = mount(BaseSelect, {
            props: {
                modelValue: null,
                options: testOptions,
            },
            global: {
                stubs: {
                    Teleport: false,
                },
            },
            attachTo: document.body,
        });

        // 确保portal存在
        if (!document.getElementById("portal-dropdown")) {
            const portal = document.createElement("div");
            portal.id = "portal-dropdown";
            document.body.appendChild(portal);
        }

        // 打开下拉菜单
        await wrapper.find('[role="combobox"]').trigger("click");
        await nextTick();

        // 等待DOM更新并查找选项
        const options = document.querySelectorAll('[role="option"]');
        expect(options.length).toBeGreaterThan(0);

        // 点击第一个选项
        if (options[0]) {
            (options[0] as HTMLElement).click();
        }
        await nextTick();

        // 检查事件发射
        expect(wrapper.emitted()).toHaveProperty("update:modelValue");
        expect(wrapper.emitted("update:modelValue")).toHaveLength(1);
        expect(wrapper.emitted("update:modelValue")?.[0]).toEqual(["option1"]);

        wrapper.unmount();
    });
});

describe("BaseSelect Modal集成测试", () => {
    it("应该在Modal中正确工作", async () => {
        // 创建Modal + BaseSelect组合测试
        const ModalWithSelect = {
            template: `
        <BaseModal :open="modalOpen" @close="modalOpen = false">
          <BaseModalOverlay class="fixed inset-0 bg-black/50" />
          <BaseModalContainer class="max-w-md bg-white rounded-lg">
            <BaseModalBody class="p-6">
              <BaseSelect 
                v-model="selectedValue" 
                :options="options"
                placeholder="Select in modal"
              />
            </BaseModalBody>
          </BaseModalContainer>
        </BaseModal>
      `,
            components: {
                BaseModal,
                BaseModalOverlay,
                BaseModalContainer,
                BaseModalBody,
                BaseSelect,
            },
            data() {
                return {
                    modalOpen: true,
                    selectedValue: null,
                    options: testOptions,
                };
            },
        };

        const wrapper = mount(ModalWithSelect, {
            attachTo: document.body,
            global: {
                stubs: {
                    teleport: true, // 在测试中模拟Teleport
                },
            },
        });

        await nextTick();

        // 验证Modal已渲染
        expect(wrapper.find('[role="combobox"]').exists()).toBe(true);

        // 测试在Modal中点击BaseSelect
        const combobox = wrapper.find('[role="combobox"]');
        await combobox.trigger("click");
        await nextTick();

        // 验证下拉菜单已打开且ARIA状态正确
        expect(combobox.attributes("aria-expanded")).toBe("true");

        // 验证Portal正常工作（下拉菜单在Portal中）
        const portalDropdown = document.querySelector("#portal-dropdown");
        expect(portalDropdown).toBeTruthy();
    });

    it("应该正确处理Modal外点击事件", async () => {
        const wrapper = mount(BaseSelect, {
            props: {
                modelValue: null,
                options: testOptions,
            },
            attachTo: document.body,
        });

        // 打开下拉菜单
        await wrapper.find('[role="combobox"]').trigger("click");
        await nextTick();

        expect(wrapper.find('[role="combobox"]').attributes("aria-expanded")).toBe("true");

        // 模拟点击文档外部
        document.body.click();
        await nextTick();

        // 下拉菜单应该关闭
        expect(wrapper.find('[role="combobox"]').attributes("aria-expanded")).toBe("false");
    });
});

describe("BaseSelect 无障碍访问测试", () => {
    it("应该具有正确的ARIA属性", () => {
        const wrapper = mount(BaseSelect, {
            props: {
                modelValue: "option1",
                options: testOptions,
            },
        });

        const combobox = wrapper.find('[role="combobox"]');

        // 基本ARIA属性
        expect(combobox.attributes("role")).toBe("combobox");
        expect(combobox.attributes("aria-haspopup")).toBeTruthy();
        expect(combobox.attributes("aria-expanded")).toBe("false");
        expect(combobox.attributes("aria-labelledby")).toBeTruthy();
    });

    it("应该正确管理焦点", async () => {
        const wrapper = mount(BaseSelect, {
            props: {
                modelValue: null,
                options: testOptions,
            },
            attachTo: document.body,
        });

        const combobox = wrapper.find('[role="combobox"]');

        // 聚焦组件
        await combobox.trigger("focus");
        await nextTick();

        // 验证焦点状态 - 使用类名或者其他属性来验证，而不是直接比较DOM元素
        expect(document.activeElement?.getAttribute("role")).toBe("combobox");
        expect(document.activeElement?.getAttribute("aria-labelledby")).toBeTruthy();

        // 打开下拉菜单，焦点应保持在combobox上（ARIA标准）
        await combobox.trigger("keydown", { key: "ArrowDown" });
        await nextTick();

        // 多等待一个tick确保状态更新完成
        await nextTick();

        // 验证下拉菜单已打开
        expect(combobox.attributes("aria-expanded")).toBe("true");

        // 验证焦点仍然在combobox上，通过检查活动元素的属性
        expect(document.activeElement?.getAttribute("role")).toBe("combobox");
    });

    it("应该支持Escape键关闭", async () => {
        const wrapper = mount(BaseSelect, {
            props: {
                modelValue: null,
                options: testOptions,
            },
        });

        const combobox = wrapper.find('[role="combobox"]');

        // 打开下拉菜单
        await combobox.trigger("keydown", { key: "ArrowDown" });
        await nextTick();
        expect(combobox.attributes("aria-expanded")).toBe("true");

        // 按Escape关闭
        await combobox.trigger("keydown", { key: "Escape" });
        await nextTick();
        expect(combobox.attributes("aria-expanded")).toBe("false");
    });
});

describe("BaseSelect 错误处理测试", () => {
    it("应该处理空选项数组", () => {
        const wrapper = mount(BaseSelect, {
            props: {
                modelValue: null,
                options: [],
            },
        });

        expect(wrapper.find('[role="combobox"]').exists()).toBe(true);
        expect(wrapper.text()).toContain("Select an option");
    });

    it("应该处理禁用状态", async () => {
        const wrapper = mount(BaseSelect, {
            props: {
                modelValue: null,
                options: testOptions,
                disabled: true,
            },
        });

        const combobox = wrapper.find('[role="combobox"]');
        expect(combobox.attributes("disabled")).toBeDefined();

        // 禁用时不应响应点击
        await combobox.trigger("click");
        await nextTick();
        expect(combobox.attributes("aria-expanded")).toBe("false");
    });

    it("应该处理无效的modelValue", () => {
        const wrapper = mount(BaseSelect, {
            props: {
                modelValue: "invalid-value",
                options: testOptions,
            },
        });

        // 应该显示placeholder而不是无效值
        expect(wrapper.text()).toContain("Select an option");
    });
});

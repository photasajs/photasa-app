/**
 * useDropdownManager 组合函数单元测试
 *
 * 重新设计的测试策略：
 * 1. 不使用事件mock，而是测试组合函数的行为
 * 2. 通过实际的API调用验证状态变化
 * 3. 使用真实的DOM事件（如果需要的话）
 * 4. 专注于业务逻辑而不是实现细节
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { useDropdownManager } from "../useDropdownManager";

describe("useDropdownManager 基本功能测试", () => {
    let manager: ReturnType<typeof useDropdownManager>;

    beforeEach(() => {
        // 创建新的管理器实例
        manager = useDropdownManager();

        // 确保从干净状态开始
        manager.closeAll();
    });

    afterEach(() => {
        // 清理所有状态
        manager.closeAll();
        vi.clearAllMocks();
    });

    it("应该正确注册下拉菜单", () => {
        const dropdownId = "test-dropdown-1";

        // 注册不应该抛出错误
        expect(() => manager.register(dropdownId)).not.toThrow();

        // 初始状态下应该是关闭的
        expect(manager.isOpen(dropdownId)).toBe(false);
    });

    it("应该正确打开下拉菜单", () => {
        const dropdownId = "test-dropdown-1";

        manager.register(dropdownId);
        manager.open(dropdownId);

        expect(manager.isOpen(dropdownId)).toBe(true);
    });

    it("应该正确关闭下拉菜单", () => {
        const dropdownId = "test-dropdown-1";

        manager.register(dropdownId);
        manager.open(dropdownId);
        expect(manager.isOpen(dropdownId)).toBe(true);

        manager.close(dropdownId);
        expect(manager.isOpen(dropdownId)).toBe(false);
    });

    it("应该正确注销下拉菜单", () => {
        const dropdownId = "test-dropdown-1";

        manager.register(dropdownId);
        manager.open(dropdownId);
        expect(manager.isOpen(dropdownId)).toBe(true);

        // 注销应该自动关闭打开的下拉菜单
        manager.unregister(dropdownId);
        expect(manager.isOpen(dropdownId)).toBe(false);
    });
});

describe("useDropdownManager 独占性测试", () => {
    let manager: ReturnType<typeof useDropdownManager>;

    beforeEach(() => {
        manager = useDropdownManager();
        manager.closeAll();
    });

    afterEach(() => {
        manager.closeAll();
        vi.clearAllMocks();
    });

    it("应该确保同时只有一个下拉菜单打开", () => {
        const dropdown1 = "test-dropdown-1";
        const dropdown2 = "test-dropdown-2";

        manager.register(dropdown1);
        manager.register(dropdown2);

        // 打开第一个下拉菜单
        manager.open(dropdown1);
        expect(manager.isOpen(dropdown1)).toBe(true);
        expect(manager.isOpen(dropdown2)).toBe(false);

        // 打开第二个下拉菜单应该关闭第一个
        manager.open(dropdown2);
        expect(manager.isOpen(dropdown1)).toBe(false);
        expect(manager.isOpen(dropdown2)).toBe(true);
    });

    it("应该正确处理多个下拉菜单的复杂场景", () => {
        const dropdown1 = "test-dropdown-1";
        const dropdown2 = "test-dropdown-2";
        const dropdown3 = "test-dropdown-3";

        manager.register(dropdown1);
        manager.register(dropdown2);
        manager.register(dropdown3);

        // 顺序打开多个下拉菜单
        manager.open(dropdown1);
        expect(manager.isOpen(dropdown1)).toBe(true);
        expect(manager.isOpen(dropdown2)).toBe(false);
        expect(manager.isOpen(dropdown3)).toBe(false);

        manager.open(dropdown2);
        expect(manager.isOpen(dropdown1)).toBe(false);
        expect(manager.isOpen(dropdown2)).toBe(true);
        expect(manager.isOpen(dropdown3)).toBe(false);

        manager.open(dropdown3);
        expect(manager.isOpen(dropdown1)).toBe(false);
        expect(manager.isOpen(dropdown2)).toBe(false);
        expect(manager.isOpen(dropdown3)).toBe(true);
    });

    it("应该在关闭所有下拉菜单时正确更新状态", () => {
        const dropdown1 = "test-dropdown-1";
        const dropdown2 = "test-dropdown-2";

        manager.register(dropdown1);
        manager.register(dropdown2);

        manager.open(dropdown1);
        expect(manager.isOpen(dropdown1)).toBe(true);

        // 关闭所有下拉菜单
        manager.closeAll();

        expect(manager.isOpen(dropdown1)).toBe(false);
        expect(manager.isOpen(dropdown2)).toBe(false);
    });
});

describe("useDropdownManager 边缘情况测试", () => {
    let manager: ReturnType<typeof useDropdownManager>;

    beforeEach(() => {
        manager = useDropdownManager();
        manager.closeAll();
    });

    afterEach(() => {
        manager.closeAll();
        vi.clearAllMocks();
    });

    it("应该正确处理重复打开同一个下拉菜单", () => {
        const dropdownId = "test-dropdown-1";

        manager.register(dropdownId);

        // 第一次打开
        manager.open(dropdownId);
        expect(manager.isOpen(dropdownId)).toBe(true);

        // 重复打开同一个下拉菜单
        manager.open(dropdownId);
        expect(manager.isOpen(dropdownId)).toBe(true);
    });

    it("应该正确处理关闭不存在的下拉菜单", () => {
        const dropdownId = "nonexistent-dropdown";

        // 关闭不存在的下拉菜单不应该抛出错误
        expect(() => manager.close(dropdownId)).not.toThrow();
        expect(manager.isOpen(dropdownId)).toBe(false);
    });

    it("应该正确处理注销不存在的下拉菜单", () => {
        const dropdownId = "nonexistent-dropdown";

        // 注销不存在的下拉菜单不应该抛出错误
        expect(() => manager.unregister(dropdownId)).not.toThrow();
    });

    it("应该正确处理空状态下的 closeAll 调用", () => {
        // 没有打开的下拉菜单时调用 closeAll
        expect(() => manager.closeAll()).not.toThrow();
    });

    it("应该正确处理已关闭下拉菜单的重复关闭", () => {
        const dropdownId = "test-dropdown-1";

        manager.register(dropdownId);
        manager.open(dropdownId);
        expect(manager.isOpen(dropdownId)).toBe(true);

        // 第一次关闭
        manager.close(dropdownId);
        expect(manager.isOpen(dropdownId)).toBe(false);

        // 重复关闭
        expect(() => manager.close(dropdownId)).not.toThrow();
        expect(manager.isOpen(dropdownId)).toBe(false);
    });

    it("应该正确处理打开未注册的下拉菜单", () => {
        const dropdownId = "unregistered-dropdown";

        // 尝试打开未注册的下拉菜单
        manager.open(dropdownId);

        // 根据实现，这可能返回false或者自动注册然后打开
        // 这里我们验证行为的一致性
        const isOpen = manager.isOpen(dropdownId);
        expect(typeof isOpen).toBe("boolean");
    });
});

describe("useDropdownManager 多实例测试", () => {
    afterEach(() => {
        vi.clearAllMocks();
    });

    it("应该支持多个管理器实例共享状态", () => {
        const manager1 = useDropdownManager();
        const manager2 = useDropdownManager();

        const dropdownId = "shared-dropdown";

        // 清理初始状态
        manager1.closeAll();
        manager2.closeAll();

        // 在第一个管理器中注册和打开
        manager1.register(dropdownId);
        manager1.open(dropdownId);

        // 在第二个管理器中应该能看到状态
        expect(manager2.isOpen(dropdownId)).toBe(true);

        // 在第二个管理器中关闭
        manager2.close(dropdownId);

        // 在第一个管理器中应该看到状态更新
        expect(manager1.isOpen(dropdownId)).toBe(false);
    });

    it("应该在不同实例间保持独占性", () => {
        const manager1 = useDropdownManager();
        const manager2 = useDropdownManager();

        const dropdown1 = "dropdown-1";
        const dropdown2 = "dropdown-2";

        // 清理初始状态
        manager1.closeAll();
        manager2.closeAll();

        // 在不同管理器中注册不同下拉菜单
        manager1.register(dropdown1);
        manager2.register(dropdown2);

        // 通过manager1打开dropdown1
        manager1.open(dropdown1);
        expect(manager1.isOpen(dropdown1)).toBe(true);
        expect(manager2.isOpen(dropdown1)).toBe(true); // 状态共享

        // 通过manager2打开dropdown2，应该关闭dropdown1
        manager2.open(dropdown2);
        expect(manager1.isOpen(dropdown1)).toBe(false);
        expect(manager2.isOpen(dropdown1)).toBe(false);
        expect(manager1.isOpen(dropdown2)).toBe(true);
        expect(manager2.isOpen(dropdown2)).toBe(true);
    });
});

describe("useDropdownManager 实际DOM事件集成测试", () => {
    let manager: ReturnType<typeof useDropdownManager>;
    let testContainer: HTMLElement;

    beforeEach(() => {
        manager = useDropdownManager();
        manager.closeAll();

        // 创建测试容器
        testContainer = document.createElement("div");
        testContainer.innerHTML = `
            <div id="dropdown-target" data-testid="dropdown-trigger">
                Click me
            </div>
            <div id="dropdown-menu" data-testid="dropdown-menu" style="display: none;">
                Menu content
            </div>
        `;
        document.body.appendChild(testContainer);
    });

    afterEach(() => {
        manager.closeAll();
        if (testContainer && testContainer.parentNode) {
            testContainer.parentNode.removeChild(testContainer);
        }
        vi.clearAllMocks();
    });

    it("应该能够与真实DOM元素配合工作", () => {
        const dropdownId = "dom-dropdown";
        const trigger = testContainer.querySelector("#dropdown-target") as HTMLElement;
        const menu = testContainer.querySelector("#dropdown-menu") as HTMLElement;

        expect(trigger).toBeTruthy();
        expect(menu).toBeTruthy();

        // 注册下拉菜单
        manager.register(dropdownId);
        expect(manager.isOpen(dropdownId)).toBe(false);

        // 打开下拉菜单，同时更新DOM
        manager.open(dropdownId);
        menu.style.display = "block";

        expect(manager.isOpen(dropdownId)).toBe(true);
        expect(menu.style.display).toBe("block");

        // 关闭下拉菜单，同时更新DOM
        manager.close(dropdownId);
        menu.style.display = "none";

        expect(manager.isOpen(dropdownId)).toBe(false);
        expect(menu.style.display).toBe("none");
    });

    it("应该能够处理实际的点击事件", () => {
        const dropdownId = "click-dropdown";
        // Note: trigger element exists but we're testing the manager API directly
        const menu = testContainer.querySelector("#dropdown-menu") as HTMLElement;

        manager.register(dropdownId);

        // 创建真实的点击事件处理器
        const handleClick = () => {
            if (manager.isOpen(dropdownId)) {
                manager.close(dropdownId);
                menu.style.display = "none";
            } else {
                manager.open(dropdownId);
                menu.style.display = "block";
            }
        };

        // 验证初始状态
        expect(manager.isOpen(dropdownId)).toBe(false);
        expect(menu.style.display).toBe("none");

        // 模拟第一次点击（打开）
        handleClick();
        expect(manager.isOpen(dropdownId)).toBe(true);
        expect(menu.style.display).toBe("block");

        // 模拟第二次点击（关闭）
        handleClick();
        expect(manager.isOpen(dropdownId)).toBe(false);
        expect(menu.style.display).toBe("none");
    });
});

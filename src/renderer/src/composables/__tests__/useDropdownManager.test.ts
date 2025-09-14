/**
 * useDropdownManager 组合函数单元测试
 * 
 * 主要测试场景：
 * 1. 基本功能：注册、注销、打开、关闭下拉菜单
 * 2. 独占性：确保同时只有一个下拉菜单打开
 * 3. 事件系统：验证全局关闭事件的正确触发
 * 4. 状态管理：验证内部状态的正确性
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useDropdownManager } from '../useDropdownManager';

// Mock document event handling
const mockEventListeners: Map<string, EventListener[]> = new Map();

const mockAddEventListener = vi.fn((event: string, listener: EventListener) => {
  if (!mockEventListeners.has(event)) {
    mockEventListeners.set(event, []);
  }
  mockEventListeners.get(event)!.push(listener);
});

const mockRemoveEventListener = vi.fn();
const mockDispatchEvent = vi.fn((event: CustomEvent) => {
  const listeners = mockEventListeners.get(event.type) || [];
  listeners.forEach(listener => listener(event));
  return true;
});

// Setup document mock
Object.defineProperty(document, 'addEventListener', { value: mockAddEventListener });
Object.defineProperty(document, 'removeEventListener', { value: mockRemoveEventListener });
Object.defineProperty(document, 'dispatchEvent', { value: mockDispatchEvent });

describe('useDropdownManager 基本功能测试', () => {
  let manager: ReturnType<typeof useDropdownManager>;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();
    mockEventListeners.clear();
    
    // Create fresh manager instance
    manager = useDropdownManager();
    
    // Close all dropdowns to start with a clean state
    manager.closeAll();
    
    // Clear the dispatch event call from closeAll if any
    mockDispatchEvent.mockClear();
  });

  it('应该正确注册下拉菜单', () => {
    const dropdownId = 'test-dropdown-1';
    
    // 注册不应该抛出错误
    expect(() => manager.register(dropdownId)).not.toThrow();
    
    // 初始状态下应该是关闭的
    expect(manager.isOpen(dropdownId)).toBe(false);
  });

  it('应该正确打开下拉菜单', () => {
    const dropdownId = 'test-dropdown-1';
    
    manager.register(dropdownId);
    manager.open(dropdownId);
    
    expect(manager.isOpen(dropdownId)).toBe(true);
  });

  it('应该正确关闭下拉菜单', () => {
    const dropdownId = 'test-dropdown-1';
    
    manager.register(dropdownId);
    manager.open(dropdownId);
    expect(manager.isOpen(dropdownId)).toBe(true);
    
    manager.close(dropdownId);
    expect(manager.isOpen(dropdownId)).toBe(false);
  });

  it('应该正确注销下拉菜单', () => {
    const dropdownId = 'test-dropdown-1';
    
    manager.register(dropdownId);
    manager.open(dropdownId);
    expect(manager.isOpen(dropdownId)).toBe(true);
    
    // 注销应该自动关闭打开的下拉菜单
    manager.unregister(dropdownId);
    expect(manager.isOpen(dropdownId)).toBe(false);
  });
});

describe('useDropdownManager 独占性测试', () => {
  let manager: ReturnType<typeof useDropdownManager>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockEventListeners.clear();
    manager = useDropdownManager();
    
    // Close all dropdowns to start with a clean state
    manager.closeAll();
    
    // Clear the dispatch event call from closeAll if any
    mockDispatchEvent.mockClear();
  });

  it('应该确保同时只有一个下拉菜单打开', () => {
    const dropdown1 = 'test-dropdown-1';
    const dropdown2 = 'test-dropdown-2';
    
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

  it('应该在打开新下拉菜单时触发关闭事件', () => {
    const dropdown1 = 'test-dropdown-1';
    const dropdown2 = 'test-dropdown-2';
    
    manager.register(dropdown1);
    manager.register(dropdown2);
    
    // 打开第一个下拉菜单
    manager.open(dropdown1);
    expect(mockDispatchEvent).toHaveBeenCalledTimes(0);
    
    // 打开第二个下拉菜单应该触发关闭事件
    manager.open(dropdown2);
    
    expect(mockDispatchEvent).toHaveBeenCalledTimes(1);
    expect(mockDispatchEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'dropdown-close',
        detail: { id: dropdown1 }
      })
    );
  });

  it('应该在关闭所有下拉菜单时触发关闭事件', () => {
    const dropdown1 = 'test-dropdown-1';
    
    manager.register(dropdown1);
    manager.open(dropdown1);
    expect(manager.isOpen(dropdown1)).toBe(true);
    
    // 关闭所有下拉菜单
    manager.closeAll();
    
    expect(mockDispatchEvent).toHaveBeenCalledTimes(1);
    expect(mockDispatchEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'dropdown-close',
        detail: { id: dropdown1 }
      })
    );
    expect(manager.isOpen(dropdown1)).toBe(false);
  });

  it('应该正确处理多个下拉菜单的复杂场景', () => {
    const dropdown1 = 'test-dropdown-1';
    const dropdown2 = 'test-dropdown-2';
    const dropdown3 = 'test-dropdown-3';
    
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
    
    // 验证事件触发次数
    expect(mockDispatchEvent).toHaveBeenCalledTimes(2); // 第2、3次打开时触发关闭事件
  });
});

describe('useDropdownManager 边缘情况测试', () => {
  let manager: ReturnType<typeof useDropdownManager>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockEventListeners.clear();
    manager = useDropdownManager();
    
    // Close all dropdowns to start with a clean state
    manager.closeAll();
    
    // Clear the dispatch event call from closeAll if any
    mockDispatchEvent.mockClear();
  });

  it('应该正确处理重复打开同一个下拉菜单', () => {
    const dropdownId = 'test-dropdown-1';
    
    manager.register(dropdownId);
    
    // 第一次打开
    manager.open(dropdownId);
    expect(manager.isOpen(dropdownId)).toBe(true);
    expect(mockDispatchEvent).toHaveBeenCalledTimes(0);
    
    // 重复打开同一个下拉菜单
    manager.open(dropdownId);
    expect(manager.isOpen(dropdownId)).toBe(true);
    // 不应该触发关闭事件，因为是同一个下拉菜单
    expect(mockDispatchEvent).toHaveBeenCalledTimes(0);
  });

  it('应该正确处理关闭不存在的下拉菜单', () => {
    const dropdownId = 'nonexistent-dropdown';
    
    // 关闭不存在的下拉菜单不应该抛出错误
    expect(() => manager.close(dropdownId)).not.toThrow();
    expect(manager.isOpen(dropdownId)).toBe(false);
  });

  it('应该正确处理注销不存在的下拉菜单', () => {
    const dropdownId = 'nonexistent-dropdown';
    
    // 注销不存在的下拉菜单不应该抛出错误
    expect(() => manager.unregister(dropdownId)).not.toThrow();
  });

  it('应该正确处理空状态下的 closeAll 调用', () => {
    // 没有打开的下拉菜单时调用 closeAll
    manager.closeAll();
    
    // 不应该触发任何事件
    expect(mockDispatchEvent).toHaveBeenCalledTimes(0);
  });

  it('应该正确处理已关闭下拉菜单的重复关闭', () => {
    const dropdownId = 'test-dropdown-1';
    
    manager.register(dropdownId);
    manager.open(dropdownId);
    expect(manager.isOpen(dropdownId)).toBe(true);
    
    // 第一次关闭
    manager.close(dropdownId);
    expect(manager.isOpen(dropdownId)).toBe(false);
    
    // 重复关闭
    manager.close(dropdownId);
    expect(manager.isOpen(dropdownId)).toBe(false);
    
    // 不应该有额外的副作用
  });
});

describe('useDropdownManager 多实例测试', () => {
  it('应该支持多个管理器实例共享状态', () => {
    const manager1 = useDropdownManager();
    const manager2 = useDropdownManager();
    
    const dropdownId = 'shared-dropdown';
    
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
});
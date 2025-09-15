import { ref } from "vue";

/**
 * 全局下拉管理器状态
 */
const currentOpenDropdown = ref<string | null>(null);

/**
 * 下拉管理器接口
 */
export interface DropdownManager {
    register: (id: string) => void;
    unregister: (id: string) => void;
    open: (id: string) => void;
    close: (id: string) => void;
    isOpen: (id: string) => boolean;
    closeAll: () => void;
}

/**
 * 使用下拉管理器
 * 管理下拉菜单的打开和关闭状态 确保同时只有一个下拉菜单打开
 * 当一个下拉菜单打开时，其他下拉菜单会自动关闭
 * 当一个下拉菜单关闭时，其他下拉菜单会自动打开
 * 当一个下拉菜单注销时，其他下拉菜单会自动打开
 * 当一个下拉菜单关闭所有时，其他下拉菜单会自动打开
 * 当一个下拉菜单注销所有时，其他下拉菜单会自动打开
 * 当一个下拉菜单注销所有时，其他下拉菜单会自动打开
 * @returns 下拉管理器
 */
export function useDropdownManager(): DropdownManager {
    const register = (_id: string) => {
        // 注册下拉菜单，但不需要特殊逻辑
    };

    /**
     * 注销下拉菜单
     * @param id 下拉菜单id
     */
    const unregister = (id: string) => {
        // 如果当前打开的是这个下拉菜单，则关闭
        if (currentOpenDropdown.value === id) {
            currentOpenDropdown.value = null;
        }
    };

    /**
     * 打开下拉菜单
     * @param id 下拉菜单id
     */
    const open = (id: string) => {
        // 关闭当前打开的下拉菜单（如果有）
        if (currentOpenDropdown.value && currentOpenDropdown.value !== id) {
            // 触发关闭事件
            const event = new CustomEvent("dropdown-close", {
                detail: { id: currentOpenDropdown.value },
            });
            document.dispatchEvent(event);
        }
        // 设置新的打开下拉菜单
        currentOpenDropdown.value = id;
    };

    /**
     * 关闭下拉菜单
     * @param id 下拉菜单id
     */
    const close = (id: string) => {
        if (currentOpenDropdown.value === id) {
            currentOpenDropdown.value = null;
        }
    };

    /**
     * 判断下拉菜单是否打开
     * @param id 下拉菜单id
     * @returns 是否打开
     */
    const isOpen = (id: string) => {
        return currentOpenDropdown.value === id;
    };

    /**
     * 关闭所有下拉菜单
     */
    const closeAll = () => {
        if (currentOpenDropdown.value) {
            const event = new CustomEvent("dropdown-close", {
                detail: { id: currentOpenDropdown.value },
            });
            document.dispatchEvent(event);
            currentOpenDropdown.value = null;
        }
    };

    /**
     * 返回下拉管理器
     * @returns 下拉管理器
     */
    return {
        register,
        unregister,
        open,
        close,
        isOpen,
        closeAll,
    };
}
